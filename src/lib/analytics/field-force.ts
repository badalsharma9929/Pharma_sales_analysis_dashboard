/**
 * src/lib/analytics/fieldForce.ts — Field Force Activity module analytics.
 */
import { db } from "@/lib/db";
import type {
  Filters, FieldForceResponse, KpiCard, CalendarHeatmapPoint, FunnelStage,
} from "@/lib/types";
import { visitWhere, repWhere } from "./filters";

export async function getFieldForce(filters: Filters): Promise<FieldForceResponse> {
  // 1. KPIs
  const visitCount = await db.visit.count({ where: visitWhere(filters) });
  const totalSamples = await db.visit.aggregate({
    where: visitWhere(filters),
    _sum: { samplesDropped: true },
  });

  // Coverage % = distinct HCPs visited / total HCPs targeted (in zone filter)
  const visitedHcps = await db.visit.findMany({
    where: visitWhere(filters),
    distinct: ["hcpId"],
    select: { hcpId: true },
  });
  const hcpWhere: { zone?: { in: string[] } } = {};
  if (filters.zones.length) hcpWhere.zone = { in: filters.zones };
  const totalHcps = await db.hcp.count({ where: hcpWhere });
  const coveragePct = totalHcps > 0 ? (visitedHcps.length / totalHcps) * 100 : 0;

  // MCE Compliance = mandatory_calls_executed / mandatory_calls_planned
  // Mandatory = Tier-A HCPs, min 2 calls/month.
  // Planned = (Tier-A HCPs in zone) × (months in range) × 2
  const tierAHcps = await db.hcp.count({ where: { tier: "A", ...hcpWhere } });
  const startD = new Date(filters.start + "T00:00:00.000Z");
  const endD = new Date(filters.end + "T00:00:00.000Z");
  const monthsInRange = Math.max(
    1,
    (endD.getUTCFullYear() - startD.getUTCFullYear()) * 12 +
      (endD.getUTCMonth() - startD.getUTCMonth()) + 1,
  );
  const plannedMandatory = tierAHcps * monthsInRange * 2;
  // Executed: visits to Tier-A HCPs in window
  const tierAVisitHcps = await db.hcp.findMany({
    where: { tier: "A", ...hcpWhere },
    select: { hcpId: true },
  });
  const tierAHcpIds = tierAVisitHcps.map((h) => h.hcpId);
  const tierAVisits = await db.visit.count({
    where: {
      ...visitWhere(filters),
      hcpId: { in: tierAHcpIds },
    },
  });
  const mceCompliancePct = plannedMandatory > 0 ? (tierAVisits / plannedMandatory) * 100 : 0;

  const kpis: KpiCard[] = [
    {
      label: "Total Visits",
      value: visitCount.toLocaleString("en-IN"),
      delta: `${monthsInRange} mo`,
      hint: "All visits in selected range",
    },
    {
      label: "Coverage %",
      value: `${coveragePct.toFixed(1)}%`,
      delta: `${visitedHcps.length.toLocaleString("en-IN")} / ${totalHcps.toLocaleString("en-IN")} HCPs`,
      deltaPositive: coveragePct >= 50,
    },
    {
      label: "MCE Compliance",
      value: `${Math.min(mceCompliancePct, 100).toFixed(1)}%`,
      delta: `${tierAVisits.toLocaleString("en-IN")} of ${plannedMandatory.toLocaleString("en-IN")}`,
      deltaPositive: mceCompliancePct >= 80,
      hint: "Mandatory Calls Executed — Tier-A HCPs, min 2/month",
    },
    {
      label: "Samples Distributed",
      value: (totalSamples._sum.samplesDropped || 0).toLocaleString("en-IN"),
      delta: `avg ${(visitCount > 0 ? (totalSamples._sum.samplesDropped || 0) / visitCount : 0).toFixed(1)}/visit`,
    },
  ];

  // 2. Calendar heatmap (last 12 months)
  const heatEnd = new Date(filters.end + "T00:00:00.000Z");
  const heatStart = new Date(heatEnd);
  heatStart.setUTCFullYear(heatStart.getUTCFullYear() - 1);
  heatStart.setUTCDate(heatStart.getUTCDate() + 1);
  const heatVisits = await db.visit.findMany({
    where: {
      visitDate: { gte: heatStart, lte: heatEnd },
      ...(filters.zones.length || filters.roles.length
        ? {
            rep: {
              ...(filters.zones.length ? { zone: { in: filters.zones } } : {}),
              ...(filters.roles.length ? { role: { in: filters.roles } } : {}),
            },
          }
        : {}),
    },
    select: { visitDate: true },
  });
  const heatByDate: Record<string, number> = {};
  for (const v of heatVisits) {
    const k = v.visitDate.toISOString().slice(0, 10);
    heatByDate[k] = (heatByDate[k] || 0) + 1;
  }
  // Fill missing days
  const heatmap: CalendarHeatmapPoint[] = [];
  const cursor = new Date(heatStart);
  while (cursor <= heatEnd) {
    const k = cursor.toISOString().slice(0, 10);
    heatmap.push({ date: k, count: heatByDate[k] || 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // 3. Visit type mix
  const visitTypeAgg = await db.visit.groupBy({
    by: ["visitType"],
    where: visitWhere(filters),
    _count: true,
  });
  const visitTypeMix = visitTypeAgg.map((v) => ({ type: v.visitType, count: v._count }));

  // 4. Outcome distribution
  const outcomeAgg = await db.visit.groupBy({
    by: ["outcome"],
    where: visitWhere(filters),
    _count: true,
  });
  const outcomeDistribution = outcomeAgg.map((v) => ({ outcome: v.outcome, count: v._count }));

  // 5. Visits per rep (top/bottom 10)
  const visitsPerRepAgg = await db.visit.groupBy({
    by: ["repId"],
    where: visitWhere(filters),
    _count: true,
  });
  const repIds = visitsPerRepAgg.map((r) => r.repId);
  const reps = await db.rep.findMany({
    where: { repId: { in: repIds } },
    select: { repId: true, firstName: true, lastName: true, zone: true },
  });
  const repMap = new Map(reps.map((r) => [r.repId, r]));
  const allReps = visitsPerRepAgg
    .map((v) => {
      const r = repMap.get(v.repId);
      return {
        repId: v.repId,
        repName: r ? `${r.firstName} ${r.lastName}` : v.repId,
        visits: v._count,
        zone: r?.zone || "",
      };
    })
    .sort((a, b) => b.visits - a.visits);
  // Take top 10 + bottom 10 (so chart shows both extremes)
  const visitsPerRep = [...allReps.slice(0, 10), ...allReps.slice(-10).reverse()];

  // 6. Funnel: Targeted -> Visited -> Detailed -> Bought
  const totalTargeted = totalHcps;
  const visitedCount = visitedHcps.length;
  const detailedAgg = await db.visit.count({
    where: { ...visitWhere(filters), outcome: "Detailed" },
  });
  // Distinct HCPs with detailed outcome
  const detailedHcps = await db.visit.findMany({
    where: { ...visitWhere(filters), outcome: "Detailed" },
    distinct: ["hcpId"],
    select: { hcpId: true },
  });
  const boughtHcps = await db.sale.findMany({
    where: {
      invoiceDate: { gte: startD, lte: endD },
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
    distinct: ["hcpId"],
    select: { hcpId: true },
  });
  const funnel: FunnelStage[] = [
    { stage: "Targeted", value: totalTargeted },
    { stage: "Visited", value: visitedCount },
    { stage: "Detailed", value: detailedHcps.length },
    { stage: "Bought", value: boughtHcps.length },
  ];

  return {
    kpis,
    heatmap,
    visitTypeMix,
    outcomeDistribution,
    visitsPerRep,
    funnel,
  };
}
