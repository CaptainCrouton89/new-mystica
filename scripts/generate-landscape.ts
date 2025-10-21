/**
 * Generate Landscape/Background Images
 *
 * This script generates landscape and background images using Gemini (Nano Banana).
 * Unlike generate-arbitrary-image.ts, this keeps the background and uses a landscape-optimized prompt.
 * Images are automatically cropped to remove any transparent edges if present.
 *
 * Usage:
 *   pnpm generate-landscape "a mystical desert temple"
 *   pnpm generate-landscape "enchanted forest clearing" --output custom-forest.png
 *   pnpm generate-landscape "volcanic wasteland" --r2 "backgrounds/volcano.png"
 *
 * R2 Upload:
 *   Note: --r2 flag currently uploads to LOCAL R2 instance. For REMOTE upload, use wrangler directly:
 *   wrangler r2 object put mystica-assets/path/to/file.png --file ./output/landscapes/filename.png --remote
 *
 * Automatic Processing:
 *   1. Generate image with Gemini (Nano Banana)
 *   2. Auto-crop transparent edges if present (sharp trim)
 *   3. Save to output/landscapes/ directory
 *   4. Optionally upload to R2
 */

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import Replicate from 'replicate';
import sharp from 'sharp';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local', override: true });

// Supported aspect ratios for Nano Banana
type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';

// Hardcoded configuration
const CONFIG = {
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

interface GenerateLandscapeOptions {
  prompt: string;
  aspectRatio?: AspectRatio;
  outputPath?: string;
  outputFormat?: 'jpg' | 'png';
  r2Path?: string;
}

function buildPrompt(description: string, aspectRatio: AspectRatio): string {

  return `Create a game background scene:

"${description}"

This illustration in a polished, high-detail "chibi"/super-deformed aesthetic typical of mobile RPGs and CCGs.

Core Look
    •    Color: Vivid, high-saturation palette; punchy local colors with clean hue separation. Keep values readable; avoid muddy midtones.
    •    Lighting: Clear atmospheric lighting with natural sky gradients. Warm or cool color temperature appropriate to the scene.
    •    Glow & Highlights: Atmospheric depth with subtle haze, fog, or distance fading. Controlled bloom on light sources (sun, magical effects).
    •    Depth: Clear foreground, midground, and background layers. Use atmospheric perspective for distance.

Line & Form
    •    Outlines: Bold, uniform black borders around major elements and structures for strong silhouette separation.
    •    Proportions: Slightly stylized, chunky architecture and terrain features for instant readability.
    •    Texture: Suggestive environmental textures (stone, sand, wood, water) with tidy, deliberate marks. Avoid excessive detail.
    •    Simplicity: Clear, readable landscape elements. Avoid clutter or overly complex details.

Shading & Depth
    •    Render Style: Hybrid cel + soft gradients; atmospheric blending for distance.
    •    Volume: Strong sense of depth via layering, atmospheric perspective, and controlled contrast.
    •    Environment: Natural or magical lighting appropriate to setting (daylight, dusk, moonlight, magical glow).

Composition & Background
    •    Framing: Full bleed edge-to-edge composition, clear horizon line or depth recession.
    •    Background: Fully rendered environment scene - sky, terrain, structures, vegetation as appropriate.
    •    Atmosphere: Use atmospheric effects (haze, fog, dust, particles) to enhance depth and mood.
    •    Scale: Include environmental elements at varying scales to establish depth and grandeur.

CRITICAL BORDER RULES:
    •    Bold black outlines around MAJOR STRUCTURES AND OBJECTS ONLY (buildings, rocks, trees, etc.)
    •    ABSOLUTELY NO BORDER, FRAME, OR BLACK LINE AROUND THE OUTER EDGE OF THE IMAGE
    •    The image must extend fully to all edges without any surrounding border
    •    Do NOT add any decorative frame or picture border
    •    Full bleed composition only - content goes edge-to-edge

Restrictions: NO text, NO watermarks, NO logos, NO UI elements, NO outer image border/frame, NO characters unless part of distant scenery.

Style: Mobile RPG/CCG background art - vibrant, stylized, optimized for gameplay visibility with clear depth layers.`;
}

async function generateImageWithReplicate(options: GenerateLandscapeOptions): Promise<string> {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN not found in .env.local');
  }

  const replicate = new Replicate({ auth: apiToken });

  const aspectRatio = options.aspectRatio || '16:9';
  const prompt = buildPrompt(options.prompt, aspectRatio);
  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: aspectRatio,
    output_format: options.outputFormat || 'png',
    image_input: CONFIG.defaultReferenceImages
  };

  console.log(`🎨 Generating landscape with ${CONFIG.model}...`);
  console.log(`📐 Aspect ratio: ${aspectRatio}`);
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

async function cropTransparentEdges(imageBuffer: Buffer): Promise<Buffer> {
  console.log('✂️  Cropping transparent edges (if present)...');

  const metadata = await sharp(imageBuffer).metadata();
  console.log(`   Original size: ${metadata.width}x${metadata.height}`);

  // Check if image has alpha channel
  if (!metadata.hasAlpha) {
    console.log('   No alpha channel, skipping crop');
    return imageBuffer;
  }

  try {
    // Use sharp's trim() to remove transparent edges
    const croppedBuffer = await sharp(imageBuffer)
      .trim()
      .toBuffer();

    const croppedMetadata = await sharp(croppedBuffer).metadata();
    console.log(`   Cropped size: ${croppedMetadata.width}x${croppedMetadata.height}`);

    return croppedBuffer;
  } catch (error) {
    console.log('   Crop not needed, returning original');
    return imageBuffer;
  }
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

async function generateLandscape(options: GenerateLandscapeOptions): Promise<string> {
  console.log(`\n🎨 Generating landscape: "${options.prompt}"`);

  try {
    // Generate image with Gemini
    const imageBase64 = await generateImageWithReplicate(options);

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // Crop transparent edges if present
    const finalBuffer = await cropTransparentEdges(imageBuffer);

    // Determine output path
    const timestamp = Date.now();
    const sanitizedPrompt = options.prompt
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 50);

    const outputPath = options.outputPath || path.join(
      'output',
      'landscapes',
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
Mystica Landscape/Background Generator

Generate landscape and background images using Gemini for game environments.
Uses the same reference images as other generators for style consistency.

Usage:
  pnpm generate-landscape "prompt text" [options]

Arguments:
  prompt                Text description of landscape to generate (required)

Options:
  -a, --aspect RATIO    Aspect ratio (default: 16:9)
                        Available: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
  -o, --output PATH     Custom local output path (default: output/landscapes/{prompt}-{timestamp}.png)
  -f, --format FMT      Output format: jpg or png (default: png)
  -r, --r2 R2_PATH      Upload to R2 at specified path (e.g. "backgrounds/desert-temple.png")
                        Will overwrite if file already exists at that path
  -h, --help            Show this help message

Configuration:
  Provider:         Gemini (Nano Banana) (hardcoded)
  Reference Images: 10 R2-hosted images (hardcoded)
  Background:       Kept (NOT removed)
  Max Resolution:   ~1 megapixel (varies by aspect ratio)

Examples:
  # Simple generation (16:9 landscape default)
  pnpm generate-landscape "mystical desert temple"
  pnpm generate-landscape "enchanted forest clearing"

  # Square format for icons or thumbnails
  pnpm generate-landscape "magical portal" --aspect 1:1

  # Portrait for mobile backgrounds
  pnpm generate-landscape "ancient tower" --aspect 9:16

  # Ultra-wide cinematic
  pnpm generate-landscape "epic battlefield" --aspect 21:9

  # Custom local output path
  pnpm generate-landscape "volcanic wasteland" --output my-volcano.png

  # Upload to R2 at custom path
  pnpm generate-landscape "crystal cave" --aspect 16:9 --r2 "backgrounds/crystal-cave.png"
  pnpm generate-landscape "ancient ruins" --r2 "environments/ruins.png"

  # Both local and R2
  pnpm generate-landscape "sky fortress" --output fortress.png --r2 "backgrounds/fortress.png"

Environment Variables Required:
  REPLICATE_API_TOKEN      Get from https://replicate.com

  For R2 upload (--r2 flag):
  CLOUDFLARE_ACCOUNT_ID    Cloudflare account ID
  R2_ACCESS_KEY_ID         R2 API token with read/write access
  R2_SECRET_ACCESS_KEY     R2 API token secret

Cost Estimates:
  Single image: ~$0.002-0.01 per generation
    - Image generation: ~$0.002-0.01 (Replicate per-second billing)

Output:
  scripts/output/landscapes/   - Generated landscape images (local)
  R2 bucket (if --r2 used):    - Uploaded to mystica-assets bucket
`);
    process.exit(0);
  }

  const options: GenerateLandscapeOptions = {
    prompt: '',
    outputFormat: 'png',
    aspectRatio: '16:9'
  };

  // First non-flag argument is the prompt
  let promptSet = false;

  const validAspectRatios: AspectRatio[] = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if ((arg === '-a' || arg === '--aspect') && args[i + 1]) {
      const aspect = args[++i] as AspectRatio;
      if (!validAspectRatios.includes(aspect)) {
        console.error(`❌ Invalid aspect ratio. Choose from: ${validAspectRatios.join(', ')}`);
        process.exit(1);
      }
      options.aspectRatio = aspect;
    } else if ((arg === '-o' || arg === '--output') && args[i + 1]) {
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
    console.error('Usage: pnpm generate-landscape "prompt text" [options]');
    process.exit(1);
  }

  await generateLandscape(options);
}

export { generateLandscape };
export type { GenerateLandscapeOptions };

// Run CLI when executed directly (not when imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await main().catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  })();
}
