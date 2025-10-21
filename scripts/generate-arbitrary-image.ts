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

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import Replicate from 'replicate';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local', override: true });

// Hardcoded configuration
const CONFIG = {
  aspectRatio: '1:1' as const,
  provider: 'gemini' as const,
  model: 'google/nano-banana',
  defaultReferenceImages: [
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
  ]
};

const R2_CONFIG = {
  bucket: 'mystica-assets',
  publicUrl: 'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev',
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
}

function buildPrompt(description: string): string {
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

  const prompt = buildPrompt(options.prompt);
  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: CONFIG.aspectRatio,
    output_format: options.outputFormat || 'png',
    image_input: CONFIG.defaultReferenceImages
  };

  console.log(`🎨 Generating with ${CONFIG.model}...`);
  console.log(`📸 Using ${CONFIG.defaultReferenceImages.length} reference images from R2`);
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

    const outputPath = options.outputPath || path.join(
      'output',
      'arbitrary',
      `${sanitizedPrompt}-${timestamp}.${options.outputFormat || 'png'}`
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
  -h, --help            Show this help message

Configuration:
  Aspect Ratio:     1:1 (hardcoded)
  Provider:         Gemini (Nano Banana) (hardcoded)
  Reference Images: 10 R2-hosted images (hardcoded)
  Background:       Automatically removed

Examples:
  # Simple generation
  pnpm generate-arbitrary "a magical glowing orb"
  pnpm generate-arbitrary "cyberpunk samurai sword"

  # Custom local output path
  pnpm generate-arbitrary "dragon egg" --output my-dragon-egg.png

  # Upload to R2 at custom path
  pnpm generate-arbitrary "fire sword" --r2 "items/fire-sword.png"
  pnpm generate-arbitrary "golden coin" --r2 "materials/gold-coin.png"

  # Both local and R2
  pnpm generate-arbitrary "magic orb" --output orb.png --r2 "items/orb.png"

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
