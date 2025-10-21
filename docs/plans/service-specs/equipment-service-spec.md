# Equipment Service Specification

## Overview

The Equipment Service manages the 8-slot equipment system as the single source of truth for user equipment state. This system provides normalized equipment storage, automatic stats aggregation, and support for slot-based item management.

**Status**: ✅ **IMPLEMENTED** - Both service layer and repository layer are complete with RPC function integration.

## Core Architecture

### 8-Slot Equipment System

The equipment system uses 8 hardcoded slots matching the `EquipmentSlots` seed data:

| Slot | Purpose | Item Categories |
|------|---------|----------------|
| `weapon` | Primary offensive items | weapon |
| `offhand` | Secondary weapons/shields | weapon, shield |
| `head` | Head protection/accessories | head, helmet |
| `armor` | Body protection | armor, chestpiece |
| `feet` | Footwear | feet, boots |
| `accessory_1` | First utility slot | accessory, ring, necklace |
| `accessory_2` | Second utility slot | accessory, ring, necklace |
| `pet` | Companion creatures | pet, companion |

### Database Schema

**UserEquipment Table** (Single Source of Truth):
```sql
-- Composite Primary Key: (user_id, slot_name)
-- This ensures one item per slot per user
CREATE TABLE userequipment (
  user_id UUID NOT NULL,
  slot_name VARCHAR NOT NULL, -- FK to EquipmentSlots
  item_id UUID, -- nullable, FK to Items
  equipped_at TIMESTAMP,
  PRIMARY KEY (user_id, slot_name)
);
```

**Key Constraints**:
- `UNIQUE(user_id, slot_name)` - One item per slot
- `item_id` can be NULL (empty slot)
- Item ownership validated: `item_id IN (SELECT id FROM Items WHERE user_id = UserEquipment.user_id)`

## Service Implementation

### EquipmentService Methods

#### `getEquippedItems(userId: string)`

**Purpose**: Retrieve complete equipment state (all 8 slots) with aggregated stats.

**Implementation**:
```typescript
async getEquippedItems(userId: string): Promise<{
  slots: EquipmentSlots;
  total_stats: Stats;
}>
```

**Process**:
1. Query `userequipment` with LEFT JOIN to `items` and `itemtypes`
2. Transform database results to `EquipmentSlots` interface
3. Calculate total stats by summing `current_stats` from all equipped items
4. Return both equipment state and aggregated stats

**Query**:
```sql
SELECT slot_name, item_id, items.*, itemtypes.*
FROM userequipment
LEFT JOIN items ON userequipment.item_id = items.id
LEFT JOIN itemtypes ON items.item_type_id = itemtypes.id
WHERE user_id = $1
```

**Response Format**:
```json
{
  "slots": {
    "weapon": { "id": "uuid", "level": 5, ... } | undefined,
    "offhand": { "id": "uuid", "level": 3, ... } | undefined,
    "head": undefined,
    "armor": { "id": "uuid", "level": 7, ... } | undefined,
    "feet": undefined,
    "accessory_1": undefined,
    "accessory_2": undefined,
    "pet": { "id": "uuid", "level": 2, ... } | undefined
  },
  "total_stats": {
    "atkPower": 45,
    "atkAccuracy": 23,
    "defPower": 38,
    "defAccuracy": 19
  }
}
```

#### `equipItem(userId: string, itemId: string)`

**Purpose**: Equip item to appropriate slot with automatic slot detection and conflict resolution.

**Implementation**:
```typescript
async equipItem(userId: string, itemId: string): Promise<EquipResult>
```

**Process**:
1. **Validation**: Verify item ownership (`items.user_id = userId`)
2. **Slot Detection**: Map `itemtypes.category` to equipment slot:
   - `weapon` → `weapon`
   - `accessory` → `accessory_1` (could enhance with availability check)
   - `pet` → `pet`, etc.
3. **Atomic Operation**: Use `equip_item()` RPC function for transactional safety
4. **Conflict Resolution**: If slot occupied, previous item is automatically unequipped
5. **Stats Update**: Return updated player stats

**RPC Function Call**:
```sql
SELECT equip_item(
  p_user_id := $1,
  p_item_id := $2,
  p_slot_name := $3
)
```

**Response Format**:
```json
{
  "success": true,
  "equipped_item": { "id": "uuid", "level": 5, ... },
  "unequipped_item": { "id": "uuid", "level": 3, ... } | undefined,
  "updated_player_stats": {
    "atkPower": 50,
    "atkAccuracy": 25,
    "defPower": 40,
    "defAccuracy": 20
  }
}
```

#### `unequipItem(userId: string, slotName: string)`

**Purpose**: Remove item from specified equipment slot.

**Implementation**:
```typescript
async unequipItem(userId: string, slotName: string): Promise<boolean>
```

**Process**:
1. **Validation**: Check slot name against `EQUIPMENT_SLOT_NAMES` enum
2. **Atomic Operation**: Use `unequip_item()` RPC function
3. **Return Result**: `true` if item was unequipped, `false` if slot was already empty

**RPC Function Call**:
```sql
SELECT unequip_item(
  p_user_id := $1,
  p_slot_name := $2
)
```

### Private Helper Methods

#### `mapCategoryToSlot(category: string): string`

Maps item categories to equipment slots:

```typescript
private mapCategoryToSlot(category: string): string {
  switch (category) {
    case 'weapon': return 'weapon';
    case 'offhand': return 'offhand';
    case 'head': return 'head';
    case 'armor': return 'armor';
    case 'feet': return 'feet';
    case 'accessory': return 'accessory_1'; // TODO: Check availability
    case 'pet': return 'pet';
    default: throw new Error(`Unknown category: ${category}`);
  }
}
```

**Enhancement Opportunity**: For accessories, could check which accessory slot is available instead of defaulting to `accessory_1`.

#### `getItemDetails(itemId: string): Promise<Item>`

Fetches complete item information for response formatting.

#### `getPlayerStats(userId: string): Promise<Stats>`

Retrieves aggregated stats using `v_player_equipped_stats` database view.

## Repository Implementation

### EquipmentRepository Methods

The repository layer provides low-level database operations and is fully implemented:

#### Key Methods:
- `findEquippedByUser(userId)` - Complete equipment state query
- `findItemInSlot(userId, slotName)` - Single slot query
- `equipItem(userId, itemId, slotName)` - Atomic equip operation
- `unequipSlot(userId, slotName)` - Remove item from slot
- `computeTotalStats(userId)` - Stats aggregation with view fallback
- `validateSlotCompatibility(itemId, slotName)` - Category validation
- `equipMultiple(userId, slotAssignments)` - Bulk operations for loadouts

#### Validation Logic:
```typescript
const slotCategoryMapping: Record<string, string[]> = {
  weapon: ['weapon'],
  offhand: ['weapon', 'shield'],
  head: ['head', 'helmet'],
  armor: ['armor', 'chestpiece'],
  feet: ['feet', 'boots'],
  accessory_1: ['accessory', 'ring', 'necklace'],
  accessory_2: ['accessory', 'ring', 'necklace'],
  pet: ['pet', 'companion'],
};
```

## Controller Implementation

### EquipmentController Endpoints

#### `GET /equipment`

**Implementation**: ✅ Complete
- Uses `equipmentService.getEquippedItems(userId)`
- Returns all 8 slots with total stats
- Includes equipment count for UI display

#### `POST /equipment/equip`

**Implementation**: ✅ Complete
- Validates `EquipItemRequest` schema (Zod)
- Auto-detects slot from item category
- Returns equipped/unequipped items and updated stats

**Request Schema**:
```json
{
  "item_id": "uuid"
}
```

#### `POST /equipment/unequip`

**Implementation**: ✅ Complete
- Validates `UnequipItemRequest` schema (Zod)
- Removes item from specified slot

**Request Schema**:
```json
{
  "slot": "weapon" // Must be valid slot name
}
```

## Database Integration

### RPC Functions (PostgreSQL)

The service leverages atomic RPC functions for transaction safety:

#### `equip_item(p_user_id, p_item_id, p_slot_name)`

**Purpose**: Atomic equip operation with conflict resolution.

**Process**:
1. Validate item ownership and category compatibility
2. Check for existing item in slot
3. Update `UserEquipment` with upsert operation
4. Update user aggregate stats (via triggers)
5. Return operation result with previous item info

#### `unequip_item(p_user_id, p_slot_name)`

**Purpose**: Atomic unequip operation.

**Process**:
1. Validate slot name
2. Set `item_id = NULL` for the slot
3. Update user aggregate stats (via triggers)
4. Return success status and unequipped item ID

### Database Views

#### `v_player_equipped_stats`

Optimized view for stats aggregation:
```sql
CREATE VIEW v_player_equipped_stats AS
SELECT
  user_id as player_id,
  SUM(computed_atk) as atk,
  SUM(computed_acc) as acc,
  SUM(computed_def) as def,
  SUM(computed_hp) as hp
FROM user_equipment_with_stats
GROUP BY user_id;
```

**Fallback**: If view is unavailable, service computes stats in application code.

### Database Triggers

#### User Stats Maintenance

Triggers automatically update user aggregate stats when equipment changes:

```sql
-- Trigger on UserEquipment changes
CREATE TRIGGER update_user_stats
AFTER INSERT OR UPDATE OR DELETE ON userequipment
FOR EACH ROW EXECUTE FUNCTION update_user_vanity_stats();
```

**Updated Fields**:
- `Users.vanity_level` - Sum of all equipped item levels
- `Users.avg_item_level` - Average level for enemy scaling

## API Contracts

### Request/Response Schemas

#### Equipment State Response
```typescript
interface EquipmentResponse {
  slots: EquipmentSlots;
  total_stats: Stats;
  equipment_count: number;
}
```

#### Equip Result Response
```typescript
interface EquipResult {
  success: boolean;
  equipped_item: Item;
  unequipped_item?: Item;
  updated_player_stats: Stats;
}
```

#### Stats Interface
```typescript
interface Stats {
  atkPower: number;
  atkAccuracy: number;
  defPower: number;
  defAccuracy: number;
}
```

## Error Handling

### Validation Errors
- **Invalid slot name**: `ValidationError` with valid slot list
- **Category mismatch**: `ValidationError` for incompatible item-slot combinations
- **Item not found**: `NotFoundError` for invalid item IDs
- **Ownership violation**: `NotFoundError` for items not owned by user

### Database Errors
- **Constraint violations**: Mapped to appropriate domain errors
- **Transaction failures**: Wrapped in `DatabaseError` with context
- **RPC function errors**: Parsed and re-thrown with descriptive messages

## Performance Considerations

### Query Optimization
- **Equipment queries**: Use LEFT JOINs to fetch all slots in single query
- **Stats aggregation**: Prefer database view over application computation
- **Bulk operations**: Repository supports `equipMultiple()` for loadout switching

### Database Indexes
- `UserEquipment(user_id, slot_name)` - Primary key composite index
- `UserEquipment(item_id)` - For reverse lookups
- `Items(user_id, item_type_id)` - For ownership and category queries

### Caching Strategy
- **User stats**: Maintained by database triggers (real-time)
- **Equipment state**: No caching needed (small dataset, 8 slots max)
- **Item details**: Consider application-level caching for frequently accessed items

## Integration Points

### Material System (F-04)
- Equipment service reads `current_stats` which includes material modifiers
- Material changes trigger stats recalculation via database triggers

### Combat System (F-02)
- Combat initialization calls `getEquippedItems()` for player stats
- Uses `total_stats` for damage/defense calculations

### Upgrade System (F-06)
- Item level changes trigger equipment stats updates
- Service reflects upgraded stats immediately

### Image Generation
- Service returns `generated_image_url` for material combo images
- Links to R2 CDN for crafted item visuals

## Future Enhancements

### Accessory Slot Selection
Current implementation defaults accessories to `accessory_1`. Could enhance:

```typescript
// Enhanced accessory slot selection
private async findBestAccessorySlot(userId: string): Promise<'accessory_1' | 'accessory_2'> {
  const equipment = await this.getEquippedItems(userId);
  return equipment.slots.accessory_1 ? 'accessory_2' : 'accessory_1';
}
```

### Loadout System (F-09)
- Repository already supports `equipMultiple()` for bulk operations
- Loadout controller can use this for instant equipment switching

### Equipment Presets
- Save/load equipment configurations
- Quick-swap for different combat scenarios

### Stat Comparison
- Compare equipped vs. inventory items
- Show stat deltas before equipping

## Testing Considerations

### Unit Tests
- **Service methods**: Mock repository layer for isolated testing
- **Validation logic**: Test category-slot compatibility
- **Error handling**: Verify proper error types and messages

### Integration Tests
- **Database operations**: Test with real database for RPC functions
- **Transaction integrity**: Verify atomic equip/unequip operations
- **Stats consistency**: Ensure aggregated stats match equipped items

### Load Tests
- **Concurrent equipment**: Multiple users equipping simultaneously
- **Database triggers**: Performance under high equipment change volume

## Implementation Status

| Component | Status | Notes |
|-----------|---------|--------|
| EquipmentService | ✅ Complete | Full implementation with RPC integration |
| EquipmentRepository | ✅ Complete | Comprehensive CRUD operations |
| EquipmentController | ✅ Complete | All 3 endpoints implemented |
| Database Schema | ✅ Complete | UserEquipment table with constraints |
| RPC Functions | ✅ Complete | equip_item() and unequip_item() |
| Database Views | ✅ Complete | v_player_equipped_stats |
| API Validation | ✅ Complete | Zod schemas for all requests |
| Error Handling | ✅ Complete | Domain-specific error types |
| Database Triggers | ✅ Complete | User stats auto-maintenance |

**Overall Status**: The Equipment system is **fully implemented and production-ready**. All core functionality is complete with proper error handling, validation, and database integration.

---

*Generated from analysis of F-03 specification, API contracts, data plan, and existing codebase implementations.*

## See Also

### Related Service Specifications
- **[MaterialService](./material-service-spec.md)** - Equipment reads `current_stats` which includes material modifiers
- **[CombatService](./combat-service-spec.md)** - Uses `getEquippedItems()` for player stats in combat initialization
- **[ItemService](./item-service-spec.md)** - Item level changes trigger equipment stats updates
- **[LoadoutService](./loadout-service-spec.md)** - Loadout activation updates UserEquipment table

### Missing ProfileRepository Method
- **ProfileRepository.updateLastLogin()** ⚠️ NOT IN PROFILE SPEC - Equipment service references this method for login tracking

### Cross-Referenced Features
- **F-03**: Base Items & Equipment (primary feature)
- **F-04**: Materials System (material modifiers affect equipment stats)
- **F-02**: Combat System (equipment provides combat stats)
- **F-06**: Item Upgrade System (upgraded items reflect in equipment stats)
- **F-09**: Inventory Management (loadout system integration)