"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, CartesianGrid,
} from "recharts";
import type { RepAttainment } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";

const colorForAttainment = (pct: number) =>
  pct >= 100 ? "#16A34A" : pct >= 80 ? "#F59E0B" : "#DC2626";

/**
 * Rep Leaderboard — Recharts horizontal <BarChart>.
 * Green ≥100%, amber 80-100%, red <80%. Click to drill into rep detail (toast).
 */
export function RepLeaderboard({
  data,
  loading,
  title = "Rep Leaderboard — Attainment %",
  subtitle = "Top performers by attainment % (revenue / target)",
}: {
  data: RepAttainment[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const sorted = React.useMemo(
    () => [...data].sort((a, b) => b.attainmentPct - a.attainmentPct).slice(0, 10),
    [data],
  );
  const height = Math.max(220, sorted.length * 32 + 40);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            No rep attainment data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={sorted} layout="vertical" margin={{ left: 16, right: 24, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} horizontal={false} />
              <XAxis
                type="number"
                domain={[0, "auto"]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="repName"
                width={120}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, name: string) => [`${(v as number).toFixed(1)}%`, "Attainment"]}
                labelFormatter={(_, p) => {
                  const row = p?.[0]?.payload as RepAttainment;
                  return row ? `${row.repName} · ${row.zone} · ${formatINR(row.revenueInr)}` : "";
                }}
              />
              <ReferenceLine x={100} stroke="#64748B" strokeDasharray="3 3" label={{ value: "100%", fontSize: 10, position: "top" }} />
              <Bar
                dataKey="attainmentPct"
                radius={[0, 4, 4, 0]}
                cursor="pointer"
                onClick={(payload: RepAttainment) => {
                  toast.info(`${payload.repName} (${payload.zone})`, {
                    description: `Attainment: ${payload.attainmentPct.toFixed(1)}% · Revenue: ${formatINR(payload.revenueInr)}`,
                  });
                }}
              >
                {sorted.map((row) => (
                  <Cell key={row.repId} fill={colorForAttainment(row.attainmentPct)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
