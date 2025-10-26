/**
 * Generate Arbitrary Images with No Background
 *
 * This script generates arbitrary images using Gemini (Nano Banana) with automatic background removal and cropping.
 * It uses the same reference images as generate-raw-image.ts for style consistency.
 * Unlike generate-raw-image.ts, this accepts arbitrary text prompts without AI description generation.
 * Images are automatically cropped to remove transparent edges.
 *
 * Usage:
 *   pnpm generate-arbitrary "a magical glowing orb"
 *   pnpm generate-arbitrary "cyberpunk samurai sword" --output custom-sword.png
 *   pnpm generate-arbitrary "gold coins" --r2 "assets/ui/coins.png"
 *
 * R2 Upload:
 *   Note: --r2 flag currently uploads to LOCAL R2 instance. For REMOTE upload, use wrangler directly:
 *   wrangler r2 object put mystica-assets/path/to/file.png --file ./output/arbitrary/filename.png --remote
 *
 * Automatic Processing:
 *   1. Generate image with Gemini (Nano Banana)
 *   2. Remove background (bria/remove-background)
 *   3. Auto-crop transparent edges (sharp trim)
 *   4. Save to output/arbitrary/ directory
 *   5. Optionally upload to R2
 */

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import Replicate from 'replicate';
import sharp from 'sharp';

// Load environment variables from .env.local
dotenv.config({ path: '../.env.local', override: true });

// Hardcoded configuration
const CONFIG = {
  aspectRatio: '1:1' as const,
  provider: 'gemini' as const,
  model: 'google/nano-banana',
  defaultReferenceImages: [
<<<<<<< HEAD
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/bubble-wrap-vest.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/fuzzy-slippers.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/gatling-gun.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/jar-of-jelly.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/poop-emoji.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/lava.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/metal-scraps.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/rainbow.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/slime.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/sword.png'
  ],
  // Cuphead-style reference images (1930s rubber hose animation style)
  cupheadReferenceImages: [
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/monsters/07ba5f91-662d-4820-8a99-eee4c301f2ca/base.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/monsters/ad4f9aa2-5938-40cc-949c-8b6263fa1444/base.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/monsters/b6052188-9f6f-4e17-b19b-4fef529ffd36/base.png'
=======
    `${process.env.R2_PUBLIC_URL}/image-refs/bubble-wrap-vest.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/fuzzy-slippers.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/gatling-gun.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/jar-of-jelly.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/poop-emoji.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/lava.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/metal-scraps.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/rainbow.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/slime.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/sword.png`
>>>>>>> 136e52d7176c3457658f427cd8ca0991a9e5f814
  ]
};

const R2_CONFIG = {
  bucket: 'mystica-assets',
  publicUrl: process.env.R2_PUBLIC_URL,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
};

function createR2Client(): S3Client {
  const { accountId, accessKeyId, secretAccessKey } = R2_CONFIG;

  if (!accountId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID not found in .env.local');
  }

  if (!accessKeyId) {
    throw new Error('R2_ACCESS_KEY_ID not found in .env.local');
  }

  if (!secretAccessKey) {
    throw new Error('R2_SECRET_ACCESS_KEY not found in .env.local');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

interface GenerateArbitraryImageOptions {
  prompt: string;
  outputPath?: string;
  outputFormat?: 'jpg' | 'png';
  r2Path?: string;
  cupheadMode?: boolean;
}

function buildPrompt(description: string, cupheadMode: boolean = false): string {
  if (cupheadMode) {
    return buildCupheadPrompt(description);
  }
  
  return buildDefaultPrompt(description);
}

function buildCupheadPrompt(description: string): string {
  return `Create a single, center-framed 1:1 game asset in the distinctive 1930s rubber hose animation style:

"${description}"

This illustration must capture the authentic Cuphead aesthetic with vintage Disney cartoon characteristics.

Core Look (1930s Rubber Hose Style)
    •    Color: Vintage color palette with muted, sepia-tinted tones; warm yellows, oranges, and browns. Avoid modern neon colors.
    •    Lighting: Soft, diffused lighting with gentle shadows. No harsh contrasts or modern lighting effects.
    •    Glow & Highlights: NO outer glow or modern effects. Use subtle highlights only where natural light would hit.
    •    Border: Thick, bold black outlines around ALL elements—this is the defining characteristic of rubber hose animation.

Line & Form (Rubber Hose Animation)
    •    Outlines: Thick, uniform black lines (3-5px thick) around EVERY element. No thin lines or sketchy linework.
    •    Proportions: Classic cartoon proportions—large heads, small bodies, exaggerated features. Think Mickey Mouse or Betty Boop.
    •    Texture: Minimal texture detail. Focus on clean, simple shapes with smooth surfaces.
    •    Simplicity: Keep designs simple and iconic. Avoid complex details or modern elements.

Shading & Depth (Cel Animation Style)
    •    Render Style: Pure cel shading with flat colors and sharp shadow transitions. NO gradients or soft shading.
    •    Volume: Simple 2D appearance with minimal depth. Use basic shadow shapes for volume indication.
    •    Shadows: Simple, geometric shadow shapes in darker versions of base colors.

Composition & Background (Vintage Cartoon)
    •    Framing: Single hero object, perfectly centered and clearly visible at optimal scale.
    •    Background: Simple solid color background in vintage tones (cream, light yellow, or soft brown). NO patterns or textures.
    •    Sparkles/Particles: NO modern particle effects. If sparkles are needed, use simple star shapes in vintage colors.
    •    Shadow: Simple geometric shadow beneath object in darker tone of background color.
    •    Restrictions: NO modern elements, NO gradients, NO complex lighting, NO realistic textures, NO environmental backgrounds, NO text, NO watermarks, NO logos.

Style References: Think Cuphead, early Disney cartoons (1920s-1930s), Fleischer Studios, rubber hose animation era.`;
}

function buildDefaultPrompt(description: string): string {
  return `Create a single, center-framed 1:1 game asset:

"${description}"

This illustration in a polished, high-detail "chibi"/super-deformed aesthetic typical of mobile RPGs and CCGs.

Core Look
    •    Color: Vivid, high-saturation palette; punchy local colors with clean hue separation. Keep values readable; avoid muddy midtones.
    •    Lighting: Clear, consistent key light with crisp fill; controlled shadows for depth. Add a strong rim light to separate from the background.
    •    Glow & Highlights: MINIMAL outer glow/halo (very subtle and sparse). Use tight, glossy specular highlights on hard materials; soft bloom on emissive parts only where essential.
    •    Border: Bold black outline ONLY around the object itself—NOT around the image edge. This outline defines the subject's silhouette for strong separation.

Line & Form
    •    Outlines: Bold, uniform black border carving a strong silhouette around the SUBJECT ONLY; no sketchy linework. No frame or border around the image edge.
    •    Proportions: Chunky, simplified, and slightly exaggerated shapes for instant readability and strong silhouette.
    •    Texture: Suggestive, not photoreal—hint at materials (wood grain, brushed metal, facets) with tidy, deliberate marks. Avoid excessive texture detail.
    •    Simplicity: Keep the object itself straightforward—no unnecessary gems, ornaments, extra decorative elements, or overly complex details. Stylized over realistic.

Shading & Depth
    •    Render Style: Hybrid cel + soft gradients; sharp edge transitions only where they improve clarity.
    •    Volume: Strong sense of 3D mass via light, occlusion, and controlled contrast; default to a subtle 3/4 view for maximum silhouette clarity.

Composition & Background
    •    Framing: Single hero object, perfectly centered and clearly visible at optimal scale; crop to emphasize strong silhouette.
    •    Background: SIMPLE solid color OR clean radial/linear gradient ONLY. Choose complementary colors that make the object pop. NO patterns, NO scenes, NO textures, NO environmental elements.
    •    Sparkles/Particles: MINIMAL and SPARSE—if used at all, keep to 3-5 small white sparkles maximum. Avoid heavy particle effects.
    •    Shadow: Soft contact shadow directly beneath object only (no complex shadow effects).
    •    Border: Bold black outline around SUBJECT ONLY—absolutely NO border or frame around the image edge itself.
    •    Restrictions: NO environmental backgrounds, NO busy backgrounds, NO props, NO decorative frames, NO black borders around image edge, NO text, NO watermarks, NO logos, NO excessive glow effects.`;
}

async function generateImageWithReplicate(options: GenerateArbitraryImageOptions): Promise<string> {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN not found in .env.local');
  }

  const replicate = new Replicate({ auth: apiToken });

  const prompt = buildPrompt(options.prompt, options.cupheadMode);
  
  // Choose reference images based on mode
  const referenceImages = options.cupheadMode 
    ? CONFIG.cupheadReferenceImages 
    : CONFIG.defaultReferenceImages;
  
  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: CONFIG.aspectRatio,
    output_format: options.outputFormat || 'png',
    image_input: referenceImages
  };

  const modeText = options.cupheadMode ? 'Cuphead-style (1930s rubber hose)' : 'Default (chibi/super-deformed)';
  console.log(`🎨 Generating with ${CONFIG.model} in ${modeText} mode...`);
  console.log(`📸 Using ${referenceImages.length} reference images from R2`);
  console.log(`💬 Prompt: "${options.prompt}"`);

  // Run prediction
  const output = await replicate.run(CONFIG.model as `${string}/${string}`, { input }) as any;

  // Handle output - Nano Banana returns object with url() method
  let imageUrl: string;

  if (typeof output?.url === 'function') {
    imageUrl = output.url();
  } else {
    throw new Error('No image returned from Replicate');
  }

  if (!imageUrl) {
    throw new Error('No image URL returned from Replicate');
  }

  // Download image from URL
  console.log('⬇️  Downloading image from Replicate...');
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return buffer.toString('base64');
}

async function removeBackground(imageBase64: string): Promise<Buffer> {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN not found in .env.local');
  }

  const replicate = new Replicate({ auth: apiToken });

  console.log('🔪 Removing background...');

  // Create data URL from base64
  const dataUrl = `data:image/png;base64,${imageBase64}`;

  const input = {
    image: dataUrl,
  };

  const output = await replicate.run('bria/remove-background' as `${string}/${string}`, { input }) as any;

  // Handle different output formats
  let processedImageUrl: string;

  if (typeof output === 'string') {
    processedImageUrl = output;
  } else if (typeof output?.url === 'function') {
    processedImageUrl = output.url();
  } else if (output && typeof output === 'object' && 'toString' in output) {
    processedImageUrl = output.toString();
  } else {
    console.error('Unexpected output:', JSON.stringify(output, null, 2));
    throw new Error(`Unexpected output format from background remover: ${typeof output}`);
  }

  if (!processedImageUrl) {
    throw new Error('No image URL returned from background remover');
  }

  console.log('⬇️  Downloading no-background image from Replicate...');
  const response = await fetch(processedImageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download no-background image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function cropTransparentEdges(imageBuffer: Buffer): Promise<Buffer> {
  console.log('✂️  Cropping transparent edges...');

  const metadata = await sharp(imageBuffer).metadata();
  console.log(`   Original size: ${metadata.width}x${metadata.height}`);

  // Use sharp's trim() to remove transparent edges
  const croppedBuffer = await sharp(imageBuffer)
    .trim()
    .toBuffer();

  const croppedMetadata = await sharp(croppedBuffer).metadata();
  console.log(`   Cropped size: ${croppedMetadata.width}x${croppedMetadata.height}`);

  return croppedBuffer;
}

async function uploadToR2(filePath: string, r2Key: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Local file not found: ${filePath}`);
  }

  const client = createR2Client();
  const fileBuffer = fs.readFileSync(filePath);

  console.log(`📤 Uploading to R2: ${r2Key}`);

  await client.send(new PutObjectCommand({
    Bucket: R2_CONFIG.bucket,
    Key: r2Key,
    Body: fileBuffer,
    ContentType: 'image/png',
  }));

  const publicUrl = `${R2_CONFIG.publicUrl}/${r2Key}`;
  console.log(`🌐 R2 URL: ${publicUrl}`);

  return publicUrl;
}

async function generateArbitraryImage(options: GenerateArbitraryImageOptions): Promise<string> {
  console.log(`\n🎨 Generating arbitrary image: "${options.prompt}"`);

  try {
    // Generate image with Gemini
    const imageBase64 = await generateImageWithReplicate(options);

    // Remove background
    const noBgBuffer = await removeBackground(imageBase64);

    // Crop transparent edges
    const finalBuffer = await cropTransparentEdges(noBgBuffer);

    // Determine output path
    const timestamp = Date.now();
    const sanitizedPrompt = options.prompt
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 50);

    const modeSuffix = options.cupheadMode ? '-cuphead' : '';
    const outputPath = options.outputPath || path.join(
      'output',
      'arbitrary',
      `${sanitizedPrompt}${modeSuffix}-${timestamp}.${options.outputFormat || 'png'}`
    );

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save locally
    fs.writeFileSync(outputPath, finalBuffer);
    console.log(`✅ Image saved locally: ${outputPath}`);

    // Upload to R2 if requested
    if (options.r2Path) {
      await uploadToR2(outputPath, options.r2Path);
    }

    console.log(`💰 Cost: Variable (Replicate per-second billing)`);

    return outputPath;

  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error:`, error.message);
      throw error;
    }
    throw new Error('Unknown error occurred');
  }
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 1 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Mystica Arbitrary Image Generator

Generate arbitrary images using Gemini with automatic background removal.
Uses the same reference images as generate-raw-image.ts for style consistency.

Usage:
  pnpm generate-arbitrary "prompt text" [options]

Arguments:
  prompt                Text description of what to generate (required)

Options:
  -o, --output PATH     Custom local output path (default: output/arbitrary/{prompt}-{timestamp}.png)
  -f, --format FMT      Output format: jpg or png (default: png)
  -r, --r2 R2_PATH      Upload to R2 at specified path (e.g. "items/my-item.png")
                        Will overwrite if file already exists at that path
  --cuphead             Generate in Cuphead-style (1930s rubber hose animation aesthetic)
  -h, --help            Show this help message

Configuration:
  Aspect Ratio:     1:1 (hardcoded)
  Provider:         Gemini (Nano Banana) (hardcoded)
  Reference Images: 10 R2-hosted images (default) or 5 Cuphead-style images (--cuphead)
  Background:       Automatically removed
  Styles:           Default: chibi/super-deformed | Cuphead: 1930s rubber hose animation

Examples:
  # Simple generation (default chibi style)
  pnpm generate-arbitrary "a magical glowing orb"
  pnpm generate-arbitrary "cyberpunk samurai sword"

  # Cuphead-style generation (1930s rubber hose animation)
  pnpm generate-arbitrary "vintage cartoon character" --cuphead
  pnpm generate-arbitrary "rubber hose style boss enemy" --cuphead
  pnpm generate-arbitrary "1930s cartoon weapon" --cuphead

  # Custom local output path
  pnpm generate-arbitrary "dragon egg" --output my-dragon-egg.png
  pnpm generate-arbitrary "cuphead boss" --cuphead --output boss.png

  # Upload to R2 at custom path
  pnpm generate-arbitrary "fire sword" --r2 "items/fire-sword.png"
  pnpm generate-arbitrary "cuphead character" --cuphead --r2 "characters/cuphead-hero.png"

  # Both local and R2
  pnpm generate-arbitrary "magic orb" --output orb.png --r2 "items/orb.png"
  pnpm generate-arbitrary "vintage enemy" --cuphead --output enemy.png --r2 "enemies/vintage-boss.png"

Environment Variables Required:
  REPLICATE_API_TOKEN      Get from https://replicate.com

  For R2 upload (--r2 flag):
  CLOUDFLARE_ACCOUNT_ID    Cloudflare account ID
  R2_ACCESS_KEY_ID         R2 API token with read/write access
  R2_SECRET_ACCESS_KEY     R2 API token secret

Cost Estimates:
  Single image: ~$0.004-0.02 per generation
    - Image generation: ~$0.002-0.01 (Replicate per-second billing)
    - Background removal: ~$0.002-0.01 (Replicate per-second billing)

Output:
  scripts/output/arbitrary/   - Generated images with no background (local)
  R2 bucket (if --r2 used):   - Uploaded to mystica-assets bucket
`);
    process.exit(0);
  }

  const options: GenerateArbitraryImageOptions = {
    prompt: '',
    outputFormat: 'png'
  };

  // First non-flag argument is the prompt
  let promptSet = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if ((arg === '-o' || arg === '--output') && args[i + 1]) {
      options.outputPath = args[++i];
    } else if ((arg === '-f' || arg === '--format') && args[i + 1]) {
      const format = args[++i];
      if (format !== 'jpg' && format !== 'png') {
        console.error('❌ Invalid format. Choose: jpg or png');
        process.exit(1);
      }
      options.outputFormat = format;
    } else if ((arg === '-r' || arg === '--r2') && args[i + 1]) {
      options.r2Path = args[++i];
    } else if (arg === '--cuphead') {
      options.cupheadMode = true;
    } else if (!arg.startsWith('-') && !promptSet) {
      options.prompt = arg;
      promptSet = true;
    }
  }

  if (!options.prompt) {
    console.error('❌ Prompt is required');
    console.error('Usage: pnpm generate-arbitrary "prompt text" [options]');
    process.exit(1);
  }

  await generateArbitraryImage(options);
}

export { generateArbitraryImage };
export type { GenerateArbitraryImageOptions };

// Run CLI when executed directly (not when imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await main().catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  })();
}
