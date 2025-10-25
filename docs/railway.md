# Railway Deployment Configuration

The Railway app has all variables from @.env.local loaded (but NODE_ENV=production). The Railway app is connected to the monorepo git repo.

The node engine is 24 (well supported as of October 2025).

## Files

- **Dockerfile** - Production build with Node.js 24, pnpm 8.x, TypeScript compilation
- **railway.toml** - Deployment config (health checks, restart policy) - may not override UI
- **.dockerignore** - Excludes unnecessary files from build context
- **docs** - /Users/silasrhyneer/Code/new-mystica/docs/external/railway-nixpacks.md, /Users/silasrhyneer/Code/new-mystica/docs/external/railway-builder-config.md
/Users/silasrhyneer/Code/new-mystica/docs/external/railway-dockerfile-monorepo.md
  
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

## Editing This File

- Do not update this document unless the values contained within change. 
- Do not include "updates or bug fix" logs