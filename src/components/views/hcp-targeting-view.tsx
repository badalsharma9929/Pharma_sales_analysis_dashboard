"use client";

import * as React from "react";
import { useModuleData, useGlobalFilters } from "@/hooks/use-global-filters";
import type { HcpResponse } from "@/lib/types";
import { KpiCards } from "@/components/charts/kpi-cards";
import { ScatterRoi } from "@/components/charts/scatter-roi";
import { SimpleBarChart } from "@/components/charts/simple-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatDate } from "@/lib/format";

export function HcpTargetingView() {
  const { filters } = useGlobalFilters();
  const { data, isLoading } = useModuleData<HcpResponse>("hcp", filters);

  const tierCoverageData = React.useMemo(
    () => (data?.tierCoverage ?? []).map((t) => ({
      tier: `Tier ${t.tier}`,
      coveragePct: Math.round(t.coveragePct * 10) / 10,
    })),
    [data],
  );
  const decileData = React.useMemo(
    () => (data?.decileContribution ?? []).map((d) => ({
      decile: `D${d.decile}`,
      revenueInr: d.revenueInr,
      sharePct: Math.round(d.sharePct * 10) / 10,
    })),
    [data],
  );

  return (
    <div className="space-y-4 p-4">
      <KpiCards data={data?.kpis ?? []} loading={isLoading} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SimpleBarChart
          data={tierCoverageData}
          dataKey="coveragePct"
          categoryKey="tier"
          loading={isLoading}
          title="Tier-wise Coverage %"
          subtitle="Distinct HCPs visited / total in tier"
          valueFormatter={(v) => `${v.toFixed(1)}%`}
        />
        <SimpleBarChart
          data={decileData}
          dataKey="revenueInr"
          categoryKey="decile"
          loading={isLoading}
          title="Decile-wise Revenue Contribution"
          subtitle="Total revenue bucketed by HCP decile (1 = top)"
          valueFormatter={(v) => formatINR(v)}
        />
      </div>
      <ScatterRoi data={data?.scatterRoi ?? []} loading={isLoading} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UntappedHcpsTable data={data?.untappedHcps ?? []} loading={isLoading} />
        <HcpChurnTable data={data?.churnTable ?? []} loading={isLoading} />
      </div>
    </div>
  );
}

function UntappedHcpsTable({ data, loading }: {
  data: HcpResponse["untappedHcps"];
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Untapped High-Value HCPs</CardTitle>
        <p className="text-xs text-muted-foreground">Tier-A HCPs with 0 visits in last 90 days</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No untapped HCPs found — great coverage!
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>HCP</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead className="text-right">Lifetime Rev</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.slice(0, 50).map((row) => (
                  <TableRow key={row.hcpId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-xs">{row.specialty}</TableCell>
                    <TableCell className="text-xs">{row.city}</TableCell>
                    <TableCell className="text-xs">
                      {row.lastVisitDate ? formatDate(row.lastVisitDate) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(row.lifetimeRevenueInr)}</TableCell>
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

function HcpChurnTable({ data, loading }: {
  data: HcpResponse["churnTable"];
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">HCP Churn (QoQ)</CardTitle>
        <p className="text-xs text-muted-foreground">HCPs whose revenue dropped &gt;50% QoQ</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No churned HCPs found — stable revenue base!
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>HCP</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Prior Q Rev</TableHead>
                  <TableHead className="text-right">Current Q Rev</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.slice(0, 50).map((row) => (
                  <TableRow key={row.hcpId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">Tier {row.tier}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(row.priorQuarterRevenueInr)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(row.currentQuarterRevenueInr)}</TableCell>
                    <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
                      {row.changePct.toFixed(1)}%
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
