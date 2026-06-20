"use client";

import * as React from "react";
import { useModuleData, useGlobalFilters } from "@/hooks/use-global-filters";
import type { ForecastResponse } from "@/lib/types";
import { KpiCards } from "@/components/charts/kpi-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Area, ComposedChart,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatMonth } from "@/lib/format";

export function ForecastView() {
  const { filters } = useGlobalFilters();
  const { data, isLoading } = useModuleData<ForecastResponse>("forecast", filters);
  const [region, setRegion] = React.useState<string>("");

  const regions = React.useMemo(() => (data?.perRegion ?? []).map((r) => r.region), [data]);
  React.useEffect(() => {
    if (!region && regions.length) setRegion(regions[0]);
  }, [regions, region]);
  const activeRegion = (data?.perRegion ?? []).find((r) => r.region === region) || data?.perRegion?.[0];

  return (
    <div className="space-y-4 p-4">
      <KpiCards data={data?.kpis ?? []} loading={isLoading} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-sm font-medium">Actual vs Forecast — by Region</CardTitle>
            <p className="text-xs text-muted-foreground">
              Holt-Winters triple exponential smoothing (12-month seasonality). Solid = actual, dotted = forecast with 80%/95% CI.
            </p>
          </div>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              {regions.map((r) => (
                <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : !activeRegion ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              No forecast data available.
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">Region:</span>
                <Badge variant="outline">{activeRegion.region}</Badge>
                <span className="text-muted-foreground">MAPE:</span>
                <Badge variant={activeRegion.mapePct < 20 ? "secondary" : "destructive"}>
                  {activeRegion.mapePct.toFixed(1)}%
                </Badge>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart
                  data={activeRegion.series.map((p) => ({ ...p, label: formatMonth(p.month) }))}
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(activeRegion.series.length / 12))} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatINR(v as number)} width={70} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number, name: string) => [formatINR(v as number), prettyName(name)]}
                  />
                  <Legend formatter={(v) => prettyName(v as string)} wrapperStyle={{ fontSize: 11 }} />
                  {/* CI band */}
                  <Area
                    type="monotone" dataKey="ci95Upper" stroke="none" fill="#0D9488" fillOpacity={0.06}
                    name="95% CI Upper" legendType="none"
                  />
                  <Area
                    type="monotone" dataKey="ci80Upper" stroke="none" fill="#0D9488" fillOpacity={0.10}
                    name="80% CI Upper" legendType="none"
                  />
                  <Line type="monotone" dataKey="actual" stroke="#0D9488" strokeWidth={2.5} dot={false} name="Actual" />
                  <Line
                    type="monotone" dataKey="forecast" stroke="#14B8A6" strokeWidth={2}
                    strokeDasharray="6 4" dot={false} name="Forecast"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}
        </CardContent>
      </Card>

      <PerProductForecastTable data={data?.perProduct ?? []} loading={isLoading} />
    </div>
  );
}

function PerProductForecastTable({ data, loading }: {
  data: ForecastResponse["perProduct"];
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Per-Product Forecast (Next 3 Months)</CardTitle>
        <p className="text-xs text-muted-foreground">Holt-Winters forecast with 80% &amp; 95% confidence intervals</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No per-product forecast available.
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Forecast</TableHead>
                  <TableHead className="text-right">80% CI</TableHead>
                  <TableHead className="text-right">95% CI</TableHead>
                  <TableHead className="text-right">MAPE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.flatMap((p) =>
                  p.next3Months.map((m, i) => (
                    <TableRow key={`${p.productId}-${i}`}>
                      <TableCell className="font-medium">{p.productName}</TableCell>
                      <TableCell className="text-xs">{formatMonth(m.month)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(m.forecast)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatINR(m.ci80Lower)} – {formatINR(m.ci80Upper)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatINR(m.ci95Lower)} – {formatINR(m.ci95Upper)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Badge variant={p.mapePct < 20 ? "secondary" : "destructive"} className="text-[10px]">
                          {p.mapePct.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )),
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function prettyName(n: string): string {
  const map: Record<string, string> = {
    actual: "Actual", forecast: "Forecast",
    ci80Lower: "80% CI Lower", ci80Upper: "80% CI Upper",
    ci95Lower: "95% CI Lower", ci95Upper: "95% CI Upper",
  };
  return map[n] || n;
}
