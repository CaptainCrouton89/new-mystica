# Victory Screen Data - Quick Reference

## Data Flow Pipeline

```
Backend Combat → Attack/Defense Response → Frontend Repository → CombatViewModel → AppState → VictoryView
   (CombatService)      (rewards field)      (DefaultCombatRepository)    (line 107/149)   (line 29)   (line 56+)
```

---

## Backend → Frontend Response Mapping

### Attack/Defense Complete Response

**Backend Response** (`CombatService.ts:95-106, 306-325`)
```typescript
{
  hit_zone: HitBand;
  base_multiplier: number;
  crit_bonus_multiplier?: number;
  damage_dealt: number;
  player_hp_remaining: number;
  enemy_hp_remaining: number;
  enemy_damage: number;
  combat_status: 'ongoing' | 'victory' | 'defeat';
  turn_number: number;
  rewards: CombatRewards | null;  // <-- Contains all victory data
}
```

**Frontend Decodes To** (`DefaultCombatRepository.ts:61-78`)
```swift
CombatAction(
  type: .attack,
  performerId: "player",
  damageDealt: response.damageDealt,
  result: response.combatStatus,
  hitZone: response.hitZone,
  damageBlocked: nil,
  playerHpRemaining: response.playerHpRemaining,
  enemyHpRemaining: response.enemyHpRemaining,
  combatStatus: CombatStatus(...),
  turnNumber: response.turnNumber,
  rewards: response.rewards  // <-- Passes through directly
)
```

---

## Rewards Structure Details

### Backend CombatRewards (Full)

**Victory Case** (`CombatService.ts:1585-1592`):
```typescript
{
  result: 'victory',
  currencies: {
    gold: number
  },
  materials: [
    {
      material_id: string,
      name: string,
      description?: string,
      stat_modifiers?: any,
      style_id: string,
      style_name: string
    }
  ],
  items: [
    {
      item_type_id: string,
      name: string,
      category: string,
      rarity: string,
      description?: string,
      base_stats?: any,
      appearance_data?: any,
      style_id: string,
      style_name: string
    }
  ],
  experience: number,
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

**Defeat Case** (`CombatService.ts:734-745`):
```typescript
{
  result: 'defeat',
  currencies: {
    gold: 0
  },
  combat_history: {...}
  // No materials, items, or experience
}
```

### Frontend CombatRewards (Codable Model)

**File**: `Combat.swift:202-216`
```swift
struct CombatRewards: APIModel {
    let currencies: Currencies              // {gold: Int}
    let items: [ItemDrop]                   // Array of items
    let materials: [MaterialDrop]           // Array of materials
    let experience: Int                     // XP earned
    let combatHistory: CombatHistory        // Stats struct
}
```

---

## Item & Material Models

### Backend Item Drop Details

**Where Generated** (`CombatService.ts:1552-1571`):
```typescript
const items = lootDrops
  .filter((drop: any) => drop.type === 'item' && drop.item_type_id)
  .map((drop: any) => {
    const itemType = itemTypeMap.get(drop.item_type_id);
    return {
      item_type_id: drop.item_type_id,
      name: itemType.name,
      category: itemType.category,
      rarity: itemType.rarity,
      description: itemType.description || undefined,
      base_stats: itemType.base_stats_normalized || undefined,
      appearance_data: itemType.appearance_data || undefined,
      style_id: drop.style_id,
      style_name: styleName,
    };
  });
```

### Frontend ItemDrop Model

**File**: `Combat.swift:224-240`
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

    // NOTE: Decoder IGNORES these backend fields:
    // - description
    // - base_stats
    // - appearance_data
}
```

### Backend Material Drop Details

**Where Generated** (`CombatService.ts:1515-1530`):
```typescript
const materials = lootDrops
  .filter((drop: any) => drop.type === 'material' && drop.material_id)
  .map((drop: any) => {
    const material = materialMap.get(drop.material_id);
    return {
      material_id: drop.material_id,
      name: material.name,
      description: material.description || undefined,
      stat_modifiers: material.stat_modifiers || undefined,
      style_id: drop.style_id,
      style_name: styleName,
    };
  });
```

### Frontend MaterialDrop Model

**File**: `Combat.swift:265-277`
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

    // NOTE: Decoder IGNORES these backend fields:
    // - description
    // - stat_modifiers
}
```

---

## State Management Flow

### 1. CombatViewModel Receives Rewards
**File**: `CombatViewModel.swift:105-108`
```swift
if action.combatStatus == .victory {
    appState?.setCombatSession(nil)
    appState?.setCombatRewards(action.rewards)  // Action.rewards is CombatRewards
    navigationManager?.navigateTo(.victory)
}
```

### 2. AppState Stores Rewards
**File**: `AppState.swift:28-29`
```swift
@Observable
final class AppState {
    var combatRewards: CombatRewards? = nil

    func setCombatRewards(_ rewards: CombatRewards?) {
        self.combatRewards = rewards
    }
}
```

### 3. VictoryView Reads Rewards
**File**: `VictoryView.swift:56-78`
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

## VictoryView Display Components

### Currency Section
**File**: `VictoryView.swift:164-211`
- **Input**: `gold: Int` from `rewards.currencies.gold`
- **Display**: Formatted number (e.g., "1,350")
- **Icon**: Dollar sign circle

### Items Section
**File**: `VictoryView.swift:215-312`
- **Input**: `items: [ItemDrop]` from `rewards.items`
- **Grid**: 3-column LazyVGrid
- **Per Item**:
  - **Icon**: Based on `item.category` (weapon/armor/accessory)
  - **Name**: `item.name` (limited to 2 lines)
  - **Style Badge**: `item.styleName` (e.g., "Shadow")
  - **Border Color**: Based on `item.rarity` (common/uncommon/rare/epic/legendary)

### Materials Section
**File**: `VictoryView.swift:316-383`
- **Input**: `materials: [MaterialDrop]` from `rewards.materials`
- **Grid**: 3-column LazyVGrid
- **Per Material**:
  - **Icon**: Generic cube icon
  - **Name**: `material.name` (limited to 2 lines)
  - **Style Badge**: `material.styleName` (e.g., "Shadow")

---

## Key Data Points for Victory Display

| Field | Backend | Frontend | Display |
|-------|---------|----------|---------|
| Gold Amount | `currencies.gold` | `Currencies.gold` | CurrencySection |
| Item Name | `items[].name` | `ItemDrop.name` | ItemCard title |
| Item Category | `items[].category` | `ItemDrop.category` | ItemCard icon |
| Item Rarity | `items[].rarity` | `ItemDrop.rarity` | ItemCard border color |
| Item Style | `items[].style_name` | `ItemDrop.styleName` | ItemCard badge |
| Material Name | `materials[].name` | `MaterialDrop.name` | MaterialCard title |
| Material Style | `materials[].style_name` | `MaterialDrop.styleName` | MaterialCard badge |
| Experience | `experience` | `CombatRewards.experience` | Not displayed (in debug logs only) |
| Combat Stats | `combat_history` | `CombatHistory` | Not displayed |

---

## Missing Fields Available from Backend

These fields are sent by backend but NOT captured in frontend Swift models:

### For Items
- `description` - Could show in tooltip
- `base_stats` - Could display stat bonuses
- `appearance_data` - Could customize item visuals

### For Materials
- `description` - Could show material info
- `stat_modifiers` - Could display crafting bonuses

These can be added to Swift models at any time without backend changes.

---

## API Endpoints

### Victory Response Points

1. **Via Attack** `POST /combat/attack`
   - Returns `AttackResult` with `rewards: CombatRewards | null`

2. **Via Defense** `POST /combat/defend`
   - Returns `DefenseResult` with `rewards: CombatRewards | null`

3. **Manual Complete** `POST /combat/complete`
   - Returns `CombatRewards` directly

All endpoints respect same reward structure defined in `CombatService.ts:120-171`

---

## Current Flow (Working ✅)

```
Attack Action → Backend completes combat → Generates loot via LocationService
                ↓
            Returns AttackResult with CombatRewards
                ↓
        DefaultCombatRepository extracts rewards
                ↓
        CombatViewModel stores in AppState
                ↓
        VictoryView reads from AppState.combatRewards
                ↓
        Displays items, materials, gold, stats
```

**Status**: Data flow is complete and functional. All required fields for basic display are present and working.
