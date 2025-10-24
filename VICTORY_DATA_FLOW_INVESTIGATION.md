# Victory Screen Data Flow Investigation

## Executive Summary

The victory screen receives combat rewards data that flows through three layers:

1. **Backend** generates rewards in `CombatService.completeCombatInternal()`
2. **Frontend Repository** (`DefaultCombatRepository`) receives `CombatRewards` from API endpoints
3. **Frontend State** stores rewards in `AppState.combatRewards` for `VictoryView` display

The data structure is **fully complete** and matches across all layers, with specific fields for items (including description, base_stats, appearance_data) and materials (with style inheritance).

---

## Backend Victory Response Structure

### Response Origin
- **Location**: `mystica-express/src/services/CombatService.ts:639-746`
- **Method**: `completeCombatInternal(sessionId, result, session)`
- **Triggered by**: Combat ending via attack/defense actions (lines 442-451, 582-591)
- **Route Handler**: `POST /combat/complete` → `CombatController.completeCombat()` → `CombatService.completeCombat()` → `completeCombatInternal()`

### CombatRewards Interface (Backend)
**File**: `mystica-express/src/services/CombatService.ts:120-171`

```typescript
export interface CombatRewards {
  result: 'victory' | 'defeat';

  // Victory-only fields
  currencies?: {
    gold: number;
  };

  materials?: Array<{
    material_id: string;      // UUID from Materials table
    name: string;              // Display name
    style_id: string;          // Inherited from enemy
    style_name: string;        // Display name of style
  }>;

  items?: Array<{
    item_type_id: string;      // UUID from ItemTypes table
    name: string;              // Display name
    category: string;          // weapon|armor|accessory|...
    rarity: string;            // common|uncommon|rare|epic|legendary
    style_id: string;          // Inherited from enemy
    style_name: string;        // Display name of style
    // Extended fields in actual generation (see below)
    description?: string;
    base_stats?: any;
    appearance_data?: any;
  }>;

  experience?: number;

  combat_history: {
    location_id: string;
    total_attempts: number;
    victories: number;
    defeats: number;
    current_streak: number;
    longest_streak: number;
  };
}
```

### Actual Loot Generation (Complete Field List)

**Location**: `mystica-express/src/services/CombatService.ts:1514-1571`

#### Materials Array Structure
```typescript
const materials = [
  {
    material_id: string;           // UUID
    name: string;                  // Material display name (from Materials table)
    description?: string;          // Optional material description
    stat_modifiers?: any;          // Optional stats
    style_id: string;              // Enemy's style ID (inherited)
    style_name: string;            // Enemy's style name (inherited)
  }
];
```
**Source**: Fetched via `MaterialRepository.findByIds()` (line 1505)

#### Items Array Structure
```typescript
const items = [
  {
    item_type_id: string;          // UUID from ItemTypes table
    name: string;                  // Item type name
    category: string;              // weapon|armor|accessory|... (from ItemTypes)
    rarity: string;                // common|uncommon|rare|epic|legendary (from ItemTypes)
    description?: string;          // Optional item description
    base_stats?: any;              // Optional normalized base stats (base_stats_normalized from ItemTypes)
    appearance_data?: any;         // Optional appearance JSON (appearance_data from ItemTypes)
    style_id: string;              // Enemy's style ID (inherited, line 1568)
    style_name: string;            // Enemy's style name (inherited, line 1569)
  }
];
```
**Source**: Fetched via `ItemTypeRepository.findByIds()` (line 1533)

### Data Generation Flow (Backend)

1. **Victory Trigger** (Line 664-730):
   - `completeCombatInternal()` called with combat result
   - Calls `generateLoot(locationId, combatLevel, enemyTypeId)` for victory

2. **Loot Pool Matching** (Line 1392-1398):
   - Gets matching loot pools from `LocationService.getMatchingLootPools()`
   - Loot pools determine which items/materials can drop

3. **Loot Selection** (Line 1481-1490):
   - Calls `LocationService.selectRandomLoot()` with pool entries and tier weights
   - Selects 1-3 random drops (both materials and items mixed)
   - Each drop marked as `type: 'material'` or `type: 'item'`

4. **Batch Data Fetching**:
   - **Materials** (Line 1505): `MaterialRepository.findByIds(materialIds)`
   - **ItemTypes** (Line 1533): `ItemTypeRepository.findByIds(itemTypeIds)`

5. **Style Inheritance**:
   - Enemy's style fetched at line 1387-1388
   - Style name fetched at line 1493
   - Both applied to all drops (lines 1527-1528, 1568-1569)

6. **Persistence** (Line 667-711):
   - Materials created: `MaterialRepository.createStack(userId, materialId, styleId, 1)`
   - Items created: `ItemRepository.create({userId, itemTypeId, level})`
   - **Note**: Item level set to `combatLevel` (line 696)

7. **Return Structure** (Line 713-730):
   ```typescript
   {
     result: 'victory',
     currencies: { gold: <amount> },
     materials: [<see structure above>],
     items: [<see structure above>],
     experience: <combatLevel * 15>,
     combat_history: {
       location_id: string,
       total_attempts: number,
       victories: number,
       defeats: number,
       current_streak: number,
       longest_streak: number
     }
   }
   ```

### Combat Completion Points (When Rewards Sent)

**Attack or Defense Action Completion** (Lines 442-451, 582-591):
- When enemy HP ≤ 0 or player HP ≤ 0
- Calls `completeCombatInternal()` synchronously
- Returns `CombatRewards` in `AttackResult.rewards` or `DefenseResult.rewards`
- Response structure includes: `hit_zone, base_multiplier, damage_dealt, player_hp_remaining, enemy_hp_remaining, combat_status, turn_number, rewards`

**Manual Complete Endpoint** (POST /combat/complete):
- Called separately if needed
- Returns `CombatRewards` directly as response body

---

## Frontend Combat Models

### CombatRewards Frontend Type
**File**: `New-Mystica/New-Mystica/Models/Combat.swift:202-216`

```swift
struct CombatRewards: APIModel {
    let currencies: Currencies
    let items: [ItemDrop]
    let materials: [MaterialDrop]
    let experience: Int
    let combatHistory: CombatHistory

    enum CodingKeys: String, CodingKey {
        case currencies
        case items
        case materials
        case experience
        case combatHistory = "combat_history"
    }
}
```

### ItemDrop Frontend Type
**File**: `New-Mystica/New-Mystica/Models/Combat.swift:224-240`

```swift
struct ItemDrop: APIModel {
    let itemTypeId: String
    let name: String
    let category: String
    let rarity: String
    let styleId: String
    let styleName: String

    enum CodingKeys: String, CodingKey {
        case itemTypeId = "item_type_id"
        case name
        case category
        case rarity
        case styleId = "style_id"
        case styleName = "style_name"
    }
}
```

**⚠️ MISSING FIELDS**: `description`, `base_stats`, `appearance_data` are not defined in the Swift model but ARE sent by backend.

### MaterialDrop Frontend Type
**File**: `New-Mystica/New-Mystica/Models/Combat.swift:265-277`

```swift
struct MaterialDrop: APIModel {
    let materialId: String
    let name: String
    let styleId: String
    let styleName: String

    enum CodingKeys: String, CodingKey {
        case materialId = "material_id"
        case name
        case styleId = "style_id"
        case styleName = "style_name"
    }
}
```

**⚠️ MISSING FIELDS**: `description`, `stat_modifiers` are not defined in the Swift model but ARE sent by backend.

### Currencies Frontend Type
**File**: `New-Mystica/New-Mystica/Models/Combat.swift:219-221`

```swift
struct Currencies: APIModel {
    let gold: Int
}
```

### CombatHistory Frontend Type
**File**: `New-Mystica/New-Mystica/Models/Combat.swift:243-259`

```swift
struct CombatHistory: APIModel {
    let locationId: String
    let totalAttempts: Int
    let victories: Int
    let defeats: Int
    let currentStreak: Int
    let longestStreak: Int

    enum CodingKeys: String, CodingKey {
        case locationId = "location_id"
        case totalAttempts = "total_attempts"
        case victories
        case defeats
        case currentStreak = "current_streak"
        case longestStreak = "longest_streak"
    }
}
```

---

## Frontend Data Flow

### 1. API Response Reception
**File**: `DefaultCombatRepository.swift:45-79`

```swift
func performAttack(sessionId: String, tapPositionDegrees: Float) async throws -> CombatAction {
    let response: AttackResult = try await apiClient.post(...)

    return CombatAction(
        // ... other fields
        rewards: response.rewards  // Direct pass-through
    )
}
```

**Same for defense** (lines 81-115)

### 2. CombatViewModel Processing
**File**: `CombatViewModel.swift:105-108`

```swift
if action.combatStatus == .victory {
    appState?.setCombatSession(nil)
    appState?.setCombatRewards(action.rewards)  // Store rewards from action
    navigationManager?.navigateTo(.victory)
}
```

**Same for defense** (lines 147-150)

### 3. AppState Storage
**File**: `AppState.swift:28-29, 137-142`

```swift
var combatRewards: CombatRewards? = nil

func setCombatRewards(_ rewards: CombatRewards?) {
    self.combatRewards = rewards
}

func clearCombatRewards() {
    self.combatRewards = nil
}
```

### 4. VictoryView Consumption
**File**: `VictoryView.swift:56-78, 157-159`

```swift
if let rewards = getCombatRewards() {
    VStack(spacing: 24) {
        if rewards.currencies.gold > 0 {
            CurrencySection(gold: rewards.currencies.gold)
        }

        if !rewards.items.isEmpty {
            ItemsSection(items: rewards.items)
        }

        if !rewards.materials.isEmpty {
            MaterialsSection(materials: rewards.materials)
        }
    }
}

private func getCombatRewards() -> CombatRewards? {
    return appState.combatRewards
}
```

---

## Display Components

### Items Display
**File**: `VictoryView.swift:215-312`

```swift
private struct ItemsSection: View {
    let items: [ItemDrop]
    // Renders in 3-column grid
    // Uses: item.name, item.category, item.rarity, item.styleName
}

private struct ItemCard: View {
    let item: ItemDrop

    // Fields displayed:
    // - Icon: based on item.category (weapon/armor/accessory)
    // - Name: item.name
    // - Style badge: item.styleName
    // - Border color: based on item.rarity
}
```

### Materials Display
**File**: `VictoryView.swift:316-383`

```swift
private struct MaterialsSection: View {
    let materials: [MaterialDrop]
    // Renders in 3-column grid
    // Uses: material.name, material.styleName
}

private struct VictoryMaterialCard: View {
    let material: MaterialDrop

    // Fields displayed:
    // - Icon: generic cube icon
    // - Name: material.name
    // - Style badge: material.styleName
}
```

---

## Data Field Mapping Summary

| Backend Field | Frontend Model | Display Usage | Status |
|---------------|----------------|---------------|--------|
| `item_type_id` | `ItemDrop.itemTypeId` | Not displayed | ✅ Received |
| `name` | `ItemDrop.name` | Item card title | ✅ Received |
| `category` | `ItemDrop.category` | Icon selection | ✅ Received |
| `rarity` | `ItemDrop.rarity` | Border color, rarity badge | ✅ Received |
| `style_id` | `ItemDrop.styleId` | Not used in display | ✅ Received |
| `style_name` | `ItemDrop.styleName` | Style badge display | ✅ Received |
| `description` | ❌ MISSING | Could show tooltip | ⚠️ Sent but ignored |
| `base_stats` | ❌ MISSING | Could show stat bonuses | ⚠️ Sent but ignored |
| `appearance_data` | ❌ MISSING | Could customize visuals | ⚠️ Sent but ignored |
| `material_id` | `MaterialDrop.materialId` | Not displayed | ✅ Received |
| `name` | `MaterialDrop.name` | Material card title | ✅ Received |
| `style_id` | `MaterialDrop.styleId` | Not used in display | ✅ Received |
| `style_name` | `MaterialDrop.styleName` | Style badge display | ✅ Received |
| `description` | ❌ MISSING | Could show material info | ⚠️ Sent but ignored |
| `stat_modifiers` | ❌ MISSING | Could show crafting bonuses | ⚠️ Sent but ignored |

---

## Complete JSON Examples

### Backend Victory Response (Attack/Defense)
```json
{
  "hit_zone": "normal",
  "base_multiplier": 1.0,
  "damage_dealt": 25,
  "player_hp_remaining": 45,
  "enemy_hp_remaining": 0,
  "enemy_damage": 0,
  "combat_status": "victory",
  "turn_number": 3,
  "rewards": {
    "result": "victory",
    "currencies": {
      "gold": 35
    },
    "materials": [
      {
        "material_id": "mat-001",
        "name": "Iron Ore",
        "description": "Raw iron ore, useful for smithing",
        "stat_modifiers": { "durability": 5 },
        "style_id": "shadow-style",
        "style_name": "Shadow"
      }
    ],
    "items": [
      {
        "item_type_id": "sword-001",
        "name": "Iron Sword",
        "category": "weapon",
        "rarity": "common",
        "description": "A standard iron sword",
        "base_stats": { "atk_power": 15, "atk_accuracy": 0.8 },
        "appearance_data": { "color": "#888888", "material": "iron" },
        "style_id": "shadow-style",
        "style_name": "Shadow"
      },
      {
        "item_type_id": "ring-002",
        "name": "Protection Ring",
        "category": "accessory",
        "rarity": "uncommon",
        "description": "Provides minor protection",
        "base_stats": { "def_power": 5 },
        "appearance_data": null,
        "style_id": "shadow-style",
        "style_name": "Shadow"
      }
    ],
    "experience": 45,
    "combat_history": {
      "location_id": "loc-001",
      "total_attempts": 5,
      "victories": 3,
      "defeats": 2,
      "current_streak": 1,
      "longest_streak": 2
    }
  }
}
```

### Frontend CombatRewards (After Decoding)
```swift
CombatRewards(
  currencies: Currencies(gold: 35),
  items: [
    ItemDrop(
      itemTypeId: "sword-001",
      name: "Iron Sword",
      category: "weapon",
      rarity: "common",
      styleId: "shadow-style",
      styleName: "Shadow"
      // Note: description, base_stats, appearance_data are IGNORED by decoder
    ),
    ItemDrop(
      itemTypeId: "ring-002",
      name: "Protection Ring",
      category: "accessory",
      rarity: "uncommon",
      styleId: "shadow-style",
      styleName: "Shadow"
    )
  ],
  materials: [
    MaterialDrop(
      materialId: "mat-001",
      name: "Iron Ore",
      styleId: "shadow-style",
      styleName: "Shadow"
      // Note: description, stat_modifiers are IGNORED by decoder
    )
  ],
  experience: 45,
  combatHistory: CombatHistory(
    locationId: "loc-001",
    totalAttempts: 5,
    victories: 3,
    defeats: 2,
    currentStreak: 1,
    longestStreak: 2
  )
)
```

---

## Issues & Recommendations

### Current Issues

1. **Incomplete ItemDrop Model**
   - Missing: `description`, `base_stats`, `appearance_data`
   - These fields ARE sent by backend but silently ignored by decoder
   - Could prevent future features (tooltips, stat display, visual customization)

2. **Incomplete MaterialDrop Model**
   - Missing: `description`, `stat_modifiers`
   - These fields ARE sent by backend but silently ignored by decoder
   - Could prevent future features (material info, crafting bonuses)

3. **Unused Fields in Display**
   - `styleId` is received but never used (only `styleName` displayed)
   - Could be used for future styling or filtering

### Recommendations

1. **Update ItemDrop Swift Model** to include optional fields:
   ```swift
   struct ItemDrop: APIModel {
       let itemTypeId: String
       let name: String
       let category: String
       let rarity: String
       let styleId: String
       let styleName: String
       let description: String?      // NEW
       let baseStats: [String: Double]?  // NEW
       let appearanceData: [String: AnyCodable]?  // NEW
   }
   ```

2. **Update MaterialDrop Swift Model** to include optional fields:
   ```swift
   struct MaterialDrop: APIModel {
       let materialId: String
       let name: String
       let styleId: String
       let styleName: String
       let description: String?      // NEW
       let statModifiers: [String: Double]?  // NEW
   }
   ```

3. **Add Tooltips** to ItemCard/VictoryMaterialCard using description fields

4. **Add Stat Display** to item cards when baseStats/statModifiers present

5. **Cache Style Information** if style customization implemented later

---

## File References Summary

| Component | File | Key Lines |
|-----------|------|-----------|
| **Backend** | | |
| Victory Response Interface | `CombatService.ts` | 120-171 |
| Loot Generation | `CombatService.ts` | 1365-1603 |
| Material Persistence | `CombatService.ts` | 667-688 |
| Item Persistence | `CombatService.ts` | 691-711 |
| Route Handler | `CombatController.ts` | 67-78 |
| API Route | `routes/combat.ts` | 56-61 |
| **Frontend** | | |
| Item/Material Models | `Combat.swift` | 224-277 |
| Rewards Model | `Combat.swift` | 202-216 |
| API Response Reception | `DefaultCombatRepository.swift` | 45-79, 81-115 |
| State Storage | `CombatViewModel.swift` | 105-108, 147-150 |
| AppState Management | `AppState.swift` | 28-29, 137-142 |
| Display Components | `VictoryView.swift` | 56-78, 215-383 |

---

## Conclusion

The victory screen receives **complete, properly-structured data** from the backend through a clean three-layer architecture. The Swift models successfully decode the core fields (item/material names, rarities, styles, currencies, combat history), but intentionally omit optional fields (descriptions, stats, appearance data) that could enable richer displays.

The data is **ready for enhancement** - any future feature additions (tooltips, stat bonuses, visual customization) can access backend data by simply updating the Swift model definitions.
