# LocationController Specification

## Controller Overview

**Purpose:** Handles geolocation-based location discovery and retrieval for the New Mystica game. Provides API endpoints for finding nearby spawn points and retrieving specific location details.

**Responsibility:** Acts as the HTTP layer orchestrator for location-related operations, validating requests, calling the LocationService for business logic, and returning structured JSON responses.

**Feature References:**
- **F-01 Geolocation & Map** - Primary feature for GPS-based location discovery
- **F-02 Combat System** - Location data feeds into combat encounter initialization

**Service Dependencies:**
- **LocationService** - COMPLETE implementation (lines 11-223 in LocationService.ts)
  - Handles geospatial queries using PostGIS
  - Manages location validation and retrieval
  - Provides combat pool operations for enemy/loot selection

## Route Configuration

**Base Path:** `/api/v1/locations` (configured in src/app.ts:58)

**Middleware Chain (applied to all routes):**
1. `authenticate` - JWT token validation via Supabase auth
2. `validate` - Zod schema validation for request parameters
3. Controller method execution
4. Global error handler (errorHandler.ts) for exception handling

## Endpoint Specifications

### GET /locations/nearby

**Purpose:** Find nearby locations within specified radius using PostGIS geospatial queries

**Route Definition:**
```typescript
// src/routes/locations.ts:17-22
router.get(
  '/nearby',
  authenticate,
  validate({ query: NearbyLocationsQuerySchema }),
  locationController.getNearby
);
```

**Handler Method:** `LocationController.getNearby` (LocationController.ts:14-26)

#### Input Schema

**Query Parameters** (validated by `NearbyLocationsQuerySchema`):
```typescript
// src/types/schemas.ts:61-65
{
  lat: z.coerce.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  lng: z.coerce.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  radius: z.coerce.number().int().min(1).max(50000).default(5000)  // meters
}
```

**Headers:**
- `Authorization: Bearer <jwt_token>` (required by authenticate middleware)

#### Business Logic Flow

1. **Request Validation:** Zod validates query parameters for proper coordinate ranges and radius limits
2. **Authentication:** JWT token validated, `req.user` populated by auth middleware
3. **Service Call:** `locationService.nearby(lat, lng, radius)` with validated parameters
4. **Service Validation:** LocationService performs additional coordinate/radius validation (LocationService.ts:18-27)
5. **Database Query:** PostGIS `get_nearby_locations` RPC function executes spatial query
6. **Response:** Returns locations array ordered by distance (closest first)

#### Service Method Calls

```typescript
// LocationController.ts:18
const locations = await locationService.nearby(lat, lng, radius);
```

**Service Implementation** (LocationService.ts:17-30):
- Validates coordinates (-90 to 90 lat, -180 to 180 lng)
- Validates radius (1 to 50000 meters)
- Calls `locationRepository.findNearby(lat, lng, radius)`
- Uses PostGIS ST_DWithin for efficient spatial calculations

#### Output Schema

**Success Response (200):**
```typescript
{
  locations: Array<{
    id: string,              // UUID
    name: string,            // Descriptive location name
    lat: number,             // Decimal latitude (6 decimal places)
    lng: number,             // Decimal longitude (6 decimal places)
    location_type: string,   // 'library', 'gym', 'park', 'coffee_shop', etc.
    state_code: string,      // US state code: 'CA', 'NY', 'TX', etc.
    country_code: string,    // ISO country code: 'USA', 'CAN', etc.
    spawn_radius: number,    // Activation radius in meters (default 50)
    is_premium: boolean,     // Premium location flag
    created_at: string,      // ISO timestamp
    distance_meters?: number // Distance from query point (if returned by PostGIS)
  }>
}
```

#### Error Responses

**400 - Validation Error:**
```typescript
{
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed: [specific validation message]',
    details: [
      {
        field: 'lat|lng|radius',
        message: 'Specific field error message',
        received: 'invalid_value'
      }
    ]
  }
}
```

**401 - Authentication Error:**
```typescript
{
  error: {
    code: 'AUTHENTICATION_ERROR',
    message: 'Authentication required'
  }
}
```

**500 - Database Error:**
```typescript
{
  error: {
    code: 'DATABASE_ERROR',
    message: 'Database operation failed: [specific error]'
  }
}
```

#### Related Documentation
- **API Contract:** docs/api-contracts.yaml:879-912
- **Feature Spec:** docs/feature-specs/F-01-geolocation-map.yaml:36-43
- **Data Schema:** docs/data-plan.yaml:657-667

---

### GET /locations/:id

**Purpose:** Get specific location by ID with complete location details

**Route Definition:**
```typescript
// src/routes/locations.ts:25-30
router.get(
  '/:id',
  authenticate,
  validate({ params: LocationParamsSchema }),
  locationController.getById
);
```

**Handler Method:** `LocationController.getById` (LocationController.ts:32-42)

#### Input Schema

**Path Parameters** (validated by `LocationParamsSchema`):
```typescript
// src/types/schemas.ts:67-69
{
  id: z.string().uuid('Invalid location ID format')
}
```

**Headers:**
- `Authorization: Bearer <jwt_token>` (required by authenticate middleware)

#### Business Logic Flow

1. **Request Validation:** Zod validates `id` parameter as valid UUID format
2. **Authentication:** JWT token validated, `req.user` populated by auth middleware
3. **Service Call:** `locationService.getById(id)` with validated UUID
4. **Service Logic:** LocationService queries database for location by ID
5. **Not Found Check:** Service throws `NotFoundError` if location doesn't exist (LocationService.ts:40-42)
6. **Response:** Returns complete location object

#### Service Method Calls

```typescript
// LocationController.ts:36
const location = await locationService.getById(id);
```

**Service Implementation** (LocationService.ts:37-45):
- Calls `locationRepository.findById(id)`
- Throws `NotFoundError('Location', id)` if not found
- Returns complete location data if found

#### Output Schema

**Success Response (200):**
```typescript
{
  id: string,              // UUID
  name: string,            // Descriptive location name
  lat: number,             // Decimal latitude (6 decimal places)
  lng: number,             // Decimal longitude (6 decimal places)
  location_type: string,   // 'library', 'gym', 'park', 'coffee_shop', etc.
  state_code: string,      // US state code: 'CA', 'NY', 'TX', etc.
  country_code: string,    // ISO country code: 'USA', 'CAN', etc.
  spawn_radius: number,    // Activation radius in meters (default 50)
  is_premium: boolean,     // Premium location flag
  created_at: string       // ISO timestamp
}
```

#### Error Responses

**400 - Validation Error:**
```typescript
{
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed: Invalid location ID format',
    details: [
      {
        field: 'id',
        message: 'Invalid UUID format',
        received: 'invalid_uuid_string'
      }
    ]
  }
}
```

**401 - Authentication Error:**
```typescript
{
  error: {
    code: 'AUTHENTICATION_ERROR',
    message: 'Authentication required'
  }
}
```

**404 - Not Found Error:**
```typescript
{
  error: {
    code: 'NOT_FOUND',
    message: 'Location with identifier \'{id}\' not found'
  }
}
```

**500 - Database Error:**
```typescript
{
  error: {
    code: 'DATABASE_ERROR',
    message: 'Database operation failed: [specific error]'
  }
}
```

#### Related Documentation
- **API Contract:** docs/api-contracts.yaml:913-933
- **Feature Spec:** docs/feature-specs/F-01-geolocation-map.yaml:53-58
- **Error Classes:** src/utils/errors.ts:112-123 (NotFoundError)

---

## Additional Service Methods (Not Currently Exposed)

The LocationService provides additional methods that could be exposed as endpoints in future iterations:

### Combat Pool Operations
- `getMatchingEnemyPools(locationId, combatLevel)` - Get enemy pools for combat
- `getEnemyPoolMembers(poolIds)` - Get enemies with spawn weights
- `selectRandomEnemy(poolMembers)` - Weighted enemy selection
- `getMatchingLootPools(locationId, combatLevel)` - Get loot pools for rewards
- `getLootPoolEntries(poolIds)` - Get loot items with drop weights
- `selectRandomLoot(poolEntries, tierWeights, enemyStyleId, dropCount)` - Weighted loot selection

### Location Filtering
- `getByType(locationType)` - Filter locations by type
- `getByRegion(stateCode, countryCode)` - Filter by geographic region
- `getAll(limit?, offset?)` - Paginated location listing

### Optimized Aggregation (Future RPC Functions)
- `getAggregatedEnemyPools(locationId, combatLevel)` - Server-side pool aggregation
- `getAggregatedLootPools(locationId, combatLevel)` - Server-side loot weight calculation

---

## Implementation Notes

### PostGIS Integration
- Uses PostGIS 3.3.7 for accurate geospatial calculations
- `get_nearby_locations` RPC function with ST_DWithin for spatial queries
- Results ordered by distance (closest first) for optimal UX

### MVP0 Simplifications
- 30 hardcoded SF locations for testing (seeded via migrations/seed_sf_locations.sql)
- No cooldowns - unlimited re-battles at same location
- GPS permission non-blocking in MVP0

### PostGIS Optimization
- PostGIS spatial indexing on (lat, lng) for efficient queries
- Location_type indexing for type-based filtering
- Default 5000m radius limit prevents excessive result sets
- Maximum 50000m radius prevents database overload

### Error Handling Philosophy
- **Fail fast:** Validation errors caught at request boundary
- **Structured responses:** All errors follow consistent AppError.toJSON() format
- **Specific error codes:** Each error type has distinct code for client handling
- **Detailed validation:** Zod provides field-level validation feedback

### Authentication Requirements
- All endpoints require valid JWT token
- User context available via `req.user` (populated by auth middleware)
- Future: User-scoped location access controls can be added to service layer

## Integration Testing Coverage

LocationController is covered by integration tests in:
- `tests/integration/locations.test.ts` - 17 test cases covering both endpoints
- Tests cover authentication, validation, successful responses, and error cases
- PostGIS spatial query functionality validated against seeded SF location data

## Cross-References

### Dependencies
**Controllers this controller depends on:**
- **AuthController** (requires authenticated users via auth middleware)

**Services used:**
- LocationService (proximity queries, pool operations)
- CombatRepository (indirect via LocationService)

### Dependents
**Controllers that use this controller:**
- **CombatController** (calls LocationService for combat spawn points)
- **QuestController** (future - location-based quest triggers)

### Related Features
- **F-01 Geolocation & Map** - Primary feature spec
- **F-02 Combat System** - Location data feeds combat encounters
- **System Design** - PostGIS architecture section

### Data Models
- Locations table (docs/data-plan.yaml:657-667)
- EnemyPools, LootPools (for combat integration)

### Integration Notes
- **Foundation Role**: LocationController provides the geographic context for all location-based gameplay
- **Combat Integration**: Supplies enemy spawn data and loot tables to CombatController
- **PostGIS Architecture**: Uses optimized RPC functions for spatial queries
- **MVP0 Constraints**: Currently limited to 30 SF locations for testing