# Railway Deployment Configuration

The Railway app has all variables from @.env.local loaded (but NODE_ENV=production). The Railway app is connected to the monorepo git repo.

The node engine is 24 (well supported as of October 2025).

## Configuration Files

- **railway.toml** - Root-level Railway configuration (TAKES PRECEDENCE over railway.json)
  - `builder = "DOCKERFILE"` - Use Dockerfile for builds
  - `dockerfilePath = "../Dockerfile"` - Path to root Dockerfile relative to rootDirectory
  - `rootDirectory = "mystica-express"` - Set build context to mystica-express/ subdirectory
- **Dockerfile** - Root-level Dockerfile optimized for mystica-express build context
  - Node.js 24-slim base image
  - pnpm 8.x (matches lockfile v6.0)
  - Copies package.json, pnpm-lock.yaml, tsconfig.json, and src/ from build context
  - Runs TypeScript compilation
- **.dockerignore** - Root-level file excludes unnecessary files
- **railway.json** - Located in mystica-express/ but overridden by railway.toml

## Build Context

Railway uses the monorepo root with `rootDirectory` set to `mystica-express`:
1. Railway starts at monorepo root
2. Reads `railway.toml` which sets `rootDirectory = "mystica-express"`
3. Changes context to `mystica-express/` directory
4. Finds `Dockerfile` at `../Dockerfile` (relative to rootDirectory)
5. Builds with `mystica-express/` as the build context
6. Dockerfile copies files using relative paths (`.` = mystica-express/)
  
## Local Validation

Test the exact Railway build configuration locally:

```bash
# Navigate to mystica-express directory (Railway's rootDirectory)
cd mystica-express

# Build using root Dockerfile with mystica-express as context
docker build -f ../Dockerfile -t mystica-express-test .

# Run with environment variables (Railway provides these via dashboard)
docker run --rm -p 3001:3000 --env-file .env.local mystica-express-test

# Test health endpoint
curl http://localhost:3001/api/v1/health
# Expected: {"success":true,"data":{"status":"healthy",...}}
```

This mirrors Railway's build process:
- Build context = `mystica-express/`
- Dockerfile = `../Dockerfile` (root)
- Files copied from `mystica-express/` directory

## Production

Production url is `https://mystica-express-production.up.railway.app`

## After Making Fixes

- commit and push
- run `railway redeploy -y` 

## Editing This File

- Do not update this document unless the values contained within change. 
- Do not include "updates or bug fix" logs
- **Never edit this file**