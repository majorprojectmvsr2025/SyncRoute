import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LocationPanel } from "@/components/search/LocationPanel";
import { DateSelector } from "@/components/search/DateSelector";
import { TimeSelector } from "@/components/search/TimeSelector";
import { OfferRideMap, type OsrmRoute } from "@/components/map/OfferRideMap";
import {
  MapPin, Calendar, Clock, Car, IndianRupee,
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

  // Refresh user from server on mount so verification status is always current
  useEffect(() => {
    const refreshUser = async () => {
      try {
        const freshUser = await authAPI.getCurrentUser();
        updateUser(freshUser);
      } catch { /* silent — use cached user */ }
    };
    refreshUser();
  }, []);

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

  // Validate driving license format (Indian DL format: SS-RRR-YYYYNNNNNNN)
  const validateLicenseFormat = (license: string): boolean => {
    const dlPattern = /^[A-Z]{2}[- ]?\d{3}[- ]?\d{4}[- ]?\d{6,7}$/i;
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
          <div className="bg-card border border-border/50 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            style={{ boxShadow: "0 24px 64px -12px rgba(0,0,0,0.2)" }}>
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
                    className="w-full h-10 px-3 text-sm border border-border/50 rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/40 transition-all"
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
                    className="w-full h-10 px-3 text-sm border border-border/50 rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/40 transition-all font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Format: SS-RR-YYYY-NNNNNNN</p>
                </div>

                {/* License Image Upload — REQUIRED */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                    Driving License Photo <span className="text-destructive">*</span>
                  </label>
                  <div className={`border-2 border-dashed rounded-xl p-4 transition-all duration-200 ${drivingLicenseFile ? "border-success/40 bg-success/5" : "border-destructive/30 bg-destructive/5 hover:border-destructive/50"}`}>
                    {drivingLicenseFile ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                          <span className="text-sm font-medium text-foreground truncate">{drivingLicenseFile.name}</span>
                        </div>
                        <button onClick={() => setDrivingLicenseFile(null)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-2 cursor-pointer">
                        <Upload className="h-6 w-6 text-destructive" />
                        <span className="text-xs text-center"><span className="text-destructive font-semibold">REQUIRED:</span> Click to upload DL photo</span>
                        <span className="text-[10px] text-muted-foreground">JPG, PNG or PDF • Max 5MB</span>
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setDrivingLicenseFile(e.target.files?.[0] || null)} />
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
                    className="w-full h-10 px-3 text-sm border border-border/50 rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/40 transition-all font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Format: SS-RR-XX-NNNN</p>
                </div>

                {/* Vehicle Registration Upload — REQUIRED */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                    Vehicle RC Document <span className="text-destructive">*</span>
                  </label>
                  <div className={`border-2 border-dashed rounded-xl p-4 transition-all duration-200 ${vehicleRegFile ? "border-success/40 bg-success/5" : "border-destructive/30 bg-destructive/5 hover:border-destructive/50"}`}>
                    {vehicleRegFile ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                          <span className="text-sm font-medium text-foreground truncate">{vehicleRegFile.name}</span>
                        </div>
                        <button onClick={() => setVehicleRegFile(null)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-2 cursor-pointer">
                        <Upload className="h-6 w-6 text-destructive" />
                        <span className="text-xs text-center"><span className="text-destructive font-semibold">REQUIRED:</span> Click to upload RC document</span>
                        <span className="text-[10px] text-muted-foreground">JPG, PNG or PDF • Max 5MB</span>
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setVehicleRegFile(e.target.files?.[0] || null)} />
                      </label>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    ✓ Both DL and RC documents are mandatory for driver verification
                  </p>
                </div>

                {/* Vehicle Type */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                    Vehicle Type
                  </label>
                  <select
                    value={verificationVehicleType}
                    onChange={(e) => setVerificationVehicleType(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-border/50 rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/40 transition-all"
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
                  className="flex-1 h-10 border border-border/50 rounded-xl text-sm font-medium hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerificationSubmit}
                  disabled={verifying || !drivingLicenseId || !vehicleNumber || !dateOfBirth || !drivingLicenseFile || !vehicleRegFile}
                  className="flex-1 h-10 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
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
                DL photo and RC document are required for OCR verification.
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
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-30" onClick={() => setActivePanel(null)} />
      )}

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Car className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Offer a Ride</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-12">Share your journey and split the fuel cost.</p>
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
          <Section title="Route" icon={<MapPin className="h-4 w-4" />} step={1}>
            <div className="p-1">
              <OfferField
                icon={
                  <div className="h-8 w-8 rounded-full bg-success/15 border-2 border-success/30 flex items-center justify-center shrink-0">
                    <div className="h-2.5 w-2.5 rounded-full bg-success" />
                  </div>
                }
                label="Pickup"
                value={from}
                placeholder="Where are you starting from?"
                active={activePanel === "from"}
                onClick={() => setActivePanel(activePanel === "from" ? null : "from")}
                filled={!!from}
              />
              <div className="flex items-center gap-3 px-4 py-1">
                <div className="w-8 flex justify-center">
                  <div className="w-0.5 h-5 bg-border" />
                </div>
              </div>
              <OfferField
                icon={
                  <div className="h-8 w-8 rounded-full bg-destructive/15 border-2 border-destructive/30 flex items-center justify-center shrink-0">
                    <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
                  </div>
                }
                label="Drop-off"
                value={to}
                placeholder="Where are you going?"
                active={activePanel === "to"}
                onClick={() => setActivePanel(activePanel === "to" ? null : "to")}
                filled={!!to}
              />
              {activePanel === "from" && (
                <div className="mt-2 portal-panel overflow-hidden" style={{ zIndex: 40, position: "relative" }}>
                  <LocationPanel type="from" onSelect={handleFromSelect} onClose={() => setActivePanel(null)} />
                </div>
              )}
              {activePanel === "to" && (
                <div className="mt-2 portal-panel overflow-hidden" style={{ zIndex: 40, position: "relative" }}>
                  <LocationPanel type="to" onSelect={handleToSelect} onClose={() => setActivePanel(null)} />
                </div>
              )}
            </div>
          </Section>

          {/* ── Schedule ───────────────────────────────── */}
          <Section title="Schedule" icon={<Calendar className="h-4 w-4" />} step={2}>
            <div className="p-1">
              <div className="grid grid-cols-2 gap-1">
                <OfferField
                  id="offer-date-field"
                  icon={
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                  }
                  label="Date"
                  value={date ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                  placeholder="Pick a date"
                  active={activePanel === "date"}
                  onClick={() => setActivePanel(activePanel === "date" ? null : "date")}
                  filled={!!date}
                />
                <OfferField
                  icon={
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                  }
                  label="Departure"
                  value={time}
                  placeholder="Set time"
                  active={activePanel === "time"}
                  onClick={() => setActivePanel(activePanel === "time" ? null : "time")}
                  filled={!!time}
                  id="offer-time-field"
                />
              </div>
              {activePanel === "date" && (
                <DateSelector
                  selected={date}
                  onSelect={(d) => { setDate(d); setActivePanel(null); }}
                  onClose={() => setActivePanel(null)}
                  anchorId="offer-date-field"
                />
              )}
              {activePanel === "time" && (
                <TimeSelector
                  selected={time}
                  onSelect={(t) => { setTime(t); setActivePanel(null); }}
                  onClose={() => setActivePanel(null)}
                  anchorId="offer-time-field"
                />
              )}
            </div>
          </Section>

          {/* ── Vehicle & Pricing ──────────────────────── */}
          <Section title="Vehicle & Pricing" icon={<Car className="h-4 w-4" />} step={3}>
            <div className="p-4 space-y-6">
              <div>
                <FieldLabel>Vehicle Type</FieldLabel>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {VEHICLE_TYPES.map((v) => (
                    <button
                      key={v.value}
                      onClick={() => { setVehicleType(v.value); setTotalSeats(v.seats); }}
                      className={`relative p-3.5 rounded-xl border-2 text-left transition-all duration-200 ${
                        vehicleType === v.value
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-foreground/20 hover:bg-accent/50"
                      }`}
                    >
                      {vehicleType === v.value && (
                        <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                      <Car className={`h-5 w-5 mb-2 ${vehicleType === v.value ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="text-sm font-semibold">{v.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{v.seats} seats max</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Vehicle Model <span className="font-normal text-muted-foreground normal-case ml-1">(optional)</span></FieldLabel>
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="e.g., Honda City, Maruti Swift"
                  className="w-full h-11 px-4 text-sm border border-border/50 rounded-xl bg-background focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/40"
                />
              </div>

              <div>
                <FieldLabel>Available Seats</FieldLabel>
                <div className="flex items-center gap-3">
                  <button onClick={() => setTotalSeats(Math.max(1, totalSeats - 1))}
                    className="h-11 w-11 rounded-xl border border-border/50 hover:border-border hover:bg-accent transition-all flex items-center justify-center text-xl font-medium">−</button>
                  <div className="w-16 h-11 border border-border/50 rounded-xl flex items-center justify-center font-display font-bold text-xl">{totalSeats}</div>
                  <button onClick={() => setTotalSeats(Math.min(7, totalSeats + 1))}
                    className="h-11 w-11 rounded-xl border border-border/50 hover:border-border hover:bg-accent transition-all flex items-center justify-center text-xl font-medium">+</button>
                  <span className="text-sm text-muted-foreground">{totalSeats === 1 ? "seat" : "seats"} available</span>
                </div>
              </div>

              {distance > 0 && (
                <div className="rounded-xl border border-border/40 bg-muted/20 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border/30 bg-muted/30">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Route Estimate</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2"><Route className="h-3.5 w-3.5" />Distance</span>
                      <span className="text-sm font-semibold">{distance} km</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2"><Fuel className="h-3.5 w-3.5" />Fuel cost (est.)</span>
                      <span className="text-sm font-semibold">₹{estimatedFuelCost}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-border/30">
                      <span className="text-sm text-muted-foreground">Suggested / seat</span>
                      <span className="text-base font-bold text-primary">₹{suggestedPrice}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <FieldLabel>Price per Seat</FieldLabel>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <IndianRupee className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <input
                    type="number"
                    value={pricePerSeat || ""}
                    onChange={(e) => setPricePerSeat(parseInt(e.target.value) || 0)}
                    min="0"
                    placeholder="0"
                    className="w-full h-14 pl-14 pr-24 text-2xl font-display font-bold border border-border/50 rounded-xl bg-background focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/30"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">per seat</div>
                </div>
                {pricePerSeat > 0 && (
                  <div className="mt-2 flex items-center justify-between px-1">
                    <p className="text-xs text-muted-foreground">{totalSeats} seat{totalSeats > 1 ? "s" : ""} × ₹{pricePerSeat}</p>
                    <p className="text-sm font-semibold text-success">₹{pricePerSeat * totalSeats} total earnings</p>
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* ── Ride Style (Vibe) ──────────────────────── */}
          <Section title="Ride Vibe" icon={<Music className="h-4 w-4" />} step={4}>
            <div className="p-4 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <FieldLabel icon={<Music className="h-3.5 w-3.5" />}>Music</FieldLabel>
                  <div className="flex gap-2">
                    {([{ value: "none", label: "None" }, { value: "soft", label: "Soft" }, { value: "any", label: "Any" }] as const).map((opt) => (
                      <ToggleChip key={opt.value} active={musicPreference === opt.value} onClick={() => setMusicPreference(opt.value)}>{opt.label}</ToggleChip>
                    ))}
                  </div>
                </div>
                <div>
                  <FieldLabel icon={<MessageCircle className="h-3.5 w-3.5" />}>Conversation</FieldLabel>
                  <div className="flex gap-2">
                    {([{ value: "chatty", label: "Chatty" }, { value: "quiet", label: "Quiet" }, { value: "flexible", label: "Flexible" }] as const).map((opt) => (
                      <ToggleChip key={opt.value} active={conversationStyle === opt.value} onClick={() => setConversationStyle(opt.value)}>{opt.label}</ToggleChip>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/40 hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                    <Wind className="h-4 w-4 text-muted-foreground" />
                  </div>
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
            <Section title="Shared Driving" icon={<Shuffle className="h-4 w-4" />}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border border-border/40 hover:bg-accent/30 transition-colors">
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Shuffle className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-0.5">Allow co-driving</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">For long routes, passengers with a valid license can share driving.</p>
                    </div>
                  </div>
                  <Toggle on={sharedDriving} onToggle={() => setSharedDriving(!sharedDriving)} />
                </div>
              </div>
            </Section>
          )}

          {/* ── Preferences ────────────────────────────── */}
          <Section title="Preferences" icon={<UserIcon className="h-4 w-4" />}>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/40 hover:bg-accent/30 transition-colors">
                <div>
                  <div className="text-sm font-medium">Instant Booking</div>
                  <div className="text-xs text-muted-foreground">Passengers book without your approval</div>
                </div>
                <Toggle on={instantBooking} onToggle={() => setInstantBooking(!instantBooking)} />
              </div>
              <div>
                <FieldLabel>Passenger Gender</FieldLabel>
                <div className="flex gap-2 flex-wrap">
                  {[{ value: "any", label: "Any" }, { value: "women-only", label: "Women only" }, { value: "men-only", label: "Men only" }].map((pref) => (
                    <ToggleChip key={pref.value} active={genderPreference === pref.value} onClick={() => setGenderPreference(pref.value)}>{pref.label}</ToggleChip>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>Intermediate Stops <span className="font-normal text-muted-foreground normal-case ml-1">(optional)</span></FieldLabel>
                <input
                  type="text"
                  value={stops}
                  onChange={(e) => setStops(e.target.value)}
                  placeholder="e.g., Pune, Lonavala (comma-separated)"
                  className="w-full h-11 px-4 text-sm border-2 border-border rounded-xl bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/50"
                />
              </div>
            </div>
          </Section>

          {/* ── Submit ─────────────────────────────────── */}
          <button
            onClick={() => handleSubmit()}
            disabled={!canSubmit || loading}
            className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-semibold text-base flex items-center justify-center gap-2.5 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
          >
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin" />Creating Ride…</>
            ) : (
              <><Car className="h-5 w-5" />Offer this Ride<ArrowRight className="h-5 w-5" /></>
            )}
          </button>
          {!canSubmit && !loading && (
            <p className="text-xs text-center text-muted-foreground -mt-2">
              {!from || !to ? "Add pickup and drop-off locations" : !date ? "Select a departure date" : !time ? "Set a departure time" : !pricePerSeat ? "Set a price per seat" : "Fill all required fields"}
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

function Section({ title, icon, step, children }: { title: string; icon?: React.ReactNode; step?: number; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden"
      style={{ boxShadow: "0 2px 12px -2px rgba(0,0,0,0.06), 0 1px 3px -1px rgba(0,0,0,0.04)" }}>
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/40 bg-muted/10">
        {step && (
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">{step}</span>
          </div>
        )}
        {icon && !step && <span className="text-muted-foreground/70">{icon}</span>}
        <h2 className="text-sm font-semibold text-foreground tracking-tight">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
      {icon}
      {children}
    </div>
  );
}

function OfferField({
  id, icon, label, value, placeholder, active, onClick, filled,
}: {
  id?: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  placeholder: string;
  active: boolean;
  onClick: () => void;
  filled?: boolean;
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all duration-150 rounded-xl ${
        active
          ? "bg-primary/[0.04] ring-2 ring-primary/20"
          : "hover:bg-accent/50"
      }`}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60 mb-0.5">{label}</div>
        <div className={`text-sm font-semibold truncate ${filled ? "text-foreground" : "text-muted-foreground/40"}`}>
          {filled ? value : placeholder}
        </div>
      </div>
      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${active ? "rotate-180 text-primary" : "text-muted-foreground/30"}`} />
    </button>
  );
}

function ToggleChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 h-9 text-sm font-medium rounded-xl border-2 transition-all duration-150 ${
        active
          ? "border-primary bg-primary/8 text-foreground shadow-sm"
          : "border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground hover:bg-accent/50"
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
      className={`w-12 h-6 rounded-full transition-all duration-200 relative shrink-0 ${on ? "bg-primary" : "bg-muted-foreground/25"}`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
          on ? "translate-x-6" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
