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
  
  // Determine match level
  if (result.score >= 0.9) {
    result.fullMatch = true;
    result.confidence = "high";
  } else if (result.score >= 0.7) {
    result.partialMatch = true;
    result.confidence = "medium";
  } else if (result.score >= 0.5) {
    result.partialMatch = true;
    result.confidence = "low";
    result.issues.push("Name partially matches — manual verification may be required");
  } else {
    result.confidence = "very_low";
    result.issues.push("Name does not match profile — possible document fraud");
  }
  
  // Check for common OCR errors
  if (result.score < 0.9 && result.score >= 0.6) {
    // Check if it could be OCR error (common confusions: 0/O, 1/I, 5/S)
    const ocrConfusions = [
      ["o", "0"], ["i", "1"], ["l", "1"], ["s", "5"],
      ["b", "6"], ["g", "9"], ["z", "2"]
    ];
    
    let adjusted = n1.full;
    for (const [a, b] of ocrConfusions) {
      adjusted = adjusted.replace(new RegExp(a, "g"), b);
    }
    
    const adjustedSimilarity = similarityRatio(adjusted, n2.full);
    if (adjustedSimilarity > result.score + 0.1) {
      result.issues.push("Name may have OCR reading errors");
    }
  }
  
  return result;
}

// Extract name from OCR text (attempts to find name field)
function extractNameFromOCR(ocrText) {
  const lines = ocrText.split("\n").map(l => l.trim()).filter(Boolean);
  const candidates = [];
  
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
      const extracted = match[1].trim();
      // Filter out obvious non-names
      if (extracted.length >= 3 && extracted.length <= 50) {
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
      candidates.push({
        name: line,
        confidence: 0.6,
        source: "uppercase_line",
      });
    }
  }
  
  // Sort by confidence and return best match
  candidates.sort((a, b) => b.confidence - a.confidence);
  
  return candidates.length > 0 ? candidates[0] : null;
}

// Extract DOB from OCR text
function extractDOBFromOCR(ocrText) {
  // Date patterns commonly found on Indian DL/RC
  const datePatterns = [
    // DD/MM/YYYY or DD-MM-YYYY
    /(?:dob|d\.o\.b|date\s*of\s*birth|birth)\s*[:\-]?\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i,
    // Just date pattern
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g,
  ];
  
  // Try DOB-specific patterns first
  const dobMatch = ocrText.match(datePatterns[0]);
  if (dobMatch) {
    const day = parseInt(dobMatch[1]);
    const month = parseInt(dobMatch[2]);
    const year = parseInt(dobMatch[3]);
    
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1940 && year <= 2010) {
      return {
        raw: `${day}/${month}/${year}`,
        date: new Date(year, month - 1, day),
        confidence: 0.9,
      };
    }
  }
  
  // Fall back to finding all dates and picking earliest reasonable one
  const allDates = [];
  let match;
  const pattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g;
  
  while ((match = pattern.exec(ocrText)) !== null) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);
    
    // DOB should be between 1940-2010 for a driver
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1940 && year <= 2010) {
      allDates.push({
        raw: `${day}/${month}/${year}`,
        date: new Date(year, month - 1, day),
        confidence: 0.7,
      });
    }
  }
  
  // Return earliest date (most likely DOB)
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
