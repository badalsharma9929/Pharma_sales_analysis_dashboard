"use client";

import * as React from "react";
import { Sidebar, ViewId } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { OverviewView } from "@/components/views/overview-view";
import { SalesView } from "@/components/views/sales-view";
import { FieldForceView } from "@/components/views/field-force-view";
import { HcpTargetingView } from "@/components/views/hcp-targeting-view";
import { ProductMixView } from "@/components/views/product-mix-view";
import { ForecastView } from "@/components/views/forecast-view";

export default function Home() {
  const [view, setView] = React.useState<ViewId>("overview");
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Sync view with URL hash (#sales, #field-force, etc.) so it's shareable
  React.useEffect(() => {
    const hash = window.location.hash.replace("#", "") as ViewId;
    if (hash && ["overview", "sales", "field-force", "hcp", "product", "forecast"].includes(hash)) {
      setView(hash);
    }
    const onHashChange = () => {
      const h = window.location.hash.replace("#", "") as ViewId;
      if (h && ["overview", "sales", "field-force", "hcp", "product", "forecast"].includes(h)) {
        setView(h);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleViewChange = (v: ViewId) => {
    setView(v);
    if (typeof window !== "undefined") {
      window.location.hash = v;
    }
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar
        active={view}
        onChange={handleViewChange}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar active={view} onMobileMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div key={view} className="animate-in fade-in-50 duration-200">
            {view === "overview" && <OverviewView />}
            {view === "sales" && <SalesView />}
            {view === "field-force" && <FieldForceView />}
            {view === "hcp" && <HcpTargetingView />}
            {view === "product" && <ProductMixView />}
            {view === "forecast" && <ForecastView />}
          </div>
          <footer className="mt-auto border-t bg-card px-4 py-3 text-center text-[10px] text-muted-foreground">
            MedLife Pharma Pvt. Ltd. · Sales &amp; Field Force Analytics · FY24–FY26 · 104K+ rows · RNG seed 42
          </footer>
        </main>
      </div>
    </div>
  );
}
