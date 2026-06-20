"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import type { ScatterRoiPoint } from "@/lib/types";
import { formatINR } from "@/lib/format";

/**
 * Scatter ROI — Recharts <ScatterChart> with quadrant-coded colors.
 * Hover shows rep name + ROI ratio (revenue/expense).
 *
 * Quadrants:
 * - High revenue, low expense (efficient): emerald
 * - High revenue, high expense (productive): teal
 * - Low revenue, high expense (wasteful): red
 * - Low revenue, low expense (underutilized): amber
 */
export function ScatterRoi({
  data,
  loading,
  title = "Rep ROI — Revenue vs Expense",
  subtitle = "Quadrant scatter. Hover to see rep name + ROI ratio.",
}: {
  data: ScatterRoiPoint[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const medRev = React.useMemo(() => median(data.map((d) => d.revenue)), [data]);
  const medExp = React.useMemo(() => median(data.map((d) => d.expense)), [data]);
  const chartData = React.useMemo(
    () =>
      data.map((d) => {
        const highRev = d.revenue >= medRev;
        const highExp = d.expense >= medExp;
        const color =
          highRev && !highExp ? "#10B981" :
          highRev && highExp ? "#0D9488" :
          !highRev && highExp ? "#DC2626" : "#F59E0B";
        return { ...d, color };
      }),
    [data, medRev, medExp],
  );

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
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No ROI data available.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 12, right: 24, left: 12, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis
                  type="number"
                  dataKey="expense"
                  name="Expense"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatINR(v as number)}
                />
                <YAxis
                  type="number"
                  dataKey="revenue"
                  name="Revenue"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatINR(v as number)}
                  width={70}
                />
                <ZAxis range={[80, 80]} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(v: number, name: string) => [formatINR(v as number), name]}
                  labelFormatter={() => ""}
                  content={({ payload }) => {
                    const p = payload?.[0]?.payload as ScatterRoiPoint | undefined;
                    if (!p) return null;
                    return (
                      <div className="rounded-md border bg-background p-2 text-xs shadow-md">
                        <div className="font-semibold">{p.repName}</div>
                        <div>Revenue: {formatINR(p.revenue)}</div>
                        <div>Expense: {formatINR(p.expense)}</div>
                        <div>ROI: {p.roi.toFixed(2)}x</div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine x={medExp} stroke="#94a3b8" strokeDasharray="3 3" />
                <ReferenceLine y={medRev} stroke="#94a3b8" strokeDasharray="3 3" />
                <Scatter data={chartData}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              <Legend color="#10B981" label="Efficient" />
              <Legend color="#0D9488" label="Productive" />
              <Legend color="#F59E0B" label="Underutilized" />
              <Legend color="#DC2626" label="Wasteful" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
