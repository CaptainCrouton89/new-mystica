# Plan: Enrich Combat Loot Rewards with Complete Item/Material Data

## Summary
**Goal:** Refactor loot reward enrichment to use repository pattern for all data fetching and return complete item/material data to victory screen without fallbacks.

**Executive Summary:** The CombatService.generateLootFallback() method currently uses mixed patterns—ItemTypeRepository for items (correct) but direct Supabase queries for materials. This plan extracts material fetching into MaterialRepository.findByIds() method following ItemTypeRepository pattern, eliminates direct DB queries from service layer, and ensures all enriched loot includes complete data fields (descriptions, stat modifiers, appearance data, base_stats). Error-first approach: throw if any required data is missing, no fallbacks or placeholders.

## Relevant Context
- `mystica-express/CLAUDE.md` - Repository pattern, error handling, module resolution patterns
- CombatService.generateLootFallback() implementation (lines 1495-1603)
- ItemTypeRepository.findByIds() pattern reference (lines 65-80)
- MaterialRepository current single-lookup capability (findMaterialById, lines 52-65)

## Investigation Artifacts
None required—code structure already clear from inspection.

## Current System Overview

**CombatService.generateLootFallback() (lines 1495-1603)**
- Receives: lootDrops from combat loot pool selection (with material_id and item_type_id)
- Current flow:
  1. Filter material_ids and item_type_ids from lootDrops
  2. Batch fetch materials via DIRECT Supabase query (lines 1507-1523) ⚠️
  3. Batch fetch ItemTypes via ItemTypeRepository.findByIds() ✅
  4. Build lookup maps for both
  5. Throw errors on missing data ✅
  6. Return enriched objects with item fields: name, category, rarity, description, base_stats, appearance_data (lines 1571-1582)
  7. Return enriched objects with material fields: name, description, stat_modifiers (lines 1533-1541)

**ItemTypeRepository Pattern (correct reference)**
- Method: findByIds(ids: string[]) → Promise<ItemTypeRow[]>
- Selects '*' (all fields)
- Throws mapSupabaseError on query failure
- Returns empty array if no IDs provided
- No partial results—only returns found items

**MaterialRepository Current State**
- Only has findMaterialById() for single lookup
- Uses same Supabase client and error handling pattern as ItemTypeRepository
- No batch method exists
- Uses Material type from api.types.ts (id, name, stat_modifiers, base_drop_weight, description)

**Database Schema (materials table)**
- Fields: id, name, description, stat_modifiers (JSONB with Stats shape), base_drop_weight
- All fields required for complete enrichment

## Implementation Plan

### Task 1: Add MaterialRepository.findByIds() Method
**What:** Create new batch fetch method for materials matching ItemTypeRepository.findByIds() pattern exactly.

**Files:**
- `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/repositories/MaterialRepository.ts`

**Specification:**
1. Add method after findMaterialById() (after line 65, before line 67)
2. Method signature:
   ```typescript
   async findByIds(ids: string[]): Promise<Material[]>
   ```
3. Implementation details:
   - Check if ids.length === 0, return empty array (no query)
   - Query: `.from('materials').select('*').in('id', ids)`
   - Error handling: throw mapSupabaseError(error) on failure
   - Return (data || []) as Material[]
4. Add JSDoc comment matching ItemTypeRepository pattern:
   ```typescript
   /**
    * Find multiple materials by IDs
    * Used for batch fetching during loot generation
    *
    * @param ids - Array of material IDs to find
    * @returns Array of materials found (may be fewer than requested if some IDs don't exist)
    * @throws DatabaseError on query failure
    */
   ```
5. Consistency: Use exact same pattern as ItemTypeRepository.findByIds() (lines 65-80)

**Risks/Gotchas:**
- Must return partial results silently (only found materials), NOT throw on missing IDs—service layer will validate
- No breaking change to existing code (new method only)

**Agent:** junior-engineer

---

### Task 2: Refactor CombatService.generateLootFallback() Material Enrichment
**What:** Replace direct Supabase queries for materials (lines 1507-1523) with MaterialRepository.findByIds() call, matching ItemType enrichment pattern.

**Files:**
- `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/services/CombatService.ts`

**Specification:**
1. Remove direct Supabase queries (lines 1507-1523):
   ```typescript
   // DELETE THIS BLOCK
   let materialMap = new Map();
   if (materialIds.length > 0) {
     const { data: materials_data, error } = await supabase
       .from('materials')
       .select('id, name, description, stat_modifiers')
       .in('id', materialIds);

     if (error) {
       throw new Error(`Failed to fetch materials: ${error.message}`);
     }

     materialMap = new Map((materials_data || []).map((m: any) => [m.id, m]));
     logger.debug(...);
   }
   ```

2. Replace with repository pattern (parallel with ItemType fetch):
   ```typescript
   // Batch fetch Material details
   const materials = materialIds.length > 0 ? await this.materialRepository.findByIds(materialIds) : [];
   const materialMap = new Map(materials.map(m => [m.id, m]));

   logger.debug('🧱 Materials batch fetched', {
     requestedCount: materialIds.length,
     foundCount: materials.length,
     materials: materials.map(m => ({ id: m.id, name: m.name }))
   });
   ```

3. Ensure materialRepository instance exists in CombatService constructor
   - Check if `this.materialRepository` is initialized
   - If not, add: `private materialRepository: MaterialRepository;` to constructor params and initialization
   - Constructor line: find where `this.itemTypeRepository = itemTypeRepository;` is set and add parallel line

4. Material enrichment object (lines 1526-1541) already correct—keep as-is:
   - Returns: material_id, name, description, stat_modifiers, style_id, style_name
   - Error throws on missing material from map: ✅ existing code at line 1530-1532

5. ItemType enrichment (lines 1562-1582) already correct—keep as-is:
   - Returns: item_type_id, name, category, rarity, description, base_stats, appearance_data, style_id, style_name
   - Error throws on missing itemType: ✅ existing code at line 1567-1570

**Risks/Gotchas:**
- Must NOT change return object structure for materials or items—frontend expects exact fields
- Error handling already correct (throw if data missing)—don't change
- Constructor injection pattern: check how itemTypeRepository is injected
- Keep all logging statements intact

**Agent:** junior-engineer

---

### Task 3: Verify Error Handling and Type Safety
**What:** Ensure no undefined fields in return objects, error messages are clear, and type definitions match.

**Files:**
- `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/services/CombatService.ts` (return objects at lines 1533-1541, 1571-1582)
- Type definitions: api.types.ts Material interface (lines 95-103), ItemType usage in service

**Specification:**
1. Review return objects:
   - Material return (lines 1533-1541):
     - material_id: ✅ from drop
     - name: ✅ from Material
     - description: ✅ from Material (line 1536 uses `|| undefined` - OK, optional)
     - stat_modifiers: ✅ from Material (line 1537 uses `|| undefined` - OK, optional)
     - style_id: ✅ from drop
     - style_name: ✅ hardcoded earlier
   - Item return (lines 1571-1582):
     - item_type_id: ✅ from drop
     - name: ✅ from ItemType
     - category: ✅ from ItemType
     - rarity: ✅ from ItemType
     - description: ✅ from ItemType (line 1576 uses `|| undefined` - OK, optional)
     - base_stats: ✅ from ItemType.base_stats_normalized (line 1577 uses `|| undefined` - OK, optional)
     - appearance_data: ✅ from ItemType (line 1578 uses `|| undefined` - OK, optional)
     - style_id: ✅ from drop
     - style_name: ✅ hardcoded earlier

2. Verify error messages are descriptive (lines 1530-1532, 1567-1570):
   - Material: "Material ${drop.material_id} not found in database for loot drop" ✅
   - Item: "ItemType ${drop.item_type_id} not found in database for loot drop" ✅

3. Check Material type import:
   - Verify `Material` type is imported from api.types.ts at top of CombatService.ts
   - If not, add to imports

4. No action needed if already correct—just validate

**Risks/Gotchas:**
- Optional fields (description, stat_modifiers, base_stats, appearance_data) use `|| undefined` pattern—this is intentional to avoid null values in JSON
- Don't change field presence logic—optional is correct

**Agent:** senior-engineer (review only, no code changes unless type imports missing)

---

### Task 4: Update CombatService Constructor for MaterialRepository Injection
**What:** Ensure MaterialRepository is injected and available in CombatService.

**Files:**
- `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/services/CombatService.ts`

**Specification:**
1. Find CombatService constructor (likely early in file, before generateLootFallback)
2. Check if `materialRepository` parameter exists and is stored as instance property
3. If missing:
   - Add parameter: `materialRepository: MaterialRepository,`
   - Add property assignment: `this.materialRepository = materialRepository;`
   - Import MaterialRepository at top: `import { MaterialRepository } from '../repositories/MaterialRepository.js';`
4. If exists, confirm it's properly typed and initialized ✅
5. No changes if already present

**Risks/Gotchas:**
- Check constructor signature carefully—multiple params, order matters
- Dependency injection pattern used throughout codebase—follow existing style
- Import path must use `.js` extension per project standards

**Agent:** junior-engineer

---

### Data/Schema Impacts
**None.** This refactoring:
- Uses existing database schema (no migrations needed)
- Adds repository method only (no API contract changes)
- Changes internal service implementation (no external behavior changes)
- Return objects maintain same structure as current implementation

**Testing Considerations:**
- CombatService tests in `tests/integration/` will need MaterialRepository mock
- Ensure generateLootFallback() still throws errors on missing material/item data
- Verify material/item lookup maps are built correctly
- Confirm error messages match assertions in tests

## Execution Order

1. **Task 1 first** (MaterialRepository.findByIds) — independent, creates the new method
2. **Task 4 second** (Constructor injection) — ensures CombatService can use new repository
3. **Task 2 third** (Refactor generateLootFallback) — uses repository method from Task 1
4. **Task 3 last** (Type safety verification) — validates final implementation

**Dependencies:**
- Task 2 depends on: Task 1 (repository method must exist), Task 4 (injection must work)
- Task 3 is review-only, no blocking dependency
- All code changes complete before testing

## Code Style Notes

Follow existing patterns:
- Error handling: Use mapSupabaseError() from utils/errors.js
- Logging: Use logger.debug() and logger.info() (already in service)
- Type imports: Include .js extensions per tsconfig + Jest moduleNameMapper setup
- Null handling: Optional fields use `|| undefined` to avoid null values in JSON responses
- Method documentation: JSDoc comments matching repository pattern

## Validation Checklist

- [ ] MaterialRepository.findByIds() follows ItemTypeRepository.findByIds() pattern exactly
- [ ] CombatService constructor injects materialRepository correctly
- [ ] generateLootFallback() removes all direct Supabase queries for materials
- [ ] Error messages on missing data are clear and match existing pattern
- [ ] Return objects include all enriched fields (no undefined properties)
- [ ] Type imports include .js extensions
- [ ] Existing tests still pass (no breaking changes to public methods)
- [ ] Logger calls preserved
- [ ] No code duplication between item and material enrichment patterns
