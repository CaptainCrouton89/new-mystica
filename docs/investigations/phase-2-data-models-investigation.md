# Phase 2 Data Models Investigation

**Investigation Date:** 2025-01-27
**Scope:** iOS SwiftUI frontend data model coverage analysis
**Focus:** Comparing existing Swift models against api-contracts.yaml specifications

## Executive Summary

The iOS frontend has **partial model coverage** with good foundation structures but **significant gaps** in key areas. While basic inventory, equipment, and authentication models exist with proper CodingKeys patterns, the app is missing critical models for combat, loadouts, progression, and complete API response handling.

**Key Findings:**
- ✅ Strong foundation: Equipment, PlayerItem, Material models well-implemented
- ✅ Consistent CodingKeys pattern for snake_case ↔ camelCase conversion
- ❌ **Missing:** Combat session models, loadout management, progression tracking
- ❌ **Missing:** Complete API response wrappers for most endpoints
- ❌ **Gap:** No comprehensive stats aggregation models

## Model Coverage Matrix

| Category | Model Name | Current File | Codable? | CodingKeys? | Completeness | Gaps |
|----------|------------|--------------|----------|-------------|--------------|------|
| **Stats Models** | PlayerStats | Equipment.swift | ✅ | ✅ | 60% | Missing enemy stats, computed stats |
| | ItemStats | PlayerItem.swift | ✅ | ✅ | 100% | Complete |
| **Inventory Models** | PlayerItem | PlayerItem.swift | ✅ | ✅ | 85% | Missing applied_materials array |
| | MaterialStack | Material.swift | ✅ | ✅ | 100% | Complete |
| | Material | Material.swift | ✅ | ✅ | 90% | Missing style_id field |
| **Equipment Models** | Equipment | Equipment.swift | ✅ | ✅ | 80% | Missing generated_image_url |
| | EquipmentSlots | Equipment.swift | ✅ | ✅ | 100% | Complete |
| **Combat Models** | CombatSession | ❌ Missing | ❌ | ❌ | 0% | Complete model missing |
| | Enemy | ❌ Missing | ❌ | ❌ | 0% | Complete model missing |
| | CombatRewards | ❌ Missing | ❌ | ❌ | 0% | Complete model missing |
| **Location Models** | Location | Location.swift | ✅ | ✅ | 90% | Missing enemy_level, distance_meters |
| **Profile Models** | UserProfile | UserProfile.swift | ✅ | ✅ | 70% | Missing total_stats, gold field |
| | User | User.swift | ✅ | Custom decoder | 90% | Custom decoder used instead of CodingKeys |
| **Loadout Models** | Loadout | ❌ Missing | ❌ | ❌ | 0% | Complete model missing |
| **Progression Models** | PlayerProgression | ❌ Missing | ❌ | ❌ | 0% | Complete model missing |

## Detailed Analysis by Category

### 1. Stats Models (60% Complete)

**Current Implementation:**
```swift
// Equipment.swift:11-23
struct PlayerStats: Codable {
    let totalStats: ItemStats
    let itemContributions: [String: ItemStats]
    let equippedItemsCount: Int
    let totalItemLevel: Int

    enum CodingKeys: String, CodingKey {
        case totalStats = "total_stats"
        case itemContributions = "item_contributions"
        case equippedItemsCount = "equipped_items_count"
        case totalItemLevel = "total_item_level"
    }
}

// PlayerItem.swift:60-69
struct ItemStats: Codable {
    let atkPower: Double
    let atkAccuracy: Double
    let defPower: Double
    let defAccuracy: Double

    enum CodingKeys: String, CodingKey {
        case atkPower, atkAccuracy, defPower, defAccuracy
    }
}
```

**API Contract Comparison:**
- ✅ ItemStats matches api-contracts.yaml exactly
- ❌ Missing Enemy stats model for combat
- ❌ Missing computed_stats field in PlayerItem

### 2. Inventory Models (85% Complete)

**Current Implementation:**
```swift
// PlayerItem.swift:10-36
struct PlayerItem: Codable {
    let id: UUID
    let userId: UUID
    let itemTypeId: UUID
    let level: Int
    let baseStats: ItemStats
    let currentStats: ItemStats
    let materialComboHash: String?
    let imageUrl: String?
    let itemType: ItemType?
    let createdAt: String
    let updatedAt: String
    // Missing: applied_materials array, image_generation_status, craft_count, is_styled
}
```

**Gaps Found:**
- Missing `applied_materials` array (critical for F-04 material system)
- Missing `image_generation_status` enum field
- Missing `craft_count` and `is_styled` fields
- Current implementation uses separate `currentStats` instead of `computed_stats`

### 3. Equipment Models (80% Complete)

**Current Implementation:**
```swift
// Equipment.swift:25-54
struct EquipmentSlots: Codable {
    let weapon: PlayerItem?
    let offhand: PlayerItem?
    let head: PlayerItem?
    let armor: PlayerItem?
    let feet: PlayerItem?
    let accessory1: PlayerItem?
    let accessory2: PlayerItem?
    let pet: PlayerItem?

    enum CodingKeys: String, CodingKey {
        case weapon, offhand, head, armor, feet, pet
        case accessory1 = "accessory_1"
        case accessory2 = "accessory_2"
    }
}
```

**Gaps Found:**
- Missing `generated_image_url` field in Equipment model
- Model structure matches API but missing some response fields

### 4. Combat Models (0% Complete)

**Critical Gap:** No combat models exist despite active BattleView implementation.

**Missing Models:**
```swift
// Needed based on api-contracts.yaml
struct CombatSession {
    let session_id: UUID
    let enemy: Enemy
    let player_stats: ItemStats
}

struct Enemy {
    let level: Int
    let stats: ItemStats
    let gold_min: Int
    let gold_max: Int
    let material_drop_pool: [String]
}

struct CombatRewards {
    let gold: Int
    let material: MaterialDrop?
}
```

### 5. Location & World Models (90% Complete)

**Current Implementation:**
```swift
// Location.swift:10-30
struct Location: Codable, Identifiable {
    let id: UUID
    let lat: Double
    let lng: Double
    let locationType: String?
    let name: String?
    let countryCode: String?
    let stateCode: String?
    let createdAt: String
    // Missing: enemy_level, distance_meters, material_drop_pool
}
```

### 6. Profile & Progression Models (70% Complete)

**Current Implementation:**
```swift
// UserProfile.swift:10-28
struct UserProfile: Codable {
    let userId: UUID
    let username: String
    let currencyBalance: Int  // Should be 'gold' per API
    let vanityLevel: Int
    let avgItemLevel: Float
    let createdAt: Date
    let lastLogin: Date?
    // Missing: total_stats object
}
```

**Missing Entirely:**
- PlayerProgression model for F-08 progression system
- Currency balances array (new API structure)

## CodingKeys Pattern Analysis

**Consistent Pattern Found:**
All models follow proper snake_case ↔ camelCase conversion:

```swift
enum CodingKeys: String, CodingKey {
    case userId = "user_id"
    case itemTypeId = "item_type_id"
    case materialComboHash = "material_combo_hash"
    // etc.
}
```

**Exception:** User.swift uses custom decoder instead of CodingKeys (lines 20-57), which is more complex than needed.

## API Response Wrapper Analysis

**Current Status:**
- APIResponses.swift contains some response models (EquipResult, ApplyMaterialResult, etc.)
- Generic ApiResponse<T> wrapper exists but isn't used consistently
- Missing response models for most endpoints

**Critical Missing Wrappers:**
- Combat session responses
- Loadout management responses
- Progression/leveling responses
- Nearby locations response

## Supporting Infrastructure

**Strengths:**
- Loadable<T> enum for async state management (Loadable.swift)
- AppError enum for typed error handling (AppError.swift)
- Repository pattern established (AuthRepository, EquipmentRepository)

**Architecture Pattern:**
```swift
enum Loadable<T> {
    case idle
    case loading
    case loaded(T)
    case error(AppError)
}
```

## Recommendations for Phase 2 Completion

### Priority 1: Combat System Models
1. Create CombatSession, Enemy, CombatRewards models
2. Add combat status enums (ongoing, victory, defeat)
3. Create combat response wrappers

### Priority 2: Complete Existing Models
1. Add missing fields to PlayerItem (applied_materials array)
2. Update Location model with enemy_level, distance_meters
3. Fix UserProfile to match API (gold instead of currencyBalance)

### Priority 3: Loadout System Models
1. Create Loadout model for F-09 loadout management
2. Add loadout response wrappers
3. Create SlotName enum with 8 values

### Priority 4: Progression Models
1. Create PlayerProgression model for F-08
2. Add progression response wrappers
3. Create currency balance models (new structure)

### Priority 5: API Response Consistency
1. Standardize all endpoints to use ApiResponse<T> wrapper
2. Create missing response models for each endpoint category
3. Update User.swift to use CodingKeys instead of custom decoder

## Implementation Strategy

1. **Start with Combat Models** - Required for existing BattleView functionality
2. **Extend PlayerItem** - Add applied_materials array for material system
3. **Create Loadout Models** - Needed for F-09 feature completion
4. **Add Progression Models** - Needed for F-08 feature completion
5. **Standardize Response Handling** - Create comprehensive response wrappers

## Code Snippets: Key Findings

**Good CodingKeys Pattern (Material.swift:19-27):**
```swift
enum CodingKeys: String, CodingKey {
    case id, name, rarity, theme, description
    case statModifiers = "stat_modifiers"
    case imageUrl = "image_url"
}
```

**Missing Applied Materials (should be in PlayerItem):**
```swift
let applied_materials: [AppliedMaterial]  // Missing from current PlayerItem
```

**Custom Decoder Complexity (User.swift:21-57):**
The User model uses a complex custom decoder when simple CodingKeys would suffice, adding unnecessary complexity.

---

**Next Steps:** Prioritize combat model creation to support existing UI, then systematically add missing models following the established CodingKeys pattern.