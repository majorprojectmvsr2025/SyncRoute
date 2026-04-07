# SyncRoute Cloud Deployment Guide

## 1. MongoDB Atlas Setup

### Create Cluster

1. Go to https://cloud.mongodb.com/
2. Create a free tier cluster (M0)
3. Set up database user with read/write access
4. Whitelist IP addresses (or allow from anywhere for testing)
5. Get connection string

### Update Environment

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/syncroute?retryWrites=true&w=majority
```

### Enable Backup (Atlas UI)

1. Go to Cluster → Backup → Enable
2. Choose backup frequency (daily recommended)
3. Set retention period

---

## 2. Cloudinary Setup (Document Storage)

### Create Account

1. Go to https://cloudinary.com/
2. Create free account
3. Get credentials from Dashboard

### Update Environment

```env
CLOUD_STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## 3. Firebase Setup (Push Notifications)

### Create Project

1. Go to https://console.firebase.google.com/
2. Create new project
3. Go to Project Settings → Service Accounts
4. Generate new private key
5. Copy the JSON content

### Update Environment

```env
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}
```

---

## 4. Google Cloud Vision (OCR - Optional)

### Enable API

1. Go to https://console.cloud.google.com/
2. Create project or use existing
3. Enable Cloud Vision API
4. Create service account with Vision API access
5. Download JSON key

### Update Environment

```env
CLOUD_OCR_PROVIDER=google
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

Or inline:

```env
GOOGLE_CLOUD_VISION_KEY={"type":"service_account",...}
```

---

## 5. Backend Deployment (Render)

### Setup

1. Go to https://render.com/
2. Connect GitHub repository
3. Create Web Service
4. Set build command: `npm install`
5. Set start command: `npm start`

### Environment Variables on Render

Add all environment variables from .env.example

### render.yaml (Optional)

```yaml
services:
  - type: web
    name: syncroute-backend
    env: node
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: MONGODB_URI
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: FRONTEND_URL
        sync: false
```

---

## 6. Frontend Deployment (Vercel)

### Setup

1. Go to https://vercel.com/
2. Import GitHub repository
3. Set root directory: `syncroute-frontend`
4. Framework preset: Vite

### Environment Variables

```env
VITE_API_URL=https://your-backend.render.com
```

### vercel.json (Optional)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## 7. CDN Setup (Cloudflare - Optional)

### For Static Assets

1. Add domain to Cloudflare
2. Enable proxying for your domain
3. Set caching rules for static assets

### For Document URLs

Cloudinary already provides CDN delivery by default.

---

## 8. Production Checklist

### Security

- [ ] Use strong JWT_SECRET
- [ ] Set proper CORS origin
- [ ] Enable rate limiting
- [ ] Use HTTPS everywhere
- [ ] Don't expose sensitive env vars

### Performance

- [ ] Enable MongoDB Atlas indexes
- [ ] Use Cloudinary transformations for images
- [ ] Enable gzip compression

### Monitoring

- [ ] Set up error tracking (Sentry)
- [ ] Configure logging (LogDNA, Papertrail)
- [ ] Set up uptime monitoring

---

## 9. Environment Variables Summary

```env
# Required
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_strong_secret
PORT=5000
FRONTEND_URL=https://your-frontend.vercel.app
NODE_ENV=production

# Cloud Storage (Optional)
CLOUD_STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Cloud OCR (Optional)
CLOUD_OCR_PROVIDER=google
GOOGLE_APPLICATION_CREDENTIALS=...

# Push Notifications (Optional)
FIREBASE_PROJECT_ID=...
FIREBASE_SERVICE_ACCOUNT_KEY=...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

---

## 10. Testing Cloud Integration

### Health Check

```bash
curl https://your-backend.render.com/api/health
```

Expected response:

```json
{
  "status": "ok",
  "cloud": {
    "storage": { "provider": "cloudinary", "isCloudConfigured": true },
    "pushNotifications": { "configured": true },
    "ocr": { "activeProvider": "google" }
  }
}
```

### Document Upload Test

```bash
curl -X POST https://your-backend.render.com/api/documents/verify \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "document=@license.jpg" \
  -F "docType=license"
```
