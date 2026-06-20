"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, Tooltip, Cell } from "recharts";
import type { FunnelStage } from "@/lib/types";
import { formatINR } from "@/lib/format";

/**
 * Funnel Coverage — custom SVG funnel (Recharts <Funnel> has limited tooltip support).
 * Gradient teal → green. Hover reveals absolute + % of prior stage.
 */
export function FunnelCoverage({
  data,
  loading,
  title = "Coverage Funnel",
  subtitle = "Targeted → Visited → Detailed → Bought",
}: {
  data: FunnelStage[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const max = data.length ? Math.max(...data.map((d) => d.value)) : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            No funnel data available.
          </div>
        ) : (
          <div className="space-y-2 py-2">
            {data.map((stage, i) => {
              const widthPct = max > 0 ? (stage.value / max) * 100 : 0;
              const prior = i > 0 ? data[i - 1].value : stage.value;
              const pctOfPrior = prior > 0 ? (stage.value / prior) * 100 : 0;
              const color = `hsl(${170 - i * 10}, ${70 - i * 5}%, ${50 - i * 4}%)`;
              const isHover = hovered === i;
              return (
                <div
                  key={stage.stage}
                  className="relative"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-24 text-xs font-medium">{stage.stage}</div>
                    <div className="relative h-10 flex-1 rounded-md bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-md transition-all duration-300"
                        style={{
                          width: `${widthPct}%`,
                          background: isHover
                            ? `linear-gradient(90deg, ${color}, ${color}DD)`
                            : `linear-gradient(90deg, ${color}AA, ${color})`,
                          boxShadow: isHover ? `0 0 0 2px ${color}` : "none",
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-semibold text-white">
                        {stage.value.toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>
                  <div className="ml-[7rem] mt-0.5 h-4 text-[10px] text-muted-foreground">
                    {isHover && (
                      <span>
                        {stage.value.toLocaleString("en-IN")} (
                        {i === 0 ? "100%" : `${pctOfPrior.toFixed(1)}% of prior`}
                        {stage.value > 0 ? ` · ${formatINR(stage.value * 0)}` : ""})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
