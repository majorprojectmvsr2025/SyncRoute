import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ridesAPI, bookingsAPI, authAPI, reviewsAPI, documentsAPI } from "@/lib/api";
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
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/reviews/StarRating";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDistanceToNow } from "date-fns";

const tabs = [
  { id: "my-rides", label: "My Rides", icon: Car },
  { id: "bookings", label: "My Bookings", icon: BookmarkCheck },
  { id: "ride-bookings", label: "Ride Bookings", icon: Users },
  { id: "reviews", label: "Reviews", icon: StarIcon },
  { id: "documents", label: "Documents", icon: ShieldCheck },
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

  // Document verification
  const [docSaving, setDocSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/sign-in");
      return;
    }
    loadData();
  }, [user]);

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
    setEditMode(true);
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

  const handleVerifyDoc = async (field: "licenseVerified" | "rcVerified" | "insuranceVerified") => {
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

  const handleUnverifyDoc = async (field: "licenseVerified" | "rcVerified" | "insuranceVerified") => {
    setDocSaving(field);
    try {
      const result = await authAPI.updateProfile({
        documents: { [field]: false },
      });
      updateUser(result);
      toast.success("Document removed");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update document");
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
              <h1 className="text-lg font-semibold">{user.name}</h1>
              <p className="text-xs text-muted-foreground font-mono">
                {user.role === "driver" ? "Driver" : "Passenger"} · {user.trips} trips · ⭐{" "}
                {user.rating.toFixed(1)}
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
              <div className="border border-border divide-y divide-border">
                {myRides.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-3">No rides offered yet</p>
                    <button
                      onClick={() => navigate("/offer-ride")}
                      className="text-sm text-primary hover:underline"
                    >
                      Offer your first ride
                    </button>
                  </div>
                ) : (
                  myRides.map((ride) => <RideRow key={ride._id} ride={ride} />)
                )}
              </div>
            )}

            {activeTab === "bookings" && (
              <div className="border border-border divide-y divide-border">
                {myBookings.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-3">No bookings yet</p>
                    <button
                      onClick={() => navigate("/search")}
                      className="text-sm text-primary hover:underline"
                    >
                      Search for rides
                    </button>
                  </div>
                ) : (
                  myBookings.map((booking) => (
                    <BookingRow key={booking._id} booking={booking} />
                  ))
                )}
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
                    <RideBookingRow key={booking._id} booking={booking} />
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
              <div className="space-y-4">
                {/* Header card */}
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
                  {user.documents?.licenseVerified && user.documents?.rcVerified && user.documents?.insuranceVerified && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-primary font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      All documents verified — you're ready to offer rides
                    </div>
                  )}
                  {!(user.documents?.licenseVerified && user.documents?.rcVerified && user.documents?.insuranceVerified) && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Upload all 3 documents to enable faster ride creation
                    </div>
                  )}
                </div>

                {/* Document cards */}
                <div className="space-y-3">
                  <DocVerify
                    label="Driving License"
                    sublabel="Front page of your valid driving license (JPG, PNG, or PDF) — 4-layer AI verification"
                    docType="license"
                    verified={!!user.documents?.licenseVerified}
                    onStatusChange={() => loadData()}
                    onRemove={() => handleUnverifyDoc("licenseVerified")}
                  />
                  <DocVerify
                    label="Vehicle Registration (RC)"
                    sublabel="RC certificate in your name or with permission to use the vehicle"
                    docType="rc"
                    verified={!!user.documents?.rcVerified}
                    onStatusChange={() => loadData()}
                    onRemove={() => handleUnverifyDoc("rcVerified")}
                  />
                  <DocVerify
                    label="Vehicle Insurance"
                    sublabel="Third-party or comprehensive insurance document"
                    docType="insurance"
                    verified={!!user.documents?.insuranceVerified}
                    onStatusChange={() => loadData()}
                    onRemove={() => handleUnverifyDoc("insuranceVerified")}
                  />
                </div>

                <div className="p-3 bg-muted/50 rounded-sm">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">4-Layer Verification</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-primary rounded-full shrink-0" /> OCR + DL Number Format</div>
                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-primary rounded-full shrink-0" /> State + RTO Code Check</div>
                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-primary rounded-full shrink-0" /> Expiry & Date Validation</div>
                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-primary rounded-full shrink-0" /> Tampering & AI Detection</div>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground px-1">
                  Documents are scanned locally, verified through our 4-layer detection system, and immediately deleted from our servers.
                  We do not retain copies of your documents.
                </p>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="border border-border divide-y divide-border">
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
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function RideRow({ ride }: { ride: any }) {
  const navigate = useNavigate();
  const rideDateTime = new Date(ride.date);
  if (ride.departureTime) {
    const [h, m] = ride.departureTime.split(":").map(Number);
    rideDateTime.setHours(h, m, 0, 0);
  }
  const isPast = rideDateTime < new Date();

  return (
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
            {ride.from?.name || "Start"} → {ride.to?.name || "End"}
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
        <span className="text-sm font-mono font-medium">₹{ride.price}</span>
      </div>
    </div>
  );
}

function BookingRow({ booking }: { booking: any }) {
  const navigate = useNavigate();
  const rideDateTime = new Date(booking.ride?.date);
  if (booking.ride?.departureTime) {
    const [h, m] = booking.ride.departureTime.split(":").map(Number);
    rideDateTime.setHours(h, m, 0, 0);
  }
  const isPast = rideDateTime < new Date();

  return (
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
            {booking.ride?.from?.name || "Start"} → {booking.ride?.to?.name || "End"}
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
            booking.status === "confirmed"
              ? "bg-system-green/10 text-system-green"
              : booking.status === "cancelled"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
          }`}
        >
          {booking.status}
        </span>
        <span className="text-sm font-mono font-medium">₹{booking.totalPrice}</span>
      </div>
    </div>
  );
}

function RideBookingRow({ booking }: { booking: any }) {
  const date = new Date(booking.ride?.date);

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
            {booking.ride?.from?.name || "Start"} → {booking.ride?.to?.name || "End"}
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
              : booking.status === "cancelled"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
          }`}
        >
          {booking.status}
        </span>
        <span className="text-sm font-mono font-medium">₹{booking.totalPrice}</span>
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
  onStatusChange,
  onRemove,
}: {
  label: string;
  sublabel: string;
  docType: "license" | "rc" | "insurance";
  verified: boolean;
  onStatusChange: () => void;
  onRemove: () => void;
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
      const verifyResult = await documentsAPI.verify(file, docType);
      setResult(verifyResult);
      if (verifyResult.verified) {
        onStatusChange();
        toast.success(`${label} verified successfully`);
      } else if (verifyResult.status === "review") {
        toast.info(`${label} needs manual review — confidence: ${verifyResult.confidence}%`);
      } else {
        toast.error(`${label} verification failed`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Verification failed");
      setResult({ status: "error", issues: ["Upload failed — please try again"] });
    } finally {
      setVerifying(false);
    }
  };

  const layerLabel = (key: string) => {
    switch (key) {
      case "ocr": return "OCR Text Extraction";
      case "formatValidation": return "Number Format & RTO";
      case "dateValidation": return "Date & Expiry Check";
      case "imageIntegrity": return "Image Integrity & AI";
      default: return key;
    }
  };

  const statusColor = (s: string) => {
    if (s === "pass") return "text-emerald-600 dark:text-emerald-400";
    if (s === "warn") return "text-amber-600 dark:text-amber-400";
    return "text-red-500";
  };

  const statusIcon = (s: string) => {
    if (s === "pass") return <CheckCircle2 className="h-3.5 w-3.5" />;
    if (s === "warn") return <AlertCircle className="h-3.5 w-3.5" />;
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
                  <Upload className="h-3 w-3" /> Upload & Verify
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
              Verification Details — {Object.values(result.layers).filter((l: any) => l.status === "pass").length}/4 layers passed
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
                    {result.extractedData.dlNumber && <><span className="text-muted-foreground">DL Number</span><span className="font-mono">{result.extractedData.dlNumber}</span></>}
                    {result.extractedData.rcNumber && <><span className="text-muted-foreground">RC Number</span><span className="font-mono">{result.extractedData.rcNumber}</span></>}
                    {result.extractedData.stateCode && <><span className="text-muted-foreground">State</span><span className="font-mono">{result.extractedData.stateCode}</span></>}
                    {result.extractedData.rtoCode && <><span className="text-muted-foreground">RTO</span><span className="font-mono">{result.extractedData.rtoCode}</span></>}
                    {result.extractedData.issueDate && <><span className="text-muted-foreground">Issue Date</span><span className="font-mono">{result.extractedData.issueDate}</span></>}
                    {result.extractedData.expiryDate && <><span className="text-muted-foreground">Expiry Date</span><span className="font-mono">{result.extractedData.expiryDate}</span></>}
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
