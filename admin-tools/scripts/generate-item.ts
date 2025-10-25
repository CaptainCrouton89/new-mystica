/**
 * Generate Item Images - Admin Tool
 *
 * Streamlined script to generate item images with:
 * 1. AI-generated description (optional - can provide custom)
 * 2. Image generation with Gemini (Nano Banana)
 * 3. Background removal
 * 4. Automatic upload to R2 at items/{snake_case_name}.png
 *
 * Usage:
 *   pnpm tsx admin-tools/scripts/generate-item.ts "Leather Jacket"
 *   pnpm tsx admin-tools/scripts/generate-item.ts "Fuzzy Slippers" --desc "pink fuzzy bunny slippers with pom-poms"
 */

import { openai } from '@ai-sdk/openai';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { generateObject } from 'ai';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { dirname } from 'path';
import Replicate from 'replicate';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local'), override: true });

const CONFIG = {
  model: 'google/nano-banana',
  aspectRatio: '1:1' as const,
  referenceImages: [
    `${process.env.R2_PUBLIC_URL}/image-refs/bubble-wrap-vest.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/fuzzy-slippers.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/gatling-gun.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/jar-of-jelly.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/poop-emoji.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/lava.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/metal-scraps.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/rainbow.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/slime.png`,
    `${process.env.R2_PUBLIC_URL}/image-refs/sword.png`
  ],
  r2Bucket: 'mystica-assets',
  r2PublicUrl: process.env.R2_PUBLIC_URL
};

const descriptionSchema = z.object({
  description: z.string().describe('A concise one-sentence physical description for image generation')
});

const DESCRIPTION_SYSTEM_PROMPT = `Generate a concise visual description for a game item to be used in image generation.

Focus on:
- Physical appearance (shape, material, key visual features)
- Keep it short: 8-15 words
- Only essential visual details
- Avoid artistic style or mood descriptions

Examples:
- "Sword" → "a silver broadsword with a gem-studded crescent hilt"
- "Fuzzy Slippers" → "pink bunny slippers with fluffy texture and pom-pom tails"
- "Leather Jacket" → "brown leather jacket with metal zippers and studded shoulders"`;

async function generateDescription(name: string): Promise<string> {
  const { object } = await generateObject({
    model: openai('gpt-4.1-mini'),
    schema: descriptionSchema,
    system: DESCRIPTION_SYSTEM_PROMPT,
    prompt: `Name: ${name}; Type: item`,
  });
  return object.description;
}

function buildPrompt(name: string, description: string): string {
  return `Create a single, center-framed 1:1 game item:

"${name}: ${description}"

This illustration in a polished, high-detail "chibi"/super-deformed aesthetic typical of mobile RPGs and CCGs.

Core Look
    •    Color: Vivid, high-saturation palette; punchy local colors with clean hue separation.
    •    Lighting: Clear, consistent key light with crisp fill; controlled shadows for depth. Add strong rim light.
    •    Glow & Highlights: MINIMAL outer glow. Use tight, glossy specular highlights on hard materials.
    •    Border: Bold black outline around the object itself—NOT around the image edge.

Line & Form
    •    Outlines: Bold, uniform black border carving a strong silhouette; no sketchy linework.
    •    Proportions: Chunky, simplified, slightly exaggerated shapes for instant readability.
    •    Simplicity: Keep straightforward—no unnecessary gems, ornaments, or overly complex details.

Composition & Background
    •    Framing: Single hero item, perfectly centered and clearly visible.
    •    Background: SIMPLE solid color OR clean gradient ONLY. Choose complementary colors.
    •    Sparkles/Particles: MINIMAL—if used, keep to 3-5 small white sparkles maximum.
    •    Shadow: Soft contact shadow beneath item only.
    •    Restrictions: NO text, NO watermarks, NO logos, NO complex backgrounds.`;
}

async function generateImage(prompt: string): Promise<Buffer> {
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });

  console.log('🎨 Generating image with Gemini...');
  const output = await replicate.run(CONFIG.model as `${string}/${string}`, {
    input: {
      prompt,
      aspect_ratio: CONFIG.aspectRatio,
      output_format: 'png',
      image_input: CONFIG.referenceImages
    }
  }) as any;

  const imageUrl = typeof output?.url === 'function' ? output.url() : output;
  if (!imageUrl) throw new Error('No image URL returned');

  console.log('⬇️  Downloading image...');
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);

  return Buffer.from(await response.arrayBuffer());
}

async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });

  console.log('🔪 Removing background...');
  const dataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;

  const output = await replicate.run('bria/remove-background' as `${string}/${string}`, {
    input: { image: dataUrl }
  }) as any;

  const processedUrl = typeof output === 'string' ? output :
                      typeof output?.url === 'function' ? output.url() :
                      output?.toString();

  if (!processedUrl) throw new Error('No URL from background remover');

  console.log('⬇️  Downloading no-background image...');
  const response = await fetch(processedUrl);
  if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);

  return Buffer.from(await response.arrayBuffer());
}

async function cropTransparentEdges(imageBuffer: Buffer): Promise<Buffer> {
  console.log('✂️  Cropping transparent edges...');
  const metadata = await sharp(imageBuffer).metadata();
  console.log(`   Original: ${metadata.width}x${metadata.height}`);

  const cropped = await sharp(imageBuffer).trim().toBuffer();

  const croppedMeta = await sharp(cropped).metadata();
  console.log(`   Cropped: ${croppedMeta.width}x${croppedMeta.height}`);

  return cropped;
}

function normalizeForR2(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

async function uploadToR2(buffer: Buffer, r2Key: string): Promise<string> {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  console.log(`📤 Uploading to R2: ${r2Key}`);
  await client.send(new PutObjectCommand({
    Bucket: CONFIG.r2Bucket,
    Key: r2Key,
    Body: buffer,
    ContentType: 'image/png',
  }));

  const publicUrl = `${CONFIG.r2PublicUrl}/${r2Key}`;
  console.log(`✅ Uploaded: ${publicUrl}`);
  return publicUrl;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: pnpm tsx admin-tools/scripts/generate-item.ts <name> [options]

Arguments:
  name                  Item name (e.g., "Leather Jacket")

Options:
  --desc TEXT          Custom description (optional - AI generates if omitted)
  -h, --help           Show this help

Examples:
  pnpm tsx admin-tools/scripts/generate-item.ts "Leather Jacket"
  pnpm tsx admin-tools/scripts/generate-item.ts "Fuzzy Slippers" --desc "pink bunny slippers with pom-poms"
`);
    process.exit(0);
  }

  const itemName = args[0];
  const descIndex = args.indexOf('--desc');
  const customDesc = descIndex !== -1 ? args[descIndex + 1] : null;

  console.log(`\n🎮 Generating item: ${itemName}\n`);

  // 1. Get description
  const description = customDesc || await generateDescription(itemName);
  console.log(`📝 Description: ${description}\n`);

  // 2. Generate image
  const prompt = buildPrompt(itemName, description);
  const imageBuffer = await generateImage(prompt);

  // 3. Remove background
  const noBgBuffer = await removeBackground(imageBuffer);

  // 4. Crop transparent edges
  const finalBuffer = await cropTransparentEdges(noBgBuffer);

  // 5. Upload to R2
  const normalizedName = normalizeForR2(itemName);
  const r2Key = `items/${normalizedName}.png`;
  await uploadToR2(finalBuffer, r2Key);

  console.log(`\n✅ Done! Item image ready at: ${CONFIG.r2PublicUrl}/${r2Key}`);
}

main().catch(console.error);
