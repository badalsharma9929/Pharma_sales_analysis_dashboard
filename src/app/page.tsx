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
  };
  kpis: Record<string, number | string>;
  cleaned_rows: Row[];
  analysis: Record<string, Item[]>;
  insights: string[];
  data_quality: Record<string, any>;
};

type ValueKey = "count" | "amount" | "premium";

const money = (value: unknown) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const compact = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const PALETTE = [
  "#0a6a61",
  "#2576a8",
  "#e58b37",
  "#7e57c2",
  "#d25572",
  "#3f9c73",
  "#80684d",
];

function EmptyChart({ title }: { title: string }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      <p className="empty">This field was not available in the uploaded data.</p>
    </section>
  );
}

function BarChart({
  data,
  valueKey = "count",
  title,
  subtitle,
}: {
  data: Item[];
  valueKey?: ValueKey;
  title: string;
  subtitle?: string;
}) {
  const rows = data.slice(0, 10);
  if (!rows.length) return <EmptyChart title={title} />;
  const max = Math.max(1, ...rows.map((item) => Number(item[valueKey] || 0)));

  return (
    <section className="panel">
      <div className="panelHead">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <span className="chartType">BAR</span>
      </div>
      <div className="bars">
        {rows.map((item) => (
          <div className="barRow" key={item.label}>
            <div className="barLabel" title={item.label}>
              {item.label}
            </div>
            <div className="barTrack">
              <span
                style={{
                  width: `${Math.max(
                    3,
                    (Number(item[valueKey] || 0) / max) * 100,
                  )}%`,
                }}
              />
            </div>
            <strong>
              {valueKey === "count"
                ? item.count
                : money(item[valueKey])}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function LineChart({
  data,
  title,
  subtitle,
  valueKey = "amount",
  maxPoints = 24,
}: {
  data: Item[];
  title: string;
  subtitle: string;
  valueKey?: ValueKey;
  maxPoints?: number;
}) {
  const rows = data.slice(-maxPoints);
  if (!rows.length) return <EmptyChart title={title} />;

  const width = 760;
  const height = 245;
  const left = 48;
  const right = 24;
  const top = 22;
  const bottom = 44;
  const values = rows.map((item) => Number(item[valueKey] || 0));
  const max = Math.max(1, ...values);
  const step = (width - left - right) / Math.max(1, rows.length - 1);
  const points = values
    .map((value, index) => {
      const x = left + index * step;
      const y = height - bottom - (value / max) * (height - top - bottom);
      return `${x},${y}`;
    })
    .join(" ");
  const labelEvery = Math.max(1, Math.ceil(rows.length / 8));

  return (
    <section className="panel wide">
      <div className="panelHead">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span className="chartType">LINE</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="lineChart">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - bottom - ratio * (height - top - bottom);
          return (
            <g key={ratio}>
              <line className="gridLine" x1={left} y1={y} x2={width - right} y2={y} />
              <text className="axisValue" x={left - 7} y={y + 4} textAnchor="end">
                {valueKey === "count"
                  ? Math.round(max * ratio)
                  : compact(max * ratio)}
              </text>
            </g>
          );
        })}
        <polyline points={points} />
        {rows.map((item, index) => {
          const x = left + index * step;
          const y =
            height -
            bottom -
            (Number(item[valueKey] || 0) / max) *
              (height - top - bottom);
          return (
            <g key={`${item.label}-${index}`}>
              <circle cx={x} cy={y} r="4">
                <title>
                  {item.label}: {valueKey === "count" ? item.count : money(item[valueKey])}
                </title>
              </circle>
              {(index % labelEvery === 0 || index === rows.length - 1) && (
                <text className="axisLabel" x={x} y={height - 15} textAnchor="middle">
                  {item.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function PieChart({
  data,
  title,
  subtitle,
}: {
  data: Item[];
  title: string;
  subtitle?: string;
}) {
  const initial = data.filter((item) => item.count > 0);
  if (!initial.length) return <EmptyChart title={title} />;

  const top = initial.slice(0, 5);
  const otherCount = initial.slice(5).reduce((sum, item) => sum + item.count, 0);
  const rows = otherCount
    ? [...top, { label: "Other", count: otherCount }]
    : top;
  const total = rows.reduce((sum, item) => sum + item.count, 0);
  let cursor = 0;
  const gradient = rows
    .map((item, index) => {
      const start = cursor;
      cursor += (item.count / total) * 100;
      return `${PALETTE[index % PALETTE.length]} ${start}% ${cursor}%`;
    })
    .join(", ");

  return (
    <section className="panel">
      <div className="panelHead">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <span className="chartType">PIE</span>
      </div>
      <div className="pieLayout">
        <div className="pie" style={{ background: `conic-gradient(${gradient})` }}>
          <div className="pieHole">
            <strong>{total}</strong>
            <span>records</span>
          </div>
        </div>
        <div className="legend">
          {rows.map((item, index) => (
            <div key={item.label}>
              <i style={{ background: PALETTE[index % PALETTE.length] }} />
              <span title={item.label}>{item.label}</span>
              <b>{((item.count / total) * 100).toFixed(1)}%</b>
            </div>
          ))}
        </div>
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

  const filtered = useMemo(() => {
    if (!result) return [];
    const query = search.trim().toLowerCase();
    return result.cleaned_rows.filter((row) => {
      const policyOk =
        !policyFilter || row["Policy (New/Renewal)"] === policyFilter;
      const searchOk =
        !query ||
        Object.values(row).some((value) =>
          String(value ?? "").toLowerCase().includes(query),
        );
      return policyOk && searchOk;
    });
  }, [result, search, policyFilter]);

  async function analyze() {
    if (!files.length) {
      setError("Select at least one Excel file.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      form.append("password", password);
      const response = await fetch("/api/process", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Unable to process workbook.");
      }
      setResult(data);
    } catch (exception: any) {
      setError(exception.message || "Processing failed.");
    } finally {
      setLoading(false);
    }
  }

  async function exportExcel() {
    if (!result) return;
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const add = (name: string, rows: any[]) => {
      const values = rows.length ? rows : [{ Status: "No data available" }];
      const worksheet = XLSX.utils.json_to_sheet(values);
      worksheet["!cols"] = Object.keys(values[0]).map((key) => ({
        wch: Math.min(42, Math.max(13, key.length + 3)),
      }));
      XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
    };

    add(
      "Dashboard_Summary",
      Object.entries(result.kpis).map(([Metric, Value]) => ({ Metric, Value })),
    );
    add("Export_Data", filtered);
    add("Monthly_Amount_Trend", result.analysis.monthly_trend || []);
    add("Daily_Amount_Trend", result.analysis.daily_trend || []);
    if (result.meta.policy_included) {
      add("New_Renewal", result.analysis.policy || []);
    }
    add("New_Existing_Member", result.analysis.new_existing_member || []);
    add("Nominee_Relationship", result.analysis.nominee_relationship || []);
    add("Sum_Insured", result.analysis.sum_insured || []);
    add("Premium_Bands", result.analysis.premium_bands || []);
    add("Age_Analysis", result.analysis.age || []);
    add("State_Analysis", result.analysis.state || []);
    add("City_Analysis", result.analysis.city || []);
    add("Pincode_Analysis", result.analysis.pincode || []);
    add("Passing_Year_Batch", result.analysis.passing_year || []);
    add("Course_Analysis", result.analysis.course || []);
    add("Insurance_Products", result.analysis.insurance_products || []);
    add("Insurers", result.analysis.insurers || []);
    add(
      "Business_Insights",
      result.insights.map((insight, index) => ({
        No: index + 1,
        Insight: insight,
      })),
    );
    add(
      "Data_Quality",
      Object.entries(result.data_quality)
        .filter(([key]) => key !== "processing_log")
        .map(([Metric, Value]) => ({ Metric, Value })),
    );

    XLSX.writeFile(
      workbook,
      `Insurance_Business_Insights_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  function exportCsv() {
    if (!result || !filtered.length) return;
    const columns = result.meta.export_columns;
    const escape = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      columns.map(escape).join(","),
      ...filtered.map((row) =>
        columns.map((column) => escape(row[column])).join(","),
      ),
    ].join("\n");
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    anchor.download = "Cleaned_Insurance_Data.csv";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  async function exportPowerPoint() {
    if (!result) return;
    setPptLoading(true);
    setError("");
    try {
      const module: any = await import("pptxgenjs");
      const PptxGenJS = module.default || module;
      const pptx: any = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.author = "Insurance Business Insights Dashboard";
      pptx.company = "Business Analytics";
      pptx.subject = "Insurance portfolio and customer trend analysis";
      pptx.title = "Insurance Business Insights";
      pptx.lang = "en-IN";
      pptx.theme = {
        headFontFace: "Aptos Display",
        bodyFontFace: "Aptos",
        lang: "en-US",
      };

      const C = {
        navy: "102033",
        teal: "0A6A61",
        tealDark: "073B3A",
        aqua: "58D4C6",
        blue: "2576A8",
        orange: "E58B37",
        purple: "7E57C2",
        rose: "D25572",
        green: "3F9C73",
        pale: "EFF7F6",
        paleBlue: "F2F6FA",
        line: "D7E1E8",
        gray: "667B8E",
        white: "FFFFFF",
      };

      const addFooter = (slide: any, number: number) => {
        slide.addText("Insurance Business Insights", {
          x: 0.45,
          y: 7.15,
          w: 4.2,
          h: 0.18,
          fontSize: 8,
          color: C.gray,
          margin: 0,
        });
        slide.addText(String(number), {
          x: 12.35,
          y: 7.12,
          w: 0.45,
          h: 0.2,
          fontSize: 8,
          color: C.gray,
          align: "right",
          margin: 0,
        });
      };

      const addHeader = (
        slide: any,
        title: string,
        subtitle: string,
        number: number,
      ) => {
        slide.background = { color: C.white };
        slide.addText(title, {
          x: 0.55,
          y: 0.35,
          w: 8.8,
          h: 0.42,
          fontSize: 24,
          bold: true,
          color: C.navy,
          margin: 0,
        });
        slide.addText(subtitle, {
          x: 0.55,
          y: 0.83,
          w: 10.9,
          h: 0.28,
          fontSize: 10,
          color: C.gray,
          margin: 0,
        });
        slide.addShape(pptx.ShapeType.line, {
          x: 0.55,
          y: 1.18,
          w: 12.2,
          h: 0,
          line: { color: C.line, width: 1 },
        });
        addFooter(slide, number);
      };

      const addKpi = (
        slide: any,
        label: string,
        value: string,
        x: number,
        y: number,
        w: number,
      ) => {
        slide.addText(label.toUpperCase(), {
          x,
          y,
          w,
          h: 0.25,
          fontSize: 8,
          bold: true,
          color: C.gray,
          charSpacing: 1.1,
          margin: 0.08,
        });
        slide.addText(value, {
          x,
          y: y + 0.27,
          w,
          h: 0.65,
          fontSize: 19,
          bold: true,
          color: C.navy,
          fill: { color: C.paleBlue },
          line: { color: C.line, width: 1 },
          radius: 0.08,
          margin: 0.12,
          valign: "mid",
        });
      };

      const nativeSeries = (
        data: Item[],
        valueKey: ValueKey,
        name: string,
        limit = 12,
      ) => {
        const rows = data.slice(0, limit).filter((item) => item.label);
        return [
          {
            name,
            labels: rows.map((item) => item.label),
            values: rows.map((item) => Number(item[valueKey] || 0)),
          },
        ];
      };

      const addNoData = (slide: any, title: string, x: number, y: number, w: number, h: number) => {
        slide.addText(`${title}\nData was not available in the uploaded file.`, {
          x,
          y,
          w,
          h,
          fontSize: 13,
          color: C.gray,
          align: "center",
          valign: "mid",
          fill: { color: C.paleBlue },
          line: { color: C.line, width: 1 },
          margin: 0.15,
        });
      };

      const addLine = (
        slide: any,
        title: string,
        data: Item[],
        valueKey: ValueKey,
        x: number,
        y: number,
        w: number,
        h: number,
        limit = 24,
      ) => {
        const rows = data.slice(-limit);
        slide.addText(title, {
          x,
          y: y - 0.32,
          w,
          h: 0.25,
          fontSize: 12,
          bold: true,
          color: C.navy,
          margin: 0,
        });
        if (!rows.length) return addNoData(slide, title, x, y, w, h);
        slide.addChart(
          pptx.ChartType.line,
          nativeSeries(rows, valueKey, title, rows.length),
          {
            x,
            y,
            w,
            h,
            showLegend: false,
            showTitle: false,
            showValue: false,
            catAxisLabelFontSize: 8,
            valAxisLabelFontSize: 8,
            chartColors: [C.teal],
            showCatName: false,
            showSerName: false,
            lineSize: 2.5,
            showMarker: true,
            markerSize: 4,
            showValue: false,
            valGridLine: { color: C.line, width: 1 },
            showBorder: false,
          },
        );
      };

      const addBar = (
        slide: any,
        title: string,
        data: Item[],
        valueKey: ValueKey,
        x: number,
        y: number,
        w: number,
        h: number,
        limit = 10,
      ) => {
        const rows = data.slice(0, limit);
        slide.addText(title, {
          x,
          y: y - 0.32,
          w,
          h: 0.25,
          fontSize: 12,
          bold: true,
          color: C.navy,
          margin: 0,
        });
        if (!rows.length) return addNoData(slide, title, x, y, w, h);
        slide.addChart(
          pptx.ChartType.bar,
          nativeSeries(rows, valueKey, title, rows.length),
          {
            x,
            y,
            w,
            h,
            showLegend: false,
            showTitle: false,
            showValue: true,
            dataLabelPosition: "outEnd",
            dataLabelColor: C.gray,
            dataLabelFormatCode: valueKey === "count" ? "0" : "₹#,##0",
            catAxisLabelFontSize: 8,
            valAxisLabelFontSize: 8,
            chartColors: [C.teal],
            showBorder: false,
            valGridLine: { color: C.line, width: 1 },
          },
        );
      };

      const addPie = (
        slide: any,
        title: string,
        data: Item[],
        x: number,
        y: number,
        w: number,
        h: number,
      ) => {
        const rows = data.slice(0, 6);
        slide.addText(title, {
          x,
          y: y - 0.32,
          w,
          h: 0.25,
          fontSize: 12,
          bold: true,
          color: C.navy,
          margin: 0,
        });
        if (!rows.length) return addNoData(slide, title, x, y, w, h);
        slide.addChart(
          pptx.ChartType.doughnut,
          nativeSeries(rows, "count", title, rows.length),
          {
            x,
            y,
            w,
            h,
            holeSize: 55,
            showLegend: true,
            legendPos: "b",
            legendFontSize: 8,
            showPercent: true,
            showCategoryName: true,
            showValue: false,
            dataLabelPosition: "bestFit",
            dataLabelColor: C.navy,
            chartColors: [C.teal, C.blue, C.orange, C.purple, C.rose, C.green],
            showBorder: false,
          },
        );
      };

      // Cover
      let slide = pptx.addSlide();
      slide.background = { color: C.tealDark };
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 0.18,
        h: 7.5,
        fill: { color: C.aqua },
        line: { color: C.aqua },
      });
      slide.addText("INSURANCE BUSINESS ANALYTICS", {
        x: 0.72,
        y: 0.72,
        w: 5.4,
        h: 0.28,
        fontSize: 11,
        bold: true,
        color: C.aqua,
        charSpacing: 2.1,
        margin: 0,
      });
      slide.addText("Business Insights\nManagement Report", {
        x: 0.72,
        y: 1.42,
        w: 7.7,
        h: 1.6,
        fontSize: 36,
        bold: true,
        color: C.white,
        breakLine: false,
        margin: 0,
      });
      slide.addText(
        "Customer profile, insurance demand, geography, premium effectiveness and transaction trends",
        {
          x: 0.72,
          y: 3.25,
          w: 7.9,
          h: 0.72,
          fontSize: 16,
          color: "D6EEEB",
          margin: 0,
        },
      );
      slide.addText(`${result.kpis.total_records} clean records`, {
        x: 9.2,
        y: 1.35,
        w: 3.15,
        h: 0.75,
        fontSize: 25,
        bold: true,
        color: C.white,
        fill: { color: "0D5C57", transparency: 10 },
        line: { color: "3F8C86", width: 1 },
        align: "center",
        valign: "mid",
        margin: 0.12,
      });
      slide.addText(money(result.kpis.total_transaction_amount), {
        x: 9.2,
        y: 2.35,
        w: 3.15,
        h: 0.75,
        fontSize: 24,
        bold: true,
        color: C.white,
        fill: { color: "0D5C57", transparency: 10 },
        line: { color: "3F8C86", width: 1 },
        align: "center",
        valign: "mid",
        margin: 0.12,
      });
      slide.addText(`Generated ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`, {
        x: 0.72,
        y: 6.65,
        w: 5.7,
        h: 0.25,
        fontSize: 10,
        color: "A8D4CF",
        margin: 0,
      });

      // Executive summary
      slide = pptx.addSlide();
      addHeader(slide, "Executive summary", "Headline business performance and automatically generated findings", 2);
      const summaryKpis = [
        ["Clean records", String(result.kpis.total_records)],
        ["Transaction value", money(result.kpis.total_transaction_amount)],
        ["Average transaction", money(result.kpis.average_transaction_amount)],
        ["Total premium", money(result.kpis.total_premium)],
        ["Top sum insured", String(result.kpis.most_selected_sum_insured)],
        ["Top city", String(result.kpis.top_city)],
      ];
      summaryKpis.forEach(([label, value], index) => {
        addKpi(slide, label, value, 0.58 + (index % 3) * 4.16, 1.48 + Math.floor(index / 3) * 1.18, 3.82);
      });
      slide.addText("Key findings", {
        x: 0.6,
        y: 4.15,
        w: 2,
        h: 0.3,
        fontSize: 15,
        bold: true,
        color: C.teal,
        margin: 0,
      });
      slide.addText(result.insights.slice(0, 7).map((item) => `• ${item}`).join("\n"), {
        x: 0.62,
        y: 4.52,
        w: 12,
        h: 2.25,
        fontSize: 11.5,
        color: C.navy,
        breakLine: false,
        margin: 0.08,
        valign: "top",
        paraSpaceAfterPt: 8,
      });

      // Transaction trends
      slide = pptx.addSlide();
      addHeader(slide, "Transaction trends", "Month-versus-amount and date-versus-amount analysis", 3);
      addLine(slide, "Transaction month vs transaction amount", result.analysis.monthly_trend || [], "amount", 0.6, 1.62, 12.1, 2.2, 24);
      addLine(slide, "Transaction date vs transaction amount", result.analysis.daily_trend || [], "amount", 0.6, 4.38, 12.1, 2.2, 30);

      // Geography
      slide = pptx.addSlide();
      addHeader(slide, "Geographical performance", "Where transaction demand and value are concentrated", 4);
      addBar(slide, "State analysis", result.analysis.state || [], "count", 0.55, 1.62, 6.0, 4.9, 10);
      addBar(slide, "City analysis", result.analysis.city || [], "count", 6.78, 1.62, 6.0, 4.9, 10);

      slide = pptx.addSlide();
      addHeader(slide, "Pincode analysis", "Local demand pockets ranked by transaction volume", 5);
      addBar(slide, "Top pincodes", result.analysis.pincode || [], "count", 0.6, 1.62, 7.4, 4.95, 12);
      const pincodeRows = (result.analysis.pincode || []).slice(0, 10);
      if (pincodeRows.length) {
        slide.addText("Top pincode table", { x: 8.35, y: 1.3, w: 4.2, h: 0.28, fontSize: 12, bold: true, color: C.navy, margin: 0 });
        slide.addTable(
          [["Pincode", "Transactions", "Value"], ...pincodeRows.map((item) => [item.label, item.count, money(item.amount)])],
          {
            x: 8.35,
            y: 1.65,
            w: 4.25,
            h: 4.8,
            border: { type: "solid", color: C.line, pt: 1 },
            fill: C.white,
            color: C.navy,
            fontSize: 9,
            margin: 0.07,
            rowH: 0.38,
            bold: false,
            autoFit: false,
            colW: [1.35, 1.2, 1.7],
            valign: "mid",
          },
        );
      } else {
        addNoData(slide, "Pincode table", 8.35, 1.65, 4.25, 4.8);
      }

      // Customer profile
      slide = pptx.addSlide();
      addHeader(slide, "Member and cohort profile", "Batch, nominee and member-status composition", 6);
      addLine(slide, "Passing year / batch vs transaction amount", result.analysis.passing_year || [], "amount", 0.55, 1.62, 7.15, 4.85, 28);
      addPie(slide, "New or existing member", result.analysis.new_existing_member || [], 7.9, 1.62, 2.35, 2.05);
      addPie(slide, "Nominee relationship", result.analysis.nominee_relationship || [], 10.42, 1.62, 2.35, 2.05);
      addBar(slide, "Course analysis", result.analysis.course || [], "count", 7.9, 4.48, 4.87, 2.0, 8);

      // Insurance economics
      slide = pptx.addSlide();
      addHeader(slide, "Insurance selection and premium effectiveness", "Demand for coverage levels and premium-price bands", 7);
      addBar(slide, "Most selected sum insured", result.analysis.sum_insured || [], "count", 0.55, 1.62, 6.0, 4.9, 10);
      addBar(slide, "Premium band effectiveness", result.analysis.premium_bands || [], "amount", 6.78, 1.62, 6.0, 4.9, 8);

      // Portfolio mix
      slide = pptx.addSlide();
      addHeader(slide, "Portfolio composition", "Policy status, products and insurer mix", 8);
      if (result.meta.policy_included) {
        addPie(slide, "New versus Renewal", result.analysis.policy || [], 0.55, 1.62, 3.55, 2.45);
      } else {
        addNoData(slide, "New versus Renewal", 0.55, 1.62, 3.55, 2.45);
      }
      addBar(slide, "Insurance products taken most often", result.analysis.insurance_products || [], "count", 4.35, 1.62, 8.4, 2.45, 10);
      addBar(slide, "Insurer analysis", result.analysis.insurers || [], "count", 0.55, 4.68, 12.2, 1.8, 10);

      // Findings and data quality
      slide = pptx.addSlide();
      addHeader(slide, "Management findings and data quality", "Action points supported by the imported workbook", 9);
      slide.addText("Business findings", { x: 0.6, y: 1.38, w: 3, h: 0.3, fontSize: 15, bold: true, color: C.teal, margin: 0 });
      slide.addText(result.insights.map((item) => `• ${item}`).join("\n"), {
        x: 0.62,
        y: 1.78,
        w: 8.0,
        h: 4.9,
        fontSize: 11,
        color: C.navy,
        margin: 0.08,
        breakLine: false,
        paraSpaceAfterPt: 8,
        valign: "top",
      });
      const qualityRows = [
        ["Rows received", result.data_quality.rows_before_cleaning],
        ["Invalid dates removed", result.data_quality.invalid_dates_removed],
        ["Exact duplicates removed", result.data_quality.exact_duplicates_removed],
        ["Duplicate transaction IDs", result.data_quality.duplicate_transaction_ids_removed],
        ["Final export rows", result.data_quality.final_rows],
      ];
      slide.addText("Data quality", { x: 9.0, y: 1.38, w: 2.5, h: 0.3, fontSize: 15, bold: true, color: C.teal, margin: 0 });
      slide.addTable(
        [["Cleaning check", "Rows"], ...qualityRows],
        {
          x: 9.0,
          y: 1.78,
          w: 3.7,
          h: 2.8,
          border: { type: "solid", color: C.line, pt: 1 },
          fill: C.white,
          color: C.navy,
          fontSize: 10,
          margin: 0.08,
          colW: [2.6, 1.0],
          valign: "mid",
        },
      );
      slide.addText("Analysis rules", { x: 9.0, y: 4.9, w: 2.5, h: 0.3, fontSize: 13, bold: true, color: C.teal, margin: 0 });
      slide.addText("• Policy status includes only valid New or Renewal values.\n• Sum insured represents coverage selected most often.\n• Geographic and profile charts appear only when those fields exist.\n• Blank/zero transaction dates and duplicate IDs are removed.", {
        x: 9.0,
        y: 5.28,
        w: 3.7,
        h: 1.4,
        fontSize: 9.5,
        color: C.navy,
        margin: 0.04,
        breakLine: false,
      });

      await pptx.writeFile({
        fileName: `Insurance_Business_Insights_${new Date().toISOString().slice(0, 10)}.pptx`,
      });
    } catch (exception: any) {
      setError(exception.message || "PowerPoint export failed.");
    } finally {
      setPptLoading(false);
    }
  }

  return (
    <main>
      <header className="hero">
        <div>
          <span className="eyebrow">NO-CODE EXCEL ANALYTICS</span>
          <h1>Insurance Business Insights Dashboard</h1>
          <p>
            Import password-protected Excel files, clean the data, analyse
            customer and insurance trends, and export management-ready Excel
            and PowerPoint reports.
          </p>
        </div>
        <div className="privacy">🔒 Files are processed only for this request</div>
      </header>

      <section className="uploadCard">
        <div className="drop">
          <input
            id="files"
            type="file"
            multiple
            accept=".xlsx,.xlsm,.xls"
            onChange={(event) =>
              setFiles(Array.from(event.target.files || []))
            }
          />
          <label htmlFor="files">
            <b>Choose Excel files</b>
            <span>
              {files.length
                ? files.map((file) => file.name).join(", ")
                : "Upload one or multiple workbooks"}
            </span>
          </label>
        </div>
        <div className="password">
          <label>Common Excel password</label>
          <input
            type="password"
            value={password}
            placeholder="Enter the common password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <button className="primary" onClick={analyze} disabled={loading}>
          {loading ? "Analysing…" : "Generate Dashboard"}
        </button>
        {error && <div className="error">{error}</div>}
      </section>

      {result && (
        <>
          <div className="toolbar">
            <div>
              <b>{result.kpis.total_records} clean records</b>
              <span>
                Processed {new Date(result.meta.processed_at).toLocaleString()}
              </span>
            </div>
            <div className="toolbarActions">
              <button onClick={exportCsv}>Export CSV</button>
              <button onClick={exportExcel}>Export Complete Excel</button>
              <button
                className="primary small"
                onClick={exportPowerPoint}
                disabled={pptLoading}
              >
                {pptLoading ? "Creating PPT…" : "Export Presentable PPT"}
              </button>
            </div>
          </div>

          <section className="kpis">
            {[
              ["Clean records", result.kpis.total_records],
              ["Transaction value", money(result.kpis.total_transaction_amount)],
              ["Average transaction", money(result.kpis.average_transaction_amount)],
              ["Total premium", money(result.kpis.total_premium)],
              ["Most selected sum insured", result.kpis.most_selected_sum_insured],
              ["Top city", result.kpis.top_city],
              ["Top state", result.kpis.top_state],
              ["Top pincode", result.kpis.top_pincode],
            ].map(([label, value]) => (
              <article key={String(label)}>
                <span>{label}</span>
                <strong>{String(value)}</strong>
              </article>
            ))}
          </section>

          <section className="insights">
            <div>
              <span className="eyebrow">AUTOMATIC BUSINESS FINDINGS</span>
              <h2>What the data is saying</h2>
            </div>
            <ol>
              {result.insights.map((insight, index) => (
                <li key={index}>{insight}</li>
              ))}
            </ol>
          </section>

          <section className="sectionTitle">
            <span>TRANSACTION PERFORMANCE</span>
            <h2>Amount trends over time</h2>
          </section>
          <section className="gridCharts">
            <LineChart
              title="Transaction month vs Transaction amount"
              subtitle="Monthly movement in transaction value"
              data={result.analysis.monthly_trend || []}
              valueKey="amount"
              maxPoints={24}
            />
            <LineChart
              title="Transaction date vs Transaction amount"
              subtitle="Daily transaction-value movement"
              data={result.analysis.daily_trend || []}
              valueKey="amount"
              maxPoints={35}
            />
          </section>

          <section className="sectionTitle">
            <span>GEOGRAPHICAL ANALYSIS</span>
            <h2>State, city and pincode demand</h2>
          </section>
          <section className="gridCharts">
            <BarChart title="State analysis" subtitle="Transactions by state" data={result.analysis.state || []} />
            <BarChart title="City analysis" subtitle="Transactions by city" data={result.analysis.city || []} />
            <BarChart title="Pincode analysis" subtitle="Local demand pockets" data={result.analysis.pincode || []} />
            <BarChart title="State transaction value" subtitle="Amount contribution by state" data={result.analysis.state || []} valueKey="amount" />
          </section>

          <section className="sectionTitle">
            <span>MEMBER PROFILE</span>
            <h2>Cohort, nominee and member-status trends</h2>
          </section>
          <section className="gridCharts">
            <LineChart
              title="Batch / Passing year analysis"
              subtitle="Transaction amount by passing-year cohort"
              data={result.analysis.passing_year || []}
              valueKey="amount"
              maxPoints={30}
            />
            <PieChart title="New or Existing Member analysis" subtitle="Member-status mix" data={result.analysis.new_existing_member || []} />
            <PieChart title="Nominee relationship analysis" subtitle="Nominee relationship mix" data={result.analysis.nominee_relationship || []} />
            <BarChart title="Course analysis" subtitle="Transactions by course" data={result.analysis.course || []} />
            <BarChart title="Age group analysis" data={result.analysis.age || []} />
            <PieChart title="Gender mix" data={result.analysis.gender || []} />
          </section>

          <section className="sectionTitle">
            <span>INSURANCE PORTFOLIO</span>
            <h2>Coverage, premium and policy selection</h2>
          </section>
          <section className="gridCharts">
            <BarChart title="Most selected sum insured" data={result.analysis.sum_insured || []} />
            <BarChart title="Premium band effectiveness" subtitle="Premium value contributed by each band" data={result.analysis.premium_bands || []} valueKey="amount" />
            <BarChart title="Insurance products taken most often" data={result.analysis.insurance_products || []} />
            <BarChart title="Insurer analysis" data={result.analysis.insurers || []} />
            {result.meta.policy_included && (
              <PieChart title="New versus Renewal" data={result.analysis.policy || []} />
            )}
            <PieChart title="Payment mode mix" data={result.analysis.pay_mode || []} />
          </section>

          <section className="dataPanel">
            <div className="dataHead">
              <div>
                <h2>Cleaned export data</h2>
                <p>
                  Only New/Renewal values are accepted in the optional Policy
                  column. Values such as GMC remain under insurance type
                  analysis.
                </p>
              </div>
              <div className="filters">
                <input
                  placeholder="Search all fields"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {result.meta.policy_included && (
                  <select
                    value={policyFilter}
                    onChange={(event) => setPolicyFilter(event.target.value)}
                  >
                    <option value="">All policies</option>
                    <option>New</option>
                    <option>Renewal</option>
                  </select>
                )}
              </div>
            </div>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    {result.meta.export_columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map((row, index) => (
                    <tr key={index}>
                      {result.meta.export_columns.map((column) => (
                        <td key={column}>
                          {column === "transaction_amount"
                            ? money(row[column])
                            : String(row[column] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="tableFoot">
              Showing {Math.min(filtered.length, 500)} of {filtered.length}{" "}
              filtered records
            </div>
          </section>

          <section className="quality">
            <h2>Data cleaning summary</h2>
            <div>
              {[
                ["Rows received", result.data_quality.rows_before_cleaning],
                ["Invalid dates removed", result.data_quality.invalid_dates_removed],
                ["Exact duplicates removed", result.data_quality.exact_duplicates_removed],
                ["Duplicate transaction IDs removed", result.data_quality.duplicate_transaction_ids_removed],
                ["Final export rows", result.data_quality.final_rows],
              ].map(([label, value]) => (
                <p key={String(label)}>
                  <span>{label}</span>
                  <b>{String(value)}</b>
                </p>
              ))}
            </div>
          </section>
        </>
      )}

      <style jsx global>{`
        *{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#102033;font-family:Arial,Helvetica,sans-serif}button,input,select{font:inherit}main{max-width:1440px;margin:auto;padding:28px}.hero{background:linear-gradient(135deg,#072d2e,#0d5c57);color:white;padding:42px;border-radius:26px;display:flex;justify-content:space-between;gap:30px;align-items:flex-end;box-shadow:0 18px 55px #0d5c5730}.hero h1{font-size:42px;margin:9px 0 12px;max-width:800px}.hero p{max-width:850px;color:#d6eeeb;font-size:17px;line-height:1.6}.eyebrow{font-size:12px;letter-spacing:.16em;font-weight:800;color:#58d4c6}.privacy{background:#ffffff18;border:1px solid #ffffff35;padding:13px 17px;border-radius:13px;white-space:nowrap}.uploadCard{background:white;margin-top:20px;padding:20px;border-radius:20px;display:grid;grid-template-columns:1.6fr 1fr auto;gap:16px;align-items:end;box-shadow:0 8px 30px #16324a12}.drop input{display:none}.drop label{display:flex;flex-direction:column;border:1.5px dashed #8ca6b8;border-radius:14px;padding:16px;cursor:pointer}.drop span,.password label{font-size:12px;color:#667b8e;margin-top:5px}.password{display:flex;flex-direction:column;gap:7px}.password input,.filters input,.filters select{border:1px solid #ced9e2;border-radius:11px;padding:12px;background:white}.primary,button{border:0;border-radius:11px;padding:13px 18px;cursor:pointer;font-weight:700;background:#e7edf2;color:#173148}.primary{background:#0a6a61;color:white}.primary:disabled,button:disabled{opacity:.55;cursor:not-allowed}.small{padding:10px 14px}.error{grid-column:1/-1;color:#a62020;background:#fff0f0;padding:12px;border-radius:10px}.toolbar{display:flex;justify-content:space-between;align-items:center;margin:24px 0 14px;gap:16px}.toolbar>div:first-child{display:flex;flex-direction:column}.toolbar span{font-size:12px;color:#708395;margin-top:4px}.toolbarActions{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.kpis article{background:white;border-radius:16px;padding:18px;box-shadow:0 5px 20px #1731480d}.kpis span{font-size:12px;color:#738699}.kpis strong{display:block;font-size:20px;margin-top:10px;overflow-wrap:anywhere}.insights{margin:18px 0;background:#eef8f6;border:1px solid #cfeae5;border-radius:18px;padding:22px;display:grid;grid-template-columns:280px 1fr;gap:24px}.insights h2{margin:7px 0}.insights ol{margin:0;padding-left:22px;columns:2;column-gap:35px}.insights li{margin:0 0 10px;break-inside:avoid;line-height:1.45}.sectionTitle{margin:30px 0 13px}.sectionTitle span{font-size:11px;letter-spacing:.15em;color:#0a6a61;font-weight:800}.sectionTitle h2{margin:5px 0;font-size:24px}.gridCharts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.panel{background:white;border-radius:18px;padding:20px;box-shadow:0 5px 20px #1731480d;min-height:320px}.panel.wide{grid-column:1/-1;min-height:335px}.panel h3{margin:0 0 5px}.panelHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:13px}.panelHead h3{margin:0}.panelHead p{margin:5px 0 0;font-size:12px;color:#728497}.chartType{font-size:9px;letter-spacing:.12em;font-weight:800;color:#0a6a61;background:#e6f4f2;padding:6px 8px;border-radius:7px}.bars{display:flex;flex-direction:column;gap:12px;margin-top:16px}.barRow{display:grid;grid-template-columns:minmax(120px,1fr) 2fr 92px;gap:12px;align-items:center;font-size:12px}.barLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#40576a}.barTrack{height:10px;background:#e8eef2;border-radius:999px;overflow:hidden}.barTrack span{display:block;height:100%;background:linear-gradient(90deg,#0a6a61,#58b9ae);border-radius:999px}.barRow strong{text-align:right;font-size:11px}.lineChart{width:100%;height:250px;overflow:visible}.lineChart polyline{fill:none;stroke:#0a6a61;stroke-width:3;stroke-linejoin:round;stroke-linecap:round}.lineChart circle{fill:white;stroke:#0a6a61;stroke-width:3}.gridLine{stroke:#e3eaf0;stroke-width:1}.axisValue,.axisLabel{font-size:9px;fill:#708395}.pieLayout{display:grid;grid-template-columns:190px 1fr;align-items:center;gap:20px;margin-top:18px}.pie{width:180px;height:180px;border-radius:50%;display:grid;place-items:center}.pieHole{width:93px;height:93px;border-radius:50%;background:white;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 0 0 1px #edf1f4}.pieHole strong{font-size:22px}.pieHole span{font-size:10px;color:#728497}.legend{display:flex;flex-direction:column;gap:11px}.legend>div{display:grid;grid-template-columns:11px minmax(0,1fr) 54px;align-items:center;gap:8px;font-size:12px}.legend i{width:10px;height:10px;border-radius:3px}.legend span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.legend b{text-align:right}.empty{color:#728497;background:#f5f8fa;border-radius:12px;padding:28px;text-align:center;margin-top:25px}.dataPanel{background:white;border-radius:20px;margin-top:24px;padding:20px;box-shadow:0 6px 25px #17314810}.dataHead{display:flex;justify-content:space-between;gap:20px;align-items:end}.dataHead h2{margin:0 0 6px}.dataHead p{margin:0;color:#728497;font-size:12px}.filters{display:flex;gap:8px}.tableWrap{overflow:auto;margin-top:18px;border:1px solid #dde5eb;border-radius:13px;max-height:570px}.tableWrap table{border-collapse:collapse;min-width:100%;font-size:12px}.tableWrap th{position:sticky;top:0;background:#eaf1f4;z-index:1;text-align:left;padding:12px;white-space:nowrap}.tableWrap td{padding:11px 12px;border-top:1px solid #e4eaef;white-space:nowrap}.tableWrap tr:hover td{background:#f7fafb}.tableFoot{font-size:11px;color:#728497;margin-top:10px}.quality{background:white;border-radius:18px;margin-top:18px;padding:20px}.quality h2{margin-top:0}.quality>div{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.quality p{background:#f4f7f9;padding:14px;border-radius:11px;margin:0;display:flex;flex-direction:column;gap:7px}.quality span{font-size:11px;color:#708395}.quality b{font-size:18px}@media(max-width:1050px){.hero{align-items:flex-start;flex-direction:column}.uploadCard{grid-template-columns:1fr 1fr}.uploadCard .primary{grid-column:1/-1}.kpis{grid-template-columns:repeat(2,1fr)}.insights{grid-template-columns:1fr}.quality>div{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){main{padding:14px}.hero{padding:25px}.hero h1{font-size:31px}.privacy{white-space:normal}.uploadCard{grid-template-columns:1fr}.uploadCard .primary{grid-column:auto}.gridCharts{grid-template-columns:1fr}.panel.wide{grid-column:auto}.toolbar,.dataHead{align-items:stretch;flex-direction:column}.toolbarActions,.filters{justify-content:stretch;flex-direction:column}.toolbarActions button,.filters input,.filters select{width:100%}.kpis{grid-template-columns:1fr}.insights ol{columns:1}.pieLayout{grid-template-columns:1fr;justify-items:center}.legend{width:100%}.barRow{grid-template-columns:110px 1fr 72px}.quality>div{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
