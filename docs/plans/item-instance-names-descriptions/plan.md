# Implementation Plan – AI-Generated Item Instance Names & Descriptions

# Overview
overview:
  related_items:
    feature_specs: []
    user_stories: []
    user_flows: []
  related_docs: |
    - "docs/plans/item-instance-names-descriptions/investigation-synthesis.md"
    - "docs/investigations/item-repository-service-patterns.md"
    - "docs/investigations/frontend-item-display-patterns.md"
    - "docs/investigations/material-crafting-flow.md"
    - "docs/investigations/item-api-response-types.md"
    - "docs/api-contracts.yaml"
    - "scripts/generate-item-description.ts"

# Problem
problem: |
  **Current State:**
  All item instances use generic names from their ItemType (e.g., all swords are "Sword"). When players craft unique material combinations, the items still show generic names, missing an opportunity for personalization and immersion.

  **Impact:**
  - Reduced player attachment to crafted items
  - No visual distinction between different material combinations
  - Existing AI description generation script exists but isn't integrated into crafting flow
  - Frontend displays crude capitalization of snake_case (`iron_sword` → `Iron Sword`) instead of proper names

# Solution
solution: |
  Add `name` and `description` columns directly to the `Items` table to store AI-generated, instance-specific text. When materials are applied to an item (MaterialService.applyMaterial line 179), generate unique names and descriptions using OpenAI's generateObject API (same pattern as image generation). Update 4 backend service transformation points and 4 frontend display components to use instance fields with fallback to ItemType defaults. This provides immediate value for crafted items while maintaining backward compatibility for existing items.

# Current System
current_system:
  description: |
    **Database Layer:**
    - `Items` table references `item_type_id` for name/description
    - Repository methods use JOIN queries: `itemtypes(name, description, ...)`
    - No instance-level naming fields exist

    **Backend Service Layer:**
    - MaterialService.applyMaterial() at line 179 handles "first craft" logic
    - Image generation runs synchronously when `isFirstCraft = true`
    - 4 transformation points access name via `item.item_type?.name || 'Unknown'`:
      * InventoryService.ts:115
      * EquipmentService.ts:307
      * MaterialService.ts:502
      * ItemController.ts:64

    **AI Generation:**
    - Existing script at `scripts/generate-item-description.ts` uses OpenAI generateObject
    - Not integrated into backend services
    - Schema and prompts already defined

    **Frontend:**
    - PlayerItem model has `baseType: String` property
    - 4 display components use `item.baseType.capitalized`:
      * ItemRow.swift:74 (inventory lists)
      * ItemDetailModal.swift:126 (equipment details)
      * InventoryItemDetailModal.swift:47 (inventory details)
      * ItemSlotSelector.swift:91 (crafting interface)

# Changes Required
changes_required:
  - path: "mystica-express/supabase/migrations/202510241900_add_item_instance_names_descriptions.sql"
    changes: |
      - CREATE new timestamped migration file
      - ALTER TABLE Items ADD COLUMN name VARCHAR(100) (nullable for backward compat)
      - ALTER TABLE Items ADD COLUMN description TEXT (nullable)
      - Use IF NOT EXISTS pattern for idempotency
      - No indexes initially (can add later for search features)

  - path: "mystica-express/src/services/NameDescriptionService.ts"
    changes: |
      - CREATE new service following ImageGenerationService pattern
      - Port generateItemDescription() logic from scripts/generate-item-description.ts
      - Add method generateForItem(itemType, materials, styles): Promise<{name: string, description: string}>
      - Import OpenAI SDK and use generateObject with existing schema
      - Add retry logic (2 attempts) and error handling
      - Log generation failures for monitoring

  - path: "mystica-express/src/services/MaterialService.ts"
    changes: |
      - Import NameDescriptionService at top of file
      - At line 179 (in isFirstCraft block), add parallel name/description generation
      - Call nameDescriptionService.generateForItem() with item type and materials
      - Store results via ItemRepository.updateItemNameDescription()
      - Handle generation failures gracefully (NULL → fallback to item_type)
      - Run in parallel with image generation (both async)

  - path: "mystica-express/src/repositories/ItemRepository.ts"
    changes: |
      - Add name, description to all SELECT queries (existing JOIN patterns)
      - Create new method updateItemNameDescription(itemId, name, description)
      - Ensure findWithMaterials(), findWithItemType(), findAllWithDetails() return new fields
      - No change to insert logic initially (NULL by default)

  - path: "mystica-express/src/services/InventoryService.ts"
    changes: |
      - Update transformation at line 115
      - Change: base_type: itemWithDetails.item_type?.name || 'Unknown'
      - To: base_type: itemWithDetails.name || itemWithDetails.item_type?.name || 'Unknown'
      - Add description field to response transformation
      - description: itemWithDetails.description || itemWithDetails.item_type?.description

  - path: "mystica-express/src/services/EquipmentService.ts"
    changes: |
      - Update transformation at line 307
      - Change: base_type: item.item_type?.name || 'Unknown'
      - To: base_type: item.name || item.item_type?.name || 'Unknown'
      - Add description fallback logic

  - path: "mystica-express/src/services/MaterialService.ts"
    changes: |
      - Update transformation at line 502 (response formatting)
      - Change: base_type: updatedItem.item_type?.name || 'Unknown'
      - To: base_type: updatedItem.name || updatedItem.item_type?.name || 'Unknown'
      - Add description fallback logic

  - path: "mystica-express/src/controllers/ItemController.ts"
    changes: |
      - Update transformation at line 64 (upgrade endpoint)
      - Change: base_type: item.item_type?.name || 'Unknown'
      - To: base_type: item.name || item.item_type?.name || 'Unknown'
      - Add description fallback logic

  - path: "mystica-express/src/types/api.types.ts"
    changes: |
      - Update Item interface to include name?: string, description?: string
      - Update PlayerItem interface if exists
      - Ensure response types are consistent across services

  - path: "New-Mystica/New-Mystica/Models/Item.swift"
    changes: |
      - Add name: String property to PlayerItem struct
      - Add description: String? property (nullable)
      - Update CodingKeys enum to decode name/description from API
      - Remove or deprecate baseType property (replaced by name)
      - Add computed displayName for fallback if needed

  - path: "New-Mystica/New-Mystica/Views/Inventory/ItemRow.swift"
    changes: |
      - Update line 74: Replace item.baseType.capitalized with item.name
      - Add text truncation if name is very long
      - Ensure UI handles multi-line wrapping

  - path: "New-Mystica/New-Mystica/Views/Equipment/ItemDetailModal.swift"
    changes: |
      - Update line 126: Replace item.baseType.capitalized with item.name
      - Add description display if item.description is not nil
      - Test layout with long names/descriptions

  - path: "New-Mystica/New-Mystica/Views/Inventory/InventoryItemDetailModal.swift"
    changes: |
      - Update line 47: Replace item.baseType.capitalized with item.name
      - Add description display section
      - Ensure scrolling works for long descriptions

  - path: "New-Mystica/New-Mystica/Views/Crafting/ItemSlotSelector.swift"
    changes: |
      - Update line 91: Replace item.baseType.capitalized with item.name
      - Handle potential nil values during transition

# Task Breakdown
task_breakdown:
  - id: "T1"
    description: |
      **Database Schema Migration**
      Create and apply migration adding `name` and `description` columns to Items table. Use nullable columns for backward compatibility. Apply to remote Supabase and regenerate TypeScript types.
    agent: "junior-engineer"
    depends_on: []
    files:
      - "mystica-express/supabase/migrations/202510241900_add_item_instance_names_descriptions.sql"
    exit_criteria: |
      - Migration file created with timestamp pattern
      - Applied successfully to remote Supabase (no errors)
      - `pnpm supabase:types` regenerates types with name/description fields
      - Items table schema includes new nullable columns

  - id: "T2"
    description: |
      **Backend Type Definitions**
      Update TypeScript API types and repository types to include name and description fields. Ensure all interfaces are consistent across services and controllers.
    agent: "junior-engineer"
    depends_on: ["T1"]
    files:
      - "mystica-express/src/types/api.types.ts"
      - "mystica-express/src/types/repository.types.ts"
    exit_criteria: |
      - Item/PlayerItem interfaces include name?: string, description?: string
      - No TypeScript compilation errors
      - Types match database schema from T1

  - id: "T3"
    description: |
      **ItemRepository Updates**
      Update repository queries to SELECT name and description, add updateItemNameDescription() method following existing update patterns. Ensure all detail methods (findWithMaterials, findWithItemType, findAllWithDetails) return new fields.
    agent: "junior-engineer"
    depends_on: ["T1"]
    files:
      - "mystica-express/src/repositories/ItemRepository.ts"
    exit_criteria: |
      - All SELECT queries include name, description
      - New updateItemNameDescription(itemId, name, description) method exists
      - Method follows existing update patterns (uses supabase client)
      - Returns updated item with new fields

  - id: "T4"
    description: |
      **NameDescriptionService Creation**
      Port AI generation logic from scripts/generate-item-description.ts into new backend service. Follow ImageGenerationService pattern for consistency. Include retry logic, error handling, and logging.
    agent: "programmer"
    depends_on: ["T2"]
    files:
      - "mystica-express/src/services/NameDescriptionService.ts"
      - "scripts/generate-item-description.ts"
    exit_criteria: |
      - Service class created with generateForItem(itemType, materials, styles) method
      - Uses OpenAI SDK generateObject with existing schema
      - Includes retry logic (2 attempts) and comprehensive error handling
      - Returns {name: string, description: string} or throws with logged error
      - Unit tests pass (generation success, generation failure, retry logic)

  - id: "T5"
    description: |
      **MaterialService Integration**
      Integrate NameDescriptionService into MaterialService.applyMaterial() at line 179. Run generation in parallel with image generation when isFirstCraft=true. Store results via ItemRepository.
    agent: "programmer"
    depends_on: ["T3", "T4"]
    files:
      - "mystica-express/src/services/MaterialService.ts"
    exit_criteria: |
      - NameDescriptionService imported and instantiated
      - Generation called at line 179 in isFirstCraft block
      - Runs in parallel with image generation (Promise.all or separate awaits)
      - Results stored via ItemRepository.updateItemNameDescription()
      - Graceful handling of generation failures (NULL stored, logs error)
      - Integration test passes: craft item → name/description generated and stored

  - id: "T6"
    description: |
      **Backend API Transformation Updates (4 locations)**
      Update all service transformation points to use item instance name with fallback to item_type.name. Ensure consistent pattern across InventoryService, EquipmentService, MaterialService, ItemController.
    agent: "programmer"
    depends_on: ["T3"]
    files:
      - "mystica-express/src/services/InventoryService.ts"
      - "mystica-express/src/services/EquipmentService.ts"
      - "mystica-express/src/services/MaterialService.ts"
      - "mystica-express/src/controllers/ItemController.ts"
    exit_criteria: |
      - All 4 transformation points updated with fallback pattern: item.name || item.item_type?.name || 'Unknown'
      - Description fields added to responses with same fallback pattern
      - No breaking changes to API response structure
      - API endpoint tests pass for /inventory, /equipment, /items/:id, /items/:id/materials/apply

  - id: "T7"
    description: |
      **Backend Build Validation**
      Run full backend build and test suite to ensure no regressions. Fix any TypeScript errors or test failures from database/service changes.
    agent: "junior-engineer"
    depends_on: ["T5", "T6"]
    files:
      - "mystica-express/"
    exit_criteria: |
      - `pnpm build` completes without errors
      - `pnpm test` passes all existing tests
      - No TypeScript compilation errors
      - Backend server starts successfully with `pnpm dev`

  - id: "T8"
    description: |
      **Frontend PlayerItem Model Update**
      Update Swift PlayerItem model to include name and description properties. Update CodingKeys for API decoding. Add backward compatibility logic for transition period.
    agent: "junior-engineer"
    depends_on: ["T7"]
    files:
      - "New-Mystica/New-Mystica/Models/Item.swift"
    exit_criteria: |
      - PlayerItem struct includes name: String and description: String? properties
      - CodingKeys enum maps to backend snake_case fields
      - Decoding handles missing fields gracefully (fallback to baseType if needed)
      - EnhancedPlayerItem updated if applicable

  - id: "T9"
    description: |
      **Frontend UI Display Updates (4 components)**
      Update all SwiftUI components displaying item names to use item.name instead of item.baseType.capitalized. Add text truncation for long names. Add description display where appropriate.
    agent: "programmer"
    depends_on: ["T8"]
    files:
      - "New-Mystica/New-Mystica/Views/Inventory/ItemRow.swift"
      - "New-Mystica/New-Mystica/Views/Equipment/ItemDetailModal.swift"
      - "New-Mystica/New-Mystica/Views/Inventory/InventoryItemDetailModal.swift"
      - "New-Mystica/New-Mystica/Views/Crafting/ItemSlotSelector.swift"
    exit_criteria: |
      - All 4 components updated to display item.name
      - Text truncation added for very long names (lineLimit or truncationMode)
      - Description displayed in detail modals (ItemDetailModal, InventoryItemDetailModal)
      - UI handles nil/empty values gracefully
      - No layout breaking for long text

  - id: "T10"
    description: |
      **Frontend Build Validation**
      Build iOS app for simulator and run unit tests. Verify all views compile and display correctly with new model structure.
    agent: "junior-engineer"
    depends_on: ["T9"]
    files:
      - "New-Mystica/"
    exit_criteria: |
      - `./build.sh` completes without errors (iOS Simulator build)
      - Unit tests pass: `xcodebuild test -scheme New-Mystica -configuration Debug -destination "platform=iOS Simulator,name=iPhone 17 Pro"`
      - App launches in simulator without crashes
      - Item views display correctly (tested manually in simulator)

  - id: "T11"
    description: |
      **End-to-End Integration Testing**
      Test complete flow: craft item with materials → verify AI-generated name/description → verify display in all UI locations. Test fallback for old items without custom names.
    agent: "senior-engineer"
    depends_on: ["T10"]
    files:
      - "mystica-express/src/services/MaterialService.ts"
      - "New-Mystica/New-Mystica/Views/"
    exit_criteria: |
      - Craft new item via API → name and description generated and stored in database
      - New item displays custom name in all 4 frontend components
      - Old items (NULL name) display fallback ItemType name correctly
      - Generation failures don't block crafting (fallback to NULL/ItemType name)
      - No console errors or warnings in backend or frontend

# Parallel Execution Strategy
parallel_execution:
  batch_1:
    tasks: ["T1", "T2"]
    description: "Database schema and type definitions (independent, can run in parallel)"

  batch_2:
    tasks: ["T3", "T4"]
    description: "Repository updates and AI service creation (both depend on Batch 1)"

  batch_3:
    tasks: ["T5", "T6"]
    description: "Service integration and API transformations (depend on T3/T4)"

  batch_4:
    tasks: ["T7"]
    description: "Backend validation (depends on all backend tasks)"

  batch_5:
    tasks: ["T8", "T9"]
    description: "Frontend model and UI updates (can run in parallel, depend on T7)"

  batch_6:
    tasks: ["T10"]
    description: "Frontend validation (depends on all frontend tasks)"

  batch_7:
    tasks: ["T11"]
    description: "End-to-end integration testing (depends on everything)"

# Data/Schema Changes
data_schema_changes:
  migrations:
    - file: "mystica-express/supabase/migrations/202510241900_add_item_instance_names_descriptions.sql"
      summary: |
        ALTER TABLE Items ADD COLUMN name VARCHAR(100) (nullable)
        ALTER TABLE Items ADD COLUMN description TEXT (nullable)
        Uses IF NOT EXISTS for idempotency
        No backfill initially (NULL values fallback to item_type)

  api_changes:
    - endpoint: "GET /inventory"
      changes: "Returns name and description fields for each item (nullable, fallback to item_type)"
    - endpoint: "GET /equipment"
      changes: "Returns name and description for equipped items"
    - endpoint: "POST /items/{id}/materials/apply"
      changes: "Generates and returns name/description for newly crafted items"
    - endpoint: "GET /items/{id}"
      changes: "Returns name and description fields"
    - endpoint: "POST /items/{id}/upgrade"
      changes: "Returns name and description in upgrade response"

# Integration Points
integration_points:
  - location: "MaterialService.ts:179"
    description: "AI generation integration point (parallel with image generation)"
    pattern: |
      if (isFirstCraft) {
        const [imageUrl, nameDesc] = await Promise.all([
          imageGenerationService.generateComboImage(...),
          nameDescriptionService.generateForItem(itemType, materials, styles)
        ]);
        await itemRepository.updateItemNameDescription(itemId, nameDesc.name, nameDesc.description);
      }

  - location: "Service transformations"
    description: "Fallback pattern for API responses"
    pattern: |
      base_type: item.name || item.item_type?.name || 'Unknown'
      description: item.description || item.item_type?.description

# Risk Assessment
risks:
  high_priority:
    - risk: "AI generation failures block crafting"
      mitigation: "Graceful fallback to NULL (uses item_type name), comprehensive error logging, retry logic"

    - risk: "Multiple service transformations break during deployment"
      mitigation: "Comprehensive integration tests, staged rollout (backend first, test with old frontend)"

  medium_priority:
    - risk: "Long AI-generated names break UI layouts"
      mitigation: "Max length validation (100 chars), text truncation in SwiftUI views, test with edge cases"

    - risk: "Frontend backward compatibility issues"
      mitigation: "Nullable fields with fallback logic, deploy backend first and verify old frontend still works"

  low_priority:
    - risk: "Cost increase from AI calls"
      mitigation: "Monitor OpenAI usage, use gpt-4.1-mini (cheapest model), only generate on first craft"

# Expected Result
expected_result:
  outcome: |
    When a player crafts an item by applying materials, the item receives a unique AI-generated name and description that reflects the material combination. For example:
    - Crafting Sword + [iron, crystal, wood] produces "Crystaline Ironwood Blade"
    - All 4 frontend views (ItemRow, ItemDetailModal, InventoryItemDetailModal, ItemSlotSelector) display the custom name
    - Item detail modals show the 2-sentence visual description
    - Existing items without custom names gracefully fall back to their ItemType name
    - Generation failures don't block crafting (NULL stored, fallback displayed)

  example: |
    **Before:**
    - Player crafts Sword with iron + crystal + wood
    - Item shows: "Sword" (generic, from ItemType)
    - Description: "A basic sword" (generic)

    **After:**
    - Player crafts Sword with iron + crystal + wood
    - Item shows: "Crystaline Ironwood Blade" (AI-generated, unique)
    - Description: "A sleek sword with an iron core wrapped in crystalline segments, with a wooden hilt embedded with glowing crystal shards. The blade gleams with an ethereal light that pulses through the wood grain patterns."
    - If AI generation fails → falls back to "Sword" (no blocking)

# Notes
notes:
  - "Investigation synthesis: docs/plans/item-instance-names-descriptions/investigation-synthesis.md"
  - "AI script reference: scripts/generate-item-description.ts (existing OpenAI generateObject implementation)"
  - "Image generation pattern: mystica-express/src/services/ImageGenerationService.ts (follow this pattern)"
  - "Total estimated time: 10-16 hours (per investigation synthesis)"
  - "Cost per generation: ~$0.0001-0.0005 (gpt-4.1-mini)"
  - "Rollout strategy: Big Bang (deploy backend + frontend together, cleaner for pre-production)"

# Next
next: "/manage-project/implement/execute item-instance-names-descriptions"
