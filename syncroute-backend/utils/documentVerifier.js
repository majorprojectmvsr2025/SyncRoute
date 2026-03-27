const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// ────────────────────────────────────────────────────────
// Indian State Codes (valid on DL and RC)
// ────────────────────────────────────────────────────────
const INDIAN_STATE_CODES = new Set([
  "AN","AP","AR","AS","BR","CG","CH","DD","DL","GA","GJ","HP","HR",
  "JH","JK","KA","KL","LA","LD","MH","ML","MN","MP","MZ","NL","OD",
  "PB","PY","RJ","SK","TN","TR","TS","UK","UP","WB",
]);

// Max RTO codes per state (approximate upper bounds)
const STATE_RTO_MAX = {
  AN:"02",AP:"39",AR:"22",AS:"35",BR:"63",CG:"30",CH:"04",DD:"03",
  DL:"16",GA:"12",GJ:"39",HP:"99",HR:"99",JH:"24",JK:"22",KA:"73",
  KL:"98",LA:"02",LD:"01",MH:"53",ML:"10",MN:"08",MP:"72",MZ:"09",
  NL:"10",OD:"35",PB:"99",PY:"05",RJ:"53",SK:"07",TN:"99",TR:"08",
  TS:"38",UK:"20",UP:"85",WB:"94",
};

// ────────────────────────────────────────────────────────
// LAYER 1 — OCR + DL/RC Number Format Validation
// ────────────────────────────────────────────────────────
async function runOCR(imagePath) {
  const { data } = await Tesseract.recognize(imagePath, "eng", {
    logger: () => {},
  });
  return data.text;
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

function extractDLNumber(text) {
  const cleaned = text.toUpperCase().replace(/[^A-Z0-9\s\-]/g, " ");
  for (const pattern of DL_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      return {
        raw: match[0],
        stateCode: match[1],
        rtoCode: match[2],
        year: match[3] ? parseInt(match[3]) : null,
        serial: match[4] || null,
      };
    }
  }
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

  if (!INDIAN_STATE_CODES.has(stateCode)) {
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
// LAYER 4 — Image Tampering + AI Detection
// ────────────────────────────────────────────────────────
async function analyzeImageIntegrity(imagePath) {
  const issues = [];
  const metrics = {};

  try {
    const metadata = await sharp(imagePath).metadata();
    metrics.format = metadata.format;
    metrics.width = metadata.width;
    metrics.height = metadata.height;
    metrics.hasAlpha = metadata.hasAlpha;

    // Check 1: Resolution sanity — real scans/photos are typically > 200x200
    if (metadata.width < 200 || metadata.height < 200) {
      issues.push("Image resolution too low for a document scan");
    }

    // Check 2: Unusual aspect ratios
    const aspect = metadata.width / metadata.height;
    if (aspect > 5 || aspect < 0.2) {
      issues.push("Unusual aspect ratio — doesn't match typical document dimensions");
    }

    // Check 3: Alpha channel on document (real scans don't have transparency)
    if (metadata.hasAlpha && metadata.format === "png") {
      issues.push("Document image has transparency – possible digital creation");
    }

    // Check 4: ELA (Error Level Analysis) — detect edited regions
    // Re-compress at quality 95 and compare to original
    const originalBuf = await sharp(imagePath).jpeg({ quality: 100 }).toBuffer();
    const recompressedBuf = await sharp(imagePath).jpeg({ quality: 75 }).toBuffer();

    const originalStats = await sharp(originalBuf).stats();
    const recompressedStats = await sharp(recompressedBuf).stats();

    // Compare channel means — large delta = heavy editing
    const channelDeltas = originalStats.channels.map((ch, i) => {
      return Math.abs(ch.mean - recompressedStats.channels[i].mean);
    });
    const avgDelta = channelDeltas.reduce((s, v) => s + v, 0) / channelDeltas.length;
    metrics.elaDelta = avgDelta.toFixed(2);

    if (avgDelta > 25) {
      issues.push("ELA analysis suggests possible image manipulation (high compression variance)");
    }

    // Check 5: Statistical uniformity (AI-generated images tend to have low variance patches)
    const stats = await sharp(imagePath).stats();
    const avgStdDev = stats.channels.reduce((s, ch) => s + ch.stdev, 0) / stats.channels.length;
    metrics.avgStdDev = avgStdDev.toFixed(2);

    // Very low standard deviation = flat/synthetic image
    if (avgStdDev < 15) {
      issues.push("Image has unusually low variance — may be digitally generated");
    }

    // Very high standard deviation with low entropy could also be suspicious
    // But typically real documents have moderate variance

    // Check 6: File size analysis — real photos of documents > 50KB typically
    const fileStat = fs.statSync(imagePath);
    metrics.fileSize = fileStat.size;
    if (fileStat.size < 20000) { // < 20KB
      issues.push("File size is suspiciously small for a document image");
    }

    // Check 7: Check for pure white/black regions (possible text overlay on blank)
    const extremeWhite = stats.channels.filter(ch => ch.mean > 250);
    if (extremeWhite.length >= 3) {
      issues.push("Image is almost entirely white — may not be a real document");
    }

  } catch (err) {
    issues.push(`Image analysis error: ${err.message}`);
  }

  return {
    valid: issues.length === 0,
    issues,
    metrics,
  };
}

// ────────────────────────────────────────────────────────
// MAIN VERIFICATION PIPELINE
// ────────────────────────────────────────────────────────
async function verifyDocument(imagePath, docType = "license") {
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
  const maxScore = 4;

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
      docNumber = extractDLNumber(ocrText);
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

    // Layer 4: Image Integrity + AI Detection
    const integrityResult = await analyzeImageIntegrity(imagePath);
    result.layers.imageIntegrity.details = integrityResult;

    if (integrityResult.valid) {
      result.layers.imageIntegrity.status = "pass";
      totalScore += 1;
    } else {
      result.layers.imageIntegrity.status = "fail";
      result.issues.push(...integrityResult.issues);
    }

    // Compute overall
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

module.exports = { verifyDocument };
