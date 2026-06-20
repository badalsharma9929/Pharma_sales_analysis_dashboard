"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, Treemap,
} from "recharts";
import type { TherapySplit, TreemapNode } from "@/lib/types";
import { formatINR } from "@/lib/format";

const TA_COLORS: Record<string, string> = {
  Cardio: "#0D9488",
  Diabetes: "#14B8A6",
  GI: "#10B981",
  Respiratory: "#5EEAD4",
};
const DEFAULT_COLORS = ["#0D9488", "#14B8A6", "#10B981", "#5EEAD4", "#2DD4BF", "#99F6E4"];

/**
 * Product Pie + Treemap — Recharts <PieChart> + <Treemap> side-by-side.
 * Click a pie slice to filter the treemap to that therapy area only.
 */
export function ProductPieTreemap({
  therapySplit,
  treemap,
  loading,
  title = "Product Mix — Therapy Area & Treemap",
  subtitle = "Pie: revenue by therapy area. Treemap: product-level contribution.",
}: {
  therapySplit: TherapySplit[];
  treemap: TreemapNode[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [selectedTa, setSelectedTa] = React.useState<string | null>(null);
  const filteredTreemap = React.useMemo(
    () => (selectedTa ? treemap.filter((n) => n.therapyArea === selectedTa) : treemap),
    [treemap, selectedTa],
  );
  const treemapData = React.useMemo(
    () => filteredTreemap.map((n) => ({ name: n.name, size: n.size, therapyArea: n.therapyArea })),
    [filteredTreemap],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : !therapySplit || therapySplit.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No product mix data available.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Pie */}
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                {selectedTa ? `Filtering treemap by: ${selectedTa}` : "Click a slice to filter treemap"}
                {selectedTa && (
                  <button
                    onClick={() => setSelectedTa(null)}
                    className="ml-2 text-teal-600 underline-offset-2 hover:underline"
                  >
                    clear
                  </button>
                )}
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={therapySplit}
                    dataKey="value"
                    nameKey="therapyArea"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={40}
                    paddingAngle={2}
                    onClick={(payload: { therapyArea?: string }) => {
                      const ta = payload?.therapyArea;
                      setSelectedTa((cur) => (cur === ta ? null : ta || null));
                    }}
                  >
                    {therapySplit.map((entry) => (
                      <Cell
                        key={entry.therapyArea}
                        fill={TA_COLORS[entry.therapyArea] || DEFAULT_COLORS[0]}
                        cursor="pointer"
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, n: string) => [formatINR(v as number), n]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Treemap */}
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">Treemap (by product revenue)</div>
              <ResponsiveContainer width="100%" height={260}>
                <Treemap
                  data={treemapData}
                  dataKey="size"
                  stroke="#fff"
                  content={<TreemapContent />}
                >
                  <Tooltip
                    formatter={(v: number) => [formatINR(v as number), "Revenue"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                </Treemap>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TreemapContent(props: any) {
  const { x, y, width, height, name, therapyArea, payload } = props;
  if (width < 30 || height < 20) return null;
  const ta = therapyArea || payload?.therapyArea;
  const fill = TA_COLORS[ta || ""] || DEFAULT_COLORS[0];
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill, stroke: "#fff", strokeWidth: 2, cursor: "pointer" }}
      />
      {width > 60 && height > 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          fill="#fff"
          fontSize={11}
          fontWeight={600}
        >
          {name}
        </text>
      )}
    </g>
  );
}
