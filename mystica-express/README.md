# Mystica Express Backend

TypeScript Express.js backend for the New Mystica location-based RPG game. Currently in migration from CommonJS to TypeScript.

## Migration Status - DUAL CODEBASE ACTIVE

**IMPORTANT:** Backend is mid-migration from CommonJS (app.js) to TypeScript (src/app.ts). Both exist:

- **Legacy:** `app.js` + `routes/*.js` + `bin/www` (CommonJS, Jade views, minimal routes)
- **New:** `src/app.ts` + `src/routes/*.ts` + TypeScript service layer (34 files)
- **Entry point:** `pnpm start` runs `dist/server.js` (compiled from src/)
- **NEVER edit legacy routes** - all new work goes in `src/` TypeScript files

## Quick Start

```bash
# Install dependencies
pnpm install

# Environment setup
cp .env.example .env.local
# Edit .env.local with your remote Supabase and R2 credentials

# Development server (hot reload)
pnpm dev

# Production build and start
pnpm build
pnpm start

# Tests
pnpm test
```

## Environment Variables

Required in `.env.local`:

```bash
# Supabase (CRITICAL - validated on startup)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=...                # For client auth
SUPABASE_SERVICE_ROLE_KEY=...        # Backend service role (bypasses RLS)

# Cloudflare R2 (CRITICAL for image generation)
CLOUDFLARE_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=mystica-assets        # Default, can override

# AI Services (CRITICAL for generation pipeline)
REPLICATE_API_TOKEN=...              # google/nano-banana, bytedance/seedream-4
OPENAI_API_KEY=...                   # GPT-4.1-mini for descriptions

# Server (optional overrides)
PORT=3000                            # Default 3000
NODE_ENV=development                 # development | production | test
LOG_LEVEL=debug                      # debug | info | warn | error
```

## API Endpoints

All endpoints are prefixed with `/api/v1` and require JWT authentication (except auth endpoints).

### Locations API (F-01) ✅ IMPLEMENTED

#### Get Nearby Locations

Get spawn locations within radius of player coordinates.

```bash
GET /api/v1/locations/nearby?lat={lat}&lng={lng}&radius={meters}
Authorization: Bearer {jwt_token}
```

**Parameters:**
- `lat` (required): Latitude as float
- `lng` (required): Longitude as float
- `radius` (optional): Search radius in meters (default: 5000)

**Response:**
```json
{
  "locations": [
    {
      "id": "uuid",
      "name": "Generated location name",
      "lat": 37.7749,
      "lng": -122.4194,
      "location_type": "library",
      "state_code": "CA",
      "country_code": "USA",
      "enemy_level": 10,
      "distance_meters": 1250
    }
  ]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/locations/nearby?lat=37.7749&lng=-122.4194&radius=5000"
```

#### Get Location Details

Get specific location by ID.

```bash
GET /api/v1/locations/{location_id}
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Generated location name",
  "lat": 37.7749,
  "lng": -122.4194,
  "location_type": "library",
  "state_code": "CA",
  "country_code": "USA",
  "enemy_level": 10,
  "spawn_radius": 50,
  "is_premium": false,
  "created_at": "2025-01-27T10:00:00Z"
}
```

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/locations/12345678-1234-1234-1234-123456789abc"
```

### Authentication API (F-07) ✅ IMPLEMENTED

Authentication endpoints for user registration, login, and session management.

#### Register New User

```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

#### Login

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

#### Get Current User

```bash
GET /api/v1/auth/me
Authorization: Bearer {jwt_token}
```

## Database

### PostGIS Integration

The locations system uses PostGIS for accurate geospatial calculations:

- **Extension:** PostGIS 3.3.7 enabled on Supabase
- **Distance calculation:** `ST_Distance()` with geography type for meter-accurate results
- **RPC function:** `get_nearby_locations()` for optimized proximity queries

### Seed Data

The database includes 30 pre-generated San Francisco locations for MVP testing.

### Database

All development uses the remote Supabase instance (kofvwxutsmxdszycvluc).

```bash
# Generate TypeScript types from remote database schema
pnpm supabase:types
```

Migrations have been applied to the remote database:
- `001_initial_schema.sql` - Full game schema with PostGIS
- `seed_sf_locations.sql` - 30 SF test locations
- `create_nearby_locations_function.sql` - Geospatial proximity RPC

## Architecture

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

### Backend Patterns

- **Zod validation enforced:** All request schemas in `src/types/schemas.ts`
- **Express type extensions:** `src/types/express.d.ts` adds `req.user`, `req.validated`, `req.context`
- **Service → Controller → Route pattern:** Services handle business logic, controllers orchestrate, routes define endpoints
- **API versioning:** All routes prefixed `/api/v1`
- **Environment validation:** Zod schema validation on startup, throws detailed errors if missing vars
- **JWT auth via Supabase:** Auth middleware validates tokens, attaches req.user

## Testing

### Running Tests

```bash
# All tests
pnpm test

# Specific test file
pnpm test tests/integration/locations.test.ts

# Test with coverage
pnpm test:coverage
```

### Test Coverage

- **Locations API:** 17 integration tests covering all endpoints and error cases
- **Authentication:** Comprehensive auth middleware and endpoint testing
- **Mock Setup:** Supabase client mocking for isolated testing

## Troubleshooting

### Common Issues

1. **Supabase Connection Failed**
   - Check `.env.local` has correct `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - Verify remote Supabase project is accessible (kofvwxutsmxdszycvluc)

2. **PostGIS Errors**
   - PostGIS extension is enabled on remote Supabase
   - All migrations have been applied to remote database

3. **Auth Middleware Errors**
   - Verify JWT token is included in Authorization header
   - Check token hasn't expired

4. **Missing Locations**
   - Database should have 30 SF locations from seed migration
   - Contact admin if locations are missing (don't reseed directly)

### Development Tips

- Use `pnpm dev` for hot reload during development
- Check logs at debug level: `LOG_LEVEL=debug pnpm dev`
- Test endpoints with provided curl examples
- Access Supabase Studio via remote project dashboard for database inspection

## Service Layer Status

**Note:** Most services currently throw `NotImplementedError` as placeholders. The following services are implemented:

- ✅ **LocationService** - Full geospatial query implementation
- ✅ **AuthController** - User authentication and session management
- ⚠️ **Other services** - Skeleton implementations with TODO markers

## Next Steps

1. **Frontend Integration:** SwiftUI MapView with Google Maps SDK
2. **Combat System:** Implement F-02 combat encounters
3. **Inventory System:** Complete F-03 item management
4. **Material System:** Implement F-04 crafting mechanics