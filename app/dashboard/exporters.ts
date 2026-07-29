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
  const analysis = selectedAnalysis(result, selectedView);
  const kpis = selectedKpis(result, selectedView);
  const insights = selectedInsights(result, selectedView);
  const exportRows = selectedRows(result, selectedView);
  const analysisRows =
    selectedView === "all"
      ? result.analysis_rows
      : result.analysis_rows.filter(
          (row) => row.Analysis_Plan === selectedView,
        );

  addSheet(
    XLSX,
    workbook,
    "Dashboard_Summary",
    Object.entries(kpis).map(([Metric, Value]) => ({ Metric, Value })),
  );
  addSheet(XLSX, workbook, "Export_Data", exportRows, true);
  addSheet(XLSX, workbook, "Analysis_Data", analysisRows, true);

  const commonSheets: [string, string][] = [
    ["Current_vs_Previous", "latest_vs_previous"],
    ["Yearly_Trend", "yearly_trend"],
    ["Month_By_Year", "month_by_year"],
    ["Monthly_Trend", "monthly_trend"],
    ["Daily_Trend", "daily_trend"],
    ["State_Analysis", "state"],
    ["City_Analysis", "city"],
    ["Pincode_Analysis", "pincode"],
    ["Passing_Year_Batch", "passing_year"],
    ["Course_Analysis", "course"],
    ["Sum_Insured", "sum_insured"],
    ["Premium_Bands", "premium_bands"],
    ["Nominee_Relationship", "nominee_relationship"],
    ["Insurance_Products", "insurance_products"],
    ["Insurers", "insurers"],
  ];

  commonSheets.forEach(([name, key]) =>
    addSheet(XLSX, workbook, name, analysis[key] || []),
  );

  if (selectedView === "all") {
    const comparisonSheets: [string, string][] = [
      ["Current_Previous_By_Plan", "latest_vs_previous_by_plan"],
      ["Plan_Comparison", "plan_comparison"],
      ["Plan_Recommendation", "plan_recommendation"],
      ["Plan_Year", "plan_year_comparison"],
      ["Plan_Month", "plan_month_comparison"],
      ["Plan_Sum_Insured", "plan_sum_insured"],
      ["Plan_Batch", "plan_batch_comparison"],
    ];
    comparisonSheets.forEach(([name, key]) =>
      addSheet(XLSX, workbook, name, result.analysis[key] || []),
    );
  }

  addSheet(
    XLSX,
    workbook,
    "Business_Insights",
    insights.map((Insight, index) => ({ No: index + 1, Insight })),
  );
  addSheet(
    XLSX,
    workbook,
    "Data_Quality",
    Object.entries(result.data_quality)
      .filter(([key]) => key !== "processing_log")
      .map(([Metric, Value]) => ({ Metric, Value })),
  );

  const viewName = selectedView === "all" ? "Combined" : safeName(selectedView);
  XLSX.writeFile(
    workbook,
    `Insurance_${viewName}_Analysis_${new Date().toISOString().slice(0, 10)}.xlsx`,
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
    values: labels.map((label) =>
      Number(
        data.find((row) => row.label === label && row.series === name)?.[
          metric
        ] || 0,
      ),
    ),
  }));
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
  const viewName = selectedView === "all" ? "Combined Plan Comparison" : selectedView;
  const currentYear = String(kpis.current_year || "Current year");
  const previousYear = String(kpis.previous_year || "Previous year");

  pptx.title = `${result.meta.college_name || "College"} ${viewName} Insurance Analysis`;

  const C = {
    navy: "102033",
    teal: "0A6A61",
    blue: "2576A8",
    orange: "E58B37",
    purple: "7E57C2",
    gray: "667B8E",
    pale: "F2F6FA",
    white: "FFFFFF",
    line: "D7E1E8",
  };

  const header = (slide: any, title: string, subtitle: string) => {
    slide.background = { color: C.white };
    slide.addText(title, {
      x: 0.55,
      y: 0.35,
      w: 9.5,
      h: 0.4,
      fontSize: 24,
      bold: true,
      color: C.navy,
      margin: 0,
    });
    slide.addText(subtitle, {
      x: 0.55,
      y: 0.83,
      w: 11.8,
      h: 0.28,
      fontSize: 10,
      color: C.gray,
      margin: 0,
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.55,
      y: 1.16,
      w: 12.1,
      h: 0,
      line: { color: C.line },
    });
  };

  let slide = pptx.addSlide();
  slide.background = { color: C.navy };
  slide.addText("Insurance Premium Performance Analysis", {
    x: 0.75,
    y: 1.25,
    w: 11.5,
    h: 0.8,
    fontSize: 34,
    bold: true,
    color: C.white,
    margin: 0,
  });
  slide.addText(
    `${result.meta.college_name || "College"} • ${viewName}`,
    {
      x: 0.78,
      y: 2.25,
      w: 10.8,
      h: 0.5,
      fontSize: 18,
      color: "B8D9D5",
      margin: 0,
    },
  );
  slide.addText(
    `Current period ${currentYear} compared with ${previousYear}. transaction_amount is treated as premium.`,
    {
      x: 0.78,
      y: 3,
      w: 10.5,
      h: 0.35,
      fontSize: 14,
      color: C.white,
      margin: 0,
    },
  );

  slide = pptx.addSlide();
  header(slide, "Executive summary", `${viewName} premium and enrolment overview`);
  const cards = [
    ["Clean records", kpis.total_records],
    ["Premium collected", money(kpis.total_premium)],
    ["Average premium", money(kpis.average_premium)],
    ["Current year", kpis.current_year],
    ["Previous year", kpis.previous_year],
    ["Most selected sum insured", kpis.most_selected_sum_insured],
  ];
  cards.forEach(([label, value], index) => {
    const x = 0.6 + (index % 3) * 4.15;
    const y = 1.5 + Math.floor(index / 3) * 1.45;
    slide.addText(String(label).toUpperCase(), {
      x,
      y,
      w: 3.8,
      h: 0.25,
      fontSize: 8,
      bold: true,
      color: C.gray,
      margin: 0,
    });
    slide.addText(String(value), {
      x,
      y: y + 0.28,
      w: 3.8,
      h: 0.72,
      fontSize: 18,
      bold: true,
      color: C.navy,
      fill: { color: C.pale },
      line: { color: C.line },
      margin: 0.12,
      valign: "mid",
    });
  });

  slide = pptx.addSlide();
  header(
    slide,
    `${currentYear} versus ${previousYear}`,
    "Premium, enrolment and month-by-month movement",
  );
  if (analysis.latest_vs_previous?.length) {
    slide.addChart(
      pptx.ChartType.column,
      native(analysis.latest_vs_previous, "amount"),
      {
        x: 0.55,
        y: 1.45,
        w: 5.9,
        h: 4.9,
        showLegend: false,
        showTitle: true,
        title: "Premium by year",
        chartColors: [C.teal],
      },
    );
  }
  if (analysis.month_by_year?.length) {
    slide.addChart(
      pptx.ChartType.line,
      native(analysis.month_by_year, "amount", true),
      {
        x: 6.75,
        y: 1.45,
        w: 5.9,
        h: 4.9,
        showLegend: true,
        showTitle: true,
        title: "Month-by-month premium comparison",
        chartColors: [C.teal, C.blue, C.orange, C.purple],
      },
    );
  }

  if (selectedView === "all") {
    slide = pptx.addSlide();
    header(
      slide,
      "Detected plan comparison",
      "Premium, enrolment, batch reach and sum-insured participation",
    );
    if (result.analysis.plan_comparison?.length) {
      slide.addChart(
        pptx.ChartType.bar,
        native(result.analysis.plan_comparison, "amount"),
        {
          x: 0.55,
          y: 1.45,
          w: 6,
          h: 4.9,
          showTitle: true,
          title: "Premium by detected plan",
          showLegend: false,
          chartColors: [C.blue],
        },
      );
    }
    const recommendations = (result.analysis.plan_recommendation || [])
      .slice(0, 3)
      .map((row, index) => ({
        text: `${index + 1}. ${row.label} — ${row.suitability_score}/100; ${row.count} enrolments; ${row.batch_count} batches; ${money(row.amount)} premium`,
        options: { breakLine: true },
      }));
    slide.addText(
      recommendations.length ? recommendations : "No plan comparison data available.",
      {
        x: 6.9,
        y: 1.65,
        w: 5.6,
        h: 3.8,
        fontSize: 16,
        color: C.navy,
        breakLine: true,
        margin: 0.15,
        valign: "top",
      },
    );

    slide = pptx.addSlide();
    header(
      slide,
      "Plan performance by year and month",
      "Identify which detected plan performed best in each period",
    );
    if (result.analysis.plan_year_comparison?.length) {
      slide.addChart(
        pptx.ChartType.column,
        native(result.analysis.plan_year_comparison, "amount", true),
        {
          x: 0.55,
          y: 1.45,
          w: 5.9,
          h: 4.9,
          showTitle: true,
          title: "Premium by plan and year",
          showLegend: true,
          chartColors: [C.teal, C.blue, C.orange],
        },
      );
    }
    if (result.analysis.plan_month_comparison?.length) {
      slide.addChart(
        pptx.ChartType.line,
        native(result.analysis.plan_month_comparison.slice(-36), "amount", true),
        {
          x: 6.75,
          y: 1.45,
          w: 5.9,
          h: 4.9,
          showTitle: true,
          title: "Monthly premium by plan",
          showLegend: true,
          chartColors: [C.teal, C.blue, C.orange],
        },
      );
    }
  } else {
    slide = pptx.addSlide();
    header(
      slide,
      `${selectedView} portfolio profile`,
      "Sum-insured preference and batch participation",
    );
    if (analysis.sum_insured?.length) {
      slide.addChart(
        pptx.ChartType.column,
        native(analysis.sum_insured, "count"),
        {
          x: 0.55,
          y: 1.45,
          w: 5.9,
          h: 4.9,
          showTitle: true,
          title: "Sum-insured enrolments",
          showLegend: false,
          chartColors: [C.teal],
        },
      );
    }
    if (analysis.passing_year?.length) {
      slide.addChart(
        pptx.ChartType.bar,
        native(analysis.passing_year, "count"),
        {
          x: 6.75,
          y: 1.45,
          w: 5.9,
          h: 4.9,
          showTitle: true,
          title: "Batch participation",
          showLegend: false,
          chartColors: [C.blue],
        },
      );
    }
  }

  slide = pptx.addSlide();
  header(
    slide,
    "Business findings",
    `Closest data-supported conclusions for ${viewName}`,
  );
  slide.addText(
    insights.map((insight, index) => ({
      text: `${index + 1}. ${insight}`,
      options: { breakLine: true },
    })),
    {
      x: 0.75,
      y: 1.5,
      w: 11.7,
      h: 4.9,
      fontSize: 16,
      color: C.navy,
      breakLine: true,
      margin: 0.15,
      valign: "top",
    },
  );

  await pptx.writeFile({
    fileName: `Insurance_${safeName(viewName)}_${new Date().toISOString().slice(0, 10)}.pptx`,
  });
}
