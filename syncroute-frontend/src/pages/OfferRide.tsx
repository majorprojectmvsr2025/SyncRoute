import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LocationPanel } from "@/components/search/LocationPanel";
import { DateSelector } from "@/components/search/DateSelector";
import { TimeSelector } from "@/components/search/TimeSelector";
import { OfferRideMap, type OsrmRoute } from "@/components/map/OfferRideMap";
import {
  MapPin, Calendar, Clock, Car, DollarSign,
  ArrowRight, Loader2, Fuel, Route, ChevronDown,
  Music, MessageCircle, Wind, Shuffle, ShieldCheck,
  Upload, FileText, X, CheckCircle2,
} from "lucide-react";
import { ridesAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const VEHICLE_TYPES = [
  { value: "Compact", label: "Compact", seats: 3, fuelPerKm: 0.05 },
  { value: "Sedan",   label: "Sedan",   seats: 3, fuelPerKm: 0.06 },
  { value: "SUV",     label: "SUV",     seats: 5, fuelPerKm: 0.08 },
  { value: "Van",     label: "Van",     seats: 7, fuelPerKm: 0.09 },
];

const FUEL_PRICE_PER_LITER = 105;

export default function OfferRide() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Route
  const [from, setFrom]           = useState("");
  const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [to, setTo]               = useState("");
  const [toCoords, setToCoords]   = useState<{ lat: number; lng: number } | null>(null);
  const [activePanel, setActivePanel] = useState<"from" | "to" | "date" | "time" | null>(null);

  // Schedule
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("");

  // Vehicle & Pricing
  const [vehicleType, setVehicleType]   = useState("Sedan");
  const [vehicleModel, setVehicleModel] = useState("");
  const [totalSeats, setTotalSeats]     = useState(3);
  const [pricePerSeat, setPricePerSeat] = useState(0);

  // Ride Style / Vibe
  const [musicPreference, setMusicPreference]       = useState<"none" | "soft" | "any">("any");
  const [conversationStyle, setConversationStyle]   = useState<"chatty" | "quiet" | "flexible">("flexible");
  const [smokingAllowed, setSmokingAllowed]         = useState(false);

  // Shared Driving
  const [sharedDriving, setSharedDriving] = useState(false);

  // Preferences
  const [instantBooking, setInstantBooking] = useState(true);
  const [genderPreference, setGenderPreference] = useState("any");
  const [stops, setStops] = useState("");

  // Driver document uploads
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [rcFile, setRcFile] = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);

  // Selected OSRM route from the map
  const [selectedRoute, setSelectedRoute] = useState<OsrmRoute | null>(null);

  // Calculations
  const [distance, setDistance]             = useState(0);
  const [estimatedFuelCost, setEstimatedFuelCost] = useState(0);
  const [suggestedPrice, setSuggestedPrice] = useState(0);

  // Recalculate when route or vehicle changes
  useEffect(() => {
    if (selectedRoute) {
      recalcFromRoute(selectedRoute, vehicleType, totalSeats);
    } else if (fromCoords && toCoords) {
      calcHaversine();
    }
  }, [selectedRoute, vehicleType, totalSeats, fromCoords, toCoords]);

  const recalcFromRoute = (route: OsrmRoute, vType: string, seats: number) => {
    const distanceKm = route.distance / 1000;
    setDistance(Math.round(distanceKm));
    const vehicle = VEHICLE_TYPES.find(v => v.value === vType);
    const fuelCost = distanceKm * (vehicle?.fuelPerKm || 0.06) * FUEL_PRICE_PER_LITER;
    setEstimatedFuelCost(Math.round(fuelCost));
    const suggested = Math.round((fuelCost * 1.3) / seats);
    setSuggestedPrice(suggested);
    setPricePerSeat(suggested);
  };

  const calcHaversine = () => {
    if (!fromCoords || !toCoords) return;
    const R = 6371;
    const dLat = (toCoords.lat - fromCoords.lat) * Math.PI / 180;
    const dLon = (toCoords.lng - fromCoords.lng) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(fromCoords.lat * Math.PI / 180) * Math.cos(toCoords.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    setDistance(Math.round(distanceKm));
    const vehicle = VEHICLE_TYPES.find(v => v.value === vehicleType);
    const fuelCost = distanceKm * (vehicle?.fuelPerKm || 0.06) * FUEL_PRICE_PER_LITER;
    setEstimatedFuelCost(Math.round(fuelCost));
    const suggested = Math.round((fuelCost * 1.3) / totalSeats);
    setSuggestedPrice(suggested);
    setPricePerSeat(suggested);
  };

  // Reset selected route when from/to change via location panel
  const handleFromSelect = (loc: string, coords: { lat: number; lng: number }) => {
    setFrom(loc); setFromCoords(coords); setSelectedRoute(null); setActivePanel(null);
  };
  const handleToSelect = (loc: string, coords: { lat: number; lng: number }) => {
    setTo(loc); setToCoords(coords); setSelectedRoute(null); setActivePanel(null);
  };

  const handleSubmit = async () => {
    if (!fromCoords || !toCoords || !date || !time || !pricePerSeat) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      const year  = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day   = String(date.getDate()).padStart(2, "0");

      await ridesAPI.create({
        fromLat: fromCoords.lat,
        fromLng: fromCoords.lng,
        fromName: from,
        toLat: toCoords.lat,
        toLng: toCoords.lng,
        toName: to,
        departureTime: time,
        date: `${year}-${month}-${day}`,
        price: pricePerSeat,
        totalSeats,
        vehicleType,
        vehicleModel: vehicleModel || undefined,
        instantBooking,
        genderPreference,
        stops: stops ? stops.split(",").map(s => s.trim()).filter(Boolean) : [],
        musicPreference,
        conversationStyle,
        smokingAllowed,
        sharedDriving,
        // Pass the selected route path from the map so the backend saves it exactly
        ...(selectedRoute ? {
          routeCoords: selectedRoute.rawCoords,
          estimatedDuration: Math.round(selectedRoute.duration),
          estimatedDistance: Math.round(selectedRoute.distance),
        } : {}),
      });

      toast.success("Ride offered successfully!");
      navigate("/profile");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create ride");
    } finally {
      setLoading(false);
    }
  };

  const profileDocsVerified =
    !!(user?.documents?.licenseVerified && user?.documents?.rcVerified && user?.documents?.insuranceVerified);

  const verificationComplete =
    profileDocsVerified ||
    (licenseFile !== null && rcFile !== null && insuranceFile !== null);
  const canSubmit = from && to && fromCoords && toCoords && date && time && pricePerSeat > 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* Panel overlay */}
      {activePanel && (
        <div className="fixed inset-0 bg-background/80 z-30" onClick={() => setActivePanel(null)} />
      )}

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <div className="mb-8">
          <h1 className="text-xl font-semibold mb-1">Offer a Ride</h1>
          <p className="text-sm text-muted-foreground">Share your journey and split the cost.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── Left: all form fields ───────────────────── */}
          <div className="flex-1 min-w-0 space-y-4">

          {/* ── Route ──────────────────────────────────── */}
          <Section title="Route">
            <div className="divide-y divide-border relative z-40">
              <OfferField
                icon={<MapPin className="h-4 w-4" />}
                label="From"
                value={from || "Search starting location..."}
                active={activePanel === "from"}
                onClick={() => setActivePanel(activePanel === "from" ? null : "from")}
                placeholder={!from}
              />
              <OfferField
                icon={<MapPin className="h-4 w-4" />}
                label="To"
                value={to || "Search destination..."}
                active={activePanel === "to"}
                onClick={() => setActivePanel(activePanel === "to" ? null : "to")}
                placeholder={!to}
              />
              {activePanel === "from" && (
                <LocationPanel
                  type="from"
                  onSelect={handleFromSelect}
                  onClose={() => setActivePanel(null)}
                />
              )}
              {activePanel === "to" && (
                <LocationPanel
                  type="to"
                  onSelect={handleToSelect}
                  onClose={() => setActivePanel(null)}
                />
              )}
            </div>
          </Section>

          {/* ── Schedule ───────────────────────────────── */}
          <Section title="Schedule">
            <div className="divide-y divide-border relative z-30">
              <OfferField
                icon={<Calendar className="h-4 w-4" />}
                label="Date"
                value={date ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Select date"}
                active={activePanel === "date"}
                onClick={() => setActivePanel(activePanel === "date" ? null : "date")}
              />
              <OfferField
                icon={<Clock className="h-4 w-4" />}
                label="Departure Time"
                value={time || "Select time"}
                active={activePanel === "time"}
                onClick={() => setActivePanel(activePanel === "time" ? null : "time")}
              />
              {activePanel === "date" && (
                <DateSelector
                  selected={date}
                  onSelect={(d) => { setDate(d); setActivePanel(null); }}
                  onClose={() => setActivePanel(null)}
                />
              )}
              {activePanel === "time" && (
                <TimeSelector
                  selected={time}
                  onSelect={(t) => { setTime(t); setActivePanel(null); }}
                  onClose={() => setActivePanel(null)}
                />
              )}
            </div>
          </Section>

          {/* ── Vehicle & Pricing ──────────────────────── */}
          <Section title="Vehicle & Pricing">
            <div className="p-4 space-y-5">
              {/* Vehicle type */}
              <div>
                <FieldLabel>Vehicle Type</FieldLabel>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {VEHICLE_TYPES.map((v) => (
                    <button
                      key={v.value}
                      onClick={() => { setVehicleType(v.value); setTotalSeats(v.seats); }}
                      className={`p-3 border rounded-sm text-left transition-colors ${
                        vehicleType === v.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Car className="h-3 w-3" />
                        <span className="text-sm font-medium">{v.label}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{v.seats} seats</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vehicle model */}
              <div>
                <FieldLabel>Vehicle Model <span className="font-normal text-muted-foreground normal-case">(optional)</span></FieldLabel>
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="e.g., Honda City, Maruti Swift"
                  className="w-full h-10 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Seats */}
              <div>
                <FieldLabel>Available Seats</FieldLabel>
                <div className="flex items-center gap-2 w-40">
                  <button
                    onClick={() => setTotalSeats(Math.max(1, totalSeats - 1))}
                    className="h-10 w-10 border border-border rounded-sm hover:bg-accent transition-colors flex items-center justify-center text-lg"
                  >-</button>
                  <div className="flex-1 h-10 border border-border rounded-sm flex items-center justify-center font-medium">
                    {totalSeats}
                  </div>
                  <button
                    onClick={() => setTotalSeats(Math.min(7, totalSeats + 1))}
                    className="h-10 w-10 border border-border rounded-sm hover:bg-accent transition-colors flex items-center justify-center text-lg"
                  >+</button>
                </div>
              </div>

              {/* Fuel estimate */}
              {distance > 0 && (
                <div className="p-3 bg-muted/40 border border-border rounded-sm space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Distance</span>
                    <span className="font-medium">{distance} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Fuel className="h-3 w-3" />Fuel cost (est.)
                    </span>
                    <span className="font-medium">₹{estimatedFuelCost}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="text-muted-foreground">Suggested / seat</span>
                    <span className="font-medium text-primary">₹{suggestedPrice}</span>
                  </div>
                </div>
              )}

              {/* Price */}
              <div>
                <FieldLabel>Price per Seat (₹)</FieldLabel>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="number"
                    value={pricePerSeat || ""}
                    onChange={(e) => setPricePerSeat(parseInt(e.target.value) || 0)}
                    min="0"
                    className="w-full h-10 pl-10 pr-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                {pricePerSeat > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Total earnings: ₹{pricePerSeat * totalSeats}
                  </p>
                )}
              </div>
            </div>
          </Section>

          {/* ── Ride Style (Vibe) ──────────────────────── */}
          <Section title="Ride Style">
            <div className="p-4 space-y-5">
              {/* Music */}
              <div>
                <FieldLabel icon={<Music className="h-3.5 w-3.5" />}>Music</FieldLabel>
                <div className="flex gap-2">
                  {([
                    { value: "none", label: "None" },
                    { value: "soft", label: "Soft / Low" },
                    { value: "any",  label: "Any" },
                  ] as const).map((opt) => (
                    <ToggleChip
                      key={opt.value}
                      active={musicPreference === opt.value}
                      onClick={() => setMusicPreference(opt.value)}
                    >
                      {opt.label}
                    </ToggleChip>
                  ))}
                </div>
              </div>

              {/* Conversation */}
              <div>
                <FieldLabel icon={<MessageCircle className="h-3.5 w-3.5" />}>Conversation</FieldLabel>
                <div className="flex gap-2">
                  {([
                    { value: "chatty",   label: "Chatty" },
                    { value: "quiet",    label: "Quiet" },
                    { value: "flexible", label: "Flexible" },
                  ] as const).map((opt) => (
                    <ToggleChip
                      key={opt.value}
                      active={conversationStyle === opt.value}
                      onClick={() => setConversationStyle(opt.value)}
                    >
                      {opt.label}
                    </ToggleChip>
                  ))}
                </div>
              </div>

              {/* Smoking */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wind className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Smoking allowed</div>
                    <div className="text-xs text-muted-foreground">Inside the vehicle</div>
                  </div>
                </div>
                <Toggle on={smokingAllowed} onToggle={() => setSmokingAllowed(!smokingAllowed)} />
              </div>
            </div>
          </Section>

          {/* ── Shared Driving ─────────────────────────── */}
          {distance >= 200 && (
            <Section title="Shared Driving">
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <Shuffle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-medium mb-0.5">Allow co-driving</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        For long routes, passengers with a valid license can share driving.
                        Fare can be reduced or waived in exchange.
                      </p>
                    </div>
                  </div>
                  <Toggle on={sharedDriving} onToggle={() => setSharedDriving(!sharedDriving)} />
                </div>
              </div>
            </Section>
          )}

          {/* ── Preferences ────────────────────────────── */}
          <Section title="Preferences">
            <div className="p-4 space-y-5">
              {/* Instant booking */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium mb-0.5">Instant Booking</div>
                  <div className="text-xs text-muted-foreground">Passengers can book without approval</div>
                </div>
                <Toggle on={instantBooking} onToggle={() => setInstantBooking(!instantBooking)} />
              </div>

              {/* Gender preference */}
              <div>
                <FieldLabel>Gender Preference</FieldLabel>
                <div className="flex gap-2">
                  {[
                    { value: "any",        label: "Any" },
                    { value: "women-only", label: "Women only" },
                    { value: "men-only",   label: "Men only" },
                  ].map((pref) => (
                    <ToggleChip
                      key={pref.value}
                      active={genderPreference === pref.value}
                      onClick={() => setGenderPreference(pref.value)}
                    >
                      {pref.label}
                    </ToggleChip>
                  ))}
                </div>
              </div>

              {/* Stops */}
              <div>
                <FieldLabel>Intermediate Stops <span className="font-normal text-muted-foreground normal-case">(optional)</span></FieldLabel>
                <input
                  type="text"
                  value={stops}
                  onChange={(e) => setStops(e.target.value)}
                  placeholder="e.g., Pune, Lonavala"
                  className="w-full h-10 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">Separate multiple stops with commas</p>
              </div>
            </div>
          </Section>

          {/* ── Driver Verification ──────────────────────*/}
          <Section title="Driver Verification (Optional)">
            <div className="p-4 space-y-5">
              {profileDocsVerified ? (
                /* All profile documents are verified — no need to re-upload */
                <div className="flex items-start gap-3 border border-primary/20 bg-primary/5 rounded-sm p-4">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-primary mb-0.5">
                      Documents verified from your profile
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Your Driving License, RC, and Insurance are already on file — nothing more to upload.
                    </div>
                    <Link
                      to="/profile?tab=documents"
                      className="inline-block text-xs text-primary hover:underline mt-2"
                    >
                      Manage documents in Profile →
                    </Link>
                  </div>
                </div>
              ) : (
                /* Documents not verified in profile — show upload zones */
                <>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground border border-border rounded-sm p-3 bg-muted/30">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Uploading documents is optional but helps build trust with passengers. You can also{" "}
                      <Link to="/profile?tab=documents" className="text-primary hover:underline font-medium">
                        verify them in your Profile
                      </Link>{" "}
                      at any time.
                    </span>
                  </div>
                  <DocUpload
                    label="Driving License"
                    sublabel="Front page of your valid driving license"
                    file={licenseFile}
                    onChange={setLicenseFile}
                  />
                  <DocUpload
                    label="Vehicle Registration (RC)"
                    sublabel="RC certificate in your name or with permission to use this vehicle"
                    file={rcFile}
                    onChange={setRcFile}
                  />
                  <DocUpload
                    label="Vehicle Insurance"
                    sublabel="Third-party or comprehensive insurance document"
                    file={insuranceFile}
                    onChange={setInsuranceFile}
                  />
                  {verificationComplete && (
                    <div className="flex items-center gap-2 text-xs text-primary pt-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      All documents uploaded — verification complete
                    </div>
                  )}
                </>
              )}
            </div>
          </Section>

          {/* ── Submit ─────────────────────────────────── */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="w-full h-12 bg-primary text-primary-foreground rounded-lg font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Ride…
              </>
            ) : (
              <>
                Offer Ride
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
          {!canSubmit && !loading && (
            <p className="text-xs text-center text-muted-foreground -mt-1">
              Fill all required fields to continue.
            </p>
          )}
          </div>{/* end left form */}

          {/* ── Right: sticky map ──────────────────────── */}
          <div className="w-full lg:w-[420px] shrink-0 lg:sticky lg:top-[72px]">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">
              Route Preview {fromCoords && toCoords ? "— drag markers to adjust" : "— enter start & destination to see routes"}
            </div>
            <OfferRideMap
              fromCoords={fromCoords}
              toCoords={toCoords}
              height="400px"
              onFromChange={(coords) => {
                setFromCoords(coords);
                setFrom(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
                setSelectedRoute(null);
              }}
              onToChange={(coords) => {
                setToCoords(coords);
                setTo(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
                setSelectedRoute(null);
              }}
              onRouteSelected={(route) => {
                setSelectedRoute(route);
                recalcFromRoute(route, vehicleType, totalSeats);
              }}
            />
            {distance > 0 && (
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground px-1">
                <span className="flex items-center gap-1.5">
                  <Route className="h-3 w-3" />
                  <span className="font-medium text-foreground">{distance} km</span>
                  {selectedRoute && <span>· road distance</span>}
                </span>
                {estimatedFuelCost > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Fuel className="h-3 w-3" />
                    Fuel est. <span className="font-medium text-foreground">₹{estimatedFuelCost}</span>
                  </span>
                )}
              </div>
            )}
          </div>

        </div>{/* end flex container */}
      </main>

      <Footer />
    </div>
  );
}

/* ── Shared sub-components ─────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card rounded-lg">
      <div className="px-4 py-3 border-b border-border rounded-t-lg">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
      {icon}
      {children}
    </div>
  );
}

function OfferField({
  icon, label, value, active, onClick, placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
  placeholder?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 h-16 text-left transition-colors ${
        active
          ? "bg-accent ring-1 ring-primary"
          : placeholder
            ? "bg-muted/30 hover:bg-accent/60"
            : "hover:bg-accent/50"
      }`}
    >
      <span className={`shrink-0 ${placeholder ? "text-primary" : "text-muted-foreground"}`}>{icon}</span>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
        <div className={`text-sm truncate ${placeholder ? "text-muted-foreground/60" : "font-medium"}`}>
          {value}
        </div>
      </div>
      <ChevronDown className={`h-3 w-3 ml-auto shrink-0 ${active ? "text-primary rotate-180" : "text-muted-foreground"} transition-transform`} />
    </button>
  );
}

function ToggleChip({
  children, active, onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 h-8 text-xs font-medium border rounded-sm transition-colors ${
        active
          ? "border-primary bg-primary/5 text-foreground"
          : "border-border text-muted-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${on ? "bg-primary" : "bg-muted"}`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
          on ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function DocUpload({
  label,
  sublabel,
  file,
  onChange,
}: {
  label: string;
  sublabel: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isImage = file ? file.type.startsWith("image/") : false;
  const preview = isImage && file ? URL.createObjectURL(file) : null;

  const fmtSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div>
      <div className="text-xs font-semibold text-foreground mb-0.5">{label}</div>
      <div className="text-xs text-muted-foreground mb-2">{sublabel}</div>

      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border border-dashed border-border rounded-sm h-20 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:bg-accent hover:border-primary/50 transition-colors"
        >
          <Upload className="h-4 w-4" />
          <span className="text-xs">Click to upload — JPG, PNG, or PDF</span>
        </button>
      ) : (
        <div className="border border-border rounded-sm p-3 flex items-center gap-3 bg-muted/20">
          {isImage && preview ? (
            <img
              src={preview}
              alt={label}
              className="h-12 w-12 object-cover rounded-sm shrink-0 border border-border"
            />
          ) : (
            <div className="h-12 w-12 bg-muted/50 rounded-sm shrink-0 flex items-center justify-center border border-border">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{file.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{fmtSize(file.size)}</div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChange(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
