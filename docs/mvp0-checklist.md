# MVP0 Implementation Checklist

## Overview
MVP0 is a demo-ready version of Mystica with simplified features targeting an immediate playable experience. Core focus: location-based combat with instant generation, simplified equipment system, and AI-enhanced personality features. Target audience: stakeholders and early testers requiring functional demonstration of core game mechanics.

**Key Simplifications:**
- 30 hardcoded SF locations with instant generation
- Single arc dial combat only
- 100% drop rate (no randomness)
- Sync image generation (20s blocking)
- No location cooldowns or restrictions
- 8 equipment slots with basic equip/unequip
- MVP0 constraint: Level 1 enemies stay weak permanently

## Pre-Implementation Setup
- [ ] **Verify seed data structure** - Confirm materials, items, enemies data matches 8 equipment slot categories in docs/seed-data-*.json
- [ ] **Database schema alignment** - Ensure Supabase schema matches data-plan.yaml specifications (EquipmentSlots, UserEquipment, ItemMaterials tables)
- [ ] **Environment variables configured** - Set up all required API keys (Supabase, Replicate, OpenAI, R2) in .env.local
- [ ] **Test data population** - Load 30 hardcoded SF locations into database with proper location_type, state_code assignments
- [ ] **AI service quotas verified** - Confirm Replicate/OpenAI accounts have sufficient credits for image generation testing

## Core Features (Priority Order)

### F-07: Authentication
**Goal:** Supabase email/password auth with session management
**Dependency:** Required first - all other features need user context

**Backend Tasks:**
- [ ] Supabase project setup with authentication enabled
- [ ] User profile creation trigger (auto-create users table entry on auth.users insert)
- [ ] JWT validation middleware for all protected routes
- [ ] `GET /profile` endpoint returning user game data
- [ ] Error handling for expired/invalid tokens

**Frontend Tasks:**
- [ ] Login/signup screens with email validation
- [ ] Keychain integration for secure token storage
- [ ] Auto-login on app launch with session validation
- [ ] Session refresh handling on 401 responses
- [ ] Logout functionality clearing stored tokens

**Testing:**
- [ ] Verify registration flow creates both auth.users and users table entries
- [ ] Test session persistence across app restarts
- [ ] Confirm token refresh works on expiration

---

### F-01: Geolocation & Map
**Goal:** 30 hardcoded SF locations, instant generation, GPS permission (non-blocking)
**Dependency:** F-07 (auth) must be complete

**Backend Tasks:**
- [ ] Create 30 hardcoded SF location entries in database with location_type, state_code, lat/lng
- [ ] `POST /locations/generate {lat, lng}` endpoint returning instant location from hardcoded set
- [ ] Pool union system implementation (location_type ∪ state ∪ lat ∪ lng ∪ generic pools)
- [ ] Level-based enemy filtering from combined pools
- [ ] `GET /locations/nearby` endpoint with radius filtering

**Frontend Tasks:**
- [ ] GPS permission request with non-blocking behavior (continue if denied)
- [ ] Google Maps SDK integration showing user location
- [ ] Location markers rendered on map with proper icons
- [ ] Distance calculation and marker activation (within 50m)
- [ ] Location tap handler initiating combat flow

**Testing:**
- [ ] Verify all 30 locations appear on map
- [ ] Test pool union system returns correct enemies for different location types
- [ ] Confirm GPS denial doesn't block app functionality

---

### F-02: Combat System
**Goal:** Single arc dial, stat-based difficulty, zone-based damage
**Dependency:** F-01 (map), F-07 (auth)

**Backend Tasks:**
- [ ] Combat session management in Redis/in-memory (15min TTL)
- [ ] `POST /combat/start` endpoint with enemy selection from pools
- [ ] `POST /combat/attack` with zone detection logic (injure/miss/graze/normal/crit)
- [ ] Enemy stat scaling by level using base + tier scaling formula
- [ ] Weapon hit band calculation via fn_weapon_bands_adjusted() function
- [ ] `POST /combat/complete` with victory/defeat result handling

**Frontend Tasks:**
- [ ] Single arc dial UI with 5 color-coded zones (red/gray/yellow/white/green)
- [ ] Tap position calculation (0-360 degrees) and zone determination
- [ ] HP bars for player and enemy with real-time updates
- [ ] Damage number animations and haptic feedback
- [ ] Combat flow: player turn → enemy counterattack → repeat
- [ ] Victory/defeat screens with result display

**Testing:**
- [ ] Verify zone colors match damage multipliers (miss=0%, normal=100%, crit=160%+)
- [ ] Test level 1 enemies remain easy regardless of player level
- [ ] Confirm accuracy stat properly scales zone sizes

---

### F-03: Equipment System
**Goal:** 8 slots (weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet)
**Dependency:** F-07 (auth)

**Backend Tasks:**
- [ ] UserEquipment table with 8 slots per user (normalized structure)
- [ ] `GET /equipment` endpoint returning all equipped items by slot
- [ ] `PUT /equipment/{slot}` with item validation and stat recalculation
- [ ] `DELETE /equipment/{slot}` for unequipping items
- [ ] Real-time stat calculation from equipped items (via v_player_equipped_stats view)

**Frontend Tasks:**
- [ ] Equipment screen UI displaying 8 slots with slot names
- [ ] Drag-and-drop or tap-to-equip functionality
- [ ] Real-time stat updates when items equipped/unequipped
- [ ] Visual feedback for equipped vs unequipped items
- [ ] Equipment slot validation (weapons only in weapon slot, etc.)

**Testing:**
- [ ] Verify slot restrictions prevent equipping wrong item types
- [ ] Test stat calculations update immediately on equipment changes
- [ ] Confirm each slot can only hold one item at a time

---

### F-05: Drop System
**Goal:** 100% drop rate (material + item + gold per victory)
**Dependency:** F-02 (combat)

**Backend Tasks:**
- [ ] Modify `POST /combat/complete` to always generate rewards on victory
- [ ] Generate 1 material + 1 item + gold amount per combat win
- [ ] Style inheritance: styled enemies drop styled materials matching enemy style_id
- [ ] `POST /items/{id}/dismantle` endpoint for converting items to 10 gold
- [ ] Gold balance updates via EconomyTransactions ledger

**Frontend Tasks:**
- [ ] Post-combat rewards screen showing material, item, and gold gained
- [ ] Inventory updates reflecting new drops
- [ ] Dismantle button on items with gold amount preview
- [ ] Visual distinction for styled vs normal materials

**Testing:**
- [ ] Verify 100% drop rate (no failed drop cases)
- [ ] Test styled enemies always drop styled materials
- [ ] Confirm dismantling converts items to correct gold amounts

---

### F-04: Materials System
**Goal:** Material application with sync image generation (20s)
**Dependency:** F-03 (equipment), F-05 (drops)

**Backend Tasks:**
- [ ] MaterialStacks table for stackable material inventory
- [ ] MaterialInstances table for individual applied materials
- [ ] `POST /items/{id}/materials/apply` endpoint with 20s sync image generation
- [ ] `POST /items/{id}/materials/remove` with gold cost calculation
- [ ] ItemImageCache integration with combo_hash for global image reuse
- [ ] Integration with generate-image.ts (sync call, blocks response)

**Frontend Tasks:**
- [ ] Material application UI supporting max 3 materials per item
- [ ] 20s loading state during sync image generation
- [ ] Display generated combo images when available
- [ ] Material removal with gold cost confirmation
- [ ] Material inventory with stack quantities

**Testing:**
- [ ] Verify image generation works for new material combinations
- [ ] Test cache hits for previously generated combos
- [ ] Confirm 20s sync generation is acceptable UX (vs async)

---

### F-06: Upgrade System
**Goal:** Gold-based upgrades with exponential cost formula
**Dependency:** F-03 (equipment), F-05 (gold drops)

**Backend Tasks:**
- [ ] Implement upgrade cost formula: `cost = 100 × 1.5^(level-1)`
- [ ] `GET /items/{id}/upgrade-cost` endpoint returning next level cost
- [ ] `POST /items/{id}/upgrade` with gold validation and deduction
- [ ] Item level increases with corresponding stat boosts
- [ ] EconomyTransactions ledger entry for upgrade costs

**Frontend Tasks:**
- [ ] Upgrade button on items showing current level and next cost
- [ ] Gold balance display with real-time updates
- [ ] Upgrade confirmation dialog with cost breakdown
- [ ] Visual progression showing item level improvements

**Testing:**
- [ ] Verify cost formula accuracy across multiple levels
- [ ] Test gold validation prevents upgrades when insufficient funds
- [ ] Confirm stat increases apply immediately after upgrade

---

### F-09: Inventory Management
**Goal:** 100 item cap, basic viewing and filtering
**Dependency:** F-03 (equipment), F-05 (drops)

**Backend Tasks:**
- [ ] `GET /inventory` endpoint with pagination support
- [ ] Item cap validation (max 100 items) on new item acquisition
- [ ] Inventory overflow protection with "inventory full" responses

**Frontend Tasks:**
- [ ] Inventory grid/list view with item thumbnails
- [ ] Filter options by slot type (weapon, armor, etc.)
- [ ] Sort options (level, rarity, recent)
- [ ] "Inventory Full" modal with dismantle suggestions
- [ ] Item detail view with stats and options

**Testing:**
- [ ] Verify 100 item cap enforcement
- [ ] Test UI responsiveness with full inventory
- [ ] Confirm filters and sorting work correctly

---

### F-11: Pet Personality System
**Goal:** Speech bubbles with GPT-4.1-nano during combat
**Dependency:** F-02 (combat), F-03 (pet equipment slot)

**Backend Tasks:**
- [ ] `POST /combat/pet-chatter` endpoint with GPT-4.1-nano integration
- [ ] Pet personality prompt templates (sassy, encouraging, analytical, etc.)
- [ ] Random dialogue passage injection for variety
- [ ] Throttling system (max 1 message per combat turn)
- [ ] Combat context injection (turn number, HP levels, last action)

**Frontend Tasks:**
- [ ] Speech bubble UI component above pet during combat
- [ ] Chatter sound effect and visual animation
- [ ] Auto-dismiss after 2-3 seconds
- [ ] Pet personality selection UI (pre-combat or settings)

**Testing:**
- [ ] Verify AI responses are contextually appropriate
- [ ] Test throttling prevents message spam
- [ ] Confirm different personalities produce distinct dialogue styles

---

### F-12: Enemy AI Personality System
**Goal:** Enemy trash-talk with combat context awareness
**Dependency:** F-02 (combat)

**Backend Tasks:**
- [ ] `POST /combat/enemy-chatter` endpoint with enemy-specific prompts
- [ ] Enemy personality traits per enemy type (aggressive, sarcastic, etc.)
- [ ] Player combat history tracking per location
- [ ] Context injection (player performance, current streak, combat events)

**Frontend Tasks:**
- [ ] Speech bubble UI above enemy during combat
- [ ] Chatter triggered by specific combat events (hits, misses, low HP)
- [ ] Visual styling matching enemy personality/style

**Testing:**
- [ ] Verify contextual trash-talk based on player performance
- [ ] Test different enemy types produce appropriate dialogue
- [ ] Confirm history tracking affects enemy responses

## Polish & Integration Testing
- [ ] **End-to-end testing:** Complete combat loop from map → battle → rewards → equipment
- [ ] **Performance verification:** Confirm 20s image generation is acceptable (not async)
- [ ] **UI/UX consistency:** Ensure consistent styling, animations, and design system usage
- [ ] **Error handling:** Network failures, AI service timeouts, invalid states
- [ ] **Cross-feature integration:** Equipment stats affect combat, drops fill inventory, materials work with equipment

## Analytics & Monitoring Setup
- [ ] **Basic event tracking:** combat_started, combat_completed, item_equipped, material_applied
- [ ] **Error logging:** Combat failures, image generation failures, auth issues
- [ ] **Performance metrics:** API response times, image generation duration
- [ ] **User funnel events:** registration, first_combat, first_upgrade, first_craft

## Deployment Preparation
- [ ] **Environment variable validation:** All production keys configured correctly
- [ ] **Database migrations executed:** Schema matches data-plan.yaml specifications
- [ ] **Seed data loaded:** 30 SF locations, materials, items, equipment slots populated
- [ ] **AI service monitoring:** Replicate/OpenAI quotas sufficient for expected usage
- [ ] **TestFlight build:** Internal testing build ready for stakeholder review

## Known MVP0 Limitations (Document for MVP1)
- **No location cooldowns** - Unlimited re-battles at same location
- **Single dial pattern only** - Only single_arc implemented, other patterns reserved
- **Sync image generation** - 20s blocking UI during material application
- **100 item inventory cap** - No expansion mechanism yet
- **No XP display** - Player progression hidden from UI
- **No loadout system** - Single equipment configuration only
- **No monetization** - Premium features and IAP not implemented
- **GPS non-blocking** - Location permission optional in MVP0
- **Limited enemy variety** - Enemy difficulty locked to level 1 permanently

---

## Dependencies Graph

**Critical Path (Sequential):**
```
F-07 (Authentication)
  ↓
F-01 (Map/Locations)
  ↓
F-02 (Combat System)
  ↓
F-05 (Drop System)
```

**Parallel Development After Combat:**
```
F-02 (Combat)
  ├── F-03 (Equipment) → F-06 (Upgrades)
  ├── F-04 (Materials) → (depends on F-03)
  ├── F-11 (Pet Chatter)
  └── F-12 (Enemy Chatter)

F-03 + F-05 → F-09 (Inventory)
```

**Integration Points:**
- F-11/F-12 require F-02 combat events for trigger context
- F-04 requires F-03 equipment and F-05 drops for material sources
- F-06 requires F-05 gold economy
- F-09 requires F-03 equipment reference and F-05 item drops

---

**Estimated Implementation Timeline:** 4-6 weeks for full MVP0 with 2-3 developers (1 backend, 1 frontend, 1 full-stack for AI integration)