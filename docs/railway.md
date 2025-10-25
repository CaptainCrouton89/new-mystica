# Railway Deployment Configuration

The Railway app has all variables from @.env.local loaded (but NODE_ENV=production). The Railway app is connected to the monorepo git repo.

The node engine is 24 (well supported as of October 2025).

## ⚠️ CRITICAL: Configure Railway to Use Dockerfile

**Railway is ignoring the `railway.toml` file and auto-detecting Nixpacks.** You MUST manually configure the builder in the Railway dashboard:

### Steps to Fix in Railway Dashboard

1. Go to your Railway project: https://railway.app/
2. Click on your **mystica-express** service
3. Navigate to the **Settings** tab
4. Scroll down to the **Build** section
5. Change **Builder** from "Nixpacks" to **"Dockerfile"**
6. Set **Dockerfile Path** to `Dockerfile` (root of repo)
7. Click **Save Changes**
8. Trigger a new deployment (or it will auto-deploy on next push)

### Why This is Necessary

- Railway's Nixpacks **doesn't have Node.js 24** in the stable nixpkgs channel
- The auto-detection sees package.json and defaults to Nixpacks
- The `railway.toml` file is advisory but UI settings take precedence
- Our Dockerfile uses official `node:24-slim` which always has Node 24

## Files

- **Dockerfile** - Production build with Node.js 24, pnpm 8.x, TypeScript compilation
- **railway.toml** - Deployment config (health checks, restart policy) - may not override UI
- **.dockerignore** - Excludes unnecessary files from build context

## Local Validation

The Dockerfile has been validated locally:

```bash
# Build the image
docker build -t mystica-express-test .

# Run the container
docker run --rm -p 3001:3000 -e NODE_ENV=production mystica-express-test

# Test health endpoint
curl http://localhost:3001/api/v1/health
# Should return: {"success":true,"data":{"status":"healthy",...}}
```

## After Making Fixes

Commit and push changes. Railway will auto-deploy if you've configured webhooks.
