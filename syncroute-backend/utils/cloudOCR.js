/**
 * Cloud OCR Integration Module
 * Supports: Google Cloud Vision API, AWS Textract
 * Falls back to local Tesseract.js if cloud OCR is not configured
 * 
 * This module enhances OCR accuracy while maintaining backward compatibility
 * with the existing Tesseract.js implementation.
 */

const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// OCR provider configuration
const OCR_PROVIDER = process.env.CLOUD_OCR_PROVIDER || 'tesseract'; // 'google', 'aws', or 'tesseract'

// Dynamic imports with graceful fallback
let ImageAnnotatorClient = null;
let TextractClient = null;
let DetectDocumentTextCommand = null;

// Initialize Google Cloud Vision client
let visionClient = null;
try {
  const visionModule = require('@google-cloud/vision');
  ImageAnnotatorClient = visionModule.ImageAnnotatorClient;
  
  if (process.env.GOOGLE_CLOUD_VISION_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    visionClient = new ImageAnnotatorClient();
    console.log('[CloudOCR] Google Cloud Vision initialized');
  }
} catch (err) {
  console.log('[CloudOCR] Google Cloud Vision package not installed - using Tesseract');
}

// Initialize AWS Textract client
let textractClient = null;
try {
  const textractModule = require('@aws-sdk/client-textract');
  TextractClient = textractModule.TextractClient;
  DetectDocumentTextCommand = textractModule.DetectDocumentTextCommand;
  
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    textractClient = new TextractClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    console.log('[CloudOCR] AWS Textract initialized');
  }
} catch (err) {
  console.log('[CloudOCR] AWS Textract package not installed - using Tesseract');
}

/**
 * Download image from URL to buffer
 */
async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Perform OCR using Google Cloud Vision
 */
async function googleVisionOCR(imageSource) {
  if (!visionClient) {
    throw new Error('Google Cloud Vision not configured');
  }

  let request;
  
  if (imageSource.startsWith('http')) {
    // URL-based image
    request = {
      image: { source: { imageUri: imageSource } },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
    };
  } else {
    // Local file
    const imageBuffer = fs.readFileSync(imageSource);
    request = {
      image: { content: imageBuffer.toString('base64') },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
    };
  }

  const [result] = await visionClient.annotateImage(request);
  const fullText = result.fullTextAnnotation?.text || '';
  
  // Extract confidence scores
  const pages = result.fullTextAnnotation?.pages || [];
  let totalConfidence = 0;
  let wordCount = 0;
  
  pages.forEach(page => {
    page.blocks?.forEach(block => {
      block.paragraphs?.forEach(para => {
        para.words?.forEach(word => {
          if (word.confidence) {
            totalConfidence += word.confidence;
            wordCount++;
          }
        });
      });
    });
  });

  const avgConfidence = wordCount > 0 ? (totalConfidence / wordCount) * 100 : 80;

  console.log(`[CloudOCR] Google Vision extracted ${fullText.length} chars with ${avgConfidence.toFixed(1)}% confidence`);
  
  return {
    text: fullText,
    confidence: avgConfidence,
    provider: 'google',
    wordCount
  };
}

/**
 * Perform OCR using AWS Textract
 */
async function awsTextractOCR(imageSource) {
  if (!textractClient) {
    throw new Error('AWS Textract not configured');
  }

  let imageBytes;
  
  if (imageSource.startsWith('http')) {
    imageBytes = await downloadImage(imageSource);
  } else {
    imageBytes = fs.readFileSync(imageSource);
  }

  const command = new DetectDocumentTextCommand({
    Document: {
      Bytes: imageBytes
    }
  });

  const response = await textractClient.send(command);
  
  // Combine all detected text blocks
  let fullText = '';
  let totalConfidence = 0;
  let blockCount = 0;

  response.Blocks?.forEach(block => {
    if (block.BlockType === 'LINE' || block.BlockType === 'WORD') {
      fullText += (block.Text || '') + ' ';
      if (block.Confidence) {
        totalConfidence += block.Confidence;
        blockCount++;
      }
    }
  });

  const avgConfidence = blockCount > 0 ? totalConfidence / blockCount : 80;

  console.log(`[CloudOCR] AWS Textract extracted ${fullText.length} chars with ${avgConfidence.toFixed(1)}% confidence`);

  return {
    text: fullText.trim(),
    confidence: avgConfidence,
    provider: 'aws',
    blockCount
  };
}

/**
 * Perform OCR using local Tesseract.js (fallback)
 */
async function tesseractOCR(imageSource) {
  // Determine trained data path
  const trainedDataDir = path.join(__dirname, '..');
  
  const result = await Tesseract.recognize(imageSource, 'eng+hin', {
    langPath: trainedDataDir,
    logger: () => {} // Suppress logs
  });

  console.log(`[CloudOCR] Tesseract extracted ${result.data.text.length} chars with ${result.data.confidence}% confidence`);

  return {
    text: result.data.text,
    confidence: result.data.confidence,
    provider: 'tesseract',
    words: result.data.words?.length || 0
  };
}

/**
 * Main OCR function - automatically selects best available provider
 * @param {string} imageSource - File path or URL
 * @param {Object} options - OCR options
 * @returns {Promise<Object>} OCR result with text, confidence, and provider info
 */
async function performOCR(imageSource, options = {}) {
  const { preferredProvider = OCR_PROVIDER, fallbackEnabled = true } = options;
  
  const providers = [];
  
  // Build provider priority list
  if (preferredProvider === 'google' && visionClient) {
    providers.push({ name: 'google', fn: googleVisionOCR });
  }
  if (preferredProvider === 'aws' && textractClient) {
    providers.push({ name: 'aws', fn: awsTextractOCR });
  }
  
  // Add fallbacks
  if (fallbackEnabled) {
    if (visionClient && preferredProvider !== 'google') {
      providers.push({ name: 'google', fn: googleVisionOCR });
    }
    if (textractClient && preferredProvider !== 'aws') {
      providers.push({ name: 'aws', fn: awsTextractOCR });
    }
    // Always have Tesseract as final fallback
    providers.push({ name: 'tesseract', fn: tesseractOCR });
  } else {
    providers.push({ name: 'tesseract', fn: tesseractOCR });
  }

  // Try providers in order
  for (const provider of providers) {
    try {
      console.log(`[CloudOCR] Attempting OCR with ${provider.name}...`);
      const result = await provider.fn(imageSource);
      
      // Validate result
      if (result.text && result.text.length > 10) {
        return {
          ...result,
          success: true,
          source: imageSource
        };
      }
      
      console.log(`[CloudOCR] ${provider.name} returned insufficient text, trying next...`);
    } catch (error) {
      console.error(`[CloudOCR] ${provider.name} failed:`, error.message);
      if (!fallbackEnabled) throw error;
    }
  }

  // Return empty result if all providers fail
  return {
    text: '',
    confidence: 0,
    provider: 'none',
    success: false,
    error: 'All OCR providers failed'
  };
}

/**
 * Extract specific fields from OCR text (Indian documents)
 * @param {string} text - OCR extracted text
 * @param {string} docType - Document type: 'license' or 'rc'
 */
function extractDocumentFields(text, docType) {
  const fields = {};
  
  if (docType === 'license') {
    // Extract DL Number (various Indian formats)
    const dlPatterns = [
      /[A-Z]{2}[-\s]?\d{2}[-\s]?\d{4}[-\s]?\d{7}/gi,  // Standard format
      /[A-Z]{2}\d{13}/gi,                               // No separators
      /DL[-\s]*NO[:\s]*([A-Z0-9\-\s]+)/gi,             // Labeled
      /D\.?\s*L\.?\s*[Nn][Oo]\.?[:\s]*([A-Z0-9\-\s]+)/gi
    ];
    
    for (const pattern of dlPatterns) {
      const match = text.match(pattern);
      if (match) {
        fields.licenseNumber = match[0].replace(/[^A-Z0-9]/gi, '');
        break;
      }
    }
    
    // Extract DOB
    const dobPatterns = [
      /DOB[:\s]*(\d{2}[-/]\d{2}[-/]\d{4})/i,
      /Date\s*of\s*Birth[:\s]*(\d{2}[-/]\d{2}[-/]\d{4})/i,
      /Birth[:\s]*(\d{2}[-/]\d{2}[-/]\d{4})/i,
      /(\d{2}[-/]\d{2}[-/]\d{4})/g
    ];
    
    for (const pattern of dobPatterns) {
      const match = text.match(pattern);
      if (match) {
        fields.dateOfBirth = match[1] || match[0];
        break;
      }
    }
    
    // Extract Name
    const namePatterns = [
      /Name[:\s]*([A-Z][A-Za-z\s]+)/i,
      /S\/O[:\s]*([A-Z][A-Za-z\s]+)/i,
      /D\/O[:\s]*([A-Z][A-Za-z\s]+)/i
    ];
    
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        fields.name = match[1].trim();
        break;
      }
    }
  }
  
  if (docType === 'rc') {
    // Extract Vehicle Registration Number
    const rcPatterns = [
      /[A-Z]{2}[-\s]?\d{1,2}[-\s]?[A-Z]{1,3}[-\s]?\d{1,4}/gi,
      /Reg[:\s]*No[:\s]*([A-Z0-9\-\s]+)/gi,
      /Registration[:\s]*([A-Z0-9\-\s]+)/gi
    ];
    
    for (const pattern of rcPatterns) {
      const match = text.match(pattern);
      if (match) {
        fields.vehicleNumber = match[0].replace(/[^A-Z0-9]/gi, '');
        break;
      }
    }
    
    // Extract Chassis Number
    const chassisPattern = /Chassis[:\s]*([A-Z0-9]+)/i;
    const chassisMatch = text.match(chassisPattern);
    if (chassisMatch) {
      fields.chassisNumber = chassisMatch[1];
    }
    
    // Extract Engine Number
    const enginePattern = /Engine[:\s]*([A-Z0-9]+)/i;
    const engineMatch = text.match(enginePattern);
    if (engineMatch) {
      fields.engineNumber = engineMatch[1];
    }
  }
  
  return fields;
}

/**
 * Check if cloud OCR is available
 */
function isCloudOCRAvailable() {
  return visionClient !== null || textractClient !== null;
}

/**
 * Get OCR provider info
 */
function getOCRInfo() {
  return {
    preferredProvider: OCR_PROVIDER,
    googleVision: visionClient !== null,
    awsTextract: textractClient !== null,
    tesseract: true, // Always available
    activeProvider: visionClient ? 'google' : (textractClient ? 'aws' : 'tesseract')
  };
}

module.exports = {
  performOCR,
  googleVisionOCR,
  awsTextractOCR,
  tesseractOCR,
  extractDocumentFields,
  isCloudOCRAvailable,
  getOCRInfo,
  OCR_PROVIDER
};
