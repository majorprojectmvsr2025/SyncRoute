const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const { generateToken, protect } = require("../middleware/auth");

const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please provide all required fields" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: role || "passenger"
    });

    const token = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      photo: user.photo,
      bio: user.bio,
      vehicle: user.vehicle,
      rating: user.rating,
      trips: user.trips,
      verified: user.verified,
      role: user.role,
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please provide email and password" });
    }

    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user._id);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      photo: user.photo,
      bio: user.bio,
      vehicle: user.vehicle,
      rating: user.rating,
      trips: user.trips,
      verified: user.verified,
      role: user.role,
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Get current user
router.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const jwt = require("jsonwebtoken");
    const JWT_SECRET = process.env.JWT_SECRET || "syncroute_secret_key_2026";
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password -resetPasswordToken -resetPasswordExpires");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(401).json({ message: "Not authorized" });
  }
});

// Update profile
router.put("/profile", protect, async (req, res) => {
  try {
    const { name, phone, bio, photo, vehicle, role, documents } = req.body;

    const updateFields = {};
    if (name?.trim()) updateFields.name = name.trim();
    if (phone !== undefined) updateFields.phone = phone;
    if (bio !== undefined) updateFields.bio = bio?.trim()?.substring(0, 300) || "";
    if (photo !== undefined) updateFields.photo = photo;
    if (role && ["passenger", "driver", "both"].includes(role)) updateFields.role = role;
    if (vehicle) {
      if (vehicle.model !== undefined) updateFields["vehicle.model"] = vehicle.model;
      if (vehicle.type && ["Sedan", "SUV", "Compact", "Van"].includes(vehicle.type)) {
        updateFields["vehicle.type"] = vehicle.type;
      }
      if (vehicle.color !== undefined) updateFields["vehicle.color"] = vehicle.color;
      if (vehicle.licensePlate !== undefined) updateFields["vehicle.licensePlate"] = vehicle.licensePlate;
    }
    if (documents) {
      if (documents.licenseVerified   !== undefined) updateFields["documents.licenseVerified"]   = !!documents.licenseVerified;
      if (documents.rcVerified        !== undefined) updateFields["documents.rcVerified"]        = !!documents.rcVerified;
      if (documents.insuranceVerified !== undefined) updateFields["documents.insuranceVerified"] = !!documents.insuranceVerified;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select("-password -resetPasswordToken -resetPasswordExpires");

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Forgot password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Please provide an email address" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Generic response to avoid email enumeration
    if (!user) {
      return res.json({ message: "If that email exists, a reset link has been sent" });
    }

    // Generate token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    const resetURL = `${process.env.FRONTEND_URL || "http://localhost:8080"}/reset-password?token=${rawToken}`;

    // Configure transporter (use env vars; falls back to Ethereal for dev)
    let transporter;
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      // Ethereal dev account
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || "SyncRoute <noreply@syncroute.app>",
      to: user.email,
      subject: "SyncRoute — Password Reset",
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
          <h2 style="color: #a78bfa; margin-bottom: 8px;">Reset your password</h2>
          <p style="color: #94a3b8; margin-bottom: 24px;">Hi ${user.name}, click the button below to reset your password. This link expires in 1 hour.</p>
          <a href="${resetURL}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #06b6d4); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset Password</a>
          <p style="color: #64748b; margin-top: 24px; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);

    // Log preview URL in dev
    if (!process.env.SMTP_HOST) {
      console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
    }

    res.json({ message: "If that email exists, a reset link has been sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Failed to send reset email" });
  }
});

// Reset password
router.post("/reset-password", async (req, res) => {
  try {
    const { token } = req.query;
    const { password } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Reset token is required" });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Token is invalid or has expired" });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful. You can now log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

module.exports = router;
