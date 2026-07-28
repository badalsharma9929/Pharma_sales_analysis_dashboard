"use client";

import React, { useMemo, useState } from "react";

type Row = Record<string, string | number>;
type Item = { label: string; count: number; amount?: number; premium?: number; average?: number };
type Result = {
  meta: { export_columns: string[]; policy_included: boolean; processed_at: string };
  kpis: Record<string, number | string>;
  cleaned_rows: Row[];
  analysis: Record<string, Item[]>;
  insights: string[];
  data_quality: Record<string, any>;
};

const money = (v: unknown) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const compact = (v: number) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(v);

function BarChart({ data, valueKey = "count", title }: { data: Item[]; valueKey?: "count" | "amount" | "premium"; title: string }) {
  const rows = data.slice(0, 10);
  const max = Math.max(1, ...rows.map((x) => Number(x[valueKey] || 0)));
  return <section className="panel"><h3>{title}</h3>{rows.length ? <div className="bars">{rows.map((x) => <div className="barRow" key={x.label}><div className="barLabel" title={x.label}>{x.label}</div><div className="barTrack"><span style={{ width: `${Math.max(3, Number(x[valueKey] || 0) / max * 100)}%` }} /></div><strong>{valueKey === "count" ? x.count : money(x[valueKey])}</strong></div>)}</div> : <p className="empty">This field was not available in the uploaded data.</p>}</section>;
}

function LineChart({ data }: { data: Item[] }) {
  const rows = data.slice(-18);
  if (!rows.length) return <section className="panel"><h3>Transaction trend</h3><p className="empty">No trend data available.</p></section>;
  const w = 760, h = 230, pad = 32;
  const vals = rows.map(x => Number(x.amount || 0)); const max = Math.max(1, ...vals);
  const pts = vals.map((v, i) => `${pad + i * ((w - pad * 2) / Math.max(1, vals.length - 1))},${h - pad - (v / max) * (h - pad * 2)}`).join(" ");
  return <section className="panel wide"><div className="panelHead"><div><h3>Monthly transaction trend</h3><p>Transaction value by month</p></div></div><svg viewBox={`0 0 ${w} ${h}`} className="lineChart"><line x1={pad} y1={h-pad} x2={w-pad} y2={h-pad} /><line x1={pad} y1={pad} x2={pad} y2={h-pad} /><polyline points={pts} /><g>{rows.map((x,i)=>{const cx=pad+i*((w-pad*2)/Math.max(1,rows.length-1));const cy=h-pad-(Number(x.amount||0)/max)*(h-pad*2);return <g key={x.label}><circle cx={cx} cy={cy} r="4"/><text x={cx} y={h-10} textAnchor="middle">{x.label}</text></g>})}</g></svg></section>;
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [password, setPassword] = useState("Premier_Institute@15");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [policyFilter, setPolicyFilter] = useState("");

  const filtered = useMemo(() => {
    if (!result) return [];
    const q = search.trim().toLowerCase();
    return result.cleaned_rows.filter(row => {
      const policyOk = !policyFilter || row["Policy (New/Renewal)"] === policyFilter;
      const searchOk = !q || Object.values(row).some(v => String(v ?? "").toLowerCase().includes(q));
      return policyOk && searchOk;
    });
  }, [result, search, policyFilter]);

  async function analyze() {
    if (!files.length) { setError("Select at least one Excel file."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const form = new FormData(); files.forEach(f => form.append("files", f)); form.append("password", password);
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to process workbook.");
      setResult(data);
    } catch (e: any) { setError(e.message || "Processing failed."); }
    finally { setLoading(false); }
  }

  async function exportExcel() {
    if (!result) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const add = (name: string, rows: any[]) => {
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Status: "No data available" }]);
      ws["!cols"] = Object.keys(rows[0] || { Status: "" }).map(k => ({ wch: Math.min(35, Math.max(12, k.length + 3)) }));
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    };
    add("Export_Data", filtered);
    add("Monthly_Trend", result.analysis.monthly_trend || []);
    if (result.meta.policy_included) add("New_Renewal", result.analysis.policy || []);
    add("Sum_Insured", result.analysis.sum_insured || []);
    add("Premium_Bands", result.analysis.premium_bands || []);
    add("Age_Analysis", result.analysis.age || []);
    add("State_Analysis", result.analysis.state || []);
    add("City_Analysis", result.analysis.city || []);
    add("Course_Analysis", result.analysis.course || []);
    add("Insurance_Products", result.analysis.insurance_products || []);
    add("Insurers", result.analysis.insurers || []);
    add("Business_Insights", result.insights.map((x, i) => ({ No: i + 1, Insight: x })));
    add("Data_Quality", Object.entries(result.data_quality).filter(([k]) => k !== "processing_log").map(([Metric, Value]) => ({ Metric, Value })));
    XLSX.writeFile(wb, `Insurance_Business_Insights_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  function exportCsv() {
    if (!result || !filtered.length) return;
    const cols = result.meta.export_columns;
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"','""')}"`;
    const csv = [cols.map(esc).join(","), ...filtered.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "Cleaned_Insurance_Data.csv"; a.click(); URL.revokeObjectURL(a.href);
  }

  return <main>
    <header className="hero"><div><span className="eyebrow">NO-CODE EXCEL ANALYTICS</span><h1>Insurance Business Insights Dashboard</h1><p>Import password-protected Excel files, clean the data, understand customer and insurance trends, and export a complete management workbook.</p></div><div className="privacy">🔒 Files are processed only for this request</div></header>

    <section className="uploadCard">
      <div className="drop"><input id="files" type="file" multiple accept=".xlsx,.xlsm,.xls" onChange={e=>setFiles(Array.from(e.target.files || []))}/><label htmlFor="files"><b>Choose Excel files</b><span>{files.length ? files.map(f=>f.name).join(", ") : "Upload one or multiple workbooks"}</span></label></div>
      <div className="password"><label>Common Excel password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></div>
      <button className="primary" onClick={analyze} disabled={loading}>{loading ? "Analysing…" : "Generate Dashboard"}</button>
      {error && <div className="error">{error}</div>}
    </section>

    {result && <>
      <div className="toolbar"><div><b>{result.kpis.total_records} clean records</b><span>Processed {new Date(result.meta.processed_at).toLocaleString()}</span></div><div className="toolbarActions"><button onClick={exportCsv}>Export CSV</button><button className="primary small" onClick={exportExcel}>Export Complete Excel</button></div></div>

      <section className="kpis">
        {[['Clean records',result.kpis.total_records],['Transaction value',money(result.kpis.total_transaction_amount)],['Average transaction',money(result.kpis.average_transaction_amount)],['Total premium',money(result.kpis.total_premium)],['Most selected sum insured',result.kpis.most_selected_sum_insured],['Top insurance product',result.kpis.top_insurance_product]].map(([l,v])=><article key={String(l)}><span>{l}</span><strong>{String(v)}</strong></article>)}
      </section>

      <section className="insights"><div><span className="eyebrow">AUTOMATIC BUSINESS FINDINGS</span><h2>What the data is saying</h2></div><ol>{result.insights.map((x,i)=><li key={i}>{x}</li>)}</ol></section>

      <section className="gridCharts"><LineChart data={result.analysis.monthly_trend || []}/><BarChart title="Most selected sum insured" data={result.analysis.sum_insured || []}/><BarChart title="Premium band effectiveness" data={result.analysis.premium_bands || []} valueKey="count"/><BarChart title="Course analysis" data={result.analysis.course || []}/><BarChart title="Geographical analysis by state" data={result.analysis.state || []}/><BarChart title="Age group analysis" data={result.analysis.age || []}/><BarChart title="Insurance products taken most often" data={result.analysis.insurance_products || []}/><BarChart title="Insurer analysis" data={result.analysis.insurers || []}/>{result.meta.policy_included && <BarChart title="New versus Renewal" data={result.analysis.policy || []}/>}</section>

      <section className="dataPanel"><div className="dataHead"><div><h2>Cleaned export data</h2><p>Only New/Renewal values are accepted in the optional Policy column. Values such as GMC stay under insurance type analysis.</p></div><div className="filters"><input placeholder="Search all fields" value={search} onChange={e=>setSearch(e.target.value)}/>{result.meta.policy_included && <select value={policyFilter} onChange={e=>setPolicyFilter(e.target.value)}><option value="">All policies</option><option>New</option><option>Renewal</option></select>}</div></div><div className="tableWrap"><table><thead><tr>{result.meta.export_columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{filtered.slice(0,500).map((r,i)=><tr key={i}>{result.meta.export_columns.map(c=><td key={c}>{c==='transaction_amount'?money(r[c]):String(r[c]??'')}</td>)}</tr>)}</tbody></table></div><div className="tableFoot">Showing {Math.min(filtered.length,500)} of {filtered.length} filtered records</div></section>

      <section className="quality"><h2>Data cleaning summary</h2><div>{[['Rows received',result.data_quality.rows_before_cleaning],['Invalid dates removed',result.data_quality.invalid_dates_removed],['Exact duplicates removed',result.data_quality.exact_duplicates_removed],['Duplicate transaction IDs removed',result.data_quality.duplicate_transaction_ids_removed],['Final export rows',result.data_quality.final_rows]].map(([l,v])=><p key={String(l)}><span>{l}</span><b>{String(v)}</b></p>)}</div></section>
    </>}

    <style jsx global>{`
      *{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#102033;font-family:Arial,Helvetica,sans-serif}button,input,select{font:inherit}main{max-width:1440px;margin:auto;padding:28px}.hero{background:linear-gradient(135deg,#072d2e,#0d5c57);color:white;padding:42px;border-radius:26px;display:flex;justify-content:space-between;gap:30px;align-items:flex-end;box-shadow:0 18px 55px #0d5c5730}.hero h1{font-size:42px;margin:9px 0 12px;max-width:760px}.hero p{max-width:800px;color:#d6eeeb;font-size:17px;line-height:1.6}.eyebrow{font-size:12px;letter-spacing:.16em;font-weight:800;color:#58d4c6}.privacy{background:#ffffff18;border:1px solid #ffffff35;padding:13px 17px;border-radius:13px;white-space:nowrap}.uploadCard{background:white;margin-top:20px;padding:20px;border-radius:20px;display:grid;grid-template-columns:1.6fr 1fr auto;gap:16px;align-items:end;box-shadow:0 8px 30px #16324a12}.drop input{display:none}.drop label{display:flex;flex-direction:column;border:1.5px dashed #8ca6b8;border-radius:14px;padding:16px;cursor:pointer}.drop span,.password label{font-size:12px;color:#667b8e;margin-top:5px}.password{display:flex;flex-direction:column;gap:7px}.password input,.filters input,.filters select{border:1px solid #ced9e2;border-radius:11px;padding:12px;background:white}.primary,button{border:0;border-radius:11px;padding:13px 18px;cursor:pointer;font-weight:700;background:#e7edf2;color:#173148}.primary{background:#0a6a61;color:white}.primary:disabled{opacity:.55}.small{padding:10px 14px}.error{grid-column:1/-1;color:#a62020;background:#fff0f0;padding:12px;border-radius:10px}.toolbar{display:flex;justify-content:space-between;align-items:center;margin:24px 0 14px}.toolbar>div:first-child{display:flex;flex-direction:column}.toolbar span{font-size:12px;color:#708395;margin-top:4px}.toolbarActions{display:flex;gap:9px}.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}.kpis article{background:white;border-radius:16px;padding:18px;box-shadow:0 5px 20px #1731480d}.kpis span{font-size:12px;color:#738699}.kpis strong{display:block;font-size:20px;margin-top:10px;overflow-wrap:anywhere}.insights{margin:18px 0;background:#eef8f6;border:1px solid #cfeae5;border-radius:18px;padding:22px;display:grid;grid-template-columns:280px 1fr;gap:24px}.insights h2{margin:7px 0}.insights ol{margin:0;padding-left:22px;columns:2;column-gap:35px}.insights li{margin:0 0 10px;break-inside:avoid;line-height:1.45}.gridCharts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.panel{background:white;border-radius:18px;padding:20px;box-shadow:0 5px 20px #1731480d;min-height:285px}.panel.wide{grid-column:1/-1}.panel h3{margin:0 0 4px;font-size:17px}.panelHead p,.empty{color:#74879a;font-size:13px}.bars{margin-top:18px}.barRow{display:grid;grid-template-columns:150px 1fr 100px;gap:10px;align-items:center;margin:11px 0;font-size:12px}.barLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.barTrack{height:11px;border-radius:99px;background:#e7eef2;overflow:hidden}.barTrack span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#0b7a6c,#42baa8)}.barRow strong{text-align:right}.lineChart{width:100%;height:250px;overflow:visible}.lineChart line{stroke:#c9d6df}.lineChart polyline{fill:none;stroke:#0b766c;stroke-width:4;stroke-linejoin:round;stroke-linecap:round}.lineChart circle{fill:#fff;stroke:#0b766c;stroke-width:3}.lineChart text{font-size:10px;fill:#6d8090}.dataPanel,.quality{background:white;border-radius:18px;margin-top:18px;box-shadow:0 5px 20px #1731480d}.dataHead{display:flex;justify-content:space-between;gap:20px;padding:20px}.dataHead h2,.quality h2{margin:0 0 6px}.dataHead p{margin:0;color:#738699;font-size:13px}.filters{display:flex;gap:9px}.tableWrap{overflow:auto;max-height:570px;border-top:1px solid #e2e9ee;border-bottom:1px solid #e2e9ee}.tableWrap table{border-collapse:collapse;width:max-content;min-width:100%}.tableWrap th{position:sticky;top:0;background:#e8eff3;z-index:2;font-size:12px;text-align:left;padding:11px;white-space:nowrap}.tableWrap td{font-size:12px;padding:10px 11px;border-bottom:1px solid #edf1f4;white-space:nowrap}.tableWrap tr:hover td{background:#f6fbfa}.tableFoot{padding:12px 20px;font-size:12px;color:#718496}.quality{padding:20px;margin-bottom:25px}.quality>div{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.quality p{background:#f5f8fa;padding:13px;border-radius:11px;margin:0;display:flex;justify-content:space-between;font-size:13px}.quality span{color:#6f8293}@media(max-width:1000px){.hero{display:block}.privacy{display:inline-block;margin-top:15px}.uploadCard{grid-template-columns:1fr}.kpis{grid-template-columns:repeat(2,1fr)}.insights{grid-template-columns:1fr}.insights ol{columns:1}.gridCharts{grid-template-columns:1fr}.panel.wide{grid-column:auto}.quality>div{grid-template-columns:1fr 1fr}.dataHead{display:block}.filters{margin-top:13px}.hero h1{font-size:32px}}@media(max-width:600px){main{padding:12px}.hero{padding:25px;border-radius:18px}.kpis{grid-template-columns:1fr}.toolbar{display:block}.toolbarActions{margin-top:12px}.quality>div{grid-template-columns:1fr}.barRow{grid-template-columns:110px 1fr 70px}}
    `}</style>
  </main>;
}
