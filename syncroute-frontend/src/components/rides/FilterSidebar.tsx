import { useState } from "react";
import { X, SlidersHorizontal } from "lucide-react";

interface Filters {
  priceRange: [number, number];
  departureWindow: string;
  minSeats: number;
  vehicleType: string;
  minRating: number;
  genderPreference: string;
  instantBooking: boolean;
}

interface FilterSidebarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function FilterSidebar({ filters, onFiltersChange, mobileOpen, onMobileClose }: FilterSidebarProps) {
  const update = (partial: Partial<Filters>) => onFiltersChange({ ...filters, ...partial });

  const content = (
    <div className="space-y-0 divide-y divide-border">
      <FilterSection title="Price Range">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Min</label>
            <input
              type="number"
              value={filters.priceRange[0]}
              onChange={(e) => update({ priceRange: [Number(e.target.value), filters.priceRange[1]] })}
              className="w-full h-8 px-2 text-sm font-mono bg-transparent border border-border rounded-sm mt-1"
            />
          </div>
          <span className="text-muted-foreground mt-4">–</span>
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Max</label>
            <input
              type="number"
              value={filters.priceRange[1]}
              onChange={(e) => update({ priceRange: [filters.priceRange[0], Number(e.target.value)] })}
              className="w-full h-8 px-2 text-sm font-mono bg-transparent border border-border rounded-sm mt-1"
            />
          </div>
        </div>
      </FilterSection>

      <FilterSection title="Departure">
        <div className="grid grid-cols-2 gap-1">
          {["Any", "Morning", "Afternoon", "Evening"].map((w) => (
            <button
              key={w}
              onClick={() => update({ departureWindow: w })}
              className={`h-8 text-xs rounded-sm border transition-system ${
                filters.departureWindow === w
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border control-hover"
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Minimum Seats">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((s) => (
            <button
              key={s}
              onClick={() => update({ minSeats: s })}
              className={`h-8 w-8 text-xs rounded-sm border transition-system ${
                filters.minSeats === s
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border control-hover"
              }`}
            >
              {s}+
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Vehicle Type">
        <div className="grid grid-cols-2 gap-1">
          {["Any", "Sedan", "SUV", "Compact"].map((v) => (
            <button
              key={v}
              onClick={() => update({ vehicleType: v })}
              className={`h-8 text-xs rounded-sm border transition-system ${
                filters.vehicleType === v
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border control-hover"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Minimum Rating">
        <div className="flex gap-1">
          {[4.0, 4.5, 4.8].map((r) => (
            <button
              key={r}
              onClick={() => update({ minRating: r })}
              className={`h-8 px-3 text-xs rounded-sm border font-mono transition-system ${
                filters.minRating === r
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border control-hover"
              }`}
            >
              {r}+
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Instant Booking">
        <button
          onClick={() => update({ instantBooking: !filters.instantBooking })}
          className={`h-8 px-4 text-xs rounded-sm border transition-system ${
            filters.instantBooking
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "border-border control-hover"
          }`}
        >
          {filters.instantBooking ? "On" : "Off"}
        </button>
      </FilterSection>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block w-64 shrink-0 border border-border bg-card rounded-lg">
        <div className="flex items-center gap-2 px-4 h-10 border-b border-border">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
        </div>
        {content}
      </div>

      {/* Mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/80" onClick={onMobileClose} />
          <div className="absolute inset-x-0 top-0 bg-card border-b border-border max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 h-12 border-b border-border">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
              </div>
              <button onClick={onMobileClose} className="h-8 w-8 flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            {content}
            <div className="p-4 border-t border-border">
              <button
                onClick={onMobileClose}
                className="w-full h-10 bg-primary text-primary-foreground text-sm font-medium rounded-sm transition-system"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">{title}</div>
      {children}
    </div>
  );
}

export type { Filters };
