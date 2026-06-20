"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { Tooltip } from "@/components/ui/tooltip";
import type { GeoDataPoint } from "@/lib/types";
import { formatINR } from "@/lib/format";

// Long/Lat approximations for major Indian cities (for marker overlays, optional)
const GEO_URL = "/india-states.topo.json";

/**
 * India Geo Map — react-simple-maps choropleth, 5-step sequential teal scale.
 * Hover shows tooltip with state name + revenue value.
 */
export function IndiaGeoMap({
  data,
  loading,
  title = "India — Revenue by State",
  subtitle = "Choropleth of total sales (₹) per state in selected period",
}: {
  data: GeoDataPoint[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [hovered, setHovered] = React.useState<GeoDataPoint | null>(null);
  const values = data.map((d) => d.value);
  const max = values.length ? Math.max(...values) : 1;
  const min = values.length ? Math.min(...values) : 0;
  const color = scaleLinear<string>()
    .domain([min, (min + max) / 2, max])
    .range(["#E6FFFA", "#5EEAD4", "#0D9488"]);

  // Map of state name -> value (for fast lookup in geography render)
  const valueMap = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const d of data) m.set(d.state, d.value);
    return m;
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
            No geographic data available.
          </div>
        ) : (
          <>
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 1100, center: [82, 22] }}
              width={800}
              height={500}
              style={{ width: "100%", height: "auto" }}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }: { geographies: any[] }) =>
                  geographies.map((geo) => {
                    const stateName = geo.properties?.ST_NM || geo.properties?.name || "";
                    const value = valueMap.get(stateName) || 0;
                    const has = value > 0;
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onMouseEnter={() => has && setHovered({ state: stateName, value })}
                        onMouseLeave={() => setHovered(null)}
                        style={{
                          default: {
                            fill: has ? color(value) : "#F1F5F9",
                            stroke: "#CBD5E1",
                            strokeWidth: 0.4,
                            outline: "none",
                          },
                          hover: {
                            fill: has ? color(value) : "#E2E8F0",
                            stroke: "#0D9488",
                            strokeWidth: 1.0,
                            outline: "none",
                            cursor: "pointer",
                          },
                          pressed: { outline: "none" },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Low</span>
              <div className="mx-2 h-2 flex-1 rounded" style={{ background: "linear-gradient(to right, #E6FFFA, #5EEAD4, #0D9488)" }} />
              <span>High</span>
            </div>
            {hovered && (
              <div className="mt-2 rounded-md bg-teal-50 dark:bg-teal-950/40 px-3 py-1.5 text-xs text-teal-900 dark:text-teal-100 inline-block">
                <span className="font-medium">{hovered.state}:</span> {formatINR(hovered.value)}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
