# Backend Development Reference

## Migration Status - DUAL CODEBASE ACTIVE

**IMPORTANT:** Backend is mid-migration from CommonJS (app.js) to TypeScript (src/app.ts). Both exist:

- **Legacy:** `app.js` + `routes/*.js` + `bin/www` (CommonJS, Jade views, minimal routes)
- **New:** `src/app.ts` + `src/routes/*.ts` + TypeScript service layer (34 files)
- **Entry point:** `pnpm start` runs `dist/server.js` (compiled from src/)
- **Service layer status:** MOST services throw `NotImplementedError` - **EXCEPTIONS:** LocationService (full implementation), AuthController (complete)
- **Auth middleware placeholder:** Uses `null as unknown as SupabaseClient` (src/middleware/auth.ts:44, 104)
- **Error classes duplicated:** errorHandler.ts:19-66 has inline class definitions marked "TODO: Move to utils/errors.ts"
- **NEVER edit legacy routes** - all new work goes in `src/` TypeScript files

## Architecture Patterns

### Request Lifecycle
```
Incoming Request
  → CORS middleware (app.ts:25)
  → Body parsing (app.ts:33-34)
  → JWT auth middleware (middleware/auth.ts) [adds req.user]
  → Zod validation middleware (middleware/validate.ts) [adds req.validated]
  → Route handler (routes/*.ts)
  → Controller (controllers/*.ts)
  → Service layer (services/*.ts)
  → Supabase query or AI service call
  ← Service response
  ← Controller JSON response
  ← Error handler (errorHandler.ts) if exception thrown
```

### Core Patterns
- **Zod validation enforced:** All request schemas in `src/types/schemas.ts`, used with validate middleware
- **Express type extensions:** `src/types/express.d.ts` adds `req.user`, `req.validated`, `req.context` properties
- **Service → Controller → Route pattern:** Services handle business logic, controllers orchestrate, routes define endpoints
- **API versioning:** All routes prefixed `/api/v1` in src/app.ts:58
- **Environment validation on startup:** src/config/env.ts uses Zod schema, throws detailed errors if missing vars
- **JWT auth via Supabase:** Auth middleware validates tokens with `supabase.auth.getUser(token)`, attaches req.user
- **R2 client auto-tests connection:** src/config/r2.ts and supabase.ts test connections in development on module load
- **8 equipment slots hardcoded:** weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet (schemas.ts:11-13)

## TypeScript Module Resolution Quirk

- **tsconfig.json uses `module: "commonjs"`** but code imports with `.js` extensions (ESM pattern)
- **Jest moduleNameMapper** rewrites `.js` imports: `'^(\\.{1,2}/.*)\\.js$': '$1'` (jest.config.js:24)
- **This is intentional** - allows ESM-ready code to compile to CommonJS for Node.js compatibility
- **DO NOT remove .js extensions** from imports or Jest tests will break

## Development Server Behavior

- **pnpm dev kills port 3000 processes** before starting (package.json:6)
- Required because nodemon doesn't always clean up on crash/restart
- Uses `lsof -ti:3000 | xargs kill -9 2>/dev/null || true`
- **Implication:** Any process on port 3000 will be terminated when starting dev server

## Testing Configuration (Jest)

- **Preset:** ts-jest with custom tsconfig overrides (jest.config.js:8-13)
- **Test environment:** Node.js (NOT jsdom - no browser/DOM APIs available)
- **Module resolution:** Strips `.js` extensions via `moduleNameMapper: {'^(\\.{1,2}/.*)\\.js$': '$1'}`
- **Setup file:** `tests/setup.ts` runs before all tests (mocks Supabase client globally)
- **Coverage exclusions:** Type definitions (`*.d.ts`), `src/types/**`, `src/server.ts`
- **Timeout:** 10s default (jest.config.js:27) for integration tests with Supabase calls
- **Test patterns:** `**/__tests__/**/*.ts` and `**/?(*.)+(spec|test).ts`
- **Coverage output:** HTML + LCOV reports in `coverage/` directory

## File Organization

- `src/app.ts` - Main Express app (TypeScript, replaces legacy app.js)
- `src/routes/` - API route definitions (profile, inventory, equipment, materials, items)
- `src/controllers/` - Request handlers
- `src/services/` - Business logic (ALL throw NotImplementedError currently)
- `src/middleware/` - Auth, CORS, error handling, validation
- `src/config/` - env.ts, supabase.ts, r2.ts (validated on startup)
- `src/types/` - schemas.ts (Zod), express.d.ts (type extensions), api.types.ts
- `src/utils/` - errors.ts, logger.ts, hash.ts
- `dist/` - Compiled JS output (gitignored)
- **LEGACY:** `app.js`, `routes/*.js`, `bin/www`, `views/*.jade` (deprecated, do not edit)

## Common Pitfalls

- **Don't edit legacy app.js/routes/** - All new code in `src/` TypeScript files
- **Services are skeletons** - All throw NotImplementedError, need implementation
- **Auth middleware broken** - Uses `null as unknown as SupabaseClient`, fix before testing auth
- **Zod validation required** - ALL request bodies must have schema in schemas.ts
- **Type extensions needed** - Import types from express.d.ts, don't redeclare req.user
- **Don't remove .js imports** - Code uses ESM-style `.js` extensions even though compiling to CommonJS (Jest rewrites them)
- **Remote database only** - All development uses remote Supabase, no local database stack
