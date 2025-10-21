# RarityController Specification

## Controller Overview

**Purpose:** Provides read-only access to rarity definitions and their stat multipliers/drop rates for client applications.

**Responsibility:**
- Expose rarity system configuration data to frontend clients
- Support item display UI with rarity colors and names
- Provide multiplier values for client-side stat calculations

**Feature References:**
- **F-03:** Base Items & Equipment System - Rarity multipliers for item stats (1.0x-2.0x scaling)

**Service Dependencies:**
- **RarityService** (NEW - needs creation) - Simple data access service for RarityDefinitions table
- Alternative: Could be part of **ItemService** as `getRarityDefinitions()` method

**Database Dependencies:**
- `raritydefinitions` table (5 rows: common, uncommon, rare, epic, legendary)

---

## Endpoint Specifications

### GET /rarities

**Purpose:** Get all rarity definitions with stat multipliers, drop rates, and display metadata.

**Route Configuration:**
```typescript
// Route: src/routes/rarities.ts
router.get('/',
  authMiddleware,           // Requires valid JWT token
  rarityController.getRarities
);
```

**Handler Function:** `getRarities`

#### Request Schema

**Headers:**
```typescript
Authorization: "Bearer <jwt_token>"  // Required
```

**Params:** None

**Query Parameters:** None

**Body:** None (GET request)

#### Response Schema

**Success (200):**
```typescript
{
  success: true,
  rarities: [
    {
      rarity: "common" | "uncommon" | "rare" | "epic" | "legendary",
      stat_multiplier: number,      // 1.000 to 2.000 (3 decimal precision)
      base_drop_rate: number,       // 0.01000 to 0.60000 (5 decimal precision)
      display_name: string,         // "Common", "Uncommon", etc.
      color_hex: string,            // "#FFFFFF", "#1EFF00", etc.
      created_at: string           // ISO timestamp
    }
  ]
}
```

**Example Response:**
```json
{
  "success": true,
  "rarities": [
    {
      "rarity": "common",
      "stat_multiplier": 1.000,
      "base_drop_rate": 0.60000,
      "display_name": "Common",
      "color_hex": "#FFFFFF",
      "created_at": "2025-10-21T14:20:11.383Z"
    },
    {
      "rarity": "uncommon",
      "stat_multiplier": 1.250,
      "base_drop_rate": 0.25000,
      "display_name": "Uncommon",
      "color_hex": "#1EFF00",
      "created_at": "2025-10-21T14:20:11.383Z"
    },
    {
      "rarity": "rare",
      "stat_multiplier": 1.500,
      "base_drop_rate": 0.10000,
      "display_name": "Rare",
      "color_hex": "#0070DD",
      "created_at": "2025-10-21T14:20:11.383Z"
    },
    {
      "rarity": "epic",
      "stat_multiplier": 1.750,
      "base_drop_rate": 0.03000,
      "display_name": "Epic",
      "color_hex": "#A335EE",
      "created_at": "2025-10-21T14:20:11.383Z"
    },
    {
      "rarity": "legendary",
      "stat_multiplier": 2.000,
      "base_drop_rate": 0.01000,
      "display_name": "Legendary",
      "color_hex": "#FF8000",
      "created_at": "2025-10-21T14:20:11.383Z"
    }
  ]
}
```

#### Error Responses

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Invalid or missing JWT token"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to fetch rarity definitions"
  }
}
```

#### Service Method Calls

**Primary:** `rarityService.getAllRarities()`
- Returns: `Promise<RarityDefinition[]>`
- Throws: `DatabaseError` on query failure

**Alternative (if using ItemService):** `itemService.getRarityDefinitions()`

#### Middleware Chain

1. **CORS** (app-level)
2. **Body parsing** (app-level)
3. **authMiddleware** - Validates JWT, adds `req.user`
4. **Controller handler** - `rarityController.getRarities`
5. **Error handler** (app-level) - Catches thrown errors

#### Business Logic Flow

1. **Authentication:** Verify user has valid JWT token
2. **Database Query:** Fetch all rows from `raritydefinitions` table
3. **Data Transformation:** Convert database rows to API response format
4. **Response:** Return structured JSON with success flag and rarity array
5. **Error Handling:** Catch database errors, return 500 with error details

#### Validation Requirements

**Input Validation:** None required (no parameters)

**Output Validation:** Ensure all required fields are present in database response

#### Caching Considerations

**Recommended:** Add response caching (Redis/memory) with 24-hour TTL since rarity data is static seed data that rarely changes.

**Cache Key:** `rarities:all`

---

## Implementation Requirements

### Zod Schema Additions

**File:** `src/types/schemas.ts`

```typescript
// Rarity enum schema
export const RaritySchema = z.enum([
  'common', 'uncommon', 'rare', 'epic', 'legendary'
]);

// No request schemas needed for GET /rarities (no parameters)
```

### TypeScript Types

**File:** `src/types/api.types.ts`

```typescript
/**
 * Rarity definition from database
 */
export interface RarityDefinition {
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  stat_multiplier: number;
  base_drop_rate: number;
  display_name: string;
  color_hex: string;
  created_at: string;
}

/**
 * API response for GET /rarities
 */
export interface GetRaritiesResponse {
  success: true;
  rarities: RarityDefinition[];
}
```

### Service Layer (NEW)

**File:** `src/services/RarityService.ts`

```typescript
import { supabase } from '../config/supabase.js';
import type { RarityDefinition } from '../types/api.types.js';
import { DatabaseError } from '../utils/errors.js';

export class RarityService {
  /**
   * Get all rarity definitions ordered by stat multiplier
   */
  async getAllRarities(): Promise<RarityDefinition[]> {
    const { data, error } = await supabase
      .from('raritydefinitions')
      .select('*')
      .order('stat_multiplier', { ascending: true });

    if (error) {
      throw new DatabaseError('Failed to fetch rarity definitions', error);
    }

    return data || [];
  }
}

export const rarityService = new RarityService();
```

### Controller Implementation

**File:** `src/controllers/RarityController.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { rarityService } from '../services/RarityService.js';

/**
 * Rarity Controller
 * Handles rarity definition endpoints for item system configuration
 */
export class RarityController {
  /**
   * GET /rarities
   * Get all rarity definitions with stat multipliers and display metadata
   */
  getRarities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rarities = await rarityService.getAllRarities();

      res.json({
        success: true,
        rarities
      });
    } catch (error) {
      next(error);
    }
  };
}

export const rarityController = new RarityController();
```

### Route Registration

**File:** `src/routes/rarities.ts`

```typescript
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { rarityController } from '../controllers/RarityController.js';

const router = Router();

/**
 * GET /rarities
 * Get all rarity definitions
 */
router.get('/',
  authMiddleware,
  rarityController.getRarities
);

export default router;
```

**Update:** `src/routes/index.ts`

```typescript
// Add import
import rarityRoutes from './rarities';

// Add route registration
router.use('/rarities', rarityRoutes);
```

### Service Index Export

**Update:** `src/services/index.ts`

```typescript
// Add export
export { rarityService } from './RarityService.js';
```

---

## Testing Considerations

### Unit Tests

**File:** `tests/unit/services/RarityService.test.ts`
- Test `getAllRarities()` success case
- Test database error handling
- Mock Supabase client responses

**File:** `tests/unit/controllers/RarityController.test.ts`
- Test `getRarities` endpoint success
- Test error propagation to error handler
- Mock service layer responses

### Integration Tests

**File:** `tests/integration/rarities.test.ts`
- Test full GET /rarities endpoint with real database
- Verify response structure matches schema
- Test authentication requirements

### Test Data Requirements

Use existing `raritydefinitions` table data (5 rows already seeded).

---

## Documentation References

- **Feature Spec:** `docs/feature-specs/F-03-base-items-equipment.yaml` (lines 24-31, 95-106)
- **Database Schema:** `docs/data-plan.yaml` (lines 407-416)
- **API Contracts:** `docs/api-contracts.yaml` (needs update for new endpoint)
- **System Design:** `docs/system-design.yaml` (rarity system section)

---

## Notes

- **Read-only endpoint:** No mutations, only data retrieval
- **Static data:** Rarity definitions are seed data, unlikely to change frequently
- **No pagination needed:** Only 5 rarities total
- **Client usage:** Frontend can cache this data for item display colors and stat calculations
- **Future expansion:** Could add query parameters for filtering by rarity if needed
- **Performance:** Very lightweight endpoint, sub-10ms response time expected

## Cross-References

### Dependencies
**Controllers this controller depends on:**
- **AuthController** (requires authenticated users via auth middleware)

**Services used:**
- RarityService (NEW - rarity definition data retrieval)

### Dependents
**Controllers that use this controller:**
- None (leaf controller - provides static configuration data)

### Related Features
- **F-03 Base Items & Equipment System** - Rarity system for item stat multipliers and display

### Data Models
- RarityDefinitions table (docs/data-plan.yaml:407-416) - 5 hardcoded rarities with stat multipliers

### Integration Notes
- **Static Configuration**: Provides read-only access to hardcoded rarity definitions
- **Client Caching**: Frontend can cache this data for item display colors and stat calculations
- **No Mutations**: Read-only endpoint with no state changes
- **Item System Integration**: Rarity multipliers used throughout item stat calculations