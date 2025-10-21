# ItemController Specification

## Controller Overview

### Purpose and Responsibility
The ItemController handles individual item operations including retrieving item details, upgrading items, and applying/managing materials on items. It serves as the primary interface for item-specific actions that are distinct from inventory management.

### Feature References
- **F-03**: Base Items & Equipment System - Item details, stat calculation
- **F-04**: Materials System - Material application, replacement, image generation
- **F-06**: Item Upgrade System - Level progression, gold costs

### Service Dependencies
- **ItemService**: Core item operations, stat calculations, upgrade logic
- **MaterialService**: Material inventory, application validation
- **ImageGenerationService**: Combo image creation (20s sync blocking)
- **EconomyService**: Gold transactions for upgrades and material replacement

### Middleware Chain
All endpoints use:
1. CORS middleware (`app.ts:25`)
2. Body parsing (`app.ts:33-34`)
3. JWT auth middleware (`middleware/auth.ts`) - adds `req.user`
4. Zod validation middleware (`middleware/validate.ts`) - adds `req.validated`
5. Error handler (`errorHandler.ts`)

---

## Endpoint Specifications

### 1. GET /items/:item_id - Get Item Details

**Route**: `GET /api/v1/items/:item_id`
**Handler**: `ItemController.getItem`
**Feature Reference**: F-03 Base Items & Equipment System

#### Input Schema
```typescript
// Route Parameters
ItemIdParamsSchema = z.object({
  item_id: z.string().uuid()
})

// Headers
Authorization: Bearer <jwt_token>
```

#### Output Schema
```typescript
// Success Response (200)
PlayerItem = {
  id: string;              // UUID
  user_id: string;         // UUID
  item_type_id: string;    // UUID
  level: number;           // Item level (default 1)
  is_styled: boolean;      // True if ANY material has style_id != 'normal'
  current_stats: {         // Computed stats cache
    atkPower: number;
    atkAccuracy: number;
    defPower: number;
    defAccuracy: number;
  };
  material_combo_hash?: string;      // Hash for image lookup
  generated_image_url?: string;      // R2 URL to combo image
  image_generation_status?: string;  // 'pending'|'generating'|'complete'|'failed'
  created_at: string;               // ISO timestamp
  // Joined data from ItemTypes
  item_type: {
    name: string;
    category: string;        // weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet
    base_stats_normalized: { // Base stats summing to 1.0
      atkPower: number;
      atkAccuracy: number;
      defPower: number;
      defAccuracy: number;
    };
    rarity: 'common'|'uncommon'|'rare'|'epic'|'legendary';
    description: string;
  };
  // Applied materials (from ItemMaterials → MaterialInstances)
  applied_materials: Array<{
    slot_index: number;      // 0-2
    material_id: string;
    style_id: string;
    name: string;
    stat_modifiers: {        // Material stat modifications
      atkPower: number;
      atkAccuracy: number;
      defPower: number;
      defAccuracy: number;
    };
  }>;
}
```

#### Error Responses

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Missing or invalid JWT token"
  }
}
```

**404 Not Found:**
```typescript
{
  error: {
    code: "ITEM_NOT_FOUND",
    message: "Item not found or not owned by player"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Database or service errors"
  }
}
```

#### Service Method Calls
```typescript
const item = await itemService.getItemDetails(userId, item_id);
```

#### Business Logic Flow
1. Extract `userId` from `req.user.id` (set by auth middleware)
2. Extract `item_id` from route parameters
3. Call `ItemService.getItemDetails()` with user/item validation
4. Service performs multi-table JOIN (Items + ItemTypes + ItemMaterials + MaterialInstances)
5. Compute final stats: `base_stats × rarity_multiplier × level + material_modifiers`
6. Return complete item object with computed stats and applied materials

---

### 2. GET /items/:item_id/upgrade-cost - Get Upgrade Cost

**Route**: `GET /api/v1/items/:item_id/upgrade-cost`
**Handler**: `ItemController.getUpgradeCost`
**Feature Reference**: F-06 Item Upgrade System

#### Input Schema
```typescript
// Route Parameters
ItemIdParamsSchema = z.object({
  item_id: z.string().uuid()
})

// Headers
Authorization: Bearer <jwt_token>
```

#### Output Schema
```typescript
// Success Response (200)
{
  current_level: number;    // Item's current level
  next_level: number;       // current_level + 1
  gold_cost: number;        // Cost to upgrade: base_cost × level_multiplier^(level-1)
  player_gold: number;      // Player's current gold balance
  can_afford: boolean;      // player_gold >= gold_cost
}
```

#### Error Responses

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Missing or invalid JWT token"
  }
}
```

**404 Not Found:**
```typescript
{
  error: {
    code: "ITEM_NOT_FOUND",
    message: "Item not found or not owned by player"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Database or service errors"
  }
}
```

#### Service Method Calls
```typescript
const costInfo = await itemService.getUpgradeCost(userId, item_id);
```

#### Business Logic Flow
1. Extract `userId` from `req.user.id`
2. Extract `item_id` from route parameters
3. Call `ItemService.getUpgradeCost()` for cost calculation
4. Service validates item ownership and calculates gold cost using exponential formula
5. Check player's current gold balance via `ProfileService`
6. Return cost information with affordability check

---

### 3. POST /items/:item_id/upgrade - Upgrade Item Level

**Route**: `POST /api/v1/items/:item_id/upgrade`
**Handler**: `ItemController.upgradeItem`
**Feature Reference**: F-06 Item Upgrade System

#### Input Schema
```typescript
// Route Parameters
ItemIdParamsSchema = z.object({
  item_id: z.string().uuid()
})

// Headers
Authorization: Bearer <jwt_token>

// Body: No request body required
```

#### Output Schema
```typescript
// Success Response (200)
{
  success: boolean;          // Always true on success
  item: PlayerItem;          // Updated item with new level and stats
  gold_spent: number;        // Amount of gold deducted
  new_level: number;         // Item's new level (current + 1)
  stat_increase: {           // Stat difference from upgrade
    atkPower: number;
    atkAccuracy: number;
    defPower: number;
    defAccuracy: number;
  };
  message: string;           // "Item upgraded to level {new_level}!"
}
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: "INSUFFICIENT_FUNDS",
    message: "Insufficient gold to afford upgrade"
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Missing or invalid JWT token"
  }
}
```

**404 Not Found:**
```typescript
{
  error: {
    code: "ITEM_NOT_FOUND",
    message: "Item not found or not owned by player"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Database or service errors"
  }
}
```

#### Service Method Calls
```typescript
const result = await itemService.upgradeItem(userId, item_id);
```

#### Business Logic Flow
1. Extract `userId` from `req.user.id`
2. Extract `item_id` from route parameters
3. Call `ItemService.upgradeItem()` for atomic upgrade transaction
4. Service validates ownership, calculates cost, checks gold balance
5. Atomic transaction: deduct gold, increment item level, recalculate stats
6. Update vanity level based on total item levels across all items
7. Return upgrade result with stat changes and new balances

---

## Material Application Endpoints

**Ownership Note**: Material application/removal endpoints live under ItemController (not MaterialController) because these operations primarily mutate **item state** (applied materials, combo hash, image URL, computed stats). MaterialController only handles read-only material queries. Business logic is delegated to MaterialService.

### 4. POST /items/:item_id/materials/apply - Apply Material to Item

**Route**: `POST /api/v1/items/:item_id/materials/apply`
**Handler**: `ItemController.applyMaterial` *(Missing from current implementation)*
**Feature Reference**: F-04 Materials System
**Service Delegation**: Uses `MaterialService.applyMaterial()` for business logic

#### Input Schema
```typescript
// Route Parameters
ItemIdParamsSchema = z.object({
  item_id: z.string().uuid()
})

// Headers
Authorization: Bearer <jwt_token>

// Request Body
ApplyMaterialSchema = z.object({
  material_id: z.string().min(1, 'Material ID is required'),
  style_id: z.string().uuid('Style ID must be a valid UUID').default('00000000-0000-0000-0000-000000000000'), // 'normal' style UUID
  slot_index: z.number().int().min(0).max(2, 'Slot index must be between 0 and 2')
})
```

#### Output Schema
```typescript
// Success Response (200)
{
  success: boolean;          // Always true on success
  item: PlayerItem;          // Updated item with applied material
  stats: {                   // Updated computed stats
    atkPower: number;
    atkAccuracy: number;
    defPower: number;
    defAccuracy: number;
  };
  image_url?: string;        // Generated image URL (null if still generating)
  is_first_craft: boolean;   // True if this combo never crafted before globally
  total_crafts: number;      // Total times this combo crafted across all users
}
```

#### Error Responses
- **400 Bad Request**:
  - Item already has 3 materials (max reached)
  - Material not owned or quantity = 0
  - Slot already occupied
- **401 Unauthorized**: Missing or invalid JWT token
- **404 Not Found**: Item not found or not owned by player, material not found
- **423 Locked**: Image generation in progress (20s), try again
- **500 Internal Server Error**: Database or service errors

#### Service Method Calls
```typescript
const result = await itemService.applyMaterial(userId, item_id, material_id, style_id, slot_index);
```

#### Business Logic Flow (F-04 Material Application Flow lines 1021-1035)
1. Validate item ownership and material availability in MaterialStacks
2. Check slot availability (max 3 materials, slot_index not occupied)
3. Atomic transaction:
   - Decrement MaterialStacks.quantity
   - Create MaterialInstance from stack material
   - Insert ItemMaterials junction record with slot_index
4. Compute combo_hash = deterministic hash(item_type_id + sorted material_ids + style_ids)
5. Check ItemImageCache for existing combo
6. **If cache miss**: 20s SYNC image generation, upload to R2, insert cache row with craft_count=1
7. **If cache hit**: increment craft_count
8. Set item.is_styled=true if ANY material.style_id != 'normal'
9. Recalculate item stats with material modifiers
10. Return updated item with image URL and craft statistics

---

### 5. POST /items/:item_id/materials/replace - Replace Material in Slot

**Route**: `POST /api/v1/items/:item_id/materials/replace`
**Handler**: `ItemController.replaceMaterial` *(Missing from current implementation)*
**Feature Reference**: F-04 Materials System
**Service Delegation**: Uses `MaterialService.replaceMaterial()` for business logic

#### Input Schema
```typescript
// Route Parameters
ItemIdParamsSchema = z.object({
  item_id: z.string().uuid()
})

// Headers
Authorization: Bearer <jwt_token>

// Request Body
ReplaceMaterialSchema = z.object({
  slot_index: z.number().int().min(0).max(2, 'Slot index must be between 0 and 2'),
  new_material_id: z.string().min(1, 'New material ID is required'),
  new_style_id: z.string().uuid('Style ID must be a valid UUID').default('00000000-0000-0000-0000-000000000000'), // 'normal' style UUID
  gold_cost: z.number().int().min(0, 'Gold cost must be non-negative')
})
```

#### Output Schema
```typescript
// Success Response (200)
{
  success: boolean;          // Always true on success
  item: PlayerItem;          // Updated item with replaced material
  stats: {                   // Updated computed stats
    atkPower: number;
    atkAccuracy: number;
    defPower: number;
    defAccuracy: number;
  };
  image_url?: string;        // Updated generated image URL
  gold_spent: number;        // Gold cost for replacement
  returned_material: {       // Material returned to inventory
    material_id: string;
    style_id: string;
  };
}
```

#### Error Responses
- **400 Bad Request**:
  - Insufficient gold to afford replacement
  - Slot empty (nothing to replace)
  - New material not available in inventory
  - Gold cost mismatch (client/server cost disagreement)
- **401 Unauthorized**: Missing or invalid JWT token
- **404 Not Found**: Item not found or not owned by player
- **500 Internal Server Error**: Database or service errors

#### Service Method Calls
```typescript
const result = await itemService.replaceMaterial(userId, item_id, slot_index, new_material_id, new_style_id, gold_cost);
```

#### Business Logic Flow
1. Validate item ownership and slot occupancy
2. Calculate replacement cost: `100 × item.level` (gold cost for material removal)
3. Validate gold_cost parameter matches server calculation
4. Check new material availability in MaterialStacks
5. Atomic transaction:
   - Deduct gold from player balance
   - Remove MaterialInstance from slot, delete ItemMaterials record
   - Return old material to MaterialStacks (increment quantity)
   - Decrement new material from MaterialStacks
   - Create new MaterialInstance and ItemMaterials record
6. Recalculate combo_hash with new material combination
7. Trigger image generation if new combo (same 20s sync process)
8. Recalculate item stats with new material modifiers
9. Return updated item with gold transaction details

---

## Additional Endpoints (Currently Implemented)

### GET /items/:item_id/history - Get Item History
**Handler**: `ItemController.getItemHistory`
Returns audit trail of item events for debugging/support.

### GET /items/:item_id/weapon-stats - Get Weapon Combat Stats
**Handler**: `ItemController.getWeaponStats`
Returns weapon-specific combat calculations (hit bands, accuracy adjustments).

### POST /items/:item_id/pet/personality - Assign Pet Personality
**Handler**: `ItemController.assignPetPersonality`
Assigns personality traits to pet items (F-11 Pet Personality System).

### POST /items/:item_id/pet/chatter - Add Pet Chatter
**Handler**: `ItemController.addPetChatter`
Adds chatter messages to pet items for personality system.

### GET /player/stats - Get Player Total Stats
**Handler**: `ItemController.getPlayerStats`
Returns aggregated stats from all 8 equipped items.

---

## Implementation Notes

### Missing Endpoints
The current `ItemController.ts` implementation is missing the material management endpoints:
- `applyMaterial` method for POST `/items/:item_id/materials/apply`
- `replaceMaterial` method for POST `/items/:item_id/materials/replace`

These endpoints are documented in `api-contracts.yaml` (lines 1472-1603) but not implemented in the controller.

### Database Schema References
- **Items table**: Lines 452-466 in `data-plan.yaml`
- **ItemMaterials table**: Lines 562-574 in `data-plan.yaml`
- **MaterialStacks table**: Inventory system for materials
- **ItemImageCache table**: Global combo cache with craft counting

### Error Handling Patterns
All endpoints follow the standard error handling pattern:
1. Wrap logic in try-catch block
2. Call `next(error)` to delegate to error handler middleware
3. Error handler (`errorHandler.ts`) formats consistent error responses

### Validation Patterns
All endpoints use Zod schemas from `src/types/schemas.ts`:
- Route parameters validated automatically by middleware
- Request bodies validated with specific schemas (ApplyMaterialSchema, etc.)
- Validation errors return 400 with detailed field-level messages

### Authentication Requirements
All endpoints require JWT authentication:
- `Authorization: Bearer <token>` header required
- Auth middleware validates token with Supabase and sets `req.user`
- 401 error returned for missing/invalid tokens

### Service Integration
ItemController delegates business logic to service layer:
- **ItemService**: Core item operations, stat calculations
- **MaterialService**: Material inventory management
- **ImageGenerationService**: 20s blocking image generation
- **EconomyService**: Gold transactions and affordability checks
- **ProfileService**: Player profile and currency balance management

## Cross-References

### Dependencies
**Controllers this controller depends on:**
- **AuthController** (requires authenticated users via auth middleware)

**Services used:**
- ItemService (core item operations, stat calculations, upgrade logic)
- MaterialService (material inventory, application validation)
- ImageGenerationService (combo image creation - 20s sync blocking)
- EconomyService (gold transactions for upgrades and material replacement)

### Dependents
**Controllers that use this controller:**
- **MaterialController** (may delegate to ItemController for material application - TBD)

### Related Features
- **F-03 Base Items & Equipment System** - Item details, stat calculation
- **F-04 Materials System** - Material application, replacement, image generation
- **F-06 Item Upgrade System** - Level progression, gold costs
- **F-11 Pet Personality System** - Pet item personality assignment

### Data Models
- PlayerItems table (docs/data-plan.yaml:203-221)
- ItemMaterials table (docs/data-plan.yaml:562-574)
- MaterialStacks table (inventory system for materials)
- ItemImageCache table (global combo cache with craft counting)

### Integration Notes
- **Material Application Ownership**: ItemController owns material application/removal endpoints (not MaterialController) because these operations primarily mutate item state
- **20s Blocking Generation**: Image generation is synchronous in MVP0 - design UI with loading states
- **Cross-Controller Delegation**: Material business logic delegated to MaterialService while maintaining item resource ownership
- **Economy Integration**: All currency operations for upgrades and material costs go through EconomyService