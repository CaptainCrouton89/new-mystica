# Mystica Scripts

TypeScript utilities for AI-powered asset generation in the Mystica game project.

## Overview

This directory contains standalone TypeScript scripts for generating game assets using AI image generation (Replicate) and AI text generation (OpenAI). All scripts follow a consistent architecture with shared R2 storage integration and standardized chibi/super-deformed art style.

## Setup

```bash
cd scripts
pnpm install
```

## Core Scripts

### Item/Material Crafting Pipeline
- **generate-image.ts** - Full crafting pipeline with R2 dependency checking
- **generate-raw-image.ts** - Standalone item/material generation with batch mode
- **generate-item-description.ts** - AI-generated item names and descriptions

### Monster Generation
- **generate-raw-monster.ts** - Monster character generation with personality-based descriptions

### Utility Image Generation
- **generate-arbitrary-image.ts** - Arbitrary objects with background removal
- **generate-landscape.ts** - Environment/background scenes
- **analyze-image.ts** - Multi-image analysis with Gemini

### R2 Storage
- **r2-service.ts** - Cloudflare R2 client wrapper (S3-compatible)

## Image Generation

All image generation uses Replicate AI providers with standardized prompts.

### Quick Examples

```bash
# Crafted item with materials (AI-generated name/description)
pnpm generate-image --type "Magic Wand" --materials "wood,crystal"

# Standalone material (batch mode available)
pnpm generate-raw-image "Coffee" --type material --upload

# Monster with personality
pnpm generate-raw-monster "Spray Paint Goblin"

# Arbitrary object with no background
pnpm generate-arbitrary "magical glowing orb"

# Landscape/environment
pnpm generate-landscape "mystical desert temple" --aspect 16:9
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

### 3. generate-raw-monster.ts - Monster Characters

Generate monster character images with personality-based AI descriptions.

```bash
# Single monster
pnpm generate-raw-monster "Spray Paint Goblin"
pnpm generate-raw-monster "Goopy Floating Eye"

# Multiple monsters
pnpm generate-raw-monster "Dragon" "Slime" "Ghost"

# Batch from seed data
pnpm generate-raw-monster --batch

# Custom format
pnpm generate-raw-monster "Feral Unicorn" --format jpg
```

**Key Features:**
- Reads personality traits and dialogue tone from seed data
- AI description incorporates personality into visual details
- Dynamic poses showing character personality
- Chibi/super-deformed character aesthetic
- Batch mode processes `docs/seed-data-monsters.json`

### 4. generate-arbitrary-image.ts - Utility Objects

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

### 5. generate-landscape.ts - Environments

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

### 6. generate-item-description.ts - AI Descriptions

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

### 7. analyze-image.ts - Image Analysis

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
├── materials/{snake_case_name}.png
├── materials/no-background/{snake_case_name}.png
├── monsters/{snake_case_name}.png
└── image-refs/{original_filename}.png (10 hardcoded references)
```

**Public URL:** `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/{path}`

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

### Style Reference System

All generators use 10 hardcoded reference images from R2 for style consistency:

```typescript
const CONFIG = {
  defaultReferenceImages: [
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/bubble-wrap-vest.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/fuzzy-slippers.png',
    // ... 8 more
  ]
};
```

These references train Replicate models on the chibi/super-deformed aesthetic.

### Prompt Engineering

All scripts use standardized prompt templates with:
- **Core Look:** Vivid colors, clear lighting, minimal glow
- **Line & Form:** Bold black outlines on objects (NOT image edges)
- **Shading & Depth:** Hybrid cel + soft gradients
- **Composition:** Center-framed, simple backgrounds, NO borders

Landscape prompts add depth layers and atmospheric perspective.

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
- 5 monsters: ~$0.01-0.05 (images) + ~$0.0005-0.0025 (descriptions)

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

## See Also

- **Project CLAUDE.md** - Backend architecture, database schema, migration status
- **docs/CLAUDE.md** - YAML documentation system and validation
- **docs/external/gemini-image-generation.md** - Gemini API reference
- **docs/external/replicate.md** - Replicate API reference
