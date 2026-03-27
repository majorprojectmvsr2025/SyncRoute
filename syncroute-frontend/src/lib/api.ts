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
    vehicle?: { model?: string; type?: string; color?: string; licensePlate?: string };
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
  getStatus: async () => {
    const response = await api.get("/documents/status");
    return response.data;
  },
};

export default api;
