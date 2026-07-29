"use client";

import React, { useMemo, useState } from "react";

type Row = Record<string, string | number>;
type Item = {
  label: string;
  count: number;
  amount?: number;
  premium?: number;
  average?: number;
  period?: string;
};
type Result = {
  meta: {
    export_columns: string[];
    policy_included: boolean;
    processed_at: string;
    files_processed?: number;
    row_order?: string;
  };
  kpis: Record<string, number | string>;
  cleaned_rows: Row[];
  analysis: Record<string, Item[]>;
  insights: string[];
  data_quality: Record<string, any>;
};

type Metric = "count" | "amount" | "premium";
type ChartKind = "line" | "bar" | "pie" | "table";
type ChartSetting = { type: ChartKind; metric: Metric; limit: number | "all" };
type ChartSettings = Record<string, ChartSetting>;

const money = (value: unknown) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const compact = (value: number) =>
  new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const PALETTE = ["#0a6a61", "#2576a8", "#e58b37", "#7e57c2", "#d25572", "#3f9c73", "#80684d", "#2e8b9e"];

const INITIAL_SETTINGS: ChartSettings = {
  monthly: { type: "line", metric: "amount", limit: "all" },
  daily: { type: "line", metric: "amount", limit: 30 },
  passing_year: { type: "line", metric: "amount", limit: "all" },
  state: { type: "bar", metric: "amount", limit: 15 },
  city: { type: "bar", metric: "amount", limit: 15 },
  pincode: { type: "bar", metric: "count", limit: 15 },
  nominee: { type: "pie", metric: "count", limit: "all" },
  sum_insured: { type: "bar", metric: "count", limit: "all" },
  premium: { type: "bar", metric: "premium", limit: "all" },
  course: { type: "bar", metric: "amount", limit: 15 },
  products: { type: "bar", metric: "count", limit: 15 },
  insurers: { type: "pie", metric: "count", limit: "all" },
  age: { type: "bar", metric: "count", limit: "all" },
  policy: { type: "pie", metric: "count", limit: "all" },
};

function metricValue(item: Item, metric: Metric) {
  return Number(item[metric] || 0);
}

function metricLabel(metric: Metric) {
  if (metric === "count") return "Records";
  if (metric === "premium") return "Premium";
  return "Transaction amount";
}

function formatMetric(metric: Metric, value: number) {
  return metric === "count" ? value.toLocaleString("en-IN") : money(value);
}

function selectRows(data: Item[], setting: ChartSetting, ordered = false) {
  if (setting.limit === "all") return data;
  if (ordered) return data.slice(-setting.limit);
  return data.slice(0, setting.limit);
}

function EmptyChart({ title }: { title: string }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      <p className="empty">This field was not available in the uploaded data.</p>
    </section>
  );
}

function InteractiveChart({
  id,
  title,
  subtitle,
  data,
  settings,
  setSettings,
  ordered = false,
  categoryName = "Category",
  allowedMetrics = ["count", "amount", "premium"],
}: {
  id: string;
  title: string;
  subtitle: string;
  data: Item[];
  settings: ChartSettings;
  setSettings: React.Dispatch<React.SetStateAction<ChartSettings>>;
  ordered?: boolean;
  categoryName?: string;
  allowedMetrics?: Metric[];
}) {
  const setting = settings[id] || { type: "bar", metric: "count", limit: 15 };
  const rows = selectRows(data, setting, ordered);
  const [hovered, setHovered] = useState<Item | null>(null);

  if (!data.length) return <EmptyChart title={title} />;

  const update = (patch: Partial<ChartSetting>) =>
    setSettings((current) => ({ ...current, [id]: { ...setting, ...patch } }));

  const tooltip = hovered ? (
    <div className="hoverCard">
      <b>{categoryName}: {hovered.label}</b>
      <span>Records: {hovered.count.toLocaleString("en-IN")}</span>
      {hovered.amount !== undefined && <span>Transaction amount: {money(hovered.amount)}</span>}
      {hovered.premium !== undefined && <span>Premium: {money(hovered.premium)}</span>}
    </div>
  ) : null;

  const header = (
    <div className="panelHead">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className="chartControls">
        <label>
          Chart
          <select value={setting.type} onChange={(event) => update({ type: event.target.value as ChartKind })}>
            <option value="line">Line</option>
            <option value="bar">Bar</option>
            <option value="pie">Pie</option>
            <option value="table">Table</option>
          </select>
        </label>
        <label>
          Measure
          <select value={setting.metric} onChange={(event) => update({ metric: event.target.value as Metric })}>
            {allowedMetrics.map((metric) => <option key={metric} value={metric}>{metricLabel(metric)}</option>)}
          </select>
        </label>
        <label>
          Show
          <select value={String(setting.limit)} onChange={(event) => update({ limit: event.target.value === "all" ? "all" : Number(event.target.value) })}>
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="25">25</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>
    </div>
  );

  if (setting.type === "table") {
    return (
      <section className="panel chartPanel">
        {header}{tooltip}
        <div className="miniTableWrap">
          <table className="miniTable">
            <thead><tr><th>{categoryName}</th><th>Records</th><th>Transaction amount</th><th>Premium</th></tr></thead>
            <tbody>{rows.map((item, index) => <tr key={`${item.label}-${index}`} onMouseEnter={() => setHovered(item)} onMouseLeave={() => setHovered(null)}><td>{item.label}</td><td>{item.count}</td><td>{item.amount === undefined ? "—" : money(item.amount)}</td><td>{item.premium === undefined ? "—" : money(item.premium)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    );
  }

  if (setting.type === "bar") {
    const max = Math.max(1, ...rows.map((item) => metricValue(item, setting.metric)));
    const minWidth = Math.max(680, rows.length * 64);
    return (
      <section className="panel chartPanel">
        {header}{tooltip}
        <div className="horizontalScroll">
          <div className="verticalBars" style={{ minWidth }}>
            {rows.map((item, index) => {
              const value = metricValue(item, setting.metric);
              return <div className="verticalBarItem" key={`${item.label}-${index}`} onMouseEnter={() => setHovered(item)} onMouseLeave={() => setHovered(null)}>
                <div className="barValue">{formatMetric(setting.metric, value)}</div>
                <div className="verticalTrack"><span style={{ height: `${Math.max(2, value / max * 100)}%`, background: PALETTE[index % PALETTE.length] }} /></div>
                <div className="verticalLabel" title={item.label}>{item.label}</div>
              </div>;
            })}
          </div>
        </div>
      </section>
    );
  }

  if (setting.type === "pie") {
    const positive = rows.filter((item) => metricValue(item, setting.metric) > 0);
    if (!positive.length) return <EmptyChart title={title} />;
    const pieRows = positive.length > 8
      ? [...positive.slice(0, 7), positive.slice(7).reduce((result, item) => ({ label: "Other", count: result.count + item.count, amount: Number(result.amount || 0) + Number(item.amount || 0), premium: Number(result.premium || 0) + Number(item.premium || 0) }), { label: "Other", count: 0, amount: 0, premium: 0 })]
      : positive;
    const total = pieRows.reduce((sum, item) => sum + metricValue(item, setting.metric), 0);
    let offset = 0;
    return (
      <section className="panel chartPanel">
        {header}{tooltip}
        <div className="pieLayout">
          <svg viewBox="0 0 220 220" className="donut">
            <circle cx="110" cy="110" r="72" fill="none" stroke="#edf2f5" strokeWidth="42" />
            {pieRows.map((item, index) => {
              const percent = metricValue(item, setting.metric) / total * 100;
              const dashOffset = -offset;
              offset += percent;
              return <circle key={`${item.label}-${index}`} cx="110" cy="110" r="72" fill="none" stroke={PALETTE[index % PALETTE.length]} strokeWidth="42" pathLength="100" strokeDasharray={`${percent} ${100 - percent}`} strokeDashoffset={dashOffset} transform="rotate(-90 110 110)" onMouseEnter={() => setHovered(item)} onMouseLeave={() => setHovered(null)} />;
            })}
            <text x="110" y="104" textAnchor="middle" className="donutTotal">{setting.metric === "count" ? Math.round(total).toLocaleString("en-IN") : compact(total)}</text>
            <text x="110" y="126" textAnchor="middle" className="donutLabel">{metricLabel(setting.metric)}</text>
          </svg>
          <div className="legend">
            {pieRows.map((item, index) => <div key={`${item.label}-${index}`} onMouseEnter={() => setHovered(item)} onMouseLeave={() => setHovered(null)}><i style={{ background: PALETTE[index % PALETTE.length] }} /><span title={item.label}>{item.label}</span><b>{(metricValue(item, setting.metric) / total * 100).toFixed(1)}%</b></div>)}
          </div>
        </div>
      </section>
    );
  }

  const width = Math.max(760, rows.length * 58);
  const height = 270;
  const left = 58, right = 24, top = 28, bottom = 58;
  const values = rows.map((item) => metricValue(item, setting.metric));
  const max = Math.max(1, ...values);
  const step = (width - left - right) / Math.max(1, rows.length - 1);
  const points = values.map((value, index) => `${left + index * step},${height - bottom - value / max * (height - top - bottom)}`).join(" ");
  const labelEvery = Math.max(1, Math.ceil(rows.length / 12));

  return (
    <section className="panel chartPanel">
      {header}{tooltip}
      <div className="horizontalScroll">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth: width }} className="lineChart">
          {[0, .25, .5, .75, 1].map((ratio) => {
            const y = height - bottom - ratio * (height - top - bottom);
            return <g key={ratio}><line className="gridLine" x1={left} y1={y} x2={width - right} y2={y} /><text className="axisValue" x={left - 8} y={y + 4} textAnchor="end">{setting.metric === "count" ? Math.round(max * ratio) : compact(max * ratio)}</text></g>;
          })}
          <polyline points={points} />
          {rows.map((item, index) => {
            const x = left + index * step;
            const y = height - bottom - metricValue(item, setting.metric) / max * (height - top - bottom);
            return <g key={`${item.label}-${index}`} onMouseEnter={() => setHovered(item)} onMouseLeave={() => setHovered(null)}><circle cx={x} cy={y} r="5" /><title>{`${categoryName}: ${item.label}; Records: ${item.count}; Transaction amount: ${money(item.amount || 0)}; Premium: ${money(item.premium || 0)}`}</title>{(index % labelEvery === 0 || index === rows.length - 1) && <text className="axisLabel" x={x} y={height - 18} textAnchor="middle">{item.label}</text>}</g>;
          })}
        </svg>
      </div>
    </section>
  );
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [pptLoading, setPptLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [policyFilter, setPolicyFilter] = useState("");
  const [chartSettings, setChartSettings] = useState<ChartSettings>(INITIAL_SETTINGS);

  const filtered = useMemo(() => {
    if (!result) return [];
    const query = search.trim().toLowerCase();
    return result.cleaned_rows.filter((row) => {
      const policyOk = !policyFilter || row["Policy (New/Renewal)"] === policyFilter;
      const searchOk = !query || Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(query));
      return policyOk && searchOk;
    });
  }, [result, search, policyFilter]);

  async function analyze() {
    if (!files.length) { setError("Select at least one Excel file."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      form.append("password", password);
      const response = await fetch("/api/process", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to process workbook.");
      setResult(data);
    } catch (exception: any) {
      setError(exception.message || "Processing failed.");
    } finally { setLoading(false); }
  }

  async function exportExcel() {
    if (!result) return;
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();

    const add = (name: string, rows: any[], dateColumns: string[] = []) => {
      const values = rows.length ? rows.map((source) => {
        const row = { ...source };
        dateColumns.forEach((column) => {
          if (row[column]) {
            const [year, month, day] = String(row[column]).split("-").map(Number);
            row[column] = new Date(year, month - 1, day, 12, 0, 0);
          }
        });
        return row;
      }) : [{ Status: "No data available" }];
      const worksheet = XLSX.utils.json_to_sheet(values, { cellDates: true });
      worksheet["!cols"] = Object.keys(values[0]).map((key) => ({ wch: Math.min(42, Math.max(13, key.length + 3)) }));
      const headers = Object.keys(values[0]);
      dateColumns.forEach((column) => {
        const colIndex = headers.indexOf(column);
        if (colIndex < 0) return;
        for (let rowIndex = 1; rowIndex <= values.length; rowIndex++) {
          const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
          if (worksheet[address]) worksheet[address].z = "dd-mm-yyyy";
        }
      });
      XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
    };

    add("Dashboard_Summary", Object.entries(result.kpis).map(([Metric, Value]) => ({ Metric, Value })));
    add("Export_Data", result.cleaned_rows, ["Transaction_Date"]);
    add("Monthly_Amount_Trend", result.analysis.monthly_trend || []);
    add("Daily_Amount_Trend", result.analysis.daily_trend || [], ["label", "period"]);
    if (result.meta.policy_included) add("New_Renewal", result.analysis.policy || []);
    add("Nominee_Relationship", result.analysis.nominee_relationship || []);
    add("Sum_Insured", result.analysis.sum_insured || []);
    add("Premium_Bands", result.analysis.premium_bands || []);
    add("Age_Analysis", result.analysis.age || []);
    add("State_Analysis", result.analysis.state || []);
    add("City_Analysis", result.analysis.city || []);
    add("Pincode_Analysis", result.analysis.pincode || []);
    add("All_Batches_Passing_Year", result.analysis.passing_year || []);
    add("Course_Analysis", result.analysis.course || []);
    add("Insurance_Products", result.analysis.insurance_products || []);
    add("Insurers", result.analysis.insurers || []);
    add("Business_Insights", result.insights.map((Insight, index) => ({ No: index + 1, Insight })));
    add("Data_Quality", Object.entries(result.data_quality).filter(([key]) => key !== "processing_log").map(([Metric, Value]) => ({ Metric, Value })));

    XLSX.writeFile(workbook, `Insurance_Business_Insights_${new Date().toISOString().slice(0, 10)}.xlsx`, { cellDates: true });
  }

  function exportCsv() {
    if (!result || !result.cleaned_rows.length) return;
    const columns = result.meta.export_columns;
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [columns.map(escape).join(","), ...result.cleaned_rows.map((row) => columns.map((column) => escape(row[column])).join(","))].join("\n");
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    anchor.download = "Cleaned_Insurance_Data_Original_Order.csv";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  async function exportPowerPoint() {
    if (!result) return;
    setPptLoading(true); setError("");
    try {
      const module: any = await import("pptxgenjs");
      const PptxGenJS = module.default || module;
      const pptx: any = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.author = "Insurance Business Insights Dashboard";
      pptx.title = "Insurance Business Insights";
      pptx.subject = "Insurance trend analysis with user-selected chart formats";
      pptx.company = "Business Analytics";
      pptx.lang = "en-IN";
      pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "en-US" };

      const C = { navy: "102033", teal: "0A6A61", blue: "2576A8", orange: "E58B37", purple: "7E57C2", rose: "D25572", green: "3F9C73", pale: "EFF7F6", paleBlue: "F2F6FA", line: "D7E1E8", gray: "667B8E", white: "FFFFFF" };
      const chartColors = [C.teal, C.blue, C.orange, C.purple, C.rose, C.green];

      const addFooter = (slide: any, number: number) => {
        slide.addText("Insurance Business Insights", { x: .45, y: 7.12, w: 4, h: .18, fontSize: 8, color: C.gray, margin: 0 });
        slide.addText(String(number), { x: 12.35, y: 7.1, w: .4, h: .2, fontSize: 8, color: C.gray, align: "right", margin: 0 });
      };
      const addHeader = (slide: any, title: string, subtitle: string, number: number) => {
        slide.background = { color: C.white };
        slide.addText(title, { x: .55, y: .34, w: 9.8, h: .42, fontSize: 24, bold: true, color: C.navy, margin: 0 });
        slide.addText(subtitle, { x: .55, y: .82, w: 11.8, h: .28, fontSize: 10, color: C.gray, margin: 0 });
        slide.addShape(pptx.ShapeType.line, { x: .55, y: 1.17, w: 12.2, h: 0, line: { color: C.line, width: 1 } });
        addFooter(slide, number);
      };
      const chartRows = (id: string, data: Item[], ordered = false) => selectRows(data, chartSettings[id] || INITIAL_SETTINGS[id], ordered);
      const addSelectedChart = (slide: any, id: string, title: string, data: Item[], x: number, y: number, w: number, h: number, ordered = false) => {
        const setting = chartSettings[id] || INITIAL_SETTINGS[id];
        const rows = chartRows(id, data, ordered).filter((item) => item.label && metricValue(item, setting.metric) > 0);
        slide.addText(title, { x, y: y - .3, w, h: .24, fontSize: 12, bold: true, color: C.navy, margin: 0 });
        if (!rows.length) {
          slide.addText("Data was not available in the uploaded file.", { x, y, w, h, fontSize: 13, color: C.gray, align: "center", valign: "mid", fill: { color: C.paleBlue }, line: { color: C.line }, margin: .15 });
          return;
        }
        if (setting.type === "table") {
          const tableRows = [["Category", "Records", "Amount", "Premium"], ...rows.slice(0, 18).map((item) => [item.label, String(item.count), money(item.amount || 0), money(item.premium || 0)])];
          slide.addTable(tableRows, { x, y, w, h, border: { color: C.line, pt: 1 }, fill: C.white, color: C.navy, fontSize: 9, margin: .05, rowH: .26, bold: false, autoFit: false });
          return;
        }
        const labels = rows.map((item) => item.label);
        const values = rows.map((item) => metricValue(item, setting.metric));
        const series = [{ name: metricLabel(setting.metric), labels, values }];
        const chartType = setting.type === "line" ? pptx.ChartType.line : setting.type === "pie" ? pptx.ChartType.doughnut : pptx.ChartType.bar;
        slide.addChart(chartType, series, { x, y, w, h, showTitle: false, showLegend: setting.type === "pie", legendPos: "b", showValue: setting.type !== "line", showCatName: setting.type === "pie", chartColors, showPercent: setting.type === "pie", catAxisLabelRotate: labels.length > 8 ? 45 : 0, valAxisMinVal: 0, valGridLine: { color: C.line, width: 1 }, showBorder: false, showMarker: setting.type === "line", lineSize: 2.5, markerSize: 5 });
      };

      let slideNumber = 1;
      let slide = pptx.addSlide();
      slide.background = { color: C.teal };
      slide.addText("INSURANCE BUSINESS INSIGHTS", { x: .72, y: .75, w: 7.5, h: .28, fontSize: 11, bold: true, color: "8FE0D8", charSpacing: 1.5, margin: 0 });
      slide.addText("Management Dashboard Report", { x: .72, y: 1.25, w: 8.7, h: .78, fontSize: 34, bold: true, color: C.white, margin: 0 });
      slide.addText("Portfolio trends, geography, batches, nominee relationships, premium effectiveness and data-quality findings", { x: .72, y: 2.18, w: 8.6, h: .72, fontSize: 17, color: "D8F1EE", margin: 0, breakLine: false });
      slide.addText(`${result.kpis.total_records} clean records\n${result.meta.files_processed || 1} workbook(s) processed\nGenerated ${new Date(result.meta.processed_at).toLocaleString()}`, { x: 9.35, y: 1.2, w: 3.1, h: 1.7, fontSize: 16, bold: true, color: C.navy, fill: { color: C.white, transparency: 4 }, margin: .25, valign: "mid" });
      slide.addText("Charts in this presentation follow the chart type, measure and item-count selections currently set in the dashboard.", { x: .72, y: 6.55, w: 9.4, h: .35, fontSize: 10, color: "D8F1EE", italic: true, margin: 0 });

      slide = pptx.addSlide(); slideNumber++;
      addHeader(slide, "Executive summary", "Key measures and automatically generated management findings", slideNumber);
      const kpis = [
        ["Clean records", String(result.kpis.total_records)], ["Transaction value", money(result.kpis.total_transaction_amount)], ["Average transaction", money(result.kpis.average_transaction_amount)],
        ["Total premium", money(result.kpis.total_premium)], ["Most selected sum insured", String(result.kpis.most_selected_sum_insured)], ["Top course", String(result.kpis.top_course)],
      ];
      kpis.forEach(([label, value], index) => {
        const col = index % 3, row = Math.floor(index / 3);
        slide.addText(label.toUpperCase(), { x: .6 + col * 4.15, y: 1.42 + row * 1.25, w: 3.8, h: .22, fontSize: 8, bold: true, color: C.gray, margin: 0 });
        slide.addText(value, { x: .6 + col * 4.15, y: 1.67 + row * 1.25, w: 3.8, h: .72, fontSize: 18, bold: true, color: C.navy, fill: { color: C.paleBlue }, line: { color: C.line }, margin: .12, valign: "mid" });
      });
      slide.addText("Business findings", { x: .6, y: 4.15, w: 3, h: .3, fontSize: 16, bold: true, color: C.navy, margin: 0 });
      slide.addText(result.insights.slice(0, 8).map((text) => ({ text, options: { bullet: { indent: 14 }, breakLine: true } })), { x: .7, y: 4.55, w: 11.7, h: 2.15, fontSize: 12, color: C.navy, breakLine: true, paraSpaceAfterPt: 7, margin: .05, valign: "top" });

      const chartSlides = [
        ["Transaction trends", "Monthly and daily transaction amount analysis", ["monthly", "Monthly transaction analysis", result.analysis.monthly_trend || [], true], ["daily", "Transaction date analysis", result.analysis.daily_trend || [], true]],
        ["Geographical performance", "State and city contribution", ["state", "State analysis", result.analysis.state || [], false], ["city", "City analysis", result.analysis.city || [], false]],
        ["Pincode and batch performance", "All batches are included when the dashboard setting is Show: All", ["pincode", "Pincode analysis", result.analysis.pincode || [], false], ["passing_year", "Batch / passing year analysis", result.analysis.passing_year || [], true]],
        ["Portfolio composition", "Nominee relationships and policy status", ["nominee", "Nominee relationship analysis", result.analysis.nominee_relationship || [], false], ["policy", "New versus Renewal", result.analysis.policy || [], false]],
        ["Insurance and premium effectiveness", "Cover preference and premium bands", ["sum_insured", "Sum insured selection", result.analysis.sum_insured || [], false], ["premium", "Premium band effectiveness", result.analysis.premium_bands || [], false]],
        ["Customer and product segments", "Course and insurance product analysis", ["course", "Course analysis", result.analysis.course || [], false], ["products", "Insurance products", result.analysis.insurance_products || [], false]],
      ] as any[];
      for (const [title, subtitle, leftChart, rightChart] of chartSlides) {
        slide = pptx.addSlide(); slideNumber++;
        addHeader(slide, title, subtitle, slideNumber);
        addSelectedChart(slide, leftChart[0], leftChart[1], leftChart[2], .6, 1.65, 5.95, 4.9, leftChart[3]);
        addSelectedChart(slide, rightChart[0], rightChart[1], rightChart[2], 6.8, 1.65, 5.95, 4.9, rightChart[3]);
      }

      slide = pptx.addSlide(); slideNumber++;
      addHeader(slide, "Data quality and export controls", "Cleaning outcomes and reporting assumptions", slideNumber);
      const quality = [
        ["Rows received", result.data_quality.rows_before_cleaning], ["Invalid dates removed", result.data_quality.invalid_dates_removed], ["Exact duplicates removed", result.data_quality.exact_duplicates_removed],
        ["Duplicate transaction IDs removed", result.data_quality.duplicate_transaction_ids_removed], ["Final clean rows", result.data_quality.final_rows], ["Export order", "Original source order"],
      ];
      slide.addTable([["Metric", "Value"], ...quality.map(([a, b]) => [String(a), String(b)])], { x: .7, y: 1.55, w: 5.6, h: 3.9, border: { color: C.line, pt: 1 }, fontSize: 12, color: C.navy, fill: C.white, margin: .1, rowH: .5 });
      slide.addText("Export rules", { x: 6.7, y: 1.55, w: 3.2, h: .35, fontSize: 18, bold: true, color: C.navy, margin: 0 });
      slide.addText([
        { text: "• Export_Data retains original source row order; no date-wise, amount-wise or alphabetical sorting is applied.\n", options: { breakLine: true } },
        { text: "• Transaction_Date is exported as an Excel date with short-date formatting (dd-mm-yyyy).\n", options: { breakLine: true } },
        { text: "• Every nonblank batch/passing-year value is included in batch analysis.\n", options: { breakLine: true } },
        { text: "• New/Existing Member analysis is excluded.\n", options: { breakLine: true } },
        { text: "• Hover details are available in the live dashboard for each chart point, bar and pie segment.", options: { breakLine: true } },
      ], { x: 6.7, y: 2.05, w: 5.5, h: 3.1, fontSize: 14, color: C.navy, margin: .08, breakLine: true, paraSpaceAfterPt: 10 });

      await pptx.writeFile({ fileName: `Insurance_Business_Insights_${new Date().toISOString().slice(0, 10)}.pptx` });
    } catch (exception: any) {
      setError(exception.message || "PowerPoint export failed.");
    } finally { setPptLoading(false); }
  }

  return <main>
    <header className="hero"><div><span className="eyebrow">NO-CODE EXCEL ANALYTICS</span><h1>Insurance Business Insights Dashboard</h1><p>Import password-protected Excel files, analyse every available batch and business segment, choose how each chart is displayed, and export management-ready Excel and PowerPoint reports.</p></div><div className="privacy">🔒 Files are processed only for this request</div></header>

    <section className="uploadCard">
      <div className="drop"><input id="files" type="file" multiple accept=".xlsx,.xlsm,.xls" onChange={(event) => setFiles(Array.from(event.target.files || []))} /><label htmlFor="files"><b>Choose Excel files</b><span>{files.length ? files.map((file) => file.name).join(", ") : "Upload one or multiple workbooks"}</span></label></div>
      <div className="password"><label>Common Excel password</label><input type="password" value={password} placeholder="Enter the common password" onChange={(event) => setPassword(event.target.value)} /></div>
      <button className="primary" onClick={analyze} disabled={loading}>{loading ? "Analysing…" : "Generate Dashboard"}</button>
      {error && <div className="error">{error}</div>}
    </section>

    {result && <>
      <div className="toolbar"><div><b>{result.kpis.total_records} clean records</b><span>Original source row order retained · Processed {new Date(result.meta.processed_at).toLocaleString()}</span></div><div className="toolbarActions"><button onClick={exportCsv}>Export CSV</button><button onClick={exportPowerPoint} disabled={pptLoading}>{pptLoading ? "Preparing PPT…" : "Export Presentable PPT"}</button><button className="primary small" onClick={exportExcel}>Export Complete Excel</button></div></div>

      <section className="kpis">
        {[["Clean records", result.kpis.total_records], ["Transaction value", money(result.kpis.total_transaction_amount)], ["Average transaction", money(result.kpis.average_transaction_amount)], ["Total premium", money(result.kpis.total_premium)], ["Most selected sum insured", result.kpis.most_selected_sum_insured], ["Top course", result.kpis.top_course]].map(([label, value]) => <article key={String(label)}><span>{label}</span><strong>{String(value)}</strong></article>)}
      </section>

      <section className="insights"><div><span className="eyebrow">AUTOMATIC BUSINESS FINDINGS</span><h2>What the data is saying</h2></div><ol>{result.insights.map((insight, index) => <li key={index}>{insight}</li>)}</ol></section>

      <section className="chartNote"><b>Interactive chart controls:</b> use Chart, Measure and Show in each panel. Move the cursor over any point, bar, pie segment or row to see the category, record count, transaction amount and premium.</section>

      <section className="gridCharts">
        <InteractiveChart id="monthly" title="Transaction month vs transaction amount" subtitle="Monthly transaction movement" data={result.analysis.monthly_trend || []} settings={chartSettings} setSettings={setChartSettings} ordered categoryName="Month" />
        <InteractiveChart id="daily" title="Transaction date vs transaction amount" subtitle="Date-level transaction movement" data={result.analysis.daily_trend || []} settings={chartSettings} setSettings={setChartSettings} ordered categoryName="Date" />
        <InteractiveChart id="passing_year" title="All batch / passing year analysis" subtitle="Every nonblank batch in the uploaded data is included" data={result.analysis.passing_year || []} settings={chartSettings} setSettings={setChartSettings} ordered categoryName="Batch" />
        <InteractiveChart id="state" title="State analysis" subtitle="State-wise count, amount or premium" data={result.analysis.state || []} settings={chartSettings} setSettings={setChartSettings} categoryName="State" />
        <InteractiveChart id="city" title="City analysis" subtitle="City-wise count, amount or premium" data={result.analysis.city || []} settings={chartSettings} setSettings={setChartSettings} categoryName="City" />
        <InteractiveChart id="pincode" title="Pincode analysis" subtitle="Pincode-wise business contribution" data={result.analysis.pincode || []} settings={chartSettings} setSettings={setChartSettings} categoryName="Pincode" />
        <InteractiveChart id="nominee" title="Nominee relationship analysis" subtitle="Nominee relationship composition" data={result.analysis.nominee_relationship || []} settings={chartSettings} setSettings={setChartSettings} categoryName="Nominee relationship" />
        <InteractiveChart id="sum_insured" title="Most selected sum insured" subtitle="Insurance-cover options selected most often" data={result.analysis.sum_insured || []} settings={chartSettings} setSettings={setChartSettings} categoryName="Sum insured" />
        <InteractiveChart id="premium" title="Premium band effectiveness" subtitle="Frequency and premium contribution by band" data={result.analysis.premium_bands || []} settings={chartSettings} setSettings={setChartSettings} categoryName="Premium band" />
        <InteractiveChart id="course" title="Course analysis" subtitle="Course-wise business contribution" data={result.analysis.course || []} settings={chartSettings} setSettings={setChartSettings} categoryName="Course" />
        <InteractiveChart id="products" title="Insurance products taken most often" subtitle="Product selection and transaction contribution" data={result.analysis.insurance_products || []} settings={chartSettings} setSettings={setChartSettings} categoryName="Insurance product" />
        <InteractiveChart id="insurers" title="Insurer analysis" subtitle="Insurer mix" data={result.analysis.insurers || []} settings={chartSettings} setSettings={setChartSettings} categoryName="Insurer" />
        <InteractiveChart id="age" title="Age group analysis" subtitle="Customer age distribution" data={result.analysis.age || []} settings={chartSettings} setSettings={setChartSettings} categoryName="Age group" />
        {result.meta.policy_included && <InteractiveChart id="policy" title="New versus Renewal" subtitle="Only valid New or Renewal values are included" data={result.analysis.policy || []} settings={chartSettings} setSettings={setChartSettings} categoryName="Policy status" />}
      </section>

      <section className="dataPanel"><div className="dataHead"><div><h2>Cleaned export data</h2><p>The table and exported workbook retain source order. No date-wise, payment-wise or alphabetical sorting is applied.</p></div><div className="filters"><input placeholder="Search all fields" value={search} onChange={(event) => setSearch(event.target.value)} />{result.meta.policy_included && <select value={policyFilter} onChange={(event) => setPolicyFilter(event.target.value)}><option value="">All policies</option><option>New</option><option>Renewal</option></select>}</div></div><div className="tableWrap"><table><thead><tr>{result.meta.export_columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{filtered.slice(0, 500).map((row, index) => <tr key={index}>{result.meta.export_columns.map((column) => <td key={column}>{column === "transaction_amount" ? money(row[column]) : String(row[column] ?? "")}</td>)}</tr>)}</tbody></table></div><div className="tableFoot">Showing {Math.min(filtered.length, 500)} of {filtered.length} filtered records. Excel and CSV exports contain all clean rows in source order.</div></section>

      <section className="quality"><h2>Data cleaning summary</h2><div>{[["Rows received", result.data_quality.rows_before_cleaning], ["Invalid dates removed", result.data_quality.invalid_dates_removed], ["Exact duplicates removed", result.data_quality.exact_duplicates_removed], ["Duplicate transaction IDs removed", result.data_quality.duplicate_transaction_ids_removed], ["Final export rows", result.data_quality.final_rows]].map(([label, value]) => <p key={String(label)}><span>{label}</span><b>{String(value)}</b></p>)}</div></section>
    </>}

    <style jsx global>{`
      *{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#102033;font-family:Arial,Helvetica,sans-serif}button,input,select{font:inherit}main{max-width:1500px;margin:auto;padding:28px}.hero{background:linear-gradient(135deg,#072d2e,#0d5c57);color:white;padding:42px;border-radius:26px;display:flex;justify-content:space-between;gap:30px;align-items:flex-end;box-shadow:0 18px 55px #0d5c5730}.hero h1{font-size:42px;margin:9px 0 12px;max-width:850px}.hero p{max-width:920px;color:#d6eeeb;font-size:17px;line-height:1.6}.eyebrow{font-size:12px;letter-spacing:.16em;font-weight:800;color:#58d4c6}.privacy{background:#ffffff18;border:1px solid #ffffff35;padding:13px 17px;border-radius:13px;white-space:nowrap}.uploadCard{background:white;margin-top:20px;padding:20px;border-radius:20px;display:grid;grid-template-columns:1.6fr 1fr auto;gap:16px;align-items:end;box-shadow:0 8px 30px #16324a12}.drop input{display:none}.drop label{display:flex;flex-direction:column;border:1.5px dashed #8ca6b8;border-radius:14px;padding:16px;cursor:pointer}.drop span,.password label{font-size:12px;color:#667b8e;margin-top:5px}.password{display:flex;flex-direction:column;gap:7px}.password input,.filters input,.filters select,.chartControls select{border:1px solid #ced9e2;border-radius:9px;padding:9px;background:white}.primary,button{border:0;border-radius:11px;padding:13px 18px;cursor:pointer;font-weight:700;background:#e7edf2;color:#173148}.primary{background:#0a6a61;color:white}.primary:disabled,button:disabled{opacity:.55}.small{padding:10px 14px}.error{grid-column:1/-1;color:#a62020;background:#fff0f0;padding:12px;border-radius:10px}.toolbar{display:flex;justify-content:space-between;align-items:center;margin:24px 0 14px;gap:15px}.toolbar>div:first-child{display:flex;flex-direction:column}.toolbar span{font-size:12px;color:#708395;margin-top:4px}.toolbarActions{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}.kpis article{background:white;border-radius:16px;padding:18px;box-shadow:0 5px 20px #1731480d}.kpis span{font-size:12px;color:#738699}.kpis strong{display:block;font-size:20px;margin-top:10px;overflow-wrap:anywhere}.insights{margin:18px 0;background:#eef8f6;border:1px solid #cfeae5;border-radius:18px;padding:22px;display:grid;grid-template-columns:280px 1fr;gap:24px}.insights h2{margin:7px 0}.insights ol{margin:0;padding-left:22px;columns:2;column-gap:35px}.insights li{margin:0 0 10px;break-inside:avoid;line-height:1.45}.chartNote{background:#fff8e8;border:1px solid #f2ddb0;border-radius:14px;padding:14px 17px;margin:0 0 16px;color:#5f4b1d}.gridCharts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.panel{background:white;border-radius:18px;padding:20px;box-shadow:0 5px 20px #1731480d;min-width:0}.chartPanel{position:relative}.panelHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:15px}.panel h3{margin:0;font-size:17px}.panelHead p{margin:5px 0 0;color:#728497;font-size:12px}.chartControls{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.chartControls label{font-size:10px;color:#63788b;display:flex;flex-direction:column;gap:3px}.chartControls select{padding:6px 8px;font-size:11px;min-width:78px}.hoverCard{position:absolute;z-index:8;top:72px;right:20px;background:#102033;color:white;border-radius:11px;padding:10px 12px;box-shadow:0 8px 24px #10203345;display:flex;flex-direction:column;gap:4px;max-width:280px;pointer-events:none;font-size:11px}.hoverCard b{font-size:12px;color:#8fe0d8}.horizontalScroll{overflow-x:auto;overflow-y:hidden;padding-bottom:4px}.verticalBars{height:285px;display:flex;align-items:flex-end;gap:10px;padding:28px 14px 0;border-bottom:1px solid #d8e1e7}.verticalBarItem{height:250px;flex:1;min-width:50px;display:flex;flex-direction:column;align-items:center;cursor:default}.barValue{font-size:10px;color:#556b7d;height:24px;white-space:nowrap}.verticalTrack{height:185px;width:72%;display:flex;align-items:flex-end;background:#eef3f6;border-radius:7px 7px 0 0;overflow:hidden}.verticalTrack span{display:block;width:100%;border-radius:7px 7px 0 0}.verticalLabel{font-size:10px;line-height:1.2;text-align:center;padding-top:7px;max-width:85px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lineChart{display:block;width:100%;height:285px;overflow:visible}.lineChart polyline{fill:none;stroke:#0a6a61;stroke-width:3;stroke-linejoin:round;stroke-linecap:round}.lineChart circle{fill:white;stroke:#0a6a61;stroke-width:3;cursor:pointer}.gridLine{stroke:#e4ebf0;stroke-width:1}.axisValue,.axisLabel{font-size:9px;fill:#667b8e}.pieLayout{display:grid;grid-template-columns:230px 1fr;align-items:center;gap:18px}.donut{width:220px;height:220px;overflow:visible}.donut circle{cursor:pointer;transition:opacity .15s}.donut circle:hover{opacity:.75}.donutTotal{font-size:23px;font-weight:800;fill:#102033}.donutLabel{font-size:10px;fill:#667b8e}.legend{display:flex;flex-direction:column;gap:9px;min-width:0}.legend>div{display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:8px;align-items:center;font-size:12px;cursor:default}.legend i{width:10px;height:10px;border-radius:50%}.legend span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.miniTableWrap{max-height:310px;overflow:auto}.miniTable{border-collapse:collapse;width:100%;font-size:11px}.miniTable th,.miniTable td{padding:8px;border-bottom:1px solid #e6edf2;text-align:left}.miniTable th{position:sticky;top:0;background:#eff5f7}.empty{color:#718497;font-size:13px;padding:50px 0;text-align:center}.dataPanel{background:white;border-radius:18px;margin-top:18px;box-shadow:0 5px 20px #1731480d;overflow:hidden}.dataHead{padding:20px;display:flex;justify-content:space-between;gap:18px;align-items:center}.dataHead h2{margin:0 0 6px}.dataHead p{margin:0;color:#708395;font-size:12px}.filters{display:flex;gap:8px}.tableWrap{overflow:auto;max-height:520px;border-top:1px solid #e2e9ee}.tableWrap table{border-collapse:collapse;width:max-content;min-width:100%;font-size:11px}.tableWrap th,.tableWrap td{padding:10px 12px;border-bottom:1px solid #e7edf2;text-align:left;white-space:nowrap}.tableWrap th{position:sticky;top:0;background:#eef4f6;z-index:2}.tableFoot{padding:11px 20px;color:#728497;font-size:11px}.quality{margin:18px 0;background:white;border-radius:18px;padding:20px;box-shadow:0 5px 20px #1731480d}.quality h2{margin-top:0}.quality>div{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.quality p{background:#f3f7fa;border-radius:12px;padding:13px;margin:0;display:flex;justify-content:space-between;gap:10px;font-size:12px}.quality span{color:#6f8294}@media(max-width:1100px){.kpis{grid-template-columns:repeat(3,1fr)}.gridCharts{grid-template-columns:1fr}.uploadCard{grid-template-columns:1fr}.insights{grid-template-columns:1fr}.quality>div{grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){main{padding:14px}.hero{padding:27px;display:block}.hero h1{font-size:31px}.privacy{margin-top:20px;display:inline-block}.kpis{grid-template-columns:repeat(2,1fr)}.insights ol{columns:1}.toolbar,.dataHead{align-items:flex-start;flex-direction:column}.toolbarActions,.filters{width:100%}.toolbarActions button{flex:1}.pieLayout{grid-template-columns:1fr;justify-items:center}.quality>div{grid-template-columns:1fr}.chartControls{justify-content:flex-start}.panelHead{flex-direction:column}}
    `}</style>
  </main>;
}
