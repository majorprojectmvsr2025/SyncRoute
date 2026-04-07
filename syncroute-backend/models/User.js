const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    trim: true
  },
  photo: {
    type: String,
    default: ""
  },
  // Gender field for profile and ride matching
  gender: {
    type: String,
    enum: ["male", "female", "prefer_not_to_say", "other"],
    default: "prefer_not_to_say"
  },
  // Date of birth for legal driving age validation
  dateOfBirth: {
    type: Date,
    default: null
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  trips: {
    type: Number,
    default: 0
  },
  verified: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ["passenger", "driver", "both"],
    default: "passenger"
  },
  bio: {
    type: String,
    trim: true,
    maxlength: 300,
    default: ""
  },
  vehicle: {
    model: { type: String, trim: true, default: "" },
    type: { type: String, enum: ["Sedan", "SUV", "Compact", "Van"], default: "Sedan" },
    color: { type: String, trim: true, default: "" },
    licensePlate: { type: String, trim: true, default: "" }
  },
  documents: {
    licenseVerified:   { type: Boolean, default: false },
    rcVerified:        { type: Boolean, default: false },
    insuranceVerified: { type: Boolean, default: false },
    // Cloud storage URLs for documents
    licenseUrl:   { type: String, default: "" },
    rcUrl:        { type: String, default: "" },
    insuranceUrl: { type: String, default: "" },
  },
  // Comprehensive driver verification data
  driverVerification: {
    // Overall verification status
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    
    // Driving License
    drivingLicenseId: { type: String, trim: true, default: "" },
    drivingLicenseImage: { type: String, default: "" }, // Base64 or URL
    drivingLicenseVerified: { type: Boolean, default: false },
    drivingLicenseExpiry: { type: Date, default: null },
    licenseExpiry: { type: String, default: "" }, // Extracted expiry date string
    
    // Vehicle Information
    vehicleNumber: { type: String, trim: true, default: "" },
    vehicleRegistrationDoc: { type: String, default: "" }, // Base64 or URL
    vehicleRegistrationVerified: { type: Boolean, default: false },
    
    // Vehicle Details
    vehicleType: { 
      type: String, 
      enum: ["Sedan", "SUV", "Compact", "Van", "Motorcycle", "Other"], 
      default: "Sedan" 
    },
    vehiclePhoto: { type: String, default: "" }, // Base64 or URL
    vehiclePhotoVerified: { type: Boolean, default: false },
    vehiclePhotoDate: { type: Date, default: null },
    
    // Extracted data from OCR
    extractedName: { type: String, default: "" },
    extractedDOB: { type: String, default: "" },
    
    // Verification scoring
    lastVerificationScore: { type: Number, default: 0 },
    lastVerificationDate: { type: Date, default: null },
    
    // Validation metadata
    validationIssues: [{ type: String }],
    lastValidationDate: { type: Date, default: null }
  },
  // Emergency contact information for SOS
  emergencyContact: {
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    name: { type: String, trim: true, default: "" },
    relationship: { type: String, trim: true, default: "" }
  },
  // Driver reliability metrics
  reliabilityScore: {
    score: { type: Number, default: 100, min: 0, max: 100 }, // Percentage
    completionRate: { type: Number, default: 100 },
    punctualityRate: { type: Number, default: 100 },
    cancellationRate: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    lastCalculatedAt: { type: Date, default: null }
  },
  // Ride statistics for insights dashboard
  rideStats: {
    totalRidesAsDriver: { type: Number, default: 0 },
    totalRidesAsPassenger: { type: Number, default: 0 },
    totalDistanceKm: { type: Number, default: 0 },
    totalMoneySaved: { type: Number, default: 0 }, // INR
    totalCO2SavedKg: { type: Number, default: 0 },
    lastRideDate: { type: Date, default: null }
  },
  // Reviews received as a driver
  reviewStats: {
    totalReviews: { type: Number, default: 0 },
    avgStars: { type: Number, default: 0 }
  },
  // Firebase Cloud Messaging token for push notifications
  fcmTokens: [{
    token: { type: String, required: true },
    device: { type: String, default: 'unknown' }, // 'web', 'android', 'ios'
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now }
  }],
  // Push notification preferences
  notificationPreferences: {
    pushEnabled: { type: Boolean, default: true },
    rideReminders: { type: Boolean, default: true },
    chatMessages: { type: Boolean, default: true },
    rideUpdates: { type: Boolean, default: true },
    sosAlerts: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false }
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Virtual field to check if user is driver verified
UserSchema.virtual('driverVerified').get(function() {
  return this.driverVerification?.isVerified === true;
});

// Virtual for reliability stars (0-5)
UserSchema.virtual('reliabilityStars').get(function() {
  const score = this.reliabilityScore?.score || 100;
  return Math.round((score / 100) * 5 * 10) / 10; // 1 decimal place
});

// Ensure virtuals are included in JSON output
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

UserSchema.pre("save", async function() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
