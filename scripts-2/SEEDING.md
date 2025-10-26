# Multi-Style Asset Seeding System

Automated pipeline for generating styled game assets (materials, items, locations, UI icons) using AI-powered image generation.

## Overview

Two-phase pipeline:
1. **Phase 1 (Generate):** AI-generated descriptions + Replicate image generation → Local storage with metadata
2. **Phase 2 (Upload):** Upload to Cloudflare R2 + Sync to Supabase

## Prerequisites

1. **Run database migration:**
   ```bash
   # Apply the migration to add style_id columns
   psql <your-supabase-connection-string> < migrations/add-style-support.sql
   ```

2. **Update `seed-config.ts`:**
   - After running the migration, copy the chibi `style_id` from the output
   - Replace `PLACEHOLDER_CHIBI_STYLE_ID` in `seed-config.ts` with the actual UUID

3. **Environment variables required:**
   ```bash
   # In ../.env.local
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...
   REPLICATE_API_TOKEN=...
   OPENAI_API_KEY=...
   CLOUDFLARE_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET_NAME=mystica-assets
   R2_PUBLIC_URL=https://pub-xxx.r2.dev
   ```

## Usage

### Phase 1: Generate Images

```bash
# Generate all assets in all styles
pnpm seed:generate --all

# Generate specific types in specific styles
pnpm seed:generate --types materials,items --styles rubberhose,chibi

# Generate with background removal
pnpm seed:generate --types materials --styles rubberhose --remove-bg

# Examples
pnpm seed:generate --types materials --styles rubberhose
pnpm seed:generate --types items,locations --styles chibi,pixel
pnpm seed:generate --types ui-icons --styles rubberhose,chibi,pixel
```

**What it does:**
1. Loads assets from Supabase (materials, itemtypes, locations)
2. Generates AI descriptions using OpenAI GPT-4
3. Generates images using Replicate (google/nano-banana)
4. Optionally removes backgrounds using Replicate (bria/remove-background)
5. Saves to `seed-output/` with metadata

**Output structure:**
```
seed-output/
├── metadata.json                 # Master manifest
├── materials/
│   ├── rubberhose/
│   │   ├── coffee.png
│   │   ├── coffee-nobg.png      # If --remove-bg used
│   │   └── coffee.json
│   ├── chibi/
│   └── pixel/
├── items/
│   ├── rubberhose/
│   └── ...
├── locations/
│   └── ...
└── ui-icons/
    └── ...
```

**Expected counts (as of 2025-10-25):**
- Materials: 15 × 3 styles = 45 images
- Items: 27 × 3 styles = 81 images
- Locations: 7 × 3 styles = 21 images
- UI Icons: 12 × 3 styles = 36 images
- **Total: 183 images**
- With `--remove-bg`: **366 images** (double)

**Estimated cost:**
- Image generation: 183 × $0.005 = ~$0.92
- Background removal: 183 × $0.002 = ~$0.37
- AI descriptions: 61 × $0.0001 = ~$0.006
- **Total: ~$1.30** (or ~$0.93 without bg removal)

### Phase 2: Upload to R2 and Sync DB

```bash
# Dry run (preview changes, no uploads)
pnpm seed:upload --dry-run

# Upload with background versions
pnpm seed:upload

# Upload no-background versions instead
pnpm seed:upload --use-nobg
```

**What it does:**
1. Reads `seed-output/metadata.json`
2. Uploads PNGs to Cloudflare R2
3. Updates Supabase tables:
   - `materials`: Sets `style_id` (image_url optional, client constructs)
   - `itemtypes`: Sets `style_id` and `base_image_url`
   - `locations`: Sets `style_id` and `image_url`
   - `ui-icons`: R2 only (not stored in DB)

**Output:**
- `seed-output/upload-report.json` - Detailed upload results

## R2 URL Conventions

### Materials
```
# Rubberhose
https://pub-xxx.r2.dev/materials/rubberhose/coffee.png

# Chibi
https://pub-xxx.r2.dev/materials/chibi/coffee.png

# Pixel
https://pub-xxx.r2.dev/materials/pixel/coffee.png
```

### Items
```
https://pub-xxx.r2.dev/items/rubberhose/magic_wand.png
https://pub-xxx.r2.dev/items/chibi/enormous_key.png
https://pub-xxx.r2.dev/items/pixel/halo.png
```

### Locations
```
https://pub-xxx.r2.dev/location-images/rubberhose/coffee_shop.png
https://pub-xxx.r2.dev/location-images/chibi/dungeon.png
https://pub-xxx.r2.dev/location-images/pixel/gym.png
```

### UI Icons
```
https://pub-xxx.r2.dev/ui-icons/rubberhose/weapon-icon.png
https://pub-xxx.r2.dev/ui-icons/chibi/inventory-icon.png
https://pub-xxx.r2.dev/ui-icons/pixel/settings-icon.png
```

## Client-Side URL Construction

Since only rubberhose URLs are stored in the database, clients construct URLs for other styles:

```typescript
// Example Swift/TypeScript
func getMaterialImageUrl(materialName: String, styleName: String) -> String {
  let normalized = materialName.lowercased().replacingOccurrences(of: " ", with: "_")
  return "\(R2_PUBLIC_URL)/materials/\(styleName)/\(normalized).png"
}
```

## Styles Configuration

Defined in `seed-config.ts`:

| Style | style_id | Reference Image | Visual Modifier |
|-------|----------|----------------|----------------|
| rubberhose | c0d99a3c-... | cuphead-rubberhouse | rubberhose_cartoon |
| chibi | (from migration) | chibi/Screenshot... | chibi_anime |
| pixel | dd8217d8-... | pixel/cloud-pixel.png | pixelated |

## UI Icons

12 icons generated for frontend use (not stored in database):

- weapon-icon, armor-icon, head-icon, feet-icon
- accessory-icon, offhand-icon, pet-icon
- inventory-icon, shop-icon, map-icon
- settings-icon, crafting-icon

## Troubleshooting

### "Missing required R2 environment variables"
Ensure all R2 and Supabase env vars are set in `../.env.local`

### "Manifest not found"
Run `pnpm seed:generate` before `pnpm seed:upload`

### "PLACEHOLDER_CHIBI_STYLE_ID"
Run the migration SQL and update `seed-config.ts` with the actual chibi UUID

### API Rate Limits
Replicate may throttle requests. The scripts use sequential processing to avoid hitting limits. If you hit a rate limit, wait a few minutes and re-run.

### Generation Failures
Check `seed-output/metadata.json` for failures. Failed assets will have an `error` field. Re-run generation for just those assets if needed.

## Files

- `seed-config.ts` - Style configurations and UI icons list
- `seed-generate.ts` - Phase 1: AI description + image generation
- `seed-upload.ts` - Phase 2: R2 upload + DB sync
- `migrations/add-style-support.sql` - Database schema changes

## Workflow Example

```bash
# 1. Run migration
psql <connection-string> < migrations/add-style-support.sql

# 2. Update seed-config.ts with chibi style_id

# 3. Generate all assets
pnpm seed:generate --all --remove-bg

# 4. Preview uploads
pnpm seed:upload --dry-run

# 5. Execute uploads
pnpm seed:upload

# 6. Check report
cat seed-output/upload-report.json
```

## Development Tips

- Start small: `pnpm seed:generate --types materials --styles rubberhose` (15 images)
- Always use `--dry-run` first on uploads
- Keep `seed-output/` directory for reference and recovery
- Failed generations can be retried individually
- Cost adds up - be mindful of `--all` with `--remove-bg`
