const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const Notification = require("../models/Notification");

const JWT_SECRET = process.env.JWT_SECRET || "syncroute_secret_key_2026";

module.exports = (io) => {
  // JWT auth middleware for socket connections
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("Authentication error: no token"));
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error("Authentication error: invalid token"));
    }
  });

  io.on("connection", (socket) => {
    // Join user's personal notification room
    socket.join(`user:${socket.userId}`);
    console.log(`Socket connected: user:${socket.userId}`);

    // Join ride-specific chat room
    socket.on("join_ride_room", (rideId) => {
      socket.join(`ride:${rideId}`);
    });

    socket.on("leave_ride_room", (rideId) => {
      socket.leave(`ride:${rideId}`);
    });

    // Real-time message sending
    socket.on("send_message", async ({ rideId, receiverId, text }) => {
      try {
        if (!rideId || !receiverId || !text?.trim()) return;

        const message = await Message.create({
          ride: rideId,
          sender: socket.userId,
          receiver: receiverId,
          text: text.trim().substring(0, 1000)
        });

        const populated = await Message.findById(message._id)
          .populate("sender", "name photo")
          .populate("receiver", "name photo");

        // Broadcast to the ride room
        io.to(`ride:${rideId}`).emit("message_received", populated);

        // Notify receiver's personal room
        io.to(`user:${receiverId}`).emit("notification", {
          type: "new_message",
          title: "New message",
          message: text.trim().substring(0, 60) + (text.length > 60 ? "..." : ""),
          data: { rideId },
          read: false,
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Socket send_message error:", err);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Typing indicators
    socket.on("typing", ({ rideId }) => {
      socket.to(`ride:${rideId}`).emit("user_typing", { userId: socket.userId });
    });

    socket.on("stop_typing", ({ rideId }) => {
      socket.to(`ride:${rideId}`).emit("user_stop_typing", { userId: socket.userId });
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: user:${socket.userId}`);
    });
  });
};
