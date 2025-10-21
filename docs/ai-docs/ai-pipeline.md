# AI Image Generation Pipeline Reference

## Critical Rules

- **BLOCKING generation:** MVP0/1 uses 20s SYNC generation (data-plan.yaml:9), async with crafting times in later MVPs
- **R2 dependency chain:** generate-image.ts checks R2 first, generates missing materials/items in parallel via generateRawImage, uploads before final composite
- **Material limits:** 1-3 materials required (hard limit per F-04 spec), combo_hash includes style_ids for cache lookup
- **Style system:** `is_styled=true` if ANY material has `style_id != 'normal'` (F-04 spec:98)
- **Global image cache:** ItemImageCache table tracks `craft_count` across all users, reuses combo images
- **Reference image set:** generate-raw-image.ts uses 10 hardcoded R2 URLs (lines 42-51) for style consistency
- **Deterministic keys:** r2-service.ts normalizes names to snake_case: `name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')`
- **Directory structure:** `items/{name}.png`, `materials/{name}.png`, `monsters/{name}.png`, optional `/no-background` subdirs
- **Provider models:** `gemini` = google/nano-banana, `seedream-4` = bytedance/seedream-4
- **Seed data sources:** docs/seed-data-{items,materials,monsters,equipment-slots}.json

## Generation Flow (scripts/)

1. **generate-item-description.ts** - GPT-4.1-mini creates name + 2-sentence description, enforces fusion (cactus blender = cactus-shaped body, NOT cacti inside)
2. **generate-image.ts** - Full pipeline:
   - Checks R2 for item + material images via r2-service
   - Generates missing assets in parallel via generateRawImage
   - Uploads to R2 (`items/`, `materials/` directories)
   - Uses R2 URLs as reference images for Replicate
   - Generates final composite with prompt + references
3. **generate-raw-image.ts** - Standalone asset generation with AI descriptions, uses 10-reference hardcoded set, outputs to output/raw/{items,materials}/
4. **r2-service.ts** - AWS S3 SDK wrapper, throws on missing credentials/assets, normalizes names to snake_case

## Material Application Flow (from F-04 spec + system-design.yaml:98-99)

1. Check MaterialStacks for (user_id, material_id, style_id) availability
2. Decrement stack quantity (throw if insufficient)
3. Create MaterialInstance from stack material
4. Insert into ItemMaterials with slot_index (0-2), validate UNIQUE constraints
5. Compute combo_hash = deterministic hash(item_type_id + sorted material_ids + style_ids)
6. Check ItemImageCache for existing combo
7. If cache miss: **SYNC generation** (20s blocking), upload to R2, insert cache row with craft_count=1
8. If cache hit: increment craft_count
9. Set item.is_styled=true if ANY material.style_id != 'normal'
10. Return image URL from cache

## Cloudflare R2 Integration

**Bucket:** `mystica-assets` (public access at `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/`)

**Wrangler CLI (authenticated, no env vars needed):**
```bash
wrangler r2 object list mystica-assets
wrangler r2 object put mystica-assets/items/magic_wand.png --file=./output.png
wrangler r2 object get mystica-assets/materials/coffee.png --file=./download.png
```

**Directory structure:**
```
mystica-assets/
├── items/{snake_case_name}.png
├── items/no-background/{snake_case_name}.png
├── materials/{snake_case_name}.png
├── materials/no-background/{snake_case_name}.png
├── monsters/{snake_case_name}.png
└── image-refs/{original_filename}.png  (10 hardcoded references for style)
```

## Common Pitfalls

- **R2 dependency order matters** - Check existence before generating, generate deps before final image
- **Material limit enforced** - 1-3 materials only, violating throws error
- **Blocking generation in MVP** - 20s sync wait, design UI accordingly (loading states)
- **Combo hash must include styles** - Style variants create separate cache entries
- **Reference images hardcoded** - Don't parameterize the 10 image-refs URLs
- **Snake_case normalization** - Spaces become underscores, special chars stripped

## Commands

```bash
cd scripts && pnpm install

# Full pipeline (checks R2, generates missing deps, uploads, creates final image)
pnpm generate-image --type "Magic Wand" --materials "wood,crystal" --provider gemini \
  -r "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/..."

# Batch generate from seed data with R2 upload
pnpm generate-raw-image --batch materials --upload --remove-background

# Single asset generation
pnpm generate-raw-image "Coffee" --type material --upload

# Description only (no image)
npx tsx generate-item-description.ts "Item Type" "material1,material2"
```
