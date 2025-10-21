# Material Service Method Specification

**Document Version**: 1.0
**Last Updated**: 2025-01-27
**Related Features**: F-04 Materials System, F-05 Material Drop System
**Target Release**: MVP0/1

## Overview

This specification defines the complete MaterialService and MaterialController implementation for the New Mystica materials system. The service handles material inventory management, application to items, replacement workflows, and integration with the global image generation cache.

### Critical Schema Alignment Issue

**⚠️ SCHEMA MISMATCH IDENTIFIED**: The current codebase has a divergence between the database schema and TypeScript types:

- **Database Schema**: Uses `style_id: UUID` referencing `StyleDefinitions` table
- **TypeScript Code**: Uses `is_shiny: boolean` in schemas and types
- **API Contract**: Uses `style_id` correctly

**Resolution Required**: Update all TypeScript code to use `style_id` consistently with the database schema.

## Service Layer Architecture

### MaterialService Public Methods

The MaterialService implements the following public interface:

```typescript
export class MaterialService {
  // Template library methods (no auth required)
  async getAllMaterials(): Promise<Material[]>

  // User inventory methods (auth required)
  async getMaterialInventory(userId: string): Promise<MaterialStackWithTemplate[]>

  // Material application methods (auth required)
  async applyMaterial(request: ApplyMaterialRequest): Promise<ApplyMaterialResult>
  async replaceMaterial(request: ReplaceMaterialRequest): Promise<ReplaceMaterialResult>

  // Internal utility methods
  private async computeComboHash(itemId: string): Promise<string>
  private async updateItemImageAndStats(itemId: string, comboHash: string): Promise<void>
  private async validateMaterialApplication(request: ApplyMaterialRequest): Promise<void>
  private async validateMaterialReplacement(request: ReplaceMaterialRequest): Promise<void>
}
```

## Method Specifications

### 1. getAllMaterials()

**Purpose**: Returns the complete material template library for client-side display.

**Authentication**: None required (public data)

**Implementation**:
```typescript
async getAllMaterials(): Promise<Material[]> {
  return await this.materialRepository.findAllMaterials();
}
```

**Response Contract**:
- Returns array of Material objects from seed data
- Includes: id, name, description, stat_modifiers, theme
- Ordered by name alphabetically
- No user-specific data included

**Error Handling**:
- DatabaseError: Re-throw with context
- No specific business logic errors

### 2. getMaterialInventory(userId: string)

**Purpose**: Returns user's material inventory with stackable quantities grouped by (material_id, style_id).

**Authentication**: Required (user-specific data)

**Implementation**:
```typescript
async getMaterialInventory(userId: string): Promise<MaterialStackWithTemplate[]> {
  // 1. Validate user exists and is authenticated
  // 2. Query MaterialStacks for user_id with material template join
  // 3. Filter quantity > 0
  // 4. Return enriched stack data with material template info

  const stacks = await this.materialRepository.findAllStacksByUser(userId);

  // Enrich with material template data
  const enrichedStacks = await Promise.all(
    stacks.map(async (stack) => {
      const material = await this.materialRepository.findMaterialById(stack.material_id);
      return {
        ...stack,
        material: material!
      };
    })
  );

  return enrichedStacks;
}
```

**Response Contract**:
- Array of MaterialStack objects with nested Material templates
- Includes: user_id, material_id, style_id, quantity, material template
- Only stacks with quantity > 0
- Ordered by material_id

**Error Handling**:
- 401 Unauthorized: If user context invalid
- DatabaseError: Re-throw with context

### 3. applyMaterial(request: ApplyMaterialRequest)

**Purpose**: Applies material from user's stack to item slot with image generation.

**Authentication**: Required (user-specific operation)

**Request Schema**:
```typescript
interface ApplyMaterialRequest {
  userId: string;      // From auth context
  itemId: string;      // Target item UUID
  materialId: string;  // Material template ID
  styleId: string;     // Style ID (normal, pixel_art, etc.)
  slotIndex: number;   // Slot 0-2
}
```

**Implementation Workflow**:

```typescript
async applyMaterial(request: ApplyMaterialRequest): Promise<ApplyMaterialResult> {
  // Step 1: Validate request data
  await this.validateMaterialApplication(request);

  // Step 2: Atomic material application via repository RPC
  const { instance, newStackQuantity } = await this.materialRepository
    .applyMaterialToItemAtomic(
      request.userId,
      request.itemId,
      request.materialId,
      request.styleId,
      request.slotIndex
    );

  // Step 3: Compute new combo hash
  const comboHash = await this.computeComboHash(request.itemId);

  // Step 4: Check/create image cache entry
  let cacheEntry = await this.imageCacheRepository
    .findByComboHash(request.itemId, comboHash);

  let isFirstCraft = false;
  let imageUrl: string;

  if (!cacheEntry) {
    // Step 5a: Generate new image (20s sync in MVP0)
    isFirstCraft = true;
    imageUrl = await this.imageGenerationService.generateComboImage({
      itemTypeId: request.itemId,
      materialIds: extractMaterialIds,
      styleIds: extractStyleIds
    });

    // Step 5b: Create cache entry
    cacheEntry = await this.imageCacheRepository.createCacheEntry({
      item_type_id: request.itemId,
      combo_hash: comboHash,
      image_url: imageUrl,
      provider: 'gemini' // or from config
    });
  } else {
    // Step 5c: Use cached image and increment count
    imageUrl = cacheEntry.image_url;
    await this.imageCacheRepository.incrementCraftCount(cacheEntry.id);
  }

  // Step 6: Update item with new hash and image
  await this.updateItemImageAndStats(request.itemId, comboHash, imageUrl);

  // Step 7: Fetch updated item for response
  const updatedItem = await this.itemRepository.findById(request.itemId);

  return {
    success: true,
    updated_item: updatedItem!,
    is_first_craft: isFirstCraft,
    craft_count: cacheEntry.craft_count,
    image_url: imageUrl,
    materials_consumed: [{
      material_id: request.materialId,
      style_id: request.styleId,
      quantity: 1
    }]
  };
}
```

**Validation Rules** (`validateMaterialApplication`):
1. User owns the target item
2. Item has < 3 materials applied (max limit)
3. Slot index is 0-2 and not occupied
4. User has >= 1 quantity of material+style in MaterialStacks
5. Material template exists in seed data
6. Style ID exists in StyleDefinitions

**Error Handling**:
- 400 Bad Request: Validation failures (slot occupied, insufficient materials, max 3 materials)
- 404 Not Found: Item or material not found
- 423 Locked: Image generation in progress (if async implementation)
- DatabaseError: Transaction failures, constraint violations

### 4. replaceMaterial(request: ReplaceMaterialRequest)

**Purpose**: Replaces existing material in slot, returns old material to stack, costs gold.

**Authentication**: Required (user-specific operation)

**Request Schema**:
```typescript
interface ReplaceMaterialRequest {
  userId: string;         // From auth context
  itemId: string;         // Target item UUID
  slotIndex: number;      // Slot 0-2 to replace
  newMaterialId: string;  // New material template ID
  newStyleId: string;     // New style ID
  goldCost: number;       // Expected cost for confirmation
}
```

**Implementation Workflow**:

```typescript
async replaceMaterial(request: ReplaceMaterialRequest): Promise<ReplaceMaterialResult> {
  // Step 1: Validate replacement request
  await this.validateMaterialReplacement(request);

  // Step 2: Calculate actual gold cost and validate
  const actualCost = await this.calculateReplacementCost(request.itemId, request.slotIndex);
  if (actualCost !== request.goldCost) {
    throw new BusinessLogicError(`Gold cost mismatch: expected ${actualCost}, got ${request.goldCost}`);
  }

  // Step 3: Check user gold balance
  const userProfile = await this.profileRepository.findByUserId(request.userId);
  if (userProfile.gold < actualCost) {
    throw new BusinessLogicError(`Insufficient gold: have ${userProfile.gold}, need ${actualCost}`);
  }

  // Step 4: Atomic replacement via repository RPC
  const { oldInstance, newInstance, oldStackQuantity, newStackQuantity } =
    await this.materialRepository.replaceMaterialOnItemAtomic(
      request.userId,
      request.itemId,
      request.slotIndex,
      request.newMaterialId,
      request.newStyleId
    );

  // Step 5: Deduct gold from user
  await this.profileRepository.updateGoldBalance(request.userId, -actualCost);

  // Step 6: Compute new combo hash and update image
  const comboHash = await this.computeComboHash(request.itemId);
  await this.updateItemImageAndStats(request.itemId, comboHash);

  // Step 7: Fetch updated item for response
  const updatedItem = await this.itemRepository.findById(request.itemId);

  return {
    success: true,
    updated_item: updatedItem!,
    gold_spent: actualCost,
    replaced_material: {
      id: oldInstance.id,
      material_id: oldInstance.material_id,
      style_id: oldInstance.style_id,
      slot_index: request.slotIndex
    },
    refunded_material: {
      material_id: oldInstance.material_id,
      style_id: oldInstance.style_id,
      quantity: oldStackQuantity
    }
  };
}
```

**Validation Rules** (`validateMaterialReplacement`):
1. User owns the target item
2. Slot index is 0-2 and currently occupied
3. User has >= 1 quantity of new material+style in MaterialStacks
4. New material template exists in seed data
5. New style ID exists in StyleDefinitions
6. User has sufficient gold for replacement cost

**Gold Cost Calculation**:
```typescript
private async calculateReplacementCost(itemId: string, slotIndex: number): Promise<number> {
  const item = await this.itemRepository.findById(itemId);
  return 100 * item.level; // Base formula from F-04 spec
}
```

**Error Handling**:
- 400 Bad Request: Validation failures (insufficient gold, slot empty, material unavailable)
- 404 Not Found: Item not found or not owned by player
- DatabaseError: Transaction failures

## Utility Methods

### computeComboHash(itemId: string)

**Purpose**: Computes deterministic hash for current material combination on item.

**Implementation**:
```typescript
private async computeComboHash(itemId: string): Promise<string> {
  // 1. Query ItemMaterials with MaterialInstance joins for the item
  const appliedMaterials = await this.materialRepository.findMaterialsByItem(itemId);

  // 2. Extract material IDs and style IDs in slot order
  const materialIds = appliedMaterials
    .sort((a, b) => a.slot_index - b.slot_index)
    .map(am => am.material_instance.material_id);

  const styleIds = appliedMaterials
    .sort((a, b) => a.slot_index - b.slot_index)
    .map(am => am.material_instance.style_id);

  // 3. Use hash utility with style flags (not boolean shiny flags)
  return computeComboHashWithStyles(materialIds, styleIds);
}
```

**Note**: This requires updating the hash utility to work with `style_id` instead of `is_shiny`.

### updateItemImageAndStats(itemId: string, comboHash: string, imageUrl?: string)

**Purpose**: Updates item with new combo hash, image URL, and computed stats.

**Implementation**:
```typescript
private async updateItemImageAndStats(
  itemId: string,
  comboHash: string,
  imageUrl?: string
): Promise<void> {
  // 1. Compute new stats from base item + material modifiers
  const computedStats = await this.statsCalculationService.computeItemStats(itemId);

  // 2. Determine if item is styled (any material has style_id != 'normal')
  const appliedMaterials = await this.materialRepository.findMaterialsByItem(itemId);
  const isStyled = appliedMaterials.some(am => am.material_instance.style_id !== 'normal');

  // 3. Update item record
  await this.itemRepository.update(itemId, {
    material_combo_hash: comboHash,
    generated_image_url: imageUrl || null,
    is_styled: isStyled,
    current_stats: computedStats
  });
}
```

## Controller Layer Integration

### MaterialController Methods

The MaterialController provides REST API endpoints that delegate to MaterialService:

```typescript
export class MaterialController {
  // GET /materials
  async getMaterials(req: Request, res: Response): Promise<void> {
    const materials = await this.materialService.getAllMaterials();
    res.json({ materials });
  }

  // GET /materials/inventory
  async getInventory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const inventory = await this.materialService.getMaterialInventory(req.user.id);
    res.json({ materials: inventory });
  }

  // POST /items/:item_id/materials/apply
  async applyMaterial(req: ValidatedRequest<ApplyMaterialRequest>, res: Response): Promise<void> {
    const request = {
      userId: req.user.id,
      itemId: req.params.item_id,
      ...req.validated.body
    };

    const result = await this.materialService.applyMaterial(request);
    res.json(result);
  }

  // POST /items/:item_id/materials/replace
  async replaceMaterial(req: ValidatedRequest<ReplaceMaterialRequest>, res: Response): Promise<void> {
    const request = {
      userId: req.user.id,
      itemId: req.params.item_id,
      ...req.validated.body
    };

    const result = await this.materialService.replaceMaterial(request);
    res.json(result);
  }
}
```

## Database Integration Points

### Required Repository Methods

**MaterialRepository** (✅ Already Implemented):
- `findAllMaterials()` - Material templates
- `findAllStacksByUser(userId)` - User inventory
- `applyMaterialToItemAtomic()` - Atomic application via RPC
- `replaceMaterialOnItemAtomic()` - Atomic replacement via RPC
- `findMaterialsByItem(itemId)` - Applied materials

**ImageCacheRepository** (✅ Already Implemented):
- `findByComboHash(itemTypeId, comboHash)` - Cache lookup
- `createCacheEntry(data)` - New cache entry
- `incrementCraftCount(cacheId)` - Atomic increment

**ItemRepository** (⚠️ Needs Method):
- `update(itemId, data)` - Update item stats/hash/image

**ProfileRepository** (⚠️ Needs Method):
- `updateGoldBalance(userId, amount)` - Deduct gold for replacement

### Required RPC Functions

The following PostgreSQL RPC functions must be implemented to ensure atomic transactions:

1. **apply_material_to_item**(p_user_id, p_item_id, p_material_id, p_style_id, p_slot_index)
   - Decrements MaterialStacks quantity
   - Creates MaterialInstance
   - Creates ItemMaterials junction
   - Returns instance_id and new_stack_quantity

2. **replace_material_on_item**(p_user_id, p_item_id, p_slot_index, p_new_material_id, p_new_style_id)
   - Removes old ItemMaterials/MaterialInstance
   - Increments MaterialStacks for old material
   - Decrements MaterialStacks for new material
   - Creates new MaterialInstance and ItemMaterials
   - Returns old/new instance data and stack quantities

3. **increment_image_cache_craft_count**(p_cache_id)
   - Atomically increments craft_count
   - Returns new count value

## Image Generation Integration

### ImageGenerationService Interface

```typescript
interface ImageGenerationService {
  async generateComboImage(request: GenerateComboImageRequest): Promise<string>;
}

interface GenerateComboImageRequest {
  itemTypeId: string;
  materialIds: string[];
  styleIds: string[];
}
```

**Implementation Notes**:
- MVP0: 20-second synchronous generation (blocks API response)
- Later MVP: Async generation with status polling
- Must upload to R2 at `items-crafted/{item_type_slug}/{combo_hash}.png`
- Returns public R2 URL

## Error Handling Patterns

### Service Layer Errors

```typescript
// Business logic violations
throw new BusinessLogicError('Item already has 3 materials (max reached)');
throw new BusinessLogicError(`Insufficient materials: have ${quantity}, need 1`);
throw new BusinessLogicError(`Insufficient gold: have ${userGold}, need ${cost}`);

// Resource not found
throw new NotFoundError('Item', itemId);
throw new NotFoundError('Material', materialId);

// Validation failures
throw new ValidationError('Slot index must be between 0 and 2');
throw new ValidationError('Material not owned or quantity = 0');

// External service errors
throw new ExternalServiceError('Image generation failed', originalError);
```

### HTTP Status Code Mapping

- **400 Bad Request**: BusinessLogicError, ValidationError
- **401 Unauthorized**: Authentication failures
- **404 Not Found**: NotFoundError
- **423 Locked**: Image generation in progress (async implementation)
- **500 Internal Server Error**: DatabaseError, ExternalServiceError

## Performance Considerations

### Optimization Strategies

1. **Batch Database Operations**: Use repository RPC functions for atomic multi-table operations
2. **Cache Image Lookups**: Check ItemImageCache before expensive generation
3. **Lazy Image Generation**: Consider async generation for better UX in later MVPs
4. **Index Utilization**: Ensure indexes on MaterialStacks composite PK and ItemMaterials lookups

### Expected Performance

- **Material Application**: ~200-500ms (excluding image generation)
- **Image Generation**: ~20s sync in MVP0 (blocking)
- **Material Replacement**: ~100-300ms (excluding image generation)
- **Inventory Retrieval**: ~50-100ms

## Testing Strategy

### Unit Tests Required

1. **MaterialService.applyMaterial()**
   - Happy path with cache hit/miss
   - Validation error scenarios
   - Transaction rollback on failures

2. **MaterialService.replaceMaterial()**
   - Happy path with gold deduction
   - Insufficient gold scenarios
   - Slot validation errors

3. **Hash Computation**
   - Order-insensitive hashing
   - Style ID inclusion in hash
   - Empty material arrays

### Integration Tests Required

1. **End-to-End Material Application**
   - Full API request through database persistence
   - Image generation mock/stub
   - Cache increment verification

2. **Atomic Transaction Testing**
   - RPC function rollback behavior
   - Concurrent modification handling
   - Data consistency validation

## Implementation Priority

### Phase 1: Core Service Methods
1. Fix schema mismatch (is_shiny → style_id) ⚠️ **CRITICAL**
2. Implement MaterialService.getAllMaterials()
3. Implement MaterialService.getMaterialInventory()
4. Update hash utilities for style_id support

### Phase 2: Material Application
1. Implement MaterialService.applyMaterial()
2. Implement missing repository methods (ItemRepository.update)
3. Create database RPC functions
4. Integration with ImageGenerationService

### Phase 3: Material Replacement
1. Implement MaterialService.replaceMaterial()
2. Implement ProfileRepository.updateGoldBalance()
3. Gold cost calculation logic
4. End-to-end testing

### Phase 4: Controller Integration
1. Wire MaterialController endpoints
2. Add route registration
3. Error handling middleware
4. API testing

This specification provides a complete implementation guide for the MaterialService with emphasis on atomic transactions, proper error handling, and alignment with the existing database schema.

## See Also

### Related Service Specifications
- **[ImageGenerationService](./image-generation-service-spec.md)** - AI image generation for material combo images
- **[ItemService](./item-service-spec.md)** - Item stat updates and material application integration
- **[ProfileService](./profile-service-spec.md)** - Gold balance updates for material replacement costs
- **[InventoryService](./inventory-service-spec.md)** - Material stack inventory display

### Missing Repository Methods
- **ItemRepository.update()** ⚠️ NOT IMPLEMENTED - Update item stats/hash/image after material changes
- **ProfileRepository.updateGoldBalance()** ⚠️ NOT IMPLEMENTED - Gold deduction for replacement operations

### Cross-Referenced Features
- **F-04**: Materials System (primary feature)
- **F-05**: Material Drop System (loot generation integration)
- **F-03**: Base Items & Equipment (material application to items)
- **F-06**: Item Upgrade System (material effects on upgraded items)