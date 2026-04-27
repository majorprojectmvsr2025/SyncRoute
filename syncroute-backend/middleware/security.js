/**
 * Security Middleware
 * Protects against NoSQL injection, XSS, and other attacks
 */

const mongoSanitize = require('express-mongo-sanitize');
const Joi = require('joi');

/**
 * NoSQL Injection Protection Middleware
 * Removes $ and . from user input to prevent query injection
 */
const noSQLInjectionProtection = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`[SECURITY] Sanitized potentially malicious input: ${key} in ${req.path}`);
  }
});

/**
 * Input Validation Schemas
 */
const validationSchemas = {
  // User registration
  register: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
    dateOfBirth: Joi.date().max('now').optional()
  }),

  // User login
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // Ride creation
  createRide: Joi.object({
    from: Joi.object({
      name: Joi.string().required(),
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required()
    }).required(),
    to: Joi.object({
      name: Joi.string().required(),
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required()
    }).required(),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    departureTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    price: Joi.number().min(10).max(10000).required(),
    availableSeats: Joi.number().min(1).max(7).required(),
    vehicleType: Joi.string().valid('Sedan', 'SUV', 'Compact', 'Van').optional()
  }),

  // Booking creation
  createBooking: Joi.object({
    rideId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    seats: Joi.number().min(1).max(7).required(),
    pickupLocation: Joi.object({
      name: Joi.string().required(),
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required()
    }).required(),
    dropLocation: Joi.object({
      name: Joi.string().required(),
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required()
    }).required()
  }),

  // Document verification
  verifyDocument: Joi.object({
    documentType: Joi.string().valid('license', 'rc', 'insurance').required(),
    documentNumber: Joi.string().min(5).max(50).required(),
    name: Joi.string().min(2).max(100).optional(),
    dateOfBirth: Joi.date().max('now').optional()
  })
};

/**
 * Validate request body against schema
 */
function validateRequest(schemaName) {
  return (req, res, next) => {
    const schema = validationSchemas[schemaName];
    
    if (!schema) {
      console.error(`[SECURITY] Validation schema '${schemaName}' not found`);
      return next();
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        message: 'Validation failed',
        errors
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
}

/**
 * Sanitize MongoDB query parameters
 */
function sanitizeQuery(req, res, next) {
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        // Remove potential injection characters
        req.query[key] = req.query[key].replace(/[${}]/g, '');
      }
    });
  }
  next();
}

/**
 * Rate limiting configuration for different endpoints
 */
const rateLimitConfig = {
  // Authentication endpoints - strict limits
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: { message: 'Too many authentication attempts. Please try again later.' }
  },

  // OTP requests - prevent abuse
  otp: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 OTP requests per hour
    message: { message: 'Too many OTP requests. Please try again later.' }
  },

  // Document upload - prevent spam
  documentUpload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 uploads per hour
    message: { message: 'Too many document uploads. Please try again later.' }
  },

  // Ride creation - prevent spam
  rideCreation: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 rides per hour
    message: { message: 'Too many ride creation attempts. Please slow down.' }
  },

  // Booking creation - prevent abuse
  bookingCreation: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30, // 30 bookings per hour
    message: { message: 'Too many booking attempts. Please slow down.' }
  },

  // General API - reasonable limits
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests
    message: { message: 'Too many requests. Please try again later.' }
  }
};

/**
 * Device fingerprinting middleware
 * Tracks device information for fraud detection
 */
function deviceFingerprint(req, res, next) {
  req.deviceInfo = {
    userAgent: req.headers['user-agent'] || 'unknown',
    ip: req.ip || req.connection.remoteAddress,
    acceptLanguage: req.headers['accept-language'] || 'unknown',
    timestamp: new Date()
  };
  next();
}

/**
 * Detect suspicious patterns in requests
 */
function suspiciousActivityDetection(req, res, next) {
  const suspiciousPatterns = [
    // SQL injection attempts
    /(\bSELECT\b|\bUNION\b|\bINSERT\b|\bDROP\b|\bDELETE\b)/i,
    // Script injection
    /<script[^>]*>.*?<\/script>/gi,
    // Path traversal
    /\.\.[\/\\]/,
    // Command injection
    /[;&|`$()]/
  ];

  const checkString = JSON.stringify(req.body) + JSON.stringify(req.query);

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      console.error('[SECURITY] Suspicious activity detected:', {
        ip: req.ip,
        path: req.path,
        pattern: pattern.toString()
      });

      return res.status(403).json({
        message: 'Suspicious activity detected. Request blocked.'
      });
    }
  }

  next();
}

module.exports = {
  noSQLInjectionProtection,
  validateRequest,
  sanitizeQuery,
  rateLimitConfig,
  deviceFingerprint,
  suspiciousActivityDetection,
  validationSchemas
};
