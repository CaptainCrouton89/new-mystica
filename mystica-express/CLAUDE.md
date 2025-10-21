# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start Commands

```bash
# Development
pnpm dev              # Hot reload with tsx + nodemon (kills port 3000 first)
pnpm build            # TypeScript compilation to dist/
pnpm start            # Production mode (runs dist/server.js)
pnpm lint             # ESLint on src/**/*.ts

# Testing
pnpm test             # All tests (Jest)
pnpm test:watch       # Watch mode for TDD
pnpm test:coverage    # Generate coverage report
pnpm test:unit        # Unit tests only
pnpm test:integration # Integration tests only

# Specific test file
pnpm test tests/integration/locations.test.ts

# Database types
pnpm supabase:types   # Generate src/types/database.types.ts from remote DB
```

## Critical Architecture Patterns

### TypeScript Module Resolution Quirk
- **tsconfig.json uses `module: "commonjs"`** but imports use `.js` extensions
- **Jest moduleNameMapper** rewrites `.js` → no extension: `'^(\\.{1,2}/.*)\\.js$': '$1'`
- **DO NOT remove .js extensions** - this is intentional for ESM-ready code compiled to CommonJS
- Breaking this will cause Jest tests to fail

### Express Request Lifecycle Pattern
```
Request
  → CORS (app.ts:25)
  → Body parsing (app.ts:33-34)
  → JWT auth middleware (adds req.user)
  → Zod validation middleware (adds req.validated)
  → Route handler (routes/*.ts)
  → Controller (controllers/*.ts)
  → Service layer (services/*.ts)
  → Supabase query
  ← Response
```

### Type Extension System
- **src/types/express.d.ts** extends Express.Request with:
  - `req.user` - Set by auth middleware (user_id, email, device_id, account_type)
  - `req.validated` - Reserved for Zod-validated data
  - `req.context` - Reserved for request metadata
- **Always import from express.d.ts**, never redeclare these types

### Validation Pattern (Zod Enforced)
- **All request schemas in src/types/schemas.ts**
- Routes use `validate(schema)` middleware before controller
- Controllers access validated data via `req.body`, `req.query`, `req.params`
- Example schemas: `EquipItemSchema`, `NearbyLocationsQuerySchema`, `ApplyMaterialSchema`

### Service → Controller → Route Pattern
- **Services** - Business logic, database operations, throw custom errors
- **Controllers** - Request/response handling, call services, return JSON
- **Routes** - URL definitions, auth middleware, validation middleware
- Example: `EquipmentService.equipItem()` → `EquipmentController.equipItem()` → `router.post('/equip', ...)`

### Equipment Slot System
- **8 hardcoded slots**: `weapon`, `offhand`, `head`, `armor`, `feet`, `accessory_1`, `accessory_2`, `pet`
- Defined in schemas.ts:11-13 as `EquipmentSlotSchema`
- UserEquipment table is source of truth for equipped state (NOT PlayerItem schema)

## Database Integration

### Remote Database Only
- **All development uses remote Supabase** (kofvwxutsmxdszycvluc)
- No local Supabase stack
- Migrations already applied: `001_initial_schema.sql` (38K comprehensive schema)
- PostGIS extension enabled for geospatial queries

### Type Generation
```bash
pnpm supabase:types
# Generates src/types/database.types.ts from linked remote schema
# Run after any remote schema changes
```

### PostGIS Integration
- `get_nearby_locations(lat, lng, radius)` RPC function for proximity queries
- 30 pre-seeded SF locations for MVP testing
- `ST_Distance()` geography calculations in LocationService

## Environment Variables

Required in `.env.local` (validated on startup via Zod):

```bash
# Supabase (CRITICAL)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Cloudflare R2 (for image generation)
CLOUDFLARE_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=mystica-assets

# AI Services
REPLICATE_API_TOKEN=...
OPENAI_API_KEY=...

# Server (optional)
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
```

Startup validation throws detailed errors if required vars missing (src/config/env.ts).

## Testing Configuration

### Jest Setup (jest.config.js)
- **Preset**: ts-jest with Node environment (NOT jsdom - no browser APIs)
- **Module resolution**: Strips `.js` extensions via moduleNameMapper
- **Global setup**: tests/setup.ts mocks Supabase client
- **Timeout**: 10s default for integration tests with Supabase calls
- **Coverage exclusions**: `*.d.ts`, `src/types/**`, `src/server.ts`

### Test Patterns
- **Unit tests**: Service layer logic, stat calculations, hash functions
- **Integration tests**: Full API endpoint flows with mocked Supabase
- Place unit tests in `tests/unit/`, integration in `tests/integration/`

## Common Development Patterns

### Adding New API Endpoint
1. Define Zod schema in `src/types/schemas.ts`
2. Create service method in `src/services/[Feature]Service.ts`
3. Create controller method in `src/controllers/[Feature]Controller.ts`
4. Add route in `src/routes/[feature].ts` with auth + validation middleware
5. Register route in `src/routes/index.ts`
6. Write integration test in `tests/integration/[feature].test.ts`

### Error Handling
- **Custom error classes** in `src/utils/errors.ts`:
  - `DatabaseError`, `ValidationError`, `AuthenticationError`, `NotFoundError`, etc.
- **Always throw errors early** - no fallbacks (pre-production)
- Global error handler in app.ts:80-94 catches and formats

### Authentication Patterns
- **Protected routes**: Use `authenticate` middleware from `src/middleware/auth.ts`
- **Token validation**: Uses Supabase `getClaims()` for fast local verification (5-15ms)
- **Anonymous auth**: Supports device-based users (`device_id` in req.user)
- Access user via `req.user.id` in controllers (guaranteed present after auth middleware)

## Code Quality Standards

- **NEVER use `any` type** - Look up proper types from database.types.ts or define new ones
- **It's okay to break code when refactoring** (pre-production)
- **ALWAYS throw errors early and often** - Do not use fallbacks
- **NO implicit nulls** - Use explicit optional types or throw NotFoundError

## Development Server Behavior

- **pnpm dev kills port 3000 processes** before starting (package.json:6)
- Uses `lsof -ti:3000 | xargs kill -9` automatically
- Required because nodemon doesn't always clean up on crash
- **Any process on port 3000 will be terminated** when starting dev server

## API Structure

### Versioning
- All routes prefixed `/api/v1`
- Defined in src/app.ts:62

### Implemented Features
- ✅ **Locations API** (F-01) - LocationService fully implemented with PostGIS
- ✅ **Authentication** (F-07) - AuthController complete with device + email support
- ⚠️ **Other services** - Most throw `NotImplementedError` as placeholders

### API Response Format
```typescript
// Success
{
  "data": { ... },
  "message": "Optional success message"
}

// Error
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": [...],  // Optional validation details
    "timestamp": "2025-10-21T05:27:00Z"
  }
}
```

## File Organization Principles

```
src/
├── config/         # Environment, Supabase, R2 client setup
├── middleware/     # Auth, CORS, error handling, validation
├── routes/         # URL definitions + middleware chains
├── controllers/    # Request/response handling
├── services/       # Business logic (most are stubs)
├── types/          # Schemas (Zod), type definitions, DB types
└── utils/          # Errors, logger, hash functions
```

## Common Gotchas

1. **Module resolution**: Don't remove `.js` from imports despite compiling to CommonJS
2. **Auth middleware**: Uses `getClaims()` not `getUser()` for performance (5-15ms vs 100-500ms)
3. **Equipment slots**: Hardcoded 8 slots, not configurable
4. **Database**: Remote only, no local stack
5. **Test environment**: Node only, no DOM APIs available
6. **Port 3000**: Auto-killed on dev server start

## Next Implementation Priorities

1. Complete remaining service implementations (MaterialService, ItemService, etc.)
2. Add combat system endpoints (F-02)
3. Implement material application with image generation (F-04)
4. Add rate limiting middleware
5. Set up Sentry error tracking
