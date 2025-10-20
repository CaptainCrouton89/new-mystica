# Generate Item Image

Generate AI-powered item images for Mystica using Gemini with R2-hosted reference images.

## Quick Command

```bash
npx tsx scripts/generate-image.ts \
  --type "ITEM_TYPE" \
  --materials "material1,material2,material3" \
  --provider gemini \
  -r "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_0821.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_2791.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_4317.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_5508.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_9455.png"
```

## Parameters

- `--type` - Item base type (from `docs/seed-data-items.json`)
- `--materials` - Comma-separated material list (1-3 materials from `docs/seed-data-materials.json`)
- `--provider gemini` - Use Gemini (Nano Banana) model
- `-r` - All 5 R2 reference image URLs (comma-separated, required for style consistency)

## Optional Parameters

- `--aspect-ratio "2:3"` - Custom aspect ratio
- `--format jpg` - Output format (default: png)
- `-o "path/to/output.png"` - Custom output path

## Material Rarity

- **Common:** coffee, gum, feather, button, candle, pizza
- **Uncommon:** matcha_powder, bubble, slime, propeller, magnet
- **Rare:** rainbow, lava, ghost, shadow, goo, cocaine, lube, void
- **Epic:** diamond, lightning, laser_beam, stardust, plasma

See `docs/seed-data-materials.json` for complete list with stat modifiers.

## Output

Generated images saved to `scripts/output/gemini-{timestamp}.png` with:
- AI-generated item name (based on type + materials)
- Visual description metadata
- Consistent art style from reference images

## Examples

### Gatling Gun (cocaine, lava, plasma)
```bash
npx tsx scripts/generate-image.ts --type "Gatling Gun" --materials "cocaine,lava,plasma" --provider gemini -r "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_0821.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_2791.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_4317.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_5508.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_9455.png"
```
**Generated:** "Molten Vaporizer"

### Umbrella (bubble, slime)
```bash
npx tsx scripts/generate-image.ts --type "Umbrella" --materials "bubble,slime" --provider gemini -r "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_0821.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_2791.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_4317.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_5508.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_9455.png"
```
**Generated:** "Slimebub Umbrella"

## Prerequisites

### Environment Variables
```bash
REPLICATE_API_TOKEN=your_token
OPENAI_API_KEY=your_key
```

### R2 Setup (already configured)
- Bucket: `mystica-assets`
- Public URL: `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/`
- Reference images in `image-refs/` directory

## Related Documentation

- `docs/ai-image-generation-workflow.md` - Complete workflow with findings
- `docs/external/r2-image-hosting.md` - R2 setup and management
- `scripts/generate-image.ts` - Main generation script
- `scripts/generate-item-description.ts` - AI description generator
