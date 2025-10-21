# InventoryController API Specification

## Overview

**Purpose**: Handles player inventory retrieval operations, providing access to both unique crafted items and stackable base items through a unified inventory API.

**Feature Reference**: [F-09 Inventory Management](../feature-specs/F-09-inventory-management.yaml)

**Service Dependencies**:
- `InventoryService` - Core inventory management and item stacking logic
- `StatsService` - Item stats calculation with materials applied

**File Location**: `mystica-express/src/controllers/InventoryController.ts`

## Architecture

The InventoryController implements the business logic separation pattern:
- **Controller**: Request handling, response formatting, error delegation
- **Service**: Business logic, data transformation, inventory classification
- **Repository**: Database operations via ItemRepository and MaterialRepository

## Endpoints

### GET /inventory

**Route Handler**: `getInventory`
**Path**: `/api/v1/inventory`
**Method**: `GET`

#### Request Specification

**Headers**:
```typescript
Authorization: Bearer <jwt_token>  // Required
```

**Query Parameters**: None currently implemented
*Note: F-09 spec plans filtering/sorting/pagination parameters for future implementation*

**Route Parameters**: None

**Request Body**: None

#### Response Specification

**Success Response (200)**:
```typescript
{
  data: {
    items: PlayerItem[],    // Unique items with materials applied
    stacks: ItemStack[]     // Stackable base items grouped by type+level
  }
}
```

**PlayerItem Interface**:
```typescript
interface PlayerItem {
  id: string;                           // Item instance UUID
  name: string;                         // From ItemTypes.name
  item_type_id: string;                 // ItemTypes reference
  category: 'weapon' | 'offhand' | 'head' | 'armor' | 'feet' | 'accessory' | 'pet';
  level: number;                        // Current item level (1+)
  rarity: Rarity;                       // From ItemTypes.rarity
  applied_materials: AppliedMaterial[]; // Materials with slot_index, stats
  materials?: AppliedMaterial[];        // Compatibility alias for tests
  is_styled: boolean;                   // True if ANY material has non-'normal' style
  current_stats: Stats;                 // Computed stats: base + level + materials
  is_equipped: boolean;                 // Equipment status from UserEquipment
  equipped_slot: string | null;         // Slot name if equipped, null otherwise
  generated_image_url: string;          // R2 URL or default placeholder
}
```

**ItemStack Interface**:
```typescript
interface ItemStack {
  item_type_id: string;    // ItemTypes reference for grouping
  level: number;           // Level for this stack
  quantity: number;        // Count of items in stack
  base_stats: Stats;       // Computed base stats for level (no materials)
  icon_url: string;        // Default icon URL for item category
}
```

**Stats Interface**:
```typescript
interface Stats {
  atkPower: number;
  atkAccuracy: number;
  defPower: number;
  defAccuracy: number;
  hp: number;
}
```

#### Error Responses

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Invalid or missing authentication token"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "DATABASE_ERROR",
    message: string
  }
}
```

#### Middleware Chain

1. **CORS** - Cross-origin resource sharing (app.ts:25)
2. **Body Parser** - JSON request parsing (app.ts:33-34)
3. **JWT Authentication** - `req.user` attachment (middleware/auth.ts)
4. **Route Handler** - InventoryController.getInventory

*Note: No validation middleware as this endpoint has no input parameters*

#### Service Integration

**Primary Service Call**:
```typescript
const inventory = await inventoryService.getPlayerInventory(userId);
```

**Service Method**: `InventoryService.getPlayerInventory(userId: string)`

**Service Dependencies**:
- `ItemRepository.findByUser(userId)` - Fetch user's items
- `ItemRepository.findManyWithDetails(itemIds, userId)` - Batch item details
- `ItemRepository.findEquippedByUser(userId)` - Equipment status
- `StatsService.computeItemStats()` - Stats calculation with materials
- `StatsService.computeItemStatsForLevel()` - Base stats calculation

#### Business Logic Flow

1. **Input Validation**: Extract `userId` from `req.user.id` (set by auth middleware)
2. **Service Delegation**: Call `inventoryService.getPlayerInventory(userId)`
3. **Internal Service Logic**:
   - Fetch all user items with complete details (types, materials, equipment status)
   - Classify items by material state:
     - **Unique Items**: Items with materials → `PlayerItem[]`
     - **Stackable Items**: Items without materials → grouped by type+level → `ItemStack[]`
   - Calculate stats for unique items (base + level + materials)
   - Calculate base stats for stackable items (base + level only)
   - Apply equipment status from UserEquipment table
4. **Response Formatting**: Wrap in `{ data: { items, stacks } }` structure
5. **Error Handling**: Delegate to global error handler via `next(error)`

#### Database Operations

**Tables Queried**:
- `Items` - User-owned item instances
- `ItemTypes` - Base item templates and stats
- `ItemMaterials` - Applied materials mapping
- `MaterialInstances` - Material application details
- `UserEquipment` - Equipment status across 8 slots

**Query Pattern**: Batched operations to prevent N+1 queries
- Single query for all user items
- Batch query for item details by IDs
- Single query for equipment status

#### Database Optimization

- **Repository Pattern**: Batch queries minimize database round trips
- **Equipment Status**: Single query with Map lookup for O(1) slot assignments
- **Stats Calculation**: StatsService handles complex material modifier logic
- **Image URLs**: Default fallbacks for missing generated images

#### Stacking Logic

**Unique Items** (separate inventory entries):
- Items with `materials.length > 0`
- Each has unique stats, image, and progression state
- Cannot be stacked due to individual material applications

**Stackable Items** (grouped entries):
- Items with `materials.length === 0` (base items only)
- Grouped by `{item_type_id}_{level}` key
- Share base stats calculation but stack quantities
- Use default category icons

#### Related Documentation

- **F-09 Inventory Management**: Complete feature specification
- **F-03 Base Items & Equipment**: Item categories and equipment slots
- **F-04 Materials System**: Material application affecting inventory display
- **UserEquipment Schema**: Equipment state management (data-plan.yaml:452-466)
- **API Contract**: OpenAPI specification (api-contracts.yaml:1076-1109)

#### Future Enhancements

Per F-09 specification, planned query parameters:
- `slot_type` - Filter by equipment category
- `sort_by` - Sort by level, rarity, created_at, name
- `sort_order` - asc/desc ordering
- `limit`/`offset` - Pagination support

#### Implementation Notes

**Error Handling Strategy**:
- ValidationError: Input validation failures (400 status)
- DatabaseError: Query failures with context details (500 status)
- Global error handler converts service errors to HTTP responses

**Type Safety**:
- Uses TypeScript interfaces for all data structures
- Zod schemas planned for future query parameter validation
- Express type extensions provide `req.user` typing

**Testing Integration**:
- Service layer fully testable with repository mocks
- Controller integration tests verify request/response flow
- Factory pattern provides test data generation

---

*Last Updated: 2025-01-27*
*Version: 1.0*
*Related Files: InventoryController.ts:1-29, InventoryService.ts:56-151*

## Cross-References

### Dependencies
**Controllers this controller depends on:**
- **AuthController** (requires authenticated users via auth middleware)

**Services used:**
- InventoryService (retrieval and organization of player inventory data)

### Dependents
**Controllers that use this controller:**
- None (leaf controller - provides inventory data but doesn't delegate to other controllers)

### Related Features
- **F-09 Inventory Management** - Primary feature spec
- **F-03 Base Items & Equipment** - Item categories and equipment slots
- **F-04 Materials System** - Material application affecting inventory display

### Data Models
- PlayerItems table (docs/data-plan.yaml:203-221)
- UserEquipment table (docs/data-plan.yaml:452-466)
- ItemMaterials table (for material application tracking)

### Integration Notes
- **Inventory Display**: Provides unified view of all player items with stacking logic
- **Equipment Integration**: Shows which items are currently equipped
- **Material Context**: Displays material applications and resulting item uniqueness