"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown,
} from "lucide-react";
import type { KpiCard as KpiCardData } from "@/lib/types";
import {
  ResponsiveContainer, AreaChart, Area, Tooltip,
} from "recharts";

/**
 * KPI Cards chart — shadcn Card with {label, value, delta, deltaPct, sparkline}.
 * Hover on the sparkline area reveals a tooltip with the underlying values.
 */
export function KpiCards({ data, loading }: { data: KpiCardData[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No KPI data available for the selected filters.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {data.map((kpi, i) => (
        <KpiCardItem key={i} kpi={kpi} />
      ))}
    </div>
  );
}

function KpiCardItem({ kpi }: { kpi: KpiCardData }) {
  const positive = kpi.deltaPositive ?? true;
  const sparkData = (kpi.sparkline || []).map((v, i) => ({ i, v }));
  const TrendIcon = positive ? TrendingUp : TrendingDown;
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {kpi.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <div className="text-2xl font-semibold tabular-nums">{kpi.value}</div>
        {kpi.delta && (
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            <TrendIcon className="h-3 w-3" />
            <span>{kpi.delta}</span>
          </div>
        )}
        {kpi.hint && (
          <div className="text-[10px] text-muted-foreground">{kpi.hint}</div>
        )}
        {sparkData.length > 0 && (
          <div className="mt-2 h-10 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`spark-${kpi.label.replace(/\s+/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#14B8A6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{ fontSize: "10px", padding: "4px 8px" }}
                  formatter={(v: number) => [formatSpark(v), kpi.label]}
                  labelFormatter={() => ""}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#0D9488"
                  strokeWidth={1.5}
                  fill={`url(#spark-${kpi.label.replace(/\s+/g, "")})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatSpark(v: number): string {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}
