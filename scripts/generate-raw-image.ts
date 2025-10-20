import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import Replicate from 'replicate';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local', override: true });

// Hardcoded configuration
const CONFIG = {
  aspectRatio: '1:1' as const,
  provider: 'gemini' as const,
  model: 'google/nano-banana',
  defaultReferenceImages: [
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/ref-1.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/ref-2.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/ref-3.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/ref-4.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/ref-5.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_0821.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_2791.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_4317.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_5508.png',
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/IMG_9455.png'
  ]
};

interface GenerateRawImageOptions {
  name: string;
  type: 'item' | 'material';
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

function buildRawPrompt(name: string, type: 'item' | 'material'): string {
  const subject = type === 'item' ? 'game item' : 'material';

  return `Create a single, center-framed 1:1 ${subject}:

"${name}"

This illustration in a polished, high-detail "chibi"/super-deformed aesthetic typical of mobile RPGs and CCGs.

Core Look
    •    Color: Vivid, high-saturation palette; punchy local colors with clean hue separation. Keep values readable; avoid muddy midtones.
    •    Lighting: Clear, soft key light with gentle fill; minimal deep shadow. Add a crisp rim light to separate from the background.
    •    Glow & Highlights: Tasteful outer glow/halo to signal rarity or power. Use tight, glossy specular highlights on hard materials; soft bloom on emissive parts.

Line & Form
    •    Outlines: Bold, uniform, and clean to carve a strong silhouette; no sketchy linework.
    •    Proportions: Chunky, simplified, and slightly exaggerated shapes for instant readability.
    •    Texture: Suggestive, not photoreal—hint at materials (wood grain, brushed metal, facets) with tidy, deliberate marks.
    •    Simplicity: Keep the object itself straightforward—no unnecessary gems, ornaments, or extra decorative elements added to the item.

Shading & Depth
    •    Render Style: Hybrid cel + soft gradients; sharp edge transitions only where they improve clarity.
    •    Volume: Strong sense of 3D mass via light, occlusion, and controlled contrast; default to a subtle 3/4 view.

Composition & Background
    •    Framing: Single hero object, centered; crop to emphasize silhouette.
    •    Background: Simple radial gradient or soft vignette; optional light particle specks. No props or scene unless specified.
    •    Polish: Soft contact shadow beneath ${subject}; no text, watermarks, borders, or logos.`;
}

async function generateImageWithReplicate(
  options: GenerateRawImageOptions
): Promise<string> {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN not found in .env.local');
  }

  const replicate = new Replicate({ auth: apiToken });

  const prompt = buildRawPrompt(options.name, options.type);
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
    const imageBase64 = await generateImageWithReplicate(options);

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

Generate standalone item/material images without fusion logic.

Usage:
  pnpm generate-raw-image "Item Name" --type item|material [options]
  pnpm generate-raw-image --batch items|materials|all [options]

Arguments:
  Name              The name of the item or material (required for single mode)
  --type TYPE       Type: item or material (required for single mode)

Options:
  --batch TYPE      Batch mode: items, materials, or all
  -o, --output PATH Output file path (single mode only)
  -f, --format FMT  Output format: jpg or png (default: png)
  -h, --help        Show this help message

Configuration:
  Aspect Ratio:     1:1 (hardcoded)
  Provider:         Gemini (Nano Banana) (hardcoded)
  Reference Images: 5 R2-hosted images (hardcoded)

Examples:
  # Single generation
  pnpm generate-raw-image "Fuzzy Slippers" --type item
  pnpm generate-raw-image "Coffee" --type material

  # Batch generation
  pnpm generate-raw-image --batch items
  pnpm generate-raw-image --batch materials
  pnpm generate-raw-image --batch all

  # Custom output format
  pnpm generate-raw-image "Mood Ring" --type item --format jpg

Environment Variables Required:
  REPLICATE_API_TOKEN  Get from https://replicate.com

Cost Estimates:
  Single image: ~$0.002-0.01 per generation (Replicate per-second billing)
  Full batch (101 images): ~$0.20-1.00 total

Output:
  scripts/output/raw/items/       - Generated item images
  scripts/output/raw/materials/   - Generated material images
`);
    process.exit(0);
  }

  const options: Partial<GenerateRawImageOptions> = {};
  let batchMode: 'items' | 'materials' | 'all' | null = null;
  let name: string | null = null;

  // Check for batch mode first
  const batchIndex = args.indexOf('--batch');
  if (batchIndex !== -1 && args[batchIndex + 1]) {
    const batchType = args[batchIndex + 1];
    if (!['items', 'materials', 'all'].includes(batchType)) {
      console.error('❌ Invalid batch type. Choose: items, materials, or all');
      process.exit(1);
    }
    batchMode = batchType as 'items' | 'materials' | 'all';
  } else {
    // Single mode - first arg should be name
    if (!args[0].startsWith('-')) {
      name = args[0];
    }
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
    } else if ((arg === '-o' || arg === '--output') && args[i + 1]) {
      options.outputPath = args[++i];
    } else if ((arg === '-f' || arg === '--format') && args[i + 1]) {
      const format = args[++i];
      if (format !== 'jpg' && format !== 'png') {
        console.error('❌ Invalid format. Choose: jpg or png');
        process.exit(1);
      }
      options.outputFormat = format;
    } else if (arg === '--batch') {
      i++; // Skip the batch type, already parsed
    }
  }

  // Validate inputs
  if (batchMode) {
    // Batch mode
    if (options.outputPath) {
      console.error('❌ Custom output path (-o) cannot be used with batch mode');
      process.exit(1);
    }

    await generateBatch(batchMode, options);
  } else {
    // Single mode
    if (!name) {
      console.error('❌ Item/material name is required');
      console.error('Usage: pnpm generate-raw-image "Item Name" --type item|material');
      process.exit(1);
    }

    if (!options.type) {
      console.error('❌ Type is required (--type item or --type material)');
      process.exit(1);
    }

    await generateRawImage({
      name,
      type: options.type,
      outputPath: options.outputPath,
      outputFormat: options.outputFormat
    });
  }
}

export { generateRawImage };
export type { GenerateRawImageOptions };

// Run CLI when executed directly
(async () => {
  await main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
})();
