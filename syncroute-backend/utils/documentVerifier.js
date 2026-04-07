const Tesseract = require("tesseract.js");
const sharp = require("sharp");

// Debug logging utility for document verification
const verificationDebug = {
  log: (step, data, userId = 'unknown') => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [DOC-VERIFY] [User: ${userId}] [${step}]:`, JSON.stringify(data, null, 2));
  },
  
  logOCR: (ocrResult, userId = 'unknown') => {
    console.log(`[DOC-VERIFY] [User: ${userId}] OCR Extracted Text:`, ocrResult);
    console.log(`[DOC-VERIFY] [User: ${userId}] OCR Text Length:`, ocrResult ? ocrResult.length : 0);
  },
  
  logComparison: (userInput, ocrExtracted, similarity, match, fieldType, userId = 'unknown') => {
    console.log(`[DOC-VERIFY] [User: ${userId}] ${fieldType} Comparison:`, {
      userInput,
      ocrExtracted,
      similarity: `${similarity}%`,
      match,
      normalized: {
        user: userInput?.toUpperCase().replace(/[\s\-]/g, ""),
        ocr: ocrExtracted?.toUpperCase().replace(/[\s\-]/g, "")
      }
    });
  }
};
const path = require("path");
const fs = require("fs");

// Import new validation utilities
const {
  validateDrivingAge,
  validateDLFormat,
  validateVehicleNumber,
  validateLicenseExpiry,
  calculateVerificationScore,
  INDIAN_STATE_CODES,
  calculateAge,
} = require("./documentValidationUtils");

const {
  compareNames,
  extractNameFromOCR,
  extractDOBFromOCR,
} = require("./nameMatchUtils");

// ────────────────────────────────────────────────────────
// Indian State Codes Set (for backward compatibility)
// ────────────────────────────────────────────────────────
const INDIAN_STATE_CODES_SET = new Set(Object.keys(INDIAN_STATE_CODES));

// Max RTO codes per state (approximate upper bounds)
const STATE_RTO_MAX = {};
for (const [code, info] of Object.entries(INDIAN_STATE_CODES)) {
  STATE_RTO_MAX[code] = String(info.maxRTO).padStart(2, "0");
}

// ────────────────────────────────────────────────────────
// LAYER 1 — OCR + DL/RC Number Format Validation
// ────────────────────────────────────────────────────────

// Preprocess image for better OCR accuracy
async function preprocessImageForOCR(imagePath, outputPath) {
  try {
    await sharp(imagePath)
      .grayscale() // Convert to grayscale
      .normalize() // Enhance contrast automatically
      .sharpen() // Sharpen edges for better text detection
      .resize(null, 1200, { // Resize to optimal OCR height
        withoutEnlargement: true,
        fit: 'inside'
      })
      .jpeg({ quality: 95 }) // Save as high-quality JPEG
      .toFile(outputPath);
    
    return outputPath;
  } catch (error) {
    verificationDebug.log('OCR_PREPROCESSING_ERROR', { error: error.message, imagePath });
    // Return original path if preprocessing fails
    return imagePath;
  }
}

async function runOCR(imagePath, userId = 'unknown') {
  verificationDebug.log('OCR_START', { imagePath }, userId);
  
  // Create processed image path
  const processedImagePath = imagePath.replace(/\.(\w+)$/, '_processed.$1');
  
  try {
    // Preprocess image for better OCR
    const processedPath = await preprocessImageForOCR(imagePath, processedImagePath);
    
    // Run OCR with improved configuration
    const { data } = await Tesseract.recognize(processedPath, "eng+hin", {
      logger: (info) => {
        if (info.status === 'recognizing text') {
          verificationDebug.log('OCR_PROGRESS', { 
            progress: `${Math.round(info.progress * 100)}%` 
          }, userId);
        }
      },
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 /-:.',
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      preserve_interword_spaces: 1
    });
    
    const extractedText = data.text.trim();
    const confidence = data.confidence;
    
    verificationDebug.log('OCR_RESULT', { 
      confidence: `${Math.round(confidence)}%`,
      textLength: extractedText.length,
      hasMinimumText: extractedText.length >= 20
    }, userId);
    
    verificationDebug.logOCR(extractedText, userId);
    
    // Clean up processed image
    try {
      const fs = require('fs');
      if (processedPath !== imagePath && fs.existsSync(processedPath)) {
        fs.unlinkSync(processedPath);
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    // Retry with different settings if confidence is very low
    if (confidence < 50 && extractedText.length < 20) {
      verificationDebug.log('OCR_RETRY', { reason: 'Low confidence, retrying with different settings' }, userId);
      
      // Retry with single column mode
      const { data: retryData } = await Tesseract.recognize(imagePath, "eng", {
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_COLUMN,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 /-:.'
      });
      
      if (retryData.text.trim().length > extractedText.length) {
        verificationDebug.log('OCR_RETRY_SUCCESS', { 
          originalLength: extractedText.length, 
          retryLength: retryData.text.trim().length 
        }, userId);
        return retryData.text.trim();
      }
    }
    
    return extractedText;
  } catch (error) {
    verificationDebug.log('OCR_ERROR', { error: error.message }, userId);
    throw error;
  }
}

// Indian DL Number patterns (tolerant of OCR noise)
// Format: SS-RR-YYYYNNNNNNN  or  SS RR YYYY NNNNNNN  or  SSRR YYYYNNNNNNN
const DL_PATTERNS = [
  /([A-Z]{2})[- ]?(\d{2})[- ]?(\d{4})[- ]?(\d{7})/,
  /([A-Z]{2})[- ]?(\d{2})[- ]?(\d{4})[- ]?(\d{6,8})/,
  // Old format: SS-RRYYYY0NNNNNN
  /([A-Z]{2})[- ]?(\d{2})(\d{4})\d{7}/,
];

// Indian RC Number patterns
// Format: SS-RR-XX-NNNN  or  SS RR XX NNNN
const RC_PATTERNS = [
  /([A-Z]{2})[- ]?(\d{1,2})[- ]?([A-Z]{1,3})[- ]?(\d{1,4})/,
  /([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{1,4})/,
];

function extractDLNumber(text, userId = 'unknown') {
  verificationDebug.log('DL_EXTRACTION_START', { textLength: text.length }, userId);
  
  const cleaned = text.toUpperCase().replace(/[^A-Z0-9\s\-]/g, " ");
  verificationDebug.log('DL_CLEANED_TEXT', { cleanedText: cleaned.substring(0, 200) + '...' }, userId);
  
  for (let i = 0; i < DL_PATTERNS.length; i++) {
    const pattern = DL_PATTERNS[i];
    const match = cleaned.match(pattern);
    if (match) {
      const result = {
        raw: match[0],
        stateCode: match[1],
        rtoCode: match[2],
        year: match[3] ? parseInt(match[3]) : null,
        serial: match[4] || null,
        patternUsed: i
      };
      
      verificationDebug.log('DL_EXTRACTION_SUCCESS', { 
        result, 
        patternIndex: i,
        matchedText: match[0] 
      }, userId);
      
      return result;
    }
  }
  
  verificationDebug.log('DL_EXTRACTION_FAILED', { 
    message: 'No DL pattern matched',
    availablePatterns: DL_PATTERNS.length,
    textSample: cleaned.substring(0, 100)
  }, userId);
  
  return null;
}

function extractRCNumber(text) {
  const cleaned = text.toUpperCase().replace(/[^A-Z0-9\s\-]/g, " ");
  for (const pattern of RC_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      return {
        raw: match[0],
        stateCode: match[1],
        rtoCode: match[2],
        series: match[3] || null,
        number: match[4] || null,
      };
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────
// LAYER 2 — State + RTO Code Validation
// ────────────────────────────────────────────────────────
function validateStateRTO(stateCode, rtoCode) {
  const issues = [];

  if (!INDIAN_STATE_CODES_SET.has(stateCode)) {
    issues.push(`Invalid state code: ${stateCode}`);
  }

  const rtoNum = parseInt(rtoCode, 10);
  if (isNaN(rtoNum) || rtoNum < 1) {
    issues.push(`Invalid RTO code: ${rtoCode}`);
  }

  const maxRTO = STATE_RTO_MAX[stateCode];
  if (maxRTO && rtoNum > parseInt(maxRTO, 10)) {
    issues.push(`RTO code ${rtoCode} exceeds known max (${maxRTO}) for ${stateCode}`);
  }

  return {
    valid: issues.length === 0,
    stateCode,
    rtoCode: rtoCode,
    issues,
  };
}

// ────────────────────────────────────────────────────────
// LAYER 3 — Expiry & Date Validation
// ────────────────────────────────────────────────────────
function extractDates(ocrText) {
  const datePatterns = [
    // DD/MM/YYYY or DD-MM-YYYY
    /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/g,
    // YYYY/MM/DD or YYYY-MM-DD
    /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/g,
  ];

  const dates = [];
  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(ocrText)) !== null) {
      let year, month, day;
      if (match[1].length === 4) {
        year = parseInt(match[1]);
        month = parseInt(match[2]);
        day = parseInt(match[3]);
      } else {
        day = parseInt(match[1]);
        month = parseInt(match[2]);
        year = parseInt(match[3]);
      }

      if (year >= 1950 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        dates.push({ raw: match[0], date: new Date(year, month - 1, day), year, month, day });
      }
    }
  }

  return dates;
}

function validateDates(ocrText, docType) {
  const dates = extractDates(ocrText);
  const now = new Date();
  const issues = [];
  let expiryDate = null;
  let issueDate = null;

  if (dates.length === 0) {
    issues.push("No dates found in document — could not verify expiry");
    return { valid: issues.length === 0, dates, expiryDate, issueDate, issues };
  }

  // Sort dates — earliest is likely issue date, latest is expiry
  const sorted = [...dates].sort((a, b) => a.date - b.date);

  if (sorted.length >= 2) {
    issueDate = sorted[0];
    expiryDate = sorted[sorted.length - 1];
  } else if (sorted.length === 1) {
    // Single date — try to determine if it's issue or expiry
    const d = sorted[0];
    if (d.date > now) {
      expiryDate = d; // future date = expiry
    } else {
      issueDate = d; // past date = issue date
    }
  }

  // Check expiry
  if (expiryDate && expiryDate.date < now) {
    issues.push(`Document appears expired (expiry: ${expiryDate.raw})`);
  }

  // Sanity check issue date
  if (issueDate) {
    const yearDiff = now.getFullYear() - issueDate.date.getFullYear();
    if (docType === "license" && yearDiff > 30) {
      issues.push(`Issue date ${issueDate.raw} is suspiciously old (${yearDiff} years)`);
    }
    if (issueDate.date > now) {
      issues.push(`Issue date ${issueDate.raw} is in the future`);
    }
  }

  // For DL — check if year from DL number matches
  return {
    valid: issues.length === 0,
    dates: sorted.map(d => d.raw),
    expiryDate: expiryDate?.raw || null,
    issueDate: issueDate?.raw || null,
    issues,
  };
}

// ────────────────────────────────────────────────────────
// LAYER 4 — Basic Image Quality Check (Metadata checks REMOVED)
// ────────────────────────────────────────────────────────
// NOTE: Complex metadata/ELA/AI detection checks have been removed as they 
// were producing false positives and marking valid documents as fake.
// Verification now relies on OCR extraction and user input comparison.
async function analyzeImageIntegrity(imagePath) {
  const warnings = [];
  const metrics = {};

  try {
    const metadata = await sharp(imagePath).metadata();
    metrics.format = metadata.format;
    metrics.width = metadata.width;
    metrics.height = metadata.height;

    // Only check basic image quality requirements
    // Check 1: Resolution sanity — images should be at least 100x100 for readability
    if (metadata.width < 100 || metadata.height < 100) {
      warnings.push("Image resolution is low — OCR accuracy may be reduced");
    }

    // Check 2: Very extreme aspect ratios (likely not a document)
    const aspect = metadata.width / metadata.height;
    if (aspect > 10 || aspect < 0.1) {
      warnings.push("Unusual aspect ratio — may not be a standard document");
    }

    // Check 3: File size check (informational only)
    const fileStat = fs.statSync(imagePath);
    metrics.fileSize = fileStat.size;
    if (fileStat.size < 5000) { // < 5KB
      warnings.push("Very small file size — image quality may affect OCR");
    }

  } catch (err) {
    // Don't fail on analysis errors - just log warning
    warnings.push(`Image quality check skipped: ${err.message}`);
  }

  // ALWAYS return valid: true - image integrity no longer blocks verification
  // Verification success/failure is now determined by OCR extraction and input comparison
  return {
    valid: true,
    warnings,
    issues: [], // No blocking issues from image analysis
    metrics,
    flagForManualReview: false,
  };
}

// ────────────────────────────────────────────────────────
// INPUT FIELD VERIFICATION — Compare user input with OCR
// ────────────────────────────────────────────────────────
function verifyInputAgainstOCR(userInput, ocrExtracted, fieldType = "dlNumber", userId = 'unknown') {
  const result = {
    match: false,
    similarity: 0,
    issues: [],
    details: {},
  };
  
  verificationDebug.log('INPUT_VERIFICATION_START', { 
    fieldType, 
    hasUserInput: !!userInput,
    hasOcrExtracted: !!ocrExtracted 
  }, userId);
  
  if (!userInput || !ocrExtracted) {
    result.issues.push(`Could not compare ${fieldType}: missing data`);
    verificationDebug.log('INPUT_VERIFICATION_MISSING_DATA', result, userId);
    return result;
  }
  
  // Normalize both inputs
  const normalizedUser = userInput.toUpperCase().replace(/[\s\-]/g, "");
  const normalizedOCR = ocrExtracted.toUpperCase().replace(/[\s\-]/g, "");
  
  result.details.userInput = normalizedUser;
  result.details.ocrExtracted = normalizedOCR;
  
  // Exact match
  if (normalizedUser === normalizedOCR) {
    result.match = true;
    result.similarity = 100;
    verificationDebug.logComparison(userInput, ocrExtracted, 100, true, fieldType, userId);
    return result;
  }
  
  // Calculate similarity with OCR error tolerance
  const similarity = calculateSimilarityWithOCRErrorTolerance(normalizedUser, normalizedOCR, userId);
  result.similarity = Math.round(similarity);
  
  // FIXED: Lowered thresholds and improved OCR error tolerance
  if (result.similarity >= 85) {
    result.match = true;
    result.issues.push(`${fieldType} has minor OCR reading differences (${result.similarity}% match) - ACCEPTED`);
  } else if (result.similarity >= 60) { // LOWERED from 70% to 60%
    // Check for common OCR errors in this range
    if (hasCommonOCRErrors(normalizedUser, normalizedOCR)) {
      result.match = true;
      result.issues.push(`${fieldType} has OCR character substitution errors but matches (${result.similarity}% match) - ACCEPTED`);
    } else {
      result.match = false;
      result.issues.push(`${fieldType} partially matches but requires manual verification (${result.similarity}% match)`);
    }
  } else {
    result.match = false;
    result.issues.push(`Document number does not match uploaded document — user entered: ${userInput}, extracted: ${ocrExtracted} (${result.similarity}% match)`);
  }
  
  verificationDebug.logComparison(userInput, ocrExtracted, result.similarity, result.match, fieldType, userId);
  
  return result;
}

// Enhanced similarity calculation with OCR error tolerance
function calculateSimilarityWithOCRErrorTolerance(str1, str2, userId = 'unknown') {
  const maxLen = Math.max(str1.length, str2.length);
  const minLen = Math.min(str1.length, str2.length);
  
  if (maxLen === 0) return 100;
  
  let matches = 0;
  let ocrErrorMatches = 0;
  
  // Character-by-character comparison
  for (let i = 0; i < minLen; i++) {
    const c1 = str1[i];
    const c2 = str2[i];
    
    if (c1 === c2) {
      matches++;
    } else if (isCommonOCRError(c1, c2)) {
      ocrErrorMatches++;
      matches += 0.8; // Give partial credit for OCR errors
    }
  }
  
  // Penalize length differences less severely for OCR
  const lengthPenalty = Math.abs(str1.length - str2.length) * 0.5;
  const adjustedMatches = matches - lengthPenalty;
  
  const similarity = (adjustedMatches / maxLen) * 100;
  
  verificationDebug.log('SIMILARITY_CALCULATION', {
    exactMatches: matches - (ocrErrorMatches * 0.8),
    ocrErrorMatches,
    lengthPenalty,
    finalSimilarity: Math.round(similarity)
  }, userId);
  
  return Math.max(0, Math.min(100, similarity));
}

// Check for common OCR character substitution errors
function isCommonOCRError(char1, char2) {
  const ocrErrorPairs = {
    'O': ['0', 'Q', 'C'],
    '0': ['O', 'Q', 'D'],
    'I': ['1', 'l', 'L'],
    '1': ['I', 'l', 'L'],
    'S': ['5', '8'],
    '5': ['S', '8'],
    'B': ['6', '8'],
    '6': ['B', 'G'],
    'G': ['6', '9', 'C'],
    '9': ['G', 'g'],
    'Z': ['2', '7'],
    '2': ['Z', '7'],
    'l': ['I', '1', 'L'],
    'L': ['I', '1', 'l']
  };
  
  return ocrErrorPairs[char1]?.includes(char2) || ocrErrorPairs[char2]?.includes(char1);
}

// Check if strings have common OCR errors that suggest they should match
function hasCommonOCRErrors(str1, str2) {
  if (Math.abs(str1.length - str2.length) > 2) return false;
  
  let ocrErrors = 0;
  const minLen = Math.min(str1.length, str2.length);
  
  for (let i = 0; i < minLen; i++) {
    if (str1[i] !== str2[i] && isCommonOCRError(str1[i], str2[i])) {
      ocrErrors++;
    }
  }
  
  // If more than 80% of differences are common OCR errors, consider it a match
  const totalDifferences = Math.abs(str1.length - str2.length) + 
    Array.from({length: minLen}, (_, i) => str1[i] !== str2[i] ? 1 : 0).reduce((a, b) => a + b, 0);
  
  return totalDifferences > 0 && (ocrErrors / totalDifferences) >= 0.8;
}

// ────────────────────────────────────────────────────────
// DATA CONSISTENCY CHECK — DOB and Name verification
// ────────────────────────────────────────────────────────
function verifyDataConsistency(extractedData, userProfile) {
  const result = {
    consistent: true,
    checks: {
      dobMatch: null,
      nameMatch: null,
    },
    issues: [],
    warnings: [],
  };
  
  // DOB Consistency Check
  if (extractedData.dateOfBirth && userProfile.dateOfBirth) {
    const extractedDOB = new Date(extractedData.dateOfBirth);
    const profileDOB = new Date(userProfile.dateOfBirth);
    
    // Allow 1-day tolerance for timezone issues
    const daysDiff = Math.abs((extractedDOB - profileDOB) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 1) {
      result.checks.dobMatch = { match: true, message: "Date of birth matches profile" };
    } else if (daysDiff <= 365) {
      // Within a year — might be data entry error
      result.checks.dobMatch = { 
        match: false, 
        warning: true,
        message: `DOB mismatch: Document shows ${extractedData.dateOfBirth}, profile has ${userProfile.dateOfBirth}`,
      };
      result.warnings.push(result.checks.dobMatch.message);
    } else {
      result.checks.dobMatch = { 
        match: false, 
        message: `Significant DOB mismatch — possible document fraud`,
      };
      result.issues.push(result.checks.dobMatch.message);
      result.consistent = false;
    }
  } else if (userProfile.dateOfBirth && !extractedData.dateOfBirth) {
    result.checks.dobMatch = { 
      match: null, 
      message: "Could not extract DOB from document for verification",
    };
    result.warnings.push(result.checks.dobMatch.message);
  }
  
  // Name Consistency Check (using existing compareNames function)
  if (extractedData.name && userProfile.name) {
    const nameComparison = compareNames(extractedData.name, userProfile.name);
    
    if (nameComparison.fullMatch) {
      result.checks.nameMatch = { match: true, message: "Name matches profile", score: nameComparison.score };
    } else if (nameComparison.partialMatch) {
      result.checks.nameMatch = { 
        match: true, 
        warning: true,
        message: `Name partially matches (${Math.round(nameComparison.score * 100)}% similarity)`,
        score: nameComparison.score,
      };
      result.warnings.push(...nameComparison.issues);
    } else {
      result.checks.nameMatch = { 
        match: false, 
        message: "Name on document does not match profile name",
        score: nameComparison.score,
      };
      result.issues.push("Name mismatch between document and profile — possible document fraud");
      result.consistent = false;
    }
  }
  
  return result;
}

// ────────────────────────────────────────────────────────
// MAIN VERIFICATION PIPELINE
// ────────────────────────────────────────────────────────
async function verifyDocument(imagePath, docType = "license", userId = 'unknown') {
  const result = {
    overall: "pending",
    confidence: 0,
    layers: {
      ocr: { status: "pending", details: {} },
      formatValidation: { status: "pending", details: {} },
      dateValidation: { status: "pending", details: {} },
      imageIntegrity: { status: "pending", details: {} },
    },
    extractedData: {},
    issues: [],
  };

  let totalScore = 0;
  const maxScore = 3; // Reduced from 4 - image integrity no longer contributes to score

  try {
    // Layer 1: OCR
    const ocrText = await runOCR(imagePath);
    result.layers.ocr.details.textLength = ocrText.length;
    result.layers.ocr.details.extractedSample = ocrText.substring(0, 200);

    if (ocrText.length < 20) {
      result.layers.ocr.status = "fail";
      result.layers.ocr.details.reason = "Insufficient text extracted — image may not be a document";
      result.issues.push("OCR could not extract meaningful text");
    } else {
      result.layers.ocr.status = "pass";
      totalScore += 1;
    }

    // Layer 2: Format Validation — extract and validate document number
    let docNumber = null;
    if (docType === "license") {
      docNumber = extractDLNumber(ocrText, userId);
      if (docNumber) {
        result.extractedData.dlNumber = docNumber.raw;
        result.extractedData.stateCode = docNumber.stateCode;
        result.extractedData.rtoCode = docNumber.rtoCode;

        const rtoResult = validateStateRTO(docNumber.stateCode, docNumber.rtoCode);
        result.layers.formatValidation.details = rtoResult;

        if (rtoResult.valid) {
          result.layers.formatValidation.status = "pass";
          totalScore += 1;
        } else {
          result.layers.formatValidation.status = "fail";
          result.issues.push(...rtoResult.issues);
        }
      } else {
        result.layers.formatValidation.status = "warn";
        result.layers.formatValidation.details.reason = "Could not extract DL number from OCR text";
        result.issues.push("DL number not found in document");
        totalScore += 0.5; // partial credit — OCR might have missed it
      }
    } else if (docType === "rc") {
      docNumber = extractRCNumber(ocrText);
      if (docNumber) {
        result.extractedData.rcNumber = docNumber.raw;
        result.extractedData.stateCode = docNumber.stateCode;
        result.extractedData.rtoCode = docNumber.rtoCode;

        const rtoResult = validateStateRTO(docNumber.stateCode, docNumber.rtoCode);
        result.layers.formatValidation.details = rtoResult;

        if (rtoResult.valid) {
          result.layers.formatValidation.status = "pass";
          totalScore += 1;
        } else {
          result.layers.formatValidation.status = "fail";
          result.issues.push(...rtoResult.issues);
        }
      } else {
        result.layers.formatValidation.status = "warn";
        result.layers.formatValidation.details.reason = "Could not extract RC number from OCR text";
        result.issues.push("RC number not found in document");
        totalScore += 0.5;
      }
    } else if (docType === "insurance") {
      // Insurance doesn't have a standard number format — check for keywords
      const insuranceKeywords = ["insurance", "policy", "premium", "insured", "vehicle", "cover", "third party", "comprehensive"];
      const lowerText = ocrText.toLowerCase();
      const foundKeywords = insuranceKeywords.filter(kw => lowerText.includes(kw));
      result.layers.formatValidation.details.foundKeywords = foundKeywords;

      if (foundKeywords.length >= 2) {
        result.layers.formatValidation.status = "pass";
        totalScore += 1;
      } else if (foundKeywords.length === 1) {
        result.layers.formatValidation.status = "warn";
        result.issues.push("Only 1 insurance-related keyword found");
        totalScore += 0.5;
      } else {
        result.layers.formatValidation.status = "fail";
        result.issues.push("No insurance-related content found in document");
      }
    }

    // Layer 3: Date/Expiry Validation
    const dateResult = validateDates(ocrText, docType);
    result.layers.dateValidation.details = dateResult;
    result.extractedData.dates = dateResult.dates;
    result.extractedData.expiryDate = dateResult.expiryDate;
    result.extractedData.issueDate = dateResult.issueDate;

    if (dateResult.valid) {
      result.layers.dateValidation.status = "pass";
      totalScore += 1;
    } else if (dateResult.issues.length === 1 && dateResult.issues[0].includes("No dates found")) {
      result.layers.dateValidation.status = "warn";
      totalScore += 0.5;
    } else {
      result.layers.dateValidation.status = "fail";
      result.issues.push(...dateResult.issues);
    }

    // Layer 4: Image Quality Check (informational only - does not affect score)
    const integrityResult = await analyzeImageIntegrity(imagePath);
    result.layers.imageIntegrity.details = integrityResult;
    result.layers.imageIntegrity.status = integrityResult.warnings?.length > 0 ? "warn" : "pass";
    // Image quality warnings are informational only, not added to issues

    // Compute overall based on OCR, format, and date validation only
    result.confidence = Math.round((totalScore / maxScore) * 100);

    if (result.confidence >= 75) {
      result.overall = "verified";
    } else if (result.confidence >= 50) {
      result.overall = "review";
    } else {
      result.overall = "rejected";
    }

  } catch (err) {
    result.overall = "error";
    result.issues.push(`Verification pipeline error: ${err.message}`);
  }

  return result;
}

// ────────────────────────────────────────────────────────
// ENHANCED VERIFICATION WITH NAME MATCHING & SCORING
// ────────────────────────────────────────────────────────
async function verifyDocumentEnhanced(imagePath, docType = "license", userProfile = {}, userId = 'unknown') {
  const result = {
    overall: "pending",
    verificationScore: 0,
    confidence: 0,
    layers: {
      ocr: { status: "pending", details: {} },
      formatValidation: { status: "pending", details: {} },
      inputVerification: { status: "pending", details: {} },
      dateValidation: { status: "pending", details: {} },
      ageValidation: { status: "pending", details: {} },
      nameValidation: { status: "pending", details: {} },
      dataConsistency: { status: "pending", details: {} },
      imageIntegrity: { status: "pending", details: {} },
    },
    extractedData: {
      name: null,
      dateOfBirth: null,
      age: null,
      dlNumber: null,
      rcNumber: null,
      issueDate: null,
      expiryDate: null,
      stateCode: null,
      stateName: null,
    },
    scoring: {
      breakdown: {},
      issues: [],
    },
    issues: [],
  };

  const scoringInput = {
    ocrSuccess: false,
    licenseValid: false,
    licensePartialValid: false,
    ageValid: false,
    ageUnknown: false,
    vehicleValid: false,
    vehiclePartialValid: false,
    nameMatch: "unknown",
  };

  try {
    // Layer 1: OCR
    const ocrText = await runOCR(imagePath);
    result.layers.ocr.details.textLength = ocrText.length;
    result.layers.ocr.details.extractedSample = ocrText.substring(0, 300);

    if (ocrText.length < 20) {
      result.layers.ocr.status = "fail";
      result.layers.ocr.details.reason = "Insufficient text extracted — image may not be a document";
      result.issues.push("OCR could not extract meaningful text");
    } else {
      result.layers.ocr.status = "pass";
      scoringInput.ocrSuccess = true;
    }

    // Extract name from OCR
    const extractedNameResult = extractNameFromOCR(ocrText);
    if (extractedNameResult) {
      result.extractedData.name = extractedNameResult.name;
      result.layers.nameValidation.details.extractedName = extractedNameResult.name;
      result.layers.nameValidation.details.confidence = extractedNameResult.confidence;
    }

    // Extract DOB from OCR
    const extractedDOB = extractDOBFromOCR(ocrText);
    if (extractedDOB) {
      result.extractedData.dateOfBirth = extractedDOB.raw;
      result.extractedData.age = calculateAge(extractedDOB.date);
    }

    // Layer 2: Format Validation
    let docNumber = null;
    if (docType === "license") {
      docNumber = extractDLNumber(ocrText, userId);
      if (docNumber) {
        result.extractedData.dlNumber = docNumber.raw;
        result.extractedData.stateCode = docNumber.stateCode;

        // Use enhanced validation
        const dlValidation = validateDLFormat(docNumber.raw);
        result.layers.formatValidation.details = dlValidation;

        if (dlValidation.valid) {
          result.extractedData.stateName = dlValidation.stateName;
          result.layers.formatValidation.status = "pass";
          scoringInput.licenseValid = true;
        } else {
          result.layers.formatValidation.status = "fail";
          result.issues.push(dlValidation.message);
          scoringInput.licensePartialValid = true;
        }

        if (dlValidation.warning) {
          result.issues.push(dlValidation.warning);
        }
      } else {
        result.layers.formatValidation.status = "warn";
        result.layers.formatValidation.details.reason = "Could not extract DL number from OCR text";
        result.issues.push("DL number not found in document");
        scoringInput.licensePartialValid = true;
      }
    } else if (docType === "rc") {
      docNumber = extractRCNumber(ocrText);
      if (docNumber) {
        result.extractedData.rcNumber = docNumber.raw;
        result.extractedData.stateCode = docNumber.stateCode;

        // Use enhanced validation
        const rcValidation = validateVehicleNumber(docNumber.raw);
        result.layers.formatValidation.details = rcValidation;

        if (rcValidation.valid) {
          result.extractedData.stateName = rcValidation.stateName;
          result.layers.formatValidation.status = "pass";
          scoringInput.vehicleValid = true;
        } else {
          result.layers.formatValidation.status = "fail";
          result.issues.push(rcValidation.message);
          scoringInput.vehiclePartialValid = true;
        }
      } else {
        result.layers.formatValidation.status = "warn";
        result.layers.formatValidation.details.reason = "Could not extract RC number from OCR text";
        result.issues.push("RC number not found in document");
        scoringInput.vehiclePartialValid = true;
      }
    } else if (docType === "insurance") {
      // Insurance keyword check
      const insuranceKeywords = ["insurance", "policy", "premium", "insured", "vehicle", "cover", "third party", "comprehensive"];
      const lowerText = ocrText.toLowerCase();
      const foundKeywords = insuranceKeywords.filter(kw => lowerText.includes(kw));
      result.layers.formatValidation.details.foundKeywords = foundKeywords;

      if (foundKeywords.length >= 2) {
        result.layers.formatValidation.status = "pass";
        scoringInput.licenseValid = true; // Reusing for insurance
      } else if (foundKeywords.length === 1) {
        result.layers.formatValidation.status = "warn";
        result.issues.push("Only 1 insurance-related keyword found");
        scoringInput.licensePartialValid = true;
      } else {
        result.layers.formatValidation.status = "fail";
        result.issues.push("No insurance-related content found in document");
      }
    }

    // Layer 3: Date/Expiry Validation
    const dateResult = validateDates(ocrText, docType);
    result.layers.dateValidation.details = dateResult;
    result.extractedData.expiryDate = dateResult.expiryDate;
    result.extractedData.issueDate = dateResult.issueDate;

    if (dateResult.expiryDate) {
      const expiryValidation = validateLicenseExpiry(dateResult.expiryDate);
      result.layers.dateValidation.details.expiryValidation = expiryValidation;
      
      if (!expiryValidation.valid) {
        result.layers.dateValidation.status = "fail";
        result.issues.push(expiryValidation.message);
      } else {
        result.layers.dateValidation.status = expiryValidation.warning ? "warn" : "pass";
        if (expiryValidation.warning) {
          result.issues.push(expiryValidation.message);
        }
      }
    } else if (dateResult.valid) {
      result.layers.dateValidation.status = "pass";
    } else {
      result.layers.dateValidation.status = "warn";
    }

    // Layer 4: Age Validation (for DL)
    if (docType === "license") {
      if (result.extractedData.dateOfBirth) {
        const ageValidation = validateDrivingAge(extractedDOB?.date);
        result.layers.ageValidation.details = ageValidation;

        if (ageValidation.valid) {
          result.layers.ageValidation.status = "pass";
          scoringInput.ageValid = true;
        } else {
          result.layers.ageValidation.status = "fail";
          result.issues.push(ageValidation.message);
        }
      } else {
        result.layers.ageValidation.status = "warn";
        result.layers.ageValidation.details.reason = "Could not extract date of birth to verify age";
        scoringInput.ageUnknown = true;
      }
    } else {
      result.layers.ageValidation.status = "skip";
      result.layers.ageValidation.details.reason = "Age validation not applicable for this document type";
      scoringInput.ageValid = true; // Don't penalize
    }

    // Layer 5: Name Matching (if user profile provided)
    if (userProfile.name && result.extractedData.name) {
      const nameComparison = compareNames(result.extractedData.name, userProfile.name);
      result.layers.nameValidation.details.comparison = nameComparison;
      result.layers.nameValidation.details.profileName = userProfile.name;

      if (nameComparison.fullMatch) {
        result.layers.nameValidation.status = "pass";
        scoringInput.nameMatch = "full";
      } else if (nameComparison.partialMatch) {
        result.layers.nameValidation.status = "warn";
        scoringInput.nameMatch = "partial";
        result.issues.push(...nameComparison.issues);
      } else {
        result.layers.nameValidation.status = "fail";
        scoringInput.nameMatch = "none";
        result.issues.push("Name on document does not match profile name");
      }
    } else if (userProfile.name) {
      result.layers.nameValidation.status = "warn";
      result.layers.nameValidation.details.reason = "Could not extract name from document";
      scoringInput.nameMatch = "unknown";
    } else {
      result.layers.nameValidation.status = "skip";
      result.layers.nameValidation.details.reason = "No user profile provided for name matching";
      scoringInput.nameMatch = "full"; // Don't penalize
    }

    // Layer 6: Input Field Verification (compare user-entered number with OCR)
    if (userProfile.dlNumber && result.extractedData.dlNumber) {
      const inputVerification = verifyInputAgainstOCR(userProfile.dlNumber, result.extractedData.dlNumber, "Driving License Number", userId);
      result.layers.inputVerification.details = inputVerification;
      
      if (inputVerification.match) {
        result.layers.inputVerification.status = inputVerification.similarity >= 95 ? "pass" : "warn";
      } else {
        result.layers.inputVerification.status = "fail";
        result.issues.push(...inputVerification.issues);
      }
    } else if (userProfile.vehicleNumber && result.extractedData.rcNumber) {
      const inputVerification = verifyInputAgainstOCR(userProfile.vehicleNumber, result.extractedData.rcNumber, "Vehicle Registration Number", userId);
      result.layers.inputVerification.details = inputVerification;
      
      if (inputVerification.match) {
        result.layers.inputVerification.status = inputVerification.similarity >= 95 ? "pass" : "warn";
      } else {
        result.layers.inputVerification.status = "fail";
        result.issues.push(...inputVerification.issues);
      }
    } else {
      result.layers.inputVerification.status = "skip";
      result.layers.inputVerification.details.reason = "No user-entered document number provided for comparison";
    }

    // Layer 7: Data Consistency Check (DOB and name consistency)
    if (userProfile.dateOfBirth || userProfile.name) {
      const consistencyCheck = verifyDataConsistency(result.extractedData, userProfile);
      result.layers.dataConsistency.details = consistencyCheck;
      
      if (consistencyCheck.consistent && consistencyCheck.warnings.length === 0) {
        result.layers.dataConsistency.status = "pass";
      } else if (consistencyCheck.consistent && consistencyCheck.warnings.length > 0) {
        result.layers.dataConsistency.status = "warn";
        result.issues.push(...consistencyCheck.warnings);
      } else {
        result.layers.dataConsistency.status = "fail";
        result.issues.push(...consistencyCheck.issues);
      }
    } else {
      result.layers.dataConsistency.status = "skip";
      result.layers.dataConsistency.details.reason = "No profile data provided for consistency check";
    }

    // Layer 8: Image Quality Check (simplified - no longer blocks verification)
    const integrityResult = await analyzeImageIntegrity(imagePath);
    result.layers.imageIntegrity.details = integrityResult;

    // Image integrity now always passes - just record warnings for information
    result.layers.imageIntegrity.status = integrityResult.warnings?.length > 0 ? "warn" : "pass";
    // Don't add warnings to issues - they're informational only

    // Calculate verification score
    const scoring = calculateVerificationScore(scoringInput);
    result.verificationScore = scoring.score;
    result.scoring = scoring;
    result.confidence = scoring.score;

    // Determine overall status - based on OCR, format validation, and input matching
    // Image integrity no longer affects the result
    if (scoring.status === "verified") {
      result.overall = "verified";
    } else if (scoring.status === "review") {
      result.overall = "review";
    } else {
      result.overall = "rejected";
    }

    // Add scoring issues to main issues
    result.issues.push(...scoring.issues);

  } catch (err) {
    result.overall = "error";
    result.issues.push(`Verification pipeline error: ${err.message}`);
  }

  return result;
}

// ────────────────────────────────────────────────────────
// VEHICLE PHOTO VALIDATION
// ────────────────────────────────────────────────────────
async function verifyVehiclePhoto(imagePath) {
  const result = {
    valid: false,
    confidence: 0,
    issues: [],
    details: {},
  };

  try {
    const integrityResult = await analyzeImageIntegrity(imagePath);
    result.details.imageIntegrity = integrityResult;

    if (!integrityResult.valid) {
      result.issues.push(...integrityResult.issues);
      return result;
    }

    // Check for vehicle-like characteristics
    const metadata = await sharp(imagePath).metadata();
    result.details.metadata = {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    };

    // Vehicle photos are typically landscape oriented
    const aspect = metadata.width / metadata.height;
    if (aspect < 0.8) {
      result.issues.push("Image appears to be portrait — vehicle photos are typically landscape");
    }

    // Check image size (vehicle photos should be reasonably detailed)
    if (metadata.width < 400 || metadata.height < 300) {
      result.issues.push("Image resolution is too low for vehicle verification");
    }

    // Run OCR to check for number plate text
    const ocrText = await runOCR(imagePath);
    const rcNumber = extractRCNumber(ocrText);
    
    if (rcNumber) {
      result.details.detectedVehicleNumber = rcNumber.raw;
      result.confidence += 30;
    }

    // Basic validation passed
    if (result.issues.length === 0) {
      result.valid = true;
      result.confidence = Math.min(100, result.confidence + 70);
    }

  } catch (err) {
    result.issues.push(`Vehicle photo analysis error: ${err.message}`);
  }

  return result;
}

module.exports = { 
  verifyDocument, 
  verifyDocumentEnhanced,
  verifyVehiclePhoto,
  runOCR,
  extractDLNumber,
  extractRCNumber,
  validateStateRTO,
  extractDates,
  analyzeImageIntegrity,
  verifyInputAgainstOCR,
  verifyDataConsistency,
};
