"use client";

import * as React from "react";
import { useModuleData, useGlobalFilters } from "@/hooks/use-global-filters";
import type { FieldForceResponse } from "@/lib/types";
import { KpiCards } from "@/components/charts/kpi-cards";
import { CalendarHeatmap } from "@/components/charts/calendar-heatmap";
import { FunnelCoverage } from "@/components/charts/funnel-coverage";
import { SimpleBarChart, SimpleDonutChart } from "@/components/charts/simple-charts";

export function FieldForceView() {
  const { filters } = useGlobalFilters();
  const { data, isLoading } = useModuleData<FieldForceResponse>("field-force", filters);

  return (
    <div className="space-y-4 p-4">
      <KpiCards data={data?.kpis ?? []} loading={isLoading} />
      <CalendarHeatmap data={data?.heatmap ?? []} loading={isLoading} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SimpleDonutChart
          data={(data?.visitTypeMix ?? []).map((v) => ({ name: v.type, value: v.count }))}
          dataKey="value"
          nameKey="name"
          loading={isLoading}
          title="Visit Type Mix"
          subtitle="Distribution by visit type"
          valueFormatter={(v) => v.toLocaleString("en-IN")}
        />
        <SimpleDonutChart
          data={(data?.outcomeDistribution ?? []).map((v) => ({ name: v.outcome, value: v.count }))}
          dataKey="value"
          nameKey="name"
          loading={isLoading}
          title="Outcome Distribution"
          subtitle="Detailed / Briefed / No_Show / Refused"
          colors={["#0D9488", "#14B8A6", "#F59E0B", "#DC2626"]}
          valueFormatter={(v) => v.toLocaleString("en-IN")}
        />
        <FunnelCoverage data={data?.funnel ?? []} loading={isLoading} />
      </div>
      <SimpleBarChart
        data={data?.visitsPerRep ?? []}
        dataKey="visits"
        categoryKey="repName"
        loading={isLoading}
        title="Visits per Rep (Top 10 + Bottom 10)"
        subtitle="Field-force activity distribution across reps"
        horizontal
        valueFormatter={(v) => v.toLocaleString("en-IN")}
        height={480}
      />
    </div>
  );
}
