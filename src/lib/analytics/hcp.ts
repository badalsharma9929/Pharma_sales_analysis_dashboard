/**
 * src/lib/analytics/hcp.ts — HCP Targeting & Segmentation analytics.
 */
import { db } from "@/lib/db";
import type {
  Filters, HcpResponse, KpiCard, ScatterRoiPoint,
} from "@/lib/types";
import { saleWhere } from "./filters";

export async function getHcp(filters: Filters): Promise<HcpResponse> {
  const startD = new Date(filters.start + "T00:00:00.000Z");
  const endD = new Date(filters.end + "T23:59:59.999Z");

  // 1. KPIs
  const hcpWhere: { zone?: { in: string[] } } = {};
  if (filters.zones.length) hcpWhere.zone = { in: filters.zones };
  const totalHcps = await db.hcp.count({ where: hcpWhere });

  // Tier-A coverage
  const tierAHcps = await db.hcp.findMany({
    where: { tier: "A", ...hcpWhere },
    select: { hcpId: true },
  });
  const tierAHcpIds = tierAHcps.map((h) => h.hcpId);
  const visitedTierA = await db.visit.findMany({
    where: {
      visitDate: { gte: startD, lte: endD },
      hcpId: { in: tierAHcpIds },
      ...(filters.zones.length || filters.roles.length
        ? {
            rep: {
              ...(filters.zones.length ? { zone: { in: filters.zones } } : {}),
              ...(filters.roles.length ? { role: { in: filters.roles } } : {}),
            },
          }
        : {}),
    },
    distinct: ["hcpId"],
    select: { hcpId: true },
  });
  const tierACoveragePct = tierAHcpIds.length > 0
    ? (visitedTierA.length / tierAHcpIds.length) * 100
    : 0;

  // Untapped high-value HCPs (Tier-A with 0 visits in last 90 days)
  const ninetyDaysAgo = new Date(endD);
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
  const tierAVisitsLast90 = await db.visit.findMany({
    where: {
      visitDate: { gte: ninetyDaysAgo, lte: endD },
      hcpId: { in: tierAHcpIds },
    },
    distinct: ["hcpId"],
    select: { hcpId: true },
  });
  const tierAVisitedInLast90 = new Set(tierAVisitsLast90.map((v) => v.hcpId));
  const untappedCount = tierAHcpIds.length - tierAVisitedInLast90.size;

  // Avg ROI per HCP = total revenue / total visits (per HCP, then averaged)
  const totalRevenue = (await db.sale.aggregate({
    where: saleWhere(filters),
    _sum: { netValueInr: true },
  }))._sum.netValueInr || 0;
  const totalVisits = await db.visit.count({
    where: {
      visitDate: { gte: startD, lte: endD },
      ...(filters.zones.length || filters.roles.length
        ? {
            rep: {
              ...(filters.zones.length ? { zone: { in: filters.zones } } : {}),
              ...(filters.roles.length ? { role: { in: filters.roles } } : {}),
            },
          }
        : {}),
    },
  });
  const avgRoi = totalVisits > 0 ? totalRevenue / totalVisits : 0;

  const kpis: KpiCard[] = [
    {
      label: "Total HCPs",
      value: totalHcps.toLocaleString("en-IN"),
      hint: "All HCPs in selected zone filter",
    },
    {
      label: "Tier-A Coverage",
      value: `${tierACoveragePct.toFixed(1)}%`,
      delta: `${visitedTierA.length} / ${tierAHcpIds.length} Tier-A HCPs visited`,
      deltaPositive: tierACoveragePct >= 80,
    },
    {
      label: "Untapped High-Value",
      value: untappedCount.toLocaleString("en-IN"),
      delta: `Tier-A with 0 visits in last 90d`,
      deltaPositive: untappedCount === 0,
    },
    {
      label: "Avg ROI / HCP",
      value: formatINR(avgRoi),
      delta: `revenue per visit`,
    },
  ];

  // 2. Tier-wise coverage
  const tiers = ["A", "B", "C"];
  const tierCoverage = [];
  for (const tier of tiers) {
    const hcpsInTier = await db.hcp.findMany({
      where: { tier, ...hcpWhere },
      select: { hcpId: true },
    });
    const ids = hcpsInTier.map((h) => h.hcpId);
    const total = ids.length;
    if (total === 0) {
      tierCoverage.push({ tier, total: 0, visited: 0, coveragePct: 0 });
      continue;
    }
    const visited = await db.visit.findMany({
      where: {
        visitDate: { gte: startD, lte: endD },
        hcpId: { in: ids },
        ...(filters.zones.length || filters.roles.length
          ? {
              rep: {
                ...(filters.zones.length ? { zone: { in: filters.zones } } : {}),
                ...(filters.roles.length ? { role: { in: filters.roles } } : {}),
              },
            }
          : {}),
      },
      distinct: ["hcpId"],
      select: { hcpId: true },
    });
    tierCoverage.push({
      tier,
      total,
      visited: visited.length,
      coveragePct: (visited.length / total) * 100,
    });
  }

  // 3. Decile-wise revenue contribution
  const hcpRevenue = await db.sale.groupBy({
    by: ["hcpId"],
    where: saleWhere(filters),
    _sum: { netValueInr: true },
  });
  const hcpIds = hcpRevenue.map((h) => h.hcpId);
  const hcpInfo = await db.hcp.findMany({
    where: { hcpId: { in: hcpIds } },
    select: { hcpId: true, decile: true },
  });
  const decileMap = new Map(hcpInfo.map((h) => [h.hcpId, h.decile]));
  const decileRevenue: Record<number, number> = {};
  for (const h of hcpRevenue) {
    const d = decileMap.get(h.hcpId) || 10;
    decileRevenue[d] = (decileRevenue[d] || 0) + (h._sum.netValueInr || 0);
  }
  const totalRev = Object.values(decileRevenue).reduce((a, b) => a + b, 0) || 1;
  const decileContribution = Array.from({ length: 10 }, (_, i) => i + 1).map((d) => ({
    decile: d,
    revenueInr: decileRevenue[d] || 0,
    sharePct: ((decileRevenue[d] || 0) / totalRev) * 100,
  }));

  // 4. Untapped HCPs table (Tier-A, 0 visits in 90d) — top 50 by lifetime revenue
  const untappedHcpIds = tierAHcpIds.filter((id) => !tierAVisitedInLast90.has(id));
  const untappedHcpInfo = await db.hcp.findMany({
    where: { hcpId: { in: untappedHcpIds } },
    select: {
      hcpId: true, firstName: true, lastName: true, specialty: true, city: true, tier: true,
    },
  });
  // Last visit date for each
  const lastVisits = await db.visit.findMany({
    where: { hcpId: { in: untappedHcpIds } },
    distinct: ["hcpId"],
    orderBy: { visitDate: "desc" },
    select: { hcpId: true, visitDate: true },
  });
  const lastVisitMap = new Map(lastVisits.map((v) => [v.hcpId, v.visitDate]));
  // Lifetime revenue per HCP
  const lifetimeRev = await db.sale.groupBy({
    by: ["hcpId"],
    where: { hcpId: { in: untappedHcpIds } },
    _sum: { netValueInr: true },
  });
  const lifetimeRevMap = new Map(lifetimeRev.map((r) => [r.hcpId, r._sum.netValueInr || 0]));
  const untappedHcps = untappedHcpInfo
    .map((h) => ({
      hcpId: h.hcpId,
      name: `Dr. ${h.firstName} ${h.lastName}`,
      specialty: h.specialty,
      city: h.city,
      tier: h.tier,
      lastVisitDate: lastVisitMap.get(h.hcpId)?.toISOString().slice(0, 10) || null,
      lifetimeRevenueInr: lifetimeRevMap.get(h.hcpId) || 0,
    }))
    .sort((a, b) => b.lifetimeRevenueInr - a.lifetimeRevenueInr)
    .slice(0, 50);

  // 5. HCP churn table — revenue dropped >50% QoQ
  // Compute current quarter vs prior quarter revenue per HCP
  // Current quarter = quarter of filters.end; prior = previous
  const endMonth = endD.getUTCMonth();
  const endYear = endD.getUTCFullYear();
  let curQStart: Date, curQEnd: Date, prevQStart: Date, prevQEnd: Date;
  if (endMonth <= 2) {
    curQStart = new Date(Date.UTC(endYear, 0, 1));
    curQEnd = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59));
    prevQStart = new Date(Date.UTC(endYear - 1, 9, 1));
    prevQEnd = new Date(Date.UTC(endYear - 1, 11, 31, 23, 59, 59));
  } else if (endMonth <= 5) {
    curQStart = new Date(Date.UTC(endYear, 3, 1));
    curQEnd = new Date(Date.UTC(endYear, 5, 30, 23, 59, 59));
    prevQStart = new Date(Date.UTC(endYear, 0, 1));
    prevQEnd = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59));
  } else if (endMonth <= 8) {
    curQStart = new Date(Date.UTC(endYear, 6, 1));
    curQEnd = new Date(Date.UTC(endYear, 8, 30, 23, 59, 59));
    prevQStart = new Date(Date.UTC(endYear, 3, 1));
    prevQEnd = new Date(Date.UTC(endYear, 5, 30, 23, 59, 59));
  } else {
    curQStart = new Date(Date.UTC(endYear, 9, 1));
    curQEnd = new Date(Date.UTC(endYear, 11, 31, 23, 59, 59));
    prevQStart = new Date(Date.UTC(endYear, 6, 1));
    prevQEnd = new Date(Date.UTC(endYear, 8, 30, 23, 59, 59));
  }

  const curSales = await db.sale.groupBy({
    by: ["hcpId"],
    where: {
      invoiceDate: { gte: curQStart, lte: curQEnd },
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
  const prevSales = await db.sale.groupBy({
    by: ["hcpId"],
    where: {
      invoiceDate: { gte: prevQStart, lte: prevQEnd },
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
  const curMap = new Map(curSales.map((s) => [s.hcpId, s._sum.netValueInr || 0]));
  const prevMap = new Map(prevSales.map((s) => [s.hcpId, s._sum.netValueInr || 0]));
  const churnHcpIds = Array.from(new Set([...curMap.keys(), ...prevMap.keys()]));
  const churnHcpInfo = await db.hcp.findMany({
    where: { hcpId: { in: churnHcpIds } },
    select: { hcpId: true, firstName: true, lastName: true, tier: true },
  });
  const churnTable = churnHcpInfo
    .map((h) => {
      const cur = curMap.get(h.hcpId) || 0;
      const prev = prevMap.get(h.hcpId) || 0;
      const changePct = prev > 0 ? ((cur - prev) / prev) * 100 : 0;
      return {
        hcpId: h.hcpId,
        name: `Dr. ${h.firstName} ${h.lastName}`,
        tier: h.tier,
        priorQuarterRevenueInr: prev,
        currentQuarterRevenueInr: cur,
        changePct,
      };
    })
    .filter((r) => r.priorQuarterRevenueInr > 0 && r.changePct < -50)
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, 50);

  // 6. Scatter ROI (rep-level) — revenue vs expense
  const repSalesAgg = await db.sale.groupBy({
    by: ["repId"],
    where: saleWhere(filters),
    _sum: { netValueInr: true },
  });
  const repExpAgg = await db.expense.groupBy({
    by: ["repId"],
    where: {
      expenseDate: { gte: startD, lte: endD },
      ...(filters.zones.length || filters.roles.length
        ? {
            rep: {
              ...(filters.zones.length ? { zone: { in: filters.zones } } : {}),
              ...(filters.roles.length ? { role: { in: filters.roles } } : {}),
            },
          }
        : {}),
    },
    _sum: { amountInr: true },
  });
  const repSalesMap = new Map(repSalesAgg.map((r) => [r.repId, r._sum.netValueInr || 0]));
  const repExpMap = new Map(repExpAgg.map((r) => [r.repId, r._sum.amountInr || 0]));
  const allRepIds = Array.from(new Set([...repSalesMap.keys(), ...repExpMap.keys()]));
  const repInfo = await db.rep.findMany({
    where: { repId: { in: allRepIds } },
    select: { repId: true, firstName: true, lastName: true },
  });
  const scatterRoi: ScatterRoiPoint[] = repInfo
    .map((r) => {
      const revenue = repSalesMap.get(r.repId) || 0;
      const expense = repExpMap.get(r.repId) || 0;
      const roi = expense > 0 ? revenue / expense : 0;
      return {
        repName: `${r.firstName} ${r.lastName}`,
        expense,
        revenue,
        roi,
      };
    })
    .filter((p) => p.revenue > 0 && p.expense > 0);

  return {
    kpis,
    tierCoverage,
    decileContribution,
    untappedHcps,
    churnTable,
    scatterRoi,
  };
}

function formatINR(value: number): string {
  if (value == null || isNaN(value)) return "₹0";
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}
