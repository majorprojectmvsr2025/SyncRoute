# SyncRoute - Deployment Guide

## 🚀 Live Application

- **Frontend**: https://syncroute.vercel.app
- **Backend**: https://syncroute.onrender.com
- **Health Check**: https://syncroute.onrender.com/api/health

## ✅ Recent Fixes

### Mobile Responsiveness
- Fixed navbar for logged-in users (removed clutter)
- Fixed horizontal overflow on mobile
- Improved mobile menu with better organization
- Fixed "Route matched" badge responsiveness

### Chatbot Intelligence
- Added strict rules to stay on-topic
- Comprehensive safety features information
- Rejects off-topic questions politely

### Navigation & UX
- Fixed 404 errors after document upload
- Changed favicon to white for better visibility
- Removed all documentation files except this one

## 📱 Mobile Navbar (Logged In)

**Desktop**: Logo | Nav Links | Theme | Notifications | Offer Ride | Profile | Logout
**Mobile**: Logo | Hamburger Menu (contains everything)

Mobile menu includes:
- User profile card
- Theme toggle & notifications
- Offer ride button
- Navigation links
- Sign out

## 🔧 Environment Variables

### Vercel (Frontend)
```
VITE_API_URL=https://syncroute.onrender.com/api
VITE_SOCKET_URL=https://syncroute.onrender.com
VITE_GOOGLE_CLIENT_ID=759769223324-3jqt5roenc8gf82qrsopddunlniugrcn.apps.googleusercontent.com
```

### Render (Backend)
```
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://majorprojectmvsr2025_db_user:RUCovfsld1EFfhGl@cluster0.zuxkyna.mongodb.net/syncroute?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=7ac1da1834c203cfa4f0190074eea5e6643f46ab5edb9e500734dcac1d0567f298f0aeb136a7a369118388c3eff74d144836a4a84917c46528ba183f211e7091
FRONTEND_URL=https://syncroute.vercel.app
OSRM_SERVER=http://router.project-osrm.org
```

## 🗄️ MongoDB Atlas Setup

1. Go to https://cloud.mongodb.com
2. Network Access → Add IP: 0.0.0.0/0
3. Ensure cluster is RUNNING (not paused)
4. Connection string is configured in Render

## 🔐 Google OAuth Setup

1. Go to https://console.cloud.google.com/apis/credentials
2. Find OAuth Client ID: 759769223324-3jqt5roenc8gf82qrsopddunlniugrcn
3. Add to "Authorized JavaScript origins":
   - https://syncroute.vercel.app
4. Add to "Authorized redirect URIs":
   - https://syncroute.vercel.app
5. Save and wait 5 minutes

## ⏰ Keep Backend Awake 24/7 (Optional)

Use UptimeRobot to ping backend every 5 minutes:

1. Go to https://uptimerobot.com
2. Sign up (free)
3. Add monitor: https://syncroute.onrender.com/api/health
4. Set interval: 5 minutes
5. Done!

## 🧪 Testing Checklist

- [ ] Frontend loads without errors
- [ ] Mobile navbar is clean (logged in)
- [ ] No horizontal scroll on mobile
- [ ] Document upload works
- [ ] Chatbot answers safety questions
- [ ] Chatbot rejects off-topic questions
- [ ] Favicon visible in browser tab

## 📊 Current Status

✅ Frontend deployed and working
✅ Backend deployed and working
✅ MongoDB connected
✅ Socket.io working
✅ Mobile responsive
✅ All features functional

## 🐛 Known Issues

⚠️ Document verification may take 10-15 seconds
⚠️ Google OAuth needs authorized URIs configured
⚠️ Backend sleeps after 15 min (use UptimeRobot)

## 📞 Support

For issues, check:
1. Render logs: https://dashboard.render.com
2. Vercel logs: https://vercel.com/dashboard
3. Browser console (F12)
4. MongoDB Atlas status

## 🎯 Next Steps

1. Set up UptimeRobot (2 minutes)
2. Configure Google OAuth (10 minutes)
3. Test all features on mobile
4. Monitor performance

---

**Last Updated**: April 22, 2026
**Version**: 1.0.0
