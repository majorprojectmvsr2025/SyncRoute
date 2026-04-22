const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { protect } = require("../middleware/auth");
const { verifyDocument, verifyDocumentEnhanced, verifyVehiclePhoto } = require("../utils/documentVerifier");
const { validateDLFormat, validateVehicleNumber, validateDrivingAge, calculateAge } = require("../utils/documentValidationUtils");
const User = require("../models/User");

// Cloud integrations (graceful fallback if not configured)
const { uploadToCloud, deleteFromCloud, isCloudConfigured, getStorageInfo } = require("../utils/cloudStorage");

const router = express.Router();

// Rate limiting for verification requests (simple in-memory)
const verificationAttempts = new Map();
const MAX_ATTEMPTS_PER_HOUR = 10;

function checkRateLimit(userId) {
  const now = Date.now();
  const hourAgo = now - 3600000;
  
  const userAttempts = verificationAttempts.get(userId) || [];
  const recentAttempts = userAttempts.filter(t => t > hourAgo);
  
  if (recentAttempts.length >= MAX_ATTEMPTS_PER_HOUR) {
    return false;
  }
  
  recentAttempts.push(now);
  verificationAttempts.set(userId, recentAttempts);
  return true;
}

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

// File size and type validation
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    
    // Additional MIME type validation
    const validMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    const mimeValid = validMimes.includes(file.mimetype);
    
    if ((ext || mime) && mimeValid) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPG, PNG, WebP) and PDFs are allowed"));
    }
  },
});

// Helper to safely delete uploaded files
function cleanupFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error("File cleanup error:", err);
    });
  }
}

// GET /api/documents/cloud-status
// Returns current cloud storage configuration status
router.get("/cloud-status", protect, (req, res) => {
  const storageInfo = getStorageInfo();
  res.json({
    cloudEnabled: storageInfo.isCloudConfigured,
    provider: storageInfo.provider,
    cloudinary: storageInfo.cloudinary,
    s3: storageInfo.s3
  });
});

// POST /api/documents/verify
// Uploads and verifies a document through the 4-layer pipeline
router.post("/verify", protect, upload.single("document"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const docType = req.body.docType || "license"; // "license" | "rc" | "insurance"
  let cloudUploadResult = null;

  try {
    const userId = req.user?.id || 'unknown';
    
    // Upload to cloud storage if configured
    if (isCloudConfigured()) {
      cloudUploadResult = await uploadToCloud(req.file.path, {
        folder: `documents/${docType}`,
        publicId: `${userId}_${docType}_${Date.now()}`
      });
      console.log(`[Documents] Uploaded to cloud: ${cloudUploadResult.url}`);
    }

    // Use cloud URL or local path for verification
    const documentPath = cloudUploadResult?.isCloud ? cloudUploadResult.url : req.file.path;
    const result = await verifyDocument(documentPath, docType, userId);

    // If verification passed or is in review, update user's document status
    if (result.overall === "verified" || result.overall === "review") {
      const fieldMap = {
        license: "documents.licenseVerified",
        rc: "documents.rcVerified",
        insurance: "documents.insuranceVerified",
      };
      const field = fieldMap[docType];
      const updateFields = { [field]: result.overall === "verified" };
      
      // Store cloud URL in user profile if uploaded to cloud
      if (cloudUploadResult?.isCloud) {
        const urlField = docType === "license" ? "documents.licenseUrl" : 
                         docType === "rc" ? "documents.rcUrl" : "documents.insuranceUrl";
        updateFields[urlField] = cloudUploadResult.url;
      }
      
      if (field) {
        await User.findByIdAndUpdate(req.user._id, { $set: updateFields });
      }
    }

    // Clean up local file (keep cloud copy)
    cleanupFile(req.file.path);

    res.json({
      verified: result.overall === "verified",
      status: result.overall,
      confidence: result.confidence,
      layers: result.layers,
      extractedData: result.extractedData,
      issues: result.issues,
      cloudUrl: cloudUploadResult?.url || null,
      storageProvider: cloudUploadResult?.provider || 'local'
    });
  } catch (error) {
    // Clean up files on error
    cleanupFile(req.file?.path);
    if (cloudUploadResult?.isCloud) {
      await deleteFromCloud(cloudUploadResult.publicId, cloudUploadResult.provider);
    }
    console.error("Document verification error:", error);
    res.status(500).json({ message: "Document verification failed", error: error.message });
  }
});

// POST /api/documents/verify-enhanced
// Enhanced verification with name matching, age validation, and scoring
router.post("/verify-enhanced", protect, upload.single("document"), async (req, res) => {
  // Rate limiting
  if (!checkRateLimit(req.user._id.toString())) {
    cleanupFile(req.file?.path);
    return res.status(429).json({ 
      message: "Too many verification attempts. Please try again later.",
      retryAfter: 3600,
    });
  }

  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const docType = req.body.docType || "license";
  // Get user-entered document numbers for input verification
  const userDLNumber = req.body.dlNumber || null;
  const userVehicleNumber = req.body.vehicleNumber || null;
  const userDateOfBirth = req.body.userDateOfBirth || null;
  let cloudUploadResult = null;

  try {
    // Get user profile for name matching and data consistency checks
    const user = await User.findById(req.user._id).select("name driverVerification dateOfBirth");
    
    // Upload to cloud storage if configured
    if (isCloudConfigured()) {
      cloudUploadResult = await uploadToCloud(req.file.path, {
        folder: `documents/${docType}`,
        publicId: `${req.user._id}_${docType}_${Date.now()}`
      });
      console.log(`[Documents] Enhanced - uploaded to cloud: ${cloudUploadResult.url}`);
    }
    
    // Build comprehensive user profile for verification
    const userProfile = {
      name: user?.name,
      dateOfBirth: userDateOfBirth || user?.dateOfBirth || null,
      dlNumber: userDLNumber,
      vehicleNumber: userVehicleNumber,
    };
    
    // Use cloud URL or local path for verification
    const documentPath = cloudUploadResult?.isCloud ? cloudUploadResult.url : req.file.path;
    const userId = req.user?.id || 'unknown';
    const result = await verifyDocumentEnhanced(documentPath, docType, userProfile, userId);

    // Store verification result in user profile
    if (result.overall === "verified" || result.overall === "review") {
      const updateData = {
        "driverVerification.lastVerificationDate": new Date(),
        "driverVerification.lastVerificationScore": result.verificationScore,
      };
      
      // Store cloud URL if uploaded to cloud
      if (cloudUploadResult?.isCloud) {
        const urlField = docType === "license" ? "documents.licenseUrl" : 
                         docType === "rc" ? "documents.rcUrl" : "documents.insuranceUrl";
        updateData[urlField] = cloudUploadResult.url;
      }

      if (docType === "license") {
        updateData["documents.licenseVerified"] = result.overall === "verified";
        updateData["driverVerification.drivingLicenseVerified"] = result.overall === "verified";
        if (result.extractedData.dlNumber) {
          updateData["driverVerification.drivingLicenseId"] = result.extractedData.dlNumber;
        }
        if (result.extractedData.name) {
          updateData["driverVerification.extractedName"] = result.extractedData.name;
        }
        if (result.extractedData.dateOfBirth) {
          updateData["driverVerification.extractedDOB"] = result.extractedData.dateOfBirth;
        }
        if (result.extractedData.expiryDate) {
          updateData["driverVerification.licenseExpiry"] = result.extractedData.expiryDate;
        }
      } else if (docType === "rc") {
        updateData["documents.rcVerified"] = result.overall === "verified";
        updateData["driverVerification.vehicleRegistrationVerified"] = result.overall === "verified";
        if (result.extractedData.rcNumber) {
          updateData["driverVerification.vehicleNumber"] = result.extractedData.rcNumber;
        }
      } else if (docType === "insurance") {
        updateData["documents.insuranceVerified"] = result.overall === "verified";
      }

      // Update isVerified based on all checks
      const existingVerification = user?.driverVerification || {};
      const licenseVerified = docType === "license" 
        ? result.overall === "verified" 
        : existingVerification.drivingLicenseVerified;
      const rcVerified = docType === "rc"
        ? result.overall === "verified"
        : existingVerification.vehicleRegistrationVerified;

      if (licenseVerified && rcVerified) {
        updateData["driverVerification.isVerified"] = true;
        updateData["driverVerification.verifiedAt"] = new Date();
      }

      await User.findByIdAndUpdate(req.user._id, { $set: updateData });
    }

    // Clean up local file (keep cloud copy)
    cleanupFile(req.file.path);

    res.json({
      verified: result.overall === "verified",
      status: result.overall,
      verificationScore: result.verificationScore,
      confidence: result.confidence,
      scoring: result.scoring,
      layers: result.layers,
      extractedData: result.extractedData,
      issues: result.issues,
      flagForManualReview: result.flagForManualReview || false,
      cloudUrl: cloudUploadResult?.url || null,
      storageProvider: cloudUploadResult?.provider || 'local'
    });
  } catch (error) {
    cleanupFile(req.file?.path);
    if (cloudUploadResult?.isCloud) {
      await deleteFromCloud(cloudUploadResult.publicId, cloudUploadResult.provider);
    }
    console.error("Enhanced document verification error:", error);
    res.status(500).json({ message: "Document verification failed", error: error.message });
  }
});

// POST /api/documents/verify-vehicle-photo
// Verify a vehicle photo
router.post("/verify-vehicle-photo", protect, upload.single("photo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No photo uploaded" });
  }

  try {
    const result = await verifyVehiclePhoto(req.file.path);

    if (result.valid) {
      await User.findByIdAndUpdate(req.user._id, {
        $set: {
          "driverVerification.vehiclePhotoVerified": true,
          "driverVerification.vehiclePhotoDate": new Date(),
        },
      });
    }

    cleanupFile(req.file.path);

    res.json({
      valid: result.valid,
      confidence: result.confidence,
      issues: result.issues,
      detectedVehicleNumber: result.details.detectedVehicleNumber || null,
    });
  } catch (error) {
    cleanupFile(req.file?.path);
    console.error("Vehicle photo verification error:", error);
    res.status(500).json({ message: "Vehicle photo verification failed", error: error.message });
  }
});

// POST /api/documents/validate-dl
// Validate driving license format without OCR (quick check)
router.post("/validate-dl", protect, (req, res) => {
  const { dlNumber, dateOfBirth } = req.body;

  if (!dlNumber) {
    return res.status(400).json({ message: "Driving license number is required" });
  }

  const dlValidation = validateDLFormat(dlNumber);
  let ageValidation = null;

  if (dateOfBirth) {
    ageValidation = validateDrivingAge(dateOfBirth);
  }

  res.json({
    dlNumber: {
      valid: dlValidation.valid,
      formatted: dlValidation.dlNumber,
      stateCode: dlValidation.stateCode,
      stateName: dlValidation.stateName,
      message: dlValidation.message,
      warning: dlValidation.warning,
    },
    age: ageValidation ? {
      valid: ageValidation.valid,
      age: ageValidation.age,
      message: ageValidation.message,
    } : null,
  });
});

// POST /api/documents/validate-rc
// Validate vehicle registration number format
router.post("/validate-rc", protect, (req, res) => {
  const { vehicleNumber } = req.body;

  if (!vehicleNumber) {
    return res.status(400).json({ message: "Vehicle number is required" });
  }

  const validation = validateVehicleNumber(vehicleNumber);

  res.json({
    valid: validation.valid,
    formatted: validation.vehicleNumber,
    stateCode: validation.stateCode,
    stateName: validation.stateName,
    series: validation.series,
    number: validation.number,
    message: validation.message,
    warning: validation.warning,
  });
});

// GET /api/documents/status
// Get current user's document verification status
router.get("/status", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("documents driverVerification");
    
    const driverVerification = user?.driverVerification || {};
    
    res.json({
      licenseVerified: !!user?.documents?.licenseVerified,
      rcVerified: !!user?.documents?.rcVerified,
      insuranceVerified: !!user?.documents?.insuranceVerified,
      driverVerified: !!driverVerification.isVerified,
      verificationScore: driverVerification.lastVerificationScore || null,
      verifiedAt: driverVerification.verifiedAt || null,
      extractedData: {
        licenseNumber: driverVerification.drivingLicenseId || null,
        vehicleNumber: driverVerification.vehicleNumber || null,
        extractedName: driverVerification.extractedName || null,
        licenseExpiry: driverVerification.licenseExpiry || null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to get document status" });
  }
});

// GET /api/documents/verification-summary
// Get detailed verification summary for the user
router.get("/verification-summary", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("name documents driverVerification dateOfBirth");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const dv = user.driverVerification || {};
    const docs = user.documents || {};

    const summary = {
      overallStatus: dv.isVerified ? "verified" : "pending",
      verificationScore: dv.lastVerificationScore || 0,
      verifiedAt: dv.verifiedAt || null,
      
      documents: {
        license: {
          verified: !!docs.licenseVerified || !!dv.drivingLicenseVerified,
          number: dv.drivingLicenseId || null,
          expiry: dv.licenseExpiry || null,
          nameMatch: dv.extractedName ? (
            user.name?.toLowerCase().includes(dv.extractedName.toLowerCase().split(" ")[0]) 
              ? "match" 
              : "partial"
          ) : null,
        },
        vehicleRegistration: {
          verified: !!docs.rcVerified || !!dv.vehicleRegistrationVerified,
          number: dv.vehicleNumber || null,
        },
        vehiclePhoto: {
          verified: !!dv.vehiclePhotoVerified,
          uploadedAt: dv.vehiclePhotoDate || null,
        },
        insurance: {
          verified: !!docs.insuranceVerified,
        },
      },
      
      profileData: {
        name: user.name,
        dateOfBirth: user.dateOfBirth || null,
        extractedDOB: dv.extractedDOB || null,
      },
      
      nextSteps: [],
    };

    // Determine next steps
    if (!summary.documents.license.verified) {
      summary.nextSteps.push("Upload and verify your driving license");
    }
    if (!summary.documents.vehicleRegistration.verified) {
      summary.nextSteps.push("Upload and verify your vehicle registration certificate");
    }
    if (!summary.documents.vehiclePhoto.verified) {
      summary.nextSteps.push("Upload a photo of your vehicle");
    }
    if (summary.documents.license.expiry) {
      const expiryDate = new Date(summary.documents.license.expiry);
      const daysRemaining = Math.floor((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
      if (daysRemaining < 30 && daysRemaining >= 0) {
        summary.nextSteps.push(`License expiring soon (${daysRemaining} days remaining)`);
      } else if (daysRemaining < 0) {
        summary.nextSteps.push("License has expired - please renew and re-verify");
      }
    }

    res.json(summary);
  } catch (error) {
    console.error("Verification summary error:", error);
    res.status(500).json({ message: "Failed to get verification summary" });
  }
});

// DELETE /api/documents/:docType
// Delete/remove a specific document verification and related data
router.delete("/:docType", protect, async (req, res) => {
  try {
    const { docType } = req.params;
    const userId = req.user._id;
    
    // Validate document type
    const validDocTypes = ["license", "rc", "insurance"];
    if (!validDocTypes.includes(docType)) {
      return res.status(400).json({ 
        message: "Invalid document type. Must be: license, rc, or insurance" 
      });
    }
    
    // Map docType to database fields
    const docFieldMap = {
      license: "licenseVerified",
      rc: "rcVerified", 
      insurance: "insuranceVerified"
    };
    
    const docField = docFieldMap[docType];
    const isMandatory = ["license", "rc"].includes(docType);
    
    const updatePayload = {
      [`documents.${docField}`]: false
    };
    
    // If removing mandatory document, revoke driver verification
    if (isMandatory) {
      updatePayload["driverVerification.isVerified"] = false;
      updatePayload["driverVerification.verifiedAt"] = null;
      updatePayload["driverVerification.lastValidationDate"] = new Date();
      
      // Clear related extracted data
      if (docType === "license") {
        updatePayload["driverVerification.drivingLicenseId"] = null;
        updatePayload["driverVerification.drivingLicenseImage"] = null;
        updatePayload["driverVerification.drivingLicenseVerified"] = false;
        updatePayload["driverVerification.licenseExpiry"] = null;
        updatePayload["driverVerification.extractedName"] = null;
        updatePayload["driverVerification.extractedDOB"] = null;
      }
      
      if (docType === "rc") {
        updatePayload["driverVerification.vehicleNumber"] = null;
        updatePayload["driverVerification.vehicleRegistrationDoc"] = null;
        updatePayload["driverVerification.vehicleRegistrationVerified"] = false;
      }
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      updatePayload,
      { new: true, runValidators: true }
    ).select("name documents driverVerification");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Log the document removal
    console.log(`[DOC-DELETE] User ${userId} removed ${docType} document${isMandatory ? ' (driver verification revoked)' : ''}`);
    
    res.json({
      success: true,
      message: isMandatory 
        ? `${docType} document removed. Driver verification has been revoked.`
        : `${docType} document removed successfully.`,
      user: {
        documents: user.documents,
        driverVerification: user.driverVerification,
        revoked: isMandatory
      }
    });
    
  } catch (error) {
    console.error("Document deletion error:", error);
    res.status(500).json({ message: "Failed to remove document" });
  }
});

// PUT /api/documents/:docType/update
// Update document information without re-verification (for manual edits)
router.put("/:docType/update", protect, async (req, res) => {
  try {
    const { docType } = req.params;
    const userId = req.user._id;
    const { number, expiry, notes } = req.body;
    
    // Validate document type
    const validDocTypes = ["license", "rc", "insurance"];
    if (!validDocTypes.includes(docType)) {
      return res.status(400).json({ 
        message: "Invalid document type. Must be: license, rc, or insurance" 
      });
    }
    
    const updatePayload = {};
    updatePayload["driverVerification.lastValidationDate"] = new Date();
    
    // Update based on document type
    if (docType === "license" && number) {
      // Validate DL format before updating
      const dlValidation = validateDLFormat(number);
      if (!dlValidation.valid) {
        return res.status(400).json({ 
          message: `Invalid license format: ${dlValidation.message}` 
        });
      }
      
      updatePayload["driverVerification.drivingLicenseId"] = number;
      
      if (expiry) {
        updatePayload["driverVerification.licenseExpiry"] = new Date(expiry);
      }
    }
    
    if (docType === "rc" && number) {
      // Validate RC format before updating
      const rcValidation = validateVehicleNumber(number);
      if (!rcValidation.valid) {
        return res.status(400).json({ 
          message: `Invalid vehicle number format: ${rcValidation.message}` 
        });
      }
      
      updatePayload["driverVerification.vehicleNumber"] = number;
    }
    
    // Add notes/comments if provided
    if (notes !== undefined) {
      updatePayload[`driverVerification.${docType}Notes`] = notes;
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      updatePayload,
      { new: true, runValidators: true }
    ).select("name documents driverVerification");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Log the document update
    console.log(`[DOC-UPDATE] User ${userId} updated ${docType} document info`);
    
    res.json({
      success: true,
      message: `${docType} document information updated successfully.`,
      user: {
        documents: user.documents,
        driverVerification: user.driverVerification
      }
    });
    
  } catch (error) {
    console.error("Document update error:", error);
    res.status(500).json({ message: "Failed to update document information" });
  }
});

// POST /api/documents/:docType/replace  
// Replace an existing verified document with a new one
router.post("/:docType/replace", protect, upload.single("document"), async (req, res) => {
  try {
    const { docType } = req.params;
    const userId = req.user._id || 'unknown';
    
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    // Validate document type
    const validDocTypes = ["license", "rc", "insurance"];
    if (!validDocTypes.includes(docType)) {
      return res.status(400).json({ 
        message: "Invalid document type. Must be: license, rc, or insurance" 
      });
    }
    
    // Get user profile for enhanced verification
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const userDLNumber = user.driverVerification?.drivingLicenseId || req.body.dlNumber;
    const userVehicleNumber = user.driverVerification?.vehicleNumber || req.body.vehicleNumber;
    const userDateOfBirth = req.body.userDateOfBirth || user?.dateOfBirth || null;
    
    const userProfile = {
      name: user?.name,
      dateOfBirth: userDateOfBirth,
      dlNumber: userDLNumber,
      vehicleNumber: userVehicleNumber,
    };
    
    // Verify the new document
    const result = await verifyDocumentEnhanced(req.file.path, docType, userProfile, userId);
    
    // Update document verification status based on result
    if (result.overall === "verified" || result.overall === "review") {
      const updateFields = {
        [`documents.${docType === "license" ? "licenseVerified" : docType === "rc" ? "rcVerified" : "insuranceVerified"}`]: true,
        "driverVerification.lastVerificationScore": result.verificationScore,
        "driverVerification.lastVerificationDate": new Date(),
      };
      
      // Store extracted data
      if (result.extractedData?.dlNumber) {
        updateFields["driverVerification.drivingLicenseId"] = result.extractedData.dlNumber;
      }
      if (result.extractedData?.rcNumber) {
        updateFields["driverVerification.vehicleNumber"] = result.extractedData.rcNumber;
      }
      if (result.extractedData?.name) {
        updateFields["driverVerification.extractedName"] = result.extractedData.name;
      }
      if (result.extractedData?.dateOfBirth) {
        updateFields["driverVerification.extractedDOB"] = result.extractedData.dateOfBirth;
      }
      if (result.extractedData?.expiryDate) {
        updateFields["driverVerification.licenseExpiry"] = result.extractedData.expiryDate;
      }
      
      // Check if all mandatory documents are verified for overall verification
      const updatedUser = await User.findById(req.user._id);
      const allMandatoryVerified = (
        (docType === "license" || updatedUser?.documents?.licenseVerified) &&
        (docType === "rc" || updatedUser?.documents?.rcVerified)
      );
      
      if (allMandatoryVerified && result.overall === "verified") {
        updateFields["driverVerification.isVerified"] = true;
        updateFields["driverVerification.verifiedAt"] = new Date();
      }
      
      await User.findByIdAndUpdate(req.user._id, updateFields);
    }
    
    // Clean up uploaded file
    cleanupFile(req.file.path);
    
    res.json({
      success: true,
      message: `${docType} document replaced successfully.`,
      verification: result,
      documentUpdated: result.overall === "verified" || result.overall === "review"
    });
    
  } catch (error) {
    console.error("Document replacement error:", error);
    
    // Clean up uploaded file on error
    if (req.file?.path) {
      cleanupFile(req.file.path);
    }
    
    res.status(500).json({ message: "Failed to replace document" });
  }
});

// Add age validation endpoint for DOB input
router.post("/validate-age", async (req, res) => {
  try {
    const { dateOfBirth } = req.body;
    
    if (!dateOfBirth) {
      return res.status(400).json({ 
        valid: false, 
        message: "Date of birth is required" 
      });
    }
    
    const dobDate = new Date(dateOfBirth);
    if (isNaN(dobDate.getTime())) {
      return res.status(400).json({ 
        valid: false, 
        message: "Invalid date format" 
      });
    }
    
    const age = calculateAge(dobDate);
    const isValidAge = age >= 18;
    
    res.json({
      valid: isValidAge,
      age,
      message: isValidAge 
        ? "Age verified for driver license" 
        : "You must be at least 18 years old to register as a driver",
      minimumAge: 18
    });
    
  } catch (error) {
    console.error("Age validation error:", error);
    res.status(500).json({ 
      valid: false, 
      message: "Failed to validate age" 
    });
  }
});

module.exports = router;
