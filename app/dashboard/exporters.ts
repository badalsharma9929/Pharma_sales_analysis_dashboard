import {
  Analysis,
  excelDate,
  Item,
  Metric,
  metricLabel,
  money,
  Result,
} from "./types";

function addSheet(
  XLSX: any,
  workbook: any,
  name: string,
  rows: any[],
  dateColumn = false,
) {
  const values = rows.length
    ? rows.map((row) => ({
        ...row,
        ...(dateColumn && row.Transaction_Date
          ? { Transaction_Date: excelDate(row.Transaction_Date) }
          : {}),
      }))
    : [{ Status: "No data available" }];

  const worksheet = XLSX.utils.json_to_sheet(values, { cellDates: true });
  worksheet["!cols"] = Object.keys(values[0]).map((key) => ({
    wch: Math.min(42, Math.max(13, key.length + 3)),
  }));

  if (dateColumn && values.length) {
    const headers = Object.keys(values[0]);
    const index = headers.indexOf("Transaction_Date");
    if (index >= 0) {
      for (let row = 2; row <= values.length + 1; row += 1) {
        const address = XLSX.utils.encode_cell({ r: row - 1, c: index });
        if (worksheet[address]) worksheet[address].z = "dd/mmmm/yyyy";
      }
    }
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
}

function selectedAnalysis(result: Result, selectedView: string): Analysis {
  return selectedView === "all"
    ? result.analysis
    : result.analysis_by_plan?.[selectedView] || result.analysis;
}

function selectedKpis(result: Result, selectedView: string) {
  return selectedView === "all"
    ? result.kpis
    : result.kpis_by_plan?.[selectedView] || result.kpis;
}

function selectedInsights(result: Result, selectedView: string) {
  return selectedView === "all"
    ? result.insights
    : result.insights_by_plan?.[selectedView] || result.insights;
}

function selectedRows(result: Result, selectedView: string) {
  if (selectedView === "all") return result.cleaned_rows;
  return result.analysis_rows
    .filter((row) => row.Analysis_Plan === selectedView)
    .map((row) =>
      Object.fromEntries(
        result.meta.export_columns.map((column) => [column, row[column] ?? ""]),
      ),
    );
}

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 50);
}

export async function exportExcel(result: Result, selectedView = "all") {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const exportRows = selectedRows(result, selectedView);

  // Both modes export the same final, audit-ready cleaned dataset only.
  addSheet(XLSX, workbook, "Cleaned_Data", exportRows, true);
  const viewName = selectedView === "all" ? "Cleaned" : safeName(selectedView);
  XLSX.writeFile(
    workbook,
    `Insurance_${viewName}_Data_${new Date().toISOString().slice(0, 10)}.xlsx`,
    { cellDates: true },
  );
}

function native(data: Item[], metric: Metric, seriesKey = false) {
  if (!seriesKey) {
    return [
      {
        name: metricLabel[metric],
        labels: data.map((row) => row.label),
        values: data.map((row) => Number(row[metric] || 0)),
      },
    ];
  }

  const series = Array.from(
    new Set(data.map((row) => String(row.series || "Data"))),
  );
  const labels = Array.from(new Set(data.map((row) => row.label)));
  return series.map((name) => ({
    name,
    labels,
    values: labels.map((label) => {
      const row = data.find(
        (item) => item.label === label && item.series === name,
      );
      return row ? Number(row[metric] || 0) : null;
    }),
  }));
}

function short(value: unknown, limit = 24) {
  const text = String(value ?? "");
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

function strongest(data: Item[], metric: Metric) {
  return data.reduce<Item | null>(
    (best, row) =>
      !best || Number(row[metric] || 0) > Number(best[metric] || 0)
        ? row
        : best,
    null,
  );
}

function sourceTable(data: Item[], multiSeries = false, limit = 6) {
  const rows = data.slice(0, limit);
  const header = multiSeries
    ? ["Category", "Series", "Records", "Premium"]
    : ["Category", "Records", "Premium", "Avg. premium"];
  return [
    header,
    ...rows.map((row) =>
      multiSeries
        ? [
            short(row.label, 18),
            short(row.series || "Data", 15),
            Number(row.count || 0).toLocaleString("en-IN"),
            money(row.amount),
          ]
        : [
            short(row.label, 21),
            Number(row.count || 0).toLocaleString("en-IN"),
            money(row.amount),
            money(row.average),
          ],
    ),
  ];
}

export async function exportPowerPoint(result: Result, selectedView = "all") {
  const module: any = await import("pptxgenjs");
  const PptxGenJS = module.default || module;
  const pptx: any = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Insurance Business Insights Dashboard";

  const analysis = selectedAnalysis(result, selectedView);
  const kpis = selectedKpis(result, selectedView);
  const insights = selectedInsights(result, selectedView);
  const isComparison = result.meta.analysis_mode === "comparison";
  const viewName =
    selectedView === "all"
      ? isComparison
        ? "Combined Plan Comparison"
        : "Portfolio Analysis"
      : selectedView;
  const currentYear = String(kpis.current_year || "Current year");
  const previousYear = String(kpis.previous_year || "Previous year");

  pptx.title = `${result.meta.college_name || "College"} ${viewName} Insurance Analysis`;

  const C = {
    navy: "102033",
    dark: "071F27",
    teal: "0A6A61",
    mint: "DDF3EE",
    blue: "2576A8",
    orange: "E58B37",
    purple: "7E57C2",
    red: "C65B5B",
    gray: "667B8E",
    pale: "F2F6FA",
    white: "FFFFFF",
    line: "D7E1E8",
  };
  const chartColors = [C.teal, C.blue, C.orange, C.purple, C.red];
  let pageNumber = 0;

  const header = (slide: any, title: string, subtitle: string) => {
    pageNumber += 1;
    slide.background = { color: C.white };
    slide.addText(title, {
      x: 0.55,
      y: 0.28,
      w: 12.1,
      h: 0.58,
      fontSize: 32,
      bold: true,
      color: C.navy,
      margin: 0,
      breakLine: false,
      fit: "shrink",
    });
    slide.addText(subtitle, {
      x: 0.55,
      y: 0.91,
      w: 11.8,
      h: 0.32,
      fontSize: 16,
      color: C.gray,
      margin: 0,
      fit: "shrink",
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.55,
      y: 1.3,
      w: 12.1,
      h: 0,
      line: { color: C.line },
    });
    slide.addText(String(pageNumber), {
      x: 12.2,
      y: 7.05,
      w: 0.4,
      h: 0.2,
      align: "right",
      fontSize: 10,
      color: C.gray,
      margin: 0,
    });
  };

  const addChartSlide = ({
    title,
    subtitle,
    data,
    chartType,
    metric,
    multiSeries = false,
    takeaway,
  }: {
    title: string;
    subtitle: string;
    data: Item[];
    chartType: any;
    metric: Metric;
    multiSeries?: boolean;
    takeaway: string;
  }) => {
    if (!data?.length) return;
    const chartRows = data.slice(0, multiSeries ? 24 : 12);
    const slide = pptx.addSlide();
    header(slide, title, subtitle);

    slide.addChart(chartType, native(chartRows, metric, multiSeries), {
      x: 0.55,
      y: 1.52,
      w: 7.15,
      h: 5.15,
      showLegend: multiSeries,
      legendPos: "b",
      showTitle: false,
      showValue: false,
      showCatName: false,
      catAxisLabelFontSize: 12,
      valAxisLabelFontSize: 11,
      chartColors,
      showBorder: false,
      showGridLines: true,
      showPercent: false,
    });

    slide.addText("SOURCE DATA USED FOR THIS CHART", {
      x: 8.05,
      y: 1.53,
      w: 4.7,
      h: 0.25,
      fontSize: 16,
      bold: true,
      color: C.teal,
      margin: 0,
    });
    slide.addTable(sourceTable(chartRows, multiSeries), {
      x: 8.03,
      y: 1.88,
      w: 4.75,
      h: 3.25,
      fontFace: "Aptos",
      fontSize: 12,
      color: C.navy,
      border: { type: "solid", color: C.line, pt: 0.6 },
      fill: C.white,
      margin: 0.08,
      rowH: 0.42,
      bold: false,
      autoFit: false,
      colW: multiSeries
        ? [1, 1.45, 0.85, 1.45]
        : [1.65, 0.85, 1.2, 1.15],
    });
    slide.addText(takeaway, {
      x: 8.03,
      y: 5.35,
      w: 4.75,
      h: 1.15,
      fontSize: 16,
      bold: true,
      color: C.navy,
      fill: { color: C.mint },
      line: { color: "B9DED5", pt: 1 },
      margin: 0.18,
      valign: "mid",
      fit: "shrink",
    });
  };

  let slide = pptx.addSlide();
  slide.background = { color: C.dark };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.22,
    h: 7.5,
    line: { color: C.teal, transparency: 100 },
    fill: { color: C.teal },
  });
  slide.addText("Insurance Premium Performance Analysis", {
    x: 0.75,
    y: 1.35,
    w: 11.5,
    h: 1.25,
    fontSize: 50,
    bold: true,
    color: C.white,
    margin: 0,
    fit: "shrink",
  });
  slide.addText(
    `${result.meta.college_name || "College"} • ${viewName}`,
    {
      x: 0.78,
      y: 2.95,
      w: 10.8,
      h: 0.5,
      fontSize: 24,
      color: "B8D9D5",
      margin: 0,
    },
  );
  slide.addText(
    `${isComparison ? `${currentYear} performance compared with ${previousYear}` : `${currentYear} single-report business analysis`} • ${result.meta.files_processed || 0} source file(s) • ${Number(kpis.total_records || 0).toLocaleString("en-IN")} clean records`,
    {
      x: 0.78,
      y: 3.75,
      w: 11.2,
      h: 0.5,
      fontSize: 18,
      color: C.white,
      margin: 0,
    },
  );
  slide.addText(
    `Generated ${new Date(result.meta.processed_at).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })}`,
    {
      x: 0.78,
      y: 6.55,
      w: 4,
      h: 0.3,
      fontSize: 14,
      color: "9EB8BE",
      margin: 0,
    },
  );

  slide = pptx.addSlide();
  header(
    slide,
    "The portfolio at a glance",
    `${viewName}: scale, value and the closest decision-relevant finding`,
  );
  slide.addText(money(kpis.total_premium), {
    x: 0.65,
    y: 1.65,
    w: 5.7,
    h: 0.85,
    fontSize: 42,
    bold: true,
    color: C.teal,
    margin: 0,
  });
  slide.addText("TOTAL PREMIUM COLLECTED", {
    x: 0.65,
    y: 2.48,
    w: 5.7,
    h: 0.3,
    fontSize: 16,
    bold: true,
    color: C.gray,
    margin: 0,
  });
  [
    ["Clean enrolments", kpis.total_records],
    ["Average premium", money(kpis.average_premium)],
    ["Most selected cover", kpis.most_selected_sum_insured],
    ["Top batch", kpis.top_batch],
  ].forEach(([label, value], index) => {
    const x = 6.65 + (index % 2) * 3.05;
    const y = 1.6 + Math.floor(index / 2) * 1.45;
    slide.addText(String(value), {
      x,
      y,
      w: 2.7,
      h: 0.52,
      fontSize: 24,
      bold: true,
      color: C.navy,
      margin: 0,
      fit: "shrink",
    });
    slide.addText(String(label).toUpperCase(), {
      x,
      y: y + 0.58,
      w: 2.7,
      h: 0.25,
      fontSize: 13,
      bold: true,
      color: C.gray,
      margin: 0,
    });
  });
  slide.addText(
    insights[0] ||
      (isComparison
        ? "The uploaded years have been compared using the cleaned report records."
        : "This analysis uses only the cleaned uploaded report; no forecast or previous-year file was required."),
    {
      x: 0.65,
      y: 4.25,
      w: 12.05,
      h: 1.35,
      fontSize: 20,
      bold: true,
      color: C.navy,
      fill: { color: C.mint },
      line: { color: "B9DED5", pt: 1 },
      margin: 0.25,
      valign: "mid",
      fit: "shrink",
    },
  );
  slide.addText(
    "Premium equals transaction_amount. The conclusion is calculated only from cleaned uploaded records.",
    {
      x: 0.65,
      y: 6.15,
      w: 11.8,
      h: 0.35,
      fontSize: 16,
      color: C.gray,
      margin: 0,
    },
  );

  if (isComparison) {
    addChartSlide({
      title: `${currentYear} versus ${previousYear}`,
      subtitle: "Premium performance and enrolment volume for the latest two uploaded years",
      data: analysis.latest_vs_previous || [],
      chartType: pptx.ChartType.bar,
      metric: "amount",
      takeaway:
        insights.find((item) => item.startsWith("Premium collected")) ||
        "The uploaded reports are compared by premium and enrolment movement.",
    });
  }

  addChartSlide({
    title: "The strongest months explain the annual result",
    subtitle: "January–December premium performance for every uploaded year",
    data: analysis.month_by_year || [],
    chartType: pptx.ChartType.line,
    metric: "amount",
    multiSeries: true,
    takeaway:
      insights.find((item) => item.includes("strongest month")) ||
      "Monthly movement is calculated from transaction date and transaction amount.",
  });

  if (isComparison) {
    addChartSlide({
      title: "The observed trend points to the next three years",
      subtitle: `Directional annual forecast • ${result.meta.forecast_confidence || "Low"} confidence`,
      data: analysis.annual_forecast || [],
      chartType: pptx.ChartType.line,
      metric: "amount",
      multiSeries: true,
      takeaway:
        insights.find((item) => item.includes("directional forecast")) ||
        "Forecasts extend the cleaned historical trend and are planning estimates, not guaranteed outcomes.",
    });

    addChartSlide({
      title: "Monthly demand outlook",
      subtitle: "Last 12 observed months followed by the next 12 projected months",
      data: analysis.monthly_forecast || [],
      chartType: pptx.ChartType.line,
      metric: "amount",
      multiSeries: true,
      takeaway:
        "Monthly projections use the uploaded trend and seasonality when at least 12 historical months are available.",
    });
  }

  if (selectedView === "all") {
    addChartSlide({
      title: "One plan leads the college portfolio",
      subtitle: "Detected plan comparison by premium collected",
      data: result.analysis.plan_comparison || [],
      chartType: pptx.ChartType.bar,
      metric: "amount",
      takeaway:
        insights.find((item) => item.includes("leads premium collection")) ||
        "Plan comparison uses premium, enrolments, batch reach and cover participation.",
    });

    if (isComparison) {
      addChartSlide({
        title: "Plan leadership changes across years",
        subtitle: "Premium collected by detected plan and transaction year",
        data: result.analysis.plan_year_comparison || [],
        chartType: pptx.ChartType.bar,
        metric: "amount",
        multiSeries: true,
        takeaway:
          insights.find((item) => item.includes("suitability")) ||
          "Compare plan performance over time before selecting the best fit for the college.",
      });
    }
  }

  const chartSpecs: Array<{
    title: string;
    subtitle: string;
    key: string;
    chartType: any;
    metric: Metric;
    insightPattern?: string;
  }> = [
    {
      title: "Premium bands show the most effective price range",
      subtitle: "Enrolment volume and premium value by transaction-amount band",
      key: "premium_bands",
      chartType: pptx.ChartType.bar,
      metric: "count",
    },
    {
      title: "Age mix reveals the core member segment",
      subtitle: "Age-group participation and premium contribution",
      key: "age",
      chartType: pptx.ChartType.bar,
      metric: "count",
    },
    {
      title: "Geography reveals the strongest market",
      subtitle: "State-level enrolment and premium concentration",
      key: "state",
      chartType: pptx.ChartType.bar,
      metric: "count",
      insightPattern: "leading state",
    },
    {
      title: "Course mix shows where demand is concentrated",
      subtitle: "Course-wise enrolment and premium performance",
      key: "course",
      chartType: pptx.ChartType.bar,
      metric: "count",
    },
    {
      title: "Batch mix highlights the largest opportunity",
      subtitle: "Every nonblank passing year or batch in the selected analysis",
      key: "passing_year",
      chartType: pptx.ChartType.bar,
      metric: "count",
      insightPattern: "highest participation",
    },
    {
      title: "Cover preference anchors product design",
      subtitle: "Most-selected sum-insured levels and associated premium",
      key: "sum_insured",
      chartType: pptx.ChartType.bar,
      metric: "count",
      insightPattern: "most selected sum insured",
    },
    ...(!isComparison
      ? [
          {
            title: "One premium amount is paid most often",
            subtitle: "Exact premium values ranked by clean transaction frequency",
            key: "premium_amounts",
            chartType: pptx.ChartType.bar,
            metric: "count" as Metric,
            insightPattern: "premium amount paid most often",
          },
          {
            title: "The most selected insurer leads current demand",
            subtitle: "Insurer selection frequency and associated premium",
            key: "insurers",
            chartType: pptx.ChartType.bar,
            metric: "count" as Metric,
            insightPattern: "most frequently selected insurer",
          },
        ]
      : []),
  ];

  chartSpecs.forEach((spec) => {
    const data = analysis[spec.key] || [];
    const leader = strongest(data, spec.metric);
    const generatedTakeaway = leader
      ? `${leader.label} leads this analysis with ${Number(
          leader.count || 0,
        ).toLocaleString("en-IN")} enrolments and ${money(leader.amount)} premium.`
      : "This analysis was not available in the uploaded workbook.";
    addChartSlide({
      title: spec.title,
      subtitle: spec.subtitle,
      data,
      chartType: spec.chartType,
      metric: spec.metric,
      takeaway:
        (spec.insightPattern &&
          insights.find((item) =>
            item.toLowerCase().includes(spec.insightPattern!.toLowerCase()),
          )) ||
        generatedTakeaway,
    });
  });

  slide = pptx.addSlide();
  header(
    slide,
    "What management should take from the data",
    `Closest data-supported conclusions for ${viewName}; no external assumptions`,
  );
  (insights.length ? insights : ["No business findings were generated."])
    .slice(0, 6)
    .forEach((insight, index) => {
      const y = 1.55 + index * 0.83;
      slide.addText(String(index + 1).padStart(2, "0"), {
        x: 0.68,
        y,
        w: 0.55,
        h: 0.4,
        fontSize: 20,
        bold: true,
        color: C.teal,
        margin: 0,
      });
      slide.addText(insight, {
        x: 1.35,
        y: y - 0.05,
        w: 11.15,
        h: 0.65,
        fontSize: 16,
        color: C.navy,
        margin: 0,
        fit: "shrink",
      });
      slide.addShape(pptx.ShapeType.line, {
        x: 1.35,
        y: y + 0.63,
        w: 11.15,
        h: 0,
        line: { color: C.line, pt: 0.5 },
      });
    });

  slide = pptx.addSlide();
  header(
    slide,
    "Data quality and interpretation rules",
    "Use these controls when presenting or making a plan decision",
  );
  const qualityRows = [
    ["Rows received", result.data_quality.rows_before_cleaning],
    ["Invalid transaction dates removed", result.data_quality.invalid_dates_removed],
    ...(!isComparison
      ? [[
          "Blank or zero premiums removed",
          result.data_quality.blank_or_zero_premiums_removed || 0,
        ]]
      : []),
    ["Exact duplicates removed", result.data_quality.exact_duplicates_removed],
    [
      "Duplicate transaction IDs removed",
      result.data_quality.duplicate_transaction_ids_removed,
    ],
    [
      "Rows assigned to selected report years",
      result.data_quality.report_year_overrides_applied,
    ],
    [
      "Dates inferred from selected year",
      result.data_quality.dates_inferred_from_report_year,
    ],
    ["Final clean records", result.data_quality.final_rows],
  ];
  slide.addTable([["Quality check", "Result"], ...qualityRows], {
    x: 0.65,
    y: 1.62,
    w: 5.5,
    h: 3.7,
    fontFace: "Aptos",
    fontSize: 16,
    color: C.navy,
    border: { type: "solid", color: C.line, pt: 0.7 },
    fill: C.white,
    margin: 0.12,
    colW: [4.05, 1.45],
    rowH: 0.52,
  });
  slide.addText(
    [
      {
        text: "Premium definition\n",
        options: { bold: true, color: C.teal, breakLine: true },
      },
      {
        text: "transaction_amount is treated as premium.\n\n",
        options: { breakLine: true },
      },
      {
        text: "Policy rule\n",
        options: { bold: true, color: C.teal, breakLine: true },
      },
      {
        text: "Only New and Renewal values are included; unrelated values such as GMC are excluded.\n\n",
        options: { breakLine: true },
      },
      {
        text: "Decision rule\n",
        options: { bold: true, color: C.teal, breakLine: true },
      },
      {
        text: "Suitability scores compare observed premium, enrolment, batch reach and cover participation. Benefits, exclusions, claims service and price terms still require commercial review.",
        options: {},
      },
    ],
    {
      x: 6.65,
      y: 1.62,
      w: 5.95,
      h: 4.45,
      fontSize: 16,
      color: C.navy,
      fill: { color: C.pale },
      line: { color: C.line, pt: 1 },
      margin: 0.25,
      valign: "top",
      fit: "shrink",
    },
  );

  await pptx.writeFile({
    fileName: `Insurance_${safeName(viewName)}_${new Date().toISOString().slice(0, 10)}.pptx`,
  });
}
