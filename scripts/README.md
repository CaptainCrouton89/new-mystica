# Mystica Scripts

TypeScript utilities for Mystica project automation.

## Setup

```bash
cd scripts
pnpm install
```

## Image Generation

Generate AI images using multiple providers: Gemini, Imagen 3, or Imagen 4 Fast.

### Quick Start

```bash
# Generate with Gemini (default) - "Nano Banana"
pnpm generate-image "A serene mountain landscape at sunset"

# Generate with Imagen 4 Fast (10x faster)
pnpm generate-image "A futuristic city" -p imagen-4-fast

# Compare all providers (parallel generation)
pnpm generate-image "A magical forest" --all
```

### Providers

| Provider | Model | Best For | Speed | Cost |
|----------|-------|----------|-------|------|
| `gemini` | Gemini 2.5 Flash (Nano Banana) | Editing, character consistency | Standard | ~$0.039/image |
| `imagen-3` | Google Imagen 3 | High quality, photorealism | Standard | Variable |
| `imagen-4-fast` | Google Imagen 4 Fast | Speed, cost optimization | 10x faster | Optimized |

### Options

```bash
pnpm generate-image "prompt" [options]

  -p, --provider PROVIDER   Single provider: gemini, imagen-3, imagen-4-fast (default: gemini)
  --providers PROVIDER,...  Multiple providers (comma-separated, runs in parallel)
  --all                     Use all providers (gemini, imagen-3, imagen-4-fast)
  -o, --output PATH         Output file path (single provider only)
  -i, --input PATH          Input image for editing mode (Gemini only, single provider)
  -a, --aspect-ratio RATIO  Aspect ratio: 1:1, 2:3, 3:2, 4:3, 9:16, 16:9
  -f, --format FORMAT       Output format: jpg, png (default: png)
  -h, --help                Show help message
```

### Examples

**Basic Generation**
```bash
# With default provider (Gemini)
pnpm generate-image "A magical forest with glowing mushrooms"

# With specific provider
pnpm generate-image "A cyberpunk street scene" -p imagen-4-fast
```

**Multi-Provider Comparison** 🆕
```bash
# Generate with all providers (runs in parallel)
pnpm generate-image "A fantasy castle" --all

# Generate with specific providers
pnpm generate-image "A portrait" --providers gemini,imagen-3

# Compare Imagen models
pnpm generate-image "A landscape" --providers imagen-3,imagen-4-fast -a 16:9
```

**Aspect Ratios**
```bash
# Portrait mode
pnpm generate-image "A professional headshot" -p imagen-3 -a 2:3

# Cinematic widescreen
pnpm generate-image "An epic landscape" -p imagen-3 -a 16:9

# Instagram post
pnpm generate-image "A product photo" -a 1:1
```

**Image Editing (Gemini Only)**
```bash
# Edit existing image
pnpm generate-image "Add a rainbow in the sky" -i input.jpg -o edited.png

# Multiple edits in sequence
pnpm generate-image "Make it more vibrant" -i photo.jpg
pnpm generate-image "Add sunset lighting" -i output.png
```

**Custom Output**
```bash
# Specify output path (single provider only)
pnpm generate-image "A logo design" -o ./assets/logo.png

# JPEG format for smaller files
pnpm generate-image "A background image" -f jpg -o bg.jpg
```

### Features by Provider

#### Gemini 2.5 Flash (Nano Banana)
- ✅ Text-to-Image generation
- ✅ Image editing with text instructions
- ✅ Character consistency across generations
- ✅ Multi-turn conversational refinement
- ⚠️ All images include visible SynthID watermarks
- 💰 Fixed cost: ~$0.039 per image (1290 tokens @ $30/1M)

#### Imagen 3
- ✅ High-quality photorealistic images
- ✅ Enhanced detail, lighting, and textures
- ✅ Improved prompt understanding
- ✅ Multiple aspect ratios
- 💰 Variable cost (Replicate per-second billing)

#### Imagen 4 Fast
- ✅ Ultra-fast generation (10x faster than Imagen 3)
- ✅ Cost-optimized (CPU-based)
- ✅ Multiple aspect ratios
- ✅ Good quality with speed tradeoff
- 💰 Variable cost (optimized for speed/cost)

### Environment Variables

**Required in `.env.local`** (project root):

```bash
# For Gemini provider
GOOGLE_API_KEY=your_key_here          # Get from https://aistudio.google.com

# For Imagen providers (via Replicate)
REPLICATE_API_TOKEN=your_token_here   # Get from https://replicate.com
```

### Cost Comparison

| Provider | Cost Model | Estimated Cost | Notes |
|----------|------------|----------------|-------|
| Gemini | Per token | $0.039/image | Fixed 1290 tokens/image |
| Imagen 3 | Per second | Variable | Higher quality, longer generation |
| Imagen 4 Fast | Per second (CPU) | Variable | Optimized for cost/speed |

### Output

Images are saved to `scripts/output/` by default with naming format:
```
{provider}-{timestamp}.{format}
```

Examples:
- `gemini-1704067200000.png`
- `imagen-4-fast-1704067300000.jpg`

### Use Cases

**Gemini 2.5 Flash**
- Iterative design refinement
- Character-consistent series
- Multi-turn conversational editing
- Quick prototypes

**Imagen 3**
- Marketing materials
- High-quality assets
- Photorealistic renders
- Print-ready artwork

**Imagen 4 Fast**
- Rapid prototyping
- Batch generation
- Cost-sensitive projects
- Preview/draft generation

**Multi-Provider Mode** 🆕
- A/B testing prompts across models
- Quality comparison for client presentations
- Finding best model for specific style
- Parallel generation for time efficiency

### Limitations

**Gemini**
- Maximum 3 input images per request
- All outputs have visible watermarks
- Image editing only (not available on other providers)

**Imagen (Replicate)**
- No image editing support
- Async generation (polling required, handled automatically)
- Variable pricing based on generation time

**Multi-Provider Mode**
- Cannot use custom output path (`-o`) with multiple providers
- Image editing (`-i`) only works with single Gemini provider
- Each provider generates separate file with timestamp naming

### Documentation

- **Gemini API**: `docs/external/gemini-image-generation.md`
- **Replicate API**: `docs/external/replicate.md`
- **Gemini AI Studio**: https://aistudio.google.com
- **Replicate Models**: https://replicate.com/explore

### Troubleshooting

**Missing API Key**
```bash
Error: GOOGLE_API_KEY not found in .env.local
```
→ Add `GOOGLE_API_KEY` to `.env.local` in project root

**Missing Replicate Token**
```bash
Error: REPLICATE_API_TOKEN not found in .env.local
```
→ Add `REPLICATE_API_TOKEN` to `.env.local` in project root

**Invalid Provider**
```bash
Invalid provider. Choose: gemini, imagen-3, or imagen-4-fast
```
→ Use `-p` with valid provider name

**Image Editing Not Supported**
```bash
Image editing (-i) is only supported with Gemini provider
```
→ Remove `-i` flag or switch to `-p gemini`
