export type Row = Record<string, string | number>;
export type Metric = "count"|"amount"|"premium"|"unique_members"|"batch_count"|"sum_insured_enrollments"|"suitability_score";
export type ChartKind = "line"|"bar"|"pie"|"table";
export type Item = {label:string;series?:string;count?:number;amount?:number;premium?:number;unique_members?:number;batch_count?:number;sum_insured_enrollments?:number;suitability_score?:number;[key:string]:string|number|undefined};
export type Result = {meta:{export_columns:string[];policy_included:boolean;processed_at:string;files_processed?:number;college_name?:string;plans?:string[]};kpis:Record<string,number|string>;cleaned_rows:Row[];analysis_rows:Row[];analysis:Record<string,Item[]>;insights:string[];data_quality:Record<string,any>};
export type UploadGroup = {name:string;files:File[]};
export const COLORS=["#0a6a61","#2576a8","#e58b37","#7e57c2","#d25572","#3f9c73","#80684d"];
export const metricLabel:Record<Metric,string>={count:"Records",amount:"Transaction amount",premium:"Premium",unique_members:"Unique members",batch_count:"Batches reached",sum_insured_enrollments:"Sum-insured enrolments",suitability_score:"Suitability score"};
export const money=(value:unknown)=>`₹${Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:2})}`;
export const compact=(value:number)=>new Intl.NumberFormat("en-IN",{notation:"compact",maximumFractionDigits:1}).format(value);
export function displayDate(value:unknown){const raw=String(value||"");const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return raw;const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));return `${String(d.getDate()).padStart(2,"0")}/${d.toLocaleString("en-IN",{month:"long"})}/${d.getFullYear()}`;}
export function excelDate(value:unknown){const raw=String(value||"");const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3])):value;}
export function formatMetric(value:unknown,metric:Metric){if(metric==="amount"||metric==="premium")return money(value);if(metric==="suitability_score")return `${Number(value||0).toFixed(1)}/100`;return Number(value||0).toLocaleString("en-IN");}
