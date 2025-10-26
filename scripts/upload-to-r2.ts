/**
 * Upload to R2 - Batch Asset Upload Tool
 *
 * Uploads local files to R2 with automatic path detection and optional background removal.
 *
 * Usage:
 *   pnpm upload-to-r2 --file output/arbitrary/sword.png --type items --name "Fire Sword"
 *   pnpm upload-to-r2 --batch output/arbitrary --type materials
 *   pnpm upload-to-r2 --file output/monsters/slime.png --type monsters --name "Slime Boss" --remove-bg
 *   pnpm upload-to-r2 --batch output/arbitrary --type items --dry-run
 */

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import Replicate from 'replicate';
import sharp from 'sharp';

dotenv.config({ path: '.env.local', override: true });

const R2_CONFIG = {
  bucket: 'mystica-assets',
  publicUrl: process.env.R2_PUBLIC_URL,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
};

type AssetType = 'items' | 'materials' | 'monsters' | 'backgrounds' | 'ui-icons' | 'custom';

interface UploadOptions {
  file?: string;
  batch?: string;
  type: AssetType;
  name?: string;
  customPath?: string;
  removeBackground?: boolean;
  dryRun?: boolean;
}

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

async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN not found in .env.local');
  }

  const replicate = new Replicate({ auth: apiToken });

  console.log('  🔪 Removing background...');

  // Create data URL from buffer
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;

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

  console.log('  ⬇️  Downloading processed image...');
  const response = await fetch(processedImageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download no-background image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const processedBuffer = Buffer.from(arrayBuffer);

  // Auto-crop transparent edges
  console.log('  ✂️  Cropping transparent edges...');
  const croppedBuffer = await sharp(processedBuffer)
    .trim()
    .toBuffer();

  return croppedBuffer;
}

function getR2Key(type: AssetType, name: string, customPath?: string): string {
  if (customPath) {
    return customPath;
  }

  const sanitizedName = name.toLowerCase().replace(/\s+/g, '-');

  switch (type) {
    case 'items':
      return `items/${sanitizedName}.png`;
    case 'materials':
      return `materials/${sanitizedName}.png`;
    case 'monsters':
      return `monsters/${sanitizedName}.png`;
    case 'backgrounds':
      return `backgrounds/${sanitizedName}.png`;
    case 'ui-icons':
      return `ui-icons/${sanitizedName}.png`;
    case 'custom':
      throw new Error('Custom type requires --custom-path');
    default:
      throw new Error(`Unknown asset type: ${type}`);
  }
}

async function uploadFileToR2(
  filePath: string,
  r2Key: string,
  removeBackground: boolean,
  dryRun: boolean
): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  let fileBuffer = fs.readFileSync(filePath);

  // Remove background if requested
  if (removeBackground) {
    fileBuffer = await removeBackground(fileBuffer);
  }

  const publicUrl = `${R2_CONFIG.publicUrl}/${r2Key}`;

  if (dryRun) {
    console.log(`  [DRY RUN] Would upload to: ${r2Key}`);
    console.log(`  [DRY RUN] Public URL: ${publicUrl}`);
    return publicUrl;
  }

  const client = createR2Client();

  console.log(`  📤 Uploading to R2: ${r2Key}`);

  await client.send(new PutObjectCommand({
    Bucket: R2_CONFIG.bucket,
    Key: r2Key,
    Body: fileBuffer,
    ContentType: 'image/png',
  }));

  console.log(`  🌐 Public URL: ${publicUrl}`);

  return publicUrl;
}

async function uploadSingle(options: UploadOptions): Promise<void> {
  if (!options.file) {
    throw new Error('--file is required for single upload');
  }

  if (!options.name && options.type !== 'custom') {
    throw new Error('--name is required for single upload (unless using --custom-path)');
  }

  console.log(`\n📤 Uploading single file: ${options.file}`);

  const r2Key = getR2Key(options.type, options.name || 'unnamed', options.customPath);
  const url = await uploadFileToR2(options.file, r2Key, options.removeBackground || false, options.dryRun || false);

  console.log(`\n✅ Upload ${options.dryRun ? '[DRY RUN] ' : ''}complete: ${url}`);
}

async function uploadBatch(options: UploadOptions): Promise<void> {
  if (!options.batch) {
    throw new Error('--batch is required for batch upload');
  }

  if (!fs.existsSync(options.batch)) {
    throw new Error(`Directory not found: ${options.batch}`);
  }

  const stats = fs.statSync(options.batch);
  if (!stats.isDirectory()) {
    throw new Error(`Not a directory: ${options.batch}`);
  }

  console.log(`\n📦 Batch upload from: ${options.batch}`);

  // Get all PNG files in directory
  const files = fs.readdirSync(options.batch)
    .filter(f => f.endsWith('.png'))
    .map(f => path.join(options.batch!, f));

  if (files.length === 0) {
    console.log('⚠️  No PNG files found in directory');
    return;
  }

  console.log(`Found ${files.length} PNG file(s)`);

  if (options.dryRun) {
    console.log('\n[DRY RUN MODE - No files will be uploaded]');
  }

  const results: { file: string; url: string; success: boolean; error?: string }[] = [];

  for (const file of files) {
    const fileName = path.basename(file, '.png');
    const r2Key = getR2Key(options.type, fileName, options.customPath);

    console.log(`\n🔄 Processing: ${fileName}`);

    try {
      const url = await uploadFileToR2(file, r2Key, options.removeBackground || false, options.dryRun || false);
      results.push({ file, url, success: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`  ❌ Error: ${errorMessage}`);
      results.push({ file, url: '', success: false, error: errorMessage });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`BATCH UPLOAD SUMMARY ${options.dryRun ? '[DRY RUN]' : ''}`);
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n✅ Successful: ${successful.length}/${files.length}`);
  successful.forEach(r => {
    const fileName = path.basename(r.file);
    console.log(`   • ${fileName} → ${r.url}`);
  });

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}/${files.length}`);
    failed.forEach(r => {
      const fileName = path.basename(r.file);
      console.log(`   • ${fileName}: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 1 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Upload to R2 - Batch Asset Upload Tool

Upload local files to R2 with automatic path detection and optional background removal.

Usage:
  pnpm upload-to-r2 [--file FILE | --batch DIR] --type TYPE [options]

Required Arguments (choose one):
  --file PATH           Single file to upload
  --batch DIR           Directory of PNG files to batch upload

Required Options:
  --type TYPE           Asset type: items, materials, monsters, backgrounds, ui-icons, custom

Options:
  --name NAME           Asset name (required for single upload, auto-detected for batch)
  --custom-path PATH    Custom R2 path (overrides type-based path)
  --remove-bg           Remove background and crop transparent edges
  --dry-run             Preview upload without actually uploading
  -h, --help            Show this help message

Asset Types & Paths:
  items        → items/{name}.png
  materials    → materials/{name}.png
  monsters     → monsters/{name}.png
  backgrounds  → backgrounds/{name}.png
  ui-icons     → ui-icons/{name}.png
  custom       → requires --custom-path

Examples:
  # Upload single file
  pnpm upload-to-r2 --file output/arbitrary/sword.png --type items --name "Fire Sword"

  # Upload with background removal
  pnpm upload-to-r2 --file output/monsters/slime.png --type monsters --name "Slime Boss" --remove-bg

  # Batch upload directory
  pnpm upload-to-r2 --batch output/arbitrary --type materials

  # Dry run to preview
  pnpm upload-to-r2 --batch output/arbitrary --type items --dry-run

  # Custom R2 path
  pnpm upload-to-r2 --file icon.png --type custom --custom-path "special/my-icon.png"

Environment Variables Required:
  CLOUDFLARE_ACCOUNT_ID    Cloudflare account ID
  R2_ACCESS_KEY_ID         R2 API token with write access
  R2_SECRET_ACCESS_KEY     R2 API token secret
  R2_PUBLIC_URL            R2 public URL (for generating URLs)

  For --remove-bg:
  REPLICATE_API_TOKEN      Replicate API token
`);
    process.exit(0);
  }

  const options: Partial<UploadOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--file' && args[i + 1]) {
      options.file = args[++i];
    } else if (arg === '--batch' && args[i + 1]) {
      options.batch = args[++i];
    } else if (arg === '--type' && args[i + 1]) {
      options.type = args[++i] as AssetType;
    } else if (arg === '--name' && args[i + 1]) {
      options.name = args[++i];
    } else if (arg === '--custom-path' && args[i + 1]) {
      options.customPath = args[++i];
    } else if (arg === '--remove-bg') {
      options.removeBackground = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  // Validate options
  if (!options.file && !options.batch) {
    console.error('❌ Either --file or --batch is required');
    process.exit(1);
  }

  if (options.file && options.batch) {
    console.error('❌ Cannot use both --file and --batch');
    process.exit(1);
  }

  if (!options.type) {
    console.error('❌ --type is required');
    process.exit(1);
  }

  const validTypes: AssetType[] = ['items', 'materials', 'monsters', 'backgrounds', 'ui-icons', 'custom'];
  if (!validTypes.includes(options.type)) {
    console.error(`❌ Invalid type. Choose from: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  if (options.type === 'custom' && !options.customPath) {
    console.error('❌ --custom-path is required when using --type custom');
    process.exit(1);
  }

  if (options.file) {
    await uploadSingle(options as UploadOptions);
  } else if (options.batch) {
    await uploadBatch(options as UploadOptions);
  }
}

// Run CLI when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await main().catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  })();
}

export { uploadFileToR2, uploadSingle, uploadBatch };
export type { UploadOptions, AssetType };
