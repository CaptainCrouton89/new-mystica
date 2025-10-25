# Railway Deployment Configuration

The Railway app has all variables from @.env.local loaded (but NODE_ENV=production). The Railway app is connected to the monorepo git repo.

The node engine is 24 (well supported as of October 2025).

## Files

- **railway.json** - @/Users/silasrhyneer/Code/new-mystica/mystica-express/railway.json (sets build context to mystica-express/ directory)
- **Dockerfile** - @/Users/silasrhyneer/Code/new-mystica/Dockerfile - Production build with Node.js 24, pnpm 8.x, TypeScript compilation (assumes mystica-express/ build context)
- **railway.toml** - @/Users/silasrhyneer/Code/new-mystica/railway.toml - Deployment config (health checks, restart policy) - may not override UI
- **.dockerignore** - @/Users/silasrhyneer/Code/new-mystica/.dockerignore - Excludes unnecessary files from build context
- **External References**:
  - @/Users/silasrhyneer/Code/new-mystica/docs/external/railway-nixpacks.md
  - @/Users/silasrhyneer/Code/new-mystica/docs/external/railway-builder-config.md
  - @/Users/silasrhyneer/Code/new-mystica/docs/external/railway-dockerfile-monorepo.md

## Build Context

**IMPORTANT**: Railway prioritizes `railway.toml` over `railway.json`. The root-level `railway.toml` configures the build:
- `dockerfilePath = "mystica-express/Dockerfile"` tells Railway where to find the Dockerfile
- Build context is the monorepo root
- Dockerfile is in `mystica-express/` and copies files relative to that directory
  
## Local Validation

The Dockerfile has been validated locally:

```bash
# Build from mystica-express directory (simulating Railway's build context)
cd mystica-express
docker build -f ../Dockerfile -t mystica-express-test .

# Run requires environment variables (Railway provides these automatically)
docker run --rm -p 3001:3000 --env-file .env.local mystica-express-test

# Test health endpoint
curl http://localhost:3001/api/v1/health
# Should return: {"success":true,"data":{"status":"healthy",...}}
```

## Production

Production url is `https://mystica-express-production.up.railway.app`

## After Making Fixes

Commit and push changes. Railway will auto-deploy if you've configured webhooks.

## Editing This File

- Do not update this document unless the values contained within change. 
- Do not include "updates or bug fix" logs
- **Never edit this file**