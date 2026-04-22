require("dotenv").config();

const http = require("http");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./routes/authRoutes");
const googleAuthRoutes = require("./routes/googleAuthRoutes");
const rideRoutes = require("./routes/rideRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const messageRoutes = require("./routes/messageRoutes");
const statsRoutes = require("./routes/statsRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const driverRoutes = require("./routes/driverRoutes");
const documentRoutes = require("./routes/documentRoutes");
const liveTrackingRoutes = require("./routes/liveTrackingRoutes");
const sosRoutes = require("./routes/sosRoutes");
const waitlistRoutes = require("./routes/waitlistRoutes");
const prieRoutes = require("./routes/prieRoutes");
const advancedRoutes = require("./routes/advancedRoutes");
const recurringRideRoutes = require("./routes/recurringRideRoutes");
const gamificationRoutes = require("./routes/gamificationRoutes");
const corporateRoutes = require("./routes/corporateRoutes");
const chatbotRoutes = require("./routes/chatbotRoutes");

const app = express();
const httpServer = http.createServer(app);

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(morgan("combined"));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { message: "Too many requests, please try again later" }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: "Too many auth attempts, please try again later" }
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use(generalLimiter);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// MongoDB
const mongoOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/syncroute", mongoOptions)
  .then(() => {
    console.log("✅ MongoDB Connected");
    console.log("   Database:", mongoose.connection.name);
    console.log("   Host:", mongoose.connection.host);
  })
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err.message);
    console.error("   Full error:", err);
    console.error("   Connection string (masked):", process.env.MONGODB_URI ? "mongodb+srv://***:***@..." : "local");
  });

// Monitor MongoDB connection status
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  Mongoose disconnected from MongoDB');
});

// Socket.io
const { Server } = require("socket.io");
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});
require("./socket/socketHandler")(io);
app.set("io", io);

// Import push routes
const pushRoutes = require("./routes/pushRoutes");

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/auth", googleAuthRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/live-tracking", liveTrackingRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/waitlist", waitlistRoutes);
app.use("/api/prie", prieRoutes);
app.use("/api/advanced", advancedRoutes);
app.use("/api/recurring-rides", recurringRideRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api/corporate", corporateRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/push", pushRoutes);

// Health check with cloud status
app.get("/api/health", (req, res) => {
  const { getStorageInfo } = require("./utils/cloudStorage");
  const { getFCMInfo } = require("./utils/firebasePush");
  const { getOCRInfo } = require("./utils/cloudOCR");
  
  const mongoStatus = mongoose.connection.readyState;
  const mongoStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({ 
    status: "ok", 
    message: "SyncRoute API is running", 
    timestamp: new Date().toISOString(),
    database: {
      status: mongoStates[mongoStatus] || 'unknown',
      readyState: mongoStatus,
      name: mongoose.connection.name || 'not connected',
      host: mongoose.connection.host || 'not connected'
    },
    cloud: {
      storage: getStorageInfo(),
      pushNotifications: getFCMInfo(),
      ocr: getOCRInfo()
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`🚀 SyncRoute server running on port ${PORT}`));
