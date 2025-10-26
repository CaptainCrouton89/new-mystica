/**
 * Identify Items/Materials from Uploaded Image & Generate Game Assets
 *
 * This script takes an image URL (uploaded to R2) and:
 * 1. Uses AI to identify what item or material it is
 * 2. Extracts name, description, and type (item vs material)
 * 3. Uses the original image as reference + 3 style reference images
 * 4. Generates a corresponding game asset using generate-raw-image.ts
 *
 * Usage:
 *   pnpm identify-and-generate --image-url "https://r2-url/image.png"
 *   pnpm identify-and-generate --image-url "https://r2-url/image.png" --upload
 *   pnpm identify-and-generate --image-path "./local-image.png" --upload
 *
 * Output:
 *   - Identification JSON (local: output/identifications/{timestamp}.json)
 *   - Generated asset (local: output/raw/items|materials/{name}-{timestamp}.png)
 *   - R2 URLs (if --upload flag used)
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { uploadToR2 } from './r2-service.js';
import { generateRawImage } from './generate-raw-image.js';

// Load environment variables
dotenv.config({ path: '.env.local', override: true });

// Runtime validation for required env vars
function validateRequiredEnvVars(): void {
  const required = [
    'OPENAI_API_KEY',
    'REPLICATE_API_TOKEN',
    'REPLICATE_MODEL',
    'REFERENCE_IMAGE_URLS'
  ];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Validate on module load
validateRequiredEnvVars();

// Load seed data for context
interface SeedItem {
  id: string;
  name: string;
  description?: string;
}

interface SeedData {
  items?: SeedItem[];
  materials?: SeedItem[];
}

function loadSeedData(): { items: SeedItem[]; materials: SeedItem[] } {
  const itemsPath = path.join('..', 'docs', 'seed-data-items.json');
  const materialsPath = path.join('..', 'docs', 'seed-data-materials.json');

  let items: SeedItem[] = [];
  let materials: SeedItem[] = [];

  if (fs.existsSync(itemsPath)) {
    const itemsData: SeedData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
    items = itemsData.items || [];
  }

  if (fs.existsSync(materialsPath)) {
    const materialsData: SeedData = JSON.parse(fs.readFileSync(materialsPath, 'utf-8'));
    materials = materialsData.materials || [];
  }

  return { items, materials };
}

// Identification schema
const identificationSchema = z.object({
  name: z.string().describe('The name of the item or material identified in the image'),
  type: z.enum(['item', 'material']).describe('Whether this is an item or material'),
  description: z.string().describe('A concise one-sentence physical description suitable for game asset generation')
});

type Identification = z.infer<typeof identificationSchema>;

// System prompt with examples from seed data
function buildIdentificationSystemPrompt(items: SeedItem[], materials: SeedItem[]): string {
  const itemExamples = items.slice(0, 5).map(i => `- "${i.name}"`).join('\n');
  const materialExamples = materials.slice(0, 5).map(m => `- "${m.name}"`).join('\n');

  return `You are an AI assistant specialized in identifying game items and materials from images.

Your task: Given an image, identify what it represents and classify it as either an "item" (equipment, weapons, accessories, pets) or a "material" (crafting resources, elemental essences, substances).

Item examples in our game:
${itemExamples}

Material examples in our game:
${materialExamples}

Guidelines:
1. Identify the real-world or fantastical object in the image
2. Classify as ITEM if it's equipment, gear, weapons, or collectibles
3. Classify as MATERIAL if it's a raw resource, elemental essence, or crafting ingredient
4. Provide a concise physical description (8-15 words) suitable for generating a game asset—describe only the object itself, excluding any background, environment, or setting
5. Be confident in your assessment, but note lower confidence for ambiguous images
6. Handle pop culture references by describing their iconic visual form`;
}

async function identifyFromImage(imageUrl: string, seedData: { items: SeedItem[]; materials: SeedItem[] }): Promise<Identification> {
  console.log(`\n🔍 Identifying item/material from image...`);
  console.log(`📸 Image URL: ${imageUrl}`);

  const systemPrompt = buildIdentificationSystemPrompt(seedData.items, seedData.materials);

  // Use vision capabilities with message format
  const { object } = await generateObject({
    model: openai('gpt-4.1'),
    schema: identificationSchema,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            image: imageUrl
          },
          {
            type: 'text',
            text: 'Identify this item or material and provide the details.'
          }
        ]
      }
    ]
  });

  console.log(`✅ Identification:
  Name: ${object.name}
  Type: ${object.type}
  Description: ${object.description}`);

  return object;
}

/**
 * Select 3 style reference images from the configured reference images
 * These provide "style guidance" without including the original image
 */
function selectStyleReferences(uploadedImageUrl: string): string[] {
  const referenceUrls = process.env.REFERENCE_IMAGE_URLS!.split(',').map(url => url.trim());

  if (referenceUrls.length === 0) {
    throw new Error('No reference images configured in REFERENCE_IMAGE_URLS');
  }

  // Shuffle and pick first 3
  const shuffled = [...referenceUrls].sort(() => Math.random() - 0.5);
  const styleReferences = shuffled.slice(0, Math.min(3, shuffled.length));

  console.log(`\n📸 Reference images selected:`);
  // console.log(`  Original: ${uploadedImageUrl}`);
  styleReferences.forEach((url, i) => {
    console.log(`  Style ${i + 1}: ${url}`);
  });

  return styleReferences;
}

interface IdentificationResult {
  name: string;
  type: 'item' | 'material';
  description: string;
  imageUrl: string;
  timestamp: number;
}

async function saveIdentification(result: IdentificationResult): Promise<string> {
  const outputDir = path.join('output', 'identifications');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, `identification-${result.timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));

  console.log(`\n💾 Identification saved to: ${filePath}`);
  return filePath;
}

interface GenerationOptions {
  imageUrl: string;
  uploadToR2?: boolean;
  removeBackground?: boolean;
  outputFormat?: 'jpg' | 'png';
}

async function identifyAndGenerate(options: GenerationOptions): Promise<void> {
  const seedData = loadSeedData();
  const timestamp = Date.now();

  try {
    // Step 1: Identify from image
    const identification = await identifyFromImage(options.imageUrl, seedData);

    // Save identification record
    await saveIdentification({
      name: identification.name,
      type: identification.type,
      description: identification.description,
      imageUrl: options.imageUrl,
      timestamp
    });

    // Step 2: Select reference images (original + 3 style guides)
    const referenceImages = selectStyleReferences(options.imageUrl);

    // Step 3: Override REFERENCE_IMAGE_URLS for this generation
    const originalReferenceUrls = process.env.REFERENCE_IMAGE_URLS;
    process.env.REFERENCE_IMAGE_URLS = referenceImages.join(',');

    console.log(`\n🎨 Generating asset for: ${identification.name}`);
    console.log(`   Type: ${identification.type}`);

    // Step 4: Generate the game asset using generate-raw-image
    try {
      await generateRawImage({
        name: identification.name,
        type: identification.type,
        description: identification.description,
        uploadToR2: options.uploadToR2,
        removeBackground: options.removeBackground,
        outputFormat: options.outputFormat || 'png'
      });

      console.log(`\n✨ Complete! Asset generated for ${identification.name}`);
    } finally {
      // Restore original reference URLs
      process.env.REFERENCE_IMAGE_URLS = originalReferenceUrls;
    }

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

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Mystica Identify & Generate from Image

Identifies items/materials from an uploaded image and generates corresponding game assets.

Usage:
  pnpm identify-and-generate --image-url "https://r2-url/image.png" [options]
  pnpm identify-and-generate --image-path "./local-image.png" [options]

Arguments:
  --image-url URL      Public URL to image (R2 or other CDN)
  --image-path PATH    Local file path (will be read as base64 data URL)

Options:
  --upload             Upload generated asset to R2
  --remove-background  Remove background from asset (requires --upload)
  -f, --format FMT     Output format: jpg or png (default: png)
  -h, --help           Show this help message

Workflow:
  1. Analyzes the image to identify item/material
  2. Saves identification metadata locally
  3. Uses original image as primary reference + 3 style guides
  4. Generates game asset matching the identified item/material

Examples:
  # Identify and generate (local only)
  pnpm identify-and-generate --image-url "https://pub-xxx.r2.dev/uploads/sword.png"

  # Upload to R2
  pnpm identify-and-generate --image-url "https://pub-xxx.r2.dev/uploads/coffee.png" --upload

  # With background removal
  pnpm identify-and-generate --image-url "https://..." --upload --remove-background

  # From local file
  pnpm identify-and-generate --image-path "./my-item.png" --upload

Environment Variables:
  OPENAI_API_KEY                For image identification
  REPLICATE_API_TOKEN           For asset generation
  REPLICATE_MODEL               Model for generation (default: google/nano-banana)
  REFERENCE_IMAGE_URLS          Style reference images (comma-separated)

  For R2 upload (--upload flag):
  CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY

Output:
  Identifications:  output/identifications/{timestamp}.json
  Generated Assets: output/raw/items|materials/{name}-{timestamp}.png
  R2 URLs:         (printed to console if --upload used)
`);
    process.exit(0);
  }

  const options: GenerationOptions & { imageUrl?: string; imagePath?: string } = {};
  let imageUrl: string | null = null;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if ((arg === '--image-url' || arg === '-u') && args[i + 1]) {
      imageUrl = args[++i];
    } else if ((arg === '--image-path' || arg === '-p') && args[i + 1]) {
      const filePath = args[++i];
      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
      }
      const buffer = fs.readFileSync(filePath);
      imageUrl = `data:image/png;base64,${buffer.toString('base64')}`;
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
    }
  }

  // Validate
  if (!imageUrl) {
    console.error('❌ Image URL or path is required');
    console.error('Usage: pnpm identify-and-generate --image-url "url" or --image-path "path"');
    process.exit(1);
  }

  if (options.removeBackground && !options.uploadToR2) {
    console.error('❌ --remove-background requires --upload');
    process.exit(1);
  }

  options.imageUrl = imageUrl;
  await identifyAndGenerate(options);
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

export { identifyAndGenerate, identifyFromImage, selectStyleReferences };
export type { Identification, GenerationOptions };
