const express = require("express");
const User = require("../models/User");
const { generateToken } = require("../middleware/auth");

const router = express.Router();

// Google OAuth Login/Register
router.post("/google", async (req, res) => {
  try {
    const { email, name, googleId, photo } = req.body;

    if (!email || !name || !googleId) {
      return res.status(400).json({ message: "Missing required Google auth data" });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // User exists, log them in
      const token = generateToken(user._id);
      
      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photo: user.photo || photo,
        rating: user.rating,
        trips: user.trips,
        verified: user.verified,
        role: user.role,
        token
      });
    }

    // User doesn't exist, create new account
    user = new User({
      name,
      email,
      password: Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12),
      photo: photo || "",
      verified: true,
      role: "passenger"
    });

    // Save without triggering password hashing (password is already random)
    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      photo: user.photo,
      rating: user.rating,
      trips: user.trips,
      verified: user.verified,
      role: user.role,
      token
    });

  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ message: "Google authentication failed", error: error.message });
  }
});

module.exports = router;
