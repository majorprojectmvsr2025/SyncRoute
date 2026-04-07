import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Award,
  Calendar,
  FileText,
  Edit2,
  Plus,
  Car,
  CreditCard,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";

interface DriverVerificationPanelProps {
  user: {
    name?: string;
    driverVerification?: {
      isVerified?: boolean;
      verifiedAt?: string | Date;
      drivingLicenseId?: string;
      vehicleNumber?: string;
      lastVerificationScore?: number;
      licenseExpiry?: string;
      extractedName?: string;
    };
    documents?: {
      licenseVerified?: boolean;
      rcVerified?: boolean;
      insuranceVerified?: boolean;
    };
  };
  onEditDocuments?: () => void;
  onUploadAdditional?: () => void;
  compact?: boolean;
  showActions?: boolean;
}

// Additional document types that can be uploaded optionally
const OPTIONAL_DOCUMENTS = [
  { id: "pollution", label: "Vehicle Pollution Certificate", icon: FileText },
  { id: "idVerification", label: "Driver ID Verification", icon: User },
  { id: "secondaryVehicle", label: "Secondary Vehicle Proof", icon: Car },
];

export function DriverVerificationPanel({
  user,
  onEditDocuments,
  onUploadAdditional,
  compact = false,
  showActions = true,
}: DriverVerificationPanelProps) {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);

  const dv = user?.driverVerification;
  const docs = user?.documents;
  const isVerified = dv?.isVerified === true;

  // Calculate days since verification
  const daysSinceVerification = dv?.verifiedAt
    ? Math.floor(
        (new Date().getTime() - new Date(dv.verifiedAt).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  // Calculate license expiry status
  const licenseExpiryDays = dv?.licenseExpiry
    ? Math.floor(
        (new Date(dv.licenseExpiry).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const licenseExpiryWarning =
    licenseExpiryDays !== null && licenseExpiryDays <= 30 && licenseExpiryDays >= 0;
  const licenseExpired = licenseExpiryDays !== null && licenseExpiryDays < 0;

  if (!isVerified) {
    // Show pending verification state
    return (
      <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
            <AlertCircle className="h-6 w-6 text-amber-500" />
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold text-amber-600 dark:text-amber-400 mb-1">
              Verification Pending
            </div>
            <div className="text-sm text-muted-foreground mb-3">
              Complete your driver verification to create rides on SyncRoute.
              Upload your driving license and vehicle registration to get started.
            </div>
            {showActions && (
              <button
                onClick={() => navigate("/profile#documents")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm font-medium rounded-md hover:bg-amber-500/20 transition-colors"
              >
                <ShieldCheck className="h-4 w-4" />
                Complete Verification
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Verified driver panel
  return (
    <div className="border border-primary/30 bg-primary/5 rounded-lg overflow-hidden">
      {/* Main Verified Header */}
      <div className={`p-${compact ? "4" : "6"}`}>
        <div className="flex items-start gap-4">
          {/* Verification Badge */}
          <div
            className={`${
              compact ? "h-12 w-12" : "h-16 w-16"
            } rounded-full bg-primary/10 flex items-center justify-center shrink-0 relative`}
          >
            <Award
              className={`${
                compact ? "h-6 w-6" : "h-8 w-8"
              } text-primary`}
            />
            <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={`${
                  compact ? "text-base" : "text-lg"
                } font-semibold text-primary`}
              >
                Verified Driver
              </h3>
              {dv?.lastVerificationScore && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary rounded-full uppercase tracking-wider">
                  Score: {dv.lastVerificationScore}%
                </span>
              )}
            </div>

            <p
              className={`${
                compact ? "text-xs" : "text-sm"
              } text-muted-foreground mt-1`}
            >
              Your driving documents have been successfully verified. You can now
              create rides without uploading documents again.
            </p>

            {/* Verification Details Grid */}
            <div
              className={`grid ${
                compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"
              } gap-3 mt-4`}
            >
              {/* Verification Date */}
              {dv?.verifiedAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Verified
                    </div>
                    <div className="text-xs font-medium">
                      {format(new Date(dv.verifiedAt), "MMM d, yyyy")}
                    </div>
                  </div>
                </div>
              )}

              {/* DL Number */}
              {dv?.drivingLicenseId && (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      DL Number
                    </div>
                    <div className="text-xs font-mono font-medium">
                      {dv.drivingLicenseId}
                    </div>
                  </div>
                </div>
              )}

              {/* Vehicle Number */}
              {dv?.vehicleNumber && (
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Vehicle
                    </div>
                    <div className="text-xs font-mono font-medium">
                      {dv.vehicleNumber}
                    </div>
                  </div>
                </div>
              )}

              {/* License Expiry */}
              {dv?.licenseExpiry && (
                <div className="flex items-center gap-2">
                  <Clock
                    className={`h-4 w-4 ${
                      licenseExpired
                        ? "text-destructive"
                        : licenseExpiryWarning
                        ? "text-amber-500"
                        : "text-muted-foreground"
                    }`}
                  />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      DL Expiry
                    </div>
                    <div
                      className={`text-xs font-medium ${
                        licenseExpired
                          ? "text-destructive"
                          : licenseExpiryWarning
                          ? "text-amber-500"
                          : ""
                      }`}
                    >
                      {licenseExpired
                        ? "Expired"
                        : licenseExpiryWarning
                        ? `${licenseExpiryDays} days left`
                        : format(new Date(dv.licenseExpiry), "MMM yyyy")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* License Expiry Warning */}
        {(licenseExpired || licenseExpiryWarning) && (
          <div
            className={`mt-4 p-3 rounded-md ${
              licenseExpired
                ? "bg-destructive/10 border border-destructive/30"
                : "bg-amber-500/10 border border-amber-500/30"
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertCircle
                className={`h-4 w-4 ${
                  licenseExpired ? "text-destructive" : "text-amber-500"
                }`}
              />
              <span
                className={`text-xs font-medium ${
                  licenseExpired
                    ? "text-destructive"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {licenseExpired
                  ? "Your driving license has expired. Please renew and re-verify."
                  : `Your driving license expires in ${licenseExpiryDays} days. Consider renewing soon.`}
              </span>
            </div>
          </div>
        )}

        {/* Document Status Summary */}
        {!compact && (
          <div className="mt-4 flex flex-wrap gap-2">
            <DocumentStatusBadge
              label="License"
              verified={!!docs?.licenseVerified}
            />
            <DocumentStatusBadge label="RC" verified={!!docs?.rcVerified} />
          </div>
        )}
      </div>

      {/* Actions Section */}
      {showActions && (
        <div className="border-t border-border bg-card/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Show Details
                </>
              )}
            </button>

            <div className="flex gap-2">
              <button
                onClick={onEditDocuments || (() => navigate("/profile#documents"))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-accent transition-colors"
              >
                <Edit2 className="h-3 w-3" />
                Edit Documents
              </button>
              <button
                onClick={onUploadAdditional || (() => navigate("/profile#documents"))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Upload Additional
              </button>
            </div>
          </div>

          {/* Expanded Details */}
          {showDetails && (
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              {/* Optional Documents Section */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Optional Documents
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {OPTIONAL_DOCUMENTS.map((doc) => {
                    const Icon = doc.icon;
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 p-2 border border-dashed border-border rounded-md text-xs text-muted-foreground"
                      >
                        <Icon className="h-4 w-4" />
                        <span>{doc.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Verification History */}
              {dv?.verifiedAt && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Verification History
                  </h4>
                  <div className="text-xs text-muted-foreground">
                    Last verified {daysSinceVerification} day
                    {daysSinceVerification !== 1 ? "s" : ""} ago on{" "}
                    {format(new Date(dv.verifiedAt), "MMMM d, yyyy 'at' h:mm a")}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper component for document status badges
function DocumentStatusBadge({
  label,
  verified,
  optional = false,
}: {
  label: string;
  verified: boolean;
  optional?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        verified
          ? "bg-primary/10 text-primary"
          : optional
          ? "bg-muted text-muted-foreground"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      }`}
    >
      {verified ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <AlertCircle className="h-3 w-3" />
      )}
      {label}
      {!verified && !optional && (
        <span className="text-[10px] opacity-70">Pending</span>
      )}
    </div>
  );
}

// Compact verification status for use in ride creation
export function DriverVerificationStatus({
  isVerified,
  onClick,
}: {
  isVerified: boolean;
  onClick?: () => void;
}) {
  if (isVerified) {
    return (
      <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-medium text-primary">
            Driver Verification Complete
          </div>
          <div className="text-xs text-muted-foreground">
            Your documents are verified — you can create rides
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg hover:bg-amber-500/10 transition-colors text-left"
    >
      <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
        <AlertCircle className="h-4 w-4 text-amber-500" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-amber-600 dark:text-amber-400">
          Verification Required
        </div>
        <div className="text-xs text-muted-foreground">
          Complete driver verification to create rides
        </div>
      </div>
      <ShieldCheck className="h-4 w-4 text-amber-500" />
    </button>
  );
}

export default DriverVerificationPanel;
