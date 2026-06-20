/**
 * src/lib/analytics/forecast.ts — Forecasting module (Holt-Winters via Python subprocess
 * with a moving-average fallback in pure TS).
 *
 * Agent decision: We use a pure-TS triple-exponential-smoothing (Holt-Winters)
 * implementation to avoid the Python subprocess dependency at runtime. The model
 * matches statsmodels' Holt-Winters conceptually (level + trend + seasonality,
 * 12-month seasonality) but is implemented in TS so the dev server can compute
 * forecasts synchronously without spawning Python.
 */
import { db } from "@/lib/db";
import type {
  Filters, ForecastResponse, KpiCard, ForecastPoint,
} from "@/lib/types";
import { monthKey } from "./filters";

const SEASONALITY = 12;
const FORECAST_HORIZON = 3;

export async function getForecast(filters: Filters): Promise<ForecastResponse> {
  // Get monthly revenue per zone (region) for last 36 months
  const startD = new Date(filters.start + "T00:00:00.000Z");
  const endD = new Date(filters.end + "T23:59:59.999Z");
  // Use a 36-month window ending at filters.end for training
  const trainEnd = new Date(endD);
  const trainStart = new Date(trainEnd);
  trainStart.setUTCFullYear(trainStart.getUTCFullYear() - 3);

  const sales = await db.sale.findMany({
    where: {
      invoiceDate: { gte: trainStart, lte: trainEnd },
      ...(filters.zones.length || filters.roles.length
        ? {
            rep: {
              ...(filters.zones.length ? { zone: { in: filters.zones } } : {}),
              ...(filters.roles.length ? { role: { in: filters.roles } } : {}),
            },
          }
        : {}),
      ...(filters.therapies.length ? { product: { therapyArea: { in: filters.therapies } } } : {}),
    },
    select: { invoiceDate: true, netValueInr: true, repId: true },
  });
  // Get rep->zone mapping
  const repIds = Array.from(new Set(sales.map((s) => s.repId)));
  const reps = await db.rep.findMany({
    where: { repId: { in: repIds } },
    select: { repId: true, zone: true },
  });
  const repZone = new Map(reps.map((r) => [r.repId, r.zone]));
  // Bucket by zone + month
  const byZoneMonth: Record<string, Record<string, number>> = {};
  for (const s of sales) {
    const zone = repZone.get(s.repId) || "Unknown";
    const k = monthKey(s.invoiceDate);
    byZoneMonth[zone] = byZoneMonth[zone] || {};
    byZoneMonth[zone][k] = (byZoneMonth[zone][k] || 0) + s.netValueInr;
  }
  // Build full month list (36 months)
  const monthList: string[] = [];
  const cursor = new Date(trainStart);
  while (cursor <= trainEnd) {
    monthList.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  // Per-region forecast
  const perRegion = [];
  let overallMape = 0;
  let regionCount = 0;
  for (const zone of Object.keys(byZoneMonth).sort()) {
    const series = monthList.map((m) => byZoneMonth[zone][m] || 0);
    if (series.filter((v) => v > 0).length < SEASONALITY * 2) continue; // not enough data
    // Backtest: train on first N-3, predict last 3
    const trainSeries = series.slice(0, series.length - FORECAST_HORIZON);
    const actualsLast3 = series.slice(series.length - FORECAST_HORIZON);
    const { forecast: btForecast, mape } = holtWinters(trainSeries, FORECAST_HORIZON, actualsLast3);
    // Full forecast: retrain on all 36 months, forecast next 3
    const { forecast, ci80Lower, ci80Upper, ci95Lower, ci95Upper } = holtWinters(series, FORECAST_HORIZON);
    overallMape += mape;
    regionCount++;
    // Build series: actual for historical, forecast+CI for next 3
    const seriesOut: ForecastPoint[] = [];
    for (let i = 0; i < series.length; i++) {
      seriesOut.push({
        month: monthList[i],
        actual: series[i],
        forecast: null,
        ci80Lower: null,
        ci80Upper: null,
        ci95Lower: null,
        ci95Upper: null,
      });
    }
    // Add forecast points
    const forecastMonths = getNextMonths(monthList[monthList.length - 1], FORECAST_HORIZON);
    for (let i = 0; i < FORECAST_HORIZON; i++) {
      seriesOut.push({
        month: forecastMonths[i],
        actual: null,
        forecast: forecast[i],
        ci80Lower: ci80Lower[i],
        ci80Upper: ci80Upper[i],
        ci95Lower: ci95Lower[i],
        ci95Upper: ci95Upper[i],
      });
    }
    perRegion.push({ region: zone, mapePct: mape, series: seriesOut });
  }
  const avgMape = regionCount > 0 ? overallMape / regionCount : 0;

  // Next quarter forecast = sum of forecasted months across all regions
  let nextQForecast = 0;
  for (const r of perRegion) {
    const fc = r.series.filter((s) => s.forecast !== null).map((s) => s.forecast!);
    nextQForecast += fc.reduce((a, b) => a + b, 0);
  }

  // Per-product forecast
  const salesByProduct = await db.sale.findMany({
    where: {
      invoiceDate: { gte: trainStart, lte: trainEnd },
      ...(filters.zones.length || filters.roles.length
        ? {
            rep: {
              ...(filters.zones.length ? { zone: { in: filters.zones } } : {}),
              ...(filters.roles.length ? { role: { in: filters.roles } } : {}),
            },
          }
        : {}),
      ...(filters.therapies.length ? { product: { therapyArea: { in: filters.therapies } } } : {}),
    },
    select: { invoiceDate: true, netValueInr: true, productId: true },
  });
  const products = await db.product.findMany();
  const prodById = new Map(products.map((p) => [p.productId, p]));
  const byProduct: Record<string, Record<string, number>> = {};
  for (const s of salesByProduct) {
    const k = monthKey(s.invoiceDate);
    byProduct[s.productId] = byProduct[s.productId] || {};
    byProduct[s.productId][k] = (byProduct[s.productId][k] || 0) + s.netValueInr;
  }
  const perProduct = [];
  for (const p of products) {
    const series = monthList.map((m) => (byProduct[p.productId]?.[m]) || 0);
    if (series.filter((v) => v > 0).length < SEASONALITY * 2) continue;
    const trainSeries = series.slice(0, series.length - FORECAST_HORIZON);
    const actualsLast3 = series.slice(series.length - FORECAST_HORIZON);
    const { mape } = holtWinters(trainSeries, FORECAST_HORIZON, actualsLast3);
    const { forecast, ci80Lower, ci80Upper, ci95Lower, ci95Upper } = holtWinters(series, FORECAST_HORIZON);
    const forecastMonths = getNextMonths(monthList[monthList.length - 1], FORECAST_HORIZON);
    perProduct.push({
      productId: p.productId,
      productName: p.productName,
      mapePct: mape,
      next3Months: forecast.map((f, i) => ({
        month: forecastMonths[i],
        forecast: Math.round(f),
        ci80Lower: Math.round(ci80Lower[i]),
        ci80Upper: Math.round(ci80Upper[i]),
        ci95Lower: Math.round(ci95Lower[i]),
        ci95Upper: Math.round(ci95Upper[i]),
      })),
    });
  }

  // KPIs
  const kpis: KpiCard[] = [
    {
      label: "Next-Quarter Forecast",
      value: formatINR(nextQForecast),
      delta: `across ${perRegion.length} regions`,
    },
    {
      label: "MAPE",
      value: `${avgMape.toFixed(1)}%`,
      delta: avgMape < 15 ? "low error" : avgMape < 30 ? "moderate" : "high",
      deltaPositive: avgMape < 20,
      hint: "Mean Absolute Percentage Error (backtest on last 3 months)",
    },
    {
      label: "Confidence",
      value: avgMape < 15 ? "High" : avgMape < 30 ? "Medium" : "Low",
      delta: `80% & 95% CI provided`,
      deltaPositive: avgMape < 20,
    },
  ];

  return { kpis, perRegion, perProduct };
}

/**
 * Holt-Winters triple exponential smoothing.
 * Returns forecast for `horizon` periods + confidence intervals based on
 * the standard deviation of backtest residuals.
 */
function holtWinters(
  series: number[],
  horizon: number,
  actualsForBacktest?: number[],
): {
  forecast: number[];
  ci80Lower: number[];
  ci80Upper: number[];
  ci95Lower: number[];
  ci95Upper: number[];
  mape: number;
} {
  // Defaults
  const alpha = 0.5;   // level
  const beta = 0.1;    // trend
  const gamma = 0.3;   // seasonality
  const L = SEASONALITY;

  if (series.length < L * 2) {
    // Fallback: simple moving average
    const avg = series.slice(-L).reduce((a, b) => a + b, 0) / L;
    const forecast = new Array(horizon).fill(avg);
    const std = stdDev(series.slice(-L)) || avg * 0.1 || 1;
    return {
      forecast,
      ci80Lower: forecast.map((f) => f - 1.282 * std),
      ci80Upper: forecast.map((f) => f + 1.282 * std),
      ci95Lower: forecast.map((f) => f - 1.96 * std),
      ci95Upper: forecast.map((f) => f + 1.96 * std),
      mape: 0,
    };
  }

  // Initialize
  const seasonals: number[] = [];
  const seasonAverages: number[] = [];
  const nSeasons = Math.floor(series.length / L);
  for (let i = 0; i < nSeasons; i++) {
    const avg = series.slice(i * L, (i + 1) * L).reduce((a, b) => a + b, 0) / L;
    seasonAverages.push(avg);
  }
  const overallAvg = seasonAverages.reduce((a, b) => a + b, 0) / nSeasons;
  for (let i = 0; i < L; i++) {
    let sum = 0;
    for (let j = 0; j < nSeasons; j++) sum += series[j * L + i];
    seasonals.push(sum / nSeasons - overallAvg);
  }
  let level = series[0];
  let trend = (series[L] - series[0]) / L;
  const smoothed: number[] = [];
  for (let i = 0; i < series.length; i++) {
    const s = seasonals[i % L];
    const lastLevel = level;
    level = alpha * (series[i] - s) + (1 - alpha) * (level + trend);
    trend = beta * (level - lastLevel) + (1 - beta) * trend;
    seasonals[i % L] = gamma * (series[i] - level) + (1 - gamma) * s;
    smoothed.push(level + trend + seasonals[i % L]);
  }
  // Forecast
  const forecast: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const f = level + h * trend + seasonals[(series.length + h - 1) % L];
    forecast.push(Math.max(0, f));
  }
  // Confidence intervals based on residuals std
  const residuals = series.map((v, i) => v - smoothed[i]);
  const sd = stdDev(residuals) || 1;
  const ci80Lower = forecast.map((f) => Math.max(0, f - 1.282 * sd));
  const ci80Upper = forecast.map((f) => f + 1.282 * sd);
  const ci95Lower = forecast.map((f) => Math.max(0, f - 1.96 * sd));
  const ci95Upper = forecast.map((f) => f + 1.96 * sd);
  // MAPE
  let mape = 0;
  if (actualsForBacktest && actualsForBacktest.length === horizon) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < horizon; i++) {
      if (actualsForBacktest[i] > 0) {
        sum += Math.abs(actualsForBacktest[i] - forecast[i]) / actualsForBacktest[i];
        n++;
      }
    }
    mape = n > 0 ? (sum / n) * 100 : 0;
  }
  return { forecast, ci80Lower, ci80Upper, ci95Lower, ci95Upper, mape };
}

function stdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/** Get the next N month keys after the given YYYY-MM. */
function getNextMonths(lastMonth: string, n: number): string[] {
  const [y, m] = lastMonth.split("-").map(Number);
  const out: string[] = [];
  let cy = y, cm = m;
  for (let i = 0; i < n; i++) {
    cm++;
    if (cm > 12) {
      cm = 1;
      cy++;
    }
    out.push(`${cy}-${String(cm).padStart(2, "0")}`);
  }
  return out;
}

function formatINR(value: number): string {
  if (value == null || isNaN(value)) return "₹0";
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}
