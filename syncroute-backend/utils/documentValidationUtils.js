/**
 * Document Validation Utilities
 * Enhanced validation for driver documents with scoring system
 */

// ────────────────────────────────────────────────────────
// Age Validation
// ────────────────────────────────────────────────────────
const MINIMUM_DRIVING_AGE = 18;

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  
  const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return age;
}

function validateDrivingAge(dateOfBirth) {
  const age = calculateAge(dateOfBirth);
  
  return {
    valid: age !== null && age >= MINIMUM_DRIVING_AGE,
    age,
    minimumAge: MINIMUM_DRIVING_AGE,
    message: age === null 
      ? "Could not determine age from document"
      : age < MINIMUM_DRIVING_AGE 
        ? `Driver does not meet legal driving age requirement (${age} years < ${MINIMUM_DRIVING_AGE} years)`
        : "Age verified",
  };
}

// ────────────────────────────────────────────────────────
// Indian State Codes
// ────────────────────────────────────────────────────────
const INDIAN_STATE_CODES = {
  "AN": { name: "Andaman and Nicobar Islands", maxRTO: 2 },
  "AP": { name: "Andhra Pradesh", maxRTO: 39 },
  "AR": { name: "Arunachal Pradesh", maxRTO: 22 },
  "AS": { name: "Assam", maxRTO: 35 },
  "BR": { name: "Bihar", maxRTO: 63 },
  "CG": { name: "Chhattisgarh", maxRTO: 30 },
  "CH": { name: "Chandigarh", maxRTO: 4 },
  "DD": { name: "Dadra and Nagar Haveli and Daman and Diu", maxRTO: 3 },
  "DL": { name: "Delhi", maxRTO: 16 },
  "GA": { name: "Goa", maxRTO: 12 },
  "GJ": { name: "Gujarat", maxRTO: 39 },
  "HP": { name: "Himachal Pradesh", maxRTO: 99 },
  "HR": { name: "Haryana", maxRTO: 99 },
  "JH": { name: "Jharkhand", maxRTO: 24 },
  "JK": { name: "Jammu and Kashmir", maxRTO: 22 },
  "KA": { name: "Karnataka", maxRTO: 73 },
  "KL": { name: "Kerala", maxRTO: 98 },
  "LA": { name: "Ladakh", maxRTO: 2 },
  "LD": { name: "Lakshadweep", maxRTO: 1 },
  "MH": { name: "Maharashtra", maxRTO: 53 },
  "ML": { name: "Meghalaya", maxRTO: 10 },
  "MN": { name: "Manipur", maxRTO: 8 },
  "MP": { name: "Madhya Pradesh", maxRTO: 72 },
  "MZ": { name: "Mizoram", maxRTO: 9 },
  "NL": { name: "Nagaland", maxRTO: 10 },
  "OD": { name: "Odisha", maxRTO: 35 },
  "PB": { name: "Punjab", maxRTO: 99 },
  "PY": { name: "Puducherry", maxRTO: 5 },
  "RJ": { name: "Rajasthan", maxRTO: 53 },
  "SK": { name: "Sikkim", maxRTO: 7 },
  "TN": { name: "Tamil Nadu", maxRTO: 99 },
  "TR": { name: "Tripura", maxRTO: 8 },
  "TS": { name: "Telangana", maxRTO: 38 },
  "UK": { name: "Uttarakhand", maxRTO: 20 },
  "UP": { name: "Uttar Pradesh", maxRTO: 85 },
  "WB": { name: "West Bengal", maxRTO: 94 },
};

function validateStateCode(stateCode) {
  const code = stateCode?.toUpperCase();
  const state = INDIAN_STATE_CODES[code];
  
  return {
    valid: !!state,
    stateCode: code,
    stateName: state?.name || null,
    maxRTO: state?.maxRTO || null,
    message: state ? `Valid state: ${state.name}` : `Invalid state code: ${stateCode}`,
  };
}

function validateRTOCode(stateCode, rtoCode) {
  const stateValidation = validateStateCode(stateCode);
  if (!stateValidation.valid) {
    return { valid: false, ...stateValidation };
  }
  
  const rtoNum = parseInt(rtoCode, 10);
  const maxRTO = stateValidation.maxRTO;
  
  if (isNaN(rtoNum) || rtoNum < 1) {
    return {
      valid: false,
      stateCode,
      rtoCode,
      message: `Invalid RTO code: ${rtoCode}`,
    };
  }
  
  // Make RTO validation more flexible for new RTOs
  if (rtoNum > maxRTO) {
    // Don't reject outright - could be a newly added RTO
    return {
      valid: true, // CHANGED: Allow validation to pass
      stateCode,
      rtoCode,
      message: `RTO code ${rtoCode} exceeds known maximum (${maxRTO}) for ${stateValidation.stateName} - may be a new RTO`,
      warning: true, // Flag for manual review
      isNewRTO: true, // Additional flag to track potential new RTOs
    };
  }
  
  return {
    valid: true,
    stateCode,
    rtoCode,
    stateName: stateValidation.stateName,
    message: "Valid state and RTO code",
  };
}

// ────────────────────────────────────────────────────────
// Driving License Format Validation
// ────────────────────────────────────────────────────────
const DL_PATTERNS = [
  // Standard format: SS-RR-YYYYNNNNNNN (2 digit RTO)
  /^([A-Z]{2})[- ]?(\d{2})[- ]?(\d{4})[- ]?(\d{7})$/i,
  // Alternate: SS-RR-YYYY-NNNNNN (2 digit RTO, 6-8 digit serial)
  /^([A-Z]{2})[- ]?(\d{2})[- ]?(\d{4})[- ]?(\d{6,8})$/i,
  // Old format: SSRRYYYY0NNNNNN
  /^([A-Z]{2})(\d{2})(\d{4})(\d{7})$/i,
  // 3-digit RTO format: SS-RRR-YYYYNNNNNN (newer RTOs like TS107)
  /^([A-Z]{2})[- ]?(\d{3})[- ]?(\d{4})[- ]?(\d{6,7})$/i,
  // Continuous format without separators (any length serial 5-9 digits)
  /^([A-Z]{2})(\d{2,3})(\d{4})(\d{5,9})$/i,
  // Very flexible: Just needs state code + at least 10 more digits
  /^([A-Z]{2})(\d{10,15})$/i,
];

function validateDLFormat(dlNumber) {
  if (!dlNumber) {
    return {
      valid: false,
      dlNumber: null,
      message: "No driving license number provided",
    };
  }
  
  const cleaned = dlNumber.toUpperCase().replace(/[\s\-]/g, "");
  
  // Try each pattern
  for (const pattern of DL_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      const stateCode = match[1];
      let rtoCode, year, serial;
      
      // Handle different match group configurations
      if (match.length === 3) {
        // Very flexible pattern (SS + digits) - extract parts manually
        const digits = match[2];
        rtoCode = digits.substring(0, 2);
        year = parseInt(digits.substring(2, 6), 10);
        serial = digits.substring(6);
      } else {
        rtoCode = match[2];
        year = parseInt(match[3], 10);
        serial = match[4];
      }
      
      // Validate state
      const stateValidation = validateStateCode(stateCode);
      if (!stateValidation.valid) {
        // Still accept if it looks like a valid format, just warn
        return {
          valid: true,
          partialValid: true,
          dlNumber: cleaned,
          stateCode,
          rtoCode,
          year,
          serial,
          message: `Unrecognized state code ${stateCode}, but format appears valid`,
          warning: true,
        };
      }
      
      // Validate RTO (flexible - don't fail on new RTOs)
      const rtoValidation = validateRTOCode(stateCode, rtoCode);
      
      // Validate year (should be between 1980 and current year)
      const currentYear = new Date().getFullYear();
      if (year && (year < 1980 || year > currentYear + 1)) {
        // Don't fail - just mark as warning
        return {
          valid: true,
          partialValid: true,
          dlNumber: cleaned,
          stateCode,
          rtoCode,
          year,
          serial,
          stateName: stateValidation.stateName,
          message: `Year ${year} seems unusual but format accepted`,
          warning: true,
        };
      }
      
      return {
        valid: true,
        dlNumber: cleaned,
        stateCode,
        rtoCode,
        stateName: stateValidation.stateName,
        year,
        serial,
        message: "Valid driving license format",
        warning: rtoValidation.warning ? rtoValidation.message : null,
      };
    }
  }
  
  // Last resort - if it starts with 2 letters and has enough digits, accept with warning
  const fallbackMatch = cleaned.match(/^([A-Z]{2})(\d{8,})$/i);
  if (fallbackMatch) {
    return {
      valid: true,
      partialValid: true,
      dlNumber: cleaned,
      stateCode: fallbackMatch[1],
      message: "License format accepted (non-standard format)",
      warning: true,
    };
  }
  
  return {
    valid: false,
    dlNumber: cleaned,
    message: "Driving license number format not recognized",
  };
}

// ────────────────────────────────────────────────────────
// Vehicle Registration Number Validation
// ────────────────────────────────────────────────────────
const RC_PATTERNS = [
  // Standard: SS-RR-XX-NNNN or SS RR XX NNNN
  /^([A-Z]{2})[- ]?(\d{1,2})[- ]?([A-Z]{1,3})[- ]?(\d{1,4})$/i,
  // Without series: SS-RR-NNNN
  /^([A-Z]{2})[- ]?(\d{1,2})[- ]?(\d{1,4})$/i,
];

function validateVehicleNumber(vehicleNumber) {
  if (!vehicleNumber) {
    return {
      valid: false,
      vehicleNumber: null,
      message: "No vehicle number provided",
    };
  }
  
  const cleaned = vehicleNumber.toUpperCase().replace(/\s+/g, "");
  
  for (const pattern of RC_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      const stateCode = match[1];
      const rtoCode = match[2];
      const series = match.length === 5 ? match[3] : null;
      const number = match.length === 5 ? match[4] : match[3];
      
      // Validate state
      const stateValidation = validateStateCode(stateCode);
      if (!stateValidation.valid) {
        return {
          valid: false,
          vehicleNumber: cleaned,
          stateCode,
          rtoCode,
          series,
          number,
          message: stateValidation.message,
        };
      }
      
      // Validate RTO
      const rtoValidation = validateRTOCode(stateCode, rtoCode);
      
      return {
        valid: true,
        vehicleNumber: cleaned,
        stateCode,
        rtoCode,
        stateName: stateValidation.stateName,
        series,
        number,
        message: "Valid vehicle registration number format",
        warning: rtoValidation.warning ? rtoValidation.message : null,
      };
    }
  }
  
  return {
    valid: false,
    vehicleNumber: cleaned,
    message: "Vehicle number does not match valid Indian RC format (SS-RR-XX-NNNN)",
  };
}

// ────────────────────────────────────────────────────────
// License Expiry Validation
// ────────────────────────────────────────────────────────
function validateLicenseExpiry(expiryDate) {
  if (!expiryDate) {
    return {
      valid: false,
      expired: null,
      daysRemaining: null,
      message: "Could not determine license expiry date",
    };
  }
  
  const expiry = expiryDate instanceof Date ? expiryDate : new Date(expiryDate);
  if (isNaN(expiry.getTime())) {
    return {
      valid: false,
      expired: null,
      daysRemaining: null,
      message: "Invalid expiry date format",
    };
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const daysRemaining = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
  const expired = daysRemaining < 0;
  
  let message;
  if (expired) {
    message = `License expired ${Math.abs(daysRemaining)} days ago`;
  } else if (daysRemaining <= 30) {
    message = `License expiring soon (${daysRemaining} days remaining)`;
  } else {
    message = `License valid for ${daysRemaining} days`;
  }
  
  return {
    valid: !expired,
    expired,
    expiryDate: expiry.toISOString().split("T")[0],
    daysRemaining,
    message,
    warning: daysRemaining <= 30 && daysRemaining >= 0,
  };
}

// ────────────────────────────────────────────────────────
// Verification Scoring System
// ────────────────────────────────────────────────────────
const SCORING_WEIGHTS = {
  documentReadable: 20,        // OCR successfully extracted text
  validLicenseFormat: 20,      // DL number format is valid
  ageValid: 20,                // Driver is 18+
  vehicleNumberValid: 20,      // RC format is valid
  nameMatch: 20,               // Name matches profile
};

const PASSING_SCORE = 60;

function calculateVerificationScore(results) {
  let totalScore = 0;
  const breakdown = {};
  const issues = [];
  
  // Document Readable (OCR)
  if (results.ocrSuccess) {
    totalScore += SCORING_WEIGHTS.documentReadable;
    breakdown.documentReadable = SCORING_WEIGHTS.documentReadable;
  } else {
    breakdown.documentReadable = 0;
    issues.push("Document could not be read properly");
  }
  
  // License Format Valid
  if (results.licenseValid) {
    totalScore += SCORING_WEIGHTS.validLicenseFormat;
    breakdown.validLicenseFormat = SCORING_WEIGHTS.validLicenseFormat;
  } else if (results.licensePartialValid) {
    totalScore += SCORING_WEIGHTS.validLicenseFormat / 2;
    breakdown.validLicenseFormat = SCORING_WEIGHTS.validLicenseFormat / 2;
    issues.push("License format could not be fully verified");
  } else {
    breakdown.validLicenseFormat = 0;
    issues.push("License format invalid or not found");
  }
  
  // Age Valid
  if (results.ageValid) {
    totalScore += SCORING_WEIGHTS.ageValid;
    breakdown.ageValid = SCORING_WEIGHTS.ageValid;
  } else if (results.ageUnknown) {
    totalScore += SCORING_WEIGHTS.ageValid / 2;
    breakdown.ageValid = SCORING_WEIGHTS.ageValid / 2;
    issues.push("Age could not be verified from document");
  } else {
    breakdown.ageValid = 0;
    issues.push("Driver does not meet minimum age requirement");
  }
  
  // Vehicle Number Valid
  if (results.vehicleValid) {
    totalScore += SCORING_WEIGHTS.vehicleNumberValid;
    breakdown.vehicleNumberValid = SCORING_WEIGHTS.vehicleNumberValid;
  } else if (results.vehiclePartialValid) {
    totalScore += SCORING_WEIGHTS.vehicleNumberValid / 2;
    breakdown.vehicleNumberValid = SCORING_WEIGHTS.vehicleNumberValid / 2;
    issues.push("Vehicle number could not be fully verified");
  } else {
    breakdown.vehicleNumberValid = 0;
    issues.push("Vehicle number invalid or not found");
  }
  
  // Name Match
  if (results.nameMatch === "full") {
    totalScore += SCORING_WEIGHTS.nameMatch;
    breakdown.nameMatch = SCORING_WEIGHTS.nameMatch;
  } else if (results.nameMatch === "partial") {
    totalScore += SCORING_WEIGHTS.nameMatch * 0.7;
    breakdown.nameMatch = SCORING_WEIGHTS.nameMatch * 0.7;
    issues.push("Name partially matches — may require manual review");
  } else if (results.nameMatch === "none") {
    breakdown.nameMatch = 0;
    issues.push("Name on document does not match profile");
  } else {
    // Could not extract name
    totalScore += SCORING_WEIGHTS.nameMatch / 2;
    breakdown.nameMatch = SCORING_WEIGHTS.nameMatch / 2;
    issues.push("Could not extract name from document for verification");
  }
  
  const passed = totalScore >= PASSING_SCORE;
  
  let status;
  if (totalScore >= 80) {
    status = "verified";
  } else if (totalScore >= 60) {
    status = "review";
  } else {
    status = "rejected";
  }
  
  return {
    score: Math.round(totalScore),
    maxScore: 100,
    passingScore: PASSING_SCORE,
    passed,
    status,
    breakdown,
    issues,
  };
}

module.exports = {
  MINIMUM_DRIVING_AGE,
  INDIAN_STATE_CODES,
  SCORING_WEIGHTS,
  PASSING_SCORE,
  calculateAge,
  validateDrivingAge,
  validateStateCode,
  validateRTOCode,
  validateDLFormat,
  validateVehicleNumber,
  validateLicenseExpiry,
  calculateVerificationScore,
};
