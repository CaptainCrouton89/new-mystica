# Investigation: F-01 Backend Patterns & Architecture

**Investigation ID:** f01-backend-patterns
**Date:** 2025-10-21
**Context:** Backend service layer patterns for implementing upgrade functionality and location-based features
**Scope:** Backend Only (Express/TypeScript, Supabase)

## Section 1: Route → Controller → Service Pattern

### File Structure Pattern
```
mystica-express/src/
├── routes/
│   ├── index.ts           # Route registry
│   ├── auth.ts            # Authentication routes
│   ├── profile.ts         # User profile routes
│   ├── inventory.ts       # Inventory management
│   ├── equipment.ts       # Equipment system
│   ├── materials.ts       # Material application
│   └── items.ts           # Item management
├── controllers/
│   ├── AuthController.ts
│   └── ProfileController.ts
└── services/
    ├── ProfileService.ts
    └── [Other services - all throw NotImplementedError]
```

### Route Pattern Example
**File:** `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/routes/profile.ts`
```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ProfileController } from '../controllers/ProfileController';

const router = Router();
const controller = new ProfileController();

// Initialize new player profile
router.post('/init', authenticate, controller.initProfile);

// Get player profile
router.get('/', authenticate, controller.getProfile);

export default router;
```

### Controller Pattern Example
**File:** `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/controllers/ProfileController.ts`
```typescript
export class ProfileController {
  initProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const profile = await profileService.initializeProfile(userId);

      res.status(201).json({
        success: true,
        profile
      });
    } catch (error) {
      next(error);
    }
  };
}
```

### Authentication Flow
**File:** `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/middleware/auth.ts`
- Uses Supabase JWT validation with `getClaims()` method
- Validates `Bearer <token>` authorization header
- Attaches `req.user = { id: claims.sub, email: claims.email }`
- Fast local verification with cached JWKS (5-15ms vs 100-500ms with getUser)
- Supports both required (`authenticate`) and optional (`optionalAuthenticate`) auth

### Error Handling Pattern
All controllers use try/catch with `next(error)` to pass errors to the global error handler middleware.

## Section 2: Supabase Query Patterns

### Supabase Client Configuration
**File:** `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/config/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
    global: { headers: { 'X-Client-Info': 'new-mystica-express' } }
  }
);
```

### Query Pattern (Example from config)
```typescript
const { data, error } = await supabase
  .from('users')
  .select('count')
  .limit(1)
  .single();

if (error && error.code !== 'PGRST116') {
  throw error;
}
```

### Current Service Implementation Status
**⚠️ CRITICAL:** All services currently throw `NotImplementedError`:
```typescript
// From ProfileService.ts:13-23
async initializeProfile(userId: string): Promise<UserProfile> {
  throw new NotImplementedError('ProfileService.initializeProfile not implemented');
}
```

### PostGIS/Geospatial Queries
**Finding:** No PostGIS extensions or spatial queries found in current migration file. The Locations table uses basic `DECIMAL` lat/lng columns, not PostGIS geometry types.

## Section 3: Locations Table Schema

### Table Definition
**File:** `/Users/silasrhyneer/Code/new-mystica/mystica-express/migrations/001_initial_schema.sql`
```sql
CREATE TABLE Locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR,
    lat DECIMAL NOT NULL,
    lng DECIMAL NOT NULL,
    location_type VARCHAR,
    state_code VARCHAR,
    country_code VARCHAR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_locations_lat_lng ON Locations(lat, lng);
CREATE INDEX idx_locations_location_type ON Locations(location_type);
```

### Key Observations
- **No PostGIS:** Uses basic `DECIMAL` coordinates, not PostGIS `geometry` types
- **Indexes:** Compound index on `(lat, lng)` for proximity queries
- **Location filtering:** Indexed `location_type` for pool union system
- **UUID primary key:** Standard pattern across all tables
- **Migration status:** Schema exists but **NOT YET APPLIED** to database

### Distance Calculation
Without PostGIS, distance calculations will need to use:
- Haversine formula for spherical distance
- Raw SQL calculation or application-level filtering
- Consider adding PostGIS extension for `ST_DWithin()` queries

## Section 4: Validation Schema Pattern

### Query Parameter Validation
**File:** `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/types/schemas.ts:61-65**
```typescript
export const LocationQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  lng: z.coerce.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  radius: z.coerce.number().int().min(100).max(50000).default(5000)
});
```

### Validation Middleware Usage
**File:** `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/middleware/validate.ts`
```typescript
// Usage in routes:
import { validate, validateQuery } from '../middleware/validate';
import { LocationQuerySchema } from '../types/schemas';

router.get('/nearby',
  authenticate,
  validateQuery(LocationQuerySchema),
  locationController.getNearbyLocations
);
```

### Validation Features
- **Type coercion:** `z.coerce.number()` converts string query params to numbers
- **Error formatting:** Structured error responses with field paths and messages
- **Multiple validation:** Supports body, query, and params validation simultaneously
- **Request enhancement:** Validated data attached to `req.query`, `req.body`, `req.params`

## Section 5: Implementation Recommendations

### File Structure for F-01 Implementation
```
1. Create route: /Users/silasrhyneer/Code/new-mystica/mystica-express/src/routes/locations.ts
2. Create controller: /Users/silasrhyneer/Code/new-mystica/mystica-express/src/controllers/LocationController.ts
3. Create service: /Users/silasrhyneer/Code/new-mystica/mystica-express/src/services/LocationService.ts
4. Register in: /Users/silasrhyneer/Code/new-mystica/mystica-express/src/routes/index.ts
```

### Route Implementation Pattern
```typescript
// routes/locations.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateQuery } from '../middleware/validate';
import { LocationQuerySchema } from '../types/schemas';
import { LocationController } from '../controllers/LocationController';

const router = Router();
const controller = new LocationController();

router.get('/nearby',
  authenticate,
  validateQuery(LocationQuerySchema),
  controller.getNearbyLocations
);

export default router;
```

### Controller Implementation Pattern
```typescript
// controllers/LocationController.ts
export class LocationController {
  getNearbyLocations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { lat, lng, radius } = req.query as LocationQuery;

      const locations = await locationService.findNearbyLocations(lat, lng, radius, userId);

      res.json({ locations });
    } catch (error) {
      next(error);
    }
  };
}
```

### Service Implementation Pattern
```typescript
// services/LocationService.ts
import { supabase } from '../config/supabase';

export class LocationService {
  async findNearbyLocations(lat: number, lng: number, radius: number, userId: string) {
    // Haversine distance calculation in SQL (without PostGIS)
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .gte('lat', lat - (radius / 111000)) // Rough degree conversion
      .lte('lat', lat + (radius / 111000))
      .gte('lng', lng - (radius / (111000 * Math.cos(lat * Math.PI / 180))))
      .lte('lng', lng + (radius / (111000 * Math.cos(lat * Math.PI / 180))));

    if (error) throw error;
    return data;
  }
}
```

### MVP0 Constraints & Considerations

#### Critical MVP0 Simplifications
- **30 hardcoded SF locations:** Stored in database, not generated dynamically
- **No cooldowns:** Unlimited re-battles at same location
- **Instant generation:** No location cooldowns or restrictions
- **GPS non-blocking:** Location permission optional for MVP0
- **100% drop rates:** Always material + item + gold
- **Sync image generation:** 20s blocking when materials applied

#### Implementation Priority
1. **Apply migration:** `001_initial_schema.sql` must be applied to database first
2. **Seed locations:** Insert 30 SF locations into Locations table
3. **Implement service:** Replace `NotImplementedError` in LocationService
4. **Distance calculation:** Implement Haversine formula for proximity
5. **Test validation:** Ensure lat/lng/radius validation works correctly

#### Gotchas from CLAUDE.md
- **Dual codebase:** Never edit legacy `app.js` - only work in `src/` TypeScript files
- **Service skeleton:** All services currently throw `NotImplementedError`
- **Migration not applied:** Database schema exists but not yet in Supabase
- **Auth middleware:** Uses service role key for DB access, anon key for JWT validation
- **Type extensions:** Import from `express.d.ts`, don't redeclare `req.user`

## Section 6: Service Layer Implementation Patterns

### Service Class Structure Pattern
All services follow consistent patterns for class declaration and method organization:

```typescript
import { ReturnType } from '../types/api.types';
import { NotImplementedError } from '../utils/errors';

export class ServiceName {
  /**
   * Method description with bullet points
   * - Explains functionality and behavior
   * - Includes implementation details
   */
  async methodName(userId: string, ...params): Promise<ReturnType> {
    // TODO: Implement workflow
    // 1. Numbered step-by-step implementation plan
    // 2. Validation and ownership checks
    // 3. Business logic and calculations
    // 4. Database operations and updates
    // 5. Error handling and return formatting
    throw new NotImplementedError('ServiceName.methodName not implemented');
  }
}

export const serviceName = new ServiceName(); // Singleton instance
```

### Item Service Upgrade Patterns
**File:** `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/services/ItemService.ts`

#### Key Methods for Upgrade Functionality:

1. **getUpgradeCost()** - Cost calculation pattern:
   ```typescript
   // Calculate upgrade cost: base_cost × (level^1.5)
   // Get user's current gold
   // Return cost info with affordability check
   ```

2. **upgradeItem()** - Mutation workflow pattern:
   ```typescript
   // 1. Validate user owns item
   // 2. Calculate upgrade cost: base_cost × (level^1.5)
   // 3. Check user has sufficient gold
   // 4. Deduct gold from user profile
   // 5. Increment item level by 1
   // 6. Compute stat increase (base_stats difference at new level)
   // 7. Update Items table
   // 8. Trigger will auto-update user avg_item_level
   // 9. Return upgrade result with costs and stat gains
   ```

### Stats Service Calculation Patterns
**File:** `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/services/StatsService.ts`

#### Stat Computation Formula:
```typescript
computeItemStats(baseStats: Stats, level: number, materials: AppliedMaterial[]): Stats {
  // 1. Scale base stats by level: base_stats × level
  // 2. For each material:
  //    - Apply style-specific modifiers based on style_id
  //    - Add to running total
  // 3. Combine: scaled_base + material_totals
  // 4. Return final Stats object
}
```

### Error Handling Patterns
**File:** `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/utils/errors.ts`

#### Structured Error Hierarchy:
- `NotImplementedError` (501) - For placeholder methods
- `ValidationError` (400) - Invalid parameters/request data
- `NotFoundError` (404) - Missing resources or wrong ownership
- `BusinessLogicError` (422) - Game rule violations (insufficient gold)
- `DatabaseError` (500) - Supabase query failures
- `ConflictError` (409) - Resource already exists/constraint violations

#### Error Usage Patterns:
```typescript
// Resource not found
throw new NotFoundError('Item', itemId, { userId });

// Business rule violation
throw new BusinessLogicError('Insufficient gold for upgrade', {
  required: upgradeCost,
  available: userGold
});

// Supabase error mapping
if (error) {
  throw mapSupabaseError(error);
}
```

### API Response Type Patterns
**File:** `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/types/api.types.ts`

#### Structured Result Objects:
```typescript
interface UpgradeResult {
  success: boolean;
  updated_item: Item;
  gold_spent: number;
  new_level: number;
  stat_increase: Stats;
  message?: string;
}
```

#### Domain Model Types:
- `Item` - Player-owned item instances with level and stats
- `Stats` - Core stat structure (atkPower, atkAccuracy, defPower, defAccuracy)
- `UserProfile` - Player profile with gold, vanity_level, avg_item_level
- `AppliedMaterial` - Materials applied to items with stat modifiers

### Supabase Integration Patterns

#### Database Client Pattern:
```typescript
import { supabase } from '../config/supabase';

const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('user_id', userId);

if (error) {
  throw mapSupabaseError(error);
}
```

#### Transaction-like Operations:
Multiple sequential queries for complex operations like upgrades:
1. Validate item ownership
2. Check user gold balance
3. Update user profile (deduct gold)
4. Update item level
5. Database triggers handle derived fields (avg_item_level)

### Implementation Status Overview

#### Service Layer Status:
- **All services exist with detailed TODO comments**
- **All methods throw NotImplementedError currently**
- **Comprehensive JSDoc documentation for each method**
- **Well-defined method signatures and return types**

#### Ready-to-Implement Services:
- `ItemService` - getItemDetails, getUpgradeCost, upgradeItem
- `StatsService` - computeItemStats, computeTotalStats
- `ProfileService` - getProfile, initializeProfile
- `EquipmentService` - equipment management operations
- `InventoryService` - inventory retrieval and management

#### Missing for Upgrade Feature:
- VanityService (for updateVanityLevel functionality)
- Currency management (currently embedded in ProfileService)

### Implementation Recommendations

#### For Upgrade Functionality:
1. **Start with StatsService.computeItemStats()** - Pure function, no database dependencies
2. **Implement ItemService.getUpgradeCost()** - Read-only operation for cost calculation
3. **Add ProfileService.getProfile()** - User data retrieval for gold checks
4. **Implement ItemService.upgradeItem()** - Complex mutation with multiple database updates
5. **Add vanity level logic** - Either extend ProfileService or create VanityService

#### Key Patterns to Follow:
- Validate user ownership in all methods requiring userId + resourceId
- Use exponential cost scaling: `base_cost × (level^1.5)`
- Return comprehensive result objects with before/after state
- Leverage database triggers for derived field updates (avg_item_level)
- Use mapSupabaseError() for consistent error handling

### Next Steps
1. Apply database migration: `001_initial_schema.sql`
2. Implement StatsService.computeItemStats() (pure function)
3. Implement ItemService.getUpgradeCost() (read operations)
4. Implement ProfileService.getProfile() for user data
5. Implement ItemService.upgradeItem() (complex mutations)
6. Add vanity level upgrade logic
7. Seed 30 SF locations in Locations table
8. Implement LocationService with Haversine distance calculation
9. Create LocationController following established patterns
10. Add routes/locations.ts and register in routes/index.ts
11. Test with existing LocationQuerySchema validation