/**
 * src/lib/types.ts — Shared types used across analytics modules and API routes.
 */

export type Filters = {
  start: string;       // ISO YYYY-MM-DD
  end: string;         // ISO YYYY-MM-DD
  zones: string[];     // North | South | East | West
  therapies: string[]; // Cardio | Diabetes | GI | Respiratory
  roles: string[];     // Field_Rep | Area_Manager | Regional_Manager | National_Head
};

export type KpiCard = {
  label: string;
  value: string;
  delta?: string;
  deltaPct?: string;
  deltaPositive?: boolean;
  sparkline?: number[];
  hint?: string;
};

export type SalesTrendPoint = {
  month: string;       // YYYY-MM
  actual: number | null;
  target: number | null;
  priorYear: number | null;
};

export type RepAttainment = {
  repId: string;
  repName: string;
  zone: string;
  attainmentPct: number;
  revenueInr: number;
};

export type GeoDataPoint = {
  state: string;
  value: number;
};

export type ScatterRoiPoint = {
  repName: string;
  expense: number;
  revenue: number;
  roi: number;
};

export type FunnelStage = {
  stage: string;
  value: number;
};

export type CalendarHeatmapPoint = {
  date: string;  // YYYY-MM-DD
  count: number;
};

export type TherapySplit = {
  therapyArea: string;
  value: number;
};

export type TreemapNode = {
  name: string;
  therapyArea?: string;
  size: number;
};

export type StateRevenueRow = {
  state: string;
  zone: string;
  revenueInr: number;
  attainmentPct: number | null;
  sharePct: number;
};

export type OverviewResponse = {
  kpis: KpiCard[];
  salesTrend: SalesTrendPoint[];
  geoData: GeoDataPoint[];
  leaderboard: RepAttainment[];
};

export type SalesResponse = {
  kpis: KpiCard[];
  salesTrend: SalesTrendPoint[];
  topReps: RepAttainment[];
  bottomReps: RepAttainment[];
  stateRevenue: StateRevenueRow[];
};

export type FieldForceResponse = {
  kpis: KpiCard[];
  heatmap: CalendarHeatmapPoint[];
  visitTypeMix: { type: string; count: number }[];
  outcomeDistribution: { outcome: string; count: number }[];
  visitsPerRep: { repId: string; repName: string; visits: number; zone: string }[];
  funnel: FunnelStage[];
};

export type HcpResponse = {
  kpis: KpiCard[];
  tierCoverage: { tier: string; total: number; visited: number; coveragePct: number }[];
  decileContribution: { decile: number; revenueInr: number; sharePct: number }[];
  untappedHcps: {
    hcpId: string;
    name: string;
    specialty: string;
    city: string;
    tier: string;
    lastVisitDate: string | null;
    lifetimeRevenueInr: number;
  }[];
  churnTable: {
    hcpId: string;
    name: string;
    tier: string;
    priorQuarterRevenueInr: number;
    currentQuarterRevenueInr: number;
    changePct: number;
  }[];
  scatterRoi: ScatterRoiPoint[];
};

export type ProductResponse = {
  kpis: KpiCard[];
  therapySplit: TherapySplit[];
  treemap: TreemapNode[];
  adoption: { productId: string; productName: string; monthly: { month: string; revenue: number }[] }[];
  topGrowing: { productId: string; productName: string; growthPct: number }[];
  topDeclining: { productId: string; productName: string; growthPct: number }[];
  cannibalization: {
    newProduct: string;
    existingProduct: string;
    preRevenueInr: number;
    postRevenueInr: number;
    dropPct: number;
  }[];
};

export type ForecastPoint = {
  month: string;
  actual: number | null;
  forecast: number | null;
  ci80Lower: number | null;
  ci80Upper: number | null;
  ci95Lower: number | null;
  ci95Upper: number | null;
};

export type ForecastResponse = {
  kpis: KpiCard[];
  perRegion: {
    region: string;
    mapePct: number;
    series: ForecastPoint[];
  }[];
  perProduct: {
    productId: string;
    productName: string;
    next3Months: {
      month: string;
      forecast: number;
      ci80Lower: number;
      ci80Upper: number;
      ci95Lower: number;
      ci95Upper: number;
    }[];
    mapePct: number;
  }[];
};
