# SyncRoute System Architecture

## Overview
SyncRoute is a production-grade carpooling platform designed to scale to 100,000+ concurrent users with robust security, real-time features, and dynamic pricing.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Load Balancer (Nginx)                    │
│                    SSL Termination + Rate Limiting               │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│   API Server   │  │   API Server   │  │   API Server   │
│   Instance 1   │  │   Instance 2   │  │   Instance N   │
│  (Node.js +    │  │  (Node.js +    │  │  (Node.js +    │
│   Express)     │  │   Express)     │  │   Express)     │
└───────┬────────┘  └───────┬────────┘  └───────┬────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│   MongoDB      │  │   Redis Cache  │  │  WebSocket     │
│   Replica Set  │  │   + Session    │  │  Server        │
│   (Primary +   │  │   Store        │  │  (Socket.io)   │
│   Secondaries) │  │                │  │                │
└────────────────┘  └────────────────┘  └────────────────┘
```

### Microservices Architecture (For 100K+ Users)

```
┌──────────────────────────────────────────────────────────────┐
│                    API Gateway (Kong/AWS API Gateway)         │
│              Authentication + Rate Limiting + Routing         │
└────────────────────────────┬─────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│  Auth Service  │  │  Ride Service  │  │ Booking Service│
│  (JWT + OAuth) │  │  (Matching +   │  │ (Reservations +│
│                │  │   Pricing)     │  │  Payments)     │
└────────────────┘  └────────────────┘  └────────────────┘
        │                    │                    │
┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│ Verification   │  │  Notification  │  │  Analytics     │
│ Service (OCR + │  │  Service (Push │  │  Service       │
│  Document)     │  │  + Email + SMS)│  │  (Metrics)     │
└────────────────┘  └────────────────┘  └────────────────┘
```

## Database Design

### MongoDB Collections

#### Users Collection
```javascript
{
  _id: ObjectId,
  email: String (indexed, unique),
  phone: String (indexed),
  passwordHash: String (bcrypt),
  name: String,
  dateOfBirth: Date,
  role: Enum["passenger", "driver", "both"],
  
  // Verification
  driverVerification: {
    isVerified: Boolean,
    verifiedAt: Date,
    drivingLicenseId: String (indexed),
    drivingLicenseHash: String (SHA-256),
    vehicleNumber: String (indexed),
    vehicleNumberHash: String (SHA-256),
    verificationScore: Number (0-100),
    lastVerificationDate: Date
  },
  
  // Security
  fraudRiskScore: Number (0-1),
  accountStatus: Enum["active", "suspended", "banned"],
  lastLoginAt: Date,
  loginAttempts: Number,
  
  // Indexes
  indexes: [
    { email: 1 },
    { phone: 1 },
    { "driverVerification.drivingLicenseId": 1 },
    { fraudRiskScore: 1 },
    { createdAt: -1 }
  ]
}
```

#### Rides Collection
```javascript
{
  _id: ObjectId,
  driver: ObjectId (ref: User, indexed),
  from: {
    name: String,
    location: { type: "Point", coordinates: [lng, lat] } // GeoJSON
  },
  to: {
    name: String,
    location: { type: "Point", coordinates: [lng, lat] }
  },
  routePath: {
    type: "LineString",
    coordinates: [[lng, lat], ...] // Full route polyline
  },
  date: String (YYYY-MM-DD, indexed),
  departureTime: String (HH:MM),
  price: Number,
  dynamicPricing: {
    basePrice: Number,
    surgeMultiplier: Number,
    peakHourMultiplier: Number,
    demandMultiplier: Number
  },
  availableSeats: Number,
  totalSeats: Number,
  status: Enum["active", "in-progress", "completed", "cancelled"],
  
  // Cancellation tracking
  cancellationPolicy: {
    penaltyAmount: Number,
    penaltyPercentage: Number,
    freeCancel Until: Date
  },
  
  // Indexes
  indexes: [
    { driver: 1, date: 1 },
    { "from.location": "2dsphere" },
    { "to.location": "2dsphere" },
    { routePath: "2dsphere" },
    { date: 1, status: 1 },
    { createdAt: -1 }
  ]
}
```

#### Bookings Collection
```javascript
{
  _id: ObjectId,
  ride: ObjectId (ref: Ride, indexed),
  passenger: ObjectId (ref: User, indexed),
  driver: ObjectId (ref: User, indexed),
  seats: Number,
  totalPrice: Number,
  status: Enum["pending", "confirmed", "cancelled", "completed"],
  
  // Cancellation tracking
  cancellationDetails: {
    cancelledBy: ObjectId (ref: User),
    cancelledAt: Date,
    reason: String,
    penaltyApplied: Boolean,
    penaltyAmount: Number
  },
  
  // Fraud detection
  bookingMetadata: {
    ipAddress: String,
    deviceId: String,
    userAgent: String,
    bookingSource: Enum["web", "android", "ios"]
  },
  
  createdAt: Date (indexed),
  
  // Indexes
  indexes: [
    { passenger: 1, createdAt: -1 },
    { driver: 1, createdAt: -1 },
    { ride: 1 },
    { status: 1, createdAt: -1 }
  ]
}
```

## Security Architecture

### 1. Authentication & Authorization

#### JWT Token Structure
```javascript
{
  header: {
    alg: "HS256",
    typ: "JWT"
  },
  payload: {
    userId: "user_id",
    email: "user@example.com",
    role: "driver",
    iat: 1234567890,
    exp: 1234571490 // 1 hour expiry
  },
  signature: "HMAC-SHA256(header + payload + secret)"
}
```

#### Token Refresh Strategy
- Access Token: 1 hour expiry
- Refresh Token: 7 days expiry (stored in httpOnly cookie)
- Token rotation on refresh
- Blacklist for revoked tokens (Redis)

### 2. Document Verification Security

#### License & RC Verification Flow
```
1. User uploads document image
   ↓
2. Image preprocessing (Sharp)
   - Resize to optimal OCR size
   - Grayscale conversion
   - Contrast enhancement
   ↓
3. OCR Extraction (Tesseract.js)
   - Extract text with confidence score
   - Multiple pattern matching
   ↓
4. Format Validation
   - DL: SS-RR-YYYYNNNNNNN format
   - RC: SS-RR-XX-NNNN format
   - State code validation
   - RTO code validation
   ↓
5. Data Hashing & Storage
   - SHA-256 hash of DL number
   - SHA-256 hash of vehicle number
   - Store hashes, not plain text
   ↓
6. Cross-verification
   - Compare user input with OCR
   - Name matching (fuzzy)
   - DOB validation (18+ check)
   ↓
7. Verification Score (0-100)
   - OCR confidence: 20%
   - Format validity: 20%
   - Age validation: 20%
   - Name match: 20%
   - Document expiry: 20%
   ↓
8. Decision
   - Score >= 80: Auto-approve
   - Score 60-79: Manual review
   - Score < 60: Reject
```

#### Document Storage
```javascript
// Sensitive data hashing
const crypto = require('crypto');

function hashSensitiveData(data) {
  return crypto
    .createHash('sha256')
    .update(data + process.env.HASH_SALT)
    .digest('hex');
}

// Store only hashes
user.driverVerification.drivingLicenseHash = hashSensitiveData(dlNumber);
user.driverVerification.vehicleNumberHash = hashSensitiveData(vehicleNumber);

// Verification without storing plain text
function verifyDocument(userInput, storedHash) {
  const inputHash = hashSensitiveData(userInput);
  return inputHash === storedHash;
}
```

### 3. Fraud Detection System

#### Multi-Layer Fraud Detection
```javascript
// Layer 1: Account Pattern Analysis
- Account age < 1 hour: High risk
- Incomplete profile: Medium risk
- No verification: Medium risk

// Layer 2: Booking Pattern Analysis
- > 8 bookings/day: High risk
- Back-to-back bookings (< 5 min): High risk
- > 3 concurrent bookings: Medium risk

// Layer 3: Cancellation Pattern Analysis
- > 10 cancellations/week: Critical risk
- Cancellation rate > 40%: High risk
- Pattern of last-minute cancellations: Medium risk

// Layer 4: Device & IP Analysis
- Multiple accounts from same device: High risk
- VPN/Proxy usage: Medium risk
- Rapid account creation: High risk

// Layer 5: Behavioral Analysis
- Unusual booking times: Low risk
- Geographic anomalies: Medium risk
- Review manipulation: High risk
```

#### Risk Scoring Algorithm
```javascript
riskScore = 
  (cancellationScore * 0.25) +
  (accountAgeScore * 0.15) +
  (activityVolumeScore * 0.15) +
  (reviewPatternScore * 0.15) +
  (bookingPatternScore * 0.15) +
  (verificationScore * 0.15)

// Actions based on risk
if (riskScore > 0.7) {
  action = "suspend_account";
} else if (riskScore > 0.5) {
  action = "manual_review";
} else if (riskScore > 0.3) {
  action = "monitor";
} else {
  action = "none";
}
```

### 4. NoSQL Injection Prevention

#### Input Sanitization
```javascript
const mongoSanitize = require('express-mongo-sanitize');

// Middleware to prevent NoSQL injection
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Sanitized ${key} in ${req.path}`);
  }
}));

// Manual sanitization for complex queries
function sanitizeInput(input) {
  if (typeof input === 'object' && input !== null) {
    // Remove $ operators
    Object.keys(input).forEach(key => {
      if (key.startsWith('$')) {
        delete input[key];
      }
    });
  }
  return input;
}

// Example usage
const userEmail = sanitizeInput(req.body.email);
const user = await User.findOne({ email: userEmail });
```

#### Parameterized Queries
```javascript
// BAD - Vulnerable to injection
const user = await User.findOne({ 
  email: req.body.email 
});

// GOOD - Using schema validation
const userSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

const { error, value } = userSchema.validate(req.body);
if (error) {
  return res.status(400).json({ error: error.details[0].message });
}

const user = await User.findOne({ email: value.email });
```

## Scalability Strategy

### Horizontal Scaling (100K+ Users)

#### 1. Load Balancing
```nginx
# Nginx configuration
upstream api_servers {
    least_conn;  # Least connections algorithm
    server api1.syncroute.com:5000 weight=3;
    server api2.syncroute.com:5000 weight=3;
    server api3.syncroute.com:5000 weight=2;
    server api4.syncroute.com:5000 weight=2;
}

server {
    listen 443 ssl http2;
    server_name api.syncroute.com;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
    limit_req zone=api_limit burst=200 nodelay;
    
    location / {
        proxy_pass http://api_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 2. Database Sharding Strategy
```javascript
// Shard by user ID (consistent hashing)
function getShardForUser(userId) {
  const hash = crypto.createHash('md5').update(userId).digest('hex');
  const shardNumber = parseInt(hash.substring(0, 8), 16) % NUM_SHARDS;
  return `mongodb://shard${shardNumber}.syncroute.com:27017/syncroute`;
}

// Shard by geographic region
function getShardForLocation(lat, lng) {
  if (lat > 28 && lng > 77) return 'shard_north'; // North India
  if (lat < 13 && lng > 77) return 'shard_south'; // South India
  if (lat > 22 && lng < 77) return 'shard_west'; // West India
  return 'shard_east'; // East India
}
```

#### 3. Caching Strategy
```javascript
const Redis = require('ioredis');
const redis = new Redis.Cluster([
  { host: 'redis1.syncroute.com', port: 6379 },
  { host: 'redis2.syncroute.com', port: 6379 },
  { host: 'redis3.syncroute.com', port: 6379 }
]);

// Cache frequently accessed data
async function getRideWithCache(rideId) {
  const cacheKey = `ride:${rideId}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch from database
  const ride = await Ride.findById(rideId);
  
  // Store in cache (5 min TTL)
  await redis.setex(cacheKey, 300, JSON.stringify(ride));
  
  return ride;
}

// Cache invalidation on update
async function updateRide(rideId, updates) {
  const ride = await Ride.findByIdAndUpdate(rideId, updates, { new: true });
  
  // Invalidate cache
  await redis.del(`ride:${rideId}`);
  
  return ride;
}
```

#### 4. Message Queue for Async Processing
```javascript
const Bull = require('bull');

// Create queues
const notificationQueue = new Bull('notifications', {
  redis: { host: 'redis.syncroute.com', port: 6379 }
});

const verificationQueue = new Bull('document-verification', {
  redis: { host: 'redis.syncroute.com', port: 6379 }
});

// Add job to queue
await notificationQueue.add('send-booking-confirmation', {
  userId: booking.passenger,
  bookingId: booking._id,
  type: 'booking_confirmed'
}, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  }
});

// Process jobs
notificationQueue.process('send-booking-confirmation', async (job) => {
  const { userId, bookingId, type } = job.data;
  await sendPushNotification(userId, {
    title: 'Booking Confirmed',
    body: `Your ride booking #${bookingId} is confirmed`
  });
});
```

### Performance Optimization

#### 1. Database Indexing
```javascript
// Compound indexes for common queries
db.rides.createIndex({ date: 1, status: 1, "from.location": "2dsphere" });
db.bookings.createIndex({ passenger: 1, createdAt: -1 });
db.users.createIndex({ email: 1 }, { unique: true });

// Text index for search
db.rides.createIndex({ 
  "from.name": "text", 
  "to.name": "text" 
});
```

#### 2. Query Optimization
```javascript
// BAD - Fetches all fields
const rides = await Ride.find({ driver: driverId });

// GOOD - Select only needed fields
const rides = await Ride.find({ driver: driverId })
  .select('from to date price availableSeats')
  .lean(); // Returns plain JS objects (faster)

// GOOD - Pagination
const rides = await Ride.find({ status: 'active' })
  .sort({ createdAt: -1 })
  .skip((page - 1) * limit)
  .limit(limit);
```

#### 3. Connection Pooling
```javascript
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 50, // Max 50 connections
  minPoolSize: 10, // Min 10 connections
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000
});
```

## Monitoring & Observability

### Metrics to Track
```javascript
// Application metrics
- Request rate (req/sec)
- Response time (p50, p95, p99)
- Error rate (%)
- Active connections
- Database query time
- Cache hit rate

// Business metrics
- Active users (DAU, MAU)
- Rides created/completed
- Booking conversion rate
- Cancellation rate
- Average ride price
- Revenue per user

// Infrastructure metrics
- CPU usage (%)
- Memory usage (%)
- Disk I/O
- Network throughput
- Database connections
```

### Logging Strategy
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'syncroute-api' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Structured logging
logger.info('Ride created', {
  rideId: ride._id,
  driverId: ride.driver,
  from: ride.from.name,
  to: ride.to.name,
  price: ride.price,
  timestamp: new Date().toISOString()
});
```

## Disaster Recovery

### Backup Strategy
```bash
# Daily MongoDB backups
mongodump --uri="mongodb://..." --out=/backups/$(date +%Y%m%d)

# Retention policy
- Daily backups: 7 days
- Weekly backups: 4 weeks
- Monthly backups: 12 months
```

### High Availability
```
- MongoDB Replica Set (1 Primary + 2 Secondaries)
- Redis Sentinel for automatic failover
- Multi-AZ deployment
- Health checks every 30 seconds
- Automatic instance replacement on failure
```

## Cost Optimization

### Infrastructure Costs (100K Users)
```
- API Servers (4x t3.large): $300/month
- MongoDB Atlas (M30 cluster): $500/month
- Redis Cache (cache.r5.large): $150/month
- Load Balancer: $20/month
- S3 Storage (documents): $50/month
- CloudFront CDN: $100/month
- Total: ~$1,120/month

Cost per user: $0.0112/month
```

### Optimization Strategies
- Auto-scaling based on load
- Reserved instances for predictable workloads
- Spot instances for batch processing
- CDN for static assets
- Image compression for documents
- Database query optimization
