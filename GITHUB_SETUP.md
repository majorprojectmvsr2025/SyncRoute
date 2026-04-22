# GitHub Setup Instructions

Follow these steps to push your code to GitHub.

## Step 1: Initialize Git (if not already done)

```bash
git init
git add .
git commit -m "Initial commit: SyncRoute carpooling platform"
```

## Step 2: Connect to GitHub Repository

```bash
git remote add origin https://github.com/majorprojectmvsr2025/SyncRoute.git
```

## Step 3: Push to GitHub

Since the repository already has files, you'll need to force push or pull first:

### Option A: Force Push (if you want to replace everything)

```bash
git push -u origin main --force
```

### Option B: Pull and Merge (if you want to keep existing files)

```bash
git pull origin main --allow-unrelated-histories
# Resolve any conflicts if they occur
git push -u origin main
```

## Step 4: Verify

Visit https://github.com/majorprojectmvsr2025/SyncRoute to confirm your code is uploaded.

## Important Files to Check

Before pushing, ensure these files are NOT in your repository:

- `.env` files (should be in .gitignore)
- `node_modules/` folders (should be in .gitignore)
- Any files with sensitive data (passwords, API keys, etc.)

## What Gets Pushed

The following will be pushed to GitHub:

### Frontend
- `syncroute-frontend/src/` - All source code
- `syncroute-frontend/public/` - Static assets including favicon
- `syncroute-frontend/package.json` - Dependencies
- `syncroute-frontend/.env.example` - Environment variable template

### Backend
- `syncroute-backend/models/` - Database schemas
- `syncroute-backend/routes/` - API endpoints
- `syncroute-backend/middleware/` - Express middleware
- `syncroute-backend/utils/` - Helper functions
- `syncroute-backend/socket/` - WebSocket handlers
- `syncroute-backend/package.json` - Dependencies
- `syncroute-backend/.env.example` - Environment variable template

### Documentation
- `README.md` - Project overview
- `DEPLOYMENT.md` - Deployment instructions
- `.gitignore` - Files to exclude from Git

## After Pushing

1. Go to your GitHub repository
2. Check that all files are present
3. Verify `.env` files are NOT visible (they should be ignored)
4. Proceed to DEPLOYMENT.md for deployment instructions

## Troubleshooting

### Error: "remote origin already exists"

```bash
git remote remove origin
git remote add origin https://github.com/majorprojectmvsr2025/SyncRoute.git
```

### Error: "failed to push some refs"

```bash
git pull origin main --rebase
git push -u origin main
```

### Error: "Permission denied"

Make sure you're logged into GitHub and have access to the repository.

```bash
# Configure Git with your credentials
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## Next Steps

After successfully pushing to GitHub:

1. Follow DEPLOYMENT.md to deploy your application
2. Set up MongoDB Atlas database
3. Deploy backend to Render
4. Deploy frontend to Vercel
5. Test your live application

---

Your code is now safely stored on GitHub and ready for deployment.
