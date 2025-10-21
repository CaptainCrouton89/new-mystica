# MaterialController Specification

**Template**: `~/.claude/file-templates/init-project/controller-spec/controller-title.md`
**Controller**: `MaterialController`
**File Path**: `mystica-express/src/controllers/MaterialController.ts`
**Last Updated**: 2025-01-27

## Controller Overview

### Purpose and Responsibility
The MaterialController manages the materials system, handling both the global material library access and player-specific material inventory operations. It provides endpoints for discovering available materials and managing personal material stacks that can be applied to items.

### Feature References
- **F-04 Materials System** - Core material application, inventory stacking, and image generation
- **F-05 Material Drop System** - Materials awarded from combat feed into inventory stacks

### Service Dependencies
- **MaterialService** (`src/services/MaterialService.ts`) - Core business logic for material operations
- **MaterialRepository** (`src/repositories/MaterialRepository.js`) - Database access layer
- **ImageGenerationService** (`src/services/ImageGenerationService.js`) - 20s sync image generation for material combos
- **ImageCacheRepository** (`src/repositories/ImageCacheRepository.js`) - Global combo image caching

## Endpoint Specifications

### 1. GET /materials

**Purpose**: Get all material templates (seed data library)
**Route Handler**: `getMaterials`
**Authentication**: None required (public library endpoint)

#### Request Schema
```typescript
// No request body, query params, or auth headers required
```

#### Response Schema
```typescript
{
  materials: Material[],     // Array of all material templates
  total_count: number       // Count of materials in library
}

interface Material {
  id: string;               // Material ID (e.g., 'coffee', 'diamond')
  name: string;             // Display name (e.g., 'Coffee', 'Diamond')
  description?: string;     // Material description text
  stat_modifiers: {         // Zero-sum stat modifications
    atkPower: number;       // Attack power modifier (-1.0 to +1.0)
    atkAccuracy: number;    // Attack accuracy modifier (-1.0 to +1.0)
    defPower: number;       // Defense power modifier (-1.0 to +1.0)
    defAccuracy: number;    // Defense accuracy modifier (-1.0 to +1.0)
  };
  theme: string;           // Material theme (defensive, offensive, balanced, precision, chaotic)
  image_url?: string;      // Optional material image URL
}
```

#### Service Method Call
```typescript
const materials = await materialService.getAllMaterials();
```

#### Middleware Chain
1. CORS middleware (global)
2. Body parsing (global)
3. Route handler (no auth or validation needed)

#### Business Logic Flow
1. MaterialService queries Materials seed data table
2. Returns complete material library ordered alphabetically by name
3. No user-specific filtering or authentication required
4. Used by clients to display available materials for application

#### Error Responses

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Database connection issues or service errors"
  }
}
```

#### References
- API Contract: `/docs/api-contracts.yaml` lines 1437-1452
- Feature Spec: `F-04-materials-system.yaml` lines 75-79
- Data Schema: `docs/data-plan.yaml` lines 526-534

---

### 2. GET /materials/inventory

**Purpose**: Get player's material stacks with quantities and styles
**Route Handler**: `getInventory`
**Authentication**: Required (Bearer token)

#### Request Schema
```typescript
// Headers
Authorization: "Bearer <jwt_token>"

// No body or query parameters
```

#### Response Schema
```typescript
{
  materials: MaterialStack[],    // Array of player's material stacks
  total_stacks: number,         // Number of different material stacks
  total_quantity: number        // Sum of all material quantities
}

interface MaterialStack {
  id: string;                   // Composite key: "${user_id}:${material_id}:${style_id}"
  user_id: string;              // UUID of owning player
  material_id: string;          // UUID of material type
  style_id: string;             // UUID of style (default: normal style UUID)
  quantity: number;             // Available quantity for application (>=0)
  material: {                   // Embedded material template data
    id: string;
    name: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic';
    stat_modifiers: StatModifiers;
    theme: string;
    image_url?: string;
    description?: string;
  };
}
```

#### Service Method Call
```typescript
const userId = req.user!.id;
const materials = await materialService.getMaterialInventory(userId);
```

#### Middleware Chain
1. CORS middleware (global)
2. Body parsing (global)
3. JWT auth middleware (validates token, sets `req.user`)
4. Route handler

#### Business Logic Flow
1. Extract user ID from authenticated JWT token (`req.user.id`)
2. MaterialService queries MaterialStacks table for user's materials
3. Joins with Materials table to get template data for each stack
4. Groups by material type and style (styled materials stack separately)
5. Returns stackable inventory data with quantities available for application
6. Used by clients to show available materials for item application

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
    message: "Database connection issues or service errors"
  }
}
```

#### References
- API Contract: `/docs/api-contracts.yaml` lines 1453-1470
- Feature Spec: `F-04-materials-system.yaml` lines 81-87
- Data Schema: `docs/data-plan.yaml` lines 549-560

---

## Material Application Endpoints

**Note**: Material application/removal operations that **mutate item state** are owned by **ItemController**, not MaterialController. This follows REST principles where operations on `/items/{item_id}/*` resources belong to the item controller.

### Material Application Operations (See ItemController)

The following endpoints are documented in **ItemController.md**:

- **POST /items/:item_id/materials/apply** - Apply material to item slot
- **POST /items/:item_id/materials/remove** - Remove material from item slot

**Rationale**: These operations primarily mutate **item resources** (applied materials, combo hash, image URL, computed stats) even though they consume materials from MaterialStacks. ItemController owns these endpoints and delegates business logic to MaterialService.

**MaterialController Responsibilities**:
- ✅ GET /materials - Read-only material library
- ✅ GET /materials/inventory - Read-only material stack queries
- ❌ Material application/removal - Delegated to ItemController

---

## Implementation Status

### Completed Components
- ✅ **Controller Structure**: MaterialController class with 4 handler methods (lines 14-113)
- ✅ **Request Validation**: Zod schemas for all endpoints in `schemas.ts`
- ✅ **Type Safety**: ApplyMaterialRequest and ReplaceMaterialRequest types exported
- ✅ **Error Handling**: Try-catch blocks with next(error) forwarding
- ✅ **Service Integration**: MaterialService dependency injection and method calls

### Missing Components
- ✅ **Route Registration**: Material endpoints now wired in `routes/index.ts` (materials routes registered)
- ❌ **Service Implementation**: MaterialService methods throw NotImplementedError (needs repository layer)
- ✅ **Material Library Endpoint**: GET /materials route now available through materials routes
- ❌ **Image Generation Integration**: 20s sync workflow needs ItemImageCache management

### Blocked Issues
1. ~~**MATERIAL_ROUTES_NOT_REGISTERED**: API endpoints not accessible without route registration~~ ✅ **RESOLVED**
2. **IMAGE_GENERATION_NOT_INTEGRATED**: Material application will fail on image generation step
3. ~~**MISSING_MATERIAL_LIBRARY_ENDPOINT**: Clients cannot fetch available materials~~ ✅ **RESOLVED**

### Database Schema Status
- ✅ **Materials Table**: Seed data with zero-sum stat modifiers
- ✅ **MaterialStacks Table**: Composite PK (user_id, material_id, style_id)
- ✅ **MaterialInstances Table**: Individual instances when applied
- ✅ **ItemMaterials Table**: Junction with slot_index and uniqueness constraints
- ✅ **ItemImageCache Table**: Global combo caching with craft_count

## Related Documentation
- **F-04 Materials System**: `/docs/feature-specs/F-04-materials-system.yaml`
- **F-05 Material Drop System**: `/docs/feature-specs/F-05-material-drop-system.yaml`
- **API Contracts**: `/docs/api-contracts.yaml` lines 1437-1470
- **Data Plan**: `/docs/data-plan.yaml` lines 526-560
- **Service Implementation**: `/mystica-express/src/services/MaterialService.ts`
- **Repository Layer**: `/mystica-express/src/repositories/MaterialRepository.js`

## Cross-References

### Dependencies
**Controllers this controller depends on:**
- **AuthController** (requires authenticated users for inventory endpoints)

**Services used:**
- MaterialService (core business logic for material operations)
- MaterialRepository (database access layer)
- ImageGenerationService (20s sync image generation for material combos)
- ImageCacheRepository (global combo image caching)

### Dependents
**Controllers that use this controller:**
- **ItemController** (delegates material application business logic to MaterialService)
- **CombatController** (indirectly - materials are dropped from combat via F-05)

### Related Features
- **F-04 Materials System** - Core material application, inventory stacking, and image generation
- **F-05 Material Drop System** - Materials awarded from combat feed into inventory stacks

### Data Models
- Materials table (docs/data-plan.yaml:526-534)
- MaterialStacks table (docs/data-plan.yaml:549-560)
- MaterialInstances table (individual instances when applied)
- ItemMaterials table (junction with slot_index and uniqueness constraints)
- ItemImageCache table (global combo caching with craft_count)

### Integration Notes
- **Read-Only Operations**: MaterialController only handles read-only material library and inventory queries
- **Material Application Delegation**: Application/removal operations owned by ItemController but delegate business logic to MaterialService
- **Image Generation Integration**: 20s sync workflow needs ItemImageCache management (currently blocked)
- **Cross-Controller Service Sharing**: MaterialService used by both MaterialController and ItemController