# AI Image Generation Workflow

**Created:** 2025-10-20
**Purpose:** Document the complete workflow for generating item images using Gemini with R2-hosted reference images

## Overview

This workflow generates AI images for Mystica items using:
- **Gemini (Nano Banana)** model via Replicate
- **R2-hosted reference images** for style consistency
- **OpenAI GPT-4.1-mini** for item name/description generation

## Prerequisites

1. **R2 Bucket Setup**
   ```bash
   # Upload reference images
   for file in docs/image-refs/IMG_*.png; do
     filename=$(basename "$file")
     wrangler r2 object put "mystica-assets/image-refs/$filename" --file="$file" --remote
   done

   # Enable public access
   wrangler r2 bucket dev-url enable mystica-assets -y
   ```

2. **Environment Variables**
   ```bash
   REPLICATE_API_TOKEN=your_token
   OPENAI_API_KEY=your_key
   ```

## R2 Reference Images

**Public URL Base:** `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/`

**Available References:**
- `image-refs/IMG_0821.png`
- `image-refs/IMG_2791.png`
- `image-refs/IMG_4317.png`
- `image-refs/IMG_5508.png`
- `image-refs/IMG_9455.png`

## Command Template

```bash
npx tsx scripts/generate-image.ts \
  --type "ITEM_TYPE" \
  --materials "material1,material2,material3" \
  --provider gemini \
  -r "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_0821.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_2791.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_4317.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_5508.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_9455.png"
```

## Example Generations (2025-10-20)

### 1. Gatling Gun (cocaine, lava, plasma)
```bash
npx tsx scripts/generate-image.ts \
  --type "Gatling Gun" \
  --materials "cocaine,lava,plasma" \
  --provider gemini \
  -r "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_0821.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_2791.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_4317.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_5508.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_9455.png"
```
**Generated:** "Molten Vaporizer"
**Output:** `scripts/output/gemini-1760996612122.png`

### 2. Umbrella (bubble, slime)
```bash
npx tsx scripts/generate-image.ts \
  --type "Umbrella" \
  --materials "bubble,slime" \
  --provider gemini \
  -r "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_0821.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_2791.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_4317.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_5508.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_9455.png"
```
**Generated:** "Slimebub Umbrella"
**Output:** `scripts/output/gemini-1760996641535.png`

### 3. Bicycle Helmet (rainbow, ghost, void)
```bash
npx tsx scripts/generate-image.ts \
  --type "Bicycle Helmet" \
  --materials "rainbow,ghost,void" \
  --provider gemini \
  -r "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_0821.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_2791.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_4317.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_5508.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_9455.png"
```
**Generated:** "Spectral Voidshade Helmet"
**Output:** `scripts/output/gemini-1760996699786.png`

### 4. Fuzzy Slippers (lube, glitter)
```bash
npx tsx scripts/generate-image.ts \
  --type "Fuzzy Slippers" \
  --materials "lube,glitter" \
  --provider gemini \
  -r "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_0821.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_2791.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_4317.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_5508.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_9455.png"
```
**Generated:** "Glitterglide Slippers"
**Output:** `scripts/output/gemini-1760996732869.png`

### 5. Poop Emoji (cocaine, neon)
```bash
npx tsx scripts/generate-image.ts \
  --type "Poop Emoji" \
  --materials "cocaine,neon" \
  --provider gemini \
  -r "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_0821.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_2791.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_4317.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_5508.png,https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_9455.png"
```
**Generated:** "Neon Spike Turd"
**Output:** `scripts/output/gemini-1760996768113.png`

## Key Findings

1. **All 5 reference images must be included** in comma-separated URLs
2. **Use `--provider gemini`** to specify Nano Banana model
3. **Materials are flexible** - can use 1-3 from seed data
4. **AI generates creative names** based on item type + materials
5. **Output saved to** `scripts/output/gemini-{timestamp}.png`

## Material Sources

- **Common:** coffee, gum, feather, button, candle, pizza, etc.
- **Uncommon:** matcha_powder, bubble, slime, propeller, magnet
- **Rare:** rainbow, lava, ghost, shadow, goo, cocaine, lube, void
- **Epic:** diamond, lightning, laser_beam, stardust, plasma

See `docs/seed-data-materials.json` for complete list with stat modifiers.

## Workflow Steps

1. **Select item type** from `docs/seed-data-items.json`
2. **Choose 1-3 materials** from `docs/seed-data-materials.json`
3. **Run generation command** with all 5 R2 reference URLs
4. **Review output** in `scripts/output/`
5. **Optionally refine** by adjusting materials or aspect ratio

## Advanced Options

```bash
# Custom aspect ratio
--aspect-ratio "2:3"

# JPG output instead of PNG
--format jpg

# Custom output path
-o "custom/path/image.png"
```

## Cost Notes

- **Gemini generation:** Variable (Replicate per-second billing)
- **AI description:** ~$0.0001-0.0005 per generation (GPT-4.1-mini)
- **R2 storage:** $0.015/GB/month
- **R2 reads:** $0.36 per million (Class B operations)
- **R2 egress:** FREE (no bandwidth charges)

## Related Files

- `scripts/generate-image.ts` - Main generation script
- `scripts/generate-item-description.ts` - AI description generator
- `docs/seed-data-items.json` - Item base stats
- `docs/seed-data-materials.json` - Material modifiers
- `docs/external/r2-image-hosting.md` - R2 setup documentation
