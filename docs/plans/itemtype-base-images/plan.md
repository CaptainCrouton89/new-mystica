# Plan: ItemTypes Base Image URL Migration

## Summary
**Goal:** Migrate ItemTypes table to use base_image_url field and ensure all Items get created with valid image URLs instead of null.

**Executive Summary:** Replace the unused appearance_data JSON field with a simple base_image_url TEXT field on ItemTypes. Batch-generate base images for all 26 ItemTypes using the existing image generation pipeline. Update ItemRepository.create() to copy base_image_url to Items.generated_image_url on creation. Enhance material removal flow to reset to base images instead of null.

## Relevant Context
- Investigation artifacts: `agent-responses/agent_630035.md`, `agent-responses/agent_395424.md`, `agent-responses/agent_848427.md`, `agent-responses/agent_538976.md`
- Backend documentation: `docs/ai-docs/backend.md`
- AI pipeline documentation: `docs/ai-docs/ai-pipeline.md`

## Investigation Artifacts
- `agent-responses/agent_630035.md` – ItemTypes seed data structure: 26 items across 7 categories, appearance_data unused
- `agent-responses/agent_395424.md` – Image generation pipeline: batch commands, R2 path normalization, upload verification
- `agent-responses/agent_848427.md` – Material removal flow: existing removeMaterial method sets URLs to null, needs base image reset
- `agent-responses/agent_538976.md` – Migration patterns: numbered convention (011_ next), psql remote application, ALTER TABLE examples

## Current System Overview

**ItemTypes Table** (`mystica-express/migrations/001_initial_schema.sql:41-53`):
- 26 ItemTypes in `docs/seed-data-items.json` (weapons, armor, accessories, pets)
- `appearance_data JSON` field exists but completely unused
- No image URL storage currently

**Items Creation** (`mystica-express/src/repositories/ItemRepository.ts:96-108`):
- Always sets `generated_image_url: null` on creation
- Combat rewards end up with no images

**Material Removal** (`mystica-express/src/services/ItemService.ts:887-899`):
- `removeMaterial()` sets `imageUrl = null` when no materials remain
- No fallback to base images

**Image Generation Pipeline** (`scripts/generate-raw-image.ts`):
- Batch generation command: `pnpm generate-raw-image --batch items --upload --remove-background`
- R2 path normalization: "Magic Wand" → `magic_wand.png`
- Upload to: `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items/{snake_case_name}.png`

## Implementation Plan

### Tasks

- **Task 1**: Execute SQL to add base_image_url field to ItemTypes
  - Files: Direct SQL execution via sql tool
  - Depends on: none
  - Risks/Gotchas: Remote-only database, backup appearance_data before removal
  - Agent: junior-engineer

- **Task 2**: Generate base images for all 26 ItemTypes
  - Files: `scripts/generate-raw-image.ts` (execution), R2 bucket updates
  - Depends on: none (can run in parallel)
  - Risks/Gotchas: Cost (~$0.05-0.26 total), 26 image generation calls, verify uploads
  - Agent: junior-engineer

- **Task 3**: Execute SQL to populate base_image_url with generated URLs
  - Files: Direct SQL execution via sql tool
  - Depends on: Task 1, Task 2
  - Risks/Gotchas: URL pattern matching, snake_case normalization consistency
  - Agent: junior-engineer

- **Task 4**: Update ItemRepository.create() to copy base_image_url to generated_image_url
  - Files: `mystica-express/src/repositories/ItemRepository.ts`
  - Depends on: Task 3 (schema changes applied)
  - Risks/Gotchas: Join with ItemTypes, handle null base_image_url gracefully
  - Agent: junior-engineer

- **Task 5**: Update ItemService.removeMaterial() to reset to base image
  - Files: `mystica-express/src/services/ItemService.ts`
  - Depends on: Task 4
  - Risks/Gotchas: Fetch ItemType.base_image_url when materialIds.length === 0
  - Agent: junior-engineer

- **Task 6**: Run build validation and test combat rewards
  - Files: Test combat flow, verify item creation URLs
  - Depends on: Task 5
  - Risks/Gotchas: Integration test required, check generated_image_url not null
  - Agent: junior-engineer

### Data/Schema Impacts

**SQL Execution**: Direct execution via sql tool
- Add `base_image_url TEXT NOT NULL` column to ItemTypes
- Remove unused `appearance_data JSON` column (cleanup)
- Populate base_image_url with R2 URLs using snake_case name normalization
- Update all 26 ItemTypes with format: `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items/{snake_case_name}.png`

**API Contracts**: No API endpoint changes required - internal field migration only

**Breaking Changes**: None - appearance_data was unused, adding base_image_url is additive