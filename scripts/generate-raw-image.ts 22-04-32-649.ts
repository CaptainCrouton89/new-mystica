/**
 * Generate Raw Item/Material Images
 *
 * This script generates standalone item and material images with AI-generated descriptions.
 * Images are saved locally. Optionally uploads to R2 with --upload flag.
 *
 * Local Output:
 *   - Items: output/raw/items/{name}-{timestamp}.png
 *   - Materials: output/raw/materials/{name}-{timestamp}.png
 *
 * R2 Storage (with --upload flag):
 *   - Items: items/{snake_case_name}.png
 *   - Materials: materials/{snake_case_name}.png
 *   - No-background items: items/no-background/{snake_case_name}.png (with --remove-background)
 *   - No-background materials: materials/no-background/{snake_case_name}.png (with --remove-background)
 *   - Bucket: mystica-assets
 *   - Public URL: https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev
 *
 * Usage:
 *   pnpm generate-raw-image --batch materials --upload --remove-background
 *   pnpm generate-raw-image "Coffee" --type material --upload
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import Replicate from 'replicate';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { uploadToR2 } from './r2-service';
import { getStyle, getDefaultStyle, StyleName } from './styles';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local', override: true });

// Runtime validation for required env vars
function validateRequiredEnvVars(): void {
  const required = [
    'REPLICATE_API_TOKEN',
    'OPENAI_API_KEY'
  ];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Validate required env vars on module load
validateRequiredEnvVars();

interface GenerateRawImageOptions {
  name: string;
  type: 'item' | 'material';
  description?: string;
  style?: StyleName; // Optional style (defaults to rubberhose)
  outputPath?: string;
  outputFormat?: 'jpg' | 'png';
  uploadToR2?: boolean;
  removeBackground?: boolean;
}

interface SeedItem {
  id: string;
  name: string;
}

interface SeedData {
  items?: SeedItem[];
  materials?: SeedItem[];
}

const rawDescriptionSchema = z.object({
  description: z.string().describe('A concise one-sentence physical description of the item or material for image generation')
});

const RAW_DESCRIPTION_SYSTEM_PROMPT = `You are generating concise visual descriptions for game items and materials to be used in image generation prompts.

Your task: Given a name and type (item or material), write ONE sentence describing what it looks like physically.

Guidelines:
- Focus purely on visual/physical details (shape, material, key features)
- Keep it short and simple - aim for 8-15 words
- Avoid artistic style, mood, or storytelling
- Be specific but minimal - only essential visual details
- For items: describe the object's form and notable features
- For materials: describe appearance, texture, or container
- For pop culture references or branded items: maintain their iconic shape/form but describe them as physical objects

Examples:
- "Sword" → "a silver broadsword with a gem-studded crescent hilt"
- "Slime" → "a large glass jar filled with green slime with a cork top"
- "Wand" → "a gnarled wooden staff with a glowing crystal orb"
- "Coffee" → "a pile of dark roasted coffee beans"
- "Metal Scraps" → "a heap of rusty metal fragments and bolts"
- "Hello Kitty" → "a white cat character with round head, black dot eyes, yellow nose, and red bow"

Output only the description.`;

async function generateRawDescription(name: string, type: 'item' | 'material'): Promise<string> {
  const prompt = `Name: ${name}; Type: ${type}`;

  const { object } = await generateObject({
    model: openai('gpt-4.1-mini'),
    schema: rawDescriptionSchema,
    system: RAW_DESCRIPTION_SYSTEM_PROMPT,
    prompt,
  });

  return object.description;
}

// Prompt building now handled by style system

async function generateImageWithReplicate(
  options: GenerateRawImageOptions
): Promise<string> {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN not found in .env.local');
  }

  if (!options.description) {
    throw new Error('Description is required for image generation');
  }

  const replicate = new Replicate({ auth: apiToken });

  // Get style (use default if not specified)
  const style = options.style ? getStyle(options.style) : getDefaultStyle();

  // Build prompt using style's prompt builder
  const prompt = options.type === 'item'
    ? style.prompts.buildItemPrompt(options.name, options.description)
    : style.prompts.buildMaterialPrompt(options.name, options.description);

  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: style.config.params?.aspectRatio || '1:1',
    output_format: options.outputFormat || 'png',
    image_input: style.config.referenceImages
  };

  const model = style.config.model || 'google/nano-banana';

  console.log(`🎨 Generating with ${style.config.displayName} style...`);
  console.log(`📸 Using ${style.config.referenceImages.length} reference images from R2`);

  // Run prediction
  const output = await replicate.run(model as `${string}/${string}`, { input }) as any;

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

  // Convert to base64
  return buffer.toString('base64');
}

async function removeBackground(imageUrl: string): Promise<string> {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN not found in .env.local');
  }

  const replicate = new Replicate({ auth: apiToken });

  console.log('🎨 Removing background...');

  const input = {
    image_url: imageUrl,
    preserve_partial_alpha: true
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
  const buffer = Buffer.from(arrayBuffer);

  return buffer.toString('base64');
}

async function generateRawImage(options: GenerateRawImageOptions): Promise<string> {
  console.log(`\n🎨 Generating raw ${options.type}: ${options.name}`);

  try {
    // Generate description if not provided
    let description = options.description;
    if (!description) {
      console.log('🤖 Generating AI description...');
      description = await generateRawDescription(options.name, options.type);
      console.log(`✅ Description: ${description}`);
    }

    const imageBase64 = await generateImageWithReplicate({ ...options, description });

    // Decode base64 and save
    const buffer = Buffer.from(imageBase64, 'base64');

    const timestamp = Date.now();
    const sanitizedName = options.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    const outputPath = options.outputPath || path.join(
      'output',
      'raw',
      options.type === 'item' ? 'items' : 'materials',
      `${sanitizedName}-${timestamp}.${options.outputFormat || 'png'}`
    );

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, buffer);

    console.log(`✅ Image saved to: ${outputPath}`);
    console.log(`💰 Cost: Variable (Replicate per-second billing)`);

    // Upload to R2 if requested
    if (options.uploadToR2) {
      console.log('📤 Uploading to R2...');
      const r2Url = await uploadToR2(outputPath, options.name, options.type);
      console.log(`🌐 R2 URL: ${r2Url}`);

      // Remove background if requested
      if (options.removeBackground) {
        console.log('🔪 Removing background...');
        const noBackgroundBase64 = await removeBackground(r2Url);
        const noBackgroundBuffer = Buffer.from(noBackgroundBase64, 'base64');

        // Save no-background version locally
        const noBackgroundPath = path.join(
          outputDir,
          `${sanitizedName}-${timestamp}-no-bg.${options.outputFormat || 'png'}`
        );
        fs.writeFileSync(noBackgroundPath, noBackgroundBuffer);
        console.log(`✅ No-background image saved to: ${noBackgroundPath}`);

        // Upload no-background version to R2
        console.log('📤 Uploading no-background version to R2...');
        const r2NoBackgroundUrl = await uploadToR2(noBackgroundPath, options.name, options.type, true);
        console.log(`🌐 R2 No-Background URL: ${r2NoBackgroundUrl}`);
      }
    }

    return outputPath;

  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error:`, error.message);
      throw error;
    }
    throw new Error('Unknown error occurred');
  }
}

async function generateBatch(
  batchType: 'items' | 'materials' | 'all',
  options: Partial<GenerateRawImageOptions>
): Promise<void> {
  console.log(`\n🚀 Starting batch generation for ${batchType}...\n`);

  // Load seed data
  const itemsPath = path.join('..', 'docs', 'seed-data-items.json');
  const materialsPath = path.join('..', 'docs', 'seed-data-materials.json');

  let items: SeedItem[] = [];
  let materials: SeedItem[] = [];

  if (batchType === 'items' || batchType === 'all') {
    if (!fs.existsSync(itemsPath)) {
      throw new Error(`Items seed data not found at ${itemsPath}`);
    }
    const itemsData: SeedData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
    items = itemsData.items || [];
  }

  if (batchType === 'materials' || batchType === 'all') {
    if (!fs.existsSync(materialsPath)) {
      throw new Error(`Materials seed data not found at ${materialsPath}`);
    }
    const materialsData: SeedData = JSON.parse(fs.readFileSync(materialsPath, 'utf-8'));
    materials = materialsData.materials || [];
  }

  const tasks = [
    ...items.map(item => ({ name: item.name, type: 'item' as const, id: item.id })),
    ...materials.map(mat => ({ name: mat.name, type: 'material' as const, id: mat.id }))
  ];

  console.log(`📋 Total tasks: ${tasks.length}`);
  console.log(`   Items: ${items.length}`);
  console.log(`   Materials: ${materials.length}\n`);

  const results = {
    successful: [] as string[],
    failed: [] as { name: string; error: string }[]
  };

  // Generate with progress tracking
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(`\n[${ i + 1}/${tasks.length}] Generating: ${task.name} (${task.type})`);
    console.log('='.repeat(60));

    try {
      const outputPath = await generateRawImage({
        name: task.name,
        type: task.type,
        style: options.style,
        outputFormat: options.outputFormat,
        uploadToR2: options.uploadToR2,
        removeBackground: options.removeBackground
      });

      results.successful.push(outputPath);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.failed.push({ name: task.name, error: errorMsg });
      console.error(`❌ Failed to generate ${task.name}: ${errorMsg}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('BATCH GENERATION SUMMARY');
  console.log('='.repeat(60));

  console.log(`\n✅ Successful: ${results.successful.length}/${tasks.length}`);
  if (results.successful.length > 0) {
    console.log(`\n   First few generated:`);
    results.successful.slice(0, 5).forEach(path => {
      console.log(`   • ${path}`);
    });
    if (results.successful.length > 5) {
      console.log(`   ... and ${results.successful.length - 5} more`);
    }
  }

  if (results.failed.length > 0) {
    console.log(`\n❌ Failed: ${results.failed.length}/${tasks.length}`);
    results.failed.forEach(failure => {
      console.log(`   • ${failure.name}: ${failure.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 1 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Mystica Raw Image Generator

Generate standalone item/material images with AI-generated descriptions.

Usage:
  pnpm generate-raw-image "Item Name" --type item|material [options]
  pnpm generate-raw-image "Item 1" "Item 2" "Item 3" --type item|material [options]
  pnpm generate-raw-image --batch items|materials|all [options]

Arguments:
  Name(s)           One or more item/material names (required for generation mode)
  --type TYPE       Type: item or material (required for generation mode)

Options:
  --batch TYPE         Batch mode: items, materials, or all
  --style STYLE        Art style: rubberhose (default), chibi, pixel-8bit
  -f, --format FMT     Output format: jpg or png (default: png)
  --upload             Upload generated images to R2
  --remove-background  Remove background and upload both versions to R2 (requires --upload)
  -h, --help           Show this help message

Styles:
  rubberhose (default) - 1930s rubber hose animation (Cuphead-inspired)
  chibi                - Polished mobile RPG/CCG aesthetic
  pixel-8bit           - Retro 8-bit/16-bit pixel art

Examples:
  # Single generation (default rubberhose style)
  pnpm generate-raw-image "Fuzzy Slippers" --type item
  pnpm generate-raw-image "Coffee" --type material

  # Multiple items with specific style
  pnpm generate-raw-image "Dragon" "Sword" "Shield" --type item --style chibi
  pnpm generate-raw-image "Wood" "Metal" "Cloth" --type material --style pixel-8bit

  # Batch generation from seed data
  pnpm generate-raw-image --batch items
  pnpm generate-raw-image --batch materials --style rubberhose
  pnpm generate-raw-image --batch all --style pixel-8bit

  # Upload to R2
  pnpm generate-raw-image "Coffee" --type material --upload
  pnpm generate-raw-image --batch materials --upload --style chibi

  # Upload with background removal
  pnpm generate-raw-image "Coffee" --type material --upload --remove-background
  pnpm generate-raw-image --batch all --upload --remove-background

  # Custom output format
  pnpm generate-raw-image "Mood Ring" --type item --format jpg --style pixel-8bit

Environment Variables Required:
  REPLICATE_API_TOKEN      Get from https://replicate.com
  OPENAI_API_KEY           Get from https://openai.com (for AI descriptions)

  For R2 upload (--upload flag):
  CLOUDFLARE_ACCOUNT_ID    Cloudflare account ID
  R2_ACCESS_KEY_ID         R2 API token with read/write access
  R2_SECRET_ACCESS_KEY     R2 API token secret

  Optional Configuration:
  REPLICATE_MODEL          Model for image generation (default: google/nano-banana)
  REFERENCE_IMAGE_URLS     Comma-separated reference image URLs
  R2_BUCKET_NAME           R2 bucket name (default: mystica-assets)
  R2_PUBLIC_URL            R2 public URL (default: hardcoded value)

Cost Estimates:
  Single image: ~$0.002-0.01 per generation (Replicate per-second billing)
  AI description: ~$0.0001-0.0005 per generation (GPT-4.1-mini)
  Background removal: ~$0.002-0.01 per image (Replicate per-second billing)
  Full batch (101 images): ~$0.20-1.00 total (images) + ~$0.01-0.05 (descriptions)
  With background removal: ~$0.40-2.00 total

Output:
  scripts/output/raw/items/       - Generated item images
  scripts/output/raw/materials/   - Generated material images
`);
    process.exit(0);
  }

  const options: Partial<GenerateRawImageOptions> = {};
  let batchMode: 'items' | 'materials' | 'all' | null = null;
  const names: string[] = [];

  // Check for batch mode first
  const batchIndex = args.indexOf('--batch');
  if (batchIndex !== -1 && args[batchIndex + 1]) {
    const batchType = args[batchIndex + 1];
    if (!['items', 'materials', 'all'].includes(batchType)) {
      console.error('❌ Invalid batch type. Choose: items, materials, or all');
      process.exit(1);
    }
    batchMode = batchType as 'items' | 'materials' | 'all';
  }

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if ((arg === '-t' || arg === '--type') && args[i + 1]) {
      const type = args[++i];
      if (type !== 'item' && type !== 'material') {
        console.error('❌ Invalid type. Choose: item or material');
        process.exit(1);
      }
      options.type = type;
    } else if (arg === '--style' && args[i + 1]) {
      const style = args[++i] as StyleName;
      if (!['rubberhose', 'chibi', 'pixel-8bit'].includes(style)) {
        console.error('❌ Invalid style. Choose: rubberhose, chibi, or pixel-8bit');
        process.exit(1);
      }
      options.style = style;
    } else if ((arg === '-f' || arg === '--format') && args[i + 1]) {
      const format = args[++i];
      if (format !== 'jpg' && format !== 'png') {
        console.error('❌ Invalid format. Choose: jpg or png');
        process.exit(1);
      }
      options.outputFormat = format;
    } else if (arg === '--upload') {
      options.uploadToR2 = true;
    } else if (arg === '--remove-background') {
      options.removeBackground = true;
    } else if (arg === '--batch') {
      i++; // Skip the batch type, already parsed
    } else if (!arg.startsWith('-')) {
      // Collect non-flag arguments as names (only if not in batch mode)
      if (!batchMode) {
        names.push(arg);
      }
    }
  }

  // Validate options
  if (options.removeBackground && !options.uploadToR2) {
    console.error('❌ --remove-background requires --upload');
    process.exit(1);
  }

  // Validate inputs
  if (batchMode) {
    // Batch mode
    await generateBatch(batchMode, options);
  } else {
    // Multiple items mode
    if (names.length === 0) {
      console.error('❌ At least one item/material name is required');
      console.error('Usage: pnpm generate-raw-image "Item Name" [more names...] --type item|material');
      process.exit(1);
    }

    if (!options.type) {
      console.error('❌ Type is required (--type item or --type material)');
      process.exit(1);
    }

    // Generate multiple items
    if (names.length > 1) {
      console.log(`\n🚀 Generating ${names.length} ${options.type}s...\n`);
    }

    const results = {
      successful: [] as string[],
      failed: [] as { name: string; error: string }[]
    };

    for (let i = 0; i < names.length; i++) {
      const name = names[i];

      if (names.length > 1) {
        console.log(`\n[${i + 1}/${names.length}] Generating: ${name}`);
        console.log('='.repeat(60));
      }

      try {
        const outputPath = await generateRawImage({
          name,
          type: options.type,
          style: options.style,
          outputFormat: options.outputFormat,
          uploadToR2: options.uploadToR2,
          removeBackground: options.removeBackground
        });
        results.successful.push(outputPath);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({ name, error: errorMsg });
        console.error(`❌ Failed to generate ${name}: ${errorMsg}`);
      }
    }

    // Summary for multiple items
    if (names.length > 1) {
      console.log('\n' + '='.repeat(60));
      console.log('GENERATION SUMMARY');
      console.log('='.repeat(60));
      console.log(`\n✅ Successful: ${results.successful.length}/${names.length}`);

      if (results.successful.length > 0) {
        console.log('\n   Generated:');
        results.successful.forEach(path => {
          console.log(`   • ${path}`);
        });
      }

      if (results.failed.length > 0) {
        console.log(`\n❌ Failed: ${results.failed.length}/${names.length}`);
        results.failed.forEach(failure => {
          console.log(`   • ${failure.name}: ${failure.error}`);
        });
      }
      console.log('\n' + '='.repeat(60));
    }
  }
}

export { generateRawImage };
export type { GenerateRawImageOptions };

// Run CLI when executed directly (not when imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await main().catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  })();
}
