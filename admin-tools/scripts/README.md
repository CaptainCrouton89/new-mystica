# Admin Image Generation Tools

Clean, streamlined scripts for generating item and material images with automatic R2 upload.

## Scripts

### `generate-item.ts`
Generate item images with AI description, background removal, and R2 upload to `items/{name}.png`.

```bash
# Auto-generated description
pnpm tsx admin-tools/scripts/generate-item.ts "Leather Jacket"

# Custom description
pnpm tsx admin-tools/scripts/generate-item.ts "Fuzzy Slippers" --desc "pink bunny slippers with pom-poms"
```

### `generate-material.ts`
Generate material images with AI description, background removal, and R2 upload to `materials/{name}.png`.

```bash
# Auto-generated description
pnpm tsx admin-tools/scripts/generate-material.ts "Diamond"

# Custom description
pnpm tsx admin-tools/scripts/generate-material.ts "Coffee" --desc "a pile of dark roasted coffee beans"
```

## Pipeline

Both scripts follow the same clean pipeline:

1. **Description** - AI-generated (GPT-4.1-mini) or custom
2. **Generation** - Gemini (Nano Banana) with style reference images
3. **Background Removal** - Bria background remover
4. **Cropping** - Sharp trim to remove transparent edges
5. **Upload** - Automatic upload to R2 at predictable path

## Output

- **Items**: `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items/{snake_case_name}.png`
- **Materials**: `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/materials/{snake_case_name}.png`

## Requirements

Environment variables in `.env.local`:
- `REPLICATE_API_TOKEN`
- `OPENAI_API_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

## Cost

~$0.005-0.015 per image:
- Gemini generation: ~$0.002-0.01
- Background removal: ~$0.002-0.004
- GPT-4.1-mini description: ~$0.0001-0.0005

Total time: ~20-30 seconds per image
