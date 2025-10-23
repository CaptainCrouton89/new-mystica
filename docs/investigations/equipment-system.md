# Equipment System Investigation

## Overview
Investigation of the equipment system architecture, data structures, and flow from user interaction to backend storage.

## Key Files and Architecture

### Frontend Equipment Models
- **Equipment.swift**: Defines core equipment models and slot system
  - `SlotName` enum: 8 slots (weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet)
  - `EquipmentState`: Current equipment state with slots dictionary and total stats
  - `Loadout`: Equipment configuration with user preferences
  - Legacy `EquipmentSlots` and `Equipment` models for backward compatibility

- **Enums.swift**: Equipment slot definitions
  - `EquipmentSlot` enum: 8 slots matching SlotName but using enum cases

- **PlayerItem.swift**: Item data structure
  - Contains `category` field that maps to equipment slots
  - Contains `equipmentSlot` field in ItemType for slot assignment

### Frontend Equipment UI
- **EquipmentView.swift**: Main equipment screen
  - 8-slot character-centered layout (head at top, accessories on sides, etc.)
  - Slot tap handling: equipped items → detail modal, empty slots → selection drawer
  - Uses `EquipmentSlotView` components for individual slots

- **EquipmentViewModel.swift**: Equipment state management
  - `categoryMatchesSlot()`: Maps backend categories to frontend slots
  - `getAvailableItemsForSlot()`: Filters inventory items by slot compatibility
  - Equipment operations: equip, unequip, drawer/modal management

### Frontend Equipment Repository
- **DefaultEquipmentRepository.swift**: API communication
  - `fetchEquipment()`: GET /equipment → Equipment model
  - `equipItem()`: POST /equipment/equip with item_id
  - `unequipItem()`: POST /equipment/unequip with slot name

### Backend Equipment System
- **EquipmentService.ts**: Core equipment business logic
  - `getEquippedItems()`: Retrieves all 8 slots with PlayerItem data
  - `equipItem()`: Auto-detects slot from item category, handles conflicts
  - `mapCategoryToSlot()`: Category → slot mapping logic
  - `selectBestAccessorySlot()`: Intelligent accessory slot selection

- **EquipmentController.ts**: HTTP API endpoints
  - GET /equipment: Returns current equipment state
  - POST /equipment/equip: Equips item by item_id (auto-detects slot)
  - POST /equipment/unequip: Unequips item by slot name

- **api.types.ts**: Type definitions
  - `EquipmentSlot` type: 8 slot names as string literals
  - `EquipmentSlots` interface: Maps slot names to PlayerItem objects
  - `PlayerItem` interface: Complete item data with category and stats

## Equipment Slot Definitions

### Frontend (Swift)
```swift
enum EquipmentSlot: String, Codable {
    case weapon, offhand, head, armor, feet
    case accessory_1 = "accessory_1"
    case accessory_2 = "accessory_2"
    case pet
}

enum SlotName: String, Codable, CaseIterable {
    case weapon = "weapon"
    case offhand = "offhand"
    case head = "head"
    case armor = "armor"
    case feet = "feet"
    case accessory1 = "accessory_1"
    case accessory2 = "accessory_2"
    case pet = "pet"
}
```

### Backend (TypeScript)
```typescript
export type EquipmentSlot =
  | 'weapon' | 'offhand' | 'head' | 'armor' | 'feet'
  | 'accessory_1' | 'accessory_2' | 'pet';
```

## Category to Slot Mapping

### Frontend Logic (EquipmentViewModel.swift)
```swift
private func categoryMatchesSlot(category: String, slot: EquipmentSlot) -> Bool {
    let categoryLower = category.lowercased()

    switch slot {
    case .weapon: return categoryLower == "weapon"
    case .offhand: return categoryLower == "offhand"
    case .head: return categoryLower == "head"
    case .armor: return categoryLower == "armor"
    case .feet: return categoryLower == "feet"
    case .accessory_1, .accessory_2: return categoryLower == "accessory"
    case .pet: return categoryLower == "pet"
    }
}
```

### Backend Logic (EquipmentService.ts)
```typescript
private async mapCategoryToSlot(category: string, userId?: string): Promise<string> {
    switch (category) {
        case 'weapon': return 'weapon';
        case 'offhand': return 'offhand';
        case 'head': return 'head';
        case 'armor': return 'armor';
        case 'feet': return 'feet';
        case 'accessory':
            return userId ? await this.selectBestAccessorySlot(userId) : 'accessory_1';
        case 'pet': return 'pet';
        default: throw new Error(`Unknown item category: ${category}`);
    }
}
```

## Equipment Flow: User Taps "Equip"

### 1. User Interaction (EquipmentView.swift)
- User taps empty equipment slot → `handleSlotTap()` → `viewModel.showItemSelection(for: slot)`
- Drawer opens with filtered items via `getAvailableItemsForSlot()`

### 2. Item Selection (EquipmentViewModel.swift)
- `getAvailableItemsForSlot()` filters inventory using `categoryMatchesSlot()`
- User selects item → `equipItemFromInventory()` → `repository.equipItem()`

### 3. API Call (DefaultEquipmentRepository.swift)
- POST /equipment/equip with `{ "item_id": "uuid" }`
- Backend auto-detects slot from item category

### 4. Backend Processing (EquipmentController.ts → EquipmentService.ts)
- `equipItem()` fetches item with ItemType data
- `mapCategoryToSlot()` determines target slot
- For accessories: `selectBestAccessorySlot()` chooses accessory_1 or accessory_2
- `equipmentRepository.equipItemAtomic()` handles database transaction

### 5. Response and State Update
- Backend returns success with slot assignment
- Frontend refreshes equipment and inventory state
- UI updates to show equipped item

## Accessory Slot Selection Strategy

The backend implements intelligent accessory slot selection:

```typescript
private async selectBestAccessorySlot(userId: string): Promise<'accessory_1' | 'accessory_2'> {
    const accessory1 = await this.equipmentRepository.findItemInSlot(userId, 'accessory_1');
    const accessory2 = await this.equipmentRepository.findItemInSlot(userId, 'accessory_2');

    // Fill empty slots first
    if (!accessory1) return 'accessory_1';
    if (!accessory2) return 'accessory_2';

    // Default to accessory_1 if both occupied (will replace)
    return 'accessory_1';
}
```

## Data Structures Summary

### Equipment State (Frontend)
- `EquipmentState.slots`: Dictionary mapping SlotName to EquipmentSlotState
- `EquipmentSlotState`: Contains itemId, slot, and statsBonus
- `Equipment` (legacy): Contains EquipmentSlots with direct PlayerItem references

### Equipment Slots (Backend)
- `EquipmentSlots`: Interface mapping slot names to PlayerItem objects
- `PlayerStats`: Aggregated stats with per-slot contributions
- Database: UserEquipment table with user_id, slot, item_id columns

## Potential Issues

1. **Consistency**: Frontend has both SlotName enum and EquipmentSlot enum with slightly different naming
2. **Legacy Models**: Two equipment model systems (new EquipmentState vs legacy Equipment)
3. **Category Source**: Frontend/backend both rely on item.category field for slot mapping
4. **Accessory Mapping**: Both accessory slots map to same "accessory" category - backend handles slot selection

## Key Dependencies

- Item category field must be set correctly in database
- ItemType.equipment_slot field exists but may not be actively used
- Frontend slot filtering depends on exact category string matching
- Backend uses RPC functions for atomic equip/unequip operations