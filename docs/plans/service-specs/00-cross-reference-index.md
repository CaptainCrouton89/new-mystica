# Service Specifications Cross-Reference Index

**Generated**: 2025-01-27
**Purpose**: Track dependencies and missing implementations across service specs

## Service Dependency Matrix

### Direct Service Dependencies

| Service | Depends On | Purpose |
|---------|------------|---------|
| **AuthService** | ProfileRepository | User CRUD, device tokens, currency initialization |
| **CombatService** | ChatterService ⚠️ NOT SPECIFIED | Pet and enemy dialogue generation |
| **CombatService** | LocationRepository | Location validation, enemy pool matching |
| **CombatService** | EquipmentRepository | Player equipment and stat calculations |
| **CombatService** | WeaponRepository | Weapon timing configurations |
| **CombatService** | MaterialRepository | Loot generation and style inheritance |
| **EquipmentService** | ProfileRepository | `updateLastLogin()` ⚠️ NOT IN PROFILE SPEC |
| **InventoryService** | ItemRepository | Item data access |
| **InventoryService** | StatsService | Stats calculation for items with materials |
| **ItemService** | WeaponRepository | Weapon-specific operations |
| **ItemService** | PetRepository | Pet personality and chatter |
| **ItemService** | EconomyService ⚠️ NOT SPECIFIED | Gold deduction for upgrades/replacements |
| **MaterialService** | ImageGenerationService ⚠️ NOT SPECIFIED | AI image generation for material combos |
| **MaterialService** | ProfileRepository | Gold balance updates for replacements |
| **LoadoutService** | EquipmentService | Equipment state management |
| **LocationService** | None | Self-contained (uses repositories directly) |
| **ProfileService** | InventoryRepository | Item creation for profile initialization |

### Repository Dependencies

| Service | Repository Methods Required |
|---------|---------------------------|
| **AuthService** | ProfileRepository.findUserById(), updateLastLogin() |
| **CombatService** | CombatRepository.*, EnemyRepository.*, LocationRepository.*, EquipmentRepository.*, WeaponRepository.*, MaterialRepository.* |
| **EquipmentService** | EquipmentRepository.* (all methods implemented) |
| **InventoryService** | ItemRepository.findByUser(), findEquippedByUser(), findManyWithDetails() |
| **ItemService** | ItemRepository.*, WeaponRepository.*, PetRepository.* |
| **MaterialService** | MaterialRepository.*, ImageCacheRepository.*, ItemRepository.update() ⚠️, ProfileRepository.updateGoldBalance() ⚠️ |
| **LoadoutService** | LoadoutRepository.* ⚠️ NOT IMPLEMENTED |
| **LocationService** | LocationRepository.* (fully implemented) |
| **ProfileService** | ProfileRepository.* (needs currency RPC functions) |

## Missing Implementations

### Services Without Specifications

1. **ChatterService** - Referenced by Combat spec (F-11/F-12)
   - Purpose: AI-powered dialogue generation for pets and enemies
   - Methods: `generatePetChatter()`, `generateEnemyChatter()`
   - Dependencies: OpenAI API, combat context, personality data

2. **EconomyService** - Referenced by Item spec
   - Purpose: Currency deduction for upgrades and material replacements
   - Methods: `deductGold()`, `addGold()`, transaction logging
   - Dependencies: ProfileRepository, audit trail

3. **ImageGenerationService** - Referenced by Material spec
   - Purpose: Generate combo images for items with applied materials
   - Methods: `generateComboImage()`, R2 upload integration
   - Dependencies: Replicate API, R2 storage, image cache

4. **StatsService** - Referenced by Inventory spec
   - Purpose: Centralized stat calculations for items with materials
   - Methods: `computeItemStats()`, `computeItemStatsForLevel()`
   - Dependencies: Material stat modifiers, level scaling formulas

### Missing Repository Methods

1. **ItemRepository.update()** - Needed by MaterialService
   - Purpose: Update item stats/hash/image after material application
   - Current Status: Not implemented

2. **ProfileRepository.updateGoldBalance()** - Needed by MaterialService
   - Purpose: Deduct gold for material replacement operations
   - Current Status: Not implemented

3. **ProfileRepository.updateLastLogin()** - Referenced by Equipment spec
   - Purpose: Track user login timestamps
   - Current Status: Not mentioned in Profile spec

4. **LoadoutRepository.*** - Needed by LoadoutService
   - Purpose: All loadout CRUD operations
   - Current Status: Not implemented (service spec exists but no repository)

### Missing Database Functions

1. **RPC Functions for MaterialService**:
   - `apply_material_to_item()` - Atomic material application
   - `replace_material_on_item()` - Atomic material replacement
   - `increment_image_cache_craft_count()` - Cache management

2. **RPC Functions for ProfileService**:
   - `add_currency_with_logging()` - Atomic currency addition
   - `deduct_currency_with_logging()` - Atomic currency deduction
   - `add_xp_and_level_up()` - XP and level management

3. **RPC Functions for LoadoutService**:
   - `activate_loadout()` - Atomic loadout activation

## Repository Method Index

### By Repository

#### ProfileRepository
- **findUserById()** - Used by: AuthService, ProfileService
- **updateLastLogin()** - Used by: AuthService, EquipmentService ⚠️
- **updateGoldBalance()** - Used by: MaterialService ⚠️
- **getAllCurrencyBalances()** - Used by: ProfileService
- **addCurrency()** - Used by: ProfileService
- **deductCurrency()** - Used by: ProfileService

#### ItemRepository
- **findByUser()** - Used by: InventoryService
- **findEquippedByUser()** - Used by: InventoryService
- **findManyWithDetails()** - Used by: InventoryService
- **update()** - Used by: MaterialService ⚠️

#### MaterialRepository
- **findAllMaterials()** - Used by: MaterialService
- **findAllStacksByUser()** - Used by: MaterialService
- **applyMaterialToItemAtomic()** - Used by: MaterialService
- **replaceMaterialOnItemAtomic()** - Used by: MaterialService
- **findMaterialsByItem()** - Used by: MaterialService

#### EquipmentRepository
- **findEquippedByUser()** - Used by: EquipmentService, CombatService
- **equipItem()** - Used by: EquipmentService
- **unequipSlot()** - Used by: EquipmentService
- **computeTotalStats()** - Used by: EquipmentService

#### LocationRepository (Fully Implemented)
- **findNearby()** - Used by: LocationService
- **findById()** - Used by: LocationService, CombatService
- **getMatchingEnemyPools()** - Used by: CombatService
- **getMatchingLootPools()** - Used by: CombatService
- **selectRandomEnemy()** - Used by: CombatService
- **selectRandomLoot()** - Used by: CombatService

## Schema Dependencies

### Cross-Table Relationships

| Service | Primary Tables | Joins/References |
|---------|---------------|-------------------|
| **AuthService** | Users, DeviceTokens | UserCurrencyBalances (init) |
| **CombatService** | CombatSessions | Users, Locations, Items, Enemies, Materials |
| **EquipmentService** | UserEquipment | Items, ItemTypes, Users (stats) |
| **InventoryService** | Items | ItemTypes, ItemMaterials, MaterialInstances |
| **ItemService** | Items, Weapons, Pets | ItemTypes, ItemMaterials, ItemHistory |
| **MaterialService** | MaterialStacks, ItemMaterials | Materials, MaterialInstances, ItemImageCache |
| **LoadoutService** | Loadouts, LoadoutSlots | UserEquipment (activation) |
| **LocationService** | Locations | EnemyPools, LootPools (combat integration) |
| **ProfileService** | Users, UserCurrencyBalances | PlayerProgression, EconomyTransactions |

### Critical Foreign Key Dependencies

- **Items** → **Users** (ownership validation across all services)
- **MaterialInstances** → **Materials** (material validation)
- **UserEquipment** → **Items** (equipment state)
- **ItemMaterials** → **MaterialInstances** (material application)
- **CombatSessions** → **Locations** + **Users** (combat context)

## Implementation Priority

### Phase 1: Foundation Services
1. **StatsService** - Required by InventoryService and MaterialService
2. **EconomyService** - Required by ItemService and MaterialService
3. **Missing Repository Methods** - Required by multiple services

### Phase 2: AI Integration
1. **ImageGenerationService** - Required by MaterialService
2. **ChatterService** - Required by CombatService

### Phase 3: Database Functions
1. **Material RPC Functions** - For MaterialService atomicity
2. **Currency RPC Functions** - For ProfileService transactions
3. **Loadout RPC Functions** - For LoadoutService activation

### Phase 4: Repository Implementation
1. **LoadoutRepository** - Complete implementation for LoadoutService

## Cross-Service Communication Patterns

### Service-to-Service Calls
```
CombatService → ChatterService (dialogue generation)
ItemService → EconomyService (gold deduction)
MaterialService → ImageGenerationService (combo images)
InventoryService → StatsService (stat calculations)
LoadoutService → EquipmentService (equipment management)
```

### Repository Sharing
```
ProfileRepository ← AuthService, MaterialService, ProfileService
ItemRepository ← InventoryService, ItemService, MaterialService
EquipmentRepository ← EquipmentService, CombatService
LocationRepository ← LocationService, CombatService
```

## Validation Dependencies

### Cross-Service Validation
- **Item Ownership**: All services must validate via ItemRepository
- **Currency Sufficiency**: ItemService, MaterialService via EconomyService
- **Equipment State**: InventoryService, LoadoutService via EquipmentService
- **Material Availability**: MaterialService via MaterialRepository

### Database Constraint Dependencies
- **Material Application**: Slot constraints (0-2), ownership validation
- **Equipment System**: 8-slot validation, category compatibility
- **Currency Operations**: Non-negative balance constraints
- **Combat Sessions**: Active session limits, timeout handling

---

**Next Actions**:
1. Implement missing services (StatsService, EconomyService priority)
2. Add missing repository methods
3. Create database RPC functions for atomic operations
4. Update individual specs with "See also" sections