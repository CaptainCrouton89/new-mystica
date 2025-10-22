# Missing API Endpoints Analysis

**Date:** 2025-10-22
**Scope:** Backend API completeness audit based on feature specs and OpenAPI contracts

## Summary

- **Total API Endpoints Defined:** 43 endpoints in `api-contracts.yaml`
- **Routes Implemented:** 14 route files + controllers
- **Assessment:** Significant gap between API contracts and implementation

---

## Inventory & Equipment System (F-03, F-09)

### ❌ Missing: Core Inventory Endpoints

**Contract Definitions** (from `api-contracts.yaml`):
```yaml
/inventory:
  get:
    summary: Get all player items with filtering and pagination

/equipment:
  get:
    summary: Get current equipment state (8 slots)
  post:
    summary: Not defined - unclear intent

/equipment/equip:
  post:
    requestBody: { item_id: UUID }

/equipment/unequip:
  post:
    requestBody: { slot: VARCHAR }
```

**Service Layer Evidence:**

| Endpoint | Route File | Controller | Service | Status |
|----------|-----------|-----------|---------|--------|
| `GET /inventory` | ✅ `inventory.ts:17` | ⚠️ `InventoryController` | ❌ `NotImplementedError` | Stubbed |
| `GET /equipment` | ❌ Missing | ❌ Missing | ❌ `EquipmentService` throws | Not wired |
| `POST /equipment/equip` | ❌ Missing | ❌ Missing | ⚠️ `EquipmentService.equipItem` | Not wired |
| `POST /equipment/unequip` | ❌ Missing | ❌ Missing | ⚠️ `EquipmentService.unequipItem` | Not wired |

**Implementation Status:**
- Route definitions incomplete (no GET /equipment route)
- EquipmentController exists but methods not wired
- EquipmentService exists (src/services/EquipmentService.ts) but methods throw `NotImplementedError`
- Database: UserEquipment table exists with correct schema

**Evidence:**
```typescript
// src/controllers/EquipmentController.ts
async getEquipment(req: Request, res: Response) {
  throw new NotImplementedError('EquipmentController.getEquipment');
}
```

---

## Combat System (F-02)

### ⚠️ Partially Missing: Combat Session Management

**Contract Definitions**:
```yaml
/combat/start:
  post: Start combat and select level

/combat/attack:
  post: Execute turn-based attack

/combat/defend:
  post: Execute defense action (dial mechanic)

/combat/complete:
  post: Complete combat, award loot

/combat/session/{session_id}:
  get: Recover active session state
```

**Status:** Routes defined but service layer incomplete

| Endpoint | Route | Controller | Service | Status |
|----------|-------|-----------|---------|--------|
| `POST /combat/start` | ✅ | ⚠️ Stub | ❌ Throws NotImplementedError | Needs implementation |
| `POST /combat/attack` | ✅ | ⚠️ Stub | ❌ Throws NotImplementedError | Needs implementation |
| `POST /combat/defend` | ✅ | ⚠️ Stub | ❌ Throws NotImplementedError | Needs implementation |
| `POST /combat/complete` | ✅ | ⚠️ Stub | ❌ Throws NotImplementedError | Needs implementation |
| `GET /combat/session/{id}` | ✅ | ⚠️ Stub | ❌ Missing | Needs implementation |

**Evidence:**
- Database: CombatSessions table exists but never populated
- Service file: `src/services/CombatService.ts` exists but all methods throw `NotImplementedError`
- Controller: `src/controllers/CombatController.ts` calls service stubs
- Pool system: EnemyPools, LootPools, etc. seeded but not queried by combat system

**Missing Implementation:**
1. Session initialization (create in-memory or Redis cache)
2. Weighted random pool selection for enemy/loot
3. Hit zone calculation from weapon bands
4. Damage calculation with stat modifiers
5. Enemy counterattack simulation
6. Victory/defeat resolution and reward calculation

---

## Materials System (F-04)

### ❌ Missing: Material Library & Application

**Contract Definitions**:
```yaml
/materials:
  get: List all available materials (library)

/materials/inventory:
  get: Get user's material stacks with quantities

/items/{item_id}/materials/apply:
  post: Apply material to item with image generation

/items/{item_id}/materials/{slot_index}:
  get: Get material in specific slot (implied by contract)
  delete: Remove material (implied by contract)

/items/{item_id}/materials/replace:
  post: Remove old material, apply new material
```

**Status:** Routes defined but endpoints missing

| Endpoint | Route | Controller | Service | Status |
|----------|-------|-----------|---------|--------|
| `GET /materials` | ✅ `materials.ts` | ❌ Missing | ❌ Missing | **Not implemented** |
| `GET /materials/inventory` | ✅ `materials.ts` | ❌ `MaterialController` | ❌ Throws | Stubbed |
| `POST /items/:id/materials/apply` | ✅ | ❌ `ItemController` | ❌ Throws | Stubbed |
| `POST /items/:id/materials/replace` | ✅ | ❌ `ItemController` | ❌ Throws | Stubbed |

**Evidence:**
```typescript
// src/controllers/MaterialController.ts
async getMaterials(req: Request, res: Response) {
  throw new NotImplementedError('MaterialController.getMaterials');
}

async getMaterialsInventory(req: Request, res: Response) {
  throw new NotImplementedError('MaterialController.getMaterialsInventory');
}
```

**Missing Implementation:**
1. Material library endpoint (GET /materials with all 15 materials)
2. MaterialStacks inventory query
3. Combo hash calculation (SHA-256 of sorted material IDs + styles)
4. Image generation orchestration (Replicate/OpenAI integration)
5. ItemImageCache lookup and creation
6. Material application workflow (stack decrement, MaterialInstance creation, ItemMaterials insertion)
7. Material removal (with gold cost validation)
8. Material replacement (remove old + apply new atomically)

---

## Item Management & Upgrades (F-03, F-06)

### ❌ Missing: Item Upgrade Endpoints

**Contract Definitions**:
```yaml
/items/{item_id}:
  get: Get item details with computed stats

/items/{item_id}/upgrade-cost:
  get: Preview upgrade cost and new stats

/items/{item_id}/upgrade:
  post: Execute item level upgrade
```

**Status:** Routes defined but service layer missing

| Endpoint | Route | Controller | Service | Status |
|----------|-------|-----------|---------|--------|
| `GET /items/:id` | ✅ | ⚠️ Stub | ❌ Throws | Needs stat calculation |
| `GET /items/:id/upgrade-cost` | ✅ | ❌ Missing | ❌ Missing | Not implemented |
| `POST /items/:id/upgrade` | ✅ | ❌ Missing | ❌ Missing | Not implemented |
| `POST /items/{id}/dismantle` | ❌ Missing | ❌ Missing | ❌ Missing | **Not in contracts** |

**Evidence:**
```typescript
// src/controllers/ItemController.ts - all methods throw NotImplementedError
async getItem(req: Request, res: Response) {
  throw new NotImplementedError('ItemController.getItem');
}
```

**Missing Implementation:**
1. Stat calculation engine (base_stats × rarity × level × material_mods)
2. Upgrade cost formula (100 × 1.5^(level-1))
3. Gold validation before upgrade
4. Item level increment
5. Vanity level recalculation (sum(item_levels) / 6)
6. Item dismantle endpoint (burns item, returns gold)

---

## Authentication (F-07)

### ⚠️ Partially Missing: Device Registration

**Contract Definitions**:
```yaml
/auth/register-device:
  post: Register iOS device UUID → get JWT token

/auth/login:
  post: Email/password login (future, not MVP0)

/auth/me:
  get: Get current user profile

/auth/logout:
  post: Revoke tokens
```

**Status:** Some auth exists but device registration incomplete

| Endpoint | Route | Controller | Service | Status |
|----------|-------|-----------|---------|--------|
| `POST /auth/register-device` | ✅ `auth.ts` | ⚠️ `AuthController` | ❌ Throws | **In progress** |
| `POST /auth/login` | ✅ | ⚠️ Stub | ❌ Throws | Future feature |
| `GET /auth/me` | ✅ | ⚠️ Stub | ⚠️ Partial | Needs device UUID support |
| `POST /auth/logout` | ✅ | ❌ Missing | ❌ Missing | Not implemented |

**Evidence:**
- JWT middleware exists and validates tokens (middleware/auth.ts)
- User profile infrastructure exists
- Device registration endpoint not fully implemented

**Missing Implementation:**
1. Device UUID validation (UUID v4 format check)
2. Check for existing device in users table
3. Create or retrieve anonymous user account
4. 30-day JWT token generation
5. Return session with access_token and expires_in
6. Logout endpoint to clear tokens (client-side in Keychain)

---

## Progression & Economy (F-08, F-06, F-05)

### ❌ Missing: XP & Progression Endpoints

**Contract Definitions**:
```yaml
/progression:
  get: Get user XP, level, and progress to next level

/progression/rewards/claim:
  post: Claim level-up reward (gold, features, etc.)

/currencies:
  get: List available currencies (GOLD, GEMS)

/currencies/balance:
  get: Get user's GOLD and GEMS balance
```

**Status:** Routes defined but service layer not implemented

| Endpoint | Route | Controller | Service | Status |
|----------|-------|-----------|---------|--------|
| `GET /progression` | ✅ `progression.ts` | ⚠️ Stub | ❌ Throws | Not implemented |
| `POST /progression/rewards/claim` | ✅ | ❌ Missing | ❌ Missing | Not implemented |
| `GET /currencies` | ✅ `economy.ts` | ⚠️ Stub | ❌ Throws | Not implemented |
| `GET /currencies/balance` | ✅ | ⚠️ Stub | ❌ Throws | Not implemented |

**Missing Implementation:**
1. PlayerProgression table queries (xp, level, last_level_up)
2. XP-to-level calculation (xp_required = 100 × level)
3. Level reward lookup and claim logic
4. Currency balance queries (GOLD + GEMS)
5. Gold award after combat victories
6. Gold deduction for item upgrades/material removal

---

## Pet & Enemy AI (F-11, F-12)

### ❌ Missing: AI Personality Endpoints

**Contract Definitions**:
```yaml
/combat/pet-chatter:
  post: Generate AI dialogue for pet based on combat event

/pets/personalities:
  get: List available pet personalities

/pets/{pet_id}/personality:
  put: Assign personality to player's pet

/combat/enemy-chatter:
  post: Generate AI dialogue for enemy based on combat event

/enemies/types:
  get: List available enemy types with traits

/players/combat-history/{location_id}:
  get: Get player's win/loss stats at location
```

**Status:** Routes defined but service implementations missing

| Endpoint | Route | Controller | Service | Status |
|----------|-------|-----------|---------|--------|
| `POST /combat/pet-chatter` | ✅ | ⚠️ Stub | ❌ Throws | Not implemented |
| `GET /pets/personalities` | ✅ `pets.ts` | ❌ Missing | ❌ Missing | Not implemented |
| `PUT /pets/{id}/personality` | ✅ | ❌ Missing | ❌ Missing | Not implemented |
| `POST /combat/enemy-chatter` | ✅ | ⚠️ Stub | ❌ Throws | Not implemented |
| `GET /enemies/types` | ✅ `enemies.ts` | ❌ Missing | ❌ Missing | Not implemented |
| `GET /players/combat-history/{loc}` | ✅ | ❌ Missing | ❌ Missing | Not implemented |

**Evidence:**
- EnemyChatterService exists but all methods throw NotImplementedError
- PetService exists but all methods throw NotImplementedError
- pet_personalities table seeded but not queried
- enemy_types table seeded but not queried

**Missing Implementation:**
1. Pet personality library endpoint
2. Assign personality to pet
3. Pet chatter generation (OpenAI integration)
4. Enemy type library with traits
5. Enemy personality assignment
6. Enemy chatter generation with player history context
7. Combat history tracking table and queries

---

## Loadouts (F-09 - Post-MVP)

### ⚠️ Partially Missing: Loadout Management

**Contract Definitions**:
```yaml
/loadouts:
  get: List user's saved loadouts
  post: Create new loadout

/loadouts/{loadout_id}:
  get: Get specific loadout
  put: Update loadout
  delete: Delete loadout

/loadouts/{loadout_id}/activate:
  post: Activate loadout (copy to UserEquipment)

/loadouts/{loadout_id}/slots:
  get: Get all slot assignments in loadout
  post: Add item to slot
  put: Update item in slot
```

**Status:** Routes partially defined

| Endpoint | Route | Controller | Service | Status |
|----------|-------|-----------|---------|--------|
| `GET /loadouts` | ✅ `loadouts.ts` | ⚠️ Stub | ❌ Throws | Stubbed |
| `POST /loadouts` | ✅ | ⚠️ Stub | ❌ Throws | Stubbed |
| `GET /loadouts/{id}` | ✅ | ⚠️ Stub | ❌ Throws | Stubbed |
| `POST /loadouts/{id}/activate` | ✅ | ⚠️ Stub | ❌ Throws | Stubbed |

**Evidence:**
- LoadoutService exists with documented TODOs
- Loadouts table exists in database schema
- LoadoutSlots table exists for slot assignments

**Missing Implementation:**
1. Loadout CRUD operations
2. Slot assignment in loadout
3. Loadout activation (atomic copy to UserEquipment)
4. Validation: cannot equip same item to multiple slots

---

## Style System (F-13 - Design System)

### ⚠️ Partially Implemented: Style Management

**Contract Definitions**:
```yaml
/styles:
  get: List all style definitions (normal, pixel_art, watercolor, etc.)
```

**Status:** Route exists but service may be incomplete

| Endpoint | Route | Controller | Service | Status |
|----------|-------|-----------|---------|--------|
| `GET /styles` | ✅ `styles.ts` | ⚠️ Stub | ⚠️ Partial | May work |

---

## Summary by Feature

| Feature | Status | Critical Missing | Notes |
|---------|--------|------------------|-------|
| **F-01: Geolocation** | ✅ 100% | None | Backend complete, frontend only |
| **F-02: Combat** | ⚠️ 40% | Session init, enemy selection, attack flow, rewards | Routes exist, service throws |
| **F-03: Equipment** | ⚠️ 30% | GET /equipment, equip/unequip endpoints, stat calc | Service throws NotImplementedError |
| **F-04: Materials** | ❌ 0% | GET /materials, apply/remove, image generation | No endpoint wiring |
| **F-05: Loot Drops** | ❌ 0% | Depends on F-02 combat complete | Blocked by combat |
| **F-06: Item Upgrades** | ❌ 0% | GET /upgrade-cost, POST /upgrade | No endpoints |
| **F-07: Auth** | ⚠️ 35% | Device registration logic | Routes exist, not implemented |
| **F-08: Progression** | ❌ 0% | GET /progression, claim rewards | No implementation |
| **F-09: Inventory** | ⚠️ 10% | GET /equipment endpoints | Only /inventory route exists |
| **F-10: Premium** | ❌ 0% | Depends on F-06, F-09 | Placeholder spec only |
| **F-11: Pet AI** | ❌ 0% | /pets/personalities, /pet-chatter | Routes exist, service throws |
| **F-12: Enemy AI** | ❌ 0% | /enemies/types, /enemy-chatter | Routes exist, service throws |

---

## By Service Layer

### Services That Throw NotImplementedError

```
❌ CombatService          - All methods
❌ EquipmentService       - getEquipment, equipItem, unequipItem
❌ InventoryService       - getPlayerInventory
❌ MaterialService        - All methods
❌ ItemService            - getItem, upgradeItem, calculateUpgradeCost
❌ AuthService            - registerDevice (in progress)
❌ ProgressionService     - All methods
❌ PetService             - All methods
❌ EnemyChatterService    - All methods
```

### Services That Partially Work

```
⚠️ LocationService        - Queries work, but missing POST /generate
⚠️ LoadoutService         - CRUD methods exist but may throw
⚠️ EconomyService         - Queries work, but missing award/deduct
```

### Services That Work

```
✅ AuthService (JWT)      - Token validation middleware functional
✅ LocationService        - Geospatial queries complete
```

---

## Blocking Dependencies

1. **F-02 Combat** blocks F-05 (Loot Drops) - combat.complete() triggers rewards
2. **F-03 Equipment** blocks F-02 Combat - player stats come from equipped items
3. **F-04 Materials** blocks F-03 Equipment - materials modify item stats
4. **F-06 Upgrades** blocks **progression** - upgraded items unlock features
5. **F-07 Auth** blocks **everything** - no user context without device registration

---

## Recommended Implementation Order

1. **Auth (F-07)** - Device registration
2. **Equipment (F-03)** - Stat calculation + equip/unequip
3. **Materials (F-04)** - Material application + image generation
4. **Combat (F-02)** - Combat flow with stat integration
5. **Loot Drops (F-05)** - Reward calculation from combat
6. **Upgrades (F-06)** - Item upgrades + vanity level
7. **Progression (F-08)** - XP tracking
8. **Inventory (F-09)** - Full UI management (depends on 2-7)
9. **Economy** - Currency balance endpoints
10. **AI Personalities (F-11, F-12)** - Pet & enemy dialogue

