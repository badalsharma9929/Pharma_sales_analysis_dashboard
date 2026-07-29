"use client";

import React, { useMemo, useState } from "react";
import "./dashboard.css";
import ChartPanel from "./dashboard/chart-panel";
import { exportExcel, exportPowerPoint } from "./dashboard/exporters";
import { displayDate, money, Result, UploadGroup } from "./dashboard/types";

export default function Home() {
  const [college, setCollege] = useState("");
  const [groups, setGroups] = useState<UploadGroup[]>([
    { name: "Data Set 1", files: [] },
    { name: "Data Set 2", files: [] },
    { name: "Data Set 3", files: [] },
  ]);
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [selectedView, setSelectedView] = useState("all");
  const [loading, setLoading] = useState(false);
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
    const flattened = groups.flatMap((group) =>
      group.files.map((file) => ({ file, label: group.name })),
    );
    if (!flattened.length) {
      setError("Upload at least one Excel file.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setSelectedView("all");

    try {
      const form = new FormData();
      flattened.forEach(({ file }) => form.append("files", file));
      form.append(
        "file_labels",
        JSON.stringify(flattened.map(({ label }) => label)),
      );
      form.append("college_name", college);
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

  const viewLabel = selectedView === "all" ? "Combined comparison" : selectedView;
  const currentYear = String(viewKpis?.current_year || "Current year");
  const previousYear = String(viewKpis?.previous_year || "Previous year");

  return (
    <main>
      <header className="hero">
        <div>
          <span className="eyebrow">MULTI-YEAR • MULTI-PLAN EXCEL ANALYTICS</span>
          <h1>Insurance Business Insights Dashboard</h1>
          <p>
            Upload current and previous-year files for up to three plan data sets.
            Plan names are detected automatically from the <b>plan_name</b> column,
            and transaction_amount is treated as the premium amount.
          </p>
        </div>
        <div className="privacy">🔒 Files are processed only for this request</div>
      </header>

      <section className="setupCard">
        <div className="collegeInput">
          <label>College / Institute name</label>
          <input
            value={college}
            onChange={(event) => setCollege(event.target.value)}
            placeholder="Enter college name"
          />
        </div>
        <div className="password">
          <label>Common Excel password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter the common password"
          />
        </div>

        <div className="planUploads">
          {groups.map((group, index) => (
            <article className="planUpload" key={index}>
              <div className="dataSetTitle">
                <strong>Data set {index + 1}</strong>
                <span>Plan name will be read from plan_name</span>
              </div>
              <input
                id={`files-${index}`}
                type="file"
                multiple
                accept=".xlsx,.xlsm,.xls"
                onChange={(event) =>
                  updateGroup(index, {
                    files: Array.from(event.target.files || []),
                  })
                }
              />
              <label htmlFor={`files-${index}`}>
                <b>Upload current and previous-year files</b>
                <span>
                  {group.files.length
                    ? `${group.files.length} file(s): ${group.files
                        .map((file) => file.name)
                        .join(", ")}`
                    : "Multiple years and multiple files are supported"}
                </span>
              </label>
            </article>
          ))}
        </div>

        <button
          className="primary generate"
          onClick={analyze}
          disabled={loading}
        >
          {loading ? "Analysing…" : "Generate College Comparison"}
        </button>
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
                Export Complete Excel
              </button>
            </div>
          </div>

          <section className="viewSwitcher">
            <div>
              <span className="eyebrow">ANALYSIS VIEW</span>
              <h2>Switch between individual plans and combined comparison</h2>
            </div>
            <div className="viewButtons">
              <button
                className={selectedView === "all" ? "active" : ""}
                onClick={() => setSelectedView("all")}
              >
                Combined comparison
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
              ["Current year", viewKpis.current_year],
              ["Previous year", viewKpis.previous_year],
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

          {selectedView === "all" &&
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

          <section className="sectionTitle">
            <span className="eyebrow">CURRENT VS PREVIOUS YEAR</span>
            <h2>
              {viewLabel}: {currentYear} analysis versus {previousYear}
            </h2>
          </section>

          <section className="gridCharts">
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

            {selectedView === "all" && (
              <>
                <ChartPanel
                  title="Current vs previous year by plan"
                  subtitle="Compare each detected plan in the latest two years"
                  data={result.analysis.latest_vs_previous_by_plan || []}
                  initialType="bar"
                  initialMetric="amount"
                  multiSeries
                />
                <ChartPanel
                  title="Overall plan comparison"
                  subtitle="Premium, enrolments, members, batches and cover participation"
                  data={result.analysis.plan_comparison || []}
                  initialType="bar"
                  initialMetric="amount"
                />
                <ChartPanel
                  title="Plan performance by year"
                  subtitle="See which detected plan led in each transaction year"
                  data={result.analysis.plan_year_comparison || []}
                  initialType="bar"
                  initialMetric="amount"
                  multiSeries
                />
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
                "Premium contribution by insurer",
                "insurers",
                "bar",
                "count",
                false,
                false,
              ],
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
                  Transaction amount is treated as premium. Dates use
                  DD/Month Name/YYYY. Excel keeps source row order without date,
                  premium or alphabetical sorting.
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
                ["Exact duplicates removed", result.data_quality.exact_duplicates_removed],
                [
                  "Duplicate transaction IDs removed",
                  result.data_quality.duplicate_transaction_ids_removed,
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
