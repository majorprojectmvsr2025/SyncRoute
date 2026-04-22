import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  register: async (data: { name: string; email: string; password: string; phone?: string; role?: string }) => {
    const response = await api.post("/auth/register", data);
    return response.data;
  },
  login: async (data: { email: string; password: string }) => {
    const response = await api.post("/auth/login", data);
    return response.data;
  },
  googleLogin: async (data: { email: string; name: string; googleId: string; photo?: string }) => {
    const response = await api.post("/auth/google", data);
    return response.data;
  },
  getCurrentUser: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },
  updateProfile: async (data: {
    name?: string;
    phone?: string;
    bio?: string;
    photo?: string;
    role?: string;
    gender?: "male" | "female" | "prefer_not_to_say" | "other";
    dateOfBirth?: string | null;
    vehicle?: { model?: string; type?: string; color?: string; licensePlate?: string };
    documents?: { licenseVerified?: boolean; rcVerified?: boolean; insuranceVerified?: boolean };
    driverVerification?: {
      drivingLicenseId?: string;
      drivingLicenseImage?: string;
      drivingLicenseVerified?: boolean;
      drivingLicenseExpiry?: string | null;
      vehicleNumber?: string;
      vehicleRegistrationDoc?: string;
      vehicleRegistrationVerified?: boolean;
      vehicleType?: string;
      vehiclePhoto?: string;
      isVerified?: boolean;
      validationIssues?: string[];
    };
  }) => {
    const response = await api.put("/auth/profile", data);
    return response.data;
  },
  forgotPassword: async (email: string) => {
    const response = await api.post("/auth/forgot-password", { email });
    return response.data;
  },
  resetPassword: async (token: string, password: string) => {
    const response = await api.post(`/auth/reset-password?token=${encodeURIComponent(token)}`, { password });
    return response.data;
  },
};

// Rides API
export const ridesAPI = {
  search: async (params: {
    pickupLat: number;
    pickupLng: number;
    dropLat: number;
    dropLng: number;
    date?: string;
    passengers?: number;
  }) => {
    const response = await api.post("/rides/search", params);
    return response.data;
  },
  getAll: async () => {
    const response = await api.get("/rides/all");
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/rides/${id}`);
    return response.data;
  },
  create: async (data: unknown) => {
    const response = await api.post("/rides/create", data);
    return response.data;
  },
  getMyRides: async () => {
    const response = await api.get("/rides/driver/my-rides");
    return response.data;
  },
  update: async (id: string, data: unknown) => {
    const response = await api.patch(`/rides/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/rides/${id}`);
    return response.data;
  },
  // Check for conflicting rides (Part 3)
  checkConflict: async (data: { date: string; departureTime: string }) => {
    const response = await api.post("/rides/check-conflict", data);
    return response.data;
  },
  // Get today's rides (Part 9)
  getTodayRides: async () => {
    const response = await api.get("/rides/today/user");
    return response.data;
  },
  // Driver confirms ride start
  confirmDriverStart: async (rideId: string) => {
    const response = await api.post(`/rides/${rideId}/confirm-start/driver`);
    return response.data;
  },
  // Passenger confirms ride start
  confirmPassengerStart: async (rideId: string, bookingId: string) => {
    const response = await api.post(`/rides/${rideId}/confirm-start/passenger`, { bookingId });
    return response.data;
  },
  // Driver marks ride as completed
  completeRide: async (rideId: string) => {
    const response = await api.post(`/rides/${rideId}/complete`);
    return response.data;
  },
  // Passenger confirms ride received (Part 10)
  confirmRideReceived: async (rideId: string, bookingId: string) => {
    const response = await api.post(`/rides/${rideId}/confirm-received`, { bookingId });
    return response.data;
  },
};

// Bookings API
export const bookingsAPI = {
  create: async (data: {
    rideId: string;
    seats: number;
    pickupLocation?: unknown;
    dropLocation?: unknown;
  }) => {
    const response = await api.post("/bookings/create", data);
    return response.data;
  },
  getMyBookings: async () => {
    const response = await api.get("/bookings/my-bookings");
    return response.data;
  },
  getRideBookings: async () => {
    const response = await api.get("/bookings/driver/ride-bookings");
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/bookings/${id}`);
    return response.data;
  },
  cancel: async (id: string) => {
    const response = await api.patch(`/bookings/${id}/cancel`);
    return response.data;
  },
  confirm: async (id: string) => {
    const response = await api.patch(`/bookings/${id}/confirm`);
    return response.data;
  },
  reject: async (id: string) => {
    const response = await api.patch(`/bookings/${id}/reject`);
    return response.data;
  },
  complete: async (id: string) => {
    const response = await api.patch(`/bookings/${id}/complete`);
    return response.data;
  },
};

// Messages API
export const messagesAPI = {
  send: async (data: { rideId: string; receiverId: string; text: string }) => {
    const response = await api.post("/messages/send", data);
    return response.data;
  },
  getConversation: async (rideId: string, userId: string) => {
    const response = await api.get(`/messages/conversation/${rideId}/${userId}`);
    return response.data;
  },
  getConversations: async () => {
    const response = await api.get("/messages/conversations");
    return response.data;
  },
  markAsRead: async (rideId: string, userId: string) => {
    const response = await api.patch(`/messages/mark-read/${rideId}/${userId}`);
    return response.data;
  },
};

// Reviews API
export const reviewsAPI = {
  create: async (data: { bookingId: string; rating: number; comment?: string }) => {
    const response = await api.post("/reviews", data);
    return response.data;
  },
  getByUser: async (userId: string) => {
    const response = await api.get(`/reviews/user/${userId}`);
    return response.data;
  },
  getByBooking: async (bookingId: string) => {
    const response = await api.get(`/reviews/booking/${bookingId}`);
    return response.data;
  },
};

// Notifications API
export const notificationsAPI = {
  getAll: async () => {
    const response = await api.get("/notifications");
    return response.data;
  },
  getUnreadCount: async () => {
    const response = await api.get("/notifications/unread-count");
    return response.data;
  },
  markAsRead: async (id: string) => {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
  },
  markAllAsRead: async () => {
    const response = await api.patch("/notifications/mark-all-read");
    return response.data;
  },
};

// Driver API
export const driverAPI = {
  getEarnings: async () => {
    const response = await api.get("/driver/earnings");
    return response.data;
  },
};

// Stats API
export const statsAPI = {
  getPlatformStats: async () => {
    const response = await api.get("/stats/platform");
    return response.data;
  },
  getActivity: async () => {
    const response = await api.get("/stats/activity");
    return response.data;
  },
  getUserStats: async (userId: string) => {
    const response = await api.get(`/stats/user/${userId}`);
    return response.data;
  },
  getReliability: async (driverId: string) => {
    const response = await api.get(`/stats/reliability/${driverId}`);
    return response.data;
  },
  getMonthlyStats: async (userId: string, months = 6) => {
    const response = await api.get(`/stats/user/${userId}/monthly?months=${months}`);
    return response.data;
  },
};

// Documents API
export const documentsAPI = {
  verify: async (file: File, docType: "license" | "rc" | "insurance") => {
    const formData = new FormData();
    formData.append("document", file);
    formData.append("docType", docType);
    const response = await api.post("/documents/verify", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000, // OCR can take time
    });
    return response.data;
  },
  verifyEnhanced: async (file: File, docType: "license" | "rc" | "insurance", documentNumber?: string, userDateOfBirth?: string) => {
    const formData = new FormData();
    formData.append("document", file);
    formData.append("docType", docType);
    if (documentNumber) {
      formData.append(docType === "license" ? "dlNumber" : "vehicleNumber", documentNumber);
    }
    if (userDateOfBirth) {
      formData.append("userDateOfBirth", userDateOfBirth);
    }
    const response = await api.post("/documents/verify-enhanced", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 90000, // Enhanced verification takes longer
    });
    return response.data;
  },
  verifyVehiclePhoto: async (file: File) => {
    const formData = new FormData();
    formData.append("photo", file);
    const response = await api.post("/documents/verify-vehicle-photo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000,
    });
    return response.data;
  },
  validateDL: async (dlNumber: string, dateOfBirth?: string) => {
    const response = await api.post("/documents/validate-dl", { dlNumber, dateOfBirth });
    return response.data;
  },
  validateRC: async (vehicleNumber: string) => {
    const response = await api.post("/documents/validate-rc", { vehicleNumber });
    return response.data;
  },
  getStatus: async () => {
    const response = await api.get("/documents/status");
    return response.data;
  },
  getVerificationSummary: async () => {
    const response = await api.get("/documents/verification-summary");
    return response.data;
  },
  // NEW ENDPOINTS FOR DOCUMENT MANAGEMENT
  deleteDocument: async (docType: "license" | "rc" | "insurance") => {
    const response = await api.delete(`/documents/${docType}`);
    return response.data;
  },
  updateDocument: async (docType: "license" | "rc" | "insurance", data: {
    number?: string;
    expiry?: string;
    notes?: string;
  }) => {
    const response = await api.put(`/documents/${docType}/update`, data);
    return response.data;
  },
  replaceDocument: async (file: File, docType: "license" | "rc" | "insurance") => {
    const formData = new FormData();
    formData.append("document", file);
    formData.append("docType", docType);
    const response = await api.post(`/documents/${docType}/replace`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 90000,
    });
    return response.data;
  },
  validateAge: async (dateOfBirth: string) => {
    const response = await api.post("/documents/validate-age", { dateOfBirth });
    return response.data;
  },
};

// Live Tracking API
export const liveTrackingAPI = {
  startTracking: async (rideId: string, bookingId?: string, initialLocation?: { lat: number; lng: number }) => {
    const response = await api.post("/live-tracking/start", { rideId, bookingId, initialLocation });
    return response.data;
  },
  updateLocation: async (trackingToken: string, lat: number, lng: number, meta?: { accuracy?: number; speed?: number; heading?: number }) => {
    const response = await api.post("/live-tracking/update", { trackingToken, lat, lng, ...meta });
    return response.data;
  },
  stopTracking: async (trackingToken: string) => {
    const response = await api.post("/live-tracking/stop", { trackingToken });
    return response.data;
  },
  getMySessions: async () => {
    const response = await api.get("/live-tracking/my-sessions");
    return response.data;
  },
  getPublicTracking: async (token: string) => {
    const response = await api.get(`/live-tracking/public/${token}`);
    return response.data;
  },
};

// SOS Emergency API
export const sosAPI = {
  trigger: async (rideId: string, location?: { lat: number; lng: number }, additionalInfo?: string) => {
    const response = await api.post("/sos/trigger", { rideId, location, additionalInfo });
    return response.data;
  },
  getEmergencyContact: async () => {
    const response = await api.get("/sos/emergency-contact");
    return response.data;
  },
  updateEmergencyContact: async (data: { phone?: string; email?: string; name?: string; relationship?: string }) => {
    const response = await api.put("/sos/emergency-contact", data);
    return response.data;
  },
  getHistory: async () => {
    const response = await api.get("/sos/history");
    return response.data;
  },
};

// Waitlist API
export const waitlistAPI = {
  join: async (rideId: string, seats: number, pickupLocation?: unknown, dropLocation?: unknown) => {
    const response = await api.post("/waitlist/join", { rideId, seats, pickupLocation, dropLocation });
    return response.data;
  },
  getMyStatus: async (rideId: string) => {
    const response = await api.get(`/waitlist/my-status/${rideId}`);
    return response.data;
  },
  leave: async (rideId: string) => {
    const response = await api.delete(`/waitlist/${rideId}`);
    return response.data;
  },
  acceptOffer: async (waitlistId: string) => {
    const response = await api.post(`/waitlist/accept/${waitlistId}`);
    return response.data;
  },
  declineOffer: async (waitlistId: string) => {
    const response = await api.post(`/waitlist/decline/${waitlistId}`);
    return response.data;
  },
  getRideWaitlist: async (rideId: string) => {
    const response = await api.get(`/waitlist/ride/${rideId}`);
    return response.data;
  },
};

// Extended Rides API
export const ridesExtendedAPI = {
  confirmStartDriver: async (rideId: string) => {
    const response = await api.post(`/rides/${rideId}/confirm-start/driver`);
    return response.data;
  },
  confirmStartPassenger: async (rideId: string, bookingId: string) => {
    const response = await api.post(`/rides/${rideId}/confirm-start/passenger`, { bookingId });
    return response.data;
  },
  getUpcoming: async () => {
    const response = await api.get("/rides/upcoming/user");
    return response.data;
  },
  getOngoing: async () => {
    const response = await api.get("/rides/ongoing/user");
    return response.data;
  },
  completeRide: async (rideId: string) => {
    const response = await api.post(`/rides/${rideId}/complete`);
    return response.data;
  },
  confirmRideReceived: async (rideId: string, bookingId: string) => {
    const response = await api.post(`/rides/${rideId}/confirm-received`, { bookingId });
    return response.data;
  },
};

// Personalized Ride Intelligence Engine (PRIE) API
export interface PersonalizationScore {
  score: number;
  isRecommended: boolean;
  isPersonalized: boolean;
  reasons: string[];
  breakdown: {
    route: number;
    time: number;
    driver: number;
    vehicle: number;
    price: number;
    comfort: number;
    bookingStyle: number;
  };
}

export interface PersonalizedRide {
  _id: string;
  personalization?: PersonalizationScore;
  // ... other ride fields populated by backend
}

export interface PreferenceProfile {
  hasProfile: boolean;
  message?: string;
  profile?: {
    timePreferences?: {
      morning: number;
      afternoon: number;
      evening: number;
      night: number;
      confidence: number;
    };
    dayPreferences?: {
      weekday: number;
      weekend: number;
      distribution: Record<string, number>;
      confidence: number;
    };
    driverPreferences?: {
      genderPreference: string | null;
      minRating: number;
      reliabilitySensitivity: string;
    };
    vehiclePreferences?: {
      primary: string | null;
      distribution: Record<string, number>;
    };
    pricePreferences?: {
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
      confidence: number;
    };
    distancePreferences?: {
      avgDistance: number;
      preferredRange: string;
      confidence: number;
    };
    comfortPreferences?: {
      musicPrimary: string | null;
      conversationPrimary: string | null;
      smokingTolerance: boolean;
    };
    bookingStyle?: {
      instantBookingPreference: number;
      lastMinuteBooker: boolean;
      advancePlanner: boolean;
    };
    routeClusters?: Array<{
      label: string;
      frequency: number;
      typicalDepartureHour: number;
    }>;
    metadata?: {
      totalBookings: number;
      totalSearches: number;
      overallConfidence: number;
      isActive: boolean;
      lastAnalyzedAt: string;
    };
  };
}

export interface TravelInsight {
  type: string;
  icon: string;
  title: string;
  description: string;
}

export interface InsightsResponse {
  hasInsights: boolean;
  insights?: TravelInsight[];
  confidence?: number;
  message?: string;
}

export interface SuggestionsResponse {
  hasSuggestions: boolean;
  routeSuggestions?: Array<{
    route: { label: string };
    upcomingRides: number;
    nextRide?: unknown;
  }>;
  timeSuggestions?: Array<{
    slot: string;
    percentage: number;
    suggestion: string;
  }>;
  message?: string;
}

export const prieAPI = {
  // Get user's preference profile
  getProfile: async (): Promise<PreferenceProfile> => {
    const response = await api.get("/prie/profile");
    return response.data;
  },

  // Force refresh of preference profile
  refreshProfile: async () => {
    const response = await api.post("/prie/profile/refresh");
    return response.data;
  },

  // Personalized ride search with ML-based ranking
  search: async (params: {
    pickupLat: number;
    pickupLng: number;
    dropLat: number;
    dropLng: number;
    date?: string;
    passengers?: number;
    fromName?: string;
    toName?: string;
    filters?: Record<string, unknown>;
  }): Promise<{ rides: PersonalizedRide[]; meta: { total: number; recommended: number; isPersonalized: boolean } }> => {
    const response = await api.post("/prie/search", params);
    return response.data;
  },

  // Get personalized ride suggestions
  getSuggestions: async (): Promise<SuggestionsResponse> => {
    const response = await api.get("/prie/suggestions");
    return response.data;
  },

  // Get user's travel insights for dashboard
  getInsights: async (): Promise<InsightsResponse> => {
    const response = await api.get("/prie/insights");
    return response.data;
  },

  // Check and send smart notifications
  checkSmartNotifications: async () => {
    const response = await api.post("/prie/smart-notify");
    return response.data;
  },

  // Get user's behavior analytics (for transparency)
  getAnalytics: async () => {
    const response = await api.get("/prie/analytics");
    return response.data;
  },

  // Delete user's personalization data (GDPR)
  deleteData: async () => {
    const response = await api.delete("/prie/data");
    return response.data;
  },
};

// Advanced System API (Graph Matching, Dynamic Pricing, Fraud Detection, etc.)
export interface DynamicPrice {
  basePrice: number;
  finalPrice: number;
  factors: {
    peak: number;
    demand: number;
    distance: number;
    vehicle: number;
  };
  breakdown: {
    distanceCost: number;
    fuelCost: number;
    peakSurcharge: number;
    demandSurcharge: number;
  };
  priceRange: {
    min: number;
    max: number;
    suggested: number;
  };
}

export interface CarbonImpact {
  totalCO2Saved: number;
  totalFuelSaved: number;
  totalDistanceShared: number;
  totalRidesCompleted: number;
  equivalents: {
    trees: number;
    phoneCharges: number;
    lightBulbHours: number;
    carKmAvoided: number;
  };
  monthlyBreakdown: Array<{
    month: string;
    co2Saved: number;
    ridesCompleted: number;
  }>;
  impactLevel: string;
  percentile: number;
}

export interface DemandForecast {
  currentDemand: {
    level: string;
    score: number;
    peakProbability: number;
  };
  hourlyForecast: Array<{
    hour: number;
    demandScore: number;
    label: string;
  }>;
  bestTimes: Array<{
    hour: number;
    score: number;
    reason: string;
  }>;
  recommendations: string[];
}

export interface FraudRisk {
  overallRisk: number;
  riskLevel: string;
  flags: string[];
  factors: Record<string, number>;
  recommendations: string[];
}

export interface AdvancedMatch {
  ride: {
    _id: string;
    [key: string]: unknown;
  };
  matchScore: number;
  breakdown: {
    routeOverlap: number;
    timeCompatibility: number;
    seatAvailability: number;
    driverReliability: number;
    priceScore: number;
    preferenceMatch: number;
  };
  routeAnalysis: {
    sharedDistance: number;
    detourRequired: number;
    pickupWalkDistance: number;
    dropoffWalkDistance: number;
  };
}

export const advancedAPI = {
  // Dynamic Pricing
  calculatePrice: async (params: {
    pickup: { lat: number; lng: number };
    drop: { lat: number; lng: number };
    vehicleType?: string;
    seatsRequired?: number;
  }): Promise<DynamicPrice> => {
    const response = await api.post("/advanced/pricing/calculate", params);
    return response.data;
  },

  validatePrice: async (price: number, distance: number): Promise<{ valid: boolean; suggestion?: number }> => {
    const response = await api.post("/advanced/pricing/validate", { price, distance });
    return response.data;
  },

  // Carbon Impact
  getCarbonImpact: async (): Promise<CarbonImpact> => {
    const response = await api.get("/advanced/carbon/impact");
    return response.data;
  },

  previewCarbonImpact: async (distanceKm: number, passengers: number): Promise<{ co2Saved: number; fuelSaved: number }> => {
    const response = await api.post("/advanced/carbon/preview", { distanceKm, passengers });
    return response.data;
  },

  getCarbonLeaderboard: async (limit?: number): Promise<Array<{ userId: string; name: string; co2Saved: number; rank: number }>> => {
    const response = await api.get("/advanced/carbon/leaderboard", { params: { limit } });
    return response.data;
  },

  // Demand Forecasting
  getForecast: async (location?: { lat: number; lng: number }): Promise<DemandForecast> => {
    const response = await api.post("/advanced/demand/forecast", { location });
    return response.data;
  },

  getBestPostingTimes: async (routeId?: string): Promise<Array<{ hour: number; score: number; reason: string }>> => {
    const response = await api.get("/advanced/demand/best-times", { params: { routeId } });
    return response.data;
  },

  // Advanced Ride Matching
  findBestMatches: async (params: {
    pickup: { lat: number; lng: number };
    drop: { lat: number; lng: number };
    departureTime: string;
    passengers?: number;
    preferences?: Record<string, unknown>;
  }): Promise<{ matches: AdvancedMatch[]; meta: { totalEvaluated: number; algorithm: string } }> => {
    const response = await api.post("/advanced/matching/find", params);
    return response.data;
  },

  // Fraud Detection (admin only)
  getFraudRisk: async (userId: string): Promise<FraudRisk> => {
    const response = await api.get(`/advanced/fraud/risk/${userId}`);
    return response.data;
  },

  // Search Caching Stats (admin only)
  getCacheStats: async (): Promise<{ hits: number; misses: number; size: number; hitRate: number }> => {
    const response = await api.get("/advanced/cache/stats");
    return response.data;
  },
};

// Message/Chat API with Location Sharing
export interface LocationMessage {
  _id: string;
  ride: string;
  sender: { _id: string; name: string; photo?: string };
  receiver: { _id: string; name: string; photo?: string };
  type: "text" | "location" | "location_share" | "system";
  text?: string;
  location?: {
    coordinates: [number, number]; // [lng, lat]
    isLive: boolean;
    trackingToken?: string;
    lastUpdated?: string;
    snapshot?: {
      address?: string;
      distanceRemaining?: number;
      etaMinutes?: number;
    };
  };
  locationExpired?: boolean;
  read: boolean;
  createdAt: string;
}

export const messageAPI = {
  // Send text message
  send: async (data: { rideId: string; receiverId: string; text: string }): Promise<LocationMessage> => {
    const response = await api.post("/messages/send", data);
    return response.data;
  },

  // Share live location in chat
  shareLocation: async (data: {
    rideId: string;
    receiverId: string;
    coordinates: { lat: number; lng: number };
    address?: string;
    trackingToken?: string;
  }): Promise<LocationMessage> => {
    const response = await api.post("/messages/share-location", data);
    return response.data;
  },

  // Update live location
  updateLocation: async (messageId: string, data: {
    coordinates: { lat: number; lng: number };
    distanceRemaining?: number;
    etaMinutes?: number;
  }): Promise<{ success: boolean }> => {
    const response = await api.patch(`/messages/location/${messageId}/update`, data);
    return response.data;
  },

  // Stop live location sharing
  stopLocationSharing: async (messageId: string): Promise<{ success: boolean }> => {
    const response = await api.patch(`/messages/location/${messageId}/stop`);
    return response.data;
  },

  // Get conversation
  getConversation: async (rideId: string, userId: string): Promise<LocationMessage[]> => {
    const response = await api.get(`/messages/conversation/${rideId}/${userId}`);
    return response.data;
  },

  // Get all conversations
  getConversations: async () => {
    const response = await api.get("/messages/conversations");
    return response.data;
  },

  // Mark as read
  markAsRead: async (rideId: string, userId: string) => {
    const response = await api.patch(`/messages/mark-read/${rideId}/${userId}`);
    return response.data;
  },
};

// Chatbot API
export interface ChatbotResponse {
  type: string;
  message: string;
  sessionId?: string;
  timestamp?: string;
  rides?: Array<{
    _id: string;
    source: { name: string; coordinates: { lat: number; lng: number } };
    destination: { name: string; coordinates: { lat: number; lng: number } };
    departureTime: string;
    price?: number;
    pricePerSeat?: number;
    availableSeats: number;
    driver: { _id: string; name: string; photo?: string; rating?: number };
  }>;
  searchParams?: {
    from?: string;
    to?: string;
    date?: string;
    time?: string;
    preferences?: Record<string, unknown>;
  };
  suggestions?: string[];
  quickActions?: Array<{ type: string; text: string; action: string }>;
}

export const chatbotAPI = {
  // Send message to chatbot
  sendMessage: async (message: string, sessionId?: string): Promise<ChatbotResponse> => {
    const response = await api.post("/chatbot/message", { message, sessionId });
    return response.data;
  },

  // Handle quick action
  handleAction: async (action: string, sessionId?: string): Promise<ChatbotResponse> => {
    const response = await api.post("/chatbot/action", { action, sessionId });
    return response.data;
  },

  // Get ride prediction (authenticated)
  getPrediction: async () => {
    const response = await api.get("/chatbot/prediction");
    return response.data;
  },

  // Get FAQ topics
  getFAQ: async (): Promise<{ topics: Array<{ id: string; keywords: string[]; preview: string }>; categories: string[] }> => {
    const response = await api.get("/chatbot/faq");
    return response.data;
  },

  // Get specific FAQ answer
  getFAQTopic: async (topic: string): Promise<{ topic: string; response: string; relatedTopics: string[] }> => {
    const response = await api.get(`/chatbot/faq/${topic}`);
    return response.data;
  },

  // Get suggestions
  getSuggestions: async (): Promise<{ suggestions: Array<{ type: string; text: string; action: string }> }> => {
    const response = await api.get("/chatbot/suggestions");
    return response.data;
  },

  // Clear conversation history
  clearHistory: async () => {
    const response = await api.delete("/chatbot/history");
    return response.data;
  },
};

// Recurring Rides API
export interface RecurringRide {
  _id: string;
  creator: string;
  source: { name: string; coordinates: { lat: number; lng: number } };
  destination: { name: string; coordinates: { lat: number; lng: number } };
  departureTime: string;
  recurrenceType: 'daily' | 'weekly' | 'custom';
  recurrenceDays: number[];
  availableSeats: number;
  pricePerSeat: number;
  isActive: boolean;
  advanceBookingDays: number;
  skipDates: string[];
  createdAt: string;
}

export const recurringRideAPI = {
  // Create recurring ride
  create: async (data: {
    source: { name: string; coordinates: { lat: number; lng: number } };
    destination: { name: string; coordinates: { lat: number; lng: number } };
    departureTime: string;
    recurrenceType: 'daily' | 'weekly' | 'custom';
    recurrenceDays?: number[];
    availableSeats: number;
    pricePerSeat: number;
    advanceBookingDays?: number;
    vehicleDetails?: Record<string, unknown>;
    preferences?: Record<string, unknown>;
  }): Promise<RecurringRide> => {
    const response = await api.post("/recurring-rides", data);
    return response.data;
  },

  // Get my recurring rides
  getMyRecurringRides: async (): Promise<RecurringRide[]> => {
    const response = await api.get("/recurring-rides/my");
    return response.data;
  },

  // Get specific recurring ride
  getById: async (id: string): Promise<RecurringRide> => {
    const response = await api.get(`/recurring-rides/${id}`);
    return response.data;
  },

  // Update recurring ride
  update: async (id: string, data: Partial<RecurringRide>): Promise<RecurringRide> => {
    const response = await api.patch(`/recurring-rides/${id}`, data);
    return response.data;
  },

  // Delete recurring ride
  delete: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/recurring-rides/${id}`);
    return response.data;
  },

  // Toggle active status
  toggleActive: async (id: string): Promise<RecurringRide> => {
    const response = await api.patch(`/recurring-rides/${id}/toggle`);
    return response.data;
  },

  // Skip specific dates
  skipDates: async (id: string, dates: string[]): Promise<RecurringRide> => {
    const response = await api.patch(`/recurring-rides/${id}/skip`, { dates });
    return response.data;
  },

  // Generate rides from recurring schedule
  generateRides: async (id: string): Promise<{ generated: number; rides: unknown[] }> => {
    const response = await api.post(`/recurring-rides/${id}/generate`);
    return response.data;
  },
};

// Gamification API
export interface UserGamification {
  _id: string;
  userId: string;
  badges: Array<{ badgeId: string; unlockedAt: string; progress?: number }>;
  level: number;
  levelName: string;
  points: { total: number; thisWeek: number; thisMonth: number; allTime: number };
  streak: { current: number; longest: number; lastActivityDate: string };
  stats: {
    ridesCompleted: number;
    ridesPosted: number;
    co2Saved: number;
    friendsReferred: number;
    reviewsGiven: number;
    ridesCancelled: number;
  };
  challenges: Array<{
    challengeId: string;
    startDate: string;
    endDate: string;
    progress: number;
    target: number;
    completed: boolean;
  }>;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  points: number;
  requirement: { type: string; value: number };
  rarity: string;
}

export const gamificationAPI = {
  // Get user's gamification profile
  getProfile: async (): Promise<UserGamification> => {
    const response = await api.get("/gamification/profile");
    return response.data;
  },

  // Get all available badges
  getBadges: async (): Promise<Badge[]> => {
    const response = await api.get("/gamification/badges");
    return response.data;
  },

  // Get leaderboard
  getLeaderboard: async (timeframe?: 'weekly' | 'monthly' | 'allTime', limit?: number): Promise<Array<{
    rank: number;
    userId: string;
    name: string;
    photo?: string;
    points: number;
    level: number;
    levelName: string;
  }>> => {
    const response = await api.get("/gamification/leaderboard", { params: { timeframe, limit } });
    return response.data;
  },

  // Get active challenges
  getChallenges: async (): Promise<Array<{
    id: string;
    name: string;
    description: string;
    type: string;
    target: number;
    reward: number;
    startDate: string;
    endDate: string;
    userProgress?: number;
    userCompleted?: boolean;
  }>> => {
    const response = await api.get("/gamification/challenges");
    return response.data;
  },

  // Join a challenge
  joinChallenge: async (challengeId: string): Promise<{ message: string }> => {
    const response = await api.post(`/gamification/challenges/${challengeId}/join`);
    return response.data;
  },

  // Check and award badges
  checkBadges: async (): Promise<{ newBadges: Badge[] }> => {
    const response = await api.post("/gamification/check-badges");
    return response.data;
  },

  // Get user's rank
  getRank: async (timeframe?: 'weekly' | 'monthly' | 'allTime'): Promise<{ rank: number; total: number; percentile: number }> => {
    const response = await api.get("/gamification/rank", { params: { timeframe } });
    return response.data;
  },
};

// Corporate Account API
export interface CorporateAccount {
  _id: string;
  companyName: string;
  companyDomain: string;
  adminUsers: Array<{ userId: string; role: 'owner' | 'admin' }>;
  employees: Array<{ userId: string; email: string; status: 'pending' | 'active' | 'inactive'; joinedAt: string }>;
  subsidyRules: {
    type: 'percentage' | 'fixed' | 'full';
    value: number;
    maxPerRide?: number;
    maxPerMonth?: number;
    monthlyLimit?: number;
  };
  settings: {
    requireEmailDomain: boolean;
    autoApproveEmployees: boolean;
    requireManagerApproval: boolean;
  };
  stats: {
    totalRides: number;
    totalSpent: number;
    totalSaved: number;
    co2Saved: number;
  };
  isActive: boolean;
  createdAt: string;
}

export const corporateAPI = {
  // Register corporate account
  register: async (data: {
    companyName: string;
    companyDomain: string;
    subsidyType?: 'percentage' | 'fixed' | 'full';
    subsidyValue?: number;
    subsidyCaps?: { maxPerRide?: number; maxPerMonth?: number; monthlyLimit?: number };
  }): Promise<CorporateAccount> => {
    const response = await api.post("/corporate/register", data);
    return response.data;
  },

  // Get corporate account
  getAccount: async (): Promise<CorporateAccount> => {
    const response = await api.get("/corporate/account");
    return response.data;
  },

  // Update corporate account settings
  updateAccount: async (data: Partial<CorporateAccount>): Promise<CorporateAccount> => {
    const response = await api.patch("/corporate/account", data);
    return response.data;
  },

  // Add employee
  addEmployee: async (email: string): Promise<{ message: string }> => {
    const response = await api.post("/corporate/employees", { email });
    return response.data;
  },

  // Remove employee
  removeEmployee: async (userId: string): Promise<{ message: string }> => {
    const response = await api.delete(`/corporate/employees/${userId}`);
    return response.data;
  },

  // Get employee list
  getEmployees: async (): Promise<Array<{ userId: string; email: string; name?: string; status: string; ridesCount: number; subsidyUsed: number }>> => {
    const response = await api.get("/corporate/employees");
    return response.data;
  },

  // Calculate subsidy for a ride
  calculateSubsidy: async (ridePrice: number): Promise<{ originalPrice: number; subsidy: number; finalPrice: number; subsidyType: string }> => {
    const response = await api.post("/corporate/calculate-subsidy", { ridePrice });
    return response.data;
  },

  // Get corporate dashboard stats
  getDashboard: async (): Promise<{
    totalEmployees: number;
    activeEmployees: number;
    totalRides: number;
    totalSubsidy: number;
    co2Saved: number;
    monthlyTrend: Array<{ month: string; rides: number; subsidy: number }>;
  }> => {
    const response = await api.get("/corporate/dashboard");
    return response.data;
  },

  // Invite employees by email list
  bulkInvite: async (emails: string[]): Promise<{ invited: number; failed: string[] }> => {
    const response = await api.post("/corporate/bulk-invite", { emails });
    return response.data;
  },
};

export default api;
