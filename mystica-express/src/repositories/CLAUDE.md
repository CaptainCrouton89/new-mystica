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

**Composite Keys:** MaterialStack uses (user_id, material_id, style_id). Use manual WHERE clauses—Supabase lacks multi-column PK.

**N+1 Prevention:** Nested Supabase selects. ItemRepository joins item→itemtypes→itemmaterials→materialinstances→materials in single query.

**RPC Transactions:** Atomic ops via `this.rpc()`. Examples: `process_item_upgrade`, `apply_material_to_item`, `remove_material_from_item`.

**Errors:** Use `src/utils/errors.ts` classes (NotFoundError, ValidationError, DatabaseError, BusinessLogicError, UnauthorizedError).

## Repositories

**Core:** ItemRepository, ItemTypeRepository, EquipmentRepository, MaterialRepository, WeaponRepository
**Combat:** CombatRepository (TTL sessions + event logging), EnemyRepository (normalized stats + polymorphic loot)
**World:** LocationRepository (PostGIS + pool filtering), LoadoutRepository, PetRepository
**Support:** StyleRepository (read-only singleton), RarityRepository, AnalyticsRepository, ImageCacheRepository
