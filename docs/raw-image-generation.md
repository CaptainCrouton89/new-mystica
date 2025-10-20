# Raw Image Generation Pipeline

**Last Updated:** 2025-10-20
**Status:** Active
**Purpose:** Generate standalone item and material images without fusion logic

## Overview

The raw image generation pipeline creates individual item and material images using AI image generation. Unlike the fusion pipeline (`generate-image.ts`), this pipeline does **not** combine materials with items. Instead, it renders each item or material as a standalone asset in the Mystica chibi/super-deformed game aesthetic.

**Key Characteristics:**
- **No AI description generation** - Item/material names passed directly to the image model
- **No fusion logic** - Each asset rendered independently
- **Consistent style** - Uses the same detailed prompt as the fusion pipeline
- **R2 reference images** - All 5 reference images included automatically
- **Batch processing** - Can generate all 101 items + materials in one command

## Use Cases

1. **Seed Data Asset Generation** - Generate images for all items and materials in `docs/seed-data-*.json`
2. **Base Asset Library** - Create a library of standalone assets before applying materials
3. **Reference Assets** - Generate clean versions of items/materials for UI mockups
4. **A/B Testing** - Compare fusion results against standalone base assets

## Quick Start

```bash
# Navigate to scripts directory
cd scripts

# Single generation
pnpm generate-raw-image "Fuzzy Slippers" --type item
pnpm generate-raw-image "Coffee" --type material

# Batch generation (recommended)
pnpm generate-raw-image --batch all
```

## Configuration

### Hardcoded Settings

The pipeline uses fixed configuration to ensure consistency:

```typescript
const CONFIG = {
  aspectRatio: '1:1',           // Square images only
  provider: 'gemini',           // Gemini Nano Banana only
  model: 'google/nano-banana',  // Fixed model
  defaultReferenceImages: [     // 5 R2-hosted reference images
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_0821.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_2791.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_4317.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_5508.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_9455.png'
  ]
};
```

### Environment Variables

```bash
# .env.local (required)
REPLICATE_API_TOKEN=your_replicate_api_token_here
```

Get your token from [replicate.com](https://replicate.com).

## CLI Reference

### Single Generation Mode

Generate a single item or material:

```bash
pnpm generate-raw-image "Name" --type item|material [options]
```

**Arguments:**
- `Name` - The name of the item or material (required)
- `--type` - Type: `item` or `material` (required)

**Options:**
- `-o, --output PATH` - Custom output file path
- `-f, --format FMT` - Output format: `jpg` or `png` (default: `png`)
- `-h, --help` - Show help message

**Examples:**
```bash
# Generate item
pnpm generate-raw-image "Fuzzy Slippers" --type item

# Generate material
pnpm generate-raw-image "Coffee" --type material

# Custom output path
pnpm generate-raw-image "Mood Ring" --type item -o custom/path/mood-ring.png

# JPG format
pnpm generate-raw-image "Rainbow" --type material --format jpg
```

### Batch Generation Mode

Generate multiple items/materials from seed data:

```bash
pnpm generate-raw-image --batch items|materials|all [options]
```

**Batch Types:**
- `items` - Generate all 40 items from `docs/seed-data-items.json`
- `materials` - Generate all 61 materials from `docs/seed-data-materials.json`
- `all` - Generate all 101 items and materials

**Options:**
- `-f, --format FMT` - Output format for all images (default: `png`)

**Examples:**
```bash
# Generate all items
pnpm generate-raw-image --batch items

# Generate all materials
pnpm generate-raw-image --batch materials

# Generate everything
pnpm generate-raw-image --batch all

# Generate everything as JPG
pnpm generate-raw-image --batch all --format jpg
```

## Output Structure

Generated images are organized by type:

```
scripts/
└── output/
    └── raw/
        ├── items/
        │   ├── fuzzy_slippers-1760997333946.png
        │   ├── mood_ring-1760997349267.png
        │   └── gatling_gun-1760997368569.png
        └── materials/
            ├── coffee-1760997384501.png
            ├── matcha_powder-1760997397777.png
            └── rainbow-1760997446463.png
```

**Note:** The script runs from the `scripts/` directory, so output is relative to that location.

**Filename Format:** `{sanitized_name}-{timestamp}.{format}`

- Names are lowercased and sanitized (spaces → underscores, special chars removed)
- Timestamp ensures uniqueness
- Extension matches format (png or jpg)

## Prompt Template

The pipeline uses a detailed style prompt that matches the fusion pipeline aesthetic:

```typescript
function buildRawPrompt(name: string, type: 'item' | 'material'): string {
  const subject = type === 'item' ? 'game item' : 'material';

  return `Create a single, center-framed 1:1 ${subject}:

"${name}"

This illustration in a polished, high-detail "chibi"/super-deformed aesthetic
typical of mobile RPGs and CCGs.

Core Look
    •    Color: Vivid, high-saturation palette; punchy local colors with
         clean hue separation. Keep values readable; avoid muddy midtones.
    •    Lighting: Clear, soft key light with gentle fill; minimal deep
         shadow. Add a crisp rim light to separate from the background.
    •    Glow & Highlights: Tasteful outer glow/halo to signal rarity or
         power. Use tight, glossy specular highlights on hard materials;
         soft bloom on emissive parts.

Line & Form
    •    Outlines: Bold, uniform, and clean to carve a strong silhouette;
         no sketchy linework.
    •    Proportions: Chunky, simplified, and slightly exaggerated shapes
         for instant readability.
    •    Texture: Suggestive, not photoreal—hint at materials (wood grain,
         brushed metal, facets) with tidy, deliberate marks.

Shading & Depth
    •    Render Style: Hybrid cel + soft gradients; sharp edge transitions
         only where they improve clarity.
    •    Volume: Strong sense of 3D mass via light, occlusion, and
         controlled contrast; default to a subtle 3/4 view.

Composition & Background
    •    Framing: Single hero object, centered; crop to emphasize silhouette.
    •    Background: Simple radial gradient or soft vignette; optional light
         particle specks. No props or scene unless specified.
    •    Polish: Soft contact shadow beneath ${subject}; no text, watermarks,
         borders, or logos.`;
}
```

**Key Differences from Fusion Prompt:**
- No instructions about combining materials
- No mention of material integration or transformation
- Focuses on rendering a single, standalone object beautifully

## Implementation Details

### Technology Stack

- **TypeScript** - Type-safe implementation
- **Replicate API** - AI image generation via `google/nano-banana`
- **Cloudflare R2** - Reference image hosting
- **Node.js** - Runtime environment

### Core Functions

```typescript
// Generate raw image from name and type
async function generateRawImage(options: GenerateRawImageOptions): Promise<string>

// Batch generate from seed data
async function generateBatch(
  batchType: 'items' | 'materials' | 'all',
  options: Partial<GenerateRawImageOptions>
): Promise<void>

// Build style-rich prompt
function buildRawPrompt(name: string, type: 'item' | 'material'): string

// Call Replicate API with Gemini
async function generateImageWithReplicate(
  options: GenerateRawImageOptions
): Promise<string>
```

### Batch Processing

Batch mode reads from seed data files and processes sequentially:

1. Load seed data from `docs/seed-data-items.json` or `docs/seed-data-materials.json`
2. Extract item/material names
3. Generate images one at a time with progress tracking
4. Save to organized output directories
5. Display summary of successful/failed generations

**Progress Output:**
```
🚀 Starting batch generation for all...

📋 Total tasks: 101
   Items: 40
   Materials: 61

[1/101] Generating: Gatling Gun (item)
============================================================
🎨 Generating raw item: Gatling Gun
🎨 Generating with google/nano-banana...
📸 Using 5 reference images from R2
⬇️  Downloading image from Replicate...
✅ Image saved to: scripts/output/raw/items/gatling_gun-1760997368569.png
💰 Cost: Variable (Replicate per-second billing)

[2/101] Generating: Sword (item)
...
```

## Cost & Performance

### Cost Estimates

- **Per Image:** ~$0.002-0.01 (Replicate per-second billing)
- **Single Test (6 images):** ~$0.01-0.06
- **Full Batch (101 images):** ~$0.20-1.00
- **No AI Description Cost:** Saves ~$0.0001-0.0005 per item (no OpenAI API calls)

### Performance

- **Single Generation:** ~5-15 seconds per image
- **Full Batch (101 images):** ~8-25 minutes (sequential processing)
- **Network Dependent:** Download times vary based on connection speed

### Optimization Tips

1. **Batch mode** - More efficient than individual commands
2. **Format selection** - JPG files are smaller but PNG preserves quality
3. **Sequential processing** - Avoids rate limiting, ensures reliability

## Testing

### Test Coverage

The pipeline was tested with representative samples:

**Items:**
- Fuzzy Slippers (common footwear)
- Mood Ring (accessory with unique properties)
- Gatling Gun (weapon with complex geometry)

**Materials:**
- Coffee (common material)
- Matcha Powder (uncommon material)
- Rainbow (rare material with abstract concept)

### Test Results

All 6 test generations completed successfully:
- ✅ Correct output paths
- ✅ Valid PNG files (~1.4-1.7MB each)
- ✅ Proper naming conventions
- ✅ R2 reference images applied
- ✅ Progress tracking functional

### Running Tests

```bash
# Test single generation
cd scripts
pnpm generate-raw-image "Test Item" --type item

# Test batch generation (small subset)
# Manually edit seed data files to include only test items, then:
pnpm generate-raw-image --batch items
```

## Troubleshooting

### Common Issues

**Authentication Error:**
```
Error: REPLICATE_API_TOKEN not found in .env.local
```
**Solution:** Add `REPLICATE_API_TOKEN` to `.env.local` file

**Invalid Type:**
```
❌ Invalid type. Choose: item or material
```
**Solution:** Use `--type item` or `--type material`

**Batch Mode with Custom Output:**
```
❌ Custom output path (-o) cannot be used with batch mode
```
**Solution:** Remove `-o` flag when using `--batch`

**Network Timeout:**
```
Failed to download image: timeout
```
**Solution:** Increase timeout in code or retry the generation

### Debug Commands

```bash
# Verify environment variables
cat .env.local | grep REPLICATE_API_TOKEN

# Check output directories (from scripts/ directory)
ls -R output/raw/

# View generated image (from scripts/ directory)
open output/raw/items/fuzzy_slippers-*.png

# Or from project root
ls -R scripts/output/raw/
open scripts/output/raw/items/fuzzy_slippers-*.png

# Check Replicate API status
curl -H "Authorization: Token $REPLICATE_API_TOKEN" \
  https://api.replicate.com/v1/models/google/nano-banana
```

## Comparison: Raw vs Fusion Pipeline

| Feature | Raw Pipeline | Fusion Pipeline |
|---------|-------------|----------------|
| **Purpose** | Generate standalone assets | Combine materials with items |
| **Input** | Item/material name only | Item type + 1-3 materials |
| **AI Description** | ❌ None | ✅ GPT-4.1-mini generates name + description |
| **Prompt Focus** | Single object rendering | Material fusion and integration |
| **Provider** | Gemini only | Gemini or Seedream-4 |
| **Aspect Ratio** | 1:1 only | Configurable (1:1, 2:3, etc.) |
| **Reference Images** | 5 R2 images (hardcoded) | 5 R2 images (configurable) |
| **Batch Mode** | ✅ Built-in | ❌ Not available |
| **Use Case** | Base asset library | Crafted item variations |

## Workflow Integration

### Typical Workflow

1. **Generate Raw Assets** (this pipeline)
   ```bash
   pnpm generate-raw-image --batch all
   ```

2. **Review Generated Assets**
   - Check quality and consistency
   - Identify any failed generations
   - Select best candidates for base library

3. **Generate Fusion Variations** (fusion pipeline)
   ```bash
   pnpm generate-image --type "Sword" --materials "rainbow,lightning"
   ```

4. **Compare Results**
   - Raw sword vs rainbow-lightning fusion sword
   - Evaluate material integration quality
   - Decide on final assets for game

## Future Enhancements

### Potential Improvements

1. **Parallel Generation** - Process multiple images concurrently
2. **Retry Logic** - Automatic retry on failure with exponential backoff
3. **Quality Scoring** - AI-based quality assessment of generated images
4. **Variation Generation** - Generate multiple variations per item/material
5. **Custom Reference Sets** - Allow different reference images per type
6. **Progress Persistence** - Resume interrupted batch generations
7. **Output Optimization** - Automatic image compression and format conversion
8. **Metadata Embedding** - Embed generation parameters in image EXIF data

### Planned Features

- [ ] Integration with asset management system
- [ ] Automated upload to game CDN
- [ ] Version control for generated assets
- [ ] Comparison tools for before/after fusion
- [ ] Batch regeneration for specific quality issues

## Related Documentation

- [AI Image Generation Workflow](./ai-image-generation-workflow.md) - Complete workflow with fusion examples
- [R2 Image Hosting](./external/r2-image-hosting.md) - Reference image setup and management
- [Seed Data Items](./seed-data-items.json) - Item definitions and stats
- [Seed Data Materials](./seed-data-materials.json) - Material definitions and modifiers
- `scripts/generate-image.ts` - Fusion image generation pipeline
- `scripts/generate-item-description.ts` - AI description generation

## Support & Feedback

For issues or questions about the raw image generation pipeline:

1. Check this documentation first
2. Review error messages carefully
3. Verify environment variables are set correctly
4. Test with single generation before batch mode
5. Check Replicate API status and quotas

## Version History

- **v1.0.0** (2025-10-20) - Initial release
  - Single and batch generation modes
  - Hardcoded Gemini provider with R2 references
  - Full seed data support (101 items + materials)
  - Comprehensive CLI interface
  - Detailed style prompt matching fusion pipeline
