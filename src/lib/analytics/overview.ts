/**
 * src/lib/analytics/overview.ts — Overview page KPIs + trend + geo + leaderboard.
 */
import { db } from "@/lib/db";
import type { Filters, OverviewResponse, KpiCard, SalesTrendPoint, GeoDataPoint, RepAttainment } from "@/lib/types";
import { saleWhere, targetWhere, visitWhere, repWhere, monthKey } from "./filters";

export async function getOverview(filters: Filters): Promise<OverviewResponse> {
  // 1. KPIs
  const salesAgg = await db.sale.aggregate({
    where: saleWhere(filters),
    _sum: { netValueInr: true },
    _count: true,
  });
  const totalSales = salesAgg._sum.netValueInr || 0;

  // Targets: same FY as the filter window
  const targetAgg = await db.target.aggregate({
    where: targetWhere(filters),
    _sum: { targetValueInr: true },
  });
  const totalTarget = targetAgg._sum.targetValueInr || 1;
  const attainmentPct = (totalSales / totalTarget) * 100;

  // Active reps
  const activeReps = await db.rep.count({ where: { ...repWhere(filters), status: "Active" } });

  // Visits + working days
  const visitCount = await db.visit.count({ where: visitWhere(filters) });
  // Working days in range (Mon-Sat, excluding major holidays — approx with 6/7)
  const startD = new Date(filters.start + "T00:00:00.000Z");
  const endD = new Date(filters.end + "T00:00:00.000Z");
  const totalDays = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)));
  const workingDays = Math.max(1, Math.round(totalDays * (6 / 7)));
  const avgCallsPerDay = activeReps > 0 ? visitCount / (activeReps * workingDays) : 0;

  // Sparklines = last 6 months sales
  const sparkStart = new Date(endD);
  sparkStart.setUTCMonth(sparkStart.getUTCMonth() - 5);
  const sparkSales = await db.sale.findMany({
    where: {
      invoiceDate: { gte: sparkStart, lte: endD },
    },
    select: { invoiceDate: true, netValueInr: true },
  });
  const sparkByMonth: Record<string, number> = {};
  for (const s of sparkSales) {
    const k = monthKey(s.invoiceDate);
    sparkByMonth[k] = (sparkByMonth[k] || 0) + s.netValueInr;
  }
  const sparkline = Object.keys(sparkByMonth).sort().map((k) => sparkByMonth[k]);

  // Prior period (12 months before)
  const priorStartD = new Date(startD);
  priorStartD.setUTCFullYear(priorStartD.getUTCFullYear() - 1);
  const priorEndD = new Date(endD);
  priorEndD.setUTCFullYear(priorEndD.getUTCFullYear() - 1);
  const priorSalesAgg = await db.sale.aggregate({
    where: {
      invoiceDate: { gte: priorStartD, lte: priorEndD },
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
    _sum: { netValueInr: true },
  });
  const priorSales = priorSalesAgg._sum.netValueInr || 0;
  const salesDeltaPct = priorSales > 0 ? ((totalSales - priorSales) / priorSales) * 100 : 0;

  const kpis: KpiCard[] = [
    {
      label: "Total Sales",
      value: formatINR(totalSales),
      delta: `${salesDeltaPct >= 0 ? "+" : ""}${salesDeltaPct.toFixed(1)}% YoY`,
      deltaPct: salesDeltaPct.toFixed(1),
      deltaPositive: salesDeltaPct >= 0,
      sparkline,
      hint: `vs prior year ${formatINR(priorSales)}`,
    },
    {
      label: "Attainment %",
      value: `${attainmentPct.toFixed(1)}%`,
      delta: `vs target ${formatINR(totalTarget)}`,
      deltaPositive: attainmentPct >= 100,
      hint: "Actual / Target for selected period",
    },
    {
      label: "Active Reps",
      value: String(activeReps),
      delta: `${workingDays} working days`,
      hint: "Reps with status = Active in selected zone/role",
    },
    {
      label: "Avg Calls/Day",
      value: avgCallsPerDay.toFixed(1),
      delta: `${visitCount.toLocaleString("en-IN")} visits`,
      hint: "Total visits / (active reps × working days)",
    },
  ];

  // 2. Sales trend (24-month window ending at filters.end)
  const trendEnd = new Date(filters.end + "T00:00:00.000Z");
  const trendStart = new Date(trendEnd);
  trendStart.setUTCMonth(trendStart.getUTCMonth() - 23);
  trendStart.setUTCDate(1);
  const trendSales = await db.sale.findMany({
    where: {
      invoiceDate: { gte: trendStart, lte: trendEnd },
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
    select: { invoiceDate: true, netValueInr: true },
  });
  const byMonth: Record<string, number> = {};
  for (const s of trendSales) {
    const k = monthKey(s.invoiceDate);
    byMonth[k] = (byMonth[k] || 0) + s.netValueInr;
  }
  // Prior year (same months)
  const priorTrendEnd = new Date(trendEnd);
  priorTrendEnd.setUTCFullYear(priorTrendEnd.getUTCFullYear() - 1);
  const priorTrendStart = new Date(trendStart);
  priorTrendStart.setUTCFullYear(priorTrendStart.getUTCFullYear() - 1);
  const priorTrendSales = await db.sale.findMany({
    where: {
      invoiceDate: { gte: priorTrendStart, lte: priorTrendEnd },
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
    select: { invoiceDate: true, netValueInr: true },
  });
  const byMonthPrior: Record<string, number> = {};
  for (const s of priorTrendSales) {
    const d = new Date(s.invoiceDate);
    d.setUTCFullYear(d.getUTCFullYear() + 1); // shift to current year
    const k = monthKey(d);
    byMonthPrior[k] = (byMonthPrior[k] || 0) + s.netValueInr;
  }
  // Build the full month list (24 months)
  const salesTrend: SalesTrendPoint[] = [];
  const cursor = new Date(trendStart);
  while (cursor <= trendEnd) {
    const k = monthKey(cursor);
    salesTrend.push({
      month: k,
      actual: byMonth[k] || 0,
      target: null,
      priorYear: byMonthPrior[k] || null,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  // 3. Geo data: state-wise revenue
  const stateAgg = await db.sale.groupBy({
    by: ["repId"],
    where: saleWhere(filters),
    _sum: { netValueInr: true },
  });
  // Map repId -> state
  const repIds = Array.from(new Set(stateAgg.map((r) => r.repId)));
  const reps = await db.rep.findMany({
    where: { repId: { in: repIds } },
    select: { repId: true, state: true },
  });
  const repState = new Map(reps.map((r) => [r.repId, r.state]));
  const stateRevenue: Record<string, number> = {};
  for (const r of stateAgg) {
    const state = repState.get(r.repId) || "Unknown";
    stateRevenue[state] = (stateRevenue[state] || 0) + (r._sum.netValueInr || 0);
  }
  const geoData: GeoDataPoint[] = Object.entries(stateRevenue)
    .map(([state, value]) => ({ state, value }))
    .sort((a, b) => b.value - a.value);

  // 4. Rep leaderboard — top 10 by attainment %
  const repSales = await db.sale.groupBy({
    by: ["repId"],
    where: saleWhere(filters),
    _sum: { netValueInr: true },
  });
  const repSalesMap = new Map(repSales.map((r) => [r.repId, r._sum.netValueInr || 0]));
  // Targets by rep for same period
  const repTargets = await db.target.groupBy({
    by: ["repId"],
    where: targetWhere(filters),
    _sum: { targetValueInr: true },
  });
  const repTargetsMap = new Map(repTargets.map((r) => [r.repId, r._sum.targetValueInr || 0]));
  // Rep details
  const leaderboardReps = await db.rep.findMany({
    where: { repId: { in: repIds } },
    select: { repId: true, firstName: true, lastName: true, zone: true },
  });
  const leaderboard: RepAttainment[] = leaderboardReps
    .map((r) => {
      const sales = repSalesMap.get(r.repId) || 0;
      const target = repTargetsMap.get(r.repId) || 0;
      const attainment = target > 0 ? (sales / target) * 100 : 0;
      return {
        repId: r.repId,
        repName: `${r.firstName} ${r.lastName}`,
        zone: r.zone,
        attainmentPct: attainment,
        revenueInr: sales,
      };
    })
    .sort((a, b) => b.attainmentPct - a.attainmentPct)
    .slice(0, 10);

  return { kpis, salesTrend, geoData, leaderboard };
}

function formatINR(value: number): string {
  if (value == null || isNaN(value)) return "₹0";
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}
