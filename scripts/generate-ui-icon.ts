/**
 * Generate UI Icons
 *
 * This script generates UI icons for the frontend (buttons, badges, indicators, etc.)
 * Always uses the default style (rubberhose) and uploads to R2 only (no database sync).
 *
 * Features:
 * - Always uses default style (rubberhose)
 * - Automatic background removal
 * - Auto-cropping of transparent edges
 * - R2 upload to ui-icons/
 * - No database integration (hardcoded paths in frontend)
 *
 * Usage:
 *   pnpm generate-ui-icon "health-potion" --description "Red heart-shaped health potion icon"
 *   pnpm generate-ui-icon "coin" "gem" "star" --batch
 *   pnpm generate-ui-icon "settings-gear" --r2-path "ui-icons/settings/gear.png"
 *   pnpm generate-ui-icon "test-icon" --local-only
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import Replicate from 'replicate';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getDefaultStyle } from './styles';

// Load environment variables
dotenv.config({ path: '.env.local', override: true });

// Validate required env vars
function validateEnvVars(): void {
  const required = [
    'REPLICATE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_URL'
  ];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateEnvVars();

const R2_CONFIG = {
  bucket: process.env.R2_BUCKET_NAME!,
  publicUrl: process.env.R2_PUBLIC_URL!,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
};

function createR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_CONFIG.accessKeyId,
      secretAccessKey: R2_CONFIG.secretAccessKey,
    },
  });
}

interface GenerateUIIconOptions {
  name: string;
  description: string;
  r2Path?: string; // Custom R2 path (default: ui-icons/{name}.png)
  localOnly?: boolean; // Skip R2 upload
  outputFormat?: 'jpg' | 'png';
}

async function generateImageWithReplicate(options: GenerateUIIconOptions): Promise<string> {
  const apiToken = process.env.REPLICATE_API_TOKEN!;
  const replicate = new Replicate({ auth: apiToken });

  // Always use default style (rubberhose)
  const style = getDefaultStyle();

  console.log(`🎨 Generating UI icon with ${style.config.displayName} style...`);
  console.log(`📸 Using ${style.config.referenceImages.length} reference images`);

  // Build prompt using default style's arbitrary prompt builder
  const prompt = style.prompts.buildArbitraryPrompt(options.description);

  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: style.config.params?.aspectRatio || '1:1',
    output_format: options.outputFormat || 'png',
    image_input: style.config.referenceImages
  };

  console.log(`💬 Description: "${options.description}"`);

  // Run prediction
  const output = await replicate.run(style.config.model as `${string}/${string}`, { input }) as any;

  // Handle output
  let imageUrl: string;

  if (typeof output?.url === 'function') {
    imageUrl = output.url();
  } else {
    throw new Error('No image returned from Replicate');
  }

  if (!imageUrl) {
    throw new Error('No image URL returned from Replicate');
  }

  // Download image
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
  const apiToken = process.env.REPLICATE_API_TOKEN!;
  const replicate = new Replicate({ auth: apiToken });

  console.log('🔪 Removing background...');

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
    throw new Error(`Unexpected output format from background remover: ${typeof output}`);
  }

  if (!processedImageUrl) {
    throw new Error('No image URL returned from background remover');
  }

  console.log('⬇️  Downloading no-background image...');
  const response = await fetch(processedImageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download no-background image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function cropTransparentEdges(imageBuffer: Buffer): Promise<Buffer> {
  console.log('✂️  Cropping transparent edges and normalizing to 1:1...');

  const metadata = await sharp(imageBuffer).metadata();
  console.log(`   Original size: ${metadata.width}x${metadata.height}`);

  // Use sharp's trim() to remove transparent edges
  const trimmedBuffer = await sharp(imageBuffer)
    .trim()
    .toBuffer();

  const trimmedMetadata = await sharp(trimmedBuffer).metadata();
  console.log(`   Trimmed size: ${trimmedMetadata.width}x${trimmedMetadata.height}`);

  // Make square by adding transparent padding to the smaller dimension
  const maxDimension = Math.max(trimmedMetadata.width!, trimmedMetadata.height!);
  const paddingLeft = Math.floor((maxDimension - trimmedMetadata.width!) / 2);
  const paddingTop = Math.floor((maxDimension - trimmedMetadata.height!) / 2);

  const squareBuffer = await sharp(trimmedBuffer)
    .extend({
      top: paddingTop,
      bottom: maxDimension - trimmedMetadata.height! - paddingTop,
      left: paddingLeft,
      right: maxDimension - trimmedMetadata.width! - paddingLeft,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  const squareMetadata = await sharp(squareBuffer).metadata();
  console.log(`   Final size (1:1): ${squareMetadata.width}x${squareMetadata.height}`);

  return squareBuffer;
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
  console.log(`✅ R2 URL: ${publicUrl}`);

  return publicUrl;
}

async function generateUIIcon(options: GenerateUIIconOptions): Promise<string> {
  console.log(`\n🎨 Generating UI icon: "${options.name}"`);

  try {
    // Generate image
    const imageBase64 = await generateImageWithReplicate(options);

    // Remove background
    const noBgBuffer = await removeBackground(imageBase64);

    // Crop transparent edges
    const finalBuffer = await cropTransparentEdges(noBgBuffer);

    // Determine output path
    const timestamp = Date.now();
    const sanitizedName = options.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');

    const localPath = path.join(
      'output',
      'ui-icons',
      `${sanitizedName}-${timestamp}.png`
    );

    // Ensure output directory exists
    const outputDir = path.dirname(localPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save locally
    fs.writeFileSync(localPath, finalBuffer);
    console.log(`💾 Saved locally: ${localPath}`);

    // Upload to R2 unless local-only
    if (!options.localOnly) {
      const r2Key = options.r2Path || `ui-icons/${sanitizedName}.png`;
      await uploadToR2(localPath, r2Key);
    }

    return localPath;

  } catch (error: any) {
    console.error(`❌ Error generating UI icon "${options.name}":`, error.message);
    throw error;
  }
}

// CLI argument parsing
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
UI Icon Generator

Generate UI icons for the frontend using the default style (rubberhose).
All icons automatically have background removed and transparent edges cropped.
Icons are uploaded to R2 at ui-icons/{name}.png (no database sync).

Usage:
  pnpm generate-ui-icon <name> [options]
  pnpm generate-ui-icon <name1> <name2> <name3> [options]

Options:
  --description <text>    Icon description (default: derived from name)
  --r2-path <path>        Custom R2 path (default: ui-icons/{name}.png)
  --local-only            Skip R2 upload (local generation only)
  --help, -h              Show this help message

Examples:
  # Single icon with description
  pnpm generate-ui-icon "health-heart" --description "Red heart icon for health"

  # Multiple icons
  pnpm generate-ui-icon "coin" "gem" "star"

  # Custom R2 path
  pnpm generate-ui-icon "settings-gear" --r2-path "ui-icons/settings/gear.png"

  # Local only (no upload)
  pnpm generate-ui-icon "test-icon" --local-only

Output:
  Local: scripts/output/ui-icons/{name}-{timestamp}.png
  R2:    ui-icons/{name}.png (or custom path)
`);
  process.exit(0);
}

// Parse arguments
const names: string[] = [];
let description: string | undefined;
let r2Path: string | undefined;
let localOnly = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--description') {
    description = args[++i];
  } else if (arg === '--r2-path') {
    r2Path = args[++i];
  } else if (arg === '--local-only') {
    localOnly = true;
  } else if (!arg.startsWith('--')) {
    names.push(arg);
  }
}

if (names.length === 0) {
  console.error('❌ Error: At least one icon name is required');
  process.exit(1);
}

// Generate icons
(async () => {
  console.log(`\n🎨 Generating ${names.length} UI icon(s) using default style (rubberhose)...\n`);

  const results = { success: 0, failed: 0 };

  for (const name of names) {
    try {
      // Use provided description or generate from name
      const iconDescription = description || `UI icon: ${name.replace(/-/g, ' ')}`;

      await generateUIIcon({
        name,
        description: iconDescription,
        r2Path: names.length === 1 ? r2Path : undefined, // Only use custom path for single icon
        localOnly,
        outputFormat: 'png'
      });

      results.success++;
    } catch (error: any) {
      console.error(`❌ Failed to generate "${name}":`, error.message);
      results.failed++;
    }
  }

  console.log(`\n📊 Summary: ${results.success} succeeded, ${results.failed} failed`);

  if (results.failed > 0) {
    process.exit(1);
  }
})();
