"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CalendarHeatmapPoint } from "@/lib/types";
import { formatDate } from "@/lib/format";

/**
 * Calendar Heatmap — GitHub-style calendar heatmap of visits per day for last 12 months.
 * 5-step teal/green scale. Hover shows date + visit count.
 *
 * Mobile behavior: we render a horizontal-scroll container so the heatmap stays
 * readable at 375px width without collapsing to a smaller window. Documented in
 * README Agent Decisions.
 */
export function CalendarHeatmap({
  data,
  loading,
  title = "Visit Calendar Heatmap",
  subtitle = "Daily visit count for the last 12 months",
}: {
  data: CalendarHeatmapPoint[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [hovered, setHovered] = React.useState<CalendarHeatmapPoint | null>(null);
  const max = React.useMemo(
    () => (data.length ? Math.max(...data.map((d) => d.count)) : 1),
    [data],
  );

  // Group by ISO week (Sun-Sat) for a GitHub-style layout
  const weeks = React.useMemo(() => {
    if (!data.length) return [];
    // Map date -> count
    const map = new Map<string, number>();
    for (const d of data) map.set(d.date, d.count);
    // Find the Sunday on or before data[0].date
    const first = new Date(data[0].date + "T00:00:00.000Z");
    const firstSunday = new Date(first);
    firstSunday.setUTCDate(firstSunday.getUTCDate() - firstSunday.getUTCDay());
    // Find the Saturday on or after data[last].date
    const last = new Date(data[data.length - 1].date + "T00:00:00.000Z");
    const lastSaturday = new Date(last);
    lastSaturday.setUTCDate(lastSaturday.getUTCDate() + (6 - lastSaturday.getUTCDay()));
    // Build weeks
    const weeks: { date: string; count: number; inRange: boolean }[][] = [];
    let cur = new Date(firstSunday);
    while (cur <= lastSaturday) {
      const week: { date: string; count: number; inRange: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        const iso = cur.toISOString().slice(0, 10);
        const inRange = map.has(iso);
        week.push({ date: iso, count: inRange ? map.get(iso)! : 0, inRange });
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [data]);

  const colorFor = (count: number, inRange: boolean) => {
    if (!inRange || count === 0) return "#F1F5F9";
    const ratio = max > 0 ? count / max : 0;
    if (ratio < 0.2) return "#CCFBF1";
    if (ratio < 0.4) return "#5EEAD4";
    if (ratio < 0.6) return "#2DD4BF";
    if (ratio < 0.8) return "#14B8A6";
    return "#0D9488";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            No visit data available.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto pb-2">
              <div className="inline-block min-w-max">
                <div className="flex gap-[3px]">
                  {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[3px]">
                      {week.map((day) => (
                        <div
                          key={day.date}
                          className="h-3 w-3 rounded-sm"
                          style={{
                            background: colorFor(day.count, day.inRange),
                            outline: hovered?.date === day.date ? "1.5px solid #0D9488" : "none",
                            cursor: day.inRange ? "pointer" : "default",
                          }}
                          onMouseEnter={() => day.inRange && setHovered(day)}
                          onMouseLeave={() => setHovered(null)}
                          title={`${formatDate(day.date)}: ${day.count} visits`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                {/* Month labels */}
                <div className="mt-1 flex gap-[3px] text-[10px] text-muted-foreground">
                  {weeks.map((week, wi) => {
                    const first = new Date(week[0].date + "T00:00:00.000Z");
                    const showLabel = first.getUTCDate() <= 7;
                    const monthAbbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    return (
                      <div key={wi} className="w-3 text-center" style={{ minWidth: 12 }}>
                        {showLabel ? monthAbbr[first.getUTCMonth()] : ""}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {hovered ? (
                  <>
                    <span className="font-medium">{formatDate(hovered.date)}:</span>{" "}
                    {hovered.count.toLocaleString("en-IN")} visits
                  </>
                ) : (
                  "Hover any day to see visit count"
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span>Less</span>
                {["#F1F5F9", "#CCFBF1", "#5EEAD4", "#2DD4BF", "#14B8A6", "#0D9488"].map((c) => (
                  <span key={c} className="h-3 w-3 rounded-sm" style={{ background: c }} />
                ))}
                <span>More</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
