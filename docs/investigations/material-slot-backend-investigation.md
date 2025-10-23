# Material Slot Backend Investigation

## Summary

Investigation into backend material application logic to understand how material slots work on items and identify why valid material applications are being rejected with "Slot 0 is already occupied" errors.

## Key Findings

### 1. Material Slot System Architecture

Items support **exactly 3 material slots** (indices 0, 1, 2):

**Database Schema (migrations/001_initial_schema.sql:408-412):**
```sql
CREATE TABLE ItemMaterials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL,
    material_instance_id UUID NOT NULL UNIQUE,
    slot_index SMALLINT NOT NULL CHECK (slot_index BETWEEN 0 AND 2),
    applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_item_slot UNIQUE (item_id, slot_index)
);
```

**Key Constraints:**
- `slot_index` must be between 0 and 2
- `UNIQUE (item_id, slot_index)` - prevents multiple materials in same slot
- `material_instance_id UNIQUE` - prevents reusing the same material instance

### 2. Apply Material Endpoint Logic

**Route:** `POST /items/:id/materials/apply`

**Flow (src/services/MaterialService.ts:99-224):**

1. **Validation (lines 122-139):**
   ```typescript
   // Check slot availability (max 3 materials per item)
   const occupiedSlots = await this.materialRepository.getSlotOccupancy(itemId);
   if (occupiedSlots.length >= 3) {
     throw new BusinessLogicError('Item already has maximum 3 materials applied');
   }

   // Validate slotIndex (0-2) and not occupied
   if (slotIndex < 0 || slotIndex > 2) {
     throw new ValidationError('Slot index must be between 0 and 2');
   }
   if (occupiedSlots.includes(slotIndex)) {
     throw new BusinessLogicError(`Slot ${slotIndex} is already occupied`);
   }
   ```

2. **Material Stack Check (lines 142-145):**
   ```typescript
   const materialStack = await this.materialRepository.findStackByUser(userId, materialId, styleId);
   if (!materialStack || materialStack.quantity < 1) {
     throw new BusinessLogicError('Insufficient materials in inventory');
   }
   ```

3. **Atomic Application (lines 148-154):**
   Uses RPC function `apply_material_to_item` for database-level atomicity.

### 3. Slot Validation Logic

**MaterialRepository.getSlotOccupancy() (src/repositories/MaterialRepository.ts:575-593):**
```typescript
async getSlotOccupancy(itemId: string): Promise<number[]> {
  const { data, error } = await this.client
    .from('itemmaterials')
    .select('slot_index')
    .eq('item_id', itemId)
    .order('slot_index');

  return slotRows.map(item => item.slot_index);
}
```

**Returns array of occupied slot indices** (e.g., `[0, 2]` means slots 0 and 2 are occupied, slot 1 is free).

### 4. Atomic RPC Functions

**apply_material_to_item() (migrations/005_material_transaction_rpcs.sql:14-108):**

The RPC function performs these checks:
- Validates `p_slot_index` between 0 and 2 (lines 36-38)
- Checks if slot is already occupied (lines 41-46):
  ```sql
  IF EXISTS (
    SELECT 1 FROM itemmaterials
    WHERE item_id = p_item_id AND slot_index = p_slot_index
  ) THEN
    RAISE EXCEPTION 'Slot % is already occupied on item %', p_slot_index, p_item_id;
  END IF;
  ```
- Validates material stack existence and quantity (lines 48-64)
- Atomically: decrements stack → creates instance → links to item → updates `is_styled` flag

### 5. No Auto-Slot Selection Logic

**Critical Finding:** The backend does **NOT** automatically find available slots. The frontend must:
1. Call the backend to get occupied slots
2. Calculate which slots are available (0, 1, 2 minus occupied)
3. Choose a specific slot index to send with the application request

**Schema validation (src/types/schemas.ts:30-34):**
```typescript
export const ApplyMaterialSchema = z.object({
  material_id: z.string().min(1, 'Material ID is required'),
  style_id: z.string().uuid().default('00000000-0000-0000-0000-000000000000'),
  slot_index: z.number().int().min(0).max(2, 'Slot index must be between 0 and 2')
});
```

The `slot_index` is **required** in the request - there's no "find next available slot" mode.

## Root Cause Analysis

The error "Slot 0 is already occupied" suggests one of these scenarios:

### Scenario A: Frontend Slot State Mismatch
- Frontend thinks slot 0 is available but backend shows it's occupied
- Could be caused by stale state after previous material applications
- Frontend not properly updating local item state after successful applications

### Scenario B: Race Condition
- Multiple rapid material applications without waiting for server response
- Frontend sends multiple requests with same slot_index before server can respond

### Scenario C: Database Inconsistency
- ItemMaterials table has records that frontend isn't seeing
- Could be related to failed rollbacks or partial transactions

## Recommendations

### 1. Frontend Fixes Needed

**Always fetch fresh slot occupancy before applying:**
```typescript
// Before applying material
const response = await fetch(`/api/v1/items/${itemId}`);
const item = await response.json();
const occupiedSlots = item.materials?.map(m => m.slot_index) || [];
const availableSlots = [0, 1, 2].filter(slot => !occupiedSlots.includes(slot));

if (availableSlots.length === 0) {
  throw new Error('No available material slots');
}

// Use first available slot
const slotIndex = availableSlots[0];
```

### 2. Backend Enhancement Options

**Option A: Add auto-slot endpoint**
```typescript
// New endpoint: POST /items/:id/materials/apply-auto
// Automatically finds next available slot
```

**Option B: Enhance existing endpoint**
```typescript
// Allow slot_index: -1 to mean "find next available"
if (slotIndex === -1) {
  const occupiedSlots = await this.materialRepository.getSlotOccupancy(itemId);
  const availableSlots = [0, 1, 2].filter(slot => !occupiedSlots.includes(slot));
  if (availableSlots.length === 0) {
    throw new BusinessLogicError('No available material slots');
  }
  slotIndex = availableSlots[0];
}
```

### 3. Debugging Steps

1. **Check database state directly:**
   ```sql
   SELECT im.item_id, im.slot_index, mi.material_id, mi.style_id
   FROM itemmaterials im
   JOIN materialinstances mi ON im.material_instance_id = mi.id
   WHERE im.item_id = 'bathrobe-item-id';
   ```

2. **Add detailed logging to MaterialService.applyMaterial():**
   ```typescript
   console.log('Occupied slots before application:', occupiedSlots);
   console.log('Requested slot index:', slotIndex);
   console.log('Material stack quantity:', materialStack?.quantity);
   ```

3. **Verify frontend is using correct item state:**
   - Check if frontend item state matches backend `/items/:id` response
   - Ensure material applications update local state immediately

## Related Files

### Backend Core Files
- `src/services/MaterialService.ts:99-224` - Apply material logic
- `src/repositories/MaterialRepository.ts:575-593` - Slot occupancy check
- `src/controllers/ItemController.ts:188-214` - Apply material endpoint
- `src/routes/items.ts:62-67` - Apply material route
- `src/types/schemas.ts:30-34` - Request validation

### Database Schema
- `migrations/001_initial_schema.sql:404-418` - ItemMaterials table
- `migrations/005_material_transaction_rpcs.sql:14-108` - Atomic RPC functions

### Tests
- `tests/unit/services/MaterialService.test.ts:495-529` - Slot occupation tests
- `tests/unit/repositories/MaterialRepository.test.ts:434-478` - Repository tests

## Next Steps

1. **Immediate:** Debug frontend material application flow to ensure proper slot selection
2. **Short-term:** Add backend auto-slot selection capability
3. **Long-term:** Consider adding optimistic UI updates with proper rollback handling