/**
 * Generate Raw Monster Images
 *
 * This script generates standalone monster images with AI-generated descriptions.
 * Images are saved locally but NOT automatically uploaded to R2.
 *
 * Local Output:
 *   - Monsters: output/raw/monsters/{name}-{timestamp}.png
 *
 * R2 Storage (manual upload required):
 *   - Monsters: monsters/{snake_case_name}.png
 *   - Bucket: mystica-assets
 *   - Public URL: https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev
 *
 * Manual R2 Upload:
 *   wrangler r2 object put mystica-assets/monsters/spray_paint_goblin.png --file=output/raw/monsters/spray_paint_goblin-*.png
 *
 * Wrangler R2 Docs:
 *   https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import Replicate from 'replicate';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { uploadToR2 } from './r2-service';

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

interface GenerateRawMonsterOptions {
  name: string;
  description?: string;
  personalityTraits?: string[];
  dialogueTone?: string;
  outputPath?: string;
  outputFormat?: 'jpg' | 'png';
  uploadToR2?: boolean;
  removeBackground?: boolean;
}

interface SeedMonster {
  id: string;
  name: string;
  description?: string;
  personality_traits?: string[];
  dialogue_tone?: string;
}

interface SeedData {
  monsters?: SeedMonster[];
}

const rawMonsterDescriptionSchema = z.object({
  description: z.string().describe('A concise one-sentence physical description of the monster for image generation')
});

const RAW_MONSTER_DESCRIPTION_SYSTEM_PROMPT = `You are generating concise visual descriptions for game monsters to be used in image generation prompts.

Your task: Given a monster name, personality traits, and existing description, write ONE sentence describing what it looks like physically.

Guidelines:
- Focus purely on visual/physical appearance (body shape, features, colors, size)
- Keep it short and vivid - aim for 10-20 words
- Avoid personality, behavior, or combat abilities
- Be specific about creature type, key visual features, and color palette
- Incorporate personality traits as visual details (e.g., "sarcastic" → smirking expression)
- Make it stand out with unique visual characteristics

Examples:
- "Spray Paint Goblin" + "street-smart, sarcastic, tagging everything" → "small green goblin covered in rainbow paint splatters, holding spray cans, with a mischievous grin"
- "Goopy Floating Eye" + "all-seeing, condescending, dripping ooze" → "large floating eyeball dripping green slime, with a judgmental iris and trailing goo"
- "Feral Unicorn" + "wild, magical but violent, sparkles and rage" → "white unicorn with glowing rainbow mane, fierce red eyes, horn crackling with chaotic energy"
- "Bipedal Deer" + "forest-wise, eerily human-like, territorial" → "tall upright deer with antlers, human-like arms, intense knowing eyes, mossy green fur"
- "Politician" + "manipulative, eloquent but dishonest, campaign speech" → "smiling human in expensive suit, unnaturally perfect teeth, carrying briefcase and American flag pin"

Output only the description.`;

async function generateMonsterDescription(
  name: string,
  personalityTraits?: string[],
  existingDescription?: string
): Promise<string> {
  const traitsText = personalityTraits ? personalityTraits.join(', ') : 'none provided';
  const descText = existingDescription || 'none provided';
  const prompt = `Monster Name: ${name}\nPersonality Traits: ${traitsText}\nExisting Description: ${descText}`;

  const { object } = await generateObject({
    model: openai('gpt-4.1-mini'),
    schema: rawMonsterDescriptionSchema,
    system: RAW_MONSTER_DESCRIPTION_SYSTEM_PROMPT,
    prompt,
  });

  return object.description;
}

function buildMonsterPrompt(name: string, description: string): string {
  return `Create a single, center-framed 1:1 game monster character:

"${name}: ${description}"

This illustration in a polished, high-detail "chibi"/super-deformed aesthetic typical of mobile RPGs and CCGs.

Core Look
    •    Color: Vivid, high-saturation palette; punchy local colors with clean hue separation. Keep values readable; avoid muddy midtones.
    •    Lighting: Clear, consistent key light with crisp fill; controlled shadows for depth. Add a strong rim light to separate from the background.
    •    Glow & Highlights: MINIMAL outer glow/halo (very subtle and sparse). Use tight, glossy specular highlights on hard materials; soft bloom on emissive parts only where essential.
    •    Border: Bold black outline ONLY around the character itself—NOT around the image edge. This outline defines the character's silhouette for strong separation.

Line & Form
    •    Outlines: Bold, uniform black border carving a strong silhouette around the CHARACTER ONLY; no sketchy linework. No frame or border around the image edge.
    •    Proportions: Chunky, simplified, and slightly exaggerated shapes for instant readability and strong silhouette. Big heads, expressive eyes, compact bodies.
    •    Texture: Suggestive, not photoreal—hint at fur, scales, slime, skin with tidy, deliberate marks. Avoid excessive texture detail.
    •    Simplicity: Keep the character design straightforward—no unnecessary accessories, props, or overly complex details unless essential to character identity. Stylized over realistic.

Shading & Depth
    •    Render Style: Hybrid cel + soft gradients; sharp edge transitions only where they improve clarity.
    •    Volume: Strong sense of 3D mass via light, occlusion, and controlled contrast; default to a subtle 3/4 view for maximum silhouette clarity.

Composition & Background (MONSTER)
    •    Framing: Single character perfectly centered and clearly visible at optimal scale; crop to emphasize strong silhouette and character personality.
    •    Pose: Dynamic action pose or idle stance showing character personality and combat readiness. Expressive face and body language.
    •    Background: SIMPLE solid color OR clean radial/linear gradient ONLY. Choose complementary colors that make the monster pop. NO patterns, NO scenes, NO textures, NO environmental elements.
    •    Sparkles/Particles: MINIMAL and SPARSE—if used at all, keep to 3-5 small white sparkles or character-relevant effects (slime drips, paint splatters, magic wisps). Avoid heavy particle effects.
    •    Shadow: Soft contact shadow directly beneath character only (no complex shadow effects).
    •    Border: Bold black outline around CHARACTER ONLY—absolutely NO border or frame around the image edge itself.
    •    Restrictions: NO environmental backgrounds, NO busy backgrounds, NO excessive props, NO decorative frames, NO black borders around image edge, NO text, NO watermarks, NO logos, NO excessive glow effects.

Character Details:
    •    Expressive face with clear emotion and personality
    •    Dynamic pose suggesting movement or combat stance
    •    Clear visual hierarchy focusing on head and upper body
    •    Color palette that reflects monster type and personality`;
}

async function generateImageWithReplicate(
  options: GenerateRawMonsterOptions
): Promise<string> {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN not found in .env.local');
  }

  if (!options.description) {
    throw new Error('Description is required for image generation');
  }

  const replicate = new Replicate({ auth: apiToken });

  const prompt = buildMonsterPrompt(options.name, options.description);
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

async function generateRawMonster(options: GenerateRawMonsterOptions): Promise<string> {
  console.log(`\n👹 Generating monster: ${options.name}`);

  try {
    // Generate description if not provided
    let description = options.description;
    if (!description) {
      console.log('🤖 Generating AI description...');
      description = await generateMonsterDescription(
        options.name,
        options.personalityTraits,
        options.description
      );
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
      'monsters',
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
      const r2Url = await uploadToR2(outputPath, options.name, 'monster');
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
        const r2NoBackgroundUrl = await uploadToR2(noBackgroundPath, options.name, 'monster', true);
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

async function generateBatch(options: Partial<GenerateRawMonsterOptions>): Promise<void> {
  console.log(`\n🚀 Starting batch generation for monsters...\n`);

  // Load seed data
  const monstersPath = path.join('..', 'docs', 'seed-data-monsters.json');

  if (!fs.existsSync(monstersPath)) {
    throw new Error(`Monsters seed data not found at ${monstersPath}`);
  }

  const monstersData: SeedData = JSON.parse(fs.readFileSync(monstersPath, 'utf-8'));
  const monsters = monstersData.monsters || [];

  console.log(`📋 Total monsters: ${monsters.length}\n`);

  const results = {
    successful: [] as string[],
    failed: [] as { name: string; error: string }[]
  };

  // Generate with progress tracking
  for (let i = 0; i < monsters.length; i++) {
    const monster = monsters[i];
    console.log(`\n[${i + 1}/${monsters.length}] Generating: ${monster.name}`);
    console.log('='.repeat(60));

    try {
      const outputPath = await generateRawMonster({
        name: monster.name,
        description: monster.description,
        personalityTraits: monster.personality_traits,
        dialogueTone: monster.dialogue_tone,
        outputFormat: options.outputFormat,
        uploadToR2: options.uploadToR2,
        removeBackground: options.removeBackground
      });

      results.successful.push(outputPath);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.failed.push({ name: monster.name, error: errorMsg });
      console.error(`❌ Failed to generate ${monster.name}: ${errorMsg}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('BATCH GENERATION SUMMARY');
  console.log('='.repeat(60));

  console.log(`\n✅ Successful: ${results.successful.length}/${monsters.length}`);
  if (results.successful.length > 0) {
    console.log(`\n   Generated:`);
    results.successful.forEach(path => {
      console.log(`   • ${path}`);
    });
  }

  if (results.failed.length > 0) {
    console.log(`\n❌ Failed: ${results.failed.length}/${monsters.length}`);
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
Mystica Raw Monster Generator

Generate standalone monster images with AI-generated descriptions.

Usage:
  pnpm generate-raw-monster "Monster Name" [options]
  pnpm generate-raw-monster "Monster 1" "Monster 2" "Monster 3" [options]
  pnpm generate-raw-monster --batch [options]

Arguments:
  Name(s)           One or more monster names (required for generation mode)

Options:
  --batch              Batch mode: generate all monsters from seed data
  -f, --format FMT     Output format: jpg or png (default: png)
  --upload             Upload generated images to R2
  --remove-background  Remove background and upload both versions to R2 (requires --upload)
  -h, --help           Show this help message

Configuration:
  Aspect Ratio:     1:1 (hardcoded)
  Provider:         Gemini (Nano Banana) (hardcoded)
  Reference Images: 10 R2-hosted images (hardcoded)

Examples:
  # Single generation
  pnpm generate-raw-monster "Spray Paint Goblin"
  pnpm generate-raw-monster "Goopy Floating Eye"

  # Multiple monsters
  pnpm generate-raw-monster "Dragon" "Slime" "Ghost"

  # Batch generation from seed data
  pnpm generate-raw-monster --batch

  # Custom output format
  pnpm generate-raw-monster "Feral Unicorn" --format jpg

Environment Variables Required:
  REPLICATE_API_TOKEN  Get from https://replicate.com
  OPENAI_API_KEY       Get from https://openai.com (for AI descriptions)

Cost Estimates:
  Single image: ~$0.002-0.01 per generation (Replicate per-second billing)
  AI description: ~$0.0001-0.0005 per generation (GPT-4.1-mini)
  Full batch (5 monsters): ~$0.01-0.05 total (images) + ~$0.0005-0.0025 (descriptions)

Output:
  scripts/output/raw/monsters/    - Generated monster images
`);
    process.exit(0);
  }

  const options: Partial<GenerateRawMonsterOptions> = {};
  let batchMode = false;
  const names: string[] = [];

  // Check for batch mode first
  if (args.includes('--batch')) {
    batchMode = true;
  }

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if ((arg === '-f' || arg === '--format') && args[i + 1]) {
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
      // Already handled
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
    await generateBatch(options);
  } else {
    // Multiple monsters mode
    if (names.length === 0) {
      console.error('❌ At least one monster name is required');
      console.error('Usage: pnpm generate-raw-monster "Monster Name" [more names...]');
      process.exit(1);
    }

    // Generate multiple monsters
    if (names.length > 1) {
      console.log(`\n🚀 Generating ${names.length} monsters...\n`);
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
        const outputPath = await generateRawMonster({
          name,
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

    // Summary for multiple monsters
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

export { generateRawMonster };
export type { GenerateRawMonsterOptions };

// Run CLI when executed directly (not when imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await main().catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  })();
}
