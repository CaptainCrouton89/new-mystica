# CLAUDE.md

Type definitions and schemas for the backend.

## Files Overview

- **database.types.ts** - Auto-generated from Supabase (run `pnpm supabase:types`)
- **api.types.ts** - Domain models, API response types, DTOs, and result interfaces (~770 lines)
- **repository.types.ts** - Repository layer types, data access patterns, transaction types
- **express.d.ts** - Express type extensions (`req.user`, `req.validated`, `req.context`)
- **schemas.ts** - Zod validation schemas for all request bodies/query params
- **errors.ts** - Custom error classes (NotFoundError, ValidationError, etc.)
- **index.ts** - Barrel exports for easy imports

## Key Patterns

### 1. API Types (api.types.ts)

Comprehensive domain models covering all game entities:

**Core Domain Models:**
- `UserProfile` - User data with stats, progression, currencies
- `Item` - Player-owned item instance with materials and styling
- `ItemType` - Item template from seed data
- `Material` / `AppliedMaterial` - Material templates and instances on items
- `PlayerStats` - Aggregated stats from equipped items

**API Response Types** (use in controller returns):
- `EquipResult` - Equipment operation outcome with updated stats
- `ApplyMaterialResult` - Material application success with image URL
- `InventoryResponse` - Full inventory with items and storage status
- `CombatActionResult` - Combat action outcome with rewards

**Request DTOs** (match Zod schemas in routes):
- `EquipmentRequest` - Item ID and target slot
- `ApplyMaterialRequest` - Material, style, and slot index
- `CombatActionRequest` - Action type and optional target

**Enums and Constants:**
- `EquipmentSlot` - 8 slot types (weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet)
- `Rarity` - common, uncommon, rare, epic, legendary
- `CombatStatus` - active, victory, defeat, abandoned

**Example usage:**
```typescript
// In controller
async equipItem(req: Request, res: Response) {
  const result: EquipResult = await equipmentService.equipItem(userId, itemId);
  res.json(result);
}

// In service
async equipItem(userId: string, itemId: string): Promise<EquipResult> {
  const equipped = await this.equipmentRepository.equip(userId, itemId);
  const stats = await this.calculatePlayerStats(userId);
  return { success: true, equipped_item: equipped, updated_player_stats: stats };
}
```

### 2. Repository Types (repository.types.ts)

Data access layer interfaces for consistent patterns:

**Query Helpers:**
- `QueryFilter` - Flexible filter object for WHERE conditions (allows field: value pairs)
- `PaginationParams` - limit, offset for result sets
- `SortParams` - orderBy, ascending for ordering

**Item Repository:**
- `ItemWithDetails` - Full item with related ItemType and materials
- `ItemWithMaterials` - Item with applied materials array
- `CreateItemData` / `UpdateItemData` - Typed input for operations

**Material Repository:**
- `MaterialInstance` / `MaterialInstanceWithTemplate` - Applied material tracking
- `CreateMaterialStackData` - Add new material to player inventory
- `ApplyMaterialData` - Link material instance to item slot

**Equipment/Loadout:**
- `EquipmentSlotAssignment` - Single slot assignment
- `BulkEquipmentUpdate` - All 8 slots at once (loadout activation)
- `LoadoutWithSlots` - Loadout with all slot assignments

**Example usage:**
```typescript
// In service
const itemDetails = await this.itemRepository.findWithDetails(itemId);
// Returns: ItemWithDetails with item_type and materials joined

await this.materialRepository.createStack({
  user_id: userId,
  material_id: matId,
  style_id: styleId,
  quantity: 1
});
```

### 3. Zod Schemas (schemas.ts)

All request bodies and query parameters MUST have Zod schemas:

```typescript
export const CreateItemSchema = z.object({
  item_type_id: UUIDSchema,
  rarity: RaritySchema,
  name: z.string().min(1).max(100)
});

// Use with validate middleware:
router.post('/items',
  authenticate,
  validate({ body: CreateItemSchema }),
  itemController.createItem
);
```

**Always define reusable base schemas:**
- `UUIDSchema` - UUID string validation
- `RaritySchema` - Rarity enum validation
- `EquipmentSlotSchema` - Equipment slot enum validation
- Extend these in route-specific schemas

### 4. Express Type Extensions (express.d.ts)

Never redeclare `req` properties. Use typed extensions:

```typescript
// Added by auth middleware:
req.user: { id: string; email?: string }

// Added by validate middleware:
req.validated: { body?: T; query?: T; params?: T }

// Available for context:
req.context: { traceId: string }
```

### 5. Database Types (database.types.ts)

Auto-generated from Supabase schema:

```typescript
import { Database } from '../types/database.types.js';

type Item = Database['public']['Tables']['PlayerItems']['Row'];
type InsertItem = Database['public']['Tables']['PlayerItems']['Insert'];
type UpdateItem = Database['public']['Tables']['PlayerItems']['Update'];
```

Always use these instead of creating custom interfaces.

### 6. Error Classes (errors.ts)

Use for consistent error handling:

```typescript
import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ConflictError,
  BadRequestError
} from '../utils/errors.js';

// Throw from services:
throw new NotFoundError('Item', itemId);
throw new ValidationError('Materials limit exceeded');
throw new UnauthorizedError('Access denied');
```

Error handler middleware converts to HTTP responses.

## Type Flow Example

How types flow through a typical operation:

```
Request → Zod Schema (validates)
    ↓
express.d.ts (req.validated: CreateItemSchema)
    ↓
Controller (receives typed body)
    ↓
Service (uses api.types DTO/Result)
    ↓
Repository (uses repository.types for data)
    ↓
Database (uses database.types auto-generated)
    ↓
Response (api.types result sent as JSON)
```

## Development Guidelines

- **NEVER use `any` type** - Look up actual type from database.types or api.types
- **NEVER import from parent types** - Use barrel export from `./index.ts`
- **ALWAYS validate externally-provided data with Zod** - Routes handle body/query validation
- **ALWAYS return typed result objects** - Use EquipResult, ApplyMaterialResult, etc. from api.types
- **ALWAYS use database.types in repositories** - Avoid `unknown` or generic objects
- **Module resolution** - Use `.js` extensions in imports even though code is TypeScript
