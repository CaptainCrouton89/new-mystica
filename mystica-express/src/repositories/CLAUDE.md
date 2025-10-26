# repositories/ - CLAUDE.md

Data access layer. All repositories extend `BaseRepository<T>` with constructor pattern:

```typescript
export class ItemRepository extends BaseRepository<ItemRow> {
  constructor(client?: SupabaseClient) {
    super('tableName', client);
  }
}
```

## Key Patterns

**Type Safety:** Use `Database` types from `src/types/database.types.ts`. Define `Row`/`Insert` aliases. Never use `any`.

**BaseRepository Methods:** `findById()`, `findMany(filters, options)`, `create()`, `update()`, `delete()`, `rpc(functionName, params)`

**Strict Validation:** Use `validateField<T>()` helpers to enforce non-null values. Throw `DatabaseError` for missing/invalid data—no fallbacks to defaults.

**Composite Keys:** MaterialStack uses (user_id, material_id, style_id). Use manual WHERE clauses—Supabase lacks multi-column PK.

**N+1 Prevention:** Nested Supabase selects via specialized query methods: `findWithMaterials()` (full join), `findWithItemType()` (lightweight), `findManyWithDetails()` (batch).

**RPC Transactions:** Atomic ops via `this.rpc()`. Examples: `process_item_upgrade`, `apply_material_to_item`, `remove_material_from_item`, `equip_item`, `unequip_item`.

**Errors:** Use `src/utils/errors.ts` classes (NotFoundError, ValidationError, DatabaseError, BusinessLogicError, UnauthorizedError).

## ItemRepository API

**CRUD:** `findById(itemId, userId?)`, `findByUser(userId)`, `create(itemData)`, `updateItem(itemId, userId, data)`, `deleteItem(itemId, userId)`

**Complex Queries:** `findWithMaterials(itemId, userId?)`, `findWithItemType(itemId, userId?)`, `findEquippedByUser(userId)`, `findByType(userId, itemTypeId)`, `findManyWithDetails(itemIds, userId?)`, `findByUserWithPagination(userId, limit, offset)`

**Level & Stats:** `updateLevel(itemId, userId, newLevel)`, `updateImageData(itemId, userId, comboHash, imageUrl, status)`, `updateItemNameDescription(itemId, userId, name, description)`

**History Tracking:** `addHistoryEvent(itemId, userId, eventType, eventData?)` — audit trail with auto-serialized JSON event_data

**Item Types:** `findItemTypeById(itemTypeId)`, `findItemTypesByRarity(rarity)`

**Transactions:** `processUpgrade(userId, itemId, goldCost, newLevel)` via RPC

## Repositories

**Core:** ItemRepository, ItemTypeRepository, MaterialRepository, WeaponRepository

- **EquipmentRepository:** 8 slots (weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet). Slot-category compatibility validation. Stats aggregation via StatsService (quadratic formula: `base * rarity_mult * (1 + 0.05 * (level - 1)²)`). Bulk equip/unequip for loadouts. Methods: `findEquippedByUser()`, `equipItem()`, `unequipSlot()`, `equipMultiple()`, `getPlayerEquippedStats()`, `validateSlotCompatibility()`.

**Combat:** CombatRepository (TTL sessions + event logging), EnemyRepository (normalized stats + polymorphic loot)

**World:** LocationRepository (PostGIS + pool filtering), LoadoutRepository, PetRepository

**Support:** StyleRepository (read-only singleton), RarityRepository, ImageCacheRepository

**AnalyticsRepository:**
- **General Events:** `logEvent()`, `getEventsByUser()`, `getEventsByTimeRange()`, `getEventCounts()` (time-series via RPC with DATE_TRUNC)
- **Pet Chatter (F-11):** `logPetChatter()`, `getPetChatterBySession()`, `getPetChatterByPersonality()`, `getAvgGenerationTime()`
- **Enemy Chatter (F-12):** `logEnemyChatter()`, `getEnemyChatterBySession()`, `getEnemyChatterByType()`, `getAvgEnemyChatterGenerationTime()`
- **JSONB Queries:** `getEventsByProperty()`, `getUniquePropertyValues()` for flexible event property filtering
- **Bulk:** `logEventsBatch()`, `cleanupOldEvents()` for retention management
- **Note:** Nullable user_id for system-level events; large table growth requires partitioning strategy
