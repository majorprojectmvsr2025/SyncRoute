# SMTP Setup Guide - Send Real OTP Emails

## Current Status
- ✅ OTP system is working
- ⚠️ Emails only sent to Ethereal (test service)
- ❌ Real users don't receive emails

## Why Users Don't Get OTPs
The backend is using **Ethereal Email** (a test email service) because SMTP is not configured. Ethereal emails are fake - they don't actually send to real inboxes.

**From logs**:
```
📧 OTP Email Preview URL: https://ethereal.email/message/...
📧 OTP resent to jsudhakarreddy3@gmail.com: 755037
```

The OTP `755037` was generated but sent to Ethereal, not to the real email.

---

## Solution: Configure Real SMTP

You need to add SMTP credentials to Render environment variables.

### Option 1: Gmail (Easiest, Free)

#### Step 1: Enable 2-Factor Authentication
1. Go to https://myaccount.google.com/security
2. Enable "2-Step Verification"

#### Step 2: Generate App Password
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Other (Custom name)"
3. Name it "SyncRoute"
4. Click "Generate"
5. **Copy the 16-character password** (e.g., `abcd efgh ijkl mnop`)

#### Step 3: Add to Render
1. Go to https://dashboard.render.com
2. Select your backend service (syncroute-backend)
3. Go to "Environment" tab
4. Add these variables:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
EMAIL_FROM=SyncRoute <your-email@gmail.com>
```

**Replace**:
- `your-email@gmail.com` with your Gmail address
- `abcd efgh ijkl mnop` with the app password you generated

#### Step 4: Redeploy
1. Click "Manual Deploy" → "Deploy latest commit"
2. Wait for deployment to complete
3. Test registration with a real email

---

### Option 2: SendGrid (Better for Production)

SendGrid offers 100 free emails per day.

#### Step 1: Create SendGrid Account
1. Go to https://signup.sendgrid.com/
2. Sign up (free tier)
3. Verify your email

#### Step 2: Create API Key
1. Go to Settings → API Keys
2. Click "Create API Key"
3. Name it "SyncRoute"
4. Select "Full Access"
5. Click "Create & View"
6. **Copy the API key** (starts with `SG.`)

#### Step 3: Verify Sender Identity
1. Go to Settings → Sender Authentication
2. Click "Verify a Single Sender"
3. Fill in your details
4. Verify the email they send you

#### Step 4: Add to Render
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your-api-key-here
EMAIL_FROM=SyncRoute <your-verified-email@example.com>
```

**Replace**:
- `SG.your-api-key-here` with your SendGrid API key
- `your-verified-email@example.com` with the email you verified

---

### Option 3: Mailgun (Alternative)

Mailgun offers 5,000 free emails per month.

#### Step 1: Create Mailgun Account
1. Go to https://signup.mailgun.com/
2. Sign up (free tier)
3. Verify your email

#### Step 2: Get SMTP Credentials
1. Go to Sending → Domain Settings
2. Click on your sandbox domain
3. Find "SMTP Credentials" section
4. Copy the credentials

#### Step 3: Add to Render
```
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@sandboxXXXXX.mailgun.org
SMTP_PASS=your-password-here
EMAIL_FROM=SyncRoute <postmaster@sandboxXXXXX.mailgun.org>
```

---

## Testing After Setup

### 1. Check Render Logs
After redeploying, register a new user and check logs:

**Before (Ethereal)**:
```
📧 OTP Email Preview URL: https://ethereal.email/message/...
```

**After (Real SMTP)**:
```
📧 OTP sent to user@example.com: 123456
```

No more "Preview URL" means it's sending to real emails!

### 2. Test Registration
1. Go to https://syncroute.vercel.app/sign-up
2. Register with a real email address
3. Check your inbox for OTP email
4. Enter OTP on verification page

### 3. Check Spam Folder
If you don't see the email:
- Check spam/junk folder
- Wait 1-2 minutes (SMTP can be slow)
- Try resending OTP

---

## Email Template Preview

Users will receive this email:

```
┌─────────────────────────────────────┐
│  Welcome to SyncRoute!              │
│                                     │
│  Hi [Name], please verify your      │
│  email address to complete          │
│  registration.                      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Your verification code     │   │
│  │                             │   │
│  │      1  2  3  4  5  6       │   │
│  └─────────────────────────────┘   │
│                                     │
│  This code expires in 10 minutes.   │
└─────────────────────────────────────┘
```

---

## Troubleshooting

### Issue: "Authentication failed"
**Solution**: Double-check SMTP credentials
- Gmail: Make sure you're using App Password, not regular password
- SendGrid: Make sure SMTP_USER is exactly `apikey`
- Mailgun: Check you copied the full password

### Issue: "Connection timeout"
**Solution**: Check SMTP_HOST and SMTP_PORT
- Gmail: `smtp.gmail.com:587`
- SendGrid: `smtp.sendgrid.net:587`
- Mailgun: `smtp.mailgun.org:587`

### Issue: Emails go to spam
**Solution**: 
- Use a verified sender email
- Add SPF/DKIM records (advanced)
- Ask users to check spam folder

### Issue: Still using Ethereal
**Solution**: 
- Make sure environment variables are saved in Render
- Redeploy after adding variables
- Check logs for "SMTP_HOST" to confirm it's being used

---

## Cost Comparison

| Provider | Free Tier | Best For |
|----------|-----------|----------|
| **Gmail** | Unlimited* | Development, small apps |
| **SendGrid** | 100/day | Production, reliable |
| **Mailgun** | 5,000/month | High volume |
| **AWS SES** | 62,000/month** | Enterprise |

*Gmail has daily sending limits (~500/day)
**First 62,000 emails free if sent from EC2

---

## Recommended Setup

For your presentation and initial users:

1. **Use Gmail** (quickest setup, 5 minutes)
2. **Switch to SendGrid** later (more professional)
3. **Monitor usage** in Render logs

---

## Quick Start (Gmail)

```bash
# 1. Enable 2FA on Gmail
# 2. Generate App Password
# 3. Add to Render:

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
EMAIL_FROM=SyncRoute <your-email@gmail.com>

# 4. Redeploy
# 5. Test registration
```

---

## Status After Setup

✅ Users receive real OTP emails
✅ No more Ethereal preview URLs
✅ Registration flow works end-to-end
✅ Ready for presentation

---

**Need Help?**
- Gmail App Passwords: https://support.google.com/accounts/answer/185833
- SendGrid Docs: https://docs.sendgrid.com/
- Mailgun Docs: https://documentation.mailgun.com/

**Current OTP in logs**: `755037` (for jsudhakarreddy3@gmail.com)
This OTP was sent to Ethereal, not the real email. After SMTP setup, it will go to the real inbox!
