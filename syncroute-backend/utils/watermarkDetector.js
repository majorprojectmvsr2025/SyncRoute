/**
 * Watermark and Fake Document Detection
 * Detects common watermarks, sample stamps, and fake documents
 */

const sharp = require('sharp');
const Tesseract = require('tesseract.js');

// Common watermark texts found on fake/sample documents
const WATERMARK_PATTERNS = [
  // Sample/Specimen markers
  /sample/i,
  /specimen/i,
  /demo/i,
  /test/i,
  /example/i,
  /template/i,
  /draft/i,
  /preview/i,
  /watermark/i,
  
  // Website watermarks
  /shutterstock/i,
  /gettyimages/i,
  /istockphoto/i,
  /dreamstime/i,
  /123rf/i,
  /depositphotos/i,
  /freepik/i,
  /pngtree/i,
  /vecteezy/i,
  /canva/i,
  
  // Document generator sites
  /fakedocument/i,
  /fake.*license/i,
  /fake.*dl/i,
  /generator/i,
  /maker/i,
  /creator/i,
  
  // Common fake document markers
  /not.*valid/i,
  /for.*display.*only/i,
  /educational.*purpose/i,
  /illustration.*only/i,
  /do.*not.*use/i,
  /unauthorized/i,
  
  // Diagonal watermark patterns
  /\b[A-Z]{2,}\s+[A-Z]{2,}\s+[A-Z]{2,}\b/, // Repeated caps (SAMPLE SAMPLE SAMPLE)
];

// Suspicious text patterns that indicate fake documents
const SUSPICIOUS_PATTERNS = [
  /lorem\s+ipsum/i,
  /placeholder/i,
  /your\s+name\s+here/i,
  /enter\s+name/i,
  /\[.*\]/,  // [Name], [Date], etc.
  /\{.*\}/,  // {Name}, {Date}, etc.
  /xxx+/i,   // XXXXX placeholder
  /000+/,    // 00000 placeholder
];

/**
 * Detect watermarks in document image
 */
async function detectWatermark(imagePath) {
  const result = {
    hasWatermark: false,
    confidence: 0,
    detectedPatterns: [],
    warnings: [],
    isFake: false
  };

  try {
    // Step 1: Analyze image for watermark characteristics
    const imageAnalysis = await analyzeImageForWatermarks(imagePath);
    
    // Step 2: Run OCR to detect watermark text
    const ocrResult = await detectWatermarkText(imagePath);
    
    // Combine results
    result.detectedPatterns = [
      ...imageAnalysis.patterns,
      ...ocrResult.patterns
    ];
    
    result.hasWatermark = imageAnalysis.hasWatermark || ocrResult.hasWatermark;
    result.confidence = Math.max(imageAnalysis.confidence, ocrResult.confidence);
    result.warnings = [...imageAnalysis.warnings, ...ocrResult.warnings];
    
    // Determine if document is fake
    result.isFake = result.confidence >= 70 || 
                    result.detectedPatterns.some(p => p.type === 'fake_marker');
    
    return result;
  } catch (error) {
    console.error('[WATERMARK] Detection error:', error.message);
    return result;
  }
}

/**
 * Analyze image characteristics for watermarks
 */
async function analyzeImageForWatermarks(imagePath) {
  const result = {
    hasWatermark: false,
    confidence: 0,
    patterns: [],
    warnings: []
  };

  try {
    const metadata = await sharp(imagePath).metadata();
    const { data, info } = await sharp(imagePath)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Check 1: Detect diagonal patterns (common in watermarks)
    const hasDiagonalPattern = detectDiagonalPattern(data, info.width, info.height);
    if (hasDiagonalPattern) {
      result.patterns.push({
        type: 'diagonal_pattern',
        description: 'Diagonal watermark pattern detected',
        confidence: 60
      });
      result.confidence = Math.max(result.confidence, 60);
    }

    // Check 2: Detect repeated patterns (tiled watermarks)
    const hasRepeatedPattern = detectRepeatedPattern(data, info.width, info.height);
    if (hasRepeatedPattern) {
      result.patterns.push({
        type: 'repeated_pattern',
        description: 'Repeated watermark pattern detected',
        confidence: 70
      });
      result.confidence = Math.max(result.confidence, 70);
    }

    // Check 3: Detect semi-transparent overlays
    const hasTransparentOverlay = detectTransparentOverlay(data, info.width, info.height);
    if (hasTransparentOverlay) {
      result.patterns.push({
        type: 'transparent_overlay',
        description: 'Semi-transparent overlay detected (possible watermark)',
        confidence: 50
      });
      result.confidence = Math.max(result.confidence, 50);
    }

    result.hasWatermark = result.patterns.length > 0;

  } catch (error) {
    console.error('[WATERMARK] Image analysis error:', error.message);
  }

  return result;
}

/**
 * Detect watermark text using OCR
 */
async function detectWatermarkText(imagePath) {
  const result = {
    hasWatermark: false,
    confidence: 0,
    patterns: [],
    warnings: []
  };

  try {
    // Run OCR with settings optimized for watermark detection
    const { data } = await Tesseract.recognize(imagePath, 'eng', {
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .-_'
    });

    const extractedText = data.text.toLowerCase();

    // Check for watermark patterns
    for (const pattern of WATERMARK_PATTERNS) {
      const match = extractedText.match(pattern);
      if (match) {
        const matchedText = match[0];
        const isFakeMarker = /fake|sample|specimen|not.*valid|generator/i.test(matchedText);
        
        result.patterns.push({
          type: isFakeMarker ? 'fake_marker' : 'watermark',
          text: matchedText,
          description: `Watermark text detected: "${matchedText}"`,
          confidence: isFakeMarker ? 95 : 80
        });
        
        result.confidence = Math.max(result.confidence, isFakeMarker ? 95 : 80);
        result.hasWatermark = true;

        if (isFakeMarker) {
          result.warnings.push(`FAKE DOCUMENT DETECTED: Contains "${matchedText}"`);
        }
      }
    }

    // Check for suspicious patterns
    for (const pattern of SUSPICIOUS_PATTERNS) {
      const match = extractedText.match(pattern);
      if (match) {
        result.patterns.push({
          type: 'suspicious',
          text: match[0],
          description: `Suspicious placeholder text: "${match[0]}"`,
          confidence: 70
        });
        result.confidence = Math.max(result.confidence, 70);
        result.warnings.push(`Suspicious text pattern: "${match[0]}"`);
      }
    }

    // Check for repeated text (common in watermarks)
    const repeatedText = detectRepeatedText(extractedText);
    if (repeatedText) {
      result.patterns.push({
        type: 'repeated_text',
        text: repeatedText,
        description: `Repeated text detected: "${repeatedText}"`,
        confidence: 65
      });
      result.confidence = Math.max(result.confidence, 65);
      result.hasWatermark = true;
    }

  } catch (error) {
    console.error('[WATERMARK] OCR detection error:', error.message);
  }

  return result;
}

/**
 * Detect diagonal patterns in image (common watermark orientation)
 */
function detectDiagonalPattern(data, width, height) {
  // Sample diagonal lines and check for consistent patterns
  const sampleSize = Math.min(width, height, 500);
  const step = Math.floor(Math.max(width, height) / sampleSize);
  
  let diagonalVariance = 0;
  let samples = 0;

  for (let i = 0; i < sampleSize; i += step) {
    const x = Math.floor((i / sampleSize) * width);
    const y = Math.floor((i / sampleSize) * height);
    
    if (x < width && y < height) {
      const idx = (y * width + x);
      if (idx < data.length) {
        const pixel = data[idx];
        diagonalVariance += Math.abs(pixel - 128); // Check deviation from mid-gray
        samples++;
      }
    }
  }

  const avgVariance = samples > 0 ? diagonalVariance / samples : 0;
  
  // High variance on diagonal suggests watermark
  return avgVariance > 30 && avgVariance < 100;
}

/**
 * Detect repeated patterns (tiled watermarks)
 */
function detectRepeatedPattern(data, width, height) {
  // Check for repeating blocks
  const blockSize = 100;
  const blocks = [];
  
  for (let y = 0; y < height - blockSize; y += blockSize) {
    for (let x = 0; x < width - blockSize; x += blockSize) {
      const blockHash = hashBlock(data, x, y, blockSize, width);
      blocks.push(blockHash);
    }
  }

  // Count repeated hashes
  const hashCounts = {};
  for (const hash of blocks) {
    hashCounts[hash] = (hashCounts[hash] || 0) + 1;
  }

  // If more than 30% of blocks are identical, likely watermark
  const maxCount = Math.max(...Object.values(hashCounts));
  return maxCount > blocks.length * 0.3;
}

/**
 * Simple block hashing for pattern detection
 */
function hashBlock(data, x, y, size, width) {
  let hash = 0;
  const step = Math.floor(size / 10); // Sample 10x10 grid within block
  
  for (let dy = 0; dy < size; dy += step) {
    for (let dx = 0; dx < size; dx += step) {
      const idx = ((y + dy) * width + (x + dx));
      if (idx < data.length) {
        hash = ((hash << 5) - hash) + data[idx];
        hash = hash & hash; // Convert to 32-bit integer
      }
    }
  }
  
  return hash;
}

/**
 * Detect semi-transparent overlays
 */
function detectTransparentOverlay(data, width, height) {
  // Check for consistent mid-range values (semi-transparent overlay)
  const sampleSize = Math.min(data.length, 10000);
  const step = Math.floor(data.length / sampleSize);
  
  let midRangeCount = 0;
  
  for (let i = 0; i < data.length; i += step) {
    const pixel = data[i];
    // Semi-transparent overlays often create mid-range gray values
    if (pixel > 80 && pixel < 180) {
      midRangeCount++;
    }
  }

  const midRangeRatio = midRangeCount / (data.length / step);
  
  // If more than 60% of pixels are mid-range, possible overlay
  return midRangeRatio > 0.6;
}

/**
 * Detect repeated text in OCR output
 */
function detectRepeatedText(text) {
  const words = text.split(/\s+/).filter(w => w.length > 3);
  const wordCounts = {};
  
  for (const word of words) {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  }

  // Find words repeated more than 3 times
  for (const [word, count] of Object.entries(wordCounts)) {
    if (count >= 3 && word.length > 4) {
      return word;
    }
  }

  return null;
}

/**
 * Check if document is from a known fake document generator
 */
function checkFakeDocumentSources(ocrText) {
  const fakeSourcePatterns = [
    /fakedocument\.net/i,
    /fake.*id.*generator/i,
    /dl.*generator/i,
    /license.*maker/i,
    /id.*creator/i,
    /document.*generator/i,
  ];

  for (const pattern of fakeSourcePatterns) {
    if (pattern.test(ocrText)) {
      return {
        isFake: true,
        source: ocrText.match(pattern)[0],
        confidence: 100
      };
    }
  }

  return { isFake: false, confidence: 0 };
}

module.exports = {
  detectWatermark,
  detectWatermarkText,
  analyzeImageForWatermarks,
  checkFakeDocumentSources,
  WATERMARK_PATTERNS,
  SUSPICIOUS_PATTERNS
};
