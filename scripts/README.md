# Mystica Scripts

TypeScript utilities for AI-powered asset generation in the Mystica game project.

## Overview

This directory contains standalone TypeScript scripts for generating game assets using AI image generation (Replicate) and AI text generation (OpenAI). All scripts follow a modular style system with shared R2 storage integration and support for multiple visual styles (rubberhose, chibi, pixel-8bit).

## Setup

```bash
cd scripts
pnpm install
```

## Core Scripts

### Item/Material Generation Pipeline
- **generate-image.ts** - Full crafting pipeline with R2 dependency checking (supports --style flag)
- **generate-raw-image.ts** - Standalone item/material generation with batch mode (supports --style flag)
- **generate-item-description.ts** - AI-generated item names and descriptions
- **generate-ui-icon.ts** - UI icon generation for inventory, buttons, etc. (supports --style flag)

### Monster Pipeline
- **import-monsters-from-animator.ts** - Import monsters from character-animator pipeline into database

### Asset Management
- **upload-to-r2.ts** - Batch upload local files to R2
- **sync-to-db.ts** - Sync R2 asset URLs to database (items + materials, with smart URL resolution)
- **manage-assets.ts** - Asset verification and management

### Utility Image Generation
- **generate-arbitrary-image.ts** - Arbitrary objects with background removal (supports --style flag)
- **generate-landscape.ts** - Environment/background scenes (supports --style flag)
- **analyze-image.ts** - Multi-image analysis with Gemini
- **identify-and-generate-from-image.ts** - Vision pipeline: analyze image → generate game asset

### Style System
- **styles/** - Modular style system (rubberhose, chibi, pixel-8bit)
  - **types.ts** - Style interfaces and type definitions
  - **rubberhose.ts** - 1930s rubber hose animation style (default)
  - **chibi.ts** - Mobile RPG/CCG super-deformed aesthetic
  - **pixel-8bit.ts** - Retro pixel art (8-bit/16-bit era)

### R2 Storage
- **r2-service.ts** - Cloudflare R2 client wrapper (S3-compatible)

## Image Generation

All image generation uses Replicate AI providers with standardized prompts.

### Quick Examples

```bash
# Crafted item with materials (AI-generated name/description)
pnpm generate-image --type "Magic Wand" --materials "wood,crystal"
pnpm generate-image --type "Robot Dog" --materials "metal,screws,plastic" --style chibi

# Standalone item/material (batch mode available)
pnpm generate-raw-image "Coffee" --type material --upload
pnpm generate-raw-image "Sword" --type item --style pixel-8bit

# UI icon generation
pnpm generate-ui-icon "settings" --upload
pnpm generate-ui-icon "inventory_slot" --style rubberhose

# Import monsters from character-animator CSV
pnpm import-monsters --batch

# Arbitrary object with no background
pnpm generate-arbitrary "magical glowing orb" --style chibi

# Landscape/environment
pnpm generate-landscape "mystical desert temple" --aspect 16:9 --style pixel-8bit

# Sync assets to database
pnpm sync-to-db --type items --all
pnpm sync-to-db --type materials --batch "wood,crystal,metal"
```

### Providers

| Provider | Model | Used By | Cost |
|----------|-------|---------|------|
| `gemini` | google/nano-banana | All generators | ~$0.002-0.01/image |
| `seedream-4` | bytedance/seedream-4 | generate-image.ts only | ~$0.002-0.01/image |

## Detailed Script Documentation

### 1. generate-image.ts - Crafted Item Pipeline

Full crafting pipeline that checks R2 for dependencies, generates missing assets, and creates composite items.

```bash
# AI mode - generates name and description
pnpm generate-image --type "Magic Wand" --materials "wood,crystal"
pnpm generate-image --type "Robot Dog" --materials "metal,screws,plastic"

# Manual mode - provide name and description
pnpm generate-image "Kitty Pepe Blade" "The sword has a sleek metal blade"

# With reference images and provider selection
pnpm generate-image --type "Fire Staff" --materials "wood,ruby" \
  -r https://example.com/ref1.png,https://example.com/ref2.png \
  -p seedream-4

# Compare providers
pnpm generate-image --type "Ice Shield" --materials "crystal,steel" --all
```

**Key Features:**
- Checks R2 for item and material images before generating
- Generates missing dependencies in parallel
- Uploads to R2 automatically
- Supports 1-3 materials (enforced)
- Includes style reference images from R2

### 2. generate-raw-image.ts - Standalone Assets

Generate individual items or materials with AI descriptions. Supports batch mode from seed data.

```bash
# Single item/material
pnpm generate-raw-image "Fuzzy Slippers" --type item
pnpm generate-raw-image "Coffee" --type material --upload

# Multiple items
pnpm generate-raw-image "Dragon" "Sword" "Shield" --type item

# Batch generation from seed data
pnpm generate-raw-image --batch items
pnpm generate-raw-image --batch materials
pnpm generate-raw-image --batch all --upload

# With background removal
pnpm generate-raw-image "Coffee" --type material --upload --remove-background
```

**Key Features:**
- AI-generated descriptions using GPT-4.1-mini
- Batch mode processes all items/materials from `docs/seed-data-*.json`
- Optional R2 upload with `--upload`
- Optional background removal with `--remove-background`
- Uses 10 hardcoded reference images for style consistency

### 3. import-monsters-from-animator.ts - Monster Database Import ⭐ NEW

Import monsters from the character-animator pipeline into the production database. This replaces the deprecated `generate-raw-monster.ts` workflow for production use.

**Flow:** CSV → AI Metadata → Database (get UUID) → R2 Upload (UUID-based paths)

```bash
# Import all monsters from CSV (default paths)
pnpm import-monsters --batch

# Import specific monsters
pnpm import-monsters "scifi_alien_warrior_001" "horror_zombie_016"

# Custom CSV and sprites paths
pnpm import-monsters --batch \
  --csv /path/to/monsters.csv \
  --sprites /path/to/character-sprites

# Dry run (test without DB/R2 writes)
pnpm import-monsters --batch --dry-run

# Skip existing monsters
pnpm import-monsters --batch --skip-existing
```

**Key Features:**
- **Generates AI metadata** via OpenAI GPT-4o-mini:
  - Human-readable names from filenames
  - Personality traits (aggression, intelligence, cunning, hostility)
  - Dialogue tone and guidelines
  - Combat stats (HP, attack/defense power/accuracy)
  - Tier assignment based on description keywords
- **Database integration:**
  - Inserts into `enemytypes` table
  - Gets UUID for R2 path structure
  - Validates required environment variables
- **R2 upload:**
  - UUID-based paths: `monsters/{uuid}/base.png`, `monsters/{uuid}/sprites/*`
  - Uploads base image + all sprite sheets (PNG + JSON atlases)
  - Parallel uploads for performance
- **Character-animator integration:**
  - Reads from `characters_200.csv` (or custom path)
  - Expects sprite structure: `{filename}-greenscreen/base.png` + sprite files
  - Compatible with character-animator pipeline output

**CSV Format:**
```csv
description,filename
a menacing alien warrior with glowing purple armor,scifi_alien_warrior_001
a robotic assassin with red glowing eyes,scifi_robot_assassin_002
```

**Expected Sprite Directory Structure:**
```
character-sprites/
├── scifi_alien_warrior_001-greenscreen/
│   ├── base.png
│   ├── idle_sample1.png
│   ├── idle_sample1.json
│   ├── attack_sample1.png
│   ├── attack_sample1.json
│   ├── damage_sample1.png
│   ├── damage_sample1.json
│   ├── death_sample1.png
│   └── death_sample1.json
└── horror_zombie_016-greenscreen/
    └── ...
```

**R2 Output Structure (UUID-based):**
```
monsters/
└── {uuid}/
    ├── base.png
    └── sprites/
        ├── idle_sample1.png
        ├── idle_sample1.json
        ├── attack_sample1.png
        └── ...
```

**API Access:**
```bash
# Get monster by ID (returns full data + image URLs)
curl http://localhost:3000/api/v1/enemies/{uuid}

# List all monsters
curl http://localhost:3000/api/v1/enemies?limit=50&offset=0
```

**See also:** `character-animator/README.md` for the full animation pipeline.

---

### 4. upload-to-r2.ts - Batch Upload Tool

Upload local files to R2 storage with automatic path detection.

```bash
# Upload single file
pnpm upload-to-r2 --file output/raw/materials/coffee.png --key materials/coffee.png

# Batch upload directory
pnpm upload-to-r2 --dir output/raw/materials --prefix materials/

# Dry run to preview uploads
pnpm upload-to-r2 --dir output/raw/items --prefix items/ --dry-run
```

**Key Features:**
- Automatic content-type detection
- Batch directory uploads with prefix
- Dry run mode for safety
- Overwrites existing files by default

---

### 5. sync-to-db.ts - Database Sync Tool

Sync R2 asset URLs to Supabase database for items and materials.

```bash
# Sync single item
pnpm sync-to-db --type items --name "Fire Sword"

# Sync batch of materials
pnpm sync-to-db --type materials --batch "wood,crystal,metal"

# Sync all items without image URLs
pnpm sync-to-db --type items --all

# Dry run to preview changes
pnpm sync-to-db --type items --all --dry-run

# Verify R2 assets exist before syncing
pnpm sync-to-db --type materials --all --verify
```

**Key Features:**
- **Smart URL resolution for items:**
  - Priority 1: `items-crafted/{slug}/{combo_hash}.png` (combo items with materials)
  - Priority 2: `items/{name}.png` (specific items)
  - Priority 3: `items/default_{category}.png` (category defaults)
- **Simple path for materials:** `materials/{name}.png`
- Case-insensitive name matching
- Skips records that already have URLs set
- Detailed status reporting per record

---

### 6. manage-assets.ts - Asset Management

Verify and manage R2 assets with database cross-reference.

```bash
# Verify all assets
pnpm manage-assets --verify

# List missing assets
pnpm manage-assets --type items --missing

# Check specific asset
pnpm manage-assets --type materials --name "wood"
```

**Key Features:**
- Cross-reference R2 storage with database
- Identify missing assets
- Bulk verification

---

### 7. generate-arbitrary-image.ts - Utility Objects

Generate arbitrary game assets with automatic background removal and cropping.

```bash
# Simple generation
pnpm generate-arbitrary "a magical glowing orb"
pnpm generate-arbitrary "cyberpunk samurai sword"

# Custom output
pnpm generate-arbitrary "dragon egg" --output my-dragon-egg.png

# Upload to R2
pnpm generate-arbitrary "fire sword" --r2 "items/fire-sword.png"
pnpm generate-arbitrary "golden coin" --r2 "materials/gold-coin.png"
```

**Key Features:**
- Automatic background removal (bria/remove-background)
- Auto-crops transparent edges
- No AI description generation - uses prompt directly
- Same style reference images as other generators

### 8. generate-landscape.ts - Environments

Generate landscape and background images for game environments.

```bash
# Default 16:9 landscape
pnpm generate-landscape "mystical desert temple"
pnpm generate-landscape "enchanted forest clearing"

# Square format
pnpm generate-landscape "magical portal" --aspect 1:1

# Portrait for mobile
pnpm generate-landscape "ancient tower" --aspect 9:16

# Ultra-wide cinematic
pnpm generate-landscape "epic battlefield" --aspect 21:9

# Upload to R2
pnpm generate-landscape "crystal cave" --r2 "backgrounds/crystal-cave.png"
```

**Key Features:**
- Supports 10 aspect ratios (1:1 to 21:9)
- Keeps background (NOT removed)
- Landscape-optimized prompts with depth and atmosphere
- Edge-to-edge composition without borders

### 9. generate-item-description.ts - AI Descriptions

Standalone AI description generation for items (used by generate-image.ts).

```bash
pnpm generate-description "Magic Wand" "wood,crystal"
pnpm generate-description "Robot Dog" "metal,screws,plastic"
pnpm generate-description "Amulet" "hello kitty,wizard hat,matcha powder"
```

**Output:**
```json
{
  "name": "Crystalline Arcane Staff",
  "description": "The wand has a gnarled wooden shaft with smooth wood grain texture. A large faceted crystal orb is embedded at the top, glowing with inner light."
}
```

**Key Features:**
- Uses GPT-4.1-mini for cost efficiency (~$0.0001-0.0005 per generation)
- Enforces material fusion (materials become the item, not decorations)
- Two-sentence physical descriptions only
- Creative naming that reflects materials and item type

### 10. analyze-image.ts - Image Analysis

Analyze images using Gemini 2.5 Flash for quality checks or descriptions.

```bash
# Single image
pnpm analyze-image "What objects do you see?" photo.jpg

# Multiple images
pnpm analyze-image "Compare these images" img1.jpg img2.jpg img3.jpg
```

**Use Cases:**
- Verify generated assets match requirements
- Compare style consistency across batches
- Extract descriptions from reference images

## Environment Variables

All scripts read from `../.env.local` (project root). Required variables:

```bash
# AI Services (REQUIRED)
REPLICATE_API_TOKEN=...      # Get from https://replicate.com
OPENAI_API_KEY=...           # Get from https://openai.com (for descriptions)
GOOGLE_API_KEY=...           # Get from https://aistudio.google.com (for analyze-image)

# Cloudflare R2 Storage (REQUIRED for --upload or --r2 flags)
CLOUDFLARE_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=mystica-assets  # Optional, defaults to mystica-assets
R2_PUBLIC_URL=...            # Public base URL for R2 assets

# Database (REQUIRED for import-monsters-from-animator.ts)
SUPABASE_URL=...             # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=... # Service role key (admin access)
```

## R2 Storage Integration

### r2-service.ts - Core Utilities

```typescript
import { checkR2AssetExists, getR2AssetUrl, uploadToR2 } from './r2-service';

// Check existence
const exists = await checkR2AssetExists('coffee', 'material');

// Get URL (throws if not found)
const url = await getR2AssetUrl('coffee', 'material');

// Upload local file
const publicUrl = await uploadToR2('./local-file.png', 'coffee', 'material');

// Batch operations
const urls = await getMultipleAssetUrls(['coffee', 'slime'], 'material');
```

**Directory Structure:**
```
mystica-assets/
├── items/{snake_case_name}.png
├── items/no-background/{snake_case_name}.png
├── items/default_{category}.png          # Category defaults for items
├── items-crafted/{slug}/{combo_hash}.png # Combo items with materials applied
├── materials/{snake_case_name}.png
├── materials/no-background/{snake_case_name}.png
├── monsters/{uuid}/                      # UUID-based structure
│   ├── base.png
│   └── sprites/
│       ├── idle_sample1.png
│       ├── idle_sample1.json
│       └── ...
└── image-refs/
    ├── rubberhose/{filename}.png         # Rubberhose style references
    ├── chibi/{filename}.png              # Chibi style references
    └── pixel-8bit/{filename}.png         # Pixel 8-bit style references
```

**Public URL:** `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/{path}`

**Monster Import Architecture:**
- All monster imports use `import-monsters-from-animator.ts` with UUID-based paths (`monsters/{uuid}/`)

### Wrangler CLI (Alternative)

Wrangler is authenticated globally (no env vars needed):

```bash
# List objects
wrangler r2 object list mystica-assets

# Upload
wrangler r2 object put mystica-assets/items/magic_wand.png --file=./output.png

# Download
wrangler r2 object get mystica-assets/materials/coffee.png --file=./download.png
```

## Architecture & Patterns

### Modular Style System

All generators support multiple visual styles via the `--style` flag:

**Available Styles:**
- `rubberhose` (default) - 1930s rubber hose animation inspired by Cuphead, Fleischer Studios
- `chibi` - Mobile RPG/CCG super-deformed aesthetic with vivid colors and bold outlines
- `pixel-8bit` - Retro pixel art inspired by 8-bit/16-bit era games (SNES, Genesis, NES)

**Style-Specific Reference Images:**
Each style has its own set of reference images stored in R2 (`image-refs/{style}/`):

```typescript
// Example: Chibi style config
{
  name: 'chibi',
  displayName: 'Chibi/Super-Deformed',
  referenceImages: [
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/chibi/sword.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/chibi/slime.png',
    // ... more
  ],
  model: 'google/nano-banana',
  params: { aspectRatio: '1:1', outputFormat: 'png' }
}
```

**Usage:**
```bash
# Use default rubberhose style
pnpm generate-raw-image "Sword" --type item

# Specify style explicitly
pnpm generate-raw-image "Sword" --type item --style chibi
pnpm generate-raw-image "Potion" --type item --style pixel-8bit
```

These references train Replicate models on each style's unique aesthetic.

### Prompt Engineering

Each style has its own prompt templates via the `StylePromptBuilder` interface:
- `buildItemPrompt(name, description)` - Item generation prompts
- `buildMaterialPrompt(name, description)` - Material generation prompts
- `buildLandscapePrompt(description, aspectRatio)` - Landscape/background prompts
- `buildArbitraryPrompt(description)` - Arbitrary asset prompts

**Common Elements Across Styles:**
- **Composition:** Center-framed, clear silhouettes, NO image edge borders
- **Background:** Simple solid colors or gradients (items/materials), full environments (landscapes)

**Style-Specific Characteristics:**
- **Rubberhose:** Thick black outlines, vintage color palette, cel shading, 1930s cartoon aesthetic
- **Chibi:** Bold outlines on subject only, vivid colors, hybrid cel + soft gradients, mobile RPG aesthetic
- **Pixel-8bit:** Visible pixels, limited color palette, dithering, NO anti-aliasing, retro game aesthetic

### Cost Optimization

| Operation | Service | Cost |
|-----------|---------|------|
| Image generation | Replicate (Gemini/Seedream) | ~$0.002-0.01 |
| Background removal | Replicate (bria) | ~$0.002-0.01 |
| AI description | OpenAI GPT-4.1-mini | ~$0.0001-0.0005 |
| Image analysis | Gemini 2.5 Flash | ~$0.001-0.005 |

**Batch Generation Estimates:**
- 101 items/materials: ~$0.20-1.00 (images) + ~$0.01-0.05 (descriptions)
- With background removal: ~$0.40-2.00 total
- 200 monsters (import-monsters): ~$0.03 (AI metadata only, sprites pre-generated)

### Error Handling

All scripts throw errors early for:
- Missing environment variables
- Asset not found in R2 (when expected)
- Invalid parameters (material count, aspect ratio, etc.)
- Failed API calls

Use try/catch in programmatic usage:

```typescript
try {
  await generateRawImage({ name: 'Coffee', type: 'material' });
} catch (error) {
  console.error('Generation failed:', error.message);
}
```

## Output Directories

All generated images are saved locally:

```
scripts/
└── output/
    ├── arbitrary/          # generate-arbitrary-image.ts
    ├── landscapes/         # generate-landscape.ts
    └── raw/
        ├── items/          # generate-raw-image.ts --type item
        ├── materials/      # generate-raw-image.ts --type material
        └── monsters/       # generate-raw-monster.ts
```

Filenames: `{sanitized_name}-{timestamp}.{format}`

R2 uploads use deterministic keys (no timestamps) for caching.

## Seed Data Integration

Batch generation reads from `../docs/seed-data-*.json`:

- **seed-data-items.json** - Item definitions
- **seed-data-materials.json** - Material definitions
- **seed-data-monsters.json** - Monster definitions with personality traits

Example structure:
```json
{
  "items": [
    { "id": "fuzzy-slippers", "name": "Fuzzy Slippers" }
  ],
  "materials": [
    { "id": "coffee", "name": "Coffee" }
  ],
  "monsters": [
    {
      "id": "spray-paint-goblin",
      "name": "Spray Paint Goblin",
      "personality_traits": ["street-smart", "sarcastic"],
      "dialogue_tone": "urban slang"
    }
  ]
}
```

## Troubleshooting

**Missing API Token**
```
Error: REPLICATE_API_TOKEN not found in .env.local
```
→ Add required env vars to `.env.local` in project root (not scripts/.env.local)

**Asset Not Found in R2**
```
Error: Asset not found in R2: material "coffee"
```
→ Generate and upload asset first, or use `--upload` flag

**Material Count Validation**
```
❌ Materials must contain between 1 and 3 items
```
→ Crafting requires 1-3 materials (enforced by game design)

**Background Removal Requires Upload**
```
❌ --remove-background requires --upload
```
→ Background removal needs R2 URL as input, so upload must be enabled

## Development

### Adding New Generators

1. Follow naming convention: `generate-{purpose}.ts` or `generate-raw-{type}.ts`
2. Import from `r2-service.ts` for R2 operations
3. Use shared `CONFIG.defaultReferenceImages` for consistency
4. Add script to `package.json` scripts
5. Update this README

### TypeScript Module Pattern

All scripts use:
```typescript
// Run CLI when executed directly (not when imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await main().catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  })();
}
```

This allows importing functions without executing CLI:
```typescript
import { generateRawImage } from './generate-raw-image.js';
```

## Monster Import Workflow

For production monster imports from the character-animator pipeline:

```bash
# 1. Generate and animate characters (see character-animator/README.md)
cd character-animator
python mass_generate_characters.py characters_200.csv --aspect-ratio 9:16
python process_folder.py character-animations/generated/batch_*/ --landscape
python animate_characters.py character-animations/processed/ --config animation_config.json
python trim_and_loop.py character-animations/animated/batch_*/ --sprites

# 2. Import into database and upload to R2
cd ../scripts
pnpm import-monsters --batch \
  --csv ../character-animator/characters_200.csv \
  --sprites ../character-animator/character-animations/character-sprites

# 3. Verify via API
curl http://localhost:3000/api/v1/enemies | jq '.monsters | length'
```

**Integration Points:**
- `character-animator/` - Python pipeline for generating and animating sprites
- `scripts/import-monsters-from-animator.ts` - TypeScript bridge to database/R2
- `mystica-express/src/routes/enemies.ts` - API endpoints for monster data
- `mystica-express/src/services/EnemyService.ts` - Business logic for monster retrieval

## See Also

- **character-animator/README.md** - Full animation pipeline documentation
- **Project CLAUDE.md** - Backend architecture, database schema, migration status
- **docs/CLAUDE.md** - YAML documentation system and validation
- **docs/external/gemini-image-generation.md** - Gemini API reference
- **docs/external/replicate.md** - Replicate API reference
