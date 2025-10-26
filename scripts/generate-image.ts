import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import Replicate from 'replicate';
import { generateItemDescription } from './generate-item-description.js';
import { generateRawImage } from './generate-raw-image.js';
import { checkR2AssetExists, getR2AssetUrl, uploadToR2, getMultipleAssetUrls } from './r2-service.js';
import { getStyle, getDefaultStyle, StyleName, hasStyle } from './styles/index.js';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local', override: true });

type Provider = 'gemini' | 'seedream-4';
type AspectRatio = '1:1' | '2:3' | '3:2' | '4:3' | '9:16' | '16:9';

interface GenerateImageOptions {
  itemName?: string;
  itemDescription?: string;
  itemType?: string;
  materials?: string[];
  provider?: Provider;
  providers?: Provider[];
  outputPath?: string;
  aspectRatio?: AspectRatio;
  referenceImages?: string[];
  outputFormat?: 'jpg' | 'png';
  style?: StyleName;
}

async function generateImageWithReplicate(
  model: string,
  options: GenerateImageOptions
): Promise<string> {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN not found in .env.local');
  }

  const replicate = new Replicate({ auth: apiToken });

  let modelName: string;
  if (!options.itemName || !options.itemDescription) {
    throw new Error('Name and description are required');
  }

  // Get style (use default if not specified)
  const style = options.style ? getStyle(options.style) : getDefaultStyle();
  console.log(`🎨 Using style: ${style.config.displayName} (${style.config.name})`);

  // Build prompt using style's item prompt builder
  const prompt = style.prompts.buildItemPrompt(options.itemName, options.itemDescription);
  const input: Record<string, unknown> = { prompt };

  // Validate reference image URLs
  const validateReferenceImages = (imageUrls: string[]): string[] => {
    console.log(`Validating ${imageUrls.length} reference image URL(s)...`);

    for (const url of imageUrls) {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error(`Invalid reference image URL: ${url}. Only HTTP/HTTPS URLs are supported.`);
      }
      console.log(`  ✓ ${url}`);
    }

    return imageUrls;
  };

  if (model === 'gemini') {
    modelName = 'google/nano-banana';
    console.log(`🎨 Generating with ${modelName} (Nano Banana)...`);

    // Nano Banana parameters
    if (options.aspectRatio) {
      input.aspect_ratio = options.aspectRatio;
    }

    input.output_format = options.outputFormat || 'png';

    // Combine style reference images with item/material reference images
    const allReferenceImages = [
      ...style.config.referenceImages,
      ...(options.referenceImages || [])
    ];

    // Add reference images if available
    if (allReferenceImages.length > 0) {
      input.image_input = validateReferenceImages(allReferenceImages);
    }
  } else if (model === 'seedream-4') {
    modelName = 'bytedance/seedream-4';
    console.log(`🎨 Generating with ${modelName}...`);

    // Seedream-specific parameters
    input.width = 1024;
    input.height = 1024;
    input.max_images = 1;
    input.sequential_image_generation = 'disabled';

    // Combine style reference images with item/material reference images
    const allReferenceImages = [
      ...style.config.referenceImages,
      ...(options.referenceImages || [])
    ];

    // Add reference images if available
    if (allReferenceImages.length > 0) {
      input.image_input = validateReferenceImages(allReferenceImages);
    }
  } else {
    throw new Error(`Unknown provider: ${model}. Use 'gemini' or 'seedream-4'`);
  }

  // Run prediction
  const output = await replicate.run(modelName as `${string}/${string}`, { input }) as { url?: () => string } | { url?: () => string }[] | null | undefined;

  // Handle output - both Nano Banana and Seedream return objects with url() method
  let imageUrl: string;

  if (!output) {
    throw new Error('No output returned from Replicate');
  }

  if (typeof output.url === 'function') {
    // Nano Banana returns object with url() method
    imageUrl = output.url();
  } else if (Array.isArray(output) && output.length > 0) {
    // Seedream returns array of objects with url() method
    if (!output[0]) {
      throw new Error('First output item is undefined');
    }
    imageUrl = typeof output[0].url === 'function' ? output[0].url() : output[0];
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

async function generateImageSingle(
  provider: Provider,
  options: GenerateImageOptions,
  timestamp: number
): Promise<{ provider: Provider; path: string }> {
  console.log(`\n🎨 Generating with ${provider}...`);

  try {
    // All providers now use Replicate
    const imageBase64 = await generateImageWithReplicate(provider, options);

    // Decode base64 and save
    const buffer = Buffer.from(imageBase64, 'base64');

    const outputPath = options.outputPath || path.join(
      'scripts',
      'output',
      `${provider}-${timestamp}.${options.outputFormat || 'png'}`
    );

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, buffer);

    console.log(`✅ [${provider}] Image saved to: ${outputPath}`);

    // Show cost information
    if (provider === 'gemini') {
      console.log(`💰 [${provider}] Cost: Variable (Replicate per-second billing)`);
    } else if (provider === 'seedream-4') {
      console.log(`💰 [${provider}] Cost: Variable (Replicate per-second billing)`);
    }

    return { provider, path: outputPath };

  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ [${provider}] Error:`, error.message);
      throw error;
    }
    throw new Error('Unknown error occurred');
  }
}

async function generateImage(options: GenerateImageOptions): Promise<void> {
  let itemName: string;
  let itemDescription: string;

  // Generate item name and description if itemType and materials are provided
  if (options.itemType && options.materials) {
    console.log('🤖 Generating item name and description using AI...');
    console.log(`Item Type: ${options.itemType}`);
    console.log(`Materials: ${options.materials.join(', ')}`);

    const generated = await generateItemDescription({
      itemType: options.itemType,
      materials: options.materials
    });

    itemName = generated.name;
    itemDescription = generated.description;

    console.log(`\n✅ Generated Name: ${itemName}`);
    console.log(`✅ Generated Description: ${itemDescription}\n`);
  } else if (options.itemName && options.itemDescription) {
    // Use provided name and description
    itemName = options.itemName;
    itemDescription = options.itemDescription;
  } else {
    throw new Error('Either provide (itemType + materials) or (itemName + itemDescription)');
  }

  console.log('Item Name:', itemName);
  console.log('Description:', itemDescription);
  console.log('Aspect Ratio:', options.aspectRatio || '1:1');

  // Check R2 for item and materials, generate if missing
  let referenceImages: string[] = [];

  if (options.itemType && options.materials) {
    console.log('\n🔍 Checking R2 for existing assets...');

    // Check if item type exists in R2
    const itemExists = await checkR2AssetExists(options.itemType, 'item');
    console.log(`  Item "${options.itemType}": ${itemExists ? '✓ exists' : '✗ missing'}`);

    // Check which materials exist in R2
    const materialUrls = await getMultipleAssetUrls(options.materials, 'material');
    const missingMaterials = options.materials.filter(m => !materialUrls.has(m));

    options.materials.forEach(material => {
      console.log(`  Material "${material}": ${materialUrls.has(material) ? '✓ exists' : '✗ missing'}`);
    });

    // Generate missing assets in parallel
    const generationTasks: Promise<{ name: string; type: 'item' | 'material'; path: string; url: string }>[] = [];

    if (!itemExists) {
      console.log(`\n🎨 Generating missing item: ${options.itemType}`);
      generationTasks.push(
        generateRawImage({
          name: options.itemType,
          type: 'item',
          outputFormat: 'png',
          style: options.style
        }).then(async (path) => {
          const url = await uploadToR2(path, options.itemType!, 'item');
          return { name: options.itemType!, type: 'item' as const, path, url };
        })
      );
    }

    if (missingMaterials.length > 0) {
      console.log(`\n🎨 Generating ${missingMaterials.length} missing material(s) in parallel...`);
      for (const material of missingMaterials) {
        generationTasks.push(
          generateRawImage({
            name: material,
            type: 'material',
            outputFormat: 'png',
            style: options.style
          }).then(async (path) => {
            const url = await uploadToR2(path, material, 'material');
            return { name: material, type: 'material' as const, path, url };
          })
        );
      }
    }

    if (generationTasks.length > 0) {
      console.log(`\n⏳ Running ${generationTasks.length} generation task(s) in parallel...\n`);
      const results = await Promise.all(generationTasks);

      console.log('\n✅ All missing assets generated and uploaded to R2:');
      results.forEach(result => {
        console.log(`   • ${result.type}: ${result.name} → ${result.url}`);
      });
    }

    // Collect all reference image URLs from R2
    console.log('\n📸 Collecting reference images from R2...');

    // Get item URL
    const itemUrl = await getR2AssetUrl(options.itemType, 'item');
    referenceImages.push(itemUrl);
    console.log(`   • Item: ${itemUrl}`);

    // Get all material URLs (refresh in case we just uploaded)
    const allMaterialUrls = await getMultipleAssetUrls(options.materials, 'material');
    for (const [material, url] of allMaterialUrls.entries()) {
      referenceImages.push(url);
      console.log(`   • Material (${material}): ${url}`);
    }

    console.log(`\n✅ Using ${referenceImages.length} reference images from R2`);
  } else if (options.referenceImages && options.referenceImages.length > 0) {
    // Use manually provided reference images
    referenceImages = options.referenceImages;
    console.log(`Reference images: ${options.referenceImages.length}`);
  }

  // Determine which providers to use
  const providers: Provider[] = options.providers
    ? options.providers
    : options.provider
    ? [options.provider]
    : ['gemini'];

  console.log(`Providers: ${providers.join(', ')}`);

  const timestamp = Date.now();

  try {
    if (providers.length === 1) {
      // Single provider - sequential
      await generateImageSingle(providers[0], { ...options, itemName, itemDescription, referenceImages }, timestamp);
    } else {
      // Multiple providers - parallel generation
      console.log(`\n🚀 Starting parallel generation with ${providers.length} providers...\n`);

      const results = await Promise.allSettled(
        providers.map(provider => generateImageSingle(provider, { ...options, itemName, itemDescription, referenceImages }, timestamp))
      );

      // Summary
      console.log('\n' + '='.repeat(60));
      console.log('GENERATION SUMMARY');
      console.log('='.repeat(60));

      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      console.log(`\n✅ Successful: ${successful.length}/${providers.length}`);
      successful.forEach((result) => {
        if (result.status === 'fulfilled') {
          console.log(`   • ${result.value.provider}: ${result.value.path}`);
        }
      });

      if (failed.length > 0) {
        console.log(`\n❌ Failed: ${failed.length}/${providers.length}`);
        failed.forEach((result, index) => {
          if (result.status === 'rejected') {
            const provider = providers[successful.length + index];
            console.log(`   • ${provider}: ${result.reason}`);
          }
        });
      }

      console.log('\n' + '='.repeat(60));
    }

  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Fatal error:', error.message);
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
Mystica Item Image Generator

Usage (AI-Generated):
  pnpm generate-image --type "Item Type" --materials "material1,material2,material3" [options]

Usage (Manual):
  pnpm generate-image "Item Name" "Item Description" [options]

Options:
  -t, --type TYPE           Item type (e.g., "Magic Wand", "Robot Dog") - triggers AI generation
  -m, --materials MAT,...   1-3 materials (comma-separated) - required with --type
  -s, --style STYLE         Visual style: rubberhose, chibi, pixel-8bit (default: rubberhose)
  -p, --provider PROVIDER   Single provider: gemini, seedream-4 (default: gemini)
  --providers PROVIDER,...  Multiple providers (comma-separated, runs in parallel)
  --all                     Use all providers (gemini, seedream-4)
  -r, --reference URL,...   Reference image URLs for style (comma-separated URLs)
  -o, --output PATH         Output file path (single provider only)
  -a, --aspect-ratio RATIO  Aspect ratio: 1:1, 2:3, 3:2, 4:3, 9:16, 16:9 (default: 1:1)
  -f, --format FORMAT       Output format: jpg, png (default: png)
  -h, --help                Show this help message

Styles:
  rubberhose   1930s Rubber Hose animation (Cuphead-inspired) - thick outlines, vintage colors [DEFAULT]
  chibi        Polished mobile RPG/CCG aesthetic - vivid colors, high detail
  pixel-8bit   Retro 8-bit/16-bit pixel art - visible pixels, limited palette

Providers:
  gemini       Google Nano Banana (Gemini 2.5 Flash) - Best for style reference & consistency
  seedream-4   ByteDance Seedream 4 - Advanced style transfer with reference images

Examples:
  # Generate with AI (automatic name & description)
  pnpm generate-image --type "Magic Wand" --materials "wood,crystal"
  pnpm generate-image --type "Robot Dog" --materials "metal,screws,plastic"
  pnpm generate-image --type "Amulet" --materials "hello kitty,wizard hat,matcha powder"

  # Generate with different styles
  pnpm generate-image --type "Fire Staff" --materials "wood,ruby" --style chibi
  pnpm generate-image --type "Ice Shield" --materials "crystal,steel" --style pixel-8bit
  pnpm generate-image --type "Health Potion" --materials "glass,herbs" --style rubberhose

  # Generate with manual name and description
  pnpm generate-image "Kitty Pepe Blade" "The sword has a sleek metal blade"

  # AI generation with style reference URLs
  pnpm generate-image --type "Fire Staff" --materials "wood,ruby" -r https://example.com/ref1.png,https://example.com/ref2.png

  # Compare providers with AI generation
  pnpm generate-image --type "Ice Shield" --materials "crystal,steel" --all

  # Custom aspect ratio
  pnpm generate-image --type "Banner Flag" --materials "silk,gold" -a 2:3

Environment Variables Required:
  REPLICATE_API_TOKEN  Get from https://replicate.com
  OPENAI_API_KEY       Get from https://openai.com (for AI generation)

Cost Estimates:
  Image generation: Variable (Replicate per-second billing)
  AI description: ~$0.0001-0.0005 per generation (GPT-4.1-mini)

Note: All images use the selected visual style (default: rubberhose). Change with --style flag.
`);
    process.exit(0);
  }

  const options: GenerateImageOptions = {};

  // Check if first arg is a flag or a positional argument
  const firstArgIsFlag = args[0].startsWith('-');

  if (!firstArgIsFlag && args.length >= 2) {
    // Manual mode: first two args are name and description
    options.itemName = args[0];
    options.itemDescription = args[1];
  }

  // Parse arguments
  const startIndex = firstArgIsFlag ? 0 : 2;
  for (let i = startIndex; i < args.length; i++) {
    const arg = args[i];

    if ((arg === '-t' || arg === '--type') && args[i + 1]) {
      options.itemType = args[++i];
    } else if ((arg === '-m' || arg === '--materials') && args[i + 1]) {
      const materialsStr = args[++i];
      options.materials = materialsStr.split(',').map(m => m.trim());

      if (options.materials.length < 1 || options.materials.length > 3) {
        console.error('❌ Materials must contain between 1 and 3 items');
        process.exit(1);
      }
    } else if ((arg === '-s' || arg === '--style') && args[i + 1]) {
      const style = args[++i] as StyleName;
      if (!hasStyle(style)) {
        console.error(`❌ Invalid style: ${style}. Available styles: rubberhose, chibi, pixel-8bit`);
        process.exit(1);
      }
      options.style = style;
    } else if ((arg === '-p' || arg === '--provider') && args[i + 1]) {
      const provider = args[++i] as Provider;
      if (!['gemini', 'seedream-4'].includes(provider)) {
        console.error('Invalid provider. Choose: gemini or seedream-4');
        process.exit(1);
      }
      options.provider = provider;
    } else if (arg === '--providers' && args[i + 1]) {
      const providersStr = args[++i];
      const providers = providersStr.split(',').map(p => p.trim()) as Provider[];

      // Validate all providers
      for (const provider of providers) {
        if (!['gemini', 'seedream-4'].includes(provider)) {
          console.error(`Invalid provider: ${provider}. Choose: gemini or seedream-4`);
          process.exit(1);
        }
      }

      options.providers = providers;
    } else if (arg === '--all') {
      options.providers = ['gemini', 'seedream-4'];
    } else if ((arg === '-r' || arg === '--reference') && args[i + 1]) {
      const referencesStr = args[++i];
      options.referenceImages = referencesStr.split(',').map(p => p.trim());
    } else if ((arg === '-o' || arg === '--output') && args[i + 1]) {
      options.outputPath = args[++i];
    } else if ((arg === '-a' || arg === '--aspect-ratio') && args[i + 1]) {
      options.aspectRatio = args[++i] as AspectRatio;
    } else if ((arg === '-f' || arg === '--format') && args[i + 1]) {
      const format = args[++i];
      if (format !== 'jpg' && format !== 'png') {
        console.error('Invalid format. Choose: jpg or png');
        process.exit(1);
      }
      options.outputFormat = format;
    }
  }

  // Validate custom output path only with single provider
  if (options.outputPath && (options.providers && options.providers.length > 1)) {
    console.error('❌ Custom output path (-o) cannot be used with multiple providers');
    process.exit(1);
  }

  // Validate that we have either (itemType + materials) or (itemName + itemDescription)
  const hasAiInputs = options.itemType && options.materials;
  const hasManualInputs = options.itemName && options.itemDescription;

  if (!hasAiInputs && !hasManualInputs) {
    console.error('❌ Either provide --type and --materials (AI mode) or "Item Name" "Description" (manual mode)');
    process.exit(1);
  }

  if (hasAiInputs && hasManualInputs) {
    console.error('❌ Cannot use both AI mode (--type/--materials) and manual mode (name/description) simultaneously');
    process.exit(1);
  }

  await generateImage(options);
}

export { generateImage };
export type { GenerateImageOptions };

// Run CLI when executed directly
(async () => {
  await main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
})();
