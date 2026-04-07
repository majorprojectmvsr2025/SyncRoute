import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
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
  Upload, FileText, X, CheckCircle2, AlertTriangle,
  User as UserIcon,
} from "lucide-react";
import { ridesAPI, authAPI, documentsAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { DriverVerificationStatus } from "@/components/ui/DriverVerificationPanel";

const VEHICLE_TYPES = [
  { value: "Compact", label: "Compact", seats: 3, fuelPerKm: 0.05 },
  { value: "Sedan",   label: "Sedan",   seats: 3, fuelPerKm: 0.06 },
  { value: "SUV",     label: "SUV",     seats: 5, fuelPerKm: 0.08 },
  { value: "Van",     label: "Van",     seats: 7, fuelPerKm: 0.09 },
];

const FUEL_PRICE_PER_LITER = 105;

export default function OfferRide() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);

  // Driver verification state
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationStep, setVerificationStep] = useState<"license" | "vehicle" | "complete">("license");
  const [verifying, setVerifying] = useState(false);
  
  // Verification form fields
  const [drivingLicenseId, setDrivingLicenseId] = useState("");
  const [drivingLicenseFile, setDrivingLicenseFile] = useState<File | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleRegFile, setVehicleRegFile] = useState<File | null>(null);
  const [verificationVehicleType, setVerificationVehicleType] = useState("Sedan");
  const [vehiclePhotoFile, setVehiclePhotoFile] = useState<File | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");

  // Route - initialize from query params if present
  const [from, setFrom]           = useState(searchParams.get('pickup') || "");
  const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [to, setTo]               = useState(searchParams.get('destination') || "");
  const [toCoords, setToCoords]   = useState<{ lat: number; lng: number } | null>(null);
  const [activePanel, setActivePanel] = useState<"from" | "to" | "date" | "time" | null>(null);

  // Schedule - initialize from query params if present
  const [date, setDate] = useState<Date | undefined>(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parsed = new Date(dateParam);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    }
    return undefined;
  });
  const [time, setTime] = useState(searchParams.get('time') || "");

  // Vehicle & Pricing - initialize from query params if present
  const [vehicleType, setVehicleType]   = useState(searchParams.get('vehicleType') || "Sedan");
  const [vehicleModel, setVehicleModel] = useState("");
  const initialSeats = parseInt(searchParams.get('seats') || "3");
  const [totalSeats, setTotalSeats]     = useState(isNaN(initialSeats) ? 3 : initialSeats);
  const initialPrice = parseInt(searchParams.get('price') || "0");
  const [pricePerSeat, setPricePerSeat] = useState(isNaN(initialPrice) ? 0 : initialPrice);

  // Geocode prefilled locations on mount
  useEffect(() => {
    const geocodeLocation = async (locationName: string): Promise<{ lat: number; lng: number } | null> => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}, India&limit=1`
        );
        const data = await response.json();
        if (data && data.length > 0) {
          return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      }
      return null;
    };

    const initFromParams = async () => {
      const pickup = searchParams.get('pickup');
      const destination = searchParams.get('destination');
      
      if (pickup && !fromCoords) {
        const coords = await geocodeLocation(pickup);
        if (coords) {
          setFromCoords(coords);
        }
      }
      
      if (destination && !toCoords) {
        const coords = await geocodeLocation(destination);
        if (coords) {
          setToCoords(coords);
        }
      }
      
      // Show notification if prefilled
      if (pickup || destination || searchParams.get('date')) {
        toast.success("Form pre-filled from chatbot!", {
          description: "Review the details and complete your ride."
        });
      }
    };

    initFromParams();
  }, [searchParams]);

  // Ride Style / Vibe
  const [musicPreference, setMusicPreference]       = useState<"none" | "soft" | "any">("any");
  const [conversationStyle, setConversationStyle]   = useState<"chatty" | "quiet" | "flexible">("flexible");
  const [smokingAllowed, setSmokingAllowed]         = useState(false);

  // Shared Driving
  const [sharedDriving, setSharedDriving] = useState(false);

  // Duplicate ride warning
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [conflictingRide, setConflictingRide] = useState<any>(null);

  // Preferences - initialize instant booking from query params
  const [instantBooking, setInstantBooking] = useState(() => {
    const instantParam = searchParams.get('instantBooking');
    if (instantParam !== null) {
      return instantParam === 'true';
    }
    return true; // default
  });
  const [genderPreference, setGenderPreference] = useState("any");
  const [stops, setStops] = useState("");

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

  // Check if user is driver verified
  const isDriverVerified = user?.driverVerified || user?.driverVerification?.isVerified === true;

  // Validate driving license format (Indian DL format: SS-RR-YYYYNNNNNNN)
  const validateLicenseFormat = (license: string): boolean => {
    const dlPattern = /^[A-Z]{2}[- ]?\d{2}[- ]?\d{4}[- ]?\d{6,7}$/i;
    return dlPattern.test(license.replace(/\s/g, ""));
  };

  // Validate vehicle number format (Indian: SS-RR-XX-NNNN)
  const validateVehicleNumber = (number: string): boolean => {
    const rcPattern = /^[A-Z]{2}[- ]?\d{1,2}[- ]?[A-Z]{1,3}[- ]?\d{1,4}$/i;
    return rcPattern.test(number.replace(/\s/g, ""));
  };

  // Check legal driving age (18+ in India)
  const isLegalDrivingAge = (dob: string): boolean => {
    if (!dob) return false;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  };

  const handleVerificationSubmit = async () => {
    // Validate all fields first
    if (!drivingLicenseId || !validateLicenseFormat(drivingLicenseId)) {
      toast.error("Please enter a valid driving license number");
      return;
    }

    if (!dateOfBirth || !isLegalDrivingAge(dateOfBirth)) {
      toast.error("You must be at least 18 years old to offer rides");
      return;
    }

    if (!vehicleNumber || !validateVehicleNumber(vehicleNumber)) {
      toast.error("Please enter a valid vehicle registration number");
      return;
    }

    setVerifying(true);
    try {
      // Save DOB and document numbers to profile first 
      await authAPI.updateProfile({
        dateOfBirth,
        driverVerification: {
          drivingLicenseId: drivingLicenseId.toUpperCase().replace(/\s/g, ""),
          vehicleNumber: vehicleNumber.toUpperCase().replace(/\s/g, ""),
          vehicleType: verificationVehicleType,
        },
      });

      // Close modal and redirect to Profile documents section for full verification
      setShowVerificationModal(false);
      toast.info("Redirecting to complete document verification...");
      
      // Redirect to profile with documents section highlighted
      window.location.href = '/profile#documents';
      
    } catch (error: any) {
      console.error("Verification error:", error);
      toast.error(error.response?.data?.message || "Failed to save verification data");
    } finally {
      setVerifying(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Check for conflicting rides (within 60 minutes on same date)
  const checkForConflictingRides = async (): Promise<any | null> => {
    if (!date || !time) return null;
    
    try {
      const myRides = await ridesAPI.getMyRides();
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      
      // Parse new ride time
      const [newH, newM] = time.split(":").map(Number);
      const newTimeMinutes = newH * 60 + newM;
      
      for (const ride of myRides) {
        if (ride.date !== dateStr || ride.status === "completed" || ride.status === "cancelled") continue;
        
        // Parse existing ride time
        const [h, m] = (ride.departureTime || "00:00").split(":").map(Number);
        const rideTimeMinutes = h * 60 + m;
        
        // Check if within 60 minutes
        const diff = Math.abs(newTimeMinutes - rideTimeMinutes);
        if (diff <= 60) {
          return ride;
        }
      }
    } catch (err) {
      console.error("Error checking for conflicting rides:", err);
    }
    return null;
  };

  const handleSubmit = async (skipConflictCheck = false) => {
    // Check driver verification first
    if (!isDriverVerified) {
      setShowVerificationModal(true);
      return;
    }

    if (!fromCoords || !toCoords || !date || !time || !pricePerSeat) {
      toast.error("Please fill all required fields");
      return;
    }

    // Check for conflicting rides (only if not skipping)
    if (!skipConflictCheck) {
      const conflict = await checkForConflictingRides();
      if (conflict) {
        setConflictingRide(conflict);
        setShowDuplicateWarning(true);
        return;
      }
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

  const canSubmit = from && to && fromCoords && toCoords && date && time && pricePerSeat > 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* Driver Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Quick Verification Setup</h2>
                    <p className="text-xs text-muted-foreground">Enter basic info, then complete full verification</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowVerificationModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5">
                {/* Date of Birth */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0]}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">You must be 18+ to offer rides</p>
                </div>

                {/* Driving License */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                    Driving License Number *
                  </label>
                  <input
                    type="text"
                    value={drivingLicenseId}
                    onChange={(e) => setDrivingLicenseId(e.target.value.toUpperCase())}
                    placeholder="e.g., KA01 2020 0012345"
                    className="w-full h-10 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Format: SS-RR-YYYY-NNNNNNN</p>
                </div>

                {/* License Image Upload */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                    Driving License Photo (Optional)
                  </label>
                  <div className="border border-dashed border-border rounded-sm p-4">
                    {drivingLicenseFile ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-sm truncate">{drivingLicenseFile.name}</span>
                        </div>
                        <button
                          onClick={() => setDrivingLicenseFile(null)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-2 cursor-pointer">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Click to upload license image</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => setDrivingLicenseFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Vehicle Number */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                    Vehicle Registration Number *
                  </label>
                  <input
                    type="text"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                    placeholder="e.g., KA01 AB 1234"
                    className="w-full h-10 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Format: SS-RR-XX-NNNN</p>
                </div>

                {/* Vehicle Registration Upload */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                    Vehicle Registration Document (Optional)
                  </label>
                  <div className="border border-dashed border-border rounded-sm p-4">
                    {vehicleRegFile ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-sm truncate">{vehicleRegFile.name}</span>
                        </div>
                        <button
                          onClick={() => setVehicleRegFile(null)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-2 cursor-pointer">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Click to upload RC document</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => setVehicleRegFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Vehicle Type */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                    Vehicle Type
                  </label>
                  <select
                    value={verificationVehicleType}
                    onChange={(e) => setVerificationVehicleType(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="Compact">Compact</option>
                    <option value="Sedan">Sedan</option>
                    <option value="SUV">SUV</option>
                    <option value="Van">Van</option>
                    <option value="Motorcycle">Motorcycle</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowVerificationModal(false)}
                  className="flex-1 h-10 border border-border rounded-sm text-sm font-medium hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerificationSubmit}
                  disabled={verifying || !drivingLicenseId || !vehicleNumber || !dateOfBirth}
                  className="flex-1 h-10 bg-primary text-primary-foreground rounded-sm text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4" />
                      Continue to Verification
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-center text-muted-foreground mt-4">
                After this, you'll upload documents for OCR verification in your profile.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Ride Warning Modal */}
      {showDuplicateWarning && conflictingRide && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Ride Already Scheduled</h2>
                <p className="text-xs text-muted-foreground">You have a ride around this time</p>
              </div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <div className="text-sm font-medium mb-1">
                {conflictingRide.from?.name || "Start"} → {conflictingRide.to?.name || "End"}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(conflictingRide.date).toLocaleDateString("en-IN", { 
                  day: "numeric", month: "short", year: "numeric" 
                })} at {conflictingRide.departureTime}
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6">
              You already have a ride scheduled around this time. Are you sure you want to create another ride?
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDuplicateWarning(false);
                  setConflictingRide(null);
                }}
                className="flex-1 h-10 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDuplicateWarning(false);
                  setConflictingRide(null);
                  handleSubmit(true); // Skip conflict check
                }}
                className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel overlay */}
      {activePanel && (
        <div className="fixed inset-0 bg-background/80 z-30" onClick={() => setActivePanel(null)} />
      )}

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <div className="mb-8">
          <h1 className="text-xl font-semibold mb-1">Offer a Ride</h1>
          <p className="text-sm text-muted-foreground">Share your journey and split the cost.</p>
        </div>

        {/* Driver verification status - using shared component */}
        <div className="mb-6">
          <DriverVerificationStatus
            isVerified={isDriverVerified}
            onClick={() => setShowVerificationModal(true)}
          />
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
