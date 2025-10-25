# Railway Deployment Configuration

The Railway app has all variables from @.env.local loaded (but NODE_ENV=production). The Railway app is connected to the monorepo git repo.

The node engine is 24 (well supported as of October 2025).

## Configuration Fixed ✅

**Solution:** `mystica-express/railway.json` now specifies `"builder": "DOCKERFILE"`.

### Builder Selection Precedence (from Railway docs)

Railway chooses builders in this exact order:
1. **Dockerfile present** → Always uses Dockerfile (highest priority)
2. **railway.json `builder` field** → Overrides defaults (THIS IS WHAT WE USE)
3. Service dashboard settings → UI configuration
4. Railway default → Railpack/Nixpacks

### Why railway.json in mystica-express/ ?

Railway detects this as a monorepo and uses the service-specific `railway.json`. The root `railway.toml` is ignored when service-level config exists.

### Why Not Nixpacks?

- Railway's Nixpacks only supports Node.js 16, 18, 20, 22, 23 (no Node 24)
- Node.js 24 requires the Dockerfile approach with `node:24-slim` base image

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
