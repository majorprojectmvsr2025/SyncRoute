import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, Loader2, Search, ChevronDown, ChevronUp, Sparkles, Filter } from "lucide-react";
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
              console.warn("Personalized search unavailable, using regular search", err);
            }
          }

          const results = await ridesAPI.search({
            pickupLat: fromLat,
            pickupLng: fromLng,
            dropLat: toLat,
            dropLng: toLng,
            passengers,
            date: date || undefined,
          });
          
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

    if (sortBy === "personalized" && isPersonalized) {
      list.sort((a, b) => {
        const aRec = a.personalization?.isRecommended ? 1 : 0;
        const bRec = b.personalization?.isRecommended ? 1 : 0;
        if (aRec !== bRec) return bRec - aRec;
        return (b.personalization?.score || 0) - (a.personalization?.score || 0);
      });
    } else if (sortBy === "price") {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === "rating") {
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
      <div className="sticky top-14 z-20 glass-effect border-b border-border shadow-sm">
        <button
          onClick={() => setSearchExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-accent/30 transition-all duration-200 max-w-6xl mx-auto"
        >
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm font-medium min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate max-w-[140px] sm:max-w-[200px] text-foreground font-semibold">{from || "Origin"}</span>
                <span className="text-muted-foreground shrink-0">→</span>
                <span className="truncate max-w-[140px] sm:max-w-[200px] text-foreground font-semibold">{to || "Destination"}</span>
              </div>
              {(date || passengers > 1) && (
                <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  {date && <span className="px-2 py-1 rounded bg-accent">{date}</span>}
                  {passengers > 1 && <span className="px-2 py-1 rounded bg-accent">{passengers} passengers</span>}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <span className="hidden sm:inline text-sm text-primary font-semibold">Edit search</span>
            {searchExpanded
              ? <ChevronUp className="h-5 w-5 text-muted-foreground" />
              : <ChevronDown className="h-5 w-5 text-muted-foreground" />
            }
          </div>
        </button>

        {searchExpanded && (
          <div className="border-t border-border px-4 sm:px-6 pb-6 pt-4 max-w-6xl mx-auto animate-slide-up">
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

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">

        {/* Results header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-display font-bold text-foreground">
              {loading
                ? "Searching..."
                : isSearchMode
                  ? `${filteredRides.length} ride${filteredRides.length !== 1 ? "s" : ""} found`
                  : `${filteredRides.length} ride${filteredRides.length !== 1 ? "s" : ""} available`
              }
            </h1>
            {isPersonalized && recommendedCount > 0 && (
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-semibold">
                <Sparkles className="h-4 w-4" />
                {recommendedCount} recommended for you
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Mobile filter */}
            <button
              onClick={() => setMobileFilters(true)}
              className="lg:hidden flex items-center gap-2 h-10 px-4 rounded-lg text-sm border border-border text-foreground hover:bg-accent transition-all duration-200 font-medium"
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>

            {/* Sort */}
            <div className="flex rounded-lg border border-border overflow-hidden bg-card">
              {isPersonalized && (
                <button
                  onClick={() => setSortBy("personalized")}
                  className={`h-10 px-4 text-sm flex items-center gap-2 transition-all duration-200 font-medium ${
                    sortBy === "personalized"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  For You
                </button>
              )}
              {(["time", "price", "rating"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`h-10 px-4 text-sm capitalize transition-all duration-200 font-medium ${
                    sortBy === s
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
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
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
                <div className="h-16 w-16 rounded-full bg-accent flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground mb-1">Finding rides</p>
                  <p className="text-sm">Searching for the best matches on this route…</p>
                </div>
              </div>
            ) : filteredRides.length > 0 ? (
              <div className="card-elevated overflow-hidden divide-y divide-border">
                {filteredRides.map((ride) => (
                  <RideCard 
                    key={ride._id} 
                    ride={ride} 
                    searchCoords={fromLat && fromLng && toLat && toLng ? { fromLat, fromLng, toLat, toLng } : undefined} 
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center card-elevated">
                <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center mb-6">
                  <Search className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-display font-bold text-foreground mb-2">
                  {rides.length === 0
                    ? isSearchMode ? "No rides found" : "No rides available"
                    : "No rides match your filters"}
                </h3>
                <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">
                  {rides.length === 0
                    ? isSearchMode
                      ? "Try searching different cities or remove the date filter to see more options."
                      : "Check back soon or be the first to offer a ride on this route."
                    : "Adjust the filters on the left to see more results."}
                </p>
                {rides.length === 0 && (
                  <button
                    onClick={() => setSearchExpanded(true)}
                    className="h-12 px-6 rounded-lg btn-primary text-base font-semibold flex items-center gap-2"
                  >
                    <Search className="h-5 w-5" />
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
