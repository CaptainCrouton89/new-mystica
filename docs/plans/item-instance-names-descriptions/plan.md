# Implementation Plan: AI-Generated Item Instance Names & Descriptions

**Status:** Investigation Phase
**Created:** 2025-10-24
**Agents Investigating:** 6 context-engineer agents

---

## Overview

Enable every item instance to have a unique, AI-generated name and description that reflects its crafted materials and style, instead of using the generic item type name.

---

## Problem Statement

### Current State
- Item instances reference `item_type_id` for name/description
- All instances of "Sword" are named "Sword" (generic)
- Crafted items with unique material combinations share the same generic name
- AI generation exists in `scripts/generate-item-description.ts` but isn't integrated into the crafting flow

### Desired State
- Each item instance has unique name and description columns
- When materials are applied, AI generates creative names like "Crystaline Ironwood Blade"
- AI generates 2-sentence visual descriptions reflecting material fusion
- Names and descriptions are stored per-instance and displayed throughout the app
- Fallback to item type name/description if generation fails

---

## User Experience

### Before
```
Player crafts: Sword + [iron, crystal, wood]
Result:
  Name: "Sword"
  Description: "A basic sword"
```

### After
```
Player crafts: Sword + [iron, crystal, wood]
Result:
  Name: "Crystaline Ironwood Blade"
  Description: "A sleek sword with an iron core wrapped in crystalline segments,
                with a wooden hilt embedded with glowing crystal shards. The blade
                gleams with an ethereal light that pulses through the wood grain patterns."
```

---

## Technical Requirements

### Functional Requirements
1. **Name Generation:** Use OpenAI `generateObject` to create unique item names
2. **Description Generation:** Generate 2-sentence visual descriptions reflecting material fusion
3. **Timing:** Generate name + description when materials are applied (same time as image generation)
4. **Storage:** Persist name and description on item instance in PostgreSQL
5. **Display:** Show generated names everywhere items appear (inventory, equipment, combat, etc.)
6. **Fallback:** If generation fails, use item type name/description as fallback
7. **Backward Compatibility:** Existing items without names should fallback to item type

### Non-Functional Requirements
- Generation time: <3 seconds (same as image generation, can run in parallel)
- Cost: ~$0.0001-0.0005 per name/description (OpenAI gpt-4.1-mini)
- No breaking changes to existing API contracts during transition
- Frontend gracefully handles missing name/description fields

---

## Investigation Agents (In Progress)

| Agent ID | Focus Area | Status |
|----------|-----------|--------|
| agent_179969 | Database schema migration patterns | Running |
| agent_651426 | Item repository and service patterns | Running |
| agent_292836 | Material application and crafting flow | Running |
| agent_577724 | API response types and schemas | Running |
| agent_541761 | Frontend item display patterns (SwiftUI) | Running |
| agent_593245 | Frontend API service layer patterns | Running |

---

## High-Level Implementation Phases

### Phase 1: Database & Backend Foundation
**Goal:** Add storage for names/descriptions and update data layer

#### Tasks:
1. **Database Migration**
   - Create migration file: `0XX_add_item_instance_names_descriptions.sql`
   - Add columns to `Items` table:
     ```sql
     ALTER TABLE Items
       ADD COLUMN name VARCHAR(100),
       ADD COLUMN description TEXT;
     ```
   - Backfill existing items: copy from `ItemTypes.name` and `ItemTypes.description`
   - Apply to remote Supabase

2. **Type Regeneration**
   - Run `pnpm supabase:types` to regenerate database types
   - Verify `Items` Row/Insert/Update types include new columns

3. **Repository Layer**
   - Update `ItemRepository.ts`:
     - SELECT queries include name, description
     - Add `updateItemNameDescription(itemId, name, description)` method
     - Ensure all item queries return new fields
   - Handle NULL → fallback to `item_type.name` in queries

4. **Service Layer - Core Updates**
   - Update `ItemService.ts`:
     - Item creation sets name/description from item_type (default)
     - All response methods return name/description
     - Add fallback logic for NULL columns

**Deliverables:**
- Migration file applied to remote DB
- Updated ItemRepository with new methods
- ItemService returns name/description in all responses

**Risks:**
- Breaking existing API clients if not backward compatible
- Performance impact of additional columns in queries

---

### Phase 2: AI Integration
**Goal:** Integrate OpenAI name/description generation into crafting flow

#### Tasks:
1. **Port Script Logic to Service**
   - Create `ImageGenerationService.generateItemNameAndDescription()` method
   - Import OpenAI SDK and `generateObject`
   - Use existing prompt/schema from `scripts/generate-item-description.ts`
   - Return `{ name: string, description: string }`

2. **Integrate into Crafting Flow**
   - Update `MaterialService.applyMaterialsToItem()`:
     - Call `generateItemNameAndDescription()` alongside image generation
     - Pass item type and material names to AI
     - Store generated name + description on item via ItemRepository
   - Run AI generation in parallel with image generation (both async)
   - Handle generation failures gracefully (fallback to item type)

3. **Error Handling**
   - Add retry logic (2 attempts)
   - Log generation failures
   - On failure: set name/description to NULL (will fallback to item type)

4. **Testing**
   - Unit tests for name/description generation
   - Integration tests for crafting flow
   - Verify fallback behavior

**Deliverables:**
- `ImageGenerationService.generateItemNameAndDescription()` method
- MaterialService integration complete
- Error handling and fallback logic tested

**Risks:**
- AI generation adds latency (~1-3s)
- OpenAI API failures could block crafting
- Cost increase for crafting operations

---

### Phase 3: Backend API Layer
**Goal:** Update API types and responses to expose names/descriptions

#### Tasks:
1. **API Type Definitions**
   - Update `mystica-express/src/types/api.types.ts`:
     - Add `name: string` to `Item` interface
     - Add `description: string` to `Item` interface
     - Remove reliance on `item.item_type.name` in response builders

2. **Repository Types**
   - Update `mystica-express/src/types/repository.types.ts`:
     - Add fields to `ItemWithDetails` type
     - Add fields to `CreateItemData` type

3. **Zod Schemas**
   - Update `mystica-express/src/types/schemas.ts` if needed
   - Validate new fields in request/response schemas

4. **Controller Updates**
   - Update `ItemController.ts`:
     - Return `name` and `description` from item instance (not item_type)
     - Update all response transformations
   - Check other controllers returning items:
     - InventoryController
     - EquipmentController
     - CombatController (rewards)

5. **API Testing**
   - Test all endpoints returning items
   - Verify name/description in responses
   - Test fallback behavior for old items

**Deliverables:**
- Updated API types
- All controllers return name/description
- API tests pass

**Risks:**
- Breaking changes to API contracts
- Frontend compatibility during rollout

---

### Phase 4: Frontend Data Layer (Swift)
**Goal:** Update Swift models to decode and store instance names/descriptions

#### Tasks:
1. **Update Item Model**
   - Update `New-Mystica/New-Mystica/Models/Item.swift`:
     - Add `name: String` property
     - Add `description: String?` property
     - Update `CodingKeys` enum to decode from API
     - Remove computed properties that reference `itemType.name`
   - Handle backward compatibility for items without name/description

2. **Update API Services**
   - Find all API service files that decode items
   - Update response models to expect name/description
   - Add fallback logic during transition period

3. **Data Flow Testing**
   - Verify API → Model decoding works
   - Test with and without name/description present
   - Verify fallback to itemType fields

**Deliverables:**
- Updated Swift Item model
- API services decode new fields
- Backward compatibility handled

**Risks:**
- Breaking changes to existing local data
- SwiftData model changes may require migration

---

### Phase 5: Frontend UI Layer (SwiftUI)
**Goal:** Display AI-generated names throughout the app

#### Tasks:
1. **Identify Display Locations**
   - Inventory lists/grids
   - Item detail modals
   - Equipment screens
   - Crafting result screens
   - Combat reward screens
   - Any other item cards/lists

2. **Update Views**
   - Replace `item.itemType.name` → `item.name`
   - Replace `item.itemType.description` → `item.description`
   - Ensure fallback logic if fields are nil

3. **UI Testing**
   - Test all screens with new names
   - Verify fallback for old items
   - Check text truncation/wrapping for long names
   - Verify descriptions render properly

**Deliverables:**
- All views display item.name
- UI handles long names gracefully
- Descriptions display properly

**Risks:**
- Long AI-generated names may break layouts
- Need to handle text overflow/truncation

---

## Dependencies

### External Services
- **OpenAI API** (gpt-4.1-mini) - Already in use
- **Supabase** - Already in use

### Existing Code
- `scripts/generate-item-description.ts` - Schema and prompt already exist
- `ImageGenerationService` - Pattern for AI integration
- `MaterialService.applyMaterialsToItem()` - Hook point for generation

### Environment Variables
- `OPENAI_API_KEY` - Already configured

---

## Rollout Strategy

### Option A: Big Bang (Recommended)
1. Deploy backend with migration and AI generation
2. Backfill existing items with type names
3. Deploy frontend with new models
4. All new crafted items get AI names immediately

**Pros:**
- Clean, one-time change
- No complex compatibility logic

**Cons:**
- Requires coordinated backend + frontend deploy

### Option B: Gradual Rollout
1. Deploy backend with columns but no AI generation (NULL allowed)
2. Deploy frontend with fallback logic
3. Enable AI generation for new items only
4. Backfill existing items later

**Pros:**
- Lower risk, can test incrementally

**Cons:**
- More complex fallback logic
- Longer transition period

**Recommendation:** Option A - cleaner and faster for pre-production

---

## Testing Strategy

### Backend Tests
- [ ] Unit test: `generateItemNameAndDescription()` with various inputs
- [ ] Unit test: Fallback logic when AI generation fails
- [ ] Integration test: Crafting flow with name/description generation
- [ ] Integration test: ItemRepository returns name/description
- [ ] Integration test: All API endpoints return new fields

### Frontend Tests
- [ ] Unit test: Item model decoding with/without name/description
- [ ] UI test: All item display views show correct names
- [ ] UI test: Long names are truncated properly
- [ ] UI test: Fallback to itemType.name works

---

## Success Metrics

### Functional Metrics
- [ ] 100% of newly crafted items have AI-generated names
- [ ] 100% of item display locations show instance names (not type names)
- [ ] AI generation success rate >95%
- [ ] Fallback logic works for failed generations

### Performance Metrics
- [ ] Name/description generation <3 seconds
- [ ] No increase in crafting endpoint latency (parallel generation)
- [ ] Database queries not significantly slower

### Cost Metrics
- [ ] OpenAI cost per craft: <$0.001
- [ ] Total monthly cost increase acceptable

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| AI generation failures block crafting | High | Fallback to item type name, retry logic |
| Long names break UI layouts | Medium | Text truncation, max length validation |
| Database migration causes downtime | Medium | Use non-blocking ALTER TABLE, backfill separately |
| Frontend backward compatibility issues | Medium | Deploy backend first, test thoroughly |
| Cost increase from AI calls | Low | Monitor costs, use gpt-4.1-mini (cheap model) |

---

## Open Questions (To Be Resolved After Investigation)

### Database Layer
- [ ] What is the exact migration file naming pattern?
- [ ] How are migrations applied to remote Supabase?
- [ ] Are there any constraints on the Items table that would block adding columns?
- [ ] Should we add indexes on name column for future search features?

### Backend Layer
- [ ] Where exactly does MaterialService call ImageGenerationService?
- [ ] Can name/description generation run in parallel with image generation?
- [ ] What is the exact response format from ItemRepository?
- [ ] Are there other services that create items (not just MaterialService)?

### Frontend Layer
- [ ] What is the exact structure of the Swift Item model?
- [ ] How many views display item names?
- [ ] Is there a global item display component or are they all custom?
- [ ] How is SwiftData handling model changes?

---

## Next Steps

1. **Wait for investigation agents to complete** (6 agents running)
2. **Synthesize investigation findings** into detailed implementation tasks
3. **Create detailed sub-plans** for each phase
4. **Get approval** on approach and rollout strategy
5. **Begin Phase 1** implementation

---

## Investigation Agent Details

### agent_179969: Database Schema Migration Patterns
**Investigating:**
- Migration file naming conventions
- ALTER TABLE patterns in existing migrations
- Migration application process (local vs remote)
- Type regeneration workflow

### agent_651426: Item Repository and Service Patterns
**Investigating:**
- ItemRepository query patterns
- How item_type data is joined/nested
- ItemService transformation patterns
- Where item.item_type.name is currently used

### agent_292836: Material Application and Crafting Flow
**Investigating:**
- Complete crafting flow from material application to DB update
- Where ImageGenerationService is called
- MaterialService update patterns
- Integration points for AI generation

### agent_577724: API Response Types and Schemas
**Investigating:**
- Current Item type definition in api.types.ts
- Zod schema validation patterns
- Controller response formats
- Repository type definitions

### agent_541761: Frontend Item Display Patterns (SwiftUI)
**Investigating:**
- All SwiftUI views displaying item names
- Current Item model structure
- Where item.itemType.name is accessed
- UI components that need updates

### agent_593245: Frontend API Service Layer Patterns
**Investigating:**
- API service architecture
- Item decoding patterns (Codable)
- All endpoints returning item data
- Data flow: API → Model → View

---

## Appendix: Code References

### Existing AI Generation
- `scripts/generate-item-description.ts` - OpenAI generateObject implementation
- System prompt and schema already defined
- Output format: `{ name: string, description: string }`

### Key Integration Points
- `MaterialService.applyMaterialsToItem()` - Hook for AI generation
- `ImageGenerationService` - Pattern for async AI calls
- `ItemRepository` - Data persistence layer

### Frontend Display Locations (To Be Confirmed)
- Inventory views
- Equipment views
- Item detail modals
- Crafting result screens
- Combat reward screens
