"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { SalesTrendPoint } from "@/lib/types";
import { formatMonth, formatINR } from "@/lib/format";

/**
 * Sales Trend Line — Recharts <LineChart> with actual/target/prior-year series.
 * Crosshair tooltip shows all 3 values per month.
 */
export function SalesTrendLine({
  data,
  loading,
  title = "Sales Trend",
  subtitle = "Monthly revenue (₹) with target & prior-year overlay",
}: {
  data: SalesTrendPoint[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const chartData = React.useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: formatMonth(d.month),
      })),
    [data],
  );

  const hasTarget = data.some((d) => d.target !== null);
  const hasPrior = data.some((d) => d.priorYear !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : !data || data.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval={Math.max(0, Math.floor(data.length / 12))}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => formatINR(v as number)}
                width={70}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelStyle={{ fontWeight: 600 }}
                formatter={(v: number, name: string) => [formatINR(v as number), prettyName(name)]}
              />
              <Legend formatter={(v) => prettyName(v as string)} wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeOpacity={0.4} />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#0D9488"
                strokeWidth={2.5}
                dot={false}
                name="Actual"
              />
              {hasTarget && (
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#64748B"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                  name="Target"
                />
              )}
              {hasPrior && (
                <Line
                  type="monotone"
                  dataKey="priorYear"
                  stroke="#94A3B8"
                  strokeWidth={1.2}
                  strokeDasharray="2 2"
                  dot={false}
                  name="Prior Year"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function prettyName(n: string): string {
  return n === "actual" ? "Actual" : n === "target" ? "Target" : n === "priorYear" ? "Prior Year" : n;
}

function EmptyState() {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
      No sales data available for the selected filters.
    </div>
  );
}
