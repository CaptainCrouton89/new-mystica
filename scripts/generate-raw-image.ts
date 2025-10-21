/**
 * Generate Raw Item/Material Images
 *
 * This script generates standalone item and material images with AI-generated descriptions.
 * Images are saved locally but NOT automatically uploaded to R2.
 *
 * Local Output:
 *   - Items: output/raw/items/{name}-{timestamp}.png
 *   - Materials: output/raw/materials/{name}-{timestamp}.png
 *
 * R2 Storage (manual upload required):
 *   - Items: items/{snake_case_name}.png
 *   - Materials: materials/{snake_case_name}.png
 *   - Bucket: mystica-assets
 *   - Public URL: https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev
 *
 * Manual R2 Upload:
 *   wrangler r2 object put mystica-assets/items/sword.png --file=output/raw/items/sword-*.png
 *   wrangler r2 object put mystica-assets/materials/gum.png --file=output/raw/materials/gum-*.png
 *
 * Wrangler R2 Docs:
 *   https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
 *
 * Note: generate-image.ts automatically uploads to R2 when generating missing assets.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import Replicate from 'replicate';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

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

interface GenerateRawImageOptions {
  name: string;
  type: 'item' | 'material';
  description?: string;
  outputPath?: string;
  outputFormat?: 'jpg' | 'png';
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

function buildRawPrompt(name: string, description: string, type: 'item' | 'material'): string {
  const subject = type === 'item' ? 'game item' : 'material';

  // Base prompt shared by both types
  const basePrompt = `Create a single, center-framed 1:1 ${subject}:

"${name}: ${description}"

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
    •    Volume: Strong sense of 3D mass via light, occlusion, and controlled contrast; default to a subtle 3/4 view for maximum silhouette clarity.`;

  // Type-specific composition and background
  if (type === 'item') {
    return basePrompt + `

Composition & Background (ITEM)
    •    Framing: Single hero weapon/tool/equipment, perfectly centered and clearly visible at optimal scale; crop to emphasize strong silhouette.
    •    Background: SIMPLE solid color OR clean radial/linear gradient ONLY. Choose complementary colors that make the item pop. NO patterns, NO scenes, NO textures, NO environmental elements.
    •    Sparkles/Particles: MINIMAL and SPARSE—if used at all, keep to 3-5 small white sparkles maximum. Avoid heavy particle effects.
    •    Shadow: Soft contact shadow directly beneath item only (no complex shadow effects).
    •    Border: Bold black outline around SUBJECT ONLY—absolutely NO border or frame around the image edge itself.
    •    Restrictions: NO environmental backgrounds, NO busy backgrounds, NO props, NO decorative frames, NO black borders around image edge, NO text, NO watermarks, NO logos, NO excessive glow effects.`;
  } else {
    return basePrompt + `

Composition & Background (MATERIAL)
    •    Framing: Single material/resource, perfectly centered at optimal scale—present as appropriate for the material type:
         - Physical substances: loose pile, collection, or in simple container (jar/pouch/bag)
         - Solid objects: single centered object (button, coin, shell, etc.)
         - Energy/abstract: manifestation/representation of the phenomenon (flame, lightning, star, etc.)
         - Conceptual: iconic visual representation maintaining recognizable form
    •    Background: SIMPLE solid color OR clean radial/linear gradient ONLY. Choose complementary colors that enhance the material. NO patterns, NO scenes, NO textures, NO environmental elements.
    •    Sparkles/Particles: MINIMAL and SPARSE—if used at all, keep to 3-5 small white sparkles maximum. Avoid heavy particle effects.
    •    Shadow: Soft contact shadow directly beneath ${subject} only where applicable (no complex shadow effects).
    •    Border: Bold black outline around SUBJECT ONLY—absolutely NO border or frame around the image edge itself.
    •    Restrictions: NO environmental backgrounds, NO busy backgrounds, NO props, NO decorative frames, NO black borders around image edge, NO text, NO watermarks, NO logos, NO excessive glow effects.`;
  }
}

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

  const prompt = buildRawPrompt(options.name, options.description, options.type);
  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: CONFIG.aspectRatio,
    output_format: options.outputFormat || 'png',
    image_input: CONFIG.defaultReferenceImages
  };

  console.log(`🎨 Generating with ${CONFIG.model}...`);
  console.log(`📸 Using ${CONFIG.defaultReferenceImages.length} reference images from R2`);

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

  // Convert to base64
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
  const itemsPath = path.join('docs', 'seed-data-items.json');
  const materialsPath = path.join('docs', 'seed-data-materials.json');

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
        outputFormat: options.outputFormat
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
  --batch TYPE      Batch mode: items, materials, or all
  -f, --format FMT  Output format: jpg or png (default: png)
  -h, --help        Show this help message

Configuration:
  Aspect Ratio:     1:1 (hardcoded)
  Provider:         Gemini (Nano Banana) (hardcoded)
  Reference Images: 10 R2-hosted images (hardcoded)

Examples:
  # Single generation
  pnpm generate-raw-image "Fuzzy Slippers" --type item
  pnpm generate-raw-image "Coffee" --type material

  # Multiple items
  pnpm generate-raw-image "Dragon" "Sword" "Shield" --type item
  pnpm generate-raw-image "Wood" "Metal" "Cloth" --type material

  # Batch generation from seed data
  pnpm generate-raw-image --batch items
  pnpm generate-raw-image --batch materials
  pnpm generate-raw-image --batch all

  # Custom output format
  pnpm generate-raw-image "Mood Ring" --type item --format jpg

Environment Variables Required:
  REPLICATE_API_TOKEN  Get from https://replicate.com
  OPENAI_API_KEY       Get from https://openai.com (for AI descriptions)

Cost Estimates:
  Single image: ~$0.002-0.01 per generation (Replicate per-second billing)
  AI description: ~$0.0001-0.0005 per generation (GPT-4.1-mini)
  Full batch (101 images): ~$0.20-1.00 total (images) + ~$0.01-0.05 (descriptions)

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
    } else if ((arg === '-f' || arg === '--format') && args[i + 1]) {
      const format = args[++i];
      if (format !== 'jpg' && format !== 'png') {
        console.error('❌ Invalid format. Choose: jpg or png');
        process.exit(1);
      }
      options.outputFormat = format;
    } else if (arg === '--batch') {
      i++; // Skip the batch type, already parsed
    } else if (!arg.startsWith('-')) {
      // Collect non-flag arguments as names (only if not in batch mode)
      if (!batchMode) {
        names.push(arg);
      }
    }
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
          outputFormat: options.outputFormat
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
