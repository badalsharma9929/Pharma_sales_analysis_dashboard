"use client";

import * as React from "react";
import { useModuleData } from "@/hooks/use-global-filters";
import { useGlobalFilters } from "@/hooks/use-global-filters";
import type { OverviewResponse } from "@/lib/types";
import { KpiCards } from "@/components/charts/kpi-cards";
import { SalesTrendLine } from "@/components/charts/sales-trend-line";
import { IndiaGeoMap } from "@/components/charts/india-geo-map";
import { RepLeaderboard } from "@/components/charts/rep-leaderboard";

export function OverviewView() {
  const { filters } = useGlobalFilters();
  const { data, isLoading } = useModuleData<OverviewResponse>("overview", filters);
  return (
    <div className="space-y-4 p-4">
      <KpiCards data={data?.kpis ?? []} loading={isLoading} />
      <SalesTrendLine
        data={data?.salesTrend ?? []}
        loading={isLoading}
        title="Sales Trend (24 months)"
        subtitle="Actual vs prior-year monthly revenue"
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IndiaGeoMap data={data?.geoData ?? []} loading={isLoading} />
        </div>
        <RepLeaderboard data={data?.leaderboard ?? []} loading={isLoading} />
      </div>
    </div>
  );
}
