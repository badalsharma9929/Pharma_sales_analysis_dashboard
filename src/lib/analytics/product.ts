/**
 * src/lib/analytics/product.ts — Product & Portfolio Mix analytics.
 */
import { db } from "@/lib/db";
import type {
  Filters, ProductResponse, KpiCard, TherapySplit, TreemapNode,
} from "@/lib/types";
import { saleWhere } from "./filters";
import { monthKey } from "./filters";

export async function getProduct(filters: Filters): Promise<ProductResponse> {
  const startD = new Date(filters.start + "T00:00:00.000Z");
  const endD = new Date(filters.end + "T23:59:59.999Z");

  // All products
  const products = await db.product.findMany();
  const prodById = new Map(products.map((p) => [p.productId, p]));
  const newLaunches = products.filter((p) => p.isNewLaunch);

  // Sales by product
  const salesByProd = await db.sale.groupBy({
    by: ["productId"],
    where: saleWhere(filters),
    _sum: { netValueInr: true },
  });
  const salesByProdMap = new Map(salesByProd.map((s) => [s.productId, s._sum.netValueInr || 0]));
  const totalRevenue = salesByProd.reduce((a, s) => a + (s._sum.netValueInr || 0), 0) || 1;

  // MoM growth per product (last month vs prior month within range)
  const lastMonthEnd = new Date(endD);
  const lastMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1));
  const prevMonthEnd = new Date(lastMonthStart.getTime() - 1);
  const prevMonthStart = new Date(Date.UTC(prevMonthEnd.getUTCFullYear(), prevMonthEnd.getUTCMonth(), 1));

  const lastMonthAgg = await db.sale.groupBy({
    by: ["productId"],
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
  const prevMonthAgg = await db.sale.groupBy({
    by: ["productId"],
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
  const lastMonthMap = new Map(lastMonthAgg.map((s) => [s.productId, s._sum.netValueInr || 0]));
  const prevMonthMap = new Map(prevMonthAgg.map((s) => [s.productId, s._sum.netValueInr || 0]));

  const growthByProduct = products.map((p) => {
    const last = lastMonthMap.get(p.productId) || 0;
    const prev = prevMonthMap.get(p.productId) || 0;
    const growthPct = prev > 0 ? ((last - prev) / prev) * 100 : 0;
    return { productId: p.productId, productName: p.productName, growthPct, last, prev };
  });

  const topGrowing = [...growthByProduct]
    .filter((g) => g.prev > 0)
    .sort((a, b) => b.growthPct - a.growthPct)
    .slice(0, 3)
    .map((g) => ({ productId: g.productId, productName: g.productName, growthPct: g.growthPct }));
  const topDeclining = [...growthByProduct]
    .filter((g) => g.prev > 0)
    .sort((a, b) => a.growthPct - b.growthPct)
    .slice(0, 3)
    .map((g) => ({ productId: g.productId, productName: g.productName, growthPct: g.growthPct }));

  const kpis: KpiCard[] = [
    {
      label: "Total Products",
      value: String(products.length),
      delta: `${newLaunches.length} new launches`,
    },
    {
      label: "New Launches",
      value: String(newLaunches.length),
      delta: newLaunches.map((p) => p.productName).slice(0, 2).join(", "),
    },
    {
      label: "Top Growing",
      value: topGrowing[0]?.productName || "-",
      delta: topGrowing[0] ? `${topGrowing[0].growthPct.toFixed(1)}% MoM` : "",
      deltaPositive: true,
    },
    {
      label: "Top Declining",
      value: topDeclining[0]?.productName || "-",
      delta: topDeclining[0] ? `${topDeclining[0].growthPct.toFixed(1)}% MoM` : "",
      deltaPositive: false,
    },
  ];

  // Therapy split
  const therapyRevenue: Record<string, number> = {};
  for (const s of salesByProd) {
    const p = prodById.get(s.productId);
    if (!p) continue;
    therapyRevenue[p.therapyArea] = (therapyRevenue[p.therapyArea] || 0) + (s._sum.netValueInr || 0);
  }
  const therapySplit: TherapySplit[] = Object.entries(therapyRevenue)
    .map(([therapyArea, value]) => ({ therapyArea, value }))
    .sort((a, b) => b.value - a.value);

  // Treemap: therapy area -> products nested
  const treemap: TreemapNode[] = products
    .map((p) => ({
      name: p.productName,
      therapyArea: p.therapyArea,
      size: salesByProdMap.get(p.productId) || 0,
    }))
    .filter((n) => n.size > 0)
    .sort((a, b) => b.size - a.size);

  // Adoption curves for new products (monthly revenue since launch)
  const adoption = [];
  for (const p of newLaunches) {
    const sales = await db.sale.findMany({
      where: {
        productId: p.productId,
        invoiceDate: { gte: p.launchDate, lte: endD },
        ...(filters.zones.length || filters.roles.length
          ? {
              rep: {
                ...(filters.zones.length ? { zone: { in: filters.zones } } : {}),
                ...(filters.roles.length ? { role: { in: filters.roles } } : {}),
              },
            }
          : {}),
      },
      select: { invoiceDate: true, netValueInr: true },
    });
    const byMonth: Record<string, number> = {};
    for (const s of sales) {
      const k = monthKey(s.invoiceDate);
      byMonth[k] = (byMonth[k] || 0) + s.netValueInr;
    }
    const months: { month: string; revenue: number }[] = [];
    const cur = new Date(Math.max(p.launchDate.getTime(), startD.getTime()));
    while (cur <= endD) {
      const k = monthKey(cur);
      months.push({ month: k, revenue: byMonth[k] || 0 });
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    adoption.push({ productId: p.productId, productName: p.productName, monthly: months });
  }

  // Cannibalization: for each new product, check if same-therapy existing product
  // revenue dropped >15% in 60 days post-launch
  const cannibalization = [];
  for (const np of newLaunches) {
    const launch = np.launchDate;
    const post60 = new Date(launch);
    post60.setUTCDate(post60.getUTCDate() + 60);
    const pre60 = new Date(launch);
    pre60.setUTCDate(pre60.getUTCDate() - 60);
    // Same-therapy existing products
    const existing = products.filter(
      (p) => p.therapyArea === np.therapyArea && p.productId !== np.productId && !p.isNewLaunch,
    );
    for (const ep of existing) {
      const preRev = (await db.sale.aggregate({
        where: { productId: ep.productId, invoiceDate: { gte: pre60, lt: launch } },
        _sum: { netValueInr: true },
      }))._sum.netValueInr || 0;
      const postRev = (await db.sale.aggregate({
        where: { productId: ep.productId, invoiceDate: { gte: launch, lte: post60 } },
        _sum: { netValueInr: true },
      }))._sum.netValueInr || 0;
      const dropPct = preRev > 0 ? ((preRev - postRev) / preRev) * 100 : 0;
      if (dropPct > 15) {
        cannibalization.push({
          newProduct: np.productName,
          existingProduct: ep.productName,
          preRevenueInr: preRev,
          postRevenueInr: postRev,
          dropPct,
        });
      }
    }
  }

  return {
    kpis,
    therapySplit,
    treemap,
    adoption,
    topGrowing,
    topDeclining,
    cannibalization,
  };
}
