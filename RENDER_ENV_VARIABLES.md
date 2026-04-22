# Render Environment Variables - Complete Setup

## All Environment Variables for Render

Go to: https://dashboard.render.com → Your Backend Service → Environment Tab

Add these **EXACTLY** as shown (no quotes!):

### 1. MONGODB_URI
```
mongodb+srv://majorprojectmvsr2025_db_user:RUCovfsld1EFfhGl@cluster0.zuxkyna.mongodb.net/syncroute?retryWrites=true&w=majority&appName=Cluster0
```

### 2. PORT
```
5000
```

### 3. NODE_ENV
```
production
```

### 4. JWT_SECRET
```
7ac1da1834c203cfa4f0190074eea5e6643f46ab5edb9e500734dcac1d0567f298f0aeb136a7a369118388c3eff74d144836a4a84917c46528ba183f211e7091
```

### 5. FRONTEND_URL
```
https://syncroute.vercel.app
```

### 6. OSRM_SERVER
```
http://router.project-osrm.org
```

## Important Notes

1. **No quotes** - Paste the values directly without quotes
2. **No spaces** - Make sure there are no extra spaces before or after
3. **Save Changes** - Click "Save Changes" after adding all variables
4. **Auto Redeploy** - Render will automatically redeploy when you save

## How to Add/Update Variables

1. Go to https://dashboard.render.com
2. Click on your **syncroute-backend** service
3. Click **"Environment"** tab in the left sidebar
4. For each variable:
   - Click **"Add Environment Variable"** (or edit existing)
   - Enter the **Key** (e.g., MONGODB_URI)
   - Enter the **Value** (paste from above)
   - Click **"Save Changes"**

## Verification

After saving, you should see all 6 variables listed:
- ✅ MONGODB_URI
- ✅ PORT
- ✅ NODE_ENV
- ✅ JWT_SECRET
- ✅ FRONTEND_URL
- ✅ OSRM_SERVER

## After Setup

1. Render will automatically redeploy (takes 2-3 minutes)
2. Wait for deployment to complete
3. Test the connection:
   ```bash
   curl https://syncroute.onrender.com/api/health
   ```

Should show:
```json
{
  "database": {
    "status": "connected",
    "readyState": 1
  }
}
```
