# SyncRoute Deployment Guide

Complete guide to deploy SyncRoute for free using Vercel (frontend), Render (backend), and MongoDB Atlas (database).

## Prerequisites

- GitHub account
- Vercel account (free tier)
- Render account (free tier)
- MongoDB Atlas account (free tier)
- Mapbox account (free tier)

## Step 1: Database Setup (MongoDB Atlas)

### Create Free MongoDB Cluster

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up or log in
3. Click "Build a Database"
4. Select "FREE" tier (M0 Sandbox)
5. Choose a cloud provider and region (closest to your users)
6. Click "Create Cluster"

### Configure Database Access

1. Go to "Database Access" in left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Create username and strong password (save these)
5. Set "Database User Privileges" to "Read and write to any database"
6. Click "Add User"

### Configure Network Access

1. Go to "Network Access" in left sidebar
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (0.0.0.0/0)
4. Click "Confirm"

### Get Connection String

1. Go to "Database" in left sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Copy the connection string
5. Replace `<password>` with your database user password
6. Replace `<dbname>` with `syncroute`

Example: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/syncroute?retryWrites=true&w=majority`

## Step 2: Get Mapbox Token

1. Go to [Mapbox](https://www.mapbox.com/)
2. Sign up or log in
3. Go to "Account" > "Access tokens"
4. Copy your "Default public token" OR create a new token
5. Save this token for frontend configuration

## Step 3: Backend Deployment (Render)

### Prepare Backend

1. Ensure your code is pushed to GitHub
2. Make sure `syncroute-backend/package.json` has these scripts:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

### Deploy to Render

1. Go to [Render](https://render.com/)
2. Sign up or log in
3. Click "New +" > "Web Service"
4. Connect your GitHub repository
5. Configure the service:
   - **Name**: `syncroute-backend`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `syncroute-backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

### Add Environment Variables

In Render dashboard, go to "Environment" tab and add:

```
PORT=5000
NODE_ENV=production
MONGODB_URI=your_mongodb_connection_string_from_step1
JWT_SECRET=generate_a_strong_random_string_here
OSRM_SERVER=http://router.project-osrm.org
FRONTEND_URL=https://your-app-name.vercel.app
```

**Generate JWT Secret**: Use this command or online generator:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

6. Click "Create Web Service"
7. Wait for deployment to complete (5-10 minutes)
8. Copy your backend URL (e.g., `https://syncroute-backend.onrender.com`)

**Important**: Free tier on Render spins down after 15 minutes of inactivity. First request after inactivity may take 30-60 seconds.

## Step 4: Frontend Deployment (Vercel)

### Update Frontend Configuration

1. Create `syncroute-frontend/.env.production`:

```env
VITE_API_URL=https://your-backend-url.onrender.com/api
VITE_SOCKET_URL=https://your-backend-url.onrender.com
VITE_MAPBOX_TOKEN=your_mapbox_token_from_step2
```

Replace `your-backend-url` with your Render backend URL from Step 3.

### Deploy to Vercel

1. Go to [Vercel](https://vercel.com/)
2. Sign up or log in with GitHub
3. Click "Add New" > "Project"
4. Import your GitHub repository
5. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `syncroute-frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### Add Environment Variables

In Vercel project settings, go to "Environment Variables" and add:

```
VITE_API_URL=https://your-backend-url.onrender.com/api
VITE_SOCKET_URL=https://your-backend-url.onrender.com
VITE_MAPBOX_TOKEN=your_mapbox_token
```

6. Click "Deploy"
7. Wait for deployment (2-5 minutes)
8. Copy your frontend URL (e.g., `https://syncroute.vercel.app`)

### Update Backend CORS

1. Go back to Render dashboard
2. Update `FRONTEND_URL` environment variable with your Vercel URL
3. Click "Save Changes" (this will redeploy)

## Step 5: Verification

### Test Your Deployment

1. Visit your Vercel URL
2. Try signing up for a new account
3. Try searching for rides
4. Check if maps load correctly
5. Test offering a ride (requires login)

### Common Issues

**Backend not responding**:
- Check Render logs for errors
- Verify MongoDB connection string is correct
- Ensure all environment variables are set

**Maps not loading**:
- Verify Mapbox token is correct
- Check browser console for errors

**CORS errors**:
- Ensure FRONTEND_URL in backend matches your Vercel URL exactly
- Include protocol (https://)

**Socket connection fails**:
- Verify VITE_SOCKET_URL matches backend URL
- Check if backend is running (Render free tier spins down)

## Step 6: Custom Domain (Optional)

### Add Custom Domain to Vercel

1. Go to Vercel project settings
2. Click "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions
5. Wait for DNS propagation (up to 48 hours)

### Update Backend CORS

1. Update `FRONTEND_URL` in Render to your custom domain
2. Redeploy backend

## Cost Breakdown

All services used are completely free:

- **MongoDB Atlas**: Free M0 tier (512MB storage)
- **Render**: Free tier (750 hours/month, spins down after inactivity)
- **Vercel**: Free tier (unlimited deployments, 100GB bandwidth)
- **Mapbox**: Free tier (50,000 map loads/month)

**Total Cost**: $0/month

## Limitations of Free Tier

### Render (Backend)
- Spins down after 15 minutes of inactivity
- First request after spin-down takes 30-60 seconds
- 750 hours/month (enough for one service)

### MongoDB Atlas
- 512MB storage limit
- Shared CPU and RAM
- Good for ~5,000-10,000 users

### Vercel (Frontend)
- 100GB bandwidth/month
- Unlimited deployments
- No cold starts

## Scaling Beyond Free Tier

When you outgrow free tier:

1. **Backend**: Upgrade Render to $7/month (no spin-down)
2. **Database**: Upgrade MongoDB to $9/month (2GB storage)
3. **Frontend**: Vercel Pro at $20/month (more bandwidth)

## Monitoring

### Check Application Health

**Backend Health**:
```bash
curl https://your-backend-url.onrender.com/api/health
```

**Frontend**: Visit your Vercel URL

### View Logs

- **Render**: Dashboard > Logs tab
- **Vercel**: Dashboard > Deployments > View Function Logs
- **MongoDB**: Atlas > Metrics tab

## Continuous Deployment

Both Vercel and Render automatically redeploy when you push to GitHub:

1. Make changes locally
2. Commit and push to GitHub
3. Vercel and Render automatically detect changes
4. New version deploys in 2-10 minutes

## Backup Strategy

### Database Backups

MongoDB Atlas free tier doesn't include automated backups. To backup:

1. Use `mongodump` command:
```bash
mongodump --uri="your_mongodb_connection_string"
```

2. Or use MongoDB Compass (GUI tool) to export data

### Code Backups

Your code is already backed up on GitHub. Ensure you:
- Commit regularly
- Use meaningful commit messages
- Don't commit `.env` files (use `.env.example` instead)

## Security Checklist

- [ ] Strong JWT_SECRET generated
- [ ] MongoDB user has strong password
- [ ] Environment variables not committed to Git
- [ ] CORS configured correctly
- [ ] HTTPS enabled (automatic on Vercel/Render)
- [ ] API rate limiting enabled (check backend code)

## Support

If you encounter issues:

1. Check service status pages:
   - [Vercel Status](https://www.vercel-status.com/)
   - [Render Status](https://status.render.com/)
   - [MongoDB Atlas Status](https://status.mongodb.com/)

2. Review logs in respective dashboards

3. Check GitHub Issues for known problems

## Next Steps

After successful deployment:

1. Set up monitoring (e.g., UptimeRobot for free uptime monitoring)
2. Configure custom domain
3. Set up analytics (Google Analytics, Plausible, etc.)
4. Enable error tracking (Sentry free tier)
5. Add more features and iterate

---

Deployment complete. Your SyncRoute application is now live and accessible worldwide.
