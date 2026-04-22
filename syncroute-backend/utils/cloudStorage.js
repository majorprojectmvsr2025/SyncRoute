/**
 * Cloud Storage Integration Module
 * Supports: Cloudinary (default), AWS S3 (optional)
 * 
 * This module provides cloud file upload functionality while maintaining
 * backward compatibility with local storage.
 */

const fs = require('fs');
const path = require('path');

// Storage provider configuration
const STORAGE_PROVIDER = process.env.CLOUD_STORAGE_PROVIDER || 'local'; // 'cloudinary', 's3', or 'local'

// Dynamic imports with graceful fallback
let cloudinary = null;
let S3Client = null;
let PutObjectCommand = null;
let DeleteObjectCommand = null;

// Try to load Cloudinary
try {
  cloudinary = require('cloudinary').v2;
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
    console.log('[CloudStorage] Cloudinary configured');
  }
} catch (err) {
  console.log('[CloudStorage] Cloudinary package not installed - cloud storage disabled');
}

// Try to load AWS S3
let s3Client = null;
try {
  const s3Module = require('@aws-sdk/client-s3');
  S3Client = s3Module.S3Client;
  PutObjectCommand = s3Module.PutObjectCommand;
  DeleteObjectCommand = s3Module.DeleteObjectCommand;
  
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    console.log('[CloudStorage] AWS S3 configured');
  }
} catch (err) {
  console.log('[CloudStorage] AWS S3 package not installed - S3 storage disabled');
}

/**
 * Upload file to cloud storage
 * @param {string} filePath - Local file path
 * @param {Object} options - Upload options
 * @param {string} options.folder - Cloud folder name
 * @param {string} options.publicId - Custom public ID
 * @param {string} options.resourceType - Resource type (image, raw, auto)
 * @returns {Promise<Object>} Upload result with url and publicId
 */
async function uploadToCloud(filePath, options = {}) {
  const { folder = 'documents', publicId, resourceType = 'auto' } = options;

  // If cloud storage is not configured, return local path
  if (STORAGE_PROVIDER === 'local' || (!cloudinary && !s3Client)) {
    console.log('[CloudStorage] Using local storage (cloud not configured)');
    return {
      url: filePath,
      publicId: path.basename(filePath),
      provider: 'local',
      isCloud: false
    };
  }

  try {
    if (STORAGE_PROVIDER === 'cloudinary' && cloudinary && process.env.CLOUDINARY_CLOUD_NAME) {
      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(filePath, {
        folder: `syncroute/${folder}`,
        public_id: publicId,
        resource_type: resourceType,
        // OCR-friendly settings for documents
        quality: 'auto:best',
        fetch_format: 'auto',
        flags: 'preserve_transparency'
      });

      console.log(`[CloudStorage] Uploaded to Cloudinary: ${result.secure_url}`);
      
      return {
        url: result.secure_url,
        publicId: result.public_id,
        provider: 'cloudinary',
        isCloud: true,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      };

    } else if (STORAGE_PROVIDER === 's3' && s3Client) {
      // Upload to AWS S3
      const fileContent = fs.readFileSync(filePath);
      const fileName = publicId || path.basename(filePath);
      const key = `${folder}/${fileName}`;
      const bucket = process.env.AWS_S3_BUCKET;

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileContent,
        ContentType: getMimeType(filePath),
        ACL: 'public-read'
      });

      await s3Client.send(command);
      
      const url = `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
      console.log(`[CloudStorage] Uploaded to S3: ${url}`);
      
      return {
        url,
        publicId: key,
        provider: 's3',
        isCloud: true
      };
    }

    // Fallback to local
    return {
      url: filePath,
      publicId: path.basename(filePath),
      provider: 'local',
      isCloud: false
    };

  } catch (error) {
    console.error('[CloudStorage] Upload error:', error);
    // Graceful fallback to local storage on error
    return {
      url: filePath,
      publicId: path.basename(filePath),
      provider: 'local',
      isCloud: false,
      error: error.message
    };
  }
}

/**
 * Delete file from cloud storage
 * @param {string} publicId - Cloud public ID or file path
 * @param {string} provider - Storage provider
 */
async function deleteFromCloud(publicId, provider = STORAGE_PROVIDER) {
  try {
    if (provider === 'cloudinary' && cloudinary && process.env.CLOUDINARY_CLOUD_NAME) {
      await cloudinary.uploader.destroy(publicId);
      console.log(`[CloudStorage] Deleted from Cloudinary: ${publicId}`);
    } else if (provider === 's3' && s3Client) {
      const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: publicId
      });
      await s3Client.send(command);
      console.log(`[CloudStorage] Deleted from S3: ${publicId}`);
    } else if (provider === 'local' && fs.existsSync(publicId)) {
      fs.unlinkSync(publicId);
      console.log(`[CloudStorage] Deleted local file: ${publicId}`);
    }
  } catch (error) {
    console.error('[CloudStorage] Delete error:', error);
  }
}

/**
 * Get optimized URL for document OCR
 * Cloudinary can transform images for better OCR results
 * @param {string} url - Original URL
 * @param {Object} options - Transform options
 */
function getOcrOptimizedUrl(url, options = {}) {
  if (!url || !url.includes('cloudinary')) {
    return url;
  }

  // Apply Cloudinary transformations for better OCR
  // - Increase contrast
  // - Convert to grayscale
  // - Sharpen
  const transformations = 'e_contrast:20,e_grayscale,e_sharpen:100,q_100';
  
  // Insert transformation before /upload/
  return url.replace('/upload/', `/upload/${transformations}/`);
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.gif': 'image/gif'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Check if cloud storage is configured
 */
function isCloudConfigured() {
  return (
    STORAGE_PROVIDER !== 'local' &&
    ((cloudinary && process.env.CLOUDINARY_CLOUD_NAME) || s3Client)
  );
}

/**
 * Get current storage provider info
 */
function getStorageInfo() {
  return {
    provider: STORAGE_PROVIDER,
    isCloudConfigured: isCloudConfigured(),
    cloudinary: !!(cloudinary && process.env.CLOUDINARY_CLOUD_NAME),
    s3: !!s3Client
  };
}

module.exports = {
  uploadToCloud,
  deleteFromCloud,
  getOcrOptimizedUrl,
  isCloudConfigured,
  getStorageInfo,
  STORAGE_PROVIDER
};
