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
  rating: {
    type: Number,
    default: 5.0,
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
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

UserSchema.pre("save", async function() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
