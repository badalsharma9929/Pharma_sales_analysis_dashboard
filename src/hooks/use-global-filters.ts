"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";

/**
 * Shared hook: parse global filters from URL search params via nuqs
 * and return a stable filters object + fetch helper for a given API route.
 */
export type Filters = {
  start: string;
  end: string;
  zones: string[];
  therapies: string[];
  roles: string[];
};

const ZONE_OPTIONS = ["North", "South", "East", "West"] as const;
const THERAPY_OPTIONS = ["Cardio", "Diabetes", "GI", "Respiratory"] as const;
const ROLE_OPTIONS = ["Field_Rep", "Area_Manager", "Regional_Manager", "National_Head"] as const;

export const FILTER_OPTIONS = {
  zones: ZONE_OPTIONS,
  therapies: THERAPY_OPTIONS,
  roles: ROLE_OPTIONS,
};

export function useGlobalFilters(): {
  filters: Filters;
  setFilters: (next: Partial<Filters>) => void;
  resetFilters: () => void;
} {
  const [start, setStart] = useQueryState("start", { defaultValue: "2025-04-01", shallow: false });
  const [end, setEnd] = useQueryState("end", { defaultValue: "2026-03-31", shallow: false });
  const [zonesStr, setZonesStr] = useQueryState("zones", { defaultValue: "", shallow: false });
  const [therapiesStr, setTherapiesStr] = useQueryState("therapies", { defaultValue: "", shallow: false });
  const [rolesStr, setRolesStr] = useQueryState("roles", { defaultValue: "", shallow: false });

  const filters: Filters = {
    start,
    end,
    zones: zonesStr ? zonesStr.split(",").filter(Boolean) : [],
    therapies: therapiesStr ? therapiesStr.split(",").filter(Boolean) : [],
    roles: rolesStr ? rolesStr.split(",").filter(Boolean) : [],
  };

  const setFilters = React.useCallback(
    (next: Partial<Filters>) => {
      if (next.start !== undefined) setStart(next.start);
      if (next.end !== undefined) setEnd(next.end);
      if (next.zones !== undefined) setZonesStr(next.zones.join(","));
      if (next.therapies !== undefined) setTherapiesStr(next.therapies.join(","));
      if (next.roles !== undefined) setRolesStr(next.roles.join(","));
    },
    [setStart, setEnd, setZonesStr, setTherapiesStr, setRolesStr],
  );

  const resetFilters = React.useCallback(() => {
    setStart("2025-04-01");
    setEnd("2026-03-31");
    setZonesStr("");
    setTherapiesStr("");
    setRolesStr("");
  }, [setStart, setEnd, setZonesStr, setTherapiesStr, setRolesStr]);

  return { filters, setFilters, resetFilters };
}

/** Build the URL query string from a Filters object. */
export function filtersToQuery(filters: Filters): string {
  const params = new URLSearchParams();
  params.set("start", filters.start);
  params.set("end", filters.end);
  if (filters.zones.length) params.set("zones", filters.zones.join(","));
  if (filters.therapies.length) params.set("therapies", filters.therapies.join(","));
  if (filters.roles.length) params.set("roles", filters.roles.join(","));
  return params.toString();
}

/**
 * useModuleData — fetch data from one of the 6 API routes using TanStack Query.
 * The queryKey includes the filter values so changing filters triggers a refetch.
 */
export function useModuleData<T>(route: string, filters: Filters) {
  return useQuery<T>({
    queryKey: [route, filters],
    queryFn: async () => {
      const qs = filtersToQuery(filters);
      const res = await fetch(`/api/${route}?${qs}`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`API ${route} failed: ${res.status} ${text}`);
      }
      return res.json() as Promise<T>;
    },
  });
}
