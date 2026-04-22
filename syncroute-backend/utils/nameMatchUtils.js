/**
 * Name Matching Utility for Document Verification
 * Uses fuzzy matching to compare extracted names with user profile names
 */

// Levenshtein distance for fuzzy string matching
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

// Calculate similarity ratio (0 to 1)
function similarityRatio(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  return 1 - (distance / maxLen);
}

// Normalize name: remove titles, extra spaces, special chars
function normalizeName(name) {
  if (!name) return "";
  
  // Common Indian name prefixes/titles to remove
  const titles = [
    "shri", "smt", "mr", "mrs", "ms", "dr", "prof",
    "sri", "kumari", "late", "sh", "sm"
  ];
  
  let normalized = name.toLowerCase()
    .replace(/[^a-z\s]/g, " ")  // Remove non-alphabetic chars
    .replace(/\s+/g, " ")       // Normalize whitespace
    .trim();
  
  // Remove titles
  const words = normalized.split(" ");
  const filtered = words.filter(w => !titles.includes(w));
  
  return filtered.join(" ");
}

// Extract name parts for comparison
function extractNameParts(name) {
  const normalized = normalizeName(name);
  const parts = normalized.split(" ").filter(Boolean);
  
  return {
    full: normalized,
    parts,
    first: parts[0] || "",
    last: parts[parts.length - 1] || "",
    middle: parts.length > 2 ? parts.slice(1, -1) : [],
  };
}

// Compare two names with fuzzy matching
function compareNames(name1, name2) {
  const n1 = extractNameParts(name1);
  const n2 = extractNameParts(name2);
  
  const result = {
    fullMatch: false,
    partialMatch: false,
    score: 0,
    confidence: "low",
    details: {
      fullNameSimilarity: 0,
      firstNameSimilarity: 0,
      lastNameSimilarity: 0,
      partsMatched: 0,
      totalParts: 0,
    },
    issues: [],
  };
  
  // Full name similarity
  result.details.fullNameSimilarity = similarityRatio(n1.full, n2.full);
  
  // First name similarity
  result.details.firstNameSimilarity = similarityRatio(n1.first, n2.first);
  
  // Last name similarity
  result.details.lastNameSimilarity = similarityRatio(n1.last, n2.last);
  
  // Count matching parts
  const allParts1 = new Set(n1.parts);
  const allParts2 = new Set(n2.parts);
  let matchedParts = 0;
  
  for (const part of allParts1) {
    for (const otherPart of allParts2) {
      if (similarityRatio(part, otherPart) >= 0.8) {
        matchedParts++;
        break;
      }
    }
  }
  
  result.details.partsMatched = matchedParts;
  result.details.totalParts = Math.max(n1.parts.length, n2.parts.length);
  
  // Calculate overall score (weighted)
  const fullWeight = 0.4;
  const firstWeight = 0.3;
  const lastWeight = 0.3;
  
  result.score = (
    result.details.fullNameSimilarity * fullWeight +
    result.details.firstNameSimilarity * firstWeight +
    result.details.lastNameSimilarity * lastWeight
  );
  
  // Determine match level - more lenient thresholds
  if (result.score >= 0.85) {
    result.fullMatch = true;
    result.confidence = "high";
  } else if (result.score >= 0.6) {
    result.partialMatch = true;
    result.fullMatch = true; // Accept as valid match
    result.confidence = "medium";
  } else if (result.score >= 0.45) {
    result.partialMatch = true;
    result.confidence = "low";
    result.issues.push("Name partially matches — manual verification may be required");
  } else {
    result.confidence = "very_low";
    result.issues.push("Name mismatch — may require manual review");
  }
  
  // Check for common OCR errors - more comprehensive
  if (result.score < 0.85 && result.score >= 0.4) {
    // Check if it could be OCR error (common confusions: 0/O, 1/I, 5/S, etc.)
    const ocrConfusions = [
      ["o", "0"], ["i", "1"], ["l", "1"], ["s", "5"],
      ["b", "6"], ["g", "9"], ["z", "2"], ["a", "4"],
      ["e", "3"], ["t", "7"], ["q", "9"], ["d", "0"],
      ["rn", "m"], ["vv", "w"], ["cl", "d"], ["ii", "u"]
    ];
    
    let adjusted1 = n1.full;
    let adjusted2 = n2.full;
    for (const [a, b] of ocrConfusions) {
      adjusted1 = adjusted1.replace(new RegExp(a, "g"), b);
      adjusted2 = adjusted2.replace(new RegExp(a, "g"), b);
    }
    
    const adjustedSimilarity = Math.max(
      similarityRatio(adjusted1, n2.full),
      similarityRatio(n1.full, adjusted2),
      similarityRatio(adjusted1, adjusted2)
    );
    
    if (adjustedSimilarity > result.score + 0.1) {
      result.issues.push("Name may have OCR reading errors");
      result.score = Math.max(result.score, adjustedSimilarity * 0.95);
      // If OCR-adjusted score is good, mark as partial match
      if (adjustedSimilarity >= 0.7) {
        result.partialMatch = true;
        result.fullMatch = true;
        result.confidence = "medium";
      }
    }
  }
  
  return result;
}

// Extract name from OCR text (attempts to find name field)
function extractNameFromOCR(ocrText) {
  const lines = ocrText.split("\n").map(l => l.trim()).filter(Boolean);
  const candidates = [];
  
  // Common OCR artifacts that should be removed from names
  const ocrArtifacts = /\b(wrap|warp|trap|strap|crop|prop|doc|document|license|licence|dl|driving|photo|image|scan|scanned|copy|original|govt|government|india|issued|valid|holder|class|mcwg|lmv|trans|non)\b/gi;
  
  // Common patterns for name fields on Indian documents
  const namePatterns = [
    /name\s*[:\-]?\s*([A-Z][A-Za-z\s]+)/i,
    /s\/o\s*[:\-]?\s*([A-Z][A-Za-z\s]+)/i,
    /d\/o\s*[:\-]?\s*([A-Z][A-Za-z\s]+)/i,
    /w\/o\s*[:\-]?\s*([A-Z][A-Za-z\s]+)/i,
    /holder\s*[:\-]?\s*([A-Z][A-Za-z\s]+)/i,
    /owner\s*[:\-]?\s*([A-Z][A-Za-z\s]+)/i,
  ];
  
  // Try each pattern
  for (const pattern of namePatterns) {
    const match = ocrText.match(pattern);
    if (match && match[1]) {
      let extracted = match[1].trim();
      // Remove OCR artifacts
      extracted = extracted.replace(ocrArtifacts, '').trim();
      // Remove trailing non-letters
      extracted = extracted.replace(/[^a-zA-Z\s]+$/g, '').trim();
      // Normalize spaces
      extracted = extracted.replace(/\s+/g, ' ').trim();
      
      // Filter out obvious non-names
      if (extracted.length >= 3 && extracted.length <= 50 && /[A-Za-z]{3,}/.test(extracted)) {
        candidates.push({
          name: extracted,
          confidence: 0.8,
          source: "pattern",
        });
      }
    }
  }
  
  // Also look for lines that look like names (UPPERCASE words)
  for (const line of lines) {
    // Line with 2-4 capitalized words is likely a name
    if (/^[A-Z][A-Za-z]+(\s+[A-Z][A-Za-z]+){1,3}$/.test(line)) {
      let cleaned = line.replace(ocrArtifacts, '').trim();
      cleaned = cleaned.replace(/[^a-zA-Z\s]+$/g, '').trim();
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      
      if (cleaned.length >= 5) {
        candidates.push({
          name: cleaned,
          confidence: 0.6,
          source: "uppercase_line",
        });
      }
    }
  }
  
  // Sort by confidence and return best match
  candidates.sort((a, b) => b.confidence - a.confidence);
  
  return candidates.length > 0 ? candidates[0] : null;
}

// Extract DOB from OCR text
function extractDOBFromOCR(ocrText) {
  const currentYear = new Date().getFullYear();
  const minBirthYear = 1940;
  const maxBirthYear = currentYear - 18; // Must be at least 18 to drive
  
  // Date patterns commonly found on Indian DL/RC
  // Try DOB-specific patterns first (explicit DOB labels)
  const dobPatterns = [
    // DOB: DD/MM/YYYY or DOB: DD-MM-YYYY
    /(?:dob|d\.o\.b|date\s*of\s*birth|birth\s*date|born)\s*[:\-]?\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i,
    // DOB with flexible spacing
    /(?:dob|birth)\s*[\s:\-]?\s*(\d{1,2})[\s\/\-]+(\d{1,2})[\s\/\-]+(\d{4})/i,
  ];
  
  for (const pattern of dobPatterns) {
    const dobMatch = ocrText.match(pattern);
    if (dobMatch) {
      const day = parseInt(dobMatch[1]);
      const month = parseInt(dobMatch[2]);
      const year = parseInt(dobMatch[3]);
      
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= minBirthYear && year <= maxBirthYear) {
        return {
          raw: `${day}/${month}/${year}`,
          date: new Date(year, month - 1, day),
          confidence: 0.95,
          source: 'dob_label',
        };
      }
    }
  }
  
  // Fall back to finding all dates and picking the best DOB candidate
  // Exclude dates that are clearly issue/expiry dates
  const allDates = [];
  const pattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g;
  let match;
  
  while ((match = pattern.exec(ocrText)) !== null) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);
    
    // Check if this date appears after issue/expiry/valid keywords (skip if so)
    const contextBefore = ocrText.substring(Math.max(0, match.index - 30), match.index).toLowerCase();
    const isIssueDateContext = /(?:issue|issued|doi|valid\s*from|effective)/i.test(contextBefore);
    const isExpiryDateContext = /(?:expir|valid\s*till|valid\s*upto|doe|valid\s*to)/i.test(contextBefore);
    
    // DOB should be between minBirthYear and maxBirthYear
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= minBirthYear && year <= maxBirthYear) {
      // Skip if it's clearly an issue or expiry date
      if (isIssueDateContext || isExpiryDateContext) continue;
      
      allDates.push({
        raw: `${day}/${month}/${year}`,
        date: new Date(year, month - 1, day),
        confidence: 0.7,
        source: 'date_search',
      });
    }
  }
  
  // Return earliest date (most likely DOB) - a person's DOB is typically the earliest date on DL
  allDates.sort((a, b) => a.date - b.date);
  return allDates.length > 0 ? allDates[0] : null;
}

module.exports = {
  levenshteinDistance,
  similarityRatio,
  normalizeName,
  extractNameParts,
  compareNames,
  extractNameFromOCR,
  extractDOBFromOCR,
};
