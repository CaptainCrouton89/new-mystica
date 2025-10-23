# Crafting Flow Investigation

## Summary

Investigation of the crafting request-response flow to understand the "Decoding error: The data couldn't be read because it is missing" SwiftUI error.

**Key Finding**: There is a significant mismatch between what the backend returns and what the frontend expects for the craft material API response.

## Data Flow Analysis

### 1. Frontend Request Flow

**CraftingViewModel.swift:173-178**
```swift
let response = try await inventoryRepository.applyMaterial(
    itemId: item.id,
    materialId: material.materialId,
    styleId: material.styleId,
    slotIndex: 0 // Always use first available slot
)
```

**Expected Return**: Direct `EnhancedPlayerItem` object

### 2. Repository Layer (Frontend)

**DefaultInventoryRepository.swift:54-89**
```swift
func applyMaterial(itemId: String, materialId: String, styleId: String, slotIndex: Int) async throws -> EnhancedPlayerItem {
    // Internal response struct
    struct ApplyMaterialResponse: Decodable {
        let success: Bool
        let item: EnhancedPlayerItem  // ← Expects "item" field

        enum CodingKeys: String, CodingKey {
            case success
            case item
        }
    }

    let response: ApplyMaterialResponse = try await apiClient.post(
        endpoint: "/items/\(itemId)/materials/apply",
        body: request
    )

    return response.item
}
```

### 3. Backend Response Structure

**ItemController.ts:202-210** (what backend actually returns)
```typescript
res.json({
    success: result.success,
    item: result.updated_item,        // ← Returns "item" field...
    stats: result.updated_item.current_stats,
    image_url: result.image_url,
    is_first_craft: result.is_first_craft,
    total_crafts: result.craft_count,
    materials_consumed: result.materials_consumed
});
```

**BUT MaterialService Returns** (`ApplyMaterialResult` interface):
```typescript
export interface ApplyMaterialResult {
    success: boolean;
    updated_item: Item;               // ← Field name is "updated_item"
    is_first_craft: boolean;
    craft_count: number;
    image_url: string;
    materials_consumed: MaterialStackDetailed[];
    message?: string;
}
```

## Root Cause Identified

**The Issue**: Field name mismatch in backend controller
- Backend service returns `ApplyMaterialResult` with field `updated_item`
- Backend controller maps this to `item: result.updated_item`
- **But then also sends additional fields alongside the `item` field**
- Frontend expects a clean `{ success: Bool, item: EnhancedPlayerItem }` structure
- Frontend gets `{ success, item, stats, image_url, is_first_craft, total_crafts, materials_consumed }`

**The Decoding Error Source**:
Frontend `ApplyMaterialResponse` struct only defines `success` and `item` fields, but backend sends additional fields (`stats`, `image_url`, `is_first_craft`, `total_crafts`, `materials_consumed`) that aren't accounted for in the Decodable struct.

## Data Model Mapping Issues

### Backend `Item` vs Frontend `EnhancedPlayerItem`

**Backend Item interface** (api.types.ts:40-54):
```typescript
export interface Item {
  id: string;
  user_id: string;
  item_type_id: string;
  level: number;
  base_stats: Stats;
  current_stats: Stats;
  material_combo_hash?: string;
  image_url?: string;
  is_styled?: boolean;
  materials?: AppliedMaterial[];
  item_type?: ItemType;
  created_at: string;
  updated_at: string;
}
```

**Frontend EnhancedPlayerItem** (Inventory.swift:20-55):
```swift
struct EnhancedPlayerItem: APIModel, Hashable {
    let id: String
    let baseType: String              // ← Missing in backend Item
    let itemTypeId: String           // item_type_id
    let category: String             // ← Missing in backend Item
    let level: Int
    let rarity: String               // ← Missing in backend Item
    let appliedMaterials: [ItemMaterialApplication]  // materials
    let materials: [ItemMaterialApplication]
    let computedStats: ItemStats     // current_stats
    let materialComboHash: String?   // material_combo_hash
    let generatedImageUrl: String?   // image_url
    let imageGenerationStatus: ImageGenerationStatus?  // ← Missing in backend
    let craftCount: Int              // ← Missing in backend Item
    let isStyled: Bool              // is_styled
    let isEquipped: Bool            // ← Missing in backend Item
    let equippedSlot: String?       // ← Missing in backend Item
}
```

**Critical Missing Fields**: The backend `Item` interface is missing several fields that `EnhancedPlayerItem` expects, which would cause decoding failures even if the wrapper structure was correct.

## Related Files

### Frontend Files
- `New-Mystica/ViewModels/CraftingViewModel.swift:173` - Makes applyMaterial call
- `New-Mystica/Repositories/Implementations/DefaultInventoryRepository.swift:54-89` - Repository implementation
- `New-Mystica/Models/Inventory.swift:20-55` - EnhancedPlayerItem definition
- `New-Mystica/Models/APIResponses.swift:28-46` - ApplyMaterialResult struct (unused for this endpoint)

### Backend Files
- `mystica-express/src/controllers/ItemController.ts:188-214` - applyMaterial endpoint
- `mystica-express/src/services/MaterialService.ts:99-105` - Service method signature
- `mystica-express/src/types/api.types.ts:251-259` - ApplyMaterialResult interface
- `mystica-express/src/types/api.types.ts:40-54` - Item interface
- `mystica-express/src/routes/items.ts:63-67` - Route definition

## Issues to Resolve

1. **Response Structure Mismatch**: Backend sends extra fields not expected by frontend Decodable struct
2. **Field Name Inconsistency**: Backend uses `updated_item` internally but maps to `item`
3. **Model Incompatibility**: Backend `Item` missing fields required by frontend `EnhancedPlayerItem`
4. **Unused Response Model**: Frontend has `ApplyMaterialResult` in APIResponses.swift but uses custom struct instead

## Next Steps

The investigation identifies multiple layers of incompatibility between frontend expectations and backend implementation that need to be resolved to fix the decoding error.