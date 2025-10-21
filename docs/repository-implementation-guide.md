# Repository Implementation Guide

## Open Questions - RESOLVED

1. **Redis Integration**: ✅ CombatRepository uses Redis directly for active sessions
2. **Transaction Handling**: ✅ Use Supabase RPC functions for complex transactions
3. **Query Builder**: ✅ Continue using Supabase client (no external query builder)
4. **Type Safety**: ✅ Use existing `database.types.ts` (generated via `pnpm supabase:types`)

## Repository Requirements

- **All repositories extend BaseRepository**
- **Services use repositories, NOT direct DB access**
- **Repositories handle all Supabase client interactions**

---

## Complete Repository List

### 1. ItemRepository
**Tables**: `items`, `itemtypes`, `itemhistory`

**Responsibilities**:
- Item CRUD operations with ownership validation
- Complex joins to ItemTypes for base stats
- Item level management and stat computation
- Item history audit trail
- Image generation metadata (combo_hash, image_url, generation_status)

**Key Methods**:
```typescript
// Basic CRUD
findById(itemId: string, userId?: string): Promise<Item | null>
findByUser(userId: string): Promise<Item[]>
create(userId: string, itemTypeId: string): Promise<Item>
update(itemId: string, data: UpdateItemData): Promise<Item>
delete(itemId: string): Promise<boolean>

// Complex queries
findWithMaterials(itemId: string): Promise<ItemWithDetails>
findWithItemType(itemId: string): Promise<ItemWithDetails>
findEquippedByUser(userId: string): Promise<Item[]>
findByType(userId: string, itemTypeId: string): Promise<Item[]>

// Level & stats management
updateLevel(itemId: string, newLevel: number): Promise<void>
updateStats(itemId: string, stats: Stats): Promise<void>
updateImageData(itemId: string, comboHash: string, imageUrl: string, status: string): Promise<void>

// History tracking
addHistoryEvent(itemId: string, eventType: string, eventData: any): Promise<void>
getItemHistory(itemId: string): Promise<ItemHistoryEvent[]>

// Batch operations
findManyWithDetails(itemIds: string[]): Promise<ItemWithDetails[]>
findByUserWithPagination(userId: string, limit: number, offset: number): Promise<Item[]>
```

**Foreseen Difficulties**:
- ⚠️ **Complex nested joins**: Items → ItemTypes → ItemMaterials → MaterialInstances → Materials requires careful query construction
- ⚠️ **Stat computation**: `current_stats` field may be cached or computed on-read (need to verify trigger existence)
- ⚠️ **N+1 query risk**: Fetching items with materials for inventory view could cause performance issues
  - **Solution**: See `agent-responses/agent_830867.md` for detailed explanation and Supabase nested select() examples
- ⚠️ **Image generation status**: Need to handle atomic updates when image generation completes
- ⚠️ **Ownership validation**: Every query must validate `user_id` to prevent unauthorized access

**Migration Strategy**:
1. Start with basic CRUD (no joins)
2. Add ItemTypes join for base stats
3. Add MaterialInstances join for applied materials
4. Optimize with single composite query
5. Add caching layer for frequently accessed items

---

### 2. MaterialRepository
**Tables**: `materials`, `materialstacks`, `materialinstances`, `itemmaterials`

**Responsibilities**:
- Material template retrieval (seed data)
- MaterialStacks inventory management (stackable quantities)
- MaterialInstance lifecycle (create on apply, delete on remove)
- ItemMaterials junction table management
- Style-based material tracking (styled materials stack separately)

**Key Methods**:
```typescript
// Material templates (seed data - read-only)
findMaterialById(materialId: string): Promise<Material | null>
findAllMaterials(): Promise<Material[]>
findMaterialsByTheme(theme: string): Promise<Material[]>

// Stack management (user inventory)
findStackByUser(userId: string, materialId: string, styleId: string): Promise<MaterialStack | null>
findAllStacksByUser(userId: string): Promise<MaterialStack[]>
findStyledMaterialsByUser(userId: string): Promise<MaterialStack[]> // where style_id != 'normal'
incrementStack(userId: string, materialId: string, styleId: string, quantity: number): Promise<void>
decrementStack(userId: string, materialId: string, styleId: string, quantity: number): Promise<void>
createStack(userId: string, materialId: string, styleId: string, quantity: number): Promise<MaterialStack>
deleteStackIfEmpty(userId: string, materialId: string, styleId: string): Promise<void>

// Instance management (applied to items)
createInstance(userId: string, materialId: string, styleId: string): Promise<MaterialInstance>
deleteInstance(instanceId: string): Promise<MaterialInstance> // returns instance data for stack restoration
findInstanceById(instanceId: string): Promise<MaterialInstance | null>

// ItemMaterials junction (application to items)
applyToItem(itemId: string, instanceId: string, slotIndex: number): Promise<void>
removeFromItem(itemId: string, slotIndex: number): Promise<MaterialInstance>
findMaterialsByItem(itemId: string): Promise<AppliedMaterial[]>
getSlotOccupancy(itemId: string): Promise<number[]> // returns occupied slot indices
```

**Foreseen Difficulties**:
- ⚠️ **Composite PK on MaterialStacks**: (user_id, material_id, style_id) requires all 3 fields for lookups
  - **Solution**: See `agent-responses/agent_659351.md` for complete analysis and MaterialStacksRepository implementation with composite key methods
- ⚠️ **Style inheritance**: Enemies drop styled materials - need to ensure style_id flows from combat to stack
- ⚠️ **Stack vs Instance confusion**: MaterialStacks = inventory (stackable), MaterialInstances = applied to items (unique)
- ⚠️ **Slot index validation**: Must enforce 0-2 range and prevent duplicate slots via UNIQUE constraint
- ⚠️ **Atomic apply/remove**: Decrement stack → create instance → link to item must be transactional (use RPC)
  - **Solution**: See `agent-responses/agent_358701.md` for complete atomic transaction strategy with RPC function examples
- ⚠️ **UNIQUE constraint on material_instance_id**: Prevents reusing same instance on multiple items - need clear error handling
- ⚠️ **Zero quantity stacks**: Need cleanup logic when quantity reaches 0

**Migration Strategy**:
1. Implement read-only material template queries
2. Add MaterialStacks CRUD with composite PK handling
3. Add MaterialInstance lifecycle methods
4. Implement ItemMaterials junction operations
5. Create RPC functions for atomic apply/remove transactions
6. Add batch operations for combat loot distribution

**Transaction Patterns** (RPC functions needed):
```sql
-- apply_material_to_item(p_user_id, p_item_id, p_material_id, p_style_id, p_slot_index)
-- Atomically: decrement stack → create instance → link to item → update item.is_styled

-- remove_material_from_item(p_item_id, p_slot_index)
-- Atomically: unlink from item → delete instance → increment stack → update item.is_styled

-- replace_material_on_item(p_user_id, p_item_id, p_slot_index, p_new_material_id, p_new_style_id)
-- Atomically: remove old → apply new
```

---

### 3. EquipmentRepository
**Tables**: `userequipment`, `equipmentslots`

**Responsibilities**:
- UserEquipment 8-slot state management (single source of truth)
- Equip/unequip operations with slot validation
- Equipped item queries with stats aggregation
- Slot conflict resolution (replace existing item)
- Loadout activation support (bulk equipment updates)

**Key Methods**:
```typescript
// Slot state queries
findEquippedByUser(userId: string): Promise<EquipmentSlots> // all 8 slots with items
findItemInSlot(userId: string, slotName: string): Promise<Item | null>
isItemEquipped(itemId: string): Promise<boolean>
getEquippedSlotForItem(itemId: string): Promise<string | null> // returns slot_name

// Equip operations
equipItem(userId: string, itemId: string, slotName: string): Promise<void>
unequipSlot(userId: string, slotName: string): Promise<void>
replaceSlot(userId: string, slotName: string, newItemId: string): Promise<void>

// Stats aggregation
computeTotalStats(userId: string): Promise<Stats>

// Bulk operations (for loadout switching)
equipMultiple(userId: string, slotAssignments: BulkEquipmentUpdate): Promise<void>
clearAllSlots(userId: string): Promise<void>

// Validation
validateSlotCompatibility(itemId: string, slotName: string): Promise<boolean> // check item category matches slot
getAllSlotNames(): Promise<string[]> // from EquipmentSlots seed table
```

**Foreseen Difficulties**:
- ⚠️ **8 hardcoded slots**: Slot names must match EquipmentSlots seed data exactly
- ⚠️ **Slot-item category matching**: Weapon items only go in weapon slot, etc. - need ItemTypes.category validation
- ⚠️ **LEFT JOIN complexity**: UserEquipment may have NULL item_id - need careful NULL handling
- ⚠️ **Stats aggregation**: Must sum stats from all equipped items - do in app code or DB function?
- ✅ **Bulk updates**: RESOLVED - Use activate_loadout() RPC function for atomic loadout switching
- ✅ **Database triggers**: RESOLVED - Triggers now active for vanity_level and avg_item_level (migration 003_add_cache_triggers.sql)
- ⚠️ **Loadout activation race conditions**: Switching loadouts rapidly could cause conflicts

**Migration Strategy**:
1. Implement single-slot equip/unequip operations
2. Add validation for slot-item category compatibility
3. Add stats aggregation (start with app code, optimize with DB view later)
4. Implement bulk operations for loadout support
5. Create RPC function for atomic loadout switching

**Transaction Patterns** (RPC functions needed):
```sql
-- equip_item(p_user_id, p_item_id, p_slot_name)
-- Validate category → insert/update UserEquipment → recalc stats

-- activate_loadout(p_user_id, p_loadout_id)
-- Copy LoadoutSlots → UserEquipment (bulk) → recalc stats → set is_active
```

---

### 4. ProfileRepository
**Tables**: `users`, `usercurrencybalances`, `economytransactions`, `playerprogression`, `devicetokens`

**Responsibilities**:
- User account CRUD
- Currency balance management (GOLD, GEMS)
- Economy transaction logging (audit trail)
- Player progression tracking (XP, level)
- Device token management for push notifications
- Derived stat updates (vanity_level, avg_item_level via triggers)

**Key Methods**:
```typescript
// User account
findUserById(userId: string): Promise<User | null>
findUserByDeviceId(deviceId: string): Promise<User | null>
findUserByEmail(email: string): Promise<User | null>
updateUser(userId: string, data: Partial<User>): Promise<User>
updateLastLogin(userId: string): Promise<void>

// Currency management
getCurrencyBalance(userId: string, currencyCode: 'GOLD' | 'GEMS'): Promise<number>
getAllCurrencyBalances(userId: string): Promise<{ GOLD: number; GEMS: number }>
updateCurrencyBalance(userId: string, currencyCode: string, newBalance: number): Promise<void>
deductCurrency(userId: string, currencyCode: string, amount: number): Promise<number> // returns new balance, throws if insufficient
addCurrency(userId: string, currencyCode: string, amount: number): Promise<number>

// Transaction logging (EVERY currency change must log)
logTransaction(transaction: EconomyTransactionData): Promise<void>
getTransactionHistory(userId: string, limit?: number): Promise<EconomyTransaction[]>
getTransactionsByType(userId: string, sourceType: string): Promise<EconomyTransaction[]>

// Progression
getProgression(userId: string): Promise<PlayerProgression | null>
updateProgression(userId: string, data: PlayerProgressionUpdate): Promise<void>
addXP(userId: string, xpAmount: number): Promise<{ newXP: number; newLevel: number; leveledUp: boolean }>

// Device tokens (push notifications)
registerDeviceToken(userId: string, platform: string, token: string): Promise<void>
getActiveDeviceTokens(userId: string): Promise<DeviceToken[]>
deactivateDeviceToken(token: string): Promise<void>

// Derived stats (triggered by UserEquipment changes)
updateVanityLevel(userId: string): Promise<number> // sum of equipped item levels
updateAvgItemLevel(userId: string): Promise<number> // avg of equipped item levels
```

**Foreseen Difficulties**:
- ✅ **Deprecated gold_balance field**: FIXED - AuthController now initializes UserCurrencyBalances instead (agent_092674)
- ⚠️ **Transaction logging requirement**: EVERY currency change MUST write to EconomyTransactions - easy to forget
- ⚠️ **Insufficient funds handling**: deductCurrency must check balance and throw BusinessLogicError if insufficient
- ✅ **Composite balance operations**: RESOLVED - Use deduct_currency_with_logging() and add_currency_with_logging() RPC functions
- ⚠️ **XP level-up calculation**: Need formula for XP thresholds (not defined in data-plan.yaml - ask user?)
- ✅ **Vanity level triggers**: RESOLVED - Triggers now active in database (migration 003_add_cache_triggers.sql)
- ⚠️ **Device token uniqueness**: UNIQUE constraint on token - handle duplicate registration gracefully

**Migration Strategy**:
1. Implement basic user account operations
2. Add currency balance queries (ignore deprecated gold_balance)
3. Add transaction logging (make it required for all currency ops)
4. Implement progression tracking with level-up logic
5. Add device token management
6. Create RPC functions for atomic currency operations

**Transaction Patterns** (RPC functions needed):
```sql
-- deduct_currency_with_logging(p_user_id, p_currency_code, p_amount, p_source_type, p_source_id, p_metadata)
-- Check balance → deduct → log transaction (atomic)

-- add_currency_with_logging(p_user_id, p_currency_code, p_amount, p_source_type, p_source_id, p_metadata)
-- Add → log transaction (atomic)

-- add_xp_and_level_up(p_user_id, p_xp_amount)
-- Add XP → check if level up → update level + xp_to_next_level
```

---

### 5. LocationRepository
**Tables**: `locations`, `enemypools`, `enemypoolmembers`, `lootpools`, `lootpoolentries`, `lootpooltierweights`

**Responsibilities**:
- PostGIS geospatial queries (already partially implemented in LocationService)
- Nearby location searches with distance calculation
- Location metadata by type/region
- Enemy pool matching for combat initialization
- Loot pool matching for combat rewards
- Pool-based weighted random selection

**Key Methods**:
```typescript
// Spatial queries (PostGIS)
findNearby(lat: number, lng: number, radius: number): Promise<LocationWithDistance[]>
findById(locationId: string): Promise<Location | null>

// Location metadata
findByType(locationType: string): Promise<Location[]>
findByRegion(stateCode: string, countryCode: string): Promise<Location[]>
findAll(): Promise<Location[]>

// Enemy pools (for combat initialization)
getMatchingEnemyPools(location: Location, combatLevel: number): Promise<string[]> // returns pool IDs
getEnemyPoolMembers(poolIds: string[]): Promise<EnemyPoolMember[]>
selectRandomEnemy(poolMembers: EnemyPoolMember[]): string // weighted random (in-memory, not DB)

// Loot pools (for combat rewards)
getMatchingLootPools(location: Location, combatLevel: number): Promise<string[]> // returns pool IDs
getLootPoolEntries(poolIds: string[]): Promise<LootPoolEntry[]>
getLootPoolTierWeights(poolIds: string[]): Promise<LootPoolTierWeight[]>
selectRandomLoot(poolEntries: LootPoolEntry[], tierWeights: LootPoolTierWeight[]): LootDrop[] // weighted random
```

**Foreseen Difficulties**:
- ⚠️ **PostGIS RPC function**: Uses `get_nearby_locations(user_lat, user_lng, search_radius)` - already implemented
- ⚠️ **Pool matching logic**: Complex filter-based matching (universal | location_type | state | country | lat_range | lng_range)
- ⚠️ **Multiple pool sources**: Universal pools + location-specific pools must be combined with proper weight aggregation
- ⚠️ **Weighted random selection**: Pool members have spawn_weight - need fair random selection algorithm
- ⚠️ **Tier-based loot weighting**: LootPoolTierWeights multipliers affect material drop rates based on derived MaterialStrengthTiers
- ⚠️ **Style inheritance**: Loot drops inherit style_id from enemy that dropped them
- ⚠️ **Level-aware pools**: Pools are specific to combat_level - must filter correctly

**Migration Strategy**:
1. Port existing LocationService.nearby() to repository
2. Add location metadata queries
3. Implement enemy pool matching logic
4. Implement loot pool matching logic
5. Add weighted random selection helpers
6. Create view or RPC for optimized pool queries

**Query Optimization Needed**:
```sql
-- get_matching_enemy_pools(p_location_id, p_combat_level)
-- Returns aggregated pool members with summed spawn_weights

-- get_matching_loot_pools(p_location_id, p_combat_level)
-- Returns pool entries with applied tier weight multipliers

-- v_loot_pool_material_weights view (already defined in data-plan.yaml:896)
-- Computes final drop weights per material per pool
```

---

### 6. LoadoutRepository
**Tables**: `loadouts`, `loadoutslots`

**Responsibilities**:
- Loadout CRUD operations (saved equipment configurations)
- LoadoutSlots management (item assignments per loadout)
- Loadout activation (copy slots → UserEquipment)
- Active loadout tracking (only one per user)
- Name uniqueness validation per user

**Key Methods**:
```typescript
// Loadout management
findLoadoutsByUser(userId: string): Promise<LoadoutWithSlots[]>
findLoadoutById(loadoutId: string): Promise<LoadoutWithSlots | null>
createLoadout(userId: string, name: string): Promise<Loadout>
updateLoadoutName(loadoutId: string, name: string): Promise<Loadout>
deleteLoadout(loadoutId: string): Promise<void>

// Slot assignments
getLoadoutSlots(loadoutId: string): Promise<LoadoutSlotAssignments>
updateLoadoutSlots(loadoutId: string, slots: LoadoutSlotAssignments): Promise<void>
updateSingleSlot(loadoutId: string, slotName: string, itemId: string | null): Promise<void>

// Activation
setActiveLoadout(userId: string, loadoutId: string): Promise<void> // deactivates others, activates this one
getActiveLoadout(userId: string): Promise<LoadoutWithSlots | null>
activateLoadout(loadoutId: string): Promise<void> // copies slots to UserEquipment

// Validation
isLoadoutNameUnique(userId: string, name: string, excludeLoadoutId?: string): Promise<boolean>
validateLoadoutOwnership(loadoutId: string, userId: string): Promise<boolean>
canDeleteLoadout(loadoutId: string): Promise<boolean> // cannot delete active loadout
```

**Foreseen Difficulties**:
- ⚠️ **UNIQUE constraint**: (user_id, name) must be unique - handle duplicate name errors gracefully
- ⚠️ **Partial UNIQUE on is_active**: Only ONE loadout can have is_active=true per user (PostgreSQL partial index)
- ⚠️ **Bulk slot updates**: updateLoadoutSlots replaces all 8 slots - must be atomic
- ✅ **Loadout activation transaction**: RESOLVED - Use activate_loadout() RPC function for atomic activation
- ⚠️ **Cannot delete active loadout**: Need to prevent deletion of is_active=true loadouts
- ⚠️ **Item ownership validation**: LoadoutSlots.item_id must reference user's items - validate before save
- ⚠️ **Cascade deletes**: Deleting loadout must delete all LoadoutSlots (ON DELETE CASCADE)

**Migration Strategy**:
1. Implement basic loadout CRUD
2. Add loadout slots management
3. Implement activation logic (start with service layer, move to RPC if needed)
4. Add validation helpers
5. Create RPC function for atomic activation

**Transaction Patterns** (RPC functions needed):
```sql
-- activate_loadout(p_user_id, p_loadout_id)
-- 1. Deactivate all user's loadouts (is_active = false)
-- 2. Activate target loadout (is_active = true)
-- 3. Copy LoadoutSlots → UserEquipment (bulk update all 8 slots)
-- 4. Recalculate user stats (vanity_level, avg_item_level)
```

---

### 7. CombatRepository
**Tables**: `combatsessions`, `combatlogevents`, `playercombathistory`
**External Storage**: Redis (active sessions, 15min TTL)

**Responsibilities**:
- Active combat session management (Redis for ephemeral data)
- Combat log event tracking (normalized turn-by-turn)
- Player combat history per location (persistent analytics)
- Session initialization with pool data
- Combat ratings and win probability tracking

**Key Methods**:
```typescript
// Active sessions (Redis - 15min TTL)
createSession(userId: string, sessionData: CombatSessionData): Promise<string> // returns session_id
getActiveSession(sessionId: string): Promise<CombatSessionData | null>
updateSession(sessionId: string, data: Partial<CombatSessionData>): Promise<void>
completeSession(sessionId: string, result: CombatResult): Promise<void> // writes to PostgreSQL, removes from Redis
deleteSession(sessionId: string): Promise<void> // emergency cleanup

// Combat log events (PostgreSQL - normalized)
addLogEvent(combatId: string, event: CombatLogEventData): Promise<void>
getLogEvents(combatId: string): Promise<CombatLogEventData[]>
getLogEventsByActor(combatId: string, actor: 'player' | 'enemy' | 'system'): Promise<CombatLogEventData[]>

// Player history (PostgreSQL - persistent analytics)
getPlayerHistory(userId: string, locationId: string): Promise<PlayerCombatHistoryData | null>
updatePlayerHistory(userId: string, locationId: string, result: 'victory' | 'defeat'): Promise<void>
incrementAttempts(userId: string, locationId: string): Promise<void>
updateStreak(userId: string, locationId: string, won: boolean): Promise<void>

// Session archival (move Redis → PostgreSQL on complete)
archiveSession(sessionId: string, sessionData: CombatSessionData): Promise<void>
```

**Foreseen Difficulties**:
- ⚠️ **Dual storage**: Active sessions in Redis (ephemeral) + archived sessions in PostgreSQL (persistent)
- ⚠️ **Redis client setup**: Need to configure Redis client separately from Supabase
- ⚠️ **15min TTL enforcement**: Redis TTL = 900 seconds, must be set on session creation
- ⚠️ **Session expiry handling**: What happens if session expires mid-combat? Need graceful degradation
- ⚠️ **Combat log JSON vs normalized**: Legacy `combat_log` JSON array vs new `combatlogevents` normalized table - migrate gradually?
- ⚠️ **Player history UPSERT**: First combat at location = INSERT, subsequent = UPDATE
- ⚠️ **Streak calculation**: current_streak increments on win, resets on loss - need atomic update
- ⚠️ **Combat ratings**: player_rating and enemy_rating use combat_rating() function - need to call DB function
- ⚠️ **Session archival race**: Complete session → write to PostgreSQL → delete from Redis (must be atomic-ish)

**Migration Strategy**:
1. Set up Redis client in src/config/redis.ts
2. Implement Redis session operations (create, get, update, delete)
3. Add PostgreSQL archival on session completion
4. Implement CombatLogEvents normalized logging
5. Add PlayerCombatHistory UPSERT operations
6. Create RPC function for atomic history updates

**Transaction Patterns** (RPC functions needed):
```sql
-- update_combat_history(p_user_id, p_location_id, p_result)
-- UPSERT player history:
--   - increment total_attempts
--   - increment victories OR defeats
--   - update current_streak (increment or reset to 0)
--   - update longest_streak if current > longest
--   - set last_attempt timestamp
```

**Redis Key Structure**:
```
combat:session:{session_id} → JSON string of CombatSessionData (TTL: 900s)
combat:user:{user_id}:active → session_id (for lookup, TTL: 900s)
```

---

### 8. ImageCacheRepository
**Tables**: `itemimagecache`

**Responsibilities**:
- ItemImageCache lookup by combo_hash
- Cache entry creation with craft_count
- Craft count increment on cache hit
- Popular combo queries
- Provider tracking (gemini, seedream)

**Key Methods**:
```typescript
// Cache lookup
findByComboHash(itemTypeId: string, comboHash: string): Promise<ItemImageCacheEntry | null>
findById(cacheId: string): Promise<ItemImageCacheEntry | null>

// Cache creation
createCacheEntry(data: CreateImageCacheData): Promise<ItemImageCacheEntry>

// Craft count management
incrementCraftCount(cacheId: string): Promise<number> // returns new count
getCraftCount(itemTypeId: string, comboHash: string): Promise<number>

// Analytics queries
getMostPopularCombos(limit: number): Promise<ItemImageCacheEntry[]>
getCombosByProvider(provider: string): Promise<ItemImageCacheEntry[]>
getCombosByItemType(itemTypeId: string): Promise<ItemImageCacheEntry[]>
getTotalUniqueComboCount(): Promise<number>
```

**Foreseen Difficulties**:
- ⚠️ **UNIQUE constraint**: (item_type_id, combo_hash) must be unique - handle duplicate insert gracefully
- ⚠️ **Combo hash determinism**: combo_hash = f(sorted material_ids + style_ids) - ensure consistent hashing algorithm
- ⚠️ **Global cache**: ItemImageCache is NOT user-scoped - same combo used by all users
- ⚠️ **Craft count atomicity**: increment must be atomic to avoid race conditions (use SQL UPDATE ... RETURNING)
- ⚠️ **First craft detection**: Service needs to know if cache lookup is hit or miss for `is_first_craft` flag
- ⚠️ **R2 URL storage**: image_url is full R2 URL - must validate URL format
- ⚠️ **Provider tracking**: Optional field - may be null for legacy entries

**Migration Strategy**:
1. Implement basic cache lookup and creation
2. Add atomic craft count increment
3. Add analytics queries for popular combos
4. Add provider filtering queries
5. No RPC needed - simple CRUD operations

---

### 9. EnemyRepository
**Tables**: `enemytypes`, `enemypools`, `enemypoolmembers`, `tiers`, `styledefinitions`

**Responsibilities**:
- Enemy type retrieval with personality data
- Enemy pool configuration
- Tier-based stat calculation (additive scaling)
- Style-based enemy variants
- Enemy selection for combat

**Key Methods**:
```typescript
// Enemy types
findEnemyTypeById(enemyTypeId: string): Promise<EnemyType | null>
findAllEnemyTypes(): Promise<EnemyType[]>
findEnemyTypesByTier(tierId: number): Promise<EnemyType[]>
findEnemyTypesByStyle(styleId: string): Promise<EnemyType[]>

// Enemy stats (computed via view or function)
getEnemyRealizedStats(enemyTypeId: string): Promise<Stats> // uses v_enemy_realized_stats view
computeCombatRating(enemyTypeId: string): Promise<number> // uses combat_rating() function

// Tiers
findTierById(tierId: number): Promise<Tier | null>
getAllTiers(): Promise<Tier[]>

// Styles
findStyleById(styleId: string): Promise<StyleDefinition | null>
getAllStyles(): Promise<StyleDefinition[]>
findStyleByName(styleName: string): Promise<StyleDefinition | null>

// Pool management (admin operations)
createEnemyPool(name: string, combatLevel: number, filterType: string, filterValue: string): Promise<EnemyPool>
addEnemyToPool(poolId: string, enemyTypeId: string, spawnWeight: number): Promise<void>
removeEnemyFromPool(poolId: string, enemyTypeId: string): Promise<void>
```

**Foreseen Difficulties**:
- ⚠️ **v_enemy_realized_stats view**: data-plan.yaml:870 defines view - use it instead of manual calculation
- ⚠️ **Additive tier scaling**: base + offset + (tier_adds * (tier_num - 1)) - complex formula
- ⚠️ **Style spawn rates**: StyleDefinitions.spawn_rate affects enemy encounter probability
- ⚠️ **Styled enemy → styled loot**: Enemies with style_id drop materials with matching style_id
- ⚠️ **Personality data**: ai_personality_traits, dialogue_tone, base_dialogue_prompt are JSON/TEXT - need careful type handling
- ⚠️ **Tier FK validation**: EnemyTypes.tier_id references Tiers.id (not tier_num) - verify seed data consistency

**Migration Strategy**:
1. Implement basic enemy type queries
2. Add tier and style lookups
3. Use v_enemy_realized_stats view for stat queries
4. Add pool management operations (admin only)
5. No complex transactions needed - mostly read operations

---

### 10. RarityRepository
**Tables**: `raritydefinitions`, `materialstrengthtiers`

**Responsibilities**:
- Rarity definitions for items (common → legendary)
- Material strength tier calculations (derived from stat_modifiers)
- Drop rate and stat multiplier lookups

**Key Methods**:
```typescript
// Rarity definitions (items only)
findRarityByName(rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'): Promise<RarityDefinition | null>
getAllRarities(): Promise<RarityDefinition[]>
getStatMultiplier(rarity: string): Promise<number>
getBaseDropRate(rarity: string): Promise<number>

// Material strength tiers (derived from Materials.stat_modifiers)
findMaterialTier(materialId: string): Promise<MaterialStrengthTier | null> // uses v_material_tiers view
getAllMaterialTiers(): Promise<MaterialStrengthTier[]>
computeMaterialAbsSum(statModifiers: Stats): number // helper: ABS(atkPower) + ABS(atkAccuracy) + ...
```

**Foreseen Difficulties**:
- ⚠️ **Rarity ONLY for items**: Materials do NOT have rarity - only strength tiers (derived)
- ⚠️ **v_material_tiers view**: data-plan.yaml:888 defines view for derived tier classification
- ⚠️ **Stat multiplier range**: 1.00 (common) → 2.00 (legendary) - validate constraints
- ⚠️ **Drop rate probabilities**: base_drop_rate BETWEEN 0 AND 1 - validate constraints
- ⚠️ **Tier threshold ranges**: [min_abs_sum, max_abs_sum) are ranges - need BETWEEN query logic

**Migration Strategy**:
1. Implement rarity definition lookups (simple seed data queries)
2. Use v_material_tiers view for tier lookups
3. Add helper functions for abs_sum calculation
4. No write operations needed - seed data is read-only

---

### 11. AnalyticsRepository
**Tables**: `analyticsevents`, `combatchatterlog`, `enemychatterlog`

**Responsibilities**:
- Event tracking for analytics (user actions, milestones)
- Pet chatter logging (F-11 personality system)
- Enemy chatter logging (F-12 AI trash-talk)
- Time-series queries for metrics

**Key Methods**:
```typescript
// General analytics events
logEvent(userId: string | null, eventName: string, properties: any): Promise<void>
getEventsByUser(userId: string, eventName?: string): Promise<AnalyticsEvent[]>
getEventsByTimeRange(startTime: string, endTime: string, eventName?: string): Promise<AnalyticsEvent[]>
getEventCounts(eventName: string, groupBy: 'hour' | 'day' | 'week'): Promise<Record<string, number>>

// Pet chatter logs (F-11)
logPetChatter(sessionId: string, petItemId: string, eventType: string, dialogue: string, generationTimeMs: number, wasAI: boolean): Promise<void>
getPetChatterBySession(sessionId: string): Promise<CombatChatterLog[]>
getPetChatterByPersonality(personalityType: string): Promise<CombatChatterLog[]>
getAvgGenerationTime(personalityType: string): Promise<number>

// Enemy chatter logs (F-12)
logEnemyChatter(sessionId: string, enemyTypeId: string, eventType: string, dialogue: string, playerContext: any, generationTimeMs: number, wasAI: boolean): Promise<void>
getEnemyChatterBySession(sessionId: string): Promise<EnemyChatterLog[]>
getEnemyChatterByType(enemyTypeId: string): Promise<EnemyChatterLog[]>
getAvgEnemyChatterGenerationTime(enemyTypeId: string): Promise<number>
```

**Foreseen Difficulties**:
- ⚠️ **Large table growth**: Analytics tables grow unbounded - need partitioning strategy (data-plan.yaml:1387)
- ⚠️ **Time-series queries**: Grouping by hour/day/week requires DATE_TRUNC or time buckets
- ⚠️ **JSONB properties**: analyticsevents.properties is JSONB - need flexible query support
- ⚠️ **Nullable user_id**: Some events are system-level (user_id = NULL)
- ⚠️ **Chatter performance**: CombatChatterLog and EnemyChatterLog track generation_time_ms for latency monitoring
- ⚠️ **AI vs fallback tracking**: was_ai_generated flag distinguishes AI vs canned phrases

**Migration Strategy**:
1. Implement basic event logging
2. Add time-range queries
3. Add chatter-specific logging methods
4. Add aggregation queries (counts, averages)
5. Consider table partitioning for production (monthly partitions)

---

### 12. PetRepository
**Tables**: `pets`, `petpersonalities`

**Responsibilities**:
- Pet item extensions (items where category='pet')
- Pet personality assignment
- Custom pet naming
- Chatter history management

**Key Methods**:
```typescript
// Pet management
findPetByItemId(itemId: string): Promise<Pet | null>
createPet(itemId: string): Promise<Pet> // when pet item is created
updatePetPersonality(itemId: string, personalityId: string, customName?: string): Promise<void>
updateCustomName(itemId: string, customName: string): Promise<void>
updateChatterHistory(itemId: string, chatterHistory: any): Promise<void>

// Personality templates
findPersonalityById(personalityId: string): Promise<PetPersonality | null>
getAllPersonalities(): Promise<PetPersonality[]>
findPersonalityByType(personalityType: string): Promise<PetPersonality | null>

// Validation
validatePetItemCategory(itemId: string): Promise<boolean> // check ItemTypes.category = 'pet'
```

**Foreseen Difficulties**:
- ⚠️ **CHECK constraint**: Pets.item_id must reference Items where ItemTypes.category='pet' (data-plan.yaml:582)
- ⚠️ **Chatter history JSONB**: Recent dialogue stored for context - need size limits to prevent bloat
- ⚠️ **Pet creation trigger**: When item with category='pet' is created, Pets row should auto-create (trigger needed?)
- ⚠️ **Nullable personality**: Pets can exist without assigned personality (personality_id nullable)
- ⚠️ **Custom name validation**: max length, profanity filter?

**Migration Strategy**:
1. Implement basic pet CRUD
2. Add personality lookups
3. Add validation for pet item category
4. Create trigger for auto pet row creation on pet item insert

---

### 13. WeaponRepository
**Tables**: `weapons`

**Responsibilities**:
- Weapon timing mechanics (extends Items where category='weapon')
- Weapon pattern configuration (single_arc, dual_arcs, etc.)
- Hit band degree allocations (injure, miss, graze, normal, crit)
- Accuracy-adjusted band calculations

**Key Methods**:
```typescript
// Weapon data
findWeaponByItemId(itemId: string): Promise<Weapon | null>
createWeapon(itemId: string, pattern: string, degreeConfig: DegreeConfig): Promise<Weapon>
updateWeaponPattern(itemId: string, pattern: string): Promise<void>
updateHitBands(itemId: string, bands: DegreeConfig): Promise<void>

// Combat calculations
getAdjustedBands(weaponId: string, playerAccuracy: number): Promise<AdjustedBands> // uses fn_weapon_bands_adjusted()
getExpectedDamageMultiplier(weaponId: string, playerAccuracy: number): Promise<number> // uses fn_expected_mul_quick()

// Validation
validateDegreeSum(degrees: DegreeConfig): boolean // sum must be <= 360
validateSpinSpeed(spinDegPerS: number): boolean // must be > 0
```

**Foreseen Difficulties**:
- ⚠️ **CHECK constraints**: deg_injure + deg_miss + deg_graze + deg_normal + deg_crit <= 360 (data-plan.yaml:480)
- ⚠️ **Weapon creation trigger**: When item with category='weapon' is created, Weapons row should auto-create (trigger needed?)
- ⚠️ **fn_weapon_bands_adjusted() function**: PostgreSQL function adjusts bands based on accuracy (data-plan.yaml:831)
- ⚠️ **fn_expected_mul_quick() function**: Calculates expected damage multiplier (data-plan.yaml:838)
- ⚠️ **MVP0 simplification**: Only single_arc pattern enabled (data-plan.yaml:13)
- ⚠️ **Degree allocation complexity**: Hit bands create skill-based timing gameplay - need careful validation

**Migration Strategy**:
1. Implement basic weapon CRUD
2. Add validation for degree constraints
3. Integrate fn_weapon_bands_adjusted() and fn_expected_mul_quick() function calls
4. Create trigger for auto weapon row creation on weapon item insert

---

## Summary: Repository Count

**Total Repositories: 13**

1. ItemRepository
2. MaterialRepository
3. EquipmentRepository
4. ProfileRepository
5. LocationRepository
6. LoadoutRepository
7. CombatRepository
8. ImageCacheRepository
9. EnemyRepository
10. RarityRepository
11. AnalyticsRepository
12. PetRepository
13. WeaponRepository

---

## Global Implementation Challenges

### 1. Redis Integration for CombatRepository
Need Redis client setup alongside Supabase. Add redis package, create config/redis.ts with client initialization.

### 2. Type Safety with database.types.ts
Use database.types.ts as base, extend with repository-specific types in repository.types.ts.

### 3. Testing Strategy
Create mock repository factories in tests/helpers/mockRepositories.ts. Use dependency injection in services.

### 4. Query Performance Optimization
Start with working queries, optimize later. Add indexes based on slow query log analysis, use EXPLAIN ANALYZE.

### 5. Migration from Service Direct DB Access
Phased approach: Create repository → Add as service dependency → Replace direct queries → Remove supabase import → Test.

### 6. N+1 Query Prevention
Use Supabase nested select() for eager loading. See `agent-responses/agent_830867.md` for examples (100 items: 201 queries → 1 query).

### 7. Composite Primary Keys (MaterialStacks)
Override methods in MaterialStacksRepository for composite PK (user_id, material_id, style_id). See `agent-responses/agent_659351.md` for implementation.

---

## Recommended Implementation Order

### Phase 1: Core Data Access
1. **ProfileRepository** - Currency and user account (needed by all services)
2. **ItemRepository** - Items and item types (most complex, foundational)
3. **MaterialRepository** - Materials, stacks, instances (needed for crafting)

### Phase 2: Equipment & Combat 
4. **EquipmentRepository** - 8-slot equipment system
5. **LoadoutRepository** - Saved equipment configurations
6. **ImageCacheRepository** - Item image generation support

### Phase 3: Combat System 
7. **CombatRepository** - Redis + PostgreSQL combat sessions
8. **LocationRepository** - PostGIS spatial queries
9. **EnemyRepository** - Enemy types and pools

### Phase 4: Specialized Features 
10. **WeaponRepository** - Weapon timing mechanics
11. **PetRepository** - Pet personalities
12. **RarityRepository** - Rarity and tier lookups
13. **AnalyticsRepository** - Event tracking and chatter logs

---

## Service Refactoring Checklist

For each service refactor:

- [ ] Create repository class extending BaseRepository
- [ ] Implement repository methods needed by service
- [ ] Write repository unit tests (mock Supabase client)
- [ ] Add repository as service constructor dependency
- [ ] Replace service direct DB queries with repository calls
- [ ] Remove supabase import from service
- [ ] Update service tests to mock repository instead of Supabase
- [ ] Run integration tests
- [ ] Update service exports in src/services/index.ts
- [ ] Document breaking changes (if any)
