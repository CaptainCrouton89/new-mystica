# CLAUDE.md - Image Generation Pipeline

## Key Capabilities

### Image Generation Modes
- **AI Mode**: `--type "Item Type" --materials "mat1,mat2"` - Auto-generates item name/description via OpenAI
- **Manual Mode**: `"Item Name" "Description"` - Uses provided name and description
- **Reference Images**: `-r URL1,URL2` - Supports HTTP/HTTPS URLs for style consistency
- **Arbitrary/Batch**: Direct prompt-based generation for unstructured content (locations, backgrounds, etc.)

### Provider System
- **Supported**: `gemini` (Nano Banana, default), `seedream-4` (ByteDance)
- **Multiple providers**: `--all` or `--providers gemini,seedream-4` - runs in parallel
- Both providers accessed via Replicate API, not direct APIs

### R2 Asset Caching & Reference
- **Auto-generation**: Checks R2 for item and material assets; generates missing ones in parallel
- **Reference collection**: After generation, collects all item + material URLs from R2 as reference images
- **Key format**: `items/{name}.png`, `materials/{name}.png`, `location-images/{type}.png` (snake_case normalization)
- **Always upload with `--remote`** (wrangler authenticated globally, no env vars needed for CLI)

### Database Integration
- **Location images**: `generate-location-images.ts` generates 5 location type images and updates `locations` table with `image_url`
- **Service role auth**: Uses `SUPABASE_SERVICE_ROLE_KEY` for admin database access
- **Batch updates**: Updates all rows matching a `location_type` value

### Aspect Ratios
- Supported: `1:1` (default), `2:3`, `3:2`, `4:3`, `9:16`, `16:9`
- Passed to Nano Banana as `aspect_ratio`; Seedream uses fixed 1024x1024

## Environment Variables Required

```bash
REPLICATE_API_TOKEN          # Get from https://replicate.com
OPENAI_API_KEY               # Get from https://openai.com (for AI descriptions)
CLOUDFLARE_ACCOUNT_ID        # For R2 access
R2_ACCESS_KEY_ID             # For R2 access
R2_SECRET_ACCESS_KEY         # For R2 access
R2_BUCKET_NAME               # Bucket name
R2_PUBLIC_URL                # Public base URL for R2 assets
SUPABASE_URL                 # For database integration scripts
SUPABASE_SERVICE_ROLE_KEY    # For admin database access
```

## Important Patterns

- Parallel generation with `Promise.allSettled()` for multiple providers
- Parallel asset generation for missing items/materials before main generation
- Reference image validation: only HTTP/HTTPS URLs accepted
- Error handling: `Promise.allSettled()` prevents one failure from blocking others
- Database updates: Use service role key for write access; always handle `data` and `error` from Supabase
- Output format: PNG default, JPG supported
- When generating many images, do them in parallel or in batches

## File Structure

- `generate-image.ts` - Main CLI entry point, handles all generation modes
- `generate-arbitrary-image.ts` - Raw image generation (delegates to Replicate)
- `generate-location-images.ts` - Location type image generation + database update
- `r2-service.ts` - R2 client wrapper with caching logic
- `generate-item-description.ts` - OpenAI integration for name/description
