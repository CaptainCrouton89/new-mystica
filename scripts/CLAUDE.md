# CLAUDE.md - Image Generation & Asset Pipeline

## Generation Scripts

- **generate-image.ts** - AI mode (`--type "Item" --materials "mat1,mat2"`) or manual with optional reference images
- **generate-raw-image.ts** - Batch materials/backgrounds with background removal
- **generate-arbitrary-image.ts** - Direct prompt-based generation
- **generate-landscape.ts** - Landscape/background images with auto-crop (keeps background)
- **generate-raw-monster.ts** - Standalone monsters with AI descriptions (local output, manual R2 upload)
- **generate-location-images.ts** - Location types + database updates via service role key

## Asset & Utility Scripts

- **convert-to-atlas.ts** - SpriteKit atlas conversion for animations (`--monster doctor --animation idle`)
- **import-monsters-from-animator.ts** - Character-animator asset import
- **populate-item-images.ts** - Batch item image URL population
- **r2-service.ts** - R2 wrapper with caching

## Providers & Formats

- **Providers**: `gemini` (Nano Banana, default), `seedream-4` (ByteDance), `--all` for parallel
- **Aspect Ratios**: `1:1` (default), `2:3`, `3:2`, `4:3`, `9:16`, `16:9` (Seedream uses 1024x1024)
- **R2 Keys**: `items/{name}.png`, `materials/{name}.png`, `location-images/{type}.png`, `monsters/{name}.png`

## Environment Variables

```
REPLICATE_API_TOKEN, OPENAI_API_KEY, CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

## Key Patterns

- Parallel generation via `Promise.allSettled()` prevents single failures
- Auto-generate missing assets before main generation
- Service role key required for database writes
- Wrangler authenticated globally (no env vars for CLI R2)
