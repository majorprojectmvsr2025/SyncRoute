const express = require("express");
const User = require("../models/User");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");
const nodemailer = require("nodemailer");

const router = express.Router();

// Email transporter (configure with actual SMTP settings in production)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Helper to emit notification via socket
 */
async function emitNotification(req, userId, notifData) {
  const notification = await Notification.create({ user: userId, ...notifData });
  const io = req.app.get("io");
  io.to(`user:${userId}`).emit("notification", notification);
  return notification;
}

/**
 * Trigger SOS Emergency Alert
 * POST /api/sos/trigger
 */
router.post("/trigger", protect, async (req, res) => {
  try {
    const { rideId, location, additionalInfo } = req.body;
    
    // Get user with emergency contact
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if emergency contact is configured
    const emergencyPhone = user.emergencyContact?.phone;
    const emergencyEmail = user.emergencyContact?.email;
    
    if (!emergencyPhone && !emergencyEmail) {
      return res.status(400).json({ 
        message: "Emergency contact details not configured",
        code: "NO_EMERGENCY_CONTACT"
      });
    }
    
    // Get ride and booking details
    const ride = await Ride.findById(rideId)
      .populate("driver", "name phone photo vehicle");
    
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }
    
    // Verify user is part of this ride
    const isDriver = ride.driver._id.toString() === req.user._id.toString();
    let booking = null;
    
    if (!isDriver) {
      booking = await Booking.findOne({
        ride: rideId,
        passenger: req.user._id,
        status: { $in: ["confirmed", "pending"] }
      });
      
      if (!booking) {
        return res.status(403).json({ message: "You are not a participant in this ride" });
      }
    }
    
    // Build emergency alert data
    const timestamp = new Date();
    const mapUrl = location 
      ? `https://www.google.com/maps?q=${location.lat},${location.lng}`
      : null;
    
    const alertData = {
      triggeredBy: {
        name: user.name,
        phone: user.phone,
        role: isDriver ? "Driver" : "Passenger"
      },
      ride: {
        from: ride.from?.name,
        to: ride.to?.name,
        date: ride.date,
        departureTime: ride.departureTime
      },
      driver: {
        name: ride.driver.name,
        phone: ride.driver.phone,
        vehicle: `${ride.driver.vehicle?.color || ""} ${ride.driver.vehicle?.model || ride.vehicleModel || "Unknown"} (${ride.driver.vehicle?.licensePlate || "Unknown Plate"})`
      },
      location: location ? {
        lat: location.lat,
        lng: location.lng,
        mapUrl
      } : null,
      timestamp: timestamp.toISOString(),
      additionalInfo: additionalInfo || ""
    };
    
    // Send email alert
    let emailSent = false;
    if (emergencyEmail) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || "SyncRoute Safety <safety@syncroute.com>",
          to: emergencyEmail,
          subject: `🚨 EMERGENCY SOS ALERT - ${user.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">🚨 EMERGENCY SOS ALERT</h1>
              </div>
              
              <div style="padding: 20px; background: #fef2f2; border: 1px solid #fecaca;">
                <p style="font-size: 16px; color: #991b1b; font-weight: bold;">
                  ${user.name} has triggered an emergency alert from their SyncRoute ride.
                </p>
              </div>
              
              <div style="padding: 20px;">
                <h2 style="color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">
                  📍 Location
                </h2>
                ${mapUrl 
                  ? `<p><a href="${mapUrl}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Location on Map</a></p>`
                  : `<p style="color: #6b7280;">Location not available</p>`
                }
                
                <h2 style="color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 20px;">
                  🚗 Ride Details
                </h2>
                <ul style="color: #374151; line-height: 1.8;">
                  <li><strong>Route:</strong> ${alertData.ride.from} → ${alertData.ride.to}</li>
                  <li><strong>Date:</strong> ${alertData.ride.date}</li>
                  <li><strong>Time:</strong> ${alertData.ride.departureTime}</li>
                </ul>
                
                <h2 style="color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 20px;">
                  👤 Driver Information
                </h2>
                <ul style="color: #374151; line-height: 1.8;">
                  <li><strong>Name:</strong> ${alertData.driver.name}</li>
                  <li><strong>Phone:</strong> ${alertData.driver.phone || "Not available"}</li>
                  <li><strong>Vehicle:</strong> ${alertData.driver.vehicle}</li>
                </ul>
                
                <h2 style="color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 20px;">
                  🆘 Alert Triggered By
                </h2>
                <ul style="color: #374151; line-height: 1.8;">
                  <li><strong>Name:</strong> ${alertData.triggeredBy.name}</li>
                  <li><strong>Phone:</strong> ${alertData.triggeredBy.phone || "Not available"}</li>
                  <li><strong>Role:</strong> ${alertData.triggeredBy.role}</li>
                </ul>
                
                ${additionalInfo ? `
                  <h2 style="color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 20px;">
                    📝 Additional Information
                  </h2>
                  <p style="color: #374151;">${additionalInfo}</p>
                ` : ""}
                
                <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                  Alert time: ${timestamp.toLocaleString()}
                </p>
              </div>
              
              <div style="background: #f3f4f6; padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
                This is an automated emergency alert from SyncRoute.
                If you believe this was sent in error, please contact support.
              </div>
            </div>
          `
        });
        emailSent = true;
      } catch (emailError) {
        console.error("Email send error:", emailError);
      }
    }
    
    // Store SOS record in notifications
    await Notification.create({
      user: req.user._id,
      type: "sos_alert",
      title: "SOS Alert Sent",
      message: `Emergency alert sent to ${emergencyEmail || emergencyPhone}`,
      data: alertData
    });
    
    // Also notify the other participant in the ride
    if (isDriver) {
      // Notify all passengers
      const bookings = await Booking.find({
        ride: rideId,
        status: { $in: ["confirmed", "pending"] }
      });
      
      for (const b of bookings) {
        await emitNotification(req, b.passenger, {
          type: "sos_alert",
          title: "Driver Triggered SOS",
          message: "The driver has triggered an emergency alert for this ride",
          data: { rideId }
        });
      }
    } else {
      // Notify driver
      await emitNotification(req, ride.driver._id, {
        type: "sos_alert",
        title: "Passenger Triggered SOS",
        message: `${user.name} has triggered an emergency alert`,
        data: { rideId, passengerId: req.user._id }
      });
    }
    
    res.json({
      message: "Emergency alert sent successfully",
      alertSent: {
        email: emailSent,
        phone: false // SMS integration would go here
      },
      timestamp: timestamp.toISOString()
    });
  } catch (error) {
    console.error("SOS trigger error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update emergency contact
 * PUT /api/sos/emergency-contact
 */
router.put("/emergency-contact", protect, async (req, res) => {
  try {
    const { phone, email, name, relationship } = req.body;
    
    if (!phone && !email) {
      return res.status(400).json({ 
        message: "At least one of phone or email is required" 
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        emergencyContact: {
          phone: phone || "",
          email: email || "",
          name: name || "",
          relationship: relationship || ""
        }
      },
      { new: true }
    ).select("-password");
    
    res.json({
      message: "Emergency contact updated",
      emergencyContact: user.emergencyContact
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get emergency contact
 * GET /api/sos/emergency-contact
 */
router.get("/emergency-contact", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("emergencyContact");
    res.json(user?.emergencyContact || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get SOS history
 * GET /api/sos/history
 */
router.get("/history", protect, async (req, res) => {
  try {
    const sosAlerts = await Notification.find({
      user: req.user._id,
      type: "sos_alert"
    }).sort({ createdAt: -1 }).limit(50);
    
    res.json(sosAlerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
