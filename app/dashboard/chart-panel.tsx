"use client";

import React, { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartKind,
  COLORS,
  compact,
  formatMetric,
  Item,
  Metric,
  metricLabel,
  money,
} from "./types";

function Hover({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean;
  payload?: any[];
  label?: unknown;
  metric: Metric;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="tooltip">
      <strong>{label || payload[0]?.name}</strong>
      {payload.map((entry: any, index: number) => {
        const detail =
          entry.payload?.__details?.[entry.name] ||
          entry.payload?.__details?.Data ||
          entry.payload ||
          {};
        return (
          <div className="tooltipSeries" key={`${entry.name}-${index}`}>
            <b style={{ color: entry.color }}>{entry.name}</b>
            <span>
              {metricLabel[metric]}: {formatMetric(entry.value, metric)}
            </span>
            {detail.count !== undefined && (
              <span>Enrolments: {Number(detail.count).toLocaleString("en-IN")}</span>
            )}
            {detail.amount !== undefined && (
              <span>Premium amount: {money(detail.amount)}</span>
            )}
            {detail.average !== undefined && (
              <span>Average premium: {money(detail.average)}</span>
            )}
            {detail.unique_members !== undefined && (
              <span>Unique members: {detail.unique_members}</span>
            )}
            {detail.batch_count !== undefined && (
              <span>Batches reached: {detail.batch_count}</span>
            )}
            {detail.sum_insured_enrollments !== undefined && (
              <span>
                Sum-insured enrolments: {detail.sum_insured_enrollments}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ChartPanel({
  title,
  subtitle,
  data,
  initialType = "bar",
  initialMetric = "count",
  multiSeries = false,
  chronological = false,
}: {
  title: string;
  subtitle: string;
  data: Item[];
  initialType?: ChartKind;
  initialMetric?: Metric;
  multiSeries?: boolean;
  chronological?: boolean;
}) {
  const available = (
    [
      "count",
      "amount",
      "average",
      "unique_members",
      "batch_count",
      "sum_insured_enrollments",
      "suitability_score",
    ] as Metric[]
  ).filter((metric) => data.some((row) => row[metric] !== undefined));

  const [kind, setKind] = useState<ChartKind>(initialType);
  const [metric, setMetric] = useState<Metric>(
    available.includes(initialMetric) ? initialMetric : available[0] || "count",
  );
  const [limit, setLimit] = useState("20");

  if (!data.length) {
    return (
      <section className="panel">
        <h3>{title}</h3>
        <p className="empty">This field was not available in the uploaded data.</p>
      </section>
    );
  }

  const maxItems = limit === "all" ? data.length : Number(limit);
  const visible = chronological ? data.slice(-maxItems) : data.slice(0, maxItems);
  const seriesNames = multiSeries
    ? Array.from(new Set(visible.map((row) => String(row.series || "Data"))))
    : ["Data"];
  const labels = Array.from(new Set(visible.map((row) => row.label)));

  const chartData = labels.map((label) => {
    const record: any = { label, __details: {} };
    if (multiSeries) {
      seriesNames.forEach((series) => {
        const item = visible.find(
          (row) => row.label === label && String(row.series || "Data") === series,
        );
        record[series] = item ? Number(item[metric] || 0) : null;
        record.__details[series] = item || {};
      });
    } else {
      const item = visible.find((row) => row.label === label);
      record.Data = item ? Number(item[metric] || 0) : 0;
      record.__details.Data = item || {};
    }
    return record;
  });

  const pieData = visible
    .map((item) => ({
      ...item,
      value: Number(item[metric] || 0),
      __details: { Data: item },
    }))
    .filter((item) => item.value > 0);

  const selected = multiSeries && kind === "pie" ? "bar" : kind;

  return (
    <section className="panel">
      <div className="panelHead">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <div className="chartControls">
          <select
            value={selected}
            onChange={(event) => setKind(event.target.value as ChartKind)}
          >
            <option value="line">Line</option>
            <option value="bar">Bar</option>
            {!multiSeries && <option value="pie">Pie</option>}
            <option value="table">Table</option>
          </select>
          <select
            value={metric}
            onChange={(event) => setMetric(event.target.value as Metric)}
          >
            {available.map((option) => (
              <option key={option} value={option}>
                {metricLabel[option]}
              </option>
            ))}
          </select>
          <select value={limit} onChange={(event) => setLimit(event.target.value)}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {selected === "table" ? (
        <div className="miniTable">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                {multiSeries && <th>Series</th>}
                <th>Enrolments</th>
                <th>Premium amount</th>
                <th>Average premium</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => (
                <tr
                  key={`${row.label}-${row.series}-${index}`}
                  title={`${row.label}: ${metricLabel[metric]} ${formatMetric(
                    row[metric],
                    metric,
                  )}`}
                >
                  <td>{row.label}</td>
                  {multiSeries && <td>{row.series}</td>}
                  <td>{row.count ?? ""}</td>
                  <td>{row.amount !== undefined ? money(row.amount) : ""}</td>
                  <td>{row.average !== undefined ? money(row.average) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : selected === "pie" ? (
        <div className="chartArea">
          <ResponsiveContainer width="100%" height={330}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="48%"
                outerRadius={115}
                label={({ label, percent }: any) =>
                  `${label} ${(percent * 100).toFixed(0)}%`
                }
              >
                {pieData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<Hover metric={metric} />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="chartArea">
          <ResponsiveContainer width="100%" height={340}>
            {selected === "line" ? (
              <LineChart
                data={chartData}
                margin={{ top: 15, right: 20, left: 10, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  angle={labels.length > 10 ? -30 : 0}
                  textAnchor={labels.length > 10 ? "end" : "middle"}
                  height={labels.length > 10 ? 65 : 35}
                />
                <YAxis
                  tickFormatter={(value) =>
                    metric === "amount" || metric === "average"
                      ? compact(value)
                      : String(value)
                  }
                />
                <Tooltip content={<Hover metric={metric} />} />
                <Legend />
                {seriesNames.map((series, index) => (
                  <Line
                    key={series}
                    name={series}
                    type="monotone"
                    dataKey={series}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 7 }}
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 15, right: 20, left: 10, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  angle={labels.length > 10 ? -30 : 0}
                  textAnchor={labels.length > 10 ? "end" : "middle"}
                  height={labels.length > 10 ? 65 : 35}
                />
                <YAxis
                  tickFormatter={(value) =>
                    metric === "amount" || metric === "average"
                      ? compact(value)
                      : String(value)
                  }
                />
                <Tooltip content={<Hover metric={metric} />} />
                <Legend />
                {seriesNames.map((series, index) => (
                  <Bar
                    key={series}
                    name={series}
                    dataKey={series}
                    fill={COLORS[index % COLORS.length]}
                    radius={[5, 5, 0, 0]}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
