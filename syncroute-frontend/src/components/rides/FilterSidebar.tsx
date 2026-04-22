import { useState } from "react";
import { X, SlidersHorizontal, IndianRupee } from "lucide-react";

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

  const chipBase = "h-8 px-3 text-xs font-medium border rounded-lg transition-all duration-150 cursor-pointer";
  const chipActive = "border-primary bg-primary text-primary-foreground";
  const chipInactive = "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground hover:bg-accent";

  const content = (
    <div className="space-y-0 divide-y divide-border">
      {/* Price Range */}
      <FilterSection title="Price Range" icon={<IndianRupee className="h-3 w-3" />}>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">Min ₹</label>
            <input
              type="number"
              value={filters.priceRange[0]}
              onChange={(e) => update({ priceRange: [Number(e.target.value), filters.priceRange[1]] })}
              className="w-full h-8 px-2.5 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <span className="text-muted-foreground mt-5 text-sm">–</span>
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">Max ₹</label>
            <input
              type="number"
              value={filters.priceRange[1]}
              onChange={(e) => update({ priceRange: [filters.priceRange[0], Number(e.target.value)] })}
              className="w-full h-8 px-2.5 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>
      </FilterSection>

      {/* Departure */}
      <FilterSection title="Departure Time">
        <div className="grid grid-cols-2 gap-1.5">
          {["Any", "Morning", "Afternoon", "Evening"].map((w) => (
            <button
              key={w}
              onClick={() => update({ departureWindow: w })}
              className={`${chipBase} ${filters.departureWindow === w ? chipActive : chipInactive}`}
            >
              {w}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Seats */}
      <FilterSection title="Min Seats">
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((s) => (
            <button
              key={s}
              onClick={() => update({ minSeats: s })}
              className={`h-8 w-10 text-xs font-medium border rounded-lg transition-all duration-150 ${
                filters.minSeats === s ? chipActive : chipInactive
              }`}
            >
              {s}+
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Vehicle Type */}
      <FilterSection title="Vehicle Type">
        <div className="grid grid-cols-2 gap-1.5">
          {["Any", "Sedan", "SUV", "Compact"].map((v) => (
            <button
              key={v}
              onClick={() => update({ vehicleType: v })}
              className={`${chipBase} ${filters.vehicleType === v ? chipActive : chipInactive}`}
            >
              {v}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Rating */}
      <FilterSection title="Min Rating">
        <div className="flex gap-1.5">
          {[0, 4.0, 4.5, 4.8].map((r) => (
            <button
              key={r}
              onClick={() => update({ minRating: r })}
              className={`h-8 px-2.5 text-xs font-medium border rounded-lg transition-all duration-150 ${
                filters.minRating === r ? chipActive : chipInactive
              }`}
            >
              {r === 0 ? "Any" : `${r}★`}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Instant Booking */}
      <FilterSection title="Instant Booking">
        <button
          onClick={() => update({ instantBooking: !filters.instantBooking })}
          className={`${chipBase} px-4 ${filters.instantBooking ? chipActive : chipInactive}`}
        >
          {filters.instantBooking ? "✓ Instant only" : "Any"}
        </button>
      </FilterSection>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-32 bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 h-10 border-b border-border bg-muted/30">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Filters</span>
          </div>
          {content}
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onMobileClose} />
          <div className="absolute inset-x-0 bottom-0 bg-card border-t border-border rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 h-12 border-b border-border sticky top-0 bg-card z-10">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Filters</span>
              </div>
              <button onClick={onMobileClose} className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            {content}
            <div className="p-4 border-t border-border">
              <button
                onClick={onMobileClose}
                className="w-full h-11 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
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

function FilterSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-1.5 mb-3">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

export type { Filters };
