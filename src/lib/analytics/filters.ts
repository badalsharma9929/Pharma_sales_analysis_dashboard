/**
 * src/lib/analytics/filters.ts — Shared filter parsing helpers for API routes.
 */
import type { Filters } from "@/lib/types";
import { Prisma } from "@prisma/client";

/** Parse URL search params into a typed Filters object with sensible defaults. */
export function parseFilters(params: URLSearchParams): Filters {
  const end = params.get("end") || "2026-03-31";
  // Default = last 12 months from end
  const endD = new Date(end + "T00:00:00.000Z");
  const startD = new Date(endD);
  startD.setUTCMonth(startD.getUTCMonth() - 11);
  startD.setUTCDate(1);
  const start = params.get("start") || startD.toISOString().slice(0, 10);

  const zones = (params.get("zones") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const therapies = (params.get("therapies") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const roles = (params.get("roles") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return { start, end, zones, therapies, roles };
}

/** Build a Prisma where-clause fragment for reps matching zone + role filters. */
export function repWhere(filters: Filters): Prisma.RepWhereInput {
  const w: Prisma.RepWhereInput = {};
  if (filters.zones.length) w.zone = { in: filters.zones };
  if (filters.roles.length) w.role = { in: filters.roles };
  return w;
}

/** Build a Prisma where-clause fragment for sales matching date + (optionally) zones/therapies. */
export function saleWhere(filters: Filters): Prisma.SaleWhereInput {
  const w: Prisma.SaleWhereInput = {
    invoiceDate: {
      gte: new Date(filters.start + "T00:00:00.000Z"),
      lte: new Date(filters.end + "T23:59:59.999Z"),
    },
  };
  if (filters.zones.length || filters.roles.length) {
    w.rep = {};
    if (filters.zones.length) w.rep.zone = { in: filters.zones };
    if (filters.roles.length) w.rep.role = { in: filters.roles };
  }
  if (filters.therapies.length) {
    w.product = { therapyArea: { in: filters.therapies } };
  }
  return w;
}

/** Build a Prisma where-clause fragment for visits matching date + zone + role filters. */
export function visitWhere(filters: Filters): Prisma.VisitWhereInput {
  const w: Prisma.VisitWhereInput = {
    visitDate: {
      gte: new Date(filters.start + "T00:00:00.000Z"),
      lte: new Date(filters.end + "T23:59:59.999Z"),
    },
  };
  if (filters.zones.length || filters.roles.length) {
    w.rep = {};
    if (filters.zones.length) w.rep.zone = { in: filters.zones };
    if (filters.roles.length) w.rep.role = { in: filters.roles };
  }
  return w;
}

/** Build a Prisma where-clause fragment for expenses matching date + zone + role filters. */
export function expenseWhere(filters: Filters): Prisma.ExpenseWhereInput {
  const w: Prisma.ExpenseWhereInput = {
    expenseDate: {
      gte: new Date(filters.start + "T00:00:00.000Z"),
      lte: new Date(filters.end + "T23:59:59.999Z"),
    },
  };
  if (filters.zones.length || filters.roles.length) {
    w.rep = {};
    if (filters.zones.length) w.rep.zone = { in: filters.zones };
    if (filters.roles.length) w.rep.role = { in: filters.roles };
  }
  return w;
}

/** Build a Prisma where-clause fragment for targets matching FY range + zone + role filters. */
export function targetWhere(filters: Filters): Prisma.TargetWhereInput {
  const startFy = fyFromIso(filters.start);
  const endFy = fyFromIso(filters.end);
  const w: Prisma.TargetWhereInput = {
    fy: { gte: startFy, lte: endFy },
  };
  if (filters.zones.length || filters.roles.length) {
    w.rep = {};
    if (filters.zones.length) w.rep.zone = { in: filters.zones };
    if (filters.roles.length) w.rep.role = { in: filters.roles };
  }
  if (filters.therapies.length) {
    w.product = { therapyArea: { in: filters.therapies } };
  }
  return w;
}

/** Indian fiscal year for an ISO date. April-Dec → year Y; Jan-Mar → year Y-1. */
export function fyFromIso(iso: string): number {
  const d = new Date(iso);
  const m = d.getUTCMonth() + 1; // 1-12
  const y = d.getUTCFullYear();
  return m >= 4 ? y : y - 1;
}

/** Quarter for an ISO date. Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar. */
export function quarterFromIso(iso: string): string {
  const d = new Date(iso);
  const m = d.getUTCMonth() + 1;
  if (m <= 3) return "Q4";
  if (m <= 6) return "Q1";
  if (m <= 9) return "Q2";
  return "Q3";
}

/** YYYY-MM month key from a Date. */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
