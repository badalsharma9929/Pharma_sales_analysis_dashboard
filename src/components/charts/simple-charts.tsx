"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  PieChart, Pie, Legend, ResponsiveContainer,
} from "recharts";

/**
 * Reusable horizontal/vertical bar chart for visit counts, decile contribution, etc.
 */
export function SimpleBarChart<T extends Record<string, any>>({
  data,
  dataKey,
  categoryKey,
  loading,
  title,
  subtitle,
  color = "#0D9488",
  horizontal = false,
  valueFormatter = (v) => String(v),
  height = 280,
}: {
  data: T[];
  dataKey: keyof T & string;
  categoryKey: keyof T & string;
  loading?: boolean;
  title: string;
  subtitle?: string;
  color?: string;
  horizontal?: boolean;
  valueFormatter?: (v: number) => string;
  height?: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              data={data as any[]}
              layout={horizontal ? "vertical" : "horizontal"}
              margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
              {horizontal ? (
                <>
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => valueFormatter(v as number)} />
                  <YAxis type="category" dataKey={categoryKey} width={100} tick={{ fontSize: 11 }} />
                </>
              ) : (
                <>
                  <XAxis dataKey={categoryKey} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => valueFormatter(v as number)} width={70} />
                </>
              )}
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, name: string) => [valueFormatter(v as number), name]}
              />
              <Bar dataKey={dataKey} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/** Reusable donut chart for outcome distribution, visit type mix, etc. */
export function SimpleDonutChart<T extends Record<string, any>>({
  data,
  dataKey,
  nameKey,
  loading,
  title,
  subtitle,
  colors = ["#0D9488", "#14B8A6", "#10B981", "#5EEAD4", "#2DD4BF", "#99F6E4"],
  height = 280,
  valueFormatter = (v) => String(v),
}: {
  data: T[];
  dataKey: keyof T & string;
  nameKey: keyof T & string;
  loading?: boolean;
  title: string;
  subtitle?: string;
  colors?: string[];
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data as any[]}
                dataKey={dataKey}
                nameKey={nameKey}
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={45}
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} stroke="#fff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, n: string) => [valueFormatter(v as number), n]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
