import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, Loader2, Search, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { RideCard } from "@/components/rides/RideCard";
import { FilterSidebar, type Filters } from "@/components/rides/FilterSidebar";
import { SearchModule } from "@/components/search/SearchModule";
import { ridesAPI, prieAPI } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const defaultFilters: Filters = {
  priceRange: [0, 2000],
  departureWindow: "Any",
  minSeats: 1,
  vehicleType: "Any",
  minRating: 0,
  genderPreference: "any",
  instantBooking: false,
};

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const from       = searchParams.get("from") || "";
  const to         = searchParams.get("to") || "";
  const fromLat    = parseFloat(searchParams.get("fromLat") || "0");
  const fromLng    = parseFloat(searchParams.get("fromLng") || "0");
  const toLat      = parseFloat(searchParams.get("toLat") || "0");
  const toLng      = parseFloat(searchParams.get("toLng") || "0");
  const passengers = parseInt(searchParams.get("passengers") || "1");
  const date       = searchParams.get("date") || "";

  const [filters, setFilters]             = useState<Filters>(defaultFilters);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [sortBy, setSortBy]               = useState<"personalized" | "price" | "time" | "rating">("personalized");
  const [rides, setRides]                 = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [recommendedCount, setRecommendedCount] = useState(0);

  const isSearchMode = !!(fromLat && fromLng && toLat && toLng);

  useEffect(() => {
    const loadRides = async () => {
      setLoading(true);
      setSearchExpanded(false);
      try {
        if (isSearchMode) {
          // Try personalized search if user is logged in (uses PRIE API)
          if (user) {
            try {
              const result = await prieAPI.search({
                pickupLat: fromLat,
                pickupLng: fromLng,
                dropLat: toLat,
                dropLng: toLng,
                passengers,
                date: date || undefined,
                fromName: from,
                toName: to,
              });
              setRides(result.rides);
              setIsPersonalized(result.meta?.isPersonalized ?? false);
              setRecommendedCount(result.meta?.recommended ?? 0);
              return;
            } catch (err) {
              // Fallback to regular search if PRIE fails
              console.warn("Personalized search unavailable, using regular search", err);
            }
          }

          // Regular search (for non-logged-in users or fallback)
          // Now also returns personalization data from backend
          const results = await ridesAPI.search({
            pickupLat: fromLat,
            pickupLng: fromLng,
            dropLat: toLat,
            dropLng: toLng,
            passengers,
            date: date || undefined,
          });
          
          // Handle both old (array) and new (object with rides) response formats
          if (Array.isArray(results)) {
            setRides(results);
            setIsPersonalized(false);
            setRecommendedCount(0);
          } else {
            setRides(results.rides || []);
            setIsPersonalized(results.meta?.isPersonalized ?? false);
            setRecommendedCount(results.meta?.recommended ?? 0);
          }
        } else {
          // No search coords — show all active rides
          const results = await ridesAPI.getAll();
          setRides(results);
          setIsPersonalized(false);
          setRecommendedCount(0);
        }
      } catch {
        toast.error("Failed to load rides. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    loadRides();
  }, [fromLat, fromLng, toLat, toLng, passengers, date, user]);

  const filteredRides = useMemo(() => {
    let list = rides.filter((r) => {
      if (r.price < filters.priceRange[0] || r.price > filters.priceRange[1]) return false;
      if (r.availableSeats < filters.minSeats) return false;
      if (filters.vehicleType !== "Any" && r.vehicleType !== filters.vehicleType) return false;
      // Use reviewStats or reliabilityScore for rating filter
      const driverRating = r.driver?.reviewStats?.avgStars || r.driver?.reliabilityScore?.avgRating || 0;
      if (filters.minRating > 0 && driverRating < filters.minRating) return false;
      if (filters.instantBooking && !r.instantBooking) return false;
      if (filters.genderPreference !== "any" && r.genderPreference !== filters.genderPreference && r.genderPreference !== "any") return false;
      if (filters.departureWindow !== "Any" && r.departureTime) {
        const h = parseInt(r.departureTime.split(":")[0], 10);
        if (filters.departureWindow === "Morning"   && (h < 6  || h >= 12)) return false;
        if (filters.departureWindow === "Afternoon" && (h < 12 || h >= 17)) return false;
        if (filters.departureWindow === "Evening"   && h < 17)              return false;
      }
      return true;
    });

    // Sorting logic
    if (sortBy === "personalized" && isPersonalized) {
      // Already sorted by personalization score from backend
      // Keep recommended rides at top
      list.sort((a, b) => {
        const aRec = a.personalization?.isRecommended ? 1 : 0;
        const bRec = b.personalization?.isRecommended ? 1 : 0;
        if (aRec !== bRec) return bRec - aRec;
        return (b.personalization?.score || 0) - (a.personalization?.score || 0);
      });
    } else if (sortBy === "price") {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === "rating") {
      // Sort by reviewStats or reliabilityScore avgRating
      list.sort((a, b) => {
        const aRating = a.driver?.reviewStats?.avgStars || a.driver?.reliabilityScore?.avgRating || 0;
        const bRating = b.driver?.reviewStats?.avgStars || b.driver?.reliabilityScore?.avgRating || 0;
        return bRating - aRating;
      });
    } else {
      list.sort((a, b) => (a.departureTime ?? "").localeCompare(b.departureTime ?? ""));
    }

    return list;
  }, [rides, filters, sortBy, isPersonalized]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* Sticky search bar */}
      <div className="sticky top-14 z-20 bg-background border-b border-border">
        {/* Collapsed summary row */}
        <button
          onClick={() => setSearchExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/40 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex items-center gap-2 text-sm font-medium min-w-0">
              <span className="truncate max-w-[130px] sm:max-w-[200px]">{from || "Origin"}</span>
              <span className="text-muted-foreground shrink-0">→</span>
              <span className="truncate max-w-[130px] sm:max-w-[200px]">{to || "Destination"}</span>
            </div>
            {(date || passengers > 1) && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                {date && <span>{date}</span>}
                {passengers > 1 && <span>{passengers} pax</span>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <span className="text-xs text-primary font-medium">Edit</span>
            {searchExpanded
              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            }
          </div>
        </button>

        {/* Expanded search module */}
        {searchExpanded && (
          <div className="border-t border-border px-4 pb-4 pt-2">
            <SearchModule
              initialFrom={from}
              initialFromCoords={fromLat && fromLng ? { lat: fromLat, lng: fromLng } : null}
              initialTo={to}
              initialToCoords={toLat && toLng ? { lat: toLat, lng: toLng } : null}
              initialDate={date || undefined}
              initialPassengers={passengers}
              onSearch={() => setSearchExpanded(false)}
            />
          </div>
        )}
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">

        {/* Results header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Searching..."
                : isSearchMode
                  ? `${filteredRides.length} ride${filteredRides.length !== 1 ? "s" : ""} found${
                      rides.length !== filteredRides.length ? ` (${rides.length} total, filtered)` : ""
                    }${date ? ` · ${date}` : ""}${` · ${passengers} passenger${passengers !== 1 ? "s" : ""}`}`
                  : `${filteredRides.length} ride${filteredRides.length !== 1 ? "s" : ""} available`
              }
            </p>
            {isPersonalized && recommendedCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <Sparkles className="h-3 w-3" />
                {recommendedCount} recommended
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile filter */}
            <button
              onClick={() => setMobileFilters(true)}
              className="lg:hidden flex items-center gap-1.5 h-8 px-3 text-xs border border-border rounded-sm hover:bg-accent transition-colors"
            >
              <SlidersHorizontal className="h-3 w-3" />
              Filters
            </button>

            {/* Sort */}
            <div className="flex border border-border rounded-sm overflow-hidden">
              {isPersonalized && (
                <button
                  onClick={() => setSortBy("personalized")}
                  className={`h-8 px-3 text-xs flex items-center gap-1 transition-colors ${
                    sortBy === "personalized"
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  For You
                </button>
              )}
              {(["time", "price", "rating"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`h-8 px-3 text-xs capitalize transition-colors ${
                    sortBy === s
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Filter sidebar */}
          <FilterSidebar
            filters={filters}
            onFiltersChange={setFilters}
            mobileOpen={mobileFilters}
            onMobileClose={() => setMobileFilters(false)}
          />

          {/* Results list */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm">Finding rides on this route…</span>
              </div>
            ) : filteredRides.length > 0 ? (
              <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                {filteredRides.map((ride) => (
                  <RideCard key={ride._id} ride={ride} searchCoords={fromLat && fromLng && toLat && toLng ? { fromLat, fromLng, toLat, toLng } : undefined} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center mb-4">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="font-medium mb-1">
                  {rides.length === 0
                    ? isSearchMode ? "No rides found on this route" : "No rides available right now"
                    : "No rides match your filters"}
                </p>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                  {rides.length === 0
                    ? isSearchMode
                      ? "Try searching different cities or remove the date filter."
                      : "Check back soon or offer your own ride."
                    : "Adjust the filters on the left to see more results."}
                </p>
                {rides.length === 0 && (
                  <button
                    onClick={() => setSearchExpanded(true)}
                    className="h-9 px-5 bg-primary text-primary-foreground text-sm font-medium rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    Edit search
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
