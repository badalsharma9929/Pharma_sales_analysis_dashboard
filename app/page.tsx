"use client";

import React, { useMemo, useState } from "react";
import "./dashboard.css";
import "./comparison.css";
import ChartPanel from "./dashboard/chart-panel";
import { exportExcel, exportPowerPoint } from "./dashboard/exporters";
import { displayDate, money, Result, UploadGroup } from "./dashboard/types";

export default function Home() {
  const [college, setCollege] = useState("");
  const [policyName, setPolicyName] = useState("");
  const [analysisMode, setAnalysisMode] = useState<"single" | "comparison">(
    "single",
  );
  const [resultMode, setResultMode] = useState<"single" | "comparison">(
    "single",
  );
  const [groups, setGroups] = useState<UploadGroup[]>(() => {
    const currentYear = new Date().getFullYear();
    return [
      { name: "Main report", year: String(currentYear), files: [] },
      {
        name: "Comparison report (optional)",
        year: String(currentYear - 1),
        files: [],
      },
      { name: "Additional history (optional)", year: "", files: [] },
    ];
  });
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [selectedView, setSelectedView] = useState("all");
  const [loading, setLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [pptLoading, setPptLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [policyFilter, setPolicyFilter] = useState("");

  const plans = result?.meta.plans || [];
  const viewAnalysis =
    selectedView === "all"
      ? result?.analysis
      : result?.analysis_by_plan?.[selectedView] || result?.analysis;
  const viewInsights =
    selectedView === "all"
      ? result?.insights || []
      : result?.insights_by_plan?.[selectedView] || result?.insights || [];
  const viewKpis =
    selectedView === "all"
      ? result?.kpis
      : result?.kpis_by_plan?.[selectedView] || result?.kpis;
  const comparisonSummary = viewAnalysis?.comparison_summary || [];
  const forecastSummary = viewAnalysis?.forecast_summary || [];

  const sourceRows = useMemo(() => {
    if (!result) return [];
    if (selectedView === "all") return result.cleaned_rows;
    return result.analysis_rows
      .filter((row) => row.Analysis_Plan === selectedView)
      .map((row) =>
        Object.fromEntries(
          result.meta.export_columns.map((column) => [column, row[column] ?? ""]),
        ),
      );
  }, [result, selectedView]);

  const filtered = useMemo(() => {
    if (!result) return [];
    const query = search.trim().toLowerCase();
    return sourceRows.filter(
      (row) =>
        (!policyFilter || row["Policy (New/Renewal)"] === policyFilter) &&
        (!query ||
          Object.values(row).some((value) =>
            String(value ?? "")
              .toLowerCase()
              .includes(query),
          )),
    );
  }, [result, sourceRows, search, policyFilter]);

  const updateGroup = (index: number, patch: Partial<UploadGroup>) =>
    setGroups((current) =>
      current.map((group, groupIndex) =>
        groupIndex === index ? { ...group, ...patch } : group,
      ),
    );

  async function analyze() {
    const requestedMode = analysisMode;
    const selectedGroups = requestedMode === "single" ? groups.slice(0, 1) : groups;
    const flattened = selectedGroups.flatMap((group) =>
      group.files.map((file) => ({
        file,
        label:
          policyName.trim() ||
          (requestedMode === "comparison"
            ? "Same Uploaded Policy"
            : "Unspecified Plan"),
        year: group.year.trim(),
      })),
    );
    const uploadedGroups = selectedGroups.filter((group) => group.files.length);
    if (!groups[0].files.length) {
      setError(
        requestedMode === "comparison"
          ? "Upload the main report to compare and forecast."
          : "Upload the main report to analyse.",
      );
      return;
    }
    if (requestedMode === "comparison" && !groups[1].files.length) {
      setError("Upload the optional comparison report or switch to Single Report Analysis.");
      return;
    }
    if (
      uploadedGroups.some(
        (group) => !/^(?:19|20)\d{2}$/.test(group.year.trim()),
      )
    ) {
      setError("Enter a valid four-digit report year for every uploaded report.");
      return;
    }
    if (
      requestedMode === "comparison" &&
      new Set(uploadedGroups.map((group) => group.year.trim())).size < 2
    ) {
      setError("The two reports must use different comparison years.");
      return;
    }

    setLoading(true);
    setProcessingStatus("");
    setError("");
    setResult(null);
    setSelectedView("all");

    try {
      const preparedTokens: Blob[] = [];
      for (let index = 0; index < flattened.length; index += 1) {
        const { file, label, year } = flattened[index];
        setProcessingStatus(
          `Preparing report ${index + 1} of ${flattened.length}: ${file.name}`,
        );

        const form = new FormData();
        form.append("files", file);
        form.append("file_labels", JSON.stringify([label]));
        form.append("file_years", JSON.stringify([year]));
        form.append("college_name", college);
        form.append("password", password);

        const preparedResponse = await fetch("/api/prepare", {
          method: "POST",
          body: form,
        });
        if (!preparedResponse.ok) {
          const preparedText = await preparedResponse.text();
          let detail = "";
          try {
            detail = preparedText ? JSON.parse(preparedText).detail : "";
          } catch {
            detail = "";
          }
          throw new Error(
            detail ||
              (preparedResponse.status === 413
                ? `${file.name} is too large for one upload. Split it into two files for report year ${year}, then select both files in the same year slot.`
                : `Unable to prepare ${file.name} (${preparedResponse.status}).`),
          );
        }
        preparedTokens.push(await preparedResponse.blob());
      }

      setProcessingStatus(
        requestedMode === "comparison"
          ? "Combining reports, calculating comparisons and forecasting…"
          : "Cleaning the report and calculating business trends…",
      );
      const combinedForm = new FormData();
      preparedTokens.forEach((token, index) =>
        combinedForm.append("tokens", token, `prepared-report-${index + 1}.bin`),
      );
      combinedForm.append("college_name", college);
      combinedForm.append("file_count", String(flattened.length));
      combinedForm.append("analysis_mode", requestedMode);
      const response = await fetch("/api/combine", {
        method: "POST",
        body: combinedForm,
      });
      const responseText = await response.text();
      let data: any = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(
          response.ok
            ? "The server returned an unreadable response."
            : `Processing failed (${response.status}). Please try again.`,
        );
      }
      if (!response.ok) {
        throw new Error(
          data.detail ||
            (response.status === 413
              ? requestedMode === "comparison"
                ? "The prepared comparison is still too large. Split the larger workbook into two files for the same report year and select both parts together."
                : "The prepared report is still too large. Split the workbook into smaller files for the same report year and select them together."
              : `Unable to process workbook (${response.status}). Please verify the file and password.`),
        );
      }
      setResultMode(requestedMode);
      setResult({
        ...data,
        meta: { ...data.meta, analysis_mode: requestedMode },
      });
    } catch (exception: any) {
      setError(exception.message || "Processing failed.");
    } finally {
      setLoading(false);
      setProcessingStatus("");
    }
  }

  function exportCsv() {
    if (!result || !sourceRows.length) return;
    const columns = result.meta.export_columns;
    const escape = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      columns.map(escape).join(","),
      ...sourceRows.map((row) =>
        columns
          .map((column) =>
            escape(
              column === "Transaction_Date"
                ? displayDate(row[column])
                : row[column],
            ),
          )
          .join(","),
      ),
    ].join("\n");
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    anchor.download = `${selectedView === "all" ? "Combined" : selectedView}_Insurance_Data.csv`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  async function makePpt() {
    if (!result) return;
    setPptLoading(true);
    setError("");
    try {
      await exportPowerPoint(result, selectedView);
    } catch (exception: any) {
      setError(exception.message || "PowerPoint export failed.");
    } finally {
      setPptLoading(false);
    }
  }

  const isComparisonResult = resultMode === "comparison";
  const viewLabel =
    selectedView === "all"
      ? isComparisonResult
        ? "Combined comparison"
        : "Portfolio analysis"
      : selectedView;
  const currentYear = String(viewKpis?.current_year || "Current year");
  const previousYear = String(viewKpis?.previous_year || "Previous year");

  return (
    <main>
      <header className="hero">
        <div>
          <span className="eyebrow">SINGLE REPORT OR OPTIONAL COMPARISON</span>
          <h1>College Policy Analysis & Comparison Dashboard</h1>
          <p>
            Upload one report for complete cleaned-data analysis and business trends.
            When you need a year-on-year comparison and future forecast, switch modes
            and add a second report for the same college and policy.
          </p>
        </div>
        <div className="privacy">🔒 Files are processed only for this request</div>
      </header>

      <section className="setupCard">
        <div className="modeSelector" role="group" aria-label="Analysis type">
          <button
            type="button"
            className={analysisMode === "single" ? "active" : ""}
            onClick={() => {
              setAnalysisMode("single");
              setError("");
            }}
          >
            <b>Single Report Analysis</b>
            <span>One file • full business trends • cleaned Excel</span>
          </button>
          <button
            type="button"
            className={analysisMode === "comparison" ? "active" : ""}
            onClick={() => {
              setAnalysisMode("comparison");
              setError("");
            }}
          >
            <b>Compare Two Reports</b>
            <span>Optional mode • year-on-year comparison • forecast</span>
          </button>
        </div>

        <div className="setupFields">
          <div className="collegeInput">
            <label>College / Institute name</label>
            <input
              value={college}
              onChange={(event) => setCollege(event.target.value)}
              placeholder="Example: IIM"
            />
          </div>
          <div className="collegeInput">
            <label>
              {analysisMode === "comparison"
                ? "Same policy / plan name"
                : "Policy / plan name (optional)"}
            </label>
            <input
              value={policyName}
              onChange={(event) => setPolicyName(event.target.value)}
              placeholder="Example: IIM Policy"
            />
          </div>
          <div className="password">
            <label>Excel password (only if protected)</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="planUploads">
          {(analysisMode === "single" ? groups.slice(0, 1) : groups).map(
            (group, index) => (
            <article className="planUpload" key={index}>
              <div className="dataSetTitle">
                <strong>{group.name}</strong>
                <span>
                  {analysisMode === "single"
                    ? "Required for cleaned analysis and business trends"
                    : index < 2
                      ? "Required only in comparison mode"
                      : "Add an older year to improve forecast confidence"}
                </span>
              </div>
              <label className="yearField" htmlFor={`year-${index}`}>
                Report year
                <input
                  id={`year-${index}`}
                  inputMode="numeric"
                  maxLength={4}
                  value={group.year}
                  onChange={(event) =>
                    updateGroup(index, {
                      year: event.target.value.replace(/\D/g, "").slice(0, 4),
                    })
                  }
                  placeholder="YYYY"
                />
              </label>
              <input
                id={`files-${index}`}
                type="file"
                multiple
                accept=".xlsx,.xlsm,.xls,.csv"
                onChange={(event) =>
                  updateGroup(index, {
                    files: Array.from(event.target.files || []),
                  })
                }
              />
              <label className="fileDrop" htmlFor={`files-${index}`}>
                <b>{group.files.length ? "Report selected" : "Choose report file"}</b>
                <span>
                  {group.files.length
                    ? `${group.files.length} file(s): ${group.files
                        .map((file) => file.name)
                        .join(", ")}`
                    : "Excel or CSV • multiple files for this year are allowed"}
                </span>
              </label>
            </article>
            ),
          )}
        </div>

        <div className="comparisonRule">
          {analysisMode === "comparison" ? (
            <>
              <b>Comparison mode:</b> the first two uploads are treated as the same
              policy. Their selected report years drive the comparison, while
              transaction dates support monthly analysis.
            </>
          ) : (
            <>
              <b>Single-report mode:</b> no previous-year report is required. The
              dashboard removes duplicates and blank or zero transaction data, then
              analyses all available business trends. Forecasting is not used.
            </>
          )}
        </div>

        <button
          className="primary generate"
          onClick={analyze}
          disabled={loading}
        >
          {loading
            ? analysisMode === "comparison"
              ? "Comparing reports & forecasting…"
              : "Cleaning & analysing report…"
            : analysisMode === "comparison"
              ? "Compare Reports & Forecast"
              : "Analyse Single Report"}
        </button>
        {loading && processingStatus && (
          <div className="processingStatus" role="status">
            {processingStatus}
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </section>

      {result && viewAnalysis && viewKpis && (
        <>
          <div className="toolbar">
            <div>
              <b>
                {viewKpis.total_records} clean records • {viewKpis.years_compared}{" "}
                years • {plans.length} detected plan(s)
              </b>
              <span>
                Viewing {viewLabel} • Processed{" "}
                {new Date(result.meta.processed_at).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="toolbarActions">
              <button onClick={exportCsv}>Export CSV</button>
              <button onClick={makePpt} disabled={pptLoading}>
                {pptLoading ? "Creating PPT…" : "Export Presentable PPT"}
              </button>
              <button
                className="primary small"
                onClick={() => exportExcel(result, selectedView)}
              >
                {isComparisonResult
                  ? "Export Complete Excel"
                  : "Export Cleaned Excel"}
              </button>
            </div>
          </div>

          <section className="viewSwitcher">
            <div>
              <span className="eyebrow">ANALYSIS VIEW</span>
              <h2>
                {isComparisonResult
                  ? "Switch between individual plans and combined comparison"
                  : "Switch between the full portfolio and individual plans"}
              </h2>
            </div>
            <div className="viewButtons">
              <button
                className={selectedView === "all" ? "active" : ""}
                onClick={() => setSelectedView("all")}
              >
                {isComparisonResult ? "Combined comparison" : "All plans"}
              </button>
              {plans.map((plan) => (
                <button
                  key={plan}
                  className={selectedView === plan ? "active" : ""}
                  onClick={() => setSelectedView(plan)}
                >
                  {plan}
                </button>
              ))}
            </div>
          </section>

          <section className="kpis">
            {[
              ["Clean records", viewKpis.total_records],
              ["Premium collected", money(viewKpis.total_premium)],
              ["Average premium", money(viewKpis.average_premium)],
              [isComparisonResult ? "Current year" : "Report year", viewKpis.current_year],
              ...(isComparisonResult
                ? [["Previous year", viewKpis.previous_year]]
                : [
                    ["Most common premium", viewKpis.most_common_premium],
                    ["Most selected insurer", viewKpis.most_selected_insurer],
                  ]),
              ["Most selected sum insured", viewKpis.most_selected_sum_insured],
              ["Top batch", viewKpis.top_batch],
            ].map(([label, value]) => (
              <article key={String(label)}>
                <span>{label}</span>
                <strong>{String(value)}</strong>
              </article>
            ))}
          </section>

          <section className="insights">
            <div>
              <span className="eyebrow">CLOSEST DATA FINDINGS</span>
              <h2>{viewLabel}: what the data is saying</h2>
            </div>
            <ol>
              {viewInsights.map((insight, index) => (
                <li key={index}>{insight}</li>
              ))}
            </ol>
          </section>

          {selectedView === "all" && plans.length > 1 &&
            !!result.analysis.plan_recommendation?.length && (
              <section className="recommendations">
                <div>
                  <span className="eyebrow">PLAN SUITABILITY</span>
                  <h2>Which plan appears most suitable</h2>
                  <p>
                    The score compares premium collection, enrolments, batch reach
                    and sum-insured participation. Policy benefits, exclusions and
                    claim service should still be reviewed separately.
                  </p>
                </div>
                <div className="recommendationGrid">
                  {result.analysis.plan_recommendation.map((row, index) => (
                    <article
                      key={row.label}
                      className={index === 0 ? "best" : ""}
                    >
                      <span>Rank {index + 1}</span>
                      <strong>{row.label}</strong>
                      <b>{row.suitability_score}/100</b>
                      <small>
                        {row.count} enrolments • {row.batch_count} batches •{" "}
                        {money(row.amount)} premium
                      </small>
                    </article>
                  ))}
                </div>
              </section>
            )}

          {isComparisonResult && (
            <section className="sectionTitle">
              <span className="eyebrow">CURRENT VS PREVIOUS YEAR</span>
              <h2>
                {viewLabel}: {currentYear} analysis versus {previousYear}
              </h2>
            </section>
          )}

          {isComparisonResult && !!comparisonSummary.length && (
            <section className="comparisonTable">
              <div className="comparisonHeading">
                <div>
                  <span className="eyebrow">EXACT CHANGE</span>
                  <h3>{previousYear} → {currentYear} comparison</h3>
                </div>
                <span>Positive values indicate growth; negative values indicate decline.</span>
              </div>
              <div className="tableWrap comparisonWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>{previousYear}</th>
                      <th>{currentYear}</th>
                      <th>Absolute change</th>
                      <th>% change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonSummary.map((row) => {
                      const format = (value: unknown) =>
                        row.format === "currency"
                          ? money(value)
                          : Number(value || 0).toLocaleString("en-IN");
                      const percentage = row.percentage_change;
                      return (
                        <tr key={row.label}>
                          <td><b>{row.label}</b></td>
                          <td>{format(row.previous)}</td>
                          <td>{format(row.current)}</td>
                          <td className={Number(row.change) >= 0 ? "positive" : "negative"}>
                            {Number(row.change) > 0 ? "+" : ""}{format(row.change)}
                          </td>
                          <td className={Number(percentage) >= 0 ? "positive" : "negative"}>
                            {percentage === null || percentage === undefined
                              ? "Not comparable"
                              : `${Number(percentage) > 0 ? "+" : ""}${Number(percentage).toFixed(1)}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="gridCharts">
            {isComparisonResult && (
              <>
                <ChartPanel
                  title={`${currentYear} vs ${previousYear}`}
                  subtitle="Switch between premium, enrolments and average premium"
                  data={viewAnalysis.latest_vs_previous || []}
                  initialType="bar"
                  initialMetric="amount"
                  chronological
                />
                <ChartPanel
                  title="Month-by-year comparison"
                  subtitle="January–December performance for every uploaded year"
                  data={viewAnalysis.month_by_year || []}
                  initialType="line"
                  initialMetric="amount"
                  multiSeries
                />
              </>
            )}
            <ChartPanel
              title="Full year-wise trend"
              subtitle="Premium and enrolment movement across all uploaded years"
              data={viewAnalysis.yearly_trend || []}
              initialType="line"
              initialMetric="amount"
              chronological
            />
            <ChartPanel
              title="Monthly premium movement"
              subtitle="Month-by-month movement across the full uploaded period"
              data={viewAnalysis.monthly_trend || []}
              initialType="line"
              initialMetric="amount"
              chronological
            />
            {isComparisonResult && !!viewAnalysis.policy_year_comparison?.length && (
              <ChartPanel
                title="New vs Renewal by report year"
                subtitle={`Policy mix in ${previousYear} compared with ${currentYear}`}
                data={viewAnalysis.policy_year_comparison}
                initialType="bar"
                initialMetric="count"
                multiSeries
              />
            )}
            {isComparisonResult && !!viewAnalysis.course_year_comparison?.length && (
              <ChartPanel
                title="Course mix by report year"
                subtitle={`Course-level participation in ${previousYear} and ${currentYear}`}
                data={viewAnalysis.course_year_comparison}
                initialType="bar"
                initialMetric="count"
                multiSeries
              />
            )}
            {isComparisonResult && !!viewAnalysis.passing_year_comparison?.length && (
              <ChartPanel
                title="Batch mix by report year"
                subtitle={`Batch participation movement from ${previousYear} to ${currentYear}`}
                data={viewAnalysis.passing_year_comparison}
                initialType="bar"
                initialMetric="count"
                multiSeries
              />
            )}
            {isComparisonResult && !!viewAnalysis.sum_insured_year_comparison?.length && (
              <ChartPanel
                title="Sum insured by report year"
                subtitle={`Cover preference in ${previousYear} and ${currentYear}`}
                data={viewAnalysis.sum_insured_year_comparison}
                initialType="bar"
                initialMetric="count"
                multiSeries
              />
            )}

            {selectedView === "all" && plans.length > 1 && (
              <>
                {isComparisonResult && (
                  <ChartPanel
                    title="Current vs previous year by plan"
                    subtitle="Compare each detected plan in the latest two years"
                    data={result.analysis.latest_vs_previous_by_plan || []}
                    initialType="bar"
                    initialMetric="amount"
                    multiSeries
                  />
                )}
                <ChartPanel
                  title="Overall plan comparison"
                  subtitle="Premium, enrolments, members, batches and cover participation"
                  data={result.analysis.plan_comparison || []}
                  initialType="bar"
                  initialMetric="amount"
                />
                {isComparisonResult && (
                  <ChartPanel
                    title="Plan performance by year"
                    subtitle="See which detected plan led in each transaction year"
                    data={result.analysis.plan_year_comparison || []}
                    initialType="bar"
                    initialMetric="amount"
                    multiSeries
                  />
                )}
                <ChartPanel
                  title="Monthly premium by plan"
                  subtitle="Track each plan across all uploaded months and years"
                  data={result.analysis.plan_month_comparison || []}
                  initialType="line"
                  initialMetric="amount"
                  multiSeries
                  chronological
                />
                <ChartPanel
                  title="Sum-insured enrolments by plan"
                  subtitle="Which plan enrolled the most members at each cover level"
                  data={result.analysis.plan_sum_insured || []}
                  initialType="bar"
                  initialMetric="count"
                  multiSeries
                />
                <ChartPanel
                  title="Batch-wise plan comparison"
                  subtitle="Compare every nonblank batch across detected plans"
                  data={result.analysis.plan_batch_comparison || []}
                  initialType="bar"
                  initialMetric="count"
                  multiSeries
                />
                <ChartPanel
                  title="Plan suitability score"
                  subtitle="College-level decision-support score"
                  data={result.analysis.plan_recommendation || []}
                  initialType="bar"
                  initialMetric="suitability_score"
                />
              </>
            )}
          </section>

          {isComparisonResult && !!forecastSummary.length && (
            <>
              <section className="sectionTitle forecastTitle">
                <span className="eyebrow">FUTURE FORECAST</span>
                <h2>{viewLabel}: next 3 years and next 12 months</h2>
                <p>
                  {isComparisonResult
                    ? "Forecasts extend the cleaned historical trend. With only two report years, confidence is intentionally shown as low and the result should be used for planning—not as a guaranteed outcome."
                    : "Forecasts use the history available inside this report. With only one annual data point, the annual result is a baseline directional estimate; monthly projections use the available month-by-month pattern. Use the result for planning, not as a guarantee."}
                </p>
              </section>

              <section className="forecastKpis">
                <article>
                  <span>Next forecast year</span>
                  <strong>{viewKpis.forecast_year}</strong>
                </article>
                <article>
                  <span>Forecast premium</span>
                  <strong>{money(viewKpis.forecast_premium)}</strong>
                </article>
                <article>
                  <span>Forecast enrolments</span>
                  <strong>{Number(viewKpis.forecast_enrolments || 0).toLocaleString("en-IN")}</strong>
                </article>
                <article>
                  <span>Forecast confidence</span>
                  <strong className={`confidence ${String(viewKpis.forecast_confidence).toLowerCase()}`}>
                    {String(viewKpis.forecast_confidence)}
                  </strong>
                </article>
              </section>

              <section className="gridCharts">
                <ChartPanel
                  title="Annual actual vs forecast"
                  subtitle="Three-year directional projection based only on uploaded history"
                  data={viewAnalysis.annual_forecast || []}
                  initialType="line"
                  initialMetric="amount"
                  multiSeries
                  chronological
                />
                <ChartPanel
                  title="Monthly actual vs forecast"
                  subtitle="Last 12 observed months and next 12 projected months"
                  data={viewAnalysis.monthly_forecast || []}
                  initialType="line"
                  initialMetric="amount"
                  multiSeries
                  chronological
                />
              </section>

              <section className="comparisonTable forecastTable">
                <div className="comparisonHeading">
                  <div>
                    <span className="eyebrow">PLANNING RANGE</span>
                    <h3>Three-year forecast table</h3>
                  </div>
                  <span>{result.meta.forecast_method} • {result.meta.forecast_confidence} confidence</span>
                </div>
                <div className="tableWrap comparisonWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Forecast year</th>
                        <th>Premium</th>
                        <th>Likely range</th>
                        <th>Enrolments</th>
                        <th>Growth vs prior year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecastSummary.map((row) => (
                        <tr key={row.label}>
                          <td><b>{row.label}</b></td>
                          <td>{money(row.amount)}</td>
                          <td>{money(row.amount_low)} – {money(row.amount_high)}</td>
                          <td>{Number(row.count || 0).toLocaleString("en-IN")}</td>
                          <td className={Number(row.growth_rate) >= 0 ? "positive" : "negative"}>
                            {row.growth_rate === null || row.growth_rate === undefined
                              ? "Not comparable"
                              : `${Number(row.growth_rate) > 0 ? "+" : ""}${Number(row.growth_rate).toFixed(1)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          <section className="sectionTitle">
            <span className="eyebrow">PORTFOLIO ANALYSIS</span>
            <h2>{viewLabel}: detailed business trends</h2>
          </section>

          <section className="gridCharts">
            {[
              [
                "Transaction date trend",
                "Transaction date versus premium amount",
                "daily_trend",
                "line",
                "amount",
                false,
                true,
              ],
              [
                "Passing year / batch analysis",
                "All nonblank batches in this view",
                "passing_year",
                "bar",
                "count",
                false,
                false,
              ],
              [
                "Age analysis",
                "Age-group enrolments and premium contribution",
                "age",
                "bar",
                "count",
                false,
                false,
              ],
              [
                "State analysis",
                "Premium and enrolment performance by state",
                "state",
                "bar",
                "count",
                false,
                false,
              ],
              [
                "City analysis",
                "Premium and enrolment performance by city",
                "city",
                "bar",
                "count",
                false,
                false,
              ],
              [
                "Pincode analysis",
                "Local premium concentration by pincode",
                "pincode",
                "bar",
                "count",
                false,
                false,
              ],
              [
                "Course analysis",
                "Course-wise enrolment and premium value",
                "course",
                "bar",
                "count",
                false,
                false,
              ],
              [
                "Nominee relationship",
                "Nominee composition from available data",
                "nominee_relationship",
                "pie",
                "count",
                false,
                false,
              ],
              [
                "Most selected sum insured",
                "Insurance cover chosen most frequently",
                "sum_insured",
                "bar",
                "count",
                false,
                false,
              ],
              [
                "Premium-band effectiveness",
                "Premium ranges by enrolment count and value",
                "premium_bands",
                "bar",
                "count",
                false,
                false,
              ],
              [
                "Insurance products",
                "Products or policy types taken most often",
                "insurance_products",
                "bar",
                "count",
                false,
                false,
              ],
              [
                "Insurer analysis",
                isComparisonResult
                  ? "Premium contribution by insurer"
                  : "Which insurance company was selected most often and its premium value",
                "insurers",
                "bar",
                "count",
                false,
                false,
              ],
              ...(!isComparisonResult
                ? [
                    [
                      "Most frequently paid premium",
                      "Exact transaction_amount values ranked by number of clean transactions",
                      "premium_amounts",
                      "bar",
                      "count",
                      false,
                      false,
                    ],
                    [
                      "Gender analysis",
                      "Available gender-wise enrolments and premium contribution",
                      "gender",
                      "bar",
                      "count",
                      false,
                      false,
                    ],
                    [
                      "Country analysis",
                      "Available country-wise enrolments and premium contribution",
                      "country",
                      "bar",
                      "count",
                      false,
                      false,
                    ],
                    [
                      "Payment mode analysis",
                      "Available payment methods ranked by usage",
                      "payment_modes",
                      "pie",
                      "count",
                      false,
                      false,
                    ],
                  ]
                : []),
            ].map(([title, subtitle, key, type, metric, multi, chrono]) => (
              <ChartPanel
                key={String(key)}
                title={String(title)}
                subtitle={String(subtitle)}
                data={viewAnalysis[String(key)] || []}
                initialType={type as any}
                initialMetric={metric as any}
                multiSeries={Boolean(multi)}
                chronological={Boolean(chrono)}
              />
            ))}
            {result.meta.policy_included && (
              <ChartPanel
                title="New versus Renewal"
                subtitle="Only valid New and Renewal values are included"
                data={viewAnalysis.policy || []}
                initialType="pie"
                initialMetric="count"
              />
            )}
          </section>

          <section className="dataPanel">
            <div className="dataHead">
              <div>
                <h2>{viewLabel}: cleaned export data</h2>
                <p>
                  {isComparisonResult
                    ? "Transaction amount is treated as premium. Dates use DD/Month Name/YYYY. Excel keeps source row order without date, premium or alphabetical sorting."
                    : "The Excel contains only your requested columns. Duplicate rows, duplicate transaction IDs, blank or zero dates, and blank or zero premiums are removed. Contact numbers are standardised without country codes."}
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
                            : column === "Transaction_Date"
                              ? displayDate(row[column])
                              : String(row[column] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="tableFoot">
              Showing {Math.min(filtered.length, 500)} of {filtered.length} filtered
              records. The Excel export contains all records for the selected view in
              original source order.
            </div>
          </section>

          <section className="quality">
            <h2>Data cleaning summary</h2>
            <div>
              {[
                ["Rows received", result.data_quality.rows_before_cleaning],
                ["Invalid dates removed", result.data_quality.invalid_dates_removed],
                ...(!isComparisonResult
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
                  "Dates inferred from report year",
                  result.data_quality.dates_inferred_from_report_year,
                ],
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
    </main>
  );
}
