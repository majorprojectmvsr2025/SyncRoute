import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ridesAPI, bookingsAPI, authAPI, reviewsAPI, documentsAPI, sosAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  LogOut,
  Settings,
  BookmarkCheck,
  Users,
  Car,
  Edit,
  X,
  Star as StarIcon,
  Upload,
  CheckCircle2,
  ShieldCheck,
  FileText,
  AlertCircle,
  Loader2,
  Shield,
  Eye,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Phone,
  Mail,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/reviews/StarRating";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDistanceToNow } from "date-fns";
import { RideStatsDashboard } from "@/components/ui/RideStatsDashboard";
import { DriverVerificationPanel } from "@/components/ui/DriverVerificationPanel";

const tabs = [
  { id: "my-rides", label: "My Rides", icon: Car },
  { id: "bookings", label: "My Bookings", icon: BookmarkCheck },
  { id: "ride-bookings", label: "Ride Bookings", icon: Users },
  { id: "reviews", label: "Reviews", icon: StarIcon },
  { id: "documents", label: "Documents", icon: ShieldCheck },
  { id: "stats", label: "Statistics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

type TabId = typeof tabs[number]["id"];

export default function Profile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout, updateUser } = useAuth();

  const initialTab = (searchParams.get("tab") as TabId) || "my-rides";
  const validTabs = tabs.map((t) => t.id);
  const [activeTab, setActiveTab] = useState<TabId>(
    validTabs.includes(initialTab as typeof tabs[number]["id"]) ? initialTab : "my-rides"
  );
  
  // Ref for documents section to enable auto-scroll
  const documentsRef = useRef<HTMLDivElement>(null);
  
  // Handle navigation to documents section from hash or query param
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    const tabParam = searchParams.get("tab");
    
    if (hash === 'documents' || tabParam === 'documents') {
      setActiveTab('documents');
      
      // Scroll to documents section after a short delay to allow rendering
      setTimeout(() => {
        if (documentsRef.current) {
          documentsRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
          
          // Add a subtle highlight animation to draw attention
          documentsRef.current.style.background = 'rgba(34, 197, 94, 0.05)';
          documentsRef.current.style.border = '2px solid rgba(34, 197, 94, 0.2)';
          documentsRef.current.style.borderRadius = '12px';
          documentsRef.current.style.padding = '16px';
          documentsRef.current.style.transition = 'all 0.3s ease';
          
          // Remove highlight after 3 seconds
          setTimeout(() => {
            if (documentsRef.current) {
              documentsRef.current.style.background = '';
              documentsRef.current.style.border = '';
              documentsRef.current.style.borderRadius = '';
              documentsRef.current.style.padding = '';
            }
          }, 3000);
        }
      }, 100);
    }
  }, [searchParams]);
  
  const [myRides, setMyRides] = useState<any[]>([]);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [rideBookings, setRideBookings] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editRole, setEditRole] = useState("passenger");
  const [editVehicleModel, setEditVehicleModel] = useState("");
  const [editGender, setEditGender] = useState<"male" | "female" | "prefer_not_to_say" | "other">("prefer_not_to_say");
  const [editPhoto, setEditPhoto] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Emergency contact state
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyEmail, setEmergencyEmail] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  
  // Document number state
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState("");
  const [vehicleRegistrationNumber, setVehicleRegistrationNumber] = useState("");
  
  // Date of Birth state
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [dobError, setDobError] = useState("");
  const [emergencyRelationship, setEmergencyRelationship] = useState("");
  const [savingEmergency, setSavingEmergency] = useState(false);

  // Document verification
  const [docSaving, setDocSaving] = useState<string | null>(null);
  const [showAdditionalDocs, setShowAdditionalDocs] = useState(false);

  // Ride/booking filters
  const [showCompletedRides, setShowCompletedRides] = useState(false);
  const [showCompletedBookings, setShowCompletedBookings] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/sign-in");
      return;
    }
    loadData();
    // Load emergency contact if available
    if (user.emergencyContact) {
      setEmergencyPhone(user.emergencyContact.phone || "");
      setEmergencyEmail(user.emergencyContact.email || "");
      setEmergencyName(user.emergencyContact.name || "");
      setEmergencyRelationship(user.emergencyContact.relationship || "");
    }
    
    // Load document numbers from verification data
    if (user.driverVerification) {
      setDrivingLicenseNumber(user.driverVerification.drivingLicenseId || "");
      setVehicleRegistrationNumber(user.driverVerification.vehicleNumber || "");
    }
    
    // Load date of birth
    if (user.dateOfBirth) {
      const dobDate = new Date(user.dateOfBirth);
      setDateOfBirth(dobDate.toISOString().split('T')[0]); // Format as YYYY-MM-DD
    }
  }, [user]);

  // Refresh user from server — called after verification so status updates immediately
  const refreshUser = async () => {
    try {
      const freshUser = await authAPI.getCurrentUser();
      updateUser(freshUser);
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [rides, bookings, driverBookings, userReviews] = await Promise.all([
        ridesAPI.getMyRides(),
        bookingsAPI.getMyBookings(),
        bookingsAPI.getRideBookings(),
        reviewsAPI.getByUser(user!._id),
      ]);
      setMyRides(rides);
      setMyBookings(bookings);
      setRideBookings(driverBookings);
      setReviews(Array.isArray(userReviews) ? userReviews : (userReviews.reviews || []));
    } catch (error) {
      console.error("Load data error:", error);
      toast.error("Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptBooking = async (bookingId: string) => {
    try {
      await bookingsAPI.confirm(bookingId);
      toast.success("Booking accepted successfully");
      loadData(); // Reload to update the list
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to accept booking");
    }
  };

  const handleRejectBooking = async (bookingId: string) => {
    try {
      await bookingsAPI.reject(bookingId);
      toast.success("Booking rejected");
      loadData(); // Reload to update the list
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to reject booking");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleEditStart = () => {
    setEditName(user!.name);
    setEditPhone(user!.phone || "");
    setEditBio((user as any)?.bio || "");
    setEditRole(user!.role || "passenger");
    setEditVehicleModel((user as any)?.vehicle?.model || "");
    setEditGender((user as any)?.gender || "prefer_not_to_say");
    setEditPhoto(user!.photo || "");
    setEditMode(true);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setUploadingPhoto(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setEditPhoto(base64String);
        toast.success("Photo selected. Click 'Save Changes' to update.");
      };
      reader.onerror = () => {
        toast.error("Failed to read image file");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Failed to process image");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setEditPhoto("");
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
    toast.success("Photo removed. Click 'Save Changes' to update.");
  };

  // Date of Birth validation
  const validateDOB = async (dob: string): Promise<boolean> => {
    setDobError("");
    
    if (!dob) {
      setDobError("Date of birth is required");
      return false;
    }
    
    try {
      // Check if the date string is complete (YYYY-MM-DD format)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dob)) {
        setDobError("Please enter a complete date (YYYY-MM-DD)");
        return false;
      }
      
      const dobDate = new Date(dob);
      if (isNaN(dobDate.getTime())) {
        setDobError("Please enter a valid date");
        return false;
      }
      
      // Additional check: ensure the date string actually represents the created date
      // This prevents issues like "2024-02-30" being converted to "2024-03-01"
      const isoString = dobDate.toISOString().split('T')[0];
      if (isoString !== dob) {
        setDobError("Please enter a valid date");
        return false;
      }
      
      // Check if date is not in the future
      const today = new Date();
      if (dobDate > today) {
        setDobError("Date of birth cannot be in the future");
        return false;
      }
      
      // Check if date is not too far in the past (reasonable birth year range)
      const currentYear = today.getFullYear();
      const birthYear = dobDate.getFullYear();
      if (birthYear < currentYear - 100) {
        setDobError("Please enter a valid birth year");
        return false;
      }
      
      // Call backend validation for age check
      const result = await documentsAPI.validateAge(dob);
      
      if (!result.valid) {
        setDobError(result.message);
        return false;
      }
      
      toast.success(`Age verified: ${result.age} years old`);
      return true;
    } catch (error: any) {
      setDobError("Failed to validate age");
      return false;
    }
  };
  
  const handleDOBChange = async (value: string) => {
    setDateOfBirth(value);
    setDobError(""); // Clear any previous errors
    
    // Only validate if we have a complete date (YYYY-MM-DD format)
    if (value && value.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const isValid = await validateDOB(value);
      if (isValid) {
        // Auto-save DOB to user profile
        handleDOBSave(value);
      }
    } else if (value && value.length > 0) {
      // Show a hint for incomplete dates
      if (value.length < 10) {
        setDobError("Please complete the date entry");
      }
    }
  };
  
  const handleDOBSave = async (dobValue: string) => {
    try {
      const result = await authAPI.updateProfile({
        dateOfBirth: dobValue,
      });
      updateUser(result);
    } catch (error: any) {
      toast.error("Failed to save date of birth");
    }
  };

  const handleEditCancel = () => {
    setEditMode(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const result = await authAPI.updateProfile({
        name: editName,
        phone: editPhone,
        bio: editBio,
        role: editRole,
        gender: editGender,
        photo: editPhoto,
        vehicle: editVehicleModel ? { model: editVehicleModel } : undefined,
      });
      updateUser(result);
      setEditMode(false);
      toast.success("Profile updated successfully");
    } catch (error: any) {
      console.error("Update profile error:", error);
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmergencyContact = async () => {
    if (!emergencyPhone && !emergencyEmail) {
      toast.error("Please provide at least one emergency contact method");
      return;
    }
    setSavingEmergency(true);
    try {
      const result = await sosAPI.updateEmergencyContact({
        phone: emergencyPhone,
        email: emergencyEmail,
        name: emergencyName,
        relationship: emergencyRelationship,
      });
      // Update the local user context with the new emergency contact
      if (user && result.emergencyContact) {
        updateUser({ ...user, emergencyContact: result.emergencyContact });
      }
      toast.success("Emergency contact updated");
    } catch (error: any) {
      console.error("Update emergency contact error:", error);
      toast.error(error.response?.data?.message || "Failed to update emergency contact");
    } finally {
      setSavingEmergency(false);
    }
  };

  const handleVerifyDoc = async (field: "licenseVerified" | "rcVerified") => {
    setDocSaving(field);
    try {
      const result = await authAPI.updateProfile({
        documents: { [field]: true },
      });
      updateUser(result);
      toast.success("Document marked as verified");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to verify document");
    } finally {
      setDocSaving(null);
    }
  };

  // Handle document removal - also revokes driver verification for mandatory docs
  const handleUnverifyDoc = async (field: string) => {
    // Map field name to document type
    const fieldToDocType: { [key: string]: "license" | "rc" } = {
      "licenseVerified": "license",
      "rcVerified": "rc"
    };
    
    const docType = fieldToDocType[field];
    if (!docType) {
      toast.error("Invalid document type");
      return;
    }
    
    // Check if this is a mandatory document
    const mandatoryDocs = ["licenseVerified", "rcVerified"];
    const isMandatory = mandatoryDocs.includes(field);
    
    // Show confirmation for mandatory documents
    if (isMandatory) {
      const confirmed = window.confirm(
        "⚠️ Removing this document will revoke your driver verification status.\n\n" +
        "You will need to re-verify before creating rides.\n\n" +
        "Are you sure you want to continue?"
      );
      if (!confirmed) return;
    }
    
    setDocSaving(field);
    try {
      // Use the new dedicated delete endpoint
      const result = await documentsAPI.deleteDocument(docType);
      
      // Update user state with the response
      if (result.user) {
        const updatedUser = {
          ...user,
          documents: result.user.documents,
          driverVerification: result.user.driverVerification
        };
        updateUser(updatedUser);
      } else {
        // Fallback to original method if new endpoint fails
        const updatePayload: any = {
          documents: { [field]: false },
        };
        
        // If removing a mandatory document, also revoke driver verification
        if (isMandatory) {
          updatePayload.driverVerification = {
            isVerified: false,
            verifiedAt: null,
          };
          // Clear related extracted data
          if (field === "licenseVerified") {
            updatePayload.driverVerification.drivingLicenseId = null;
            updatePayload.driverVerification.licenseExpiry = null;
          }
          if (field === "rcVerified") {
            updatePayload.driverVerification.vehicleNumber = null;
          }
        }
        
        const fallbackResult = await authAPI.updateProfile(updatePayload);
        updateUser(fallbackResult);
      }
      
      // Show appropriate message
      toast.success(result.message || (isMandatory ? "Document removed. Driver verification has been revoked." : "Document removed"));
      
    } catch (error: any) {
      console.error("Document deletion error:", error);
      toast.error(error.response?.data?.message || "Failed to remove document");
    } finally {
      setDocSaving(null);
    }
  };

  if (!user) {
    return null;
  }

  const userInitials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
      : 0;

  // Calculate total completed trips from actual data
  const now = new Date();
  const completedRidesCount = myRides.filter((ride) => {
    const rideDateTime = new Date(ride.date);
    if (ride.departureTime) {
      const [h, m] = ride.departureTime.split(":").map(Number);
      rideDateTime.setHours(h, m, 0, 0);
    }
    return rideDateTime < now;
  }).length;

  const completedBookingsCount = myBookings.filter((booking) => {
    if (!booking.ride?.date) return false;
    const rideDateTime = new Date(booking.ride.date);
    if (booking.ride.departureTime) {
      const [h, m] = booking.ride.departureTime.split(":").map(Number);
      rideDateTime.setHours(h, m, 0, 0);
    }
    return rideDateTime < now && booking.status !== "cancelled";
  }).length;

  const totalCompletedTrips = completedRidesCount + completedBookingsCount;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4">

        {/* Profile Header */}
        {editMode ? (
          <div className="border border-border bg-card rounded-sm p-5 mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Edit Profile</h2>
              <button
                onClick={handleEditCancel}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Profile Photo Upload */}
            <div className="flex items-center gap-4 pb-4 border-b border-border">
              <div className="h-20 w-20 rounded-sm bg-muted flex items-center justify-center text-2xl font-mono font-semibold shrink-0 overflow-hidden relative group">
                {editPhoto ? (
                  <>
                    <img
                      src={editPhoto}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={handleRemovePhoto}
                        className="text-white hover:text-destructive transition-colors"
                        title="Remove photo"
                      >
                        <X className="h-6 w-6" />
                      </button>
                    </div>
                  </>
                ) : (
                  userInitials
                )}
              </div>
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-2">
                  Profile Photo
                </label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  disabled={uploadingPhoto}
                  className="hidden"
                  id="photo-upload"
                />
                <div className="flex gap-2">
                  <label
                    htmlFor="photo-upload"
                    className={`flex items-center gap-2 h-9 px-4 border border-border text-xs rounded-sm hover:bg-accent transition-colors cursor-pointer ${
                      uploadingPhoto ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {uploadingPhoto ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3 w-3" />
                        {editPhoto ? "Change Photo" : "Upload Photo"}
                      </>
                    )}
                  </label>
                  {editPhoto && (
                    <button
                      onClick={handleRemovePhoto}
                      className="h-9 px-4 border border-border text-xs rounded-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  JPG, PNG or GIF. Max 5MB.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-9 px-3 bg-background border border-border rounded-sm text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full h-9 px-3 bg-background border border-border rounded-sm text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full h-9 px-3 bg-background border border-border rounded-sm text-sm focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="passenger">Passenger</option>
                  <option value="driver">Driver</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">
                  Gender
                </label>
                <select
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value as "male" | "female" | "prefer_not_to_say" | "other")}
                  className="w-full h-9 px-3 bg-background border border-border rounded-sm text-sm focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">
                  Vehicle Model
                </label>
                <input
                  type="text"
                  value={editVehicleModel}
                  onChange={(e) => setEditVehicleModel(e.target.value)}
                  placeholder="e.g. Toyota Innova"
                  className="w-full h-9 px-3 bg-background border border-border rounded-sm text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">
                Bio{" "}
                <span className="normal-case font-normal">
                  ({editBio.length}/300)
                </span>
              </label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="Tell riders a little about yourself..."
                className="w-full px-3 py-2 bg-background border border-border rounded-sm text-sm focus:outline-none focus:border-primary transition-colors resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="h-9 px-5 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={handleEditCancel}
                className="h-9 px-5 border border-border text-sm rounded-sm hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 mb-6">
            <div className="h-14 w-14 rounded-sm bg-muted flex items-center justify-center text-lg font-mono font-semibold shrink-0">
              {user.photo ? (
                <img
                  src={user.photo}
                  alt={user.name}
                  className="h-full w-full object-cover rounded-sm"
                />
              ) : (
                userInitials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-lg font-semibold">{user.name}</h1>
                {(user.driverVerification?.isVerified || (user.documents?.licenseVerified && user.documents?.rcVerified)) && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-medium">
                    <ShieldCheck className="h-3 w-3" />
                    Verified Driver
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {user.role === "driver" ? "Driver" : "Passenger"} · {totalCompletedTrips} trips
                {((user as any).reviewStats?.totalReviews > 0 || (user as any).reliabilityScore?.totalRatings > 0) && (
                  <> · ⭐ {((user as any).reviewStats?.avgStars || (user as any).reliabilityScore?.avgRating || user.rating)?.toFixed(1)}</>
                )}
                {(user as any)?.gender && (user as any).gender !== "prefer_not_to_say" && (
                  <> · {(user as any).gender === "male" ? "♂" : (user as any).gender === "female" ? "♀" : "⚧"}</>
                )}
              </p>
            </div>
            <button
              onClick={handleEditStart}
              className="flex items-center gap-1.5 h-8 px-3 border border-border text-xs rounded-sm hover:bg-accent transition-colors shrink-0"
            >
              <Edit className="h-3 w-3" /> Edit Profile
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border mb-4 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-system whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="border border-border divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="space-y-1.5 text-right">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-16 rounded-sm" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {activeTab === "my-rides" && (
              <div className="space-y-4">
                {/* Filter tabs for my rides */}
                <div className="flex gap-2 border-b border-border pb-2">
                  <button
                    onClick={() => setShowCompletedRides(false)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      !showCompletedRides ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    Upcoming
                  </button>
                  <button
                    onClick={() => setShowCompletedRides(true)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      showCompletedRides ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    Completed
                  </button>
                </div>
                
                <div className="border border-border divide-y divide-border">
                  {(() => {
                    const now = new Date();
                    const filteredRides = myRides.filter((ride) => {
                      const rideDateTime = new Date(ride.date);
                      if (ride.departureTime) {
                        const [h, m] = ride.departureTime.split(":").map(Number);
                        rideDateTime.setHours(h, m, 0, 0);
                      }
                      const isPast = rideDateTime < now;
                      return showCompletedRides ? isPast : !isPast;
                    });
                    
                    if (filteredRides.length === 0) {
                      return (
                        <div className="p-6 text-center">
                          <p className="text-sm text-muted-foreground mb-3">
                            {showCompletedRides ? "No completed rides" : "No upcoming rides"}
                          </p>
                          {!showCompletedRides && (
                            <button
                              onClick={() => navigate("/offer-ride")}
                              className="text-sm text-primary hover:underline"
                            >
                              Offer your first ride
                            </button>
                          )}
                        </div>
                      );
                    }
                    
                    return filteredRides.map((ride) => (
                      <RideRow
                        key={ride._id}
                        ride={ride}
                        onDelete={(rideId) => setMyRides((prev) => prev.filter((r) => r._id !== rideId))}
                      />
                    ));
                  })()}
                </div>
              </div>
            )}

            {activeTab === "bookings" && (
              <div className="space-y-4">
                {/* Filter tabs for bookings */}
                <div className="flex gap-2 border-b border-border pb-2">
                  <button
                    onClick={() => setShowCompletedBookings(false)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      !showCompletedBookings ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    Upcoming
                  </button>
                  <button
                    onClick={() => setShowCompletedBookings(true)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      showCompletedBookings ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    Completed
                  </button>
                </div>
                
                <div className="border border-border divide-y divide-border">
                  {(() => {
                    const now = new Date();
                    const filteredBookings = myBookings.filter((booking) => {
                      const rideDateTime = new Date(booking.ride?.date);
                      if (booking.ride?.departureTime) {
                        const [h, m] = booking.ride.departureTime.split(":").map(Number);
                        rideDateTime.setHours(h, m, 0, 0);
                      }
                      const isPast = rideDateTime < now;
                      return showCompletedBookings ? isPast : !isPast;
                    });
                    
                    if (filteredBookings.length === 0) {
                      return (
                        <div className="p-6 text-center">
                          <p className="text-sm text-muted-foreground mb-3">
                            {showCompletedBookings ? "No completed bookings" : "No upcoming bookings"}
                          </p>
                          {!showCompletedBookings && (
                            <button
                              onClick={() => navigate("/search")}
                              className="text-sm text-primary hover:underline"
                            >
                              Search for rides
                            </button>
                          )}
                        </div>
                      );
                    }
                    
                    return filteredBookings.map((booking) => (
                      <BookingRow
                        key={booking._id}
                        booking={booking}
                        onCancel={(bookingId) => setMyBookings((prev) => prev.map((b) => 
                          b._id === bookingId ? { ...b, status: "cancelled" } : b
                        ))}
                      />
                    ));
                  })()}
                </div>
              </div>
            )}

            {activeTab === "ride-bookings" && (
              <div className="border border-border divide-y divide-border">
                {rideBookings.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No one has booked your rides yet
                  </div>
                ) : (
                  rideBookings.map((booking) => (
                    <RideBookingRow 
                      key={booking._id} 
                      booking={booking}
                      onAccept={handleAcceptBooking}
                      onReject={handleRejectBooking}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <EmptyState
                    icon={<StarIcon className="h-7 w-7" />}
                    title="No reviews yet"
                    description="Reviews from your rides and bookings will appear here once travellers rate you."
                  />
                ) : (
                  <>
                    {/* Summary card */}
                    <div className="border border-border bg-card p-4 flex items-center gap-5">
                      <div className="text-center">
                        <div className="text-3xl font-bold font-mono leading-none">
                          {avgRating.toFixed(1)}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="border-l border-border pl-5">
                        <StarRating value={avgRating} size="md" showValue={false} />
                        <p className="text-xs text-muted-foreground mt-1">Average rating</p>
                      </div>
                    </div>

                    {/* Review list */}
                    <div className="border border-border divide-y divide-border">
                      {reviews.map((review: any) => {
                        const reviewerName = review.reviewer?.name || "Anonymous";
                        const initials = reviewerName
                          .split(" ")
                          .slice(0, 2)
                          .map((n: string) => n[0])
                          .join("")
                          .toUpperCase();
                        return (
                          <div key={review._id} className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded-sm bg-muted flex items-center justify-center text-xs font-mono font-semibold shrink-0">
                                {initials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-sm font-medium">{reviewerName}</span>
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    {review.createdAt
                                      ? formatDistanceToNow(new Date(review.createdAt), {
                                          addSuffix: true,
                                        })
                                      : ""}
                                  </span>
                                </div>
                                <StarRating value={review.rating} size="sm" />
                                {review.comment && (
                                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                                    {review.comment}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "documents" && (
              <div ref={documentsRef} className="space-y-4">
                {/* Enhanced Verification Status Panel */}
                <DriverVerificationPanel
                  user={user}
                  onEditDocuments={() => setShowAdditionalDocs(false)}
                  onUploadAdditional={() => setShowAdditionalDocs(!showAdditionalDocs)}
                  showActions={true}
                />

                {/* Congratulations Banner for Verified Drivers */}
                {user.driverVerification?.isVerified && (
                  <div className="border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 via-emerald-500/10 to-emerald-500/5 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-1">
                          🎉 Congratulations! You're a Verified Driver
                        </h3>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300">
                          Your documents have been successfully verified with AI-powered OCR. You can now offer rides on SyncRoute.
                        </p>
                        {user.driverVerification?.verifiedAt && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                            Verified on {new Date(user.driverVerification.verifiedAt).toLocaleDateString()}
                            {user.driverVerification.lastVerificationScore && 
                              ` • Verification Score: ${user.driverVerification.lastVerificationScore}%`
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* When verified, show management options instead of upload instructions */}
                {user.driverVerification?.isVerified ? (
                  <div className="space-y-3">
                    {/* Verified documents summary - compact view */}
                    <div className="border border-border bg-card rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm font-medium">Verified Documents</span>
                        </div>
                        <button
                          onClick={() => setShowAdditionalDocs(!showAdditionalDocs)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showAdditionalDocs ? "Hide management" : "Manage documents"}
                        </button>
                      </div>
                      
                      {/* Verified documents list */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {user.documents?.licenseVerified && (
                          <div className="flex items-center gap-2 p-2 bg-emerald-500/5 rounded-md">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            <div>
                              <div className="text-xs font-medium">Driving License</div>
                              {user.driverVerification?.drivingLicenseId && (
                                <div className="text-[10px] font-mono text-muted-foreground">
                                  {user.driverVerification.drivingLicenseId}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {user.documents?.rcVerified && (
                          <div className="flex items-center gap-2 p-2 bg-emerald-500/5 rounded-md">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            <div>
                              <div className="text-xs font-medium">Vehicle RC</div>
                              {user.driverVerification?.vehicleNumber && (
                                <div className="text-[10px] font-mono text-muted-foreground">
                                  {user.driverVerification.vehicleNumber}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Document management section - shown on toggle */}
                    {showAdditionalDocs && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Edit className="h-4 w-4" />
                          Edit or Replace Documents
                        </div>
                        <p className="text-xs text-muted-foreground">
                          ⚠️ Removing the Driving License or Vehicle RC will revoke your driver verification.
                        </p>
                        <div className="space-y-3">
                          <DocVerify
                            label="Driving License"
                            sublabel="Replace or remove your driving license"
                            docType="license"
                            verified={!!user.documents?.licenseVerified}
                            extractedData={user.driverVerification?.drivingLicenseId ? {
                              number: user.driverVerification.drivingLicenseId,
                              expiry: user.driverVerification.licenseExpiry,
                            } : undefined}
                            onStatusChange={() => { loadData(); refreshUser(); }}
                            onRemove={() => handleUnverifyDoc("licenseVerified")}
                            documentNumber={drivingLicenseNumber}
                            onDocumentNumberChange={setDrivingLicenseNumber}
                            userDateOfBirth={user.dateOfBirth || dateOfBirth}
                          />
                          <DocVerify
                            label="Vehicle Registration (RC)"
                            sublabel="Replace or remove your vehicle registration"
                            docType="rc"
                            verified={!!user.documents?.rcVerified}
                            extractedData={user.driverVerification?.vehicleNumber ? {
                              number: user.driverVerification.vehicleNumber,
                            } : undefined}
                            onStatusChange={() => { loadData(); refreshUser(); }}
                            onRemove={() => handleUnverifyDoc("rcVerified")}
                            documentNumber={vehicleRegistrationNumber}
                            onDocumentNumberChange={setVehicleRegistrationNumber}
                            userDateOfBirth={user.dateOfBirth || dateOfBirth}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Header card - shown when not verified */}
                    <div className="border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <div className="text-sm font-medium mb-0.5">Driver Documents</div>
                          <div className="text-xs text-muted-foreground">
                            Upload and verify your driving documents once. They will be reused
                            automatically every time you offer a ride — no need to re-upload.
                          </div>
                        </div>
                      </div>
                      {user.documents?.licenseVerified && user.documents?.rcVerified && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-primary font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          All documents verified — you're ready to offer rides
                        </div>
                      )}
                      {!(user.documents?.licenseVerified && user.documents?.rcVerified) && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Upload License and RC documents to enable ride creation
                        </div>
                      )}
                    </div>
                    
                    {/* Date of Birth Input - Required for driver verification */}
                    <div className="p-4 border border-border bg-card rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="h-4 w-4 text-primary" />
                        <div className="text-sm font-medium">Date of Birth</div>
                        <span className="text-red-500 text-xs">* Required</span>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="date"
                          value={dateOfBirth}
                          onChange={(e) => handleDOBChange(e.target.value)}
                          className={`w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                            dobError ? 'border-red-500' : 'border-border'
                          }`}
                          min={new Date(new Date().setFullYear(new Date().getFullYear() - 100)).toISOString().split('T')[0]}
                          max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                          required
                          placeholder="YYYY-MM-DD"
                        />
                        {dobError && (
                          <div className="text-xs text-red-500">{dobError}</div>
                        )}
                        {dateOfBirth && !dobError && (
                          <div className="text-xs text-muted-foreground">
                            Age: {Math.floor((new Date().getTime() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))} years
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Document upload cards - shown when not verified */}
                    <div className="space-y-3">
                      <DocVerify
                        label="Driving License"
                        sublabel="Front page of your valid driving license (JPG, PNG, or PDF) — enhanced AI verification with OCR"
                        docType="license"
                        verified={!!user.documents?.licenseVerified}
                        extractedData={user.driverVerification?.drivingLicenseId ? {
                          number: user.driverVerification.drivingLicenseId,
                          expiry: user.driverVerification.licenseExpiry,
                        } : undefined}
                        onStatusChange={() => { loadData(); refreshUser(); }}
                        onRemove={() => handleUnverifyDoc("licenseVerified")}
                        documentNumber={drivingLicenseNumber}
                        onDocumentNumberChange={setDrivingLicenseNumber}
                        userDateOfBirth={user.dateOfBirth || dateOfBirth}
                      />
                      <DocVerify
                        label="Vehicle Registration (RC)"
                        sublabel="RC certificate in your name or with permission to use the vehicle (Document upload optional - number required)"
                        docType="rc"
                        verified={!!user.documents?.rcVerified}
                        extractedData={user.driverVerification?.vehicleNumber ? {
                          number: user.driverVerification.vehicleNumber,
                        } : undefined}
                        onStatusChange={() => { loadData(); refreshUser(); }}
                        onRemove={() => handleUnverifyDoc("rcVerified")}
                        documentNumber={vehicleRegistrationNumber}
                        onDocumentNumberChange={setVehicleRegistrationNumber}
                        documentOptional={true}
                        userDateOfBirth={user.dateOfBirth || dateOfBirth}
                      />
                    </div>
                  </>
                )}

                <div className="p-3 bg-muted/50 rounded-sm">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Enhanced 8-Layer Verification</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-primary rounded-full shrink-0" /> OCR Text Extraction</div>
                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-primary rounded-full shrink-0" /> DL/RC Format Validation</div>
                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-primary rounded-full shrink-0" /> State & RTO Code Check</div>
                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-primary rounded-full shrink-0" /> Age Verification (18+)</div>
                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-primary rounded-full shrink-0" /> Name Matching</div>
                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-primary rounded-full shrink-0" /> Data Consistency</div>
                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-primary rounded-full shrink-0" /> Tampering Detection</div>
                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-primary rounded-full shrink-0" /> Input Field Verification</div>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground px-1">
                  Documents are scanned locally, verified through our enhanced AI verification system with confidence scoring, and immediately deleted from our servers.
                  We do not retain copies of your documents.
                </p>
              </div>
            )}

            {/* Statistics Tab */}
            {activeTab === "stats" && user && (
              <RideStatsDashboard userId={user._id} />
            )}

            {activeTab === "settings" && (
              <div className="space-y-6">
                {/* General Settings */}
                <div className="border border-border divide-y divide-border rounded-lg">
                  <SettingsRow label="Email" value={user.email} />
                  <SettingsRow label="Phone" value={user.phone || "Not provided"} />
                  <SettingsRow label="Role" value={user.role === "driver" ? "Driver" : "Passenger"} />
                  <SettingsRow label="Verified" value={user.verified ? "Yes" : "No"} />
                  <div className="p-4">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 text-sm text-destructive hover:underline"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sign Out
                    </button>
                  </div>
                </div>

                {/* Emergency Contact Settings */}
                <div className="border border-border rounded-lg p-5">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-destructive" />
                    Emergency Contact
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    These contacts will be notified if you trigger an emergency SOS during a ride.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Contact Name</label>
                        <input
                          type="text"
                          value={emergencyName}
                          onChange={(e) => setEmergencyName(e.target.value)}
                          placeholder="Emergency contact name"
                          className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Relationship</label>
                        <input
                          type="text"
                          value={emergencyRelationship}
                          onChange={(e) => setEmergencyRelationship(e.target.value)}
                          placeholder="e.g., Parent, Spouse, Friend"
                          className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                        <Phone className="h-3 w-3" /> Emergency Phone
                      </label>
                      <input
                        type="tel"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                        placeholder="+91 9876543210"
                        className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background"
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                        <Mail className="h-3 w-3" /> Emergency Email
                      </label>
                      <input
                        type="email"
                        value={emergencyEmail}
                        onChange={(e) => setEmergencyEmail(e.target.value)}
                        placeholder="emergency@example.com"
                        className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background"
                      />
                    </div>
                    
                    <button
                      onClick={handleSaveEmergencyContact}
                      disabled={savingEmergency}
                      className="h-9 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-system disabled:opacity-50 flex items-center gap-2"
                    >
                      {savingEmergency ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Emergency Contact"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function RideRow({ ride, onDelete }: { ride: any; onDelete?: (rideId: string) => void }) {
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const rideDateTime = new Date(ride.date);
  if (ride.departureTime) {
    const [h, m] = ride.departureTime.split(":").map(Number);
    rideDateTime.setHours(h, m, 0, 0);
  }
  const isPast = rideDateTime < new Date();

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await ridesAPI.delete(ride._id);
      toast.success("Ride deleted successfully");
      if (onDelete) onDelete(ride._id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete ride");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <div
        className="flex items-center justify-between p-4 hover:bg-accent/50 cursor-pointer transition-colors"
        onClick={() => navigate(`/rides/${ride._id}`)}
      >
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-semibold font-mono">{ride.departureTime}</div>
            <div className="text-[10px] text-muted-foreground">
              {rideDateTime.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium">
              {ride.source?.name || ride.from?.name || "Start"} → {ride.destination?.name || ride.to?.name || "End"}
            </div>
            <div className="text-xs text-muted-foreground">
              {ride.vehicleType} · {ride.availableSeats}/{ride.totalSeats} seats available
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 text-[10px] font-medium rounded-sm uppercase tracking-wider ${
              isPast
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary"
            }`}
          >
            {isPast ? "Completed" : "Upcoming"}
          </span>
          <span className="text-sm font-mono font-medium">₹{ride.price || ride.pricePerSeat}</span>
          {!isPast && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
              title="Delete ride"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Delete Ride?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete this ride? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting..." : "Delete Ride"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BookingRow({ booking, onCancel }: { booking: any; onCancel?: (bookingId: string) => void }) {
  const navigate = useNavigate();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  
  const rideDateTime = new Date(booking.ride?.date);
  if (booking.ride?.departureTime) {
    const [h, m] = booking.ride.departureTime.split(":").map(Number);
    rideDateTime.setHours(h, m, 0, 0);
  }
  const isPast = rideDateTime < new Date();
  const isCompleted = isPast || booking.status === "completed";
  const isCancelled = booking.status === "cancelled";
  const canCancel = !isPast && !isCancelled && booking.status !== "completed";

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setCancelling(true);
    try {
      await bookingsAPI.cancel(booking._id);
      toast.success("Booking cancelled successfully");
      if (onCancel) onCancel(booking._id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to cancel booking");
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  return (
    <>
      <div
        className="flex items-center justify-between p-4 hover:bg-accent/50 cursor-pointer transition-colors"
        onClick={() => navigate(`/rides/${booking.ride?._id}`)}
      >
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-semibold font-mono">
              {booking.ride?.departureTime || "N/A"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {rideDateTime.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium">
              {booking.ride?.source?.name || booking.ride?.from?.name || "Start"} → {booking.ride?.destination?.name || booking.ride?.to?.name || "End"}
            </div>
            <div className="text-xs text-muted-foreground">
              Driver: {booking.driver?.name || "Unknown"} · {booking.seats} seat
              {booking.seats > 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 text-[10px] font-medium rounded-sm uppercase tracking-wider ${
              isCompleted && !isCancelled
                ? "bg-muted text-muted-foreground"
                : booking.status === "confirmed"
                ? "bg-system-green/10 text-system-green"
                : isCancelled
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
            }`}
          >
            {isCompleted && !isCancelled ? "Completed" : booking.status}
          </span>
          <span className="text-sm font-mono font-medium">₹{booking.totalPrice}</span>
          {canCancel && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCancelConfirm(true);
              }}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
              title="Cancel booking"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCancelConfirm(false)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Cancel Booking?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to cancel this ride booking? The seat will be released back to the ride.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {cancelling ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RideBookingRow({ booking, onAccept, onReject }: { booking: any; onAccept?: (id: string) => void; onReject?: (id: string) => void }) {
  const date = new Date(booking.ride?.date);
  const [processing, setProcessing] = useState(false);

  const handleAccept = async () => {
    setProcessing(true);
    try {
      await onAccept?.(booking._id);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    setProcessing(true);
    try {
      await onReject?.(booking._id);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-semibold font-mono">
            {booking.ride?.departureTime || "N/A"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium">
            {booking.ride?.source?.name || booking.ride?.from?.name || "Start"} → {booking.ride?.destination?.name || booking.ride?.to?.name || "End"}
          </div>
          <div className="text-xs text-muted-foreground">
            Passenger: {booking.passenger?.name || "Unknown"} · {booking.seats} seat
            {booking.seats > 1 ? "s" : ""}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`px-2 py-0.5 text-[10px] font-medium rounded-sm uppercase tracking-wider ${
            booking.status === "confirmed"
              ? "bg-system-green/10 text-system-green"
              : booking.status === "cancelled" || booking.status === "rejected"
              ? "bg-destructive/10 text-destructive"
              : booking.status === "pending"
              ? "bg-amber-500/10 text-amber-600"
              : "bg-primary/10 text-primary"
          }`}
        >
          {booking.status}
        </span>
        <span className="text-sm font-mono font-medium">₹{booking.totalPrice}</span>
        
        {booking.status === "pending" && onAccept && onReject && (
          <div className="flex gap-2 ml-2">
            <button
              onClick={handleAccept}
              disabled={processing}
              className="px-3 py-1 text-xs font-medium bg-system-green/10 text-system-green hover:bg-system-green/20 rounded-sm disabled:opacity-50"
            >
              Accept
            </button>
            <button
              onClick={handleReject}
              disabled={processing}
              className="px-3 py-1 text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-sm disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-4">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </div>
        <div className="text-sm">{value}</div>
      </div>
    </div>
  );
}

function DocVerify({
  label,
  sublabel,
  docType,
  verified,
  extractedData,
  onStatusChange,
  onRemove,
  documentNumber,
  onDocumentNumberChange,
  documentOptional = false,
  userDateOfBirth,
}: {
  label: string;
  sublabel: string;
  docType: "license" | "rc";
  verified: boolean;
  extractedData?: { number?: string; expiry?: string };
  onStatusChange: () => void;
  onRemove: () => void;
  documentNumber?: string;
  onDocumentNumberChange?: (value: string) => void;
  documentOptional?: boolean;
  userDateOfBirth?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setVerifying(true);
    setResult(null);
    try {
      let verifyResult;
      
      // If document is already verified, use replace endpoint for better tracking
      if (verified) {
        verifyResult = await documentsAPI.replaceDocument(file, docType);
        if (verifyResult.success && verifyResult.documentUpdated) {
          setResult(verifyResult.verification);
          onStatusChange();
          toast.success(`${label} replaced successfully (Score: ${verifyResult.verification?.verificationScore || verifyResult.verification?.confidence}%)`);
        } else {
          setResult(verifyResult.verification || { status: "error" });
          toast.error(`${label} replacement failed`);
        }
      } else {
        // Use enhanced verification endpoint for new documents
        verifyResult = await documentsAPI.verifyEnhanced(file, docType, documentNumber, userDateOfBirth);
        setResult(verifyResult);
        if (verifyResult.verified) {
          onStatusChange();
          
          // Show appropriate message based on what's needed for full driver verification
          const isLicenseVerification = docType === "license";
          const isRcVerification = docType === "rc";
          
          if (isLicenseVerification) {
            toast.success(`🎉 ${label} verified successfully! (Score: ${verifyResult.verificationScore}%). Please also verify your Vehicle Registration (RC) to offer rides.`);
          } else if (isRcVerification) {
            toast.success(`🎉 ${label} verified successfully! You can now offer rides. (Score: ${verifyResult.verificationScore}%)`);
          } else {
            toast.success(`${label} verified successfully (Score: ${verifyResult.verificationScore || verifyResult.confidence}%)`);
          }
        } else if (verifyResult.status === "review") {
          toast.info(`${label} needs manual review — score: ${verifyResult.verificationScore || verifyResult.confidence}%`);
        } else {
          toast.error(`${label} verification failed`);
        }
      }
    } catch (error: any) {
      // Fall back to basic verification if enhanced/replace fails
      try {
        const verifyResult = await documentsAPI.verify(file, docType);
        setResult(verifyResult);
        if (verifyResult.verified) {
          onStatusChange();
          toast.success(`${label} verified successfully`);
        }
      } catch (fallbackError: any) {
        toast.error(fallbackError.response?.data?.message || "Verification failed");
        setResult({ status: "error", issues: ["Upload failed — please try again"] });
      }
    } finally {
      setVerifying(false);
    }
  };

  const layerLabel = (key: string) => {
    switch (key) {
      case "ocr": return "OCR Text Extraction";
      case "formatValidation": return "Number Format & RTO";
      case "dateValidation": return "Date & Expiry Check";
      case "ageValidation": return "Age Verification (18+)";
      case "nameValidation": return "Name Matching";
      case "imageIntegrity": return "Image Quality Check";
      case "inputVerification": return "Document Number Match";
      case "dataConsistency": return "Data Consistency";
      default: return key;
    }
  };

  const statusColor = (s: string) => {
    if (s === "pass") return "text-emerald-600 dark:text-emerald-400";
    if (s === "warn") return "text-amber-600 dark:text-amber-400";
    if (s === "skip") return "text-muted-foreground";
    return "text-red-500";
  };

  const statusIcon = (s: string) => {
    if (s === "pass") return <CheckCircle2 className="h-3.5 w-3.5" />;
    if (s === "warn") return <AlertCircle className="h-3.5 w-3.5" />;
    if (s === "skip") return <Eye className="h-3.5 w-3.5" />;
    return <X className="h-3.5 w-3.5" />;
  };

  return (
    <div className="border border-border bg-card rounded-sm overflow-hidden">
      <div className="p-4 flex items-start gap-4">
        <div
          className={`mt-0.5 h-10 w-10 rounded-sm flex items-center justify-center shrink-0 ${
            verified ? "bg-emerald-500/10" : result?.status === "rejected" ? "bg-red-500/10" : "bg-muted"
          }`}
        >
          {verified ? (
            <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          ) : verifying ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : (
            <FileText className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium">{label}</span>
            {verified && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-sm uppercase tracking-wider">
                Verified
              </span>
            )}
            {result?.status === "review" && !verified && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-sm uppercase tracking-wider">
                Review
              </span>
            )}
            {result?.status === "rejected" && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-500/10 text-red-500 rounded-sm uppercase tracking-wider">
                Rejected
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{sublabel}</div>
          
          {/* Document Number Input Field */}
          <div className="mt-3">
            <label htmlFor={`${docType}-number`} className="block text-xs font-medium text-foreground mb-1">
              {docType === "license" ? "Driving License Number" : "Vehicle Registration Number"}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              id={`${docType}-number`}
              type="text"
              value={documentNumber || ""}
              onChange={(e) => onDocumentNumberChange?.(e.target.value)}
              placeholder={docType === "license" ? "e.g., TS09 20210012345" : "e.g., TS09AB1234"}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:opacity-50"
              disabled={verified && !onDocumentNumberChange}
            />
            {documentNumber && (
              <div className="mt-1 text-xs text-muted-foreground">
                {docType === "license" ? "Format: State-RTO-Year-Number" : "Format: State-RTO-Series-Number"}
              </div>
            )}
          </div>

          {/* Show extracted data when verified */}
          {verified && extractedData?.number && (
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="font-mono font-medium bg-muted px-2 py-0.5 rounded">
                {extractedData.number}
              </span>
              {extractedData.expiry && (
                <span className="text-muted-foreground">
                  Expires: {extractedData.expiry}
                </span>
              )}
            </div>
          )}

          {/* Confidence bar */}
          {result && result.confidence !== undefined && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    result.confidence >= 75 ? "bg-emerald-500" : result.confidence >= 50 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${result.confidence}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">{result.confidence}%</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {verified ? (
            <>
              <button
                onClick={() => inputRef.current?.click()}
                disabled={verifying}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
              >
                Re-verify
              </button>
              <button
                onClick={onRemove}
                disabled={verifying}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                title="Remove verification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={verifying}
              className="flex items-center gap-1.5 text-xs font-medium text-primary border border-primary/30 bg-primary/5 rounded-sm px-3 py-1.5 hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  <Upload className="h-3 w-3" /> 
                  {documentOptional ? "Upload Document (Optional)" : "Upload & Verify"}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Verification result details */}
      {result && result.layers && (
        <div className="border-t border-border">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Eye className="h-3 w-3" />
              Verification Details — {Object.values(result.layers).filter((l: any) => l.status === "pass").length}/{Object.keys(result.layers).filter(k => result.layers[k].status !== "skip").length} checks passed
              {result.verificationScore && <span className="ml-2 font-mono">(Score: {result.verificationScore}%)</span>}
            </span>
            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showDetails && (
            <div className="px-4 pb-3 space-y-2">
              {Object.entries(result.layers).map(([key, layer]: [string, any]) => (
                <div key={key} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 shrink-0 ${statusColor(layer.status)}`}>
                    {statusIcon(layer.status)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{layerLabel(key)}</span>
                    {layer.details?.reason && (
                      <p className="text-muted-foreground mt-0.5">{layer.details.reason}</p>
                    )}
                    {layer.details?.issues?.length > 0 && (
                      <ul className="text-muted-foreground mt-0.5 space-y-0.5">
                        {layer.details.issues.map((issue: string, i: number) => (
                          <li key={i}>- {issue}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}

              {/* Extracted data preview */}
              {result.extractedData && Object.keys(result.extractedData).length > 0 && (
                <div className="mt-2 p-2 bg-muted/50 rounded-sm">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Extracted Data</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                    {result.extractedData.name && <><span className="text-muted-foreground">Name</span><span className="font-medium">{result.extractedData.name}</span></>}
                    {result.extractedData.dateOfBirth && <><span className="text-muted-foreground">DOB</span><span className="font-mono">{result.extractedData.dateOfBirth}</span></>}
                    {result.extractedData.age && <><span className="text-muted-foreground">Age</span><span className="font-mono">{result.extractedData.age} years</span></>}
                    {result.extractedData.dlNumber && <><span className="text-muted-foreground">DL Number</span><span className="font-mono">{result.extractedData.dlNumber}</span></>}
                    {result.extractedData.rcNumber && <><span className="text-muted-foreground">RC Number</span><span className="font-mono">{result.extractedData.rcNumber}</span></>}
                    {result.extractedData.stateCode && <><span className="text-muted-foreground">State</span><span className="font-mono">{result.extractedData.stateCode} {result.extractedData.stateName ? `(${result.extractedData.stateName})` : ""}</span></>}
                    {result.extractedData.issueDate && <><span className="text-muted-foreground">Issue Date</span><span className="font-mono">{result.extractedData.issueDate}</span></>}
                    {result.extractedData.expiryDate && <><span className="text-muted-foreground">Expiry Date</span><span className="font-mono">{result.extractedData.expiryDate}</span></>}
                  </div>
                </div>
              )}

              {/* Scoring breakdown */}
              {result.scoring?.breakdown && Object.keys(result.scoring.breakdown).length > 0 && (
                <div className="mt-2 p-2 bg-primary/5 border border-primary/10 rounded-sm">
                  <div className="text-[10px] uppercase tracking-wider text-primary font-medium mb-1">Score Breakdown</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                    {Object.entries(result.scoring.breakdown).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                        <span className="font-mono">{value}/20</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Issues summary */}
              {result.issues?.length > 0 && (
                <div className="mt-2 p-2 bg-red-500/5 border border-red-500/10 rounded-sm">
                  <div className="text-[10px] uppercase tracking-wider text-red-500 font-medium mb-1">Issues Found</div>
                  <ul className="space-y-0.5 text-[11px] text-red-600 dark:text-red-400">
                    {result.issues.map((issue: string, i: number) => (
                      <li key={i}>- {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
