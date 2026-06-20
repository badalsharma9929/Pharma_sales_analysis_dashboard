/**
 * src/lib/analytics/sales.ts — Sales Performance module analytics.
 */
import { db } from "@/lib/db";
import type {
  Filters, SalesResponse, KpiCard, SalesTrendPoint, RepAttainment, StateRevenueRow,
} from "@/lib/types";
import { saleWhere, targetWhere, monthKey, fyFromIso } from "./filters";

export async function getSales(filters: Filters): Promise<SalesResponse> {
  // 1. KPIs
  const salesAgg = await db.sale.aggregate({
    where: saleWhere(filters),
    _sum: { netValueInr: true },
  });
  const totalSales = salesAgg._sum.netValueInr || 0;

  const targetAgg = await db.target.aggregate({
    where: targetWhere(filters),
    _sum: { targetValueInr: true },
  });
  const totalTarget = targetAgg._sum.targetValueInr || 1;
  const attainmentPct = (totalSales / totalTarget) * 100;

  // YoY (same window last year)
  const startD = new Date(filters.start + "T00:00:00.000Z");
  const endD = new Date(filters.end + "T23:59:59.999Z");
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
  const yoyPct = priorSales > 0 ? ((totalSales - priorSales) / priorSales) * 100 : 0;

  // MoM (last month vs prior month within range)
  const lastMonthEnd = new Date(endD);
  const lastMonthStart = new Date(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1);
  const prevMonthEnd = new Date(lastMonthStart.getTime() - 1);
  const prevMonthStart = new Date(prevMonthEnd.getUTCFullYear(), prevMonthEnd.getUTCMonth(), 1);
  const momSalesAgg = await db.sale.aggregate({
    where: {
      invoiceDate: { gte: lastMonthStart, lte: lastMonthEnd },
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
  const prevMomSalesAgg = await db.sale.aggregate({
    where: {
      invoiceDate: { gte: prevMonthStart, lte: prevMonthEnd },
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
  const momLast = momSalesAgg._sum.netValueInr || 0;
  const momPrev = prevMomSalesAgg._sum.netValueInr || 0;
  const momPct = momPrev > 0 ? ((momLast - momPrev) / momPrev) * 100 : 0;

  const kpis: KpiCard[] = [
    {
      label: "Total Sales",
      value: formatINR(totalSales),
      delta: `${yoyPct >= 0 ? "+" : ""}${yoyPct.toFixed(1)}% YoY`,
      deltaPct: yoyPct.toFixed(1),
      deltaPositive: yoyPct >= 0,
    },
    {
      label: "Attainment %",
      value: `${attainmentPct.toFixed(1)}%`,
      delta: `target ${formatINR(totalTarget)}`,
      deltaPositive: attainmentPct >= 100,
    },
    {
      label: "YoY Growth",
      value: `${yoyPct.toFixed(1)}%`,
      delta: `vs ${formatINR(priorSales)}`,
      deltaPositive: yoyPct >= 0,
    },
    {
      label: "MoM Growth",
      value: `${momPct.toFixed(1)}%`,
      delta: `last ${formatINR(momLast)}`,
      deltaPositive: momPct >= 0,
    },
  ];

  // 2. Sales trend with target overlay
  const trendSales = await db.sale.findMany({
    where: saleWhere(filters),
    select: { invoiceDate: true, netValueInr: true },
  });
  const byMonth: Record<string, number> = {};
  for (const s of trendSales) {
    const k = monthKey(s.invoiceDate);
    byMonth[k] = (byMonth[k] || 0) + s.netValueInr;
  }
  // Targets by FY + quarter — spread quarterly target evenly across 3 months
  const targets = await db.target.findMany({
    where: targetWhere(filters),
    select: { fy: true, quarter: true, targetValueInr: true },
  });
  // Approximate: distribute quarterly target across months in the quarter
  const targetByMonth: Record<string, number> = {};
  for (const t of targets) {
    const months = quarterMonths(t.fy, t.quarter);
    const per = Math.round((t.targetValueInr || 0) / 3);
    for (const m of months) {
      targetByMonth[m] = (targetByMonth[m] || 0) + per;
    }
  }
  // Prior year actuals
  const priorTrendSales = await db.sale.findMany({
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
    select: { invoiceDate: true, netValueInr: true },
  });
  const priorByMonth: Record<string, number> = {};
  for (const s of priorTrendSales) {
    const d = new Date(s.invoiceDate);
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    const k = monthKey(d);
    priorByMonth[k] = (priorByMonth[k] || 0) + s.netValueInr;
  }
  const salesTrend: SalesTrendPoint[] = [];
  const cursor = new Date(startD);
  while (cursor <= endD) {
    const k = monthKey(cursor);
    salesTrend.push({
      month: k,
      actual: byMonth[k] || 0,
      target: targetByMonth[k] || null,
      priorYear: priorByMonth[k] || null,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  // 3. Top/bottom 10 reps by attainment
  const repSalesAgg = await db.sale.groupBy({
    by: ["repId"],
    where: saleWhere(filters),
    _sum: { netValueInr: true },
  });
  const repTargetAgg = await db.target.groupBy({
    by: ["repId"],
    where: targetWhere(filters),
    _sum: { targetValueInr: true },
  });
  const repSalesMap = new Map(repSalesAgg.map((r) => [r.repId, r._sum.netValueInr || 0]));
  const repTargetMap = new Map(repTargetAgg.map((r) => [r.repId, r._sum.targetValueInr || 0]));
  const repIds = Array.from(new Set([...repSalesMap.keys(), ...repTargetMap.keys()]));
  const reps = await db.rep.findMany({
    where: { repId: { in: repIds } },
    select: { repId: true, firstName: true, lastName: true, zone: true },
  });
  const allRepAttainment: RepAttainment[] = reps
    .map((r) => {
      const sales = repSalesMap.get(r.repId) || 0;
      const target = repTargetMap.get(r.repId) || 0;
      return {
        repId: r.repId,
        repName: `${r.firstName} ${r.lastName}`,
        zone: r.zone,
        attainmentPct: target > 0 ? (sales / target) * 100 : 0,
        revenueInr: sales,
      };
    })
    .filter((r) => r.revenueInr > 0);
  const topReps = [...allRepAttainment].sort((a, b) => b.attainmentPct - a.attainmentPct).slice(0, 10);
  const bottomReps = [...allRepAttainment].sort((a, b) => a.attainmentPct - b.attainmentPct).slice(0, 10);

  // 4. State-wise revenue
  const repToState = new Map(reps.map((r) => [r.repId, r.state]));
  const stateAgg: Record<string, number> = {};
  for (const [repId, sales] of repSalesMap.entries()) {
    const state = repToState.get(repId) || "Unknown";
    stateAgg[state] = (stateAgg[state] || 0) + sales;
  }
  const totalAllStates = Object.values(stateAgg).reduce((a, b) => a + b, 0) || 1;
  // Get zone per state from reps
  const repToZone = new Map(reps.map((r) => [r.repId, r.zone]));
  const stateZone: Record<string, string> = {};
  for (const repId of repSalesMap.keys()) {
    const st = repToState.get(repId);
    const z = repToZone.get(repId);
    if (st && z) stateZone[st] = z;
  }
  // State-level target attainment — approximate by summing target across all reps in that state
  const stateTargets: Record<string, number> = {};
  for (const [repId, target] of repTargetMap.entries()) {
    const st = repToState.get(repId);
    if (st) stateTargets[st] = (stateTargets[st] || 0) + target;
  }
  const stateRevenue: StateRevenueRow[] = Object.entries(stateAgg)
    .map(([state, revenueInr]) => ({
      state,
      zone: stateZone[state] || "-",
      revenueInr,
      attainmentPct: stateTargets[state] > 0 ? (revenueInr / stateTargets[state]) * 100 : null,
      sharePct: (revenueInr / totalAllStates) * 100,
    }))
    .sort((a, b) => b.revenueInr - a.revenueInr);

  return { kpis, salesTrend, topReps, bottomReps, stateRevenue };
}

/** Months (YYYY-MM) covered by an FY+Q. Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar. */
function quarterMonths(fy: number, quarter: string): string[] {
  if (quarter === "Q1") return [`${fy}-04`, `${fy}-05`, `${fy}-06`];
  if (quarter === "Q2") return [`${fy}-07`, `${fy}-08`, `${fy}-09`];
  if (quarter === "Q3") return [`${fy}-10`, `${fy}-11`, `${fy}-12`];
  // Q4 spans calendar year boundary
  return [`${fy + 1}-01`, `${fy + 1}-02`, `${fy + 1}-03`];
}

function formatINR(value: number): string {
  if (value == null || isNaN(value)) return "₹0";
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}
