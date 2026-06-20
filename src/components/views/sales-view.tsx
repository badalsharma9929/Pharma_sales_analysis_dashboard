"use client";

import * as React from "react";
import { useModuleData, useGlobalFilters } from "@/hooks/use-global-filters";
import type { SalesResponse, RepAttainment, StateRevenueRow } from "@/lib/types";
import { KpiCards } from "@/components/charts/kpi-cards";
import { SalesTrendLine } from "@/components/charts/sales-trend-line";
import { RepLeaderboard } from "@/components/charts/rep-leaderboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/format";

export function SalesView() {
  const { filters } = useGlobalFilters();
  const { data, isLoading } = useModuleData<SalesResponse>("sales", filters);

  return (
    <div className="space-y-4 p-4">
      <KpiCards data={data?.kpis ?? []} loading={isLoading} />
      <SalesTrendLine
        data={data?.salesTrend ?? []}
        loading={isLoading}
        title="Sales Trend with Target & Prior-Year Overlay"
        subtitle="Actual / target / prior-year monthly revenue"
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RepLeaderboard
          data={data?.topReps ?? []}
          loading={isLoading}
          title="Top 10 Reps by Attainment"
          subtitle="Highest attainment % in selected period"
        />
        <RepLeaderboard
          data={data?.bottomReps ?? []}
          loading={isLoading}
          title="Bottom 10 Reps by Attainment"
          subtitle="Lowest attainment % (filtering for revenue > 0)"
        />
      </div>
      <StateRevenueTable data={data?.stateRevenue ?? []} loading={isLoading} />
    </div>
  );
}

function StateRevenueTable({ data, loading }: { data: StateRevenueRow[]; loading?: boolean }) {
  const [sortBy, setSortBy] = React.useState<"revenue" | "attainment" | "share">("revenue");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const sorted = React.useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      const av = sortBy === "revenue" ? a.revenueInr : sortBy === "attainment" ? (a.attainmentPct ?? -1) : a.sharePct;
      const bv = sortBy === "revenue" ? b.revenueInr : sortBy === "attainment" ? (b.attainmentPct ?? -1) : b.sharePct;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [data, sortBy, sortDir]);
  const toggleSort = (col: "revenue" | "attainment" | "share") => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">State-wise Revenue</CardTitle>
        <p className="text-xs text-muted-foreground">Sortable — click any header to sort</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No state-level data available.
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("revenue")}>
                    Revenue {sortBy === "revenue" && (sortDir === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("attainment")}>
                    Attainment {sortBy === "attainment" && (sortDir === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("share")}>
                    Share % {sortBy === "share" && (sortDir === "asc" ? "↑" : "↓")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <TableRow key={row.state}>
                    <TableCell className="font-medium">{row.state}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{row.zone}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(row.revenueInr)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.attainmentPct === null ? "—" : `${row.attainmentPct.toFixed(1)}%`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.sharePct.toFixed(1)}%</TableCell>
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
