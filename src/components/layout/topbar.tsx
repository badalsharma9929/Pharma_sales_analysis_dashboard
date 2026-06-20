"use client";

import * as React from "react";
import { GlobalFilters } from "@/components/filters/global-filters";
import { MobileSidebarToggle } from "@/components/layout/sidebar";
import { ViewId, NAV_ITEMS } from "@/components/layout/sidebar";

export function Topbar({
  active, onMobileMenuClick,
}: {
  active: ViewId;
  onMobileMenuClick: () => void;
}) {
  const item = NAV_ITEMS.find((i) => i.id === active);
  return (
    <header className="sticky top-0 z-30 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-14 items-center gap-2 px-4">
        <MobileSidebarToggle onClick={onMobileMenuClick} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold sm:text-base">{item?.label}</h1>
          <p className="truncate text-[10px] text-muted-foreground hidden sm:block">{item?.description}</p>
        </div>
        <div className="hidden md:block text-[10px] text-muted-foreground">
          MedLife Pharma Pvt. Ltd.
        </div>
      </div>
      <GlobalFilters />
    </header>
  );
}
