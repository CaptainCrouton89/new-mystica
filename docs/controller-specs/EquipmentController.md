# EquipmentController Specification

## Controller Overview

### Purpose and Responsibility
The EquipmentController handles the 8-slot equipment system operations, managing equipped items across weapon, offhand, head, armor, feet, accessory_1, accessory_2, and pet slots. It provides endpoints for retrieving current equipment state, equipping items to appropriate slots, and unequipping items from specific slots.

### Feature References
- **Primary Feature**: F-03 Base Items & Equipment (8-slot equipment system)
- **Related Features**:
  - F-04 Materials & Crafting (materials applied to equipped items)
  - F-06 Upgrade System (item levels affect equipped stats)

### Service Dependencies
- **EquipmentService**: Core business logic for equipment operations, slot management, and stat calculations
- **StatsService**: Pure calculation service for item stats aggregation across all equipped items
- **Supabase Client**: Database access via repository pattern for UserEquipment, Items, and related tables

### Middleware Chain
All endpoints use the following middleware:
1. `authenticate` - JWT validation, attaches `req.user` (src/middleware/auth.ts)
2. `validate` - Zod schema validation, attaches `req.validated` (src/middleware/validate.ts)
3. Error handling via global error handler (src/middleware/errorHandler.ts)

---

## Endpoint Specifications

### GET /equipment - Get Equipped Items

**Route Definition**: `GET /api/v1/equipment`
**Handler Function**: `getEquipment`
**Source**: EquipmentController.ts:14-48

#### Input Schema
```typescript
// Headers (via authenticate middleware)
Authorization: "Bearer <jwt_token>" // Required

// No body or query parameters
```

#### Output Schema
```typescript
// Success Response (200)
{
  slots: {
    weapon?: PlayerItem,
    offhand?: PlayerItem,
    head?: PlayerItem,
    armor?: PlayerItem,
    feet?: PlayerItem,
    accessory_1?: PlayerItem,
    accessory_2?: PlayerItem,
    pet?: PlayerItem
  },
  total_stats: {
    atkPower: number,
    atkAccuracy: number,
    defPower: number,
    defAccuracy: number
  },
  equipment_count: number // Count of non-null slots
}

// PlayerItem Schema (from api-contracts.yaml:1129)
interface PlayerItem {
  id: string,
  item_type: ItemType,
  level: number,
  rarity: string,
  applied_materials: AppliedMaterial[],
  is_styled: boolean,
  computed_stats: Stats,
  is_equipped: boolean,
  generated_image_url?: string
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
    message: "Database connection issues or service layer errors"
  }
}
```

#### Service Method Calls
1. `equipmentService.getEquippedItems(userId)` - Retrieves equipped items and computed total stats
   - Internally calls `equipmentRepository.findEquippedByUser(userId)`
   - Internally calls `equipmentRepository.computeTotalStats(userId)`

#### Business Logic Flow
1. Extract `userId` from authenticated user (`req.user.id`)
2. Call EquipmentService to get equipped items across all 8 slots
3. Transform repository data to API response format
4. Calculate equipment count (non-null slots)
5. Return slots, total stats, and equipment count

#### Related Documentation
- Feature Spec: F-03-base-items-equipment.yaml:58-65
- API Contract: api-contracts.yaml:1111-1159
- Database Schema: data-plan.yaml:491-502 (UserEquipment table)

---

### POST /equipment/equip - Equip Item to Slot

**Route Definition**: `POST /api/v1/equipment/equip`
**Handler Function**: `equipItem`
**Source**: EquipmentController.ts:54-70

#### Input Schema
```typescript
// Headers
Authorization: "Bearer <jwt_token>" // Required

// Body (validated by EquipItemSchema - schemas.ts:16-18)
{
  item_id: string // UUID format, references Items.id
}
```

#### Zod Validation Schema
```typescript
export const EquipItemSchema = z.object({
  item_id: UUIDSchema // z.string().uuid('Invalid UUID format')
});
```

#### Output Schema
```typescript
// Success Response (200)
{
  success: boolean,
  equipped_item: PlayerItem, // The newly equipped item
  unequipped_item: PlayerItem | null, // Item that was replaced (if any)
  updated_player_stats: Stats // New total stats after equip
}
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid UUID format for item_id"
  }
}
```

**400 Bad Request:**
```typescript
{
  error: {
    code: "ITEM_ALREADY_EQUIPPED",
    message: "Item already equipped in another slot"
  }
}
```

**400 Bad Request:**
```typescript
{
  error: {
    code: "ITEM_NOT_OWNED",
    message: "Item not owned by user"
  }
}
```

**400 Bad Request:**
```typescript
{
  error: {
    code: "INCOMPATIBLE_ITEM_TYPE",
    message: "Item type incompatible with any equipment slot"
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Invalid or missing JWT token"
  }
}
```

**404 Not Found:**
```typescript
{
  error: {
    code: "ITEM_NOT_FOUND",
    message: "Item with specified item_id does not exist"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Database transaction failures"
  }
}
```

#### Service Method Calls
1. `equipmentService.equipItem(userId, item_id)` - Handles equip logic with slot auto-detection
   - Validates item ownership and type compatibility
   - Determines appropriate slot from item type
   - Handles slot replacement if occupied
   - Updates UserEquipment table
   - Recalculates total player stats

#### Business Logic Flow
1. Extract `userId` from authenticated user and `item_id` from validated request body
2. Call EquipmentService to perform equip operation
3. Service auto-detects appropriate slot based on item type
4. If slot occupied, unequips existing item
5. Equips new item to slot
6. Recalculates and returns updated player stats
7. Returns success status and affected items

#### Related Documentation
- Feature Spec: F-03-base-items-equipment.yaml:77-85
- API Contract: api-contracts.yaml:1160-1190
- Zod Schema: schemas.ts:16-18

---

### POST /equipment/unequip - Unequip Item from Slot

**Route Definition**: `POST /api/v1/equipment/unequip`
**Handler Function**: `unequipItem`
**Source**: EquipmentController.ts:76-91

#### Input Schema
```typescript
// Headers
Authorization: "Bearer <jwt_token>" // Required

// Body (validated by UnequipItemSchema - schemas.ts:20-22)
{
  slot: EquipmentSlot // Enum: weapon|offhand|head|armor|feet|accessory_1|accessory_2|pet
}
```

#### Zod Validation Schema
```typescript
export const EquipmentSlotSchema = z.enum([
  'weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'
]);

export const UnequipItemSchema = z.object({
  slot: EquipmentSlotSchema
});
```

#### Output Schema
```typescript
// Success Response (200)
{
  success: boolean,
  slot: string, // The slot that was unequipped
  message: string // Success or informational message
}
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: "INVALID_SLOT",
    message: "Invalid slot name (not in EquipmentSlot enum)"
  }
}
```

**400 Bad Request:**
```typescript
{
  error: {
    code: "SLOT_EMPTY",
    message: "Slot already empty (no item to unequip)"
  }
}
```

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
    message: "Database update failures"
  }
}
```

#### Service Method Calls
1. `equipmentService.unequipItem(userId, slot)` - Handles unequip logic
   - Validates slot name against EquipmentSlots table
   - Sets UserEquipment.item_id = NULL for specified slot
   - Recalculates total player stats

#### Business Logic Flow
1. Extract `userId` from authenticated user and `slot` from validated request body
2. Call EquipmentService to perform unequip operation
3. Service validates slot exists and has an equipped item
4. Updates UserEquipment table to set item_id = NULL
5. Recalculates total player stats (excluding unequipped item)
6. Returns success status and confirmation message

#### Related Documentation
- Feature Spec: F-03-base-items-equipment.yaml:86-92
- API Contract: api-contracts.yaml:1191-1217
- Zod Schema: schemas.ts:11-13, 20-22
- Equipment Slots: data-plan.yaml:401-405

---

## Database Schema Dependencies

### UserEquipment Table (Single Source of Truth)
```sql
-- Composite primary key ensures one item per slot per user
PRIMARY KEY (user_id, slot_name)

-- Core columns
user_id: UUID (FK to Users)
slot_name: VARCHAR (FK to EquipmentSlots)
item_id: UUID (nullable, FK to Items)
equipped_at: TIMESTAMP
```

### EquipmentSlots Table (8 Predefined Slots)
```sql
-- Slot definitions
slot_name: VARCHAR PRIMARY KEY
display_name: VARCHAR
sort_order: INT
description: TEXT

-- 8 slots: weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet
```

### Items Table Integration
- Items have `user_id` for ownership validation
- Items have `item_type_id` FK to ItemTypes for slot compatibility
- Items have `level` for stat scaling
- Equipment state stored separately in UserEquipment (normalized design)

---

## Error Handling Patterns

### Service Layer Errors
- `NotImplementedError`: Service methods not yet implemented (current state)
- `ValidationError`: Business logic validation failures
- `NotFoundError`: Referenced entities don't exist
- `OwnershipError`: User doesn't own specified item
- `ConflictError`: Item already equipped elsewhere

### Database Errors
- `SupabaseError`: Mapped via `mapSupabaseError()` utility
- Connection timeouts and constraint violations
- Foreign key constraint failures on invalid references

### Authentication Errors
- JWT validation handled by auth middleware
- Unauthorized access returns 401 before reaching controller

---

## Implementation Notes

### Current Status (as of controller implementation)
- **Controller Layer**: Complete with proper error handling and logging
- **Service Layer**: Interface defined but methods throw `NotImplementedError`
- **Repository Layer**: Exists with full implementation (EquipmentRepository, ItemRepository)
- **Database Layer**: Schema applied, 8 EquipmentSlots seeded, 27 ItemTypes seeded

### Service Implementation Requirements
The controller delegates to EquipmentService methods that need implementation:

1. **getEquippedItems()**: Query UserEquipment joined with Items and ItemTypes
2. **equipItem()**: 7-step workflow with slot detection and conflict handling
3. **unequipItem()**: Slot validation and UserEquipment update

### Middleware Integration
- Routes defined in `/src/routes/equipment.ts` with proper middleware chain
- Authentication required for all endpoints (JWT validation)
- Request validation uses Zod schemas with descriptive error messages
- Global error handler provides consistent API error responses

### Logging and Debugging
Controller includes comprehensive console logging:
- Request details (userId, accountType, deviceId)
- Success metrics (equipped item counts, total stats)
- Error details (userId, error messages)
- Prefixed with emoji identifiers for filtering: ⚔️ [EQUIPMENT], ✅, ❌

## Cross-References

### Dependencies
**Controllers this controller depends on:**
- **AuthController** (requires authenticated users via auth middleware)

**Services used:**
- EquipmentService (7-step equip workflow with slot detection and conflict handling)
- EquipmentRepository, ItemRepository (database access layer with full implementation)

### Dependents
**Controllers that use this controller:**
- **LoadoutController** (activation copies LoadoutSlots to UserEquipment via EquipmentService)
- **ProfileController** (indirectly - total stats calculated from equipped items)

### Related Features
- **F-03 Base Items & Equipment System** - Primary feature spec for equipment management
- **F-09 Inventory Management** - Loadout activation integrates with equipment state
- **F-08 XP Progression System** - Total stats affect vanity level calculations

### Data Models
- UserEquipment table (docs/data-plan.yaml:452-466) - Single source of truth for equipment state
- EquipmentSlots table (8 predefined slots: weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet)
- PlayerItems table (docs/data-plan.yaml:203-221) - Item ownership and properties

### Integration Notes
- **Loadout Integration**: LoadoutController activation copies LoadoutSlots to UserEquipment table
- **Stats Computation**: Equipped items contribute to total player stats for combat and progression
- **Normalized Design**: Equipment state stored separately from item properties for flexibility
- **8-Slot System**: Hardcoded slot configuration across equipment system architecture
