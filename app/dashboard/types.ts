export type Row = Record<string, string | number>;

export type Metric =
  | "count"
  | "amount"
  | "average"
  | "unique_members"
  | "batch_count"
  | "sum_insured_enrollments"
  | "suitability_score";

export type ChartKind = "line" | "bar" | "pie" | "table";

export type Item = {
  label: string;
  series?: string;
  count?: number;
  amount?: number;
  premium?: number;
  average?: number;
  unique_members?: number;
  batch_count?: number;
  sum_insured_enrollments?: number;
  suitability_score?: number;
  [key: string]: string | number | undefined;
};

export type Analysis = Record<string, Item[]>;

export type Result = {
  meta: {
    export_columns: string[];
    policy_included: boolean;
    processed_at: string;
    files_processed?: number;
    college_name?: string;
    plans?: string[];
    current_year?: string;
    previous_year?: string;
    premium_definition?: string;
    sum_insured_definition?: string;
    forecast_method?: string;
    forecast_confidence?: string;
    analysis_mode?: "single" | "comparison";
  };
  kpis: Record<string, number | string>;
  kpis_by_plan?: Record<string, Record<string, number | string>>;
  cleaned_rows: Row[];
  analysis_rows: Row[];
  analysis: Analysis;
  analysis_by_plan?: Record<string, Analysis>;
  insights: string[];
  insights_by_plan?: Record<string, string[]>;
  data_quality: Record<string, any>;
};

export type UploadGroup = { name: string; year: string; files: File[] };

export const COLORS = [
  "#0a6a61",
  "#2576a8",
  "#e58b37",
  "#7e57c2",
  "#d25572",
  "#3f9c73",
  "#80684d",
];

export const metricLabel: Record<Metric, string> = {
  count: "Enrolments",
  amount: "Premium amount",
  average: "Average premium",
  unique_members: "Unique members",
  batch_count: "Batches reached",
  sum_insured_enrollments: "Sum-insured enrolments",
  suitability_score: "Suitability score",
};

export const money = (value: unknown) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

export const compact = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export function displayDate(value: unknown) {
  const raw = String(value || "");
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return `${String(date.getDate()).padStart(2, "0")}/${date.toLocaleString(
    "en-IN",
    { month: "long" },
  )}/${date.getFullYear()}`;
}

export function excelDate(value: unknown) {
  const raw = String(value || "");
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : value;
}

export function formatMetric(value: unknown, metric: Metric) {
  if (metric === "amount" || metric === "average") return money(value);
  if (metric === "suitability_score")
    return `${Number(value || 0).toFixed(1)}/100`;
  return Number(value || 0).toLocaleString("en-IN");
}
