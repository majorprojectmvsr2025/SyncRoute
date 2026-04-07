import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { sosAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { 
  AlertTriangle, 
  Phone, 
  Loader2,
  X,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Shield
} from "lucide-react";
import { toast } from "sonner";

interface SOSButtonProps {
  rideId: string;
  isRideOngoing: boolean;
  driverName?: string;
  vehicleInfo?: string;
}

export function SOSButton({
  rideId,
  isRideOngoing,
  driverName,
  vehicleInfo
}: SOSButtonProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showNoContactDialog, setShowNoContactDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasEmergencyContact, setHasEmergencyContact] = useState<boolean | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [alertSent, setAlertSent] = useState(false);

  useEffect(() => {
    checkEmergencyContact();
  }, []);

  const checkEmergencyContact = async () => {
    try {
      const contact = await sosAPI.getEmergencyContact();
      setHasEmergencyContact(!!(contact?.phone || contact?.email));
    } catch (error) {
      setHasEmergencyContact(false);
    }
  };

  const getCurrentLocation = () => {
    return new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  const handleSOSClick = async () => {
    if (!hasEmergencyContact) {
      setShowNoContactDialog(true);
      return;
    }
    
    // Get current location while showing dialog
    const location = await getCurrentLocation();
    setCurrentLocation(location);
    setShowConfirmDialog(true);
  };

  const triggerSOS = async () => {
    setLoading(true);
    try {
      await sosAPI.trigger(rideId, currentLocation || undefined, additionalInfo || undefined);
      setAlertSent(true);
      toast.success("Emergency alert sent successfully");
      
      // Keep dialog open to show success
      setTimeout(() => {
        setShowConfirmDialog(false);
        setAlertSent(false);
        setAdditionalInfo("");
      }, 3000);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to send alert");
    } finally {
      setLoading(false);
    }
  };

  if (!isRideOngoing) {
    return null;
  }

  return (
    <>
      {/* SOS Button */}
      <button
        onClick={handleSOSClick}
        className="w-full flex items-center justify-center gap-2 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg transition-colors shadow-lg shadow-red-600/20"
      >
        <AlertTriangle className="h-6 w-6" />
        Emergency SOS
      </button>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {!alertSent ? (
              <>
                {/* Header */}
                <div className="bg-red-600 text-white p-4 flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-full">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Emergency SOS</h3>
                    <p className="text-sm text-white/80">Confirm to send alert</p>
                  </div>
                  <button
                    onClick={() => setShowConfirmDialog(false)}
                    className="ml-auto p-1 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                  <p className="text-center text-muted-foreground">
                    Are you sure you want to send an emergency alert? This will notify your emergency contacts with your current location and ride details.
                  </p>

                  {/* Location status */}
                  <div className={`flex items-center gap-2 p-3 rounded-lg ${
                    currentLocation 
                      ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" 
                      : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                  }`}>
                    <MapPin className="h-5 w-5" />
                    <span className="text-sm">
                      {currentLocation 
                        ? "Location detected" 
                        : "Location unavailable - alert will be sent without location"
                      }
                    </span>
                  </div>

                  {/* Info to include */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Additional information (optional)</label>
                    <textarea
                      value={additionalInfo}
                      onChange={(e) => setAdditionalInfo(e.target.value)}
                      placeholder="Describe your situation..."
                      className="w-full p-3 bg-muted rounded-lg text-sm resize-none h-20 outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* Alert preview */}
                  <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1 text-muted-foreground">
                    <p><strong>Alert will include:</strong></p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Your name and phone</li>
                      {currentLocation && <li>GPS location with map link</li>}
                      <li>Ride details (from/to)</li>
                      {driverName && <li>Driver: {driverName}</li>}
                      {vehicleInfo && <li>Vehicle: {vehicleInfo}</li>}
                      <li>Timestamp</li>
                    </ul>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 pt-0 flex gap-3">
                  <button
                    onClick={() => setShowConfirmDialog(false)}
                    disabled={loading}
                    className="flex-1 py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={triggerSOS}
                    disabled={loading}
                    className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <AlertTriangle className="h-5 w-5" />
                        Send Alert
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* Success state */
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold mb-2">Alert Sent!</h3>
                <p className="text-muted-foreground">
                  Your emergency contacts have been notified with your location and ride details.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No Emergency Contact Dialog */}
      {showNoContactDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Emergency Contact Required</h3>
              <p className="text-muted-foreground mb-6">
                You haven't set up emergency contact details. Please add a phone number or email to use SOS features.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNoContactDialog(false)}
                  className="flex-1 py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowNoContactDialog(false);
                    navigate("/profile?tab=settings&section=emergency");
                  }}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Setup Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SOSButton;
