"use client";

import * as React from "react";
import { Activity, BarChart3, Users, Pill, Target, TrendingUp, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ViewId = "overview" | "sales" | "field-force" | "hcp" | "product" | "forecast";

export const NAV_ITEMS: { id: ViewId; label: string; icon: React.ElementType; description: string }[] = [
  { id: "overview",    label: "Overview",         icon: Activity,    description: "Cross-module summary" },
  { id: "sales",       label: "Sales Performance", icon: TrendingUp,  description: "Trend, attainment, state-wise" },
  { id: "field-force", label: "Field Force",       icon: BarChart3,   description: "Visits, coverage, calendar" },
  { id: "hcp",         label: "HCP Targeting",     icon: Users,       description: "Tier, decile, churn, ROI" },
  { id: "product",     label: "Product Mix",       icon: Pill,        description: "Therapy mix, treemap, adoption" },
  { id: "forecast",    label: "Forecast",          icon: Target,      description: "Holt-Winters next quarter" },
];

export function Sidebar({
  active, onChange, mobileOpen, onMobileClose,
}: {
  active: ViewId;
  onChange: (v: ViewId) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform border-r bg-card transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Sidebar navigation"
      >
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">MedLife Pharma</div>
            <div className="text-[10px] text-muted-foreground leading-tight">Sales & Field Force Analytics</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-3" role="navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onChange(item.id); onMobileClose(); }}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                  isActive
                    ? "bg-teal-50 text-teal-900 dark:bg-teal-950 dark:text-teal-100"
                    : "text-foreground hover:bg-muted",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    isActive ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{item.description}</div>
                </div>
              </button>
            );
          })}
        </nav>
        <div className="mt-auto px-4 py-3 text-[10px] text-muted-foreground">
          <div className="rounded-md border bg-muted/40 p-2.5">
            <div className="font-medium text-foreground">FY24–FY26 dataset</div>
            <div>104K+ rows · 7 tables · seed 42</div>
          </div>
        </div>
      </aside>
    </>
  );
}

export function MobileSidebarToggle({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="lg:hidden h-8 w-8 p-0" onClick={onClick} aria-label="Open sidebar">
      <BarChart3 className="h-4 w-4" />
    </Button>
  );
}
