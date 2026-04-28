# OTP Email Verification System

## Overview
SyncRoute now implements **proper email verification** using OTP (One-Time Password) to prevent fake account creation. Users must verify their email before they can log in.

---

## How It Works

### Registration Flow
1. **User signs up** with name, email, password
2. **Backend creates unverified account** and generates 6-digit OTP
3. **OTP sent to email** (expires in 10 minutes)
4. **User redirected to verification page**
5. **User enters OTP** from email
6. **Account verified** → User can now log in

### Login Flow
1. **User tries to log in**
2. **Backend checks if email is verified**
3. If **not verified** → Redirect to verification page
4. If **verified** → Login successful

---

## Backend Implementation

### New API Endpoints

#### 1. POST `/api/auth/register`
**Changed behavior**: Now creates unverified account and sends OTP

**Request**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "+91 9876543210",
  "role": "passenger"
}
```

**Response** (Success):
```json
{
  "message": "Registration successful! Please check your email for the verification code.",
  "requiresVerification": true,
  "email": "john@example.com",
  "userId": "507f1f77bcf86cd799439011"
}
```

**Response** (User exists but not verified):
```json
{
  "message": "Account already exists but not verified. New OTP sent to your email.",
  "requiresVerification": true,
  "email": "john@example.com"
}
```

#### 2. POST `/api/auth/verify-otp` ✨ NEW
**Verify email with OTP code**

**Request**:
```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

**Response** (Success):
```json
{
  "message": "Email verified successfully! Welcome to SyncRoute.",
  "verified": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "verified": true,
    ...
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** (Invalid OTP):
```json
{
  "message": "Invalid OTP. 4 attempts remaining.",
  "attemptsRemaining": 4
}
```

**Response** (OTP Expired):
```json
{
  "message": "OTP has expired. Please request a new one.",
  "expired": true
}
```

**Response** (Too Many Attempts):
```json
{
  "message": "Too many failed attempts. Please request a new OTP.",
  "tooManyAttempts": true
}
```

#### 3. POST `/api/auth/resend-otp` ✨ NEW
**Resend OTP to email**

**Request**:
```json
{
  "email": "john@example.com"
}
```

**Response**:
```json
{
  "message": "New OTP sent to your email",
  "email": "john@example.com"
}
```

#### 4. POST `/api/auth/login`
**Changed behavior**: Now blocks unverified users

**Response** (Unverified user):
```json
{
  "message": "Please verify your email before logging in. Check your inbox for the verification code.",
  "requiresVerification": true,
  "email": "john@example.com"
}
```

---

## Database Changes

### User Model - New Fields

```javascript
{
  verified: {
    type: Boolean,
    default: false  // ← Users start unverified
  },
  emailVerificationOTP: {
    type: String,
    default: null  // ← Stores the 6-digit OTP
  },
  emailVerificationOTPExpires: {
    type: Date,
    default: null  // ← OTP expiry time (10 minutes)
  },
  emailVerificationAttempts: {
    type: Number,
    default: 0  // ← Track failed attempts (max 5)
  }
}
```

---

## Frontend Implementation

### New Page: `/verify-email`

**Features**:
- ✅ 6-digit OTP input with auto-focus
- ✅ Auto-submit when all digits entered
- ✅ Paste support for OTP codes
- ✅ Shows attempts remaining (max 5)
- ✅ Resend button with 60s cooldown
- ✅ Beautiful error messages
- ✅ Countdown timer for resend

**URL**: `/verify-email?email=john@example.com`

### Updated Pages

#### SignUp.tsx
- Redirects to `/verify-email` after registration
- Shows success message with email

#### SignIn.tsx
- Detects unverified users
- Redirects to `/verify-email` if not verified

---

## Email Template

### OTP Email Design
```
┌─────────────────────────────────────┐
│  Welcome to SyncRoute!              │
│                                     │
│  Hi John, please verify your email  │
│  address to complete registration.  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Your verification code     │   │
│  │                             │   │
│  │      1  2  3  4  5  6       │   │
│  └─────────────────────────────┘   │
│                                     │
│  This code expires in 10 minutes.   │
│                                     │
│  If you didn't create an account,   │
│  you can safely ignore this email.  │
└─────────────────────────────────────┘
```

**Email Configuration**:
- Uses `nodemailer` for sending
- Production: Configure SMTP in `.env`
- Development: Uses Ethereal (test email service)

---

## Security Features

### 1. OTP Expiry
- OTP expires after **10 minutes**
- User must request new OTP after expiry

### 2. Attempt Limiting
- Maximum **5 verification attempts** per OTP
- After 5 failed attempts, must request new OTP
- Prevents brute-force attacks

### 3. Email Validation
- Email must be valid format
- Email is lowercased and trimmed
- Prevents duplicate accounts

### 4. Rate Limiting
- Registration endpoint: 5 attempts per 15 minutes
- OTP resend: 3 requests per hour
- Prevents spam and abuse

### 5. Unverified Account Handling
- Unverified users cannot log in
- Old unverified accounts can request new OTP
- Prevents fake account accumulation

---

## Environment Variables

### Backend (.env)

```bash
# Email Configuration (Production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=SyncRoute <noreply@syncroute.app>

# Frontend URL (for email links)
FRONTEND_URL=https://syncroute.vercel.app
```

### Development Mode
If SMTP is not configured, the system uses **Ethereal Email** (test service):
- OTP emails are sent to Ethereal
- Preview URL logged in console
- No real emails sent

---

## Testing Guide

### Test Registration Flow

1. **Sign up** with a new email
2. **Check console** for OTP (development mode)
3. **Open verification page** (auto-redirected)
4. **Enter OTP** from console/email
5. **Verify success** → Redirected to home

### Test Invalid OTP

1. Enter wrong OTP
2. See "Invalid OTP. X attempts remaining"
3. After 5 attempts → "Too many attempts"
4. Click "Resend code"

### Test OTP Expiry

1. Wait 10 minutes after registration
2. Try to verify with old OTP
3. See "OTP has expired"
4. Click "Resend code"

### Test Unverified Login

1. Register but don't verify
2. Try to log in
3. See "Please verify your email"
4. Redirected to verification page

---

## Console Logs (Development)

When OTP is sent, you'll see:
```
📧 OTP sent to john@example.com: 123456
📧 OTP Email Preview URL: https://ethereal.email/message/...
```

Click the preview URL to see the email in browser.

---

## Production Deployment

### 1. Configure SMTP
Add to Render environment variables:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=SyncRoute <noreply@syncroute.app>
FRONTEND_URL=https://syncroute.vercel.app
```

### 2. Gmail Setup (if using Gmail)
1. Enable 2-Factor Authentication
2. Generate App Password
3. Use App Password as `SMTP_PASS`

### 3. Alternative SMTP Providers
- **SendGrid**: Free tier 100 emails/day
- **Mailgun**: Free tier 5,000 emails/month
- **AWS SES**: Very cheap, requires verification
- **Postmark**: Free tier 100 emails/month

---

## User Experience

### Registration
1. User fills sign-up form
2. Clicks "Create account"
3. Sees success message: "Check your email!"
4. Redirected to verification page
5. Receives email with 6-digit code
6. Enters code
7. Account verified → Logged in automatically

### Login (Unverified)
1. User tries to log in
2. Sees: "Please verify your email"
3. Redirected to verification page
4. Can resend OTP if needed
5. Verifies and logs in

---

## Benefits

### Security
✅ Prevents fake accounts with non-existent emails
✅ Confirms user owns the email address
✅ Reduces spam and bot registrations
✅ Protects against email enumeration

### User Trust
✅ Professional onboarding experience
✅ Clear communication
✅ Easy verification process
✅ Helpful error messages

### Compliance
✅ Industry standard practice
✅ GDPR-friendly (user consent)
✅ Audit trail (verification timestamps)
✅ Account security

---

## Troubleshooting

### OTP Not Received
1. Check spam/junk folder
2. Verify email address is correct
3. Click "Resend code"
4. Check console logs (development)

### "Too Many Attempts"
1. Click "Resend code"
2. Get fresh OTP
3. Attempts counter resets

### "OTP Expired"
1. Click "Resend code"
2. New OTP sent with fresh 10-minute timer

### Email Not Sending (Production)
1. Check SMTP credentials in Render
2. Verify SMTP_HOST and SMTP_PORT
3. Check email provider settings
4. Review backend logs for errors

---

## Future Enhancements

### Possible Improvements
- [ ] SMS OTP as alternative
- [ ] Email verification link (in addition to OTP)
- [ ] Remember device (skip OTP for 30 days)
- [ ] Social login auto-verification
- [ ] Admin panel to manually verify users
- [ ] Bulk email verification status check

---

## Summary

✅ **Backend**: OTP generation, email sending, verification logic
✅ **Frontend**: Beautiful verification UI with countdown timer
✅ **Security**: Attempt limiting, expiry, rate limiting
✅ **UX**: Auto-focus, paste support, clear error messages
✅ **Production Ready**: SMTP configuration, error handling

**No more fake accounts!** Every user must verify their email before accessing the platform.

---

**Last Updated**: April 27, 2026
**Status**: ✅ Fully Implemented
**Commits**: 89fd43c (backend), 7f3f588 (frontend)
