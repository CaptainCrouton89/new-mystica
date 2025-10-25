# Railway Dockerfile Monorepo LLM Reference

## Critical railway.json Configuration

### Dockerfile Builder Selection
```json
{
  "build": {
    "builder": "DOCKERFILE"  // Required: Forces Dockerfile builds over Nixpacks
  }
}
```

### Custom Dockerfile Path (Monorepo Key Feature)
```json
{
  "build": {
    "dockerfilePath": "path/to/custom/Dockerfile"  // Relative to repository root
  }
}
```

### Complete Monorepo Example
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "backend/Dockerfile",
    "buildCommand": "pnpm --filter backend build",
    "watchPatterns": ["backend/**", "shared/**"]
  }
}
```

## Environment Variable Alternative

**RAILWAY_DOCKERFILE_PATH**: Alternative to railway.json config
- Set as Railway service variable
- Examples:
  - `RAILWAY_DOCKERFILE_PATH=backend/Dockerfile`
  - `RAILWAY_DOCKERFILE_PATH=/build/Dockerfile`

## Monorepo Build Context Gotchas

**Build Context Always Repository Root**:
- Dockerfile runs from repository root, NOT service subdirectory
- Use relative paths from repo root in COPY/ADD commands
- Example for backend service:
  ```dockerfile
  COPY backend/package.json backend/pnpm-lock.yaml ./
  COPY backend/src ./src
  ```

**Watch Patterns for Selective Deployments**:
```json
{
  "build": {
    "watchPatterns": [
      "services/backend/**",    // Only deploy when backend changes
      "packages/shared/**"      // Include shared dependencies
    ]
  }
}
```

## Dockerfile ARG Variables

**Railway-Provided Build Args**:
```dockerfile
ARG RAILWAY_SERVICE_NAME
ARG RAILWAY_ENVIRONMENT_NAME
RUN echo "Building $RAILWAY_SERVICE_NAME for $RAILWAY_ENVIRONMENT_NAME"
```

## Cache Mount Constraints

**Service-Specific Cache IDs**:
```dockerfile
# Format: --mount=type=cache,id=s/<service-id>-<path>,target=<path>
RUN --mount=type=cache,id=s/backend-node_modules,target=/app/node_modules pnpm install
```

**Environment Variables NOT Supported in Cache Mount IDs**:
- Cannot use `$RAILWAY_SERVICE_NAME` in cache mount ID
- Must use literal service identifiers

## Common Monorepo Patterns

**Multi-Stage Build with Workspace**:
```dockerfile
FROM node:18 as base
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY services/backend ./services/backend

FROM base as backend
WORKDIR /app/services/backend
RUN pnpm install --frozen-lockfile
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

**Build Command for Workspace**:
```json
{
  "build": {
    "buildCommand": "pnpm --filter @myapp/backend build"
  }
}
```

## Root Directory vs railway.json Path

**Critical Distinction**:
- Root Directory (service setting): Changes build/deploy context
- railway.json path: Always absolute from repository root
- Example: Service root `/backend`, config file `/backend/railway.json`

## Version: Railway Platform 2024