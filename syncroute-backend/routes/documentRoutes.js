const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { protect } = require("../middleware/auth");
const { verifyDocument } = require("../utils/documentVerifier");
const User = require("../models/User");

const router = express.Router();

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "..", "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doc_${req.user._id}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext || mime) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPG, PNG, WebP) and PDFs are allowed"));
    }
  },
});

// POST /api/documents/verify
// Uploads and verifies a document through the 4-layer pipeline
router.post("/verify", protect, upload.single("document"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const docType = req.body.docType || "license"; // "license" | "rc" | "insurance"

  try {
    const result = await verifyDocument(req.file.path, docType);

    // If verification passed or is in review, update user's document status
    if (result.overall === "verified" || result.overall === "review") {
      const fieldMap = {
        license: "documents.licenseVerified",
        rc: "documents.rcVerified",
        insurance: "documents.insuranceVerified",
      };
      const field = fieldMap[docType];
      if (field) {
        await User.findByIdAndUpdate(req.user._id, {
          $set: { [field]: result.overall === "verified" },
        });
      }
    }

    // Clean up uploaded file
    fs.unlink(req.file.path, () => {});

    res.json({
      verified: result.overall === "verified",
      status: result.overall,
      confidence: result.confidence,
      layers: result.layers,
      extractedData: result.extractedData,
      issues: result.issues,
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    console.error("Document verification error:", error);
    res.status(500).json({ message: "Document verification failed", error: error.message });
  }
});

// GET /api/documents/status
// Get current user's document verification status
router.get("/status", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("documents");
    res.json({
      licenseVerified: !!user?.documents?.licenseVerified,
      rcVerified: !!user?.documents?.rcVerified,
      insuranceVerified: !!user?.documents?.insuranceVerified,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to get document status" });
  }
});

module.exports = router;
