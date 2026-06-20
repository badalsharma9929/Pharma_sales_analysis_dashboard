"use client";

import * as React from "react";
import { useModuleData, useGlobalFilters } from "@/hooks/use-global-filters";
import type { ProductResponse } from "@/lib/types";
import { KpiCards } from "@/components/charts/kpi-cards";
import { ProductPieTreemap } from "@/components/charts/product-pie-treemap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatMonth } from "@/lib/format";

export function ProductMixView() {
  const { filters } = useGlobalFilters();
  const { data, isLoading } = useModuleData<ProductResponse>("product", filters);

  return (
    <div className="space-y-4 p-4">
      <KpiCards data={data?.kpis ?? []} loading={isLoading} />
      <ProductPieTreemap
        therapySplit={data?.therapySplit ?? []}
        treemap={data?.treemap ?? []}
        loading={isLoading}
      />
      <AdoptionSmallMultiples
        data={data?.adoption ?? []}
        loading={isLoading}
      />
      <CannibalizationTable data={data?.cannibalization ?? []} loading={isLoading} />
    </div>
  );
}

function AdoptionSmallMultiples({
  data, loading,
}: {
  data: ProductResponse["adoption"];
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">New Product Adoption Curves</CardTitle>
        <p className="text-xs text-muted-foreground">Monthly revenue since launch for new products (6-month ramp)</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No new product launches in the selected period.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((p) => {
              const chartData = p.monthly.map((m) => ({ ...m, label: formatMonth(m.month) }));
              return (
                <div key={p.productId} className="rounded-lg border p-3">
                  <div className="mb-2 text-xs font-medium">{p.productName}</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => formatINR(v as number)} width={50} />
                      <Tooltip
                        contentStyle={{ fontSize: 10, borderRadius: 6 }}
                        formatter={(v: number) => [formatINR(v as number), "Revenue"]}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="#0D9488" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CannibalizationTable({ data, loading }: {
  data: ProductResponse["cannibalization"];
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Cannibalization Watchlist</CardTitle>
        <p className="text-xs text-muted-foreground">
          Existing same-therapy products that dropped &gt;15% in 60 days post new-launch
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No cannibalization detected.
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>New Product</TableHead>
                  <TableHead>Existing Product</TableHead>
                  <TableHead className="text-right">Pre 60d Rev</TableHead>
                  <TableHead className="text-right">Post 60d Rev</TableHead>
                  <TableHead className="text-right">Drop %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.newProduct}</TableCell>
                    <TableCell>{row.existingProduct}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(row.preRevenueInr)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(row.postRevenueInr)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Badge variant="destructive" className="text-[10px]">{row.dropPct.toFixed(1)}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
