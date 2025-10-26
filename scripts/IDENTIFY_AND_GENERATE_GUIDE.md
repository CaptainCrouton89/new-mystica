# Identify & Generate from Image Guide

## Overview

The `identify-and-generate-from-image.ts` script provides an AI-powered pipeline to:

1. **Analyze** an uploaded image using GPT-4.1 vision capabilities
2. **Identify** what item or material it represents
3. **Classify** as either "item" (equipment, weapons, pets) or "material" (resources, essences)
4. **Extract** a game-ready description and metadata
5. **Generate** a corresponding game asset using the original image as reference

This creates a complete workflow: Real Image → Identified Item/Material → Game Asset.

## Quick Start

```bash
# Basic identification and generation (local output only)
cd scripts
pnpm identify-and-generate --image-url "https://r2-url/uploaded-image.png"

# With R2 upload
pnpm identify-and-generate --image-url "https://r2-url/uploaded-image.png" --upload

# With background removal
pnpm identify-and-generate --image-url "https://r2-url/uploaded-image.png" --upload --remove-background

# From local file
pnpm identify-and-generate --image-path "./my-item.png" --upload
```

## How It Works

### Phase 1: Image Identification

The script uses `gpt-4.1` with vision capabilities to analyze the image:

```
Input:  Real-world or fantastical image
        ↓
Analysis: What is this object? Item or material?
        ↓
Output: {
  "name": "Sword",
  "type": "item",
  "description": "a silver broadsword with a gem-studded crescent hilt",
  "confidence": "high",
  "reasoning": "Classic medieval weapon with distinctive hilt design"
}
```

**Classification Rules:**
- **ITEM**: Equipment, weapons, armor, accessories, pets, tools
  - Examples: Sword, Dragon, Leather Jacket, Umbrella, Robot
- **MATERIAL**: Crafting resources, elemental essences, substances
  - Examples: Coffee, Slime, Diamond, Flame, Lightning

The system prompt includes examples from your game's seed data to improve classification accuracy.

### Phase 2: Reference Image Selection

The script uses a smart reference image strategy:

1. **Primary Reference**: The original uploaded image (what item looks like)
2. **Style Guides**: 3 additional reference images for visual style consistency

Example:
```
Original Image: https://r2.dev/uploads/mystery-item.png
  ↓
Style Reference 1: https://r2.dev/ref-images/style-1.png (chibi aesthetic)
Style Reference 2: https://r2.dev/ref-images/style-2.png (bold outlines)
Style Reference 3: https://r2.dev/ref-images/style-3.png (high-saturation)
```

This approach ensures:
- The generated asset matches the original item visually
- The style remains consistent with your game's look
- No duplication (original is primary reference)

### Phase 3: Asset Generation

The script delegates to `generate-raw-image.ts` with:
- Identified name and description
- Original image + 3 style guides as references
- Same quality prompts and settings

Output: A chibi-style game asset ready for in-game use.

### Phase 4: Storage & Metadata

**Local Output:**
```
output/
├── identifications/
│   └── identification-{timestamp}.json     # Identification metadata
└── raw/
    ├── items/
    │   └── {name}-{timestamp}.png          # Generated item asset
    └── materials/
        └── {name}-{timestamp}.png          # Generated material asset
```

**Optional R2 Upload:**
```
R2 Bucket (mystica-assets):
├── items/
│   ├── sword.png                           # Final item asset
│   └── no-background/
│       └── sword.png                       # (if --remove-background)
└── materials/
    ├── coffee.png                          # Final material asset
    └── no-background/
        └── coffee.png                      # (if --remove-background)
```

**Identification Metadata** (saved locally):
```json
{
  "identification": {
    "name": "Sword",
    "type": "item",
    "description": "a silver broadsword with a gem-studded crescent hilt",
    "confidence": "high",
    "reasoning": "Classic medieval weapon with distinctive hilt design"
  },
  "imageUrl": "https://r2-url/uploaded-image.png",
  "timestamp": 1698765432123
}
```

## Command Reference

### Basic Syntax

```bash
pnpm identify-and-generate [--image-url URL | --image-path PATH] [options]
```

### Image Input Options

```bash
# Public image URL (R2, Cloudflare CDN, etc.)
pnpm identify-and-generate --image-url "https://pub-xxx.r2.dev/uploads/item.png"

# Short form
pnpm identify-and-generate -u "https://..."

# Local file (auto-converted to base64 data URL)
pnpm identify-and-generate --image-path "./my-item.png"

# Short form
pnpm identify-and-generate -p "./my-item.png"
```

### Generation Options

```bash
# Upload to R2 after generation
pnpm identify-and-generate --image-url "..." --upload

# Remove background (requires --upload)
pnpm identify-and-generate --image-url "..." --upload --remove-background

# Specify output format (jpg or png, default: png)
pnpm identify-and-generate --image-url "..." -f jpg

# Combine options
pnpm identify-and-generate --image-url "..." --upload --remove-background -f png
```

## Environment Variables

**Required:**
```bash
OPENAI_API_KEY                    # For image identification (gpt-4.1)
REPLICATE_API_TOKEN               # For asset generation
REPLICATE_MODEL                   # Generation model (default: google/nano-banana)
REFERENCE_IMAGE_URLS              # Style guides (comma-separated)
```

**For R2 Upload (--upload flag):**
```bash
CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME                    # Default: mystica-assets
R2_PUBLIC_URL                     # Default: https://pub-xxx.r2.dev
```

Configure in `.env.local` at project root:
```bash
# .env.local
OPENAI_API_KEY=sk-...
REPLICATE_API_TOKEN=r8_...
REPLICATE_MODEL=google/nano-banana
REFERENCE_IMAGE_URLS=https://r2.dev/ref1.png,https://r2.dev/ref2.png,...

CLOUDFLARE_ACCOUNT_ID=abc123
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

## Usage Examples

### Example 1: Identify a Real Photo

Upload a photo of a real-world object and generate a chibi-style game asset:

```bash
# Upload photo to R2 first (e.g., via wrangler)
wrangler r2 object put mystica-assets photo-cup.png --file ./cup.jpg

# Identify and generate
pnpm identify-and-generate \
  --image-url "https://pub-xxx.r2.dev/photo-cup.png" \
  --upload

# Output:
# ✅ Identification:
#   Name: Coffee Mug
#   Type: material
#   Confidence: high
#
# 🎨 Generating asset for: Coffee Mug
#    Type: material
#
# ✅ Image saved to: output/raw/materials/coffee_mug-1698765432123.png
# 🌐 R2 URL: https://pub-xxx.r2.dev/materials/coffee_mug.png
```

### Example 2: Pop Culture Reference

Identify and generate assets for character/brand references:

```bash
# Hello Kitty figure
pnpm identify-and-generate \
  --image-url "https://r2.dev/hello-kitty.png" \
  --upload --remove-background

# Output identifies as:
# Name: Hello Kitty
# Type: item
# Description: white cat character with round head, black dot eyes, yellow nose, and red bow
#
# Generated with original image as reference + style guides
```

### Example 3: Batch Processing Uploads

Manual approach to identify multiple uploads:

```bash
# Item 1
pnpm identify-and-generate --image-url "https://r2.dev/upload1.png" --upload

# Item 2
pnpm identify-and-generate --image-url "https://r2.dev/upload2.png" --upload

# Item 3
pnpm identify-and-generate --image-url "https://r2.dev/upload3.png" --upload

# All identifications saved to output/identifications/
# All assets generated to output/raw/ and R2
```

### Example 4: Local File Processing

Process images already on your machine:

```bash
# Single local file
pnpm identify-and-generate --image-path "./sword.png" --upload

# From current directory
pnpm identify-and-generate -p "coffee.png" --upload --remove-background

# Absolute path
pnpm identify-and-generate -p "/Users/silasrhyneer/items/armor.png" --upload
```

## Identification Confidence Levels

The identification includes a confidence score:

| Confidence | Interpretation | Action |
|-----------|---|---|
| **high** | Clear, unambiguous item/material | Safe to use generated asset directly |
| **medium** | Recognizable but could be interpreted multiple ways | Review metadata, consider regenerating with custom description |
| **low** | Ambiguous or unclear image | Manual review recommended; consider providing custom description |

Check the `output/identifications/` JSON files to review confidence scores and reasoning.

## Customization

### Override Identification

If the automatic identification isn't accurate, edit the identification JSON and manually re-run generation:

```bash
# Edit output/identifications/identification-{timestamp}.json
# Change "name" and "description" fields
# Then manually run:
pnpm generate-raw-image "Custom Name" --type item --upload
```

### Custom Style References

The script automatically selects 3 style guides from your `REFERENCE_IMAGE_URLS`. To customize:

1. Update `REFERENCE_IMAGE_URLS` in `.env.local`
2. Re-run identification (it picks 3 random references each time)

Example:
```bash
# .env.local - 6 style guides for diversity
REFERENCE_IMAGE_URLS=https://r2.dev/style1.png,https://r2.dev/style2.png,https://r2.dev/style3.png,https://r2.dev/style4.png,https://r2.dev/style5.png,https://r2.dev/style6.png
```

## Troubleshooting

### "Missing required environment variables"

**Problem:** Script exits immediately with missing vars.

**Solution:** Verify `.env.local` has all required variables:
```bash
# At project root, check:
grep OPENAI_API_KEY .env.local
grep REPLICATE_API_TOKEN .env.local
grep REFERENCE_IMAGE_URLS .env.local
```

### "File not found: /path/to/image.png"

**Problem:** Using `--image-path` with non-existent file.

**Solution:** Use absolute path or ensure file exists:
```bash
# Absolute path
pnpm identify-and-generate -p "/Users/silasrhyneer/items/sword.png"

# Or from scripts/ directory
pnpm identify-and-generate -p "../my-item.png"
```

### "No image URL returned from Replicate"

**Problem:** Generation failed, likely model timeout or API issue.

**Solution:**
1. Check `REPLICATE_API_TOKEN` is valid
2. Verify `REPLICATE_MODEL` is available
3. Try again (transient Replicate issue)
4. Check network connectivity

### Low Confidence Identification

**Problem:** Script identifies item as "low" confidence.

**Solution:** Either accept and regenerate with custom description, or use local tools to enhance image quality before re-uploading.

## Cost Estimates

- **Identification** (~$0.01 per image): gpt-4.1 vision analysis
- **Asset Generation** (~$0.003-0.01): Replicate image generation
- **Background Removal** (~$0.002-0.01): Bria background remover
- **Total per complete workflow**: ~$0.015-0.02 per item

For batch processing 100 items: ~$1.50-2.00 total cost.

## Advanced: Integration with Backend

To automate identification on image upload:

1. User uploads image to R2 via frontend
2. Backend receives upload notification
3. Backend calls this script via Node.js:

```typescript
import { identifyAndGenerate } from './identify-and-generate-from-image.js';

// In Express route handler
const r2Url = 'https://pub-xxx.r2.dev/uploads/user-image.png';
await identifyAndGenerate({
  imageUrl: r2Url,
  uploadToR2: true,
  removeBackground: true
});
```

Then save the identification metadata to your database for inventory management.

## API Reference

### `identifyFromImage(imageUrl, seedData)`

Analyzes an image and returns identification details.

```typescript
const identification = await identifyFromImage(
  'https://r2.dev/image.png',
  { items: [...], materials: [...] }
);

// Returns:
{
  name: string;
  type: 'item' | 'material';
  description: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}
```

### `selectStyleReferences(uploadedImageUrl)`

Selects 3 style reference images from configured pool.

```typescript
const references = selectStyleReferences('https://r2.dev/original.png');
// Returns: [original, style1, style2, style3]
```

### `identifyAndGenerate(options)`

Main pipeline: identify → save metadata → generate asset.

```typescript
await identifyAndGenerate({
  imageUrl: string;           // R2 URL or data URL
  uploadToR2?: boolean;        // Upload result to R2
  removeBackground?: boolean;  // Remove BG (requires upload)
  outputFormat?: 'jpg' | 'png';
});
```

## FAQ

**Q: Can I use the original image's style directly?**
A: Yes! The original image is the primary reference. The 3 additional style guides provide secondary visual guidance without duplicating the main reference.

**Q: What if the model classifies my item incorrectly?**
A: Check the identification JSON in `output/identifications/`. If confidence is medium/low, you can manually override and regenerate using `generate-raw-image.ts`.

**Q: Can I batch process multiple images?**
A: Yes, though currently manual. You can write a shell script or Node.js loop to call this script multiple times with different image URLs.

**Q: How is this different from `generate-raw-image.ts`?**
A: This script adds vision-based identification and automatic description extraction. `generate-raw-image.ts` requires manual name/description input. This bridges that gap by analyzing real images.

**Q: Can I regenerate an asset with different references?**
A: Yes. The original image is always the primary reference. If you want different style guides, edit `REFERENCE_IMAGE_URLS` and re-run.

---

**Last Updated:** 2024
**Maintenance:** Update this guide when script changes significantly or new features are added.
