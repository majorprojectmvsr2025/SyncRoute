const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const { generateToken, protect } = require("../middleware/auth");

const router = express.Router();

// Helper function to generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper function to send OTP email
const sendOTPEmail = async (email, name, otp) => {
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
    // Ethereal dev account for testing
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
    to: email,
    subject: "SyncRoute — Verify Your Email",
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
        <h2 style="color: #a78bfa; margin-bottom: 8px;">Welcome to SyncRoute!</h2>
        <p style="color: #94a3b8; margin-bottom: 24px;">Hi ${name}, please verify your email address to complete your registration.</p>
        <div style="background: #1e293b; padding: 24px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
          <p style="color: #64748b; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Your verification code</p>
          <p style="font-size: 36px; font-weight: 700; color: #a78bfa; letter-spacing: 8px; margin: 0;">${otp}</p>
        </div>
        <p style="color: #94a3b8; font-size: 14px; margin-bottom: 16px;">This code will expire in 10 minutes.</p>
        <p style="color: #64748b; margin-top: 24px; font-size: 12px;">If you didn't create an account with SyncRoute, you can safely ignore this email.</p>
      </div>
    `
  };

  const info = await transporter.sendMail(mailOptions);

  // Log preview URL in dev
  if (!process.env.SMTP_HOST) {
    console.log("📧 OTP Email Preview URL:", nodemailer.getTestMessageUrl(info));
  }

  return info;
};

// Register - Step 1: Create unverified account and send OTP
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please provide all required fields" });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      // If user exists but not verified, allow resending OTP
      if (!userExists.verified) {
        // Generate new OTP
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        userExists.emailVerificationOTP = otp;
        userExists.emailVerificationOTPExpires = otpExpires;
        userExists.emailVerificationAttempts = 0;
        await userExists.save({ validateBeforeSave: false });

        // Send OTP email
        try {
          await sendOTPEmail(email, name, otp);
          console.log(`📧 OTP resent to ${email}: ${otp}`);
        } catch (emailError) {
          console.error("Email send error:", emailError);
          // Continue even if email fails - user can still verify
        }

        return res.status(200).json({
          message: "Account already exists but not verified. New OTP sent to your email.",
          requiresVerification: true,
          email: email
        });
      }
      
      return res.status(400).json({ message: "User already exists and is verified. Please login." });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create unverified user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      role: role || "passenger",
      verified: false,
      emailVerificationOTP: otp,
      emailVerificationOTPExpires: otpExpires,
      emailVerificationAttempts: 0
    });

    // Send OTP email
    try {
      await sendOTPEmail(email, name, otp);
      console.log(`📧 OTP sent to ${email}: ${otp}`);
    } catch (emailError) {
      console.error("Email send error:", emailError);
      // Continue even if email fails - user can still verify
    }

    res.status(201).json({
      message: "Registration successful! Please check your email for the verification code.",
      requiresVerification: true,
      email: user.email,
      userId: user._id
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Verify OTP - Step 2: Verify email with OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Please provide email and OTP" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.verified) {
      return res.status(400).json({ message: "Email already verified. Please login." });
    }

    // Check if OTP expired
    if (!user.emailVerificationOTPExpires || user.emailVerificationOTPExpires < new Date()) {
      return res.status(400).json({ 
        message: "OTP has expired. Please request a new one.",
        expired: true
      });
    }

    // Check attempts limit (max 5 attempts)
    if (user.emailVerificationAttempts >= 5) {
      return res.status(429).json({ 
        message: "Too many failed attempts. Please request a new OTP.",
        tooManyAttempts: true
      });
    }

    // Verify OTP
    if (user.emailVerificationOTP !== otp.trim()) {
      user.emailVerificationAttempts += 1;
      await user.save({ validateBeforeSave: false });

      return res.status(400).json({ 
        message: `Invalid OTP. ${5 - user.emailVerificationAttempts} attempts remaining.`,
        attemptsRemaining: 5 - user.emailVerificationAttempts
      });
    }

    // OTP is correct - verify user
    user.verified = true;
    user.emailVerificationOTP = null;
    user.emailVerificationOTPExpires = null;
    user.emailVerificationAttempts = 0;
    await user.save({ validateBeforeSave: false });

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: "Email verified successfully! Welcome to SyncRoute.",
      verified: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photo: user.photo,
        bio: user.bio,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        vehicle: user.vehicle,
        rating: user.rating,
        trips: user.trips,
        verified: user.verified,
        role: user.role,
        documents: user.documents,
        driverVerification: user.driverVerification,
        driverVerified: user.driverVerified
      },
      token
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Resend OTP
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Please provide email" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.verified) {
      return res.status(400).json({ message: "Email already verified. Please login." });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.emailVerificationOTP = otp;
    user.emailVerificationOTPExpires = otpExpires;
    user.emailVerificationAttempts = 0;
    await user.save({ validateBeforeSave: false });

    // Send OTP email
    try {
      await sendOTPEmail(email, user.name, otp);
      console.log(`📧 OTP resent to ${email}: ${otp}`);
    } catch (emailError) {
      console.error("Email send error:", emailError);
      return res.status(500).json({ message: "Failed to send OTP email" });
    }

    res.json({
      message: "New OTP sent to your email",
      email: user.email
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Register
// Login - Only allow verified users
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please provide email and password" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check if email is verified
    if (!user.verified) {
      return res.status(403).json({ 
        message: "Please verify your email before logging in. Check your inbox for the verification code.",
        requiresVerification: true,
        email: user.email
      });
    }

    const token = generateToken(user._id);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      photo: user.photo,
      bio: user.bio,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      vehicle: user.vehicle,
      rating: user.rating,
      trips: user.trips,
      verified: user.verified,
      role: user.role,
      documents: user.documents,
      driverVerification: user.driverVerification,
      driverVerified: user.driverVerified,
      emergencyContact: user.emergencyContact,
      reviewStats: user.reviewStats,
      reliabilityScore: user.reliabilityScore,
      token
    });
  } catch (error) {
    console.error("Login error:", error);
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
    const { name, phone, bio, photo, vehicle, role, documents, gender, dateOfBirth, driverVerification } = req.body;

    const updateFields = {};
    if (name?.trim()) updateFields.name = name.trim();
    if (phone !== undefined) updateFields.phone = phone;
    if (bio !== undefined) updateFields.bio = bio?.trim()?.substring(0, 300) || "";
    if (photo !== undefined) updateFields.photo = photo;
    if (role && ["passenger", "driver", "both"].includes(role)) updateFields.role = role;
    
    // Gender field
    if (gender && ["male", "female", "prefer_not_to_say", "other"].includes(gender)) {
      updateFields.gender = gender;
    }
    
    // Date of birth
    if (dateOfBirth !== undefined) {
      updateFields.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }
    
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
    
    // Driver verification data
    if (driverVerification) {
      if (driverVerification.drivingLicenseId !== undefined) {
        updateFields["driverVerification.drivingLicenseId"] = driverVerification.drivingLicenseId;
      }
      if (driverVerification.drivingLicenseImage !== undefined) {
        updateFields["driverVerification.drivingLicenseImage"] = driverVerification.drivingLicenseImage;
      }
      if (driverVerification.drivingLicenseVerified !== undefined) {
        updateFields["driverVerification.drivingLicenseVerified"] = !!driverVerification.drivingLicenseVerified;
      }
      if (driverVerification.drivingLicenseExpiry !== undefined) {
        updateFields["driverVerification.drivingLicenseExpiry"] = driverVerification.drivingLicenseExpiry ? new Date(driverVerification.drivingLicenseExpiry) : null;
      }
      if (driverVerification.vehicleNumber !== undefined) {
        updateFields["driverVerification.vehicleNumber"] = driverVerification.vehicleNumber;
      }
      if (driverVerification.vehicleRegistrationDoc !== undefined) {
        updateFields["driverVerification.vehicleRegistrationDoc"] = driverVerification.vehicleRegistrationDoc;
      }
      if (driverVerification.vehicleRegistrationVerified !== undefined) {
        updateFields["driverVerification.vehicleRegistrationVerified"] = !!driverVerification.vehicleRegistrationVerified;
      }
      if (driverVerification.vehicleType !== undefined && ["Sedan", "SUV", "Compact", "Van", "Motorcycle", "Other"].includes(driverVerification.vehicleType)) {
        updateFields["driverVerification.vehicleType"] = driverVerification.vehicleType;
      }
      if (driverVerification.vehiclePhoto !== undefined) {
        updateFields["driverVerification.vehiclePhoto"] = driverVerification.vehiclePhoto;
      }
      if (driverVerification.isVerified !== undefined) {
        updateFields["driverVerification.isVerified"] = !!driverVerification.isVerified;
        if (driverVerification.isVerified) {
          updateFields["driverVerification.verifiedAt"] = new Date();
        }
      }
      if (driverVerification.validationIssues !== undefined) {
        updateFields["driverVerification.validationIssues"] = driverVerification.validationIssues;
      }
      updateFields["driverVerification.lastValidationDate"] = new Date();
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
