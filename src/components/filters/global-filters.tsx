"use client";

import * as React from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover as Popover2, PopoverContent as PopoverContent2, PopoverTrigger as PopoverTrigger2 } from "@/components/ui/popover";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR, formatDate } from "@/lib/format";
import { useGlobalFilters, FILTER_OPTIONS } from "@/hooks/use-global-filters";

const LAST_12_DEFAULT = { start: "2025-04-01", end: "2026-03-31" };

/** Topbar with global filters: Date Range, Zone, Therapy, Role. */
export function GlobalFilters() {
  const { filters, setFilters, resetFilters } = useGlobalFilters();
  const hasActiveFilters =
    filters.zones.length > 0 ||
    filters.therapies.length > 0 ||
    filters.roles.length > 0 ||
    filters.start !== LAST_12_DEFAULT.start ||
    filters.end !== LAST_12_DEFAULT.end;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b bg-card">
      <DateRangePicker
        start={filters.start}
        end={filters.end}
        onChange={(s, e) => setFilters({ start: s, end: e })}
      />
      <MultiSelect
        label="Zone"
        options={[...FILTER_OPTIONS.zones]}
        selected={filters.zones}
        onChange={(z) => setFilters({ zones: z })}
      />
      <MultiSelect
        label="Therapy"
        options={[...FILTER_OPTIONS.therapies]}
        selected={filters.therapies}
        onChange={(t) => setFilters({ therapies: t })}
      />
      <MultiSelect
        label="Rep Level"
        options={[...FILTER_OPTIONS.roles]}
        selected={filters.roles}
        onChange={(r) => setFilters({ roles: r })}
        displayMap={{
          Field_Rep: "Field Rep",
          Area_Manager: "Area Manager",
          Regional_Manager: "Regional Manager",
          National_Head: "National Head",
        }}
      />
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs">
          <X className="mr-1 h-3 w-3" /> Reset
        </Button>
      )}
      <div className="ml-auto text-[10px] text-muted-foreground hidden sm:block">
        Window: {formatDate(filters.start)} → {formatDate(filters.end)}
      </div>
    </div>
  );
}

function DateRangePicker({
  start, end, onChange,
}: { start: string; end: string; onChange: (s: string, e: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [range, setRange] = React.useState<{ from?: Date; to?: Date }>({
    from: new Date(start + "T00:00:00.000Z"),
    to: new Date(end + "T00:00:00.000Z"),
  });
  React.useEffect(() => {
    setRange({
      from: new Date(start + "T00:00:00.000Z"),
      to: new Date(end + "T00:00:00.000Z"),
    });
  }, [start, end]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <CalendarIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{formatDate(start)} → {formatDate(end)}</span>
          <span className="sm:hidden">Date Range</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={range}
          onSelect={(r) => {
            setRange(r as any);
            if (r?.from && r?.to) {
              onChange(r.from.toISOString().slice(0, 10), r.to.toISOString().slice(0, 10));
              setOpen(false);
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function MultiSelect({
  label, options, selected, onChange, displayMap,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  displayMap?: Record<string, string>;
}) {
  const [open, setOpen] = React.useState(false);
  const display = (o: string) => displayMap?.[o] || o;

  return (
    <Popover2 open={open} onOpenChange={setOpen}>
      <PopoverTrigger2 asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <span className="text-muted-foreground">{label}:</span>
          {selected.length === 0 ? (
            <span>All</span>
          ) : selected.length === 1 ? (
            <span>{display(selected[0])}</span>
          ) : (
            <Badge variant="secondary" className="rounded-sm px-1 text-[10px]">{selected.length}</Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger2>
      <PopoverContent2 className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>No options.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                  <CommandItem
                    key={opt}
                    onSelect={() => {
                      const next = isSelected
                        ? selected.filter((s) => s !== opt)
                        : [...selected, opt];
                      onChange(next);
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-3.5 w-3.5", isSelected ? "opacity-100" : "opacity-0")}
                    />
                    {display(opt)}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent2>
    </Popover2>
  );
}
