# Item Service Method Specification

## Overview

Comprehensive specification for ItemController and ItemService methods supporting the item system in Mystica. Covers CRUD operations, upgrade mechanics, stat computation, audit trails, and specialized handling for weapons and pets.

## Service Architecture

```
ItemController → ItemService → Repository Layer
                             ├── ItemRepository (core CRUD, materials, history)
                             ├── WeaponRepository (timing mechanics, combat)
                             └── PetRepository (personality, chatter)
```

## Core Service Methods

### 1. Item CRUD Operations

#### `getItemDetails(userId: string, itemId: string): Promise<Item>` - IMPLEMENTED
**Purpose:** Retrieve single item with complete details including materials and type information.

**Implementation (IMPLEMENTED in ItemService):**
- Uses `ItemRepository.findWithMaterials(itemId, userId)` for complete item data
- Validates ownership through repository method
- Transforms database response to API Item type format
- Computes current stats if materials applied or level > 1 using `statsService.computeItemStatsForLevel()`
- Returns comprehensive item object with materials array and item_type details

**Response Structure:**
```typescript
{
  id: string;
  item_type: ItemType;
  level: number;
  rarity: string;
  computed_stats: Stats;
  applied_materials: AppliedMaterial[];
  is_styled: boolean;
  is_equipped: boolean;
  generated_image_url?: string;
}
```

**Error Cases:**
- 404: Item not found or not owned by user
- 401: Invalid authentication

#### `getUserInventory(userId: string, options?: PaginationParams): Promise<InventoryResponse>` - TODO
**Purpose:** Get all items owned by a user with pagination support.

**Implementation (TODO - Not Yet Implemented):**
- Should use `ItemRepository.findByUserWithPagination()` for efficient querying
- Should join with UserEquipment to determine equipped status
- Should compute stats for each item using stat calculation service
- Should support filtering by item type, rarity, or equipped status

**Response Structure:**
```typescript
{
  items: PlayerItem[];
  total_count: number;
  pagination: {
    limit: number;
    offset: number;
    has_more: boolean;
  };
}
```

#### `createItem(userId: string, itemTypeId: string, level?: number): Promise<ItemWithDetails>` - TODO
**Purpose:** Create new item for user (used in ProfileService.initializeProfile() and loot drops).

**Implementation (TODO - Not Yet Implemented):**
- Should validate itemTypeId exists in ItemTypes table
- Should use `ItemRepository.create()` with default level 1
- Should add "created" history event via `addHistoryEvent()`
- Should create weapon/pet data if applicable based on item category
- Should return complete item details using `getItemDetails()`

**Workflow:**
1. Validate item type exists
2. Create item record with default values
3. Add "created" event to item history
4. Create specialized data (weapon/pet) if needed
5. Return complete item data

### 2. Item Upgrade System (F-06)

#### `getUpgradeCost(userId: string, itemId: string): Promise<UpgradeCostResponse>` - IMPLEMENTED
**Purpose:** Calculate gold cost to upgrade item to next level.

**Implementation (IMPLEMENTED in ItemService):**
- Uses `ItemRepository.findById(itemId, userId)` to validate ownership and get current level
- Applies cost formula: `Math.floor(100 * Math.pow(1.5, currentLevel - 1))`
- Gets user's current gold using `ProfileRepository.getCurrencyBalance(userId, 'GOLD')`
- Returns detailed cost info with affordability check

**Response Structure:**
```typescript
{
  current_level: number;
  next_level: number;
  gold_cost: number;
  player_gold: number;
  can_afford: boolean;
}
```

**Cost Formula (F-06 spec):**
- Base cost: 100 gold
- Level multiplier: 1.5
- Same cost for all rarities
- Examples:
  - Level 1→2: 100 gold
  - Level 5→6: 506 gold
  - Level 10→11: 3,834 gold

#### `upgradeItem(userId: string, itemId: string): Promise<UpgradeResult>` - IMPLEMENTED
**Purpose:** Spend gold to increase item level and recalculate stats.

**Implementation Workflow:**
1. Validate item ownership
2. Calculate upgrade cost using formula
3. Check sufficient gold balance
4. Begin database transaction:
   - Decrement user gold via EconomyService
   - Increment item level
   - Recalculate current_stats if cached
   - Update vanity_level trigger fires automatically
   - Add "upgraded" event to item history
5. Return updated item data

**Response Structure:**
```typescript
{
  success: true;
  item: ItemWithDetails;
  gold_spent: number;
  new_gold_balance: number;
  new_vanity_level: number;
}
```

**Error Cases:**
- 400: Insufficient gold
- 404: Item not found or not owned

### 3. Stat Computation Service

#### `computeItemStats(item: ItemRow, itemType: ItemTypeRow, materials?: AppliedMaterial[]): Promise<Stats>`
**Purpose:** Calculate final item stats with rarity, level, and material modifiers.

**Implementation Formula (F-03/F-06 specs):**
```typescript
// Base calculation
base_stats = itemType.base_stats_normalized // sums to 1.0
rarity_multiplier = RarityDefinitions[itemType.rarity].stat_multiplier // 1.0-2.0
level_scaled = base_stats × rarity_multiplier × level × 10

// Material modifiers (zero-sum adjustments)
material_mods = materials.reduce((acc, mat) => {
  return acc + mat.stat_modifiers // each sums to 0
}, {})

// Final stats
final_stats = level_scaled + material_mods
```

**Stats Structure:**
```typescript
{
  atkPower: number;
  atkAccuracy: number;
  defPower: number;
  defAccuracy: number;
}
```

#### `getPlayerTotalStats(userId: string): Promise<PlayerStats>`
**Purpose:** Sum stats from all 8 equipped items for combat calculations.

**Implementation:**
- Query UserEquipment for all 8 slots
- Compute stats for each equipped item
- Sum all stats together
- Include combat rating calculation

**Response Structure:**
```typescript
{
  equipped_stats: Stats;
  total_items_equipped: number;
  combat_rating: number;
  slots: {
    weapon?: ItemWithStats;
    offhand?: ItemWithStats;
    head?: ItemWithStats;
    armor?: ItemWithStats;
    feet?: ItemWithStats;
    accessory_1?: ItemWithStats;
    accessory_2?: ItemWithStats;
    pet?: ItemWithStats;
  };
}
```

### 4. Item History Audit Trail

#### `addHistoryEvent(itemId: string, userId: string, eventType: string, eventData?: any): Promise<void>`
**Purpose:** Record item lifecycle events for audit trail.

**Event Types:**
- `created`: Item created for user
- `upgraded`: Level increased with gold cost
- `material_applied`: Material added to item
- `material_replaced`: Material swapped (F-05)
- `equipped`: Item equipped to slot
- `unequipped`: Item removed from slot
- `deleted`: Item removed from inventory

**Implementation (AVAILABLE via ItemRepository):**
- Uses `ItemRepository.addHistoryEvent(itemId, userId, eventType, eventData)`
- Validates ownership first via `validateOwnership(itemId, userId)`
- Inserts into `itemhistory` table with item_id, user_id, event_type, event_data
- Automatic timestamp via database default

#### `getItemHistory(itemId: string, userId: string): Promise<ItemHistoryEvent[]>`
**Purpose:** Retrieve complete history for an item.

**Implementation (AVAILABLE via ItemRepository):**
- Uses `ItemRepository.getItemHistory(itemId, userId)`
- Validates ownership first via `validateOwnership(itemId, userId)`
- Queries `itemhistory` table filtered by item_id and user_id
- Returns events ordered by created_at DESC
- Returns ItemHistoryEvent[] type from database.types.ts

## Specialized Item Types

### 5. Weapon-Specific Operations

#### `getWeaponCombatStats(weaponItemId: string, playerAccuracy: number): Promise<WeaponCombatStats>`
**Purpose:** Calculate weapon timing effectiveness for combat.

**Implementation (AVAILABLE via WeaponRepository):**
- Uses `WeaponRepository.getWeaponCombatStats(weaponId, playerAccuracy)`
- Calls PostgreSQL RPC functions: `fn_weapon_bands_adjusted` and `fn_expected_mul_quick`
- Returns weapon data, adjustedBands with degree distributions, and expectedDamageMultiplier
- Validates weapon exists and throws NotFoundError if missing

**Response Structure:**
```typescript
{
  weapon: WeaponData;
  adjusted_bands: {
    deg_injure: number;
    deg_miss: number;
    deg_graze: number;
    deg_normal: number;
    deg_crit: number;
    total_degrees: number;
  };
  expected_damage_multiplier: number; // 0.0-1.6+ range
}
```

#### `createWeaponData(itemId: string, pattern?: WeaponPattern): Promise<WeaponData>`
**Purpose:** Create weapon timing data when weapon item is created.

**Implementation (AVAILABLE via WeaponRepository):**
- Uses `WeaponRepository.createWeapon(weaponData)` with CreateWeaponData type
- Validates degree configuration using `validateDegreeSum()` (total ≤ 360°)
- Validates spin speed > 0 using `validateSpinSpeed()`
- Enforces MVP0 constraint: only `single_arc` pattern allowed
- Default values: injure=5°, miss=45°, graze=60°, normal=200°, crit=50°, spin=360°/s
- Returns created Weapon database row

**MVP0 Constraints:**
- Only `single_arc` pattern allowed
- Default hit bands: injure=5°, miss=45°, graze=60°, normal=200°, crit=50°
- Default spin speed: 360 degrees/second

### 6. Pet-Specific Operations

#### `createPetData(itemId: string): Promise<PetData>`
**Purpose:** Create pet record when pet item is created.

**Implementation (AVAILABLE via PetRepository):**
- Uses `PetRepository.createPet(itemId)`
- Validates item category is 'pet' via `validatePetItemCategory(itemId)`
- Creates Pet record with: personality_id=null, custom_name=null, chatter_history=null
- Returns created Pet database row

#### `assignPetPersonality(itemId: string, userId: string, personalityId: string, customName?: string): Promise<void>`
**Purpose:** Set pet personality and optional custom name.

**Implementation (AVAILABLE via PetRepository):**
- Uses `PetRepository.updatePetPersonality(itemId, personalityId, customName)`
- Validates custom name if provided: ≤50 chars, profanity filter, valid characters only
- Updates Pet record with personality_id and optional custom_name
- Note: Repository lacks ownership validation - should be added in service layer

#### `updatePetChatter(itemId: string, userId: string, message: ChatterMessage): Promise<void>`
**Purpose:** Add dialogue to pet chatter history with size limits.

**Implementation (AVAILABLE via PetRepository):**
- Uses `PetRepository.addChatterMessage(itemId, message, maxMessages=50)`
- Automatically truncates to keep only most recent 50 messages
- Validates total history size ≤50KB and ≤100 messages
- Message structure: `{text: string, timestamp: string, type?: string}`
- Note: Repository lacks ownership validation - should be added in service layer

## Integration Points

### 7. ProfileService Integration

#### `initializeStarterInventory(userId: string): Promise<ItemWithDetails>`
**Purpose:** Create starter item for new user registration.

**Implementation Workflow:**
1. Select random common rarity item type
2. Create item at level 1 with no materials
3. Add creation history event
4. Create weapon/pet data if applicable
5. Return complete item details

### 8. MaterialService Integration

#### `applyMaterialToItem(itemId: string, userId: string, materialInstanceId: string, slotIndex: number): Promise<ItemWithDetails>`
**Purpose:** Apply material to item slot and update stats/image.

**Implementation Workflow:**
1. Validate item ownership and material ownership
2. Validate slot index (0-2)
3. Check slot not already occupied
4. Apply material via MaterialService
5. Recompute item stats
6. Update is_styled flag if any material is styled
7. Trigger image generation if combo changed
8. Add history event
9. Return updated item

#### `replaceMaterial(itemId: string, userId: string, slotIndex: number, newMaterialInstanceId: string): Promise<ItemWithDetails>`
**Purpose:** Replace material in slot with gold cost (F-05).

**Implementation Workflow:**
1. Calculate replacement cost: `100 × item.level`
2. Validate sufficient gold
3. Remove existing material (return to MaterialStacks)
4. Apply new material
5. Charge replacement cost via EconomyService
6. Update stats and image generation
7. Add history event

### 9. EquipmentService Integration

#### `equipItem(itemId: string, userId: string): Promise<EquipmentResponse>`
**Purpose:** Equip item to appropriate slot.

**Implementation:**
- Delegate to EquipmentService for slot management
- Add "equipped" history event after successful equip
- Return updated equipment state

#### `unequipItem(slotName: string, userId: string): Promise<EquipmentResponse>`
**Purpose:** Remove item from equipment slot.

**Implementation:**
- Delegate to EquipmentService for slot management
- Add "unequipped" history event after successful unequip
- Return updated equipment state

## Error Handling

### Standard Error Responses

**ValidationError (400):**
- Invalid item level (< 1)
- Invalid material slot index (not 0-2)
- Invalid custom pet name (length, profanity, characters)
- Insufficient gold for upgrade/replacement

**NotFoundError (404):**
- Item not found or not owned by user
- Item type not found
- Material instance not found
- Weapon/pet data not found

**BusinessLogicError (409):**
- Material slot already occupied
- Item already equipped
- Weapon pattern not allowed in MVP0

### Database Error Mapping

**Foreign Key Violations:**
- item_type_id → ItemTypes: "Invalid item type"
- material_instance_id → MaterialInstances: "Invalid material"
- personality_id → PetPersonalities: "Invalid personality"

**Check Constraint Violations:**
- Pet item category: "Item must be a pet"
- Weapon degree sum > 360: "Invalid hit band configuration"
- Material stat sum ≠ 0: "Invalid material stat modifiers"

## Performance Considerations

### Query Optimization

**N+1 Prevention:**
- Use nested selects in repositories for complete item data
- Batch item queries for inventory listing
- Preload equipment state for user stats

**Caching Strategy:**
- Cache computed stats in Items.current_stats (optional)
- Cache player total stats for combat initialization
- Cache weapon combat calculations per accuracy level

### Database Triggers

**Automatic Maintenance:**
- Users.vanity_level updated on item level changes
- Users.avg_item_level updated on equipment changes
- Items.is_styled updated on material changes
- Items.material_combo_hash updated on material changes

## API Endpoint Mappings

### ItemController Endpoints

| Endpoint | Method | Service Method | Description |
|----------|--------|----------------|-------------|
| `/items/{id}` | GET | `getItemById()` | Get item details |
| `/items/{id}/upgrade-cost` | GET | `getUpgradeCost()` | Get upgrade cost |
| `/items/{id}/upgrade` | POST | `upgradeItem()` | Upgrade item level |

### InventoryController Endpoints

| Endpoint | Method | Service Method | Description |
|----------|--------|----------------|-------------|
| `/inventory` | GET | `getUserInventory()` | Get user items |

### Integration Endpoints

| Endpoint | Method | Service Method | Description |
|----------|--------|----------------|-------------|
| `/equipment/equip` | POST | `equipItem()` | Equip item |
| `/equipment/unequip` | POST | `unequipItem()` | Unequip item |
| `/items/{id}/materials/apply` | POST | `applyMaterialToItem()` | Apply material |
| `/items/{id}/materials/replace` | POST | `replaceMaterial()` | Replace material |

## Testing Requirements

### Unit Test Coverage

**Service Layer Tests:**
- Stat computation accuracy with various rarity/level combinations
- Upgrade cost formula validation across level ranges
- Material modifier application (zero-sum enforcement)
- Pet name validation (length, profanity, special characters)
- Weapon hit band validation (degree sum ≤ 360)

**Repository Layer Tests:**
- Complex query joins (items + materials + types)
- Ownership validation enforcement
- History event logging
- Error mapping from database constraints

### Integration Test Scenarios

**Item Lifecycle:**
1. Create item → Apply materials → Upgrade level → Equip → Combat usage
2. Pet creation → Personality assignment → Custom naming → Chatter updates
3. Weapon creation → Hit band configuration → Combat effectiveness calculation

**Error Conditions:**
- Insufficient gold for upgrades/replacements
- Invalid ownership attempts
- Constraint violations (degree sums, material slots)
- Database rollback on transaction failures

This specification provides comprehensive coverage of all item system operations supporting F-03 (Base Items), F-06 (Upgrades), weapon timing mechanics, pet personality system, and audit trail requirements.

## See Also

### Related Service Specifications
- **[StatsService](./stats-service-spec.md)** - Item stat calculations with material modifiers and level scaling
- **[EconomyService](./economy-service-spec.md)** - Gold deduction for upgrades and material replacements
- **[MaterialService](./material-service-spec.md)** - Material application and replacement workflows
- **[EquipmentService](./equipment-service-spec.md)** - Item equipping and stat aggregation
- **[ProfileService](./profile-service-spec.md)** - Starter inventory creation during profile initialization

### Cross-Referenced Features
- **F-03**: Base Items & Equipment (primary feature)
- **F-06**: Item Upgrade System (gold cost formulas and level scaling)
- **F-04**: Materials System (material application integration)
- **F-11**: Pet Personality System (pet-specific operations)
- **F-12**: Enemy Trash Talk (weapon timing mechanics)