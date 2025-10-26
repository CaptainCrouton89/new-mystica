#!/usr/bin/env tsx

/**
 * Phase 1: Generate styled images with AI-generated metadata
 *
 * Usage:
 *   pnpm seed:generate --types materials,items --styles rubberhose,chibi
 *   pnpm seed:generate --types materials --styles rubberhose --remove-bg
 *   pnpm seed:generate --types items --styles rubberhose --limit 3
 *   pnpm seed:generate --all  # Generate everything
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import Replicate from 'replicate';
import { STYLE_CONFIGS, loadUIIcons, AssetType, StyleConfig } from './seed-config.js';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local'), override: true });

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

// Output directory
const OUTPUT_DIR = path.join(process.cwd(), 'seed-output');

// Types
interface Material {
  id: string;
  name: string;
  description: string | null;
}

interface ItemType {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

interface LocationType {
  location_type: string;
}

interface AssetMetadata {
  name: string;
  type: 'material' | 'item' | 'location' | 'ui-icon';
  style: string;
  style_id: string;
  category: string | null;
  ai_description: string;
  prompt: string;
  reference_images: string[];
  provider: string;
  aspect_ratio: string;
  background_removed: boolean;
  generated_at: string;
  local_path: string;
  local_path_nobg?: string;
  r2_key: string;
  r2_url?: string;
  replicate_prediction_id?: string;
  error?: string;
}

interface MasterManifest {
  generated_at: string;
  styles: string[];
  types: AssetType[];
  stats: Record<AssetType, Record<string, number>>;
  total_generated: number;
  total_failed: number;
  failures: Array<{ name: string; style: string; type: string; error: string }>;
  assets: AssetMetadata[];
}

// CLI argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }

  return flags;
}

// Generate AI description for asset
async function generateAssetDescription(
  name: string,
  type: 'material' | 'item' | 'location' | 'ui-icon',
  category?: string,
  existingDescription?: string | null
): Promise<string> {
  // Use existing description if available
  if (existingDescription) {
    return existingDescription;
  }

  const typeContext = {
    material: `a crafting material that can be applied to items to modify their appearance and stats`,
    item: category
      ? `a ${category} equipment item that players can equip and use in combat`
      : `an equipment item that players can equip and use`,
    location: `a ${name} location type where players can explore and find loot`,
    'ui-icon': `a user interface icon representing ${name.replace('-icon', '').replace('-', ' ')}`,
  };

  try {
    const { text } = await generateText({
      model: openai('gpt-5-nano'),
      prompt: `Generate a concise visual description (1-2 sentences) for a game asset called "${name}".
This is ${typeContext[type]}.
Focus ONLY on visual appearance: shape, colors, distinctive features, and artistic details.
Do NOT include gameplay mechanics, stats, or functional descriptions.

Example for "Coffee": "A steaming cup of coffee with animated steam wisps, rich brown liquid visible through a white ceramic mug, sitting on a small matching saucer"

Now generate a visual description for: ${name}${category ? ` (${category})` : ''}`,
    });

    return text.trim();
  } catch (error) {
    console.warn(`⚠️  AI description generation failed for ${name}, using fallback`);
    return `A ${name}${category ? ` (${category})` : ''} with distinctive visual features`;
  }
}

// Generate image with Replicate
async function generateImage(
  prompt: string,
  referenceImages: string[],
  assetName: string,
  style: string
): Promise<{ url: string; predictionId: string }> {
  console.log(`  🎨 Generating ${assetName} (${style})...`);

  const input = {
    prompt,
    image_input: referenceImages,
    aspect_ratio: '1:1',
    output_format: 'png',
  };

  try {
    const output = await replicate.run('google/nano-banana', { input }) as any;

    // Handle different response formats
    let imageUrl: string;
    if (typeof output === 'string') {
      imageUrl = output;
    } else if (output.url && typeof output.url === 'function') {
      imageUrl = output.url();
    } else if (output.url) {
      imageUrl = output.url;
    } else if (Array.isArray(output) && output.length > 0) {
      imageUrl = output[0];
    } else {
      throw new Error('Unexpected output format from Replicate');
    }

    return {
      url: imageUrl,
      predictionId: 'unknown', // Replicate SDK doesn't expose prediction ID in this format
    };
  } catch (error) {
    throw new Error(`Replicate generation failed: ${(error as Error).message}`);
  }
}

// Remove background from image
async function removeBackground(imageUrl: string): Promise<string> {
  console.log(`  ✂️  Removing background...`);

  const input = {
    image: imageUrl,
    content_moderation: false,
    preserve_partial_alpha: true,
  };

  try {
    const output = await replicate.run('bria/remove-background', { input }) as any;

    // Handle different response formats
    if (typeof output === 'string') {
      return output;
    } else if (output.url && typeof output.url === 'function') {
      return output.url();
    } else if (output.url) {
      return output.url;
    } else if (Array.isArray(output) && output.length > 0) {
      return output[0];
    } else {
      throw new Error('Unexpected output format from Replicate');
    }
  } catch (error) {
    throw new Error(`Background removal failed: ${(error as Error).message}`);
  }
}

// Download image from URL
async function downloadImage(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, buffer);
}

// Normalize name for file paths
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

// Build R2 key
function buildR2Key(
  name: string,
  type: 'material' | 'item' | 'location' | 'ui-icon',
  style: string
): string {
  const normalized = normalizeName(name);
  const typeDir = type === 'ui-icon' ? 'ui-icons' : type === 'item' ? 'items' : type === 'location' ? 'location-images' : 'materials';
  return `${typeDir}/${style}/${normalized}.png`;
}

// Generate single asset
async function generateAsset(
  name: string,
  type: 'material' | 'item' | 'location' | 'ui-icon',
  styleConfig: StyleConfig,
  category: string | null,
  existingDescription: string | null,
  removeBg: boolean
): Promise<AssetMetadata> {
  const normalized = normalizeName(name);
  const typeDir = type === 'ui-icon' ? 'ui-icons' : type === 'location' ? 'locations' : `${type}s`;
  const localDir = path.join(OUTPUT_DIR, typeDir, styleConfig.name);
  const localPath = path.join(localDir, `${normalized}.png`);
  const localPathNobg = path.join(localDir, `${normalized}-nobg.png`);

  const metadata: AssetMetadata = {
    name,
    type,
    style: styleConfig.name,
    style_id: styleConfig.style_id,
    category,
    ai_description: '',
    prompt: '',
    reference_images: styleConfig.reference_images,
    provider: 'gemini',
    aspect_ratio: '1:1',
    background_removed: removeBg,
    generated_at: new Date().toISOString(),
    local_path: localPath,
    r2_key: buildR2Key(name, type, styleConfig.name),
  };

  try {
    // Step 1: Generate AI description
    console.log(`\n📝 ${name} (${styleConfig.display_name})`);
    const aiDescription = await generateAssetDescription(name, type, category ?? undefined, existingDescription);
    metadata.ai_description = aiDescription;

    // Step 2: Build prompt
    const typeLabel = type === 'ui-icon' ? 'UI icon' : type;
    metadata.prompt = styleConfig.prompt_template(typeLabel, aiDescription);

    // Step 3: Generate image
    const { url: imageUrl, predictionId } = await generateImage(
      metadata.prompt,
      styleConfig.reference_images,
      name,
      styleConfig.name
    );
    metadata.replicate_prediction_id = predictionId;

    // Step 4: Download image
    console.log(`  💾 Downloading...`);
    await downloadImage(imageUrl, localPath);
    console.log(`  ✅ Saved to ${localPath}`);

    // Step 5: Remove background if requested
    if (removeBg) {
      const nobgUrl = await removeBackground(imageUrl);
      await downloadImage(nobgUrl, localPathNobg);
      metadata.local_path_nobg = localPathNobg;
      console.log(`  ✅ Saved nobg to ${localPathNobg}`);
    }

    // Step 6: Save metadata
    const metadataPath = path.join(localDir, `${normalized}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    return metadata;
  } catch (error) {
    metadata.error = (error as Error).message;
    console.error(`  ❌ Failed: ${metadata.error}`);
    return metadata;
  }
}

// Load assets from database
async function loadMaterials(): Promise<Material[]> {
  const { data, error } = await supabase
    .from('materials')
    .select('id, name, description')
    .order('name');

  if (error) throw error;
  return data || [];
}

async function loadItemTypes(): Promise<ItemType[]> {
  const { data, error } = await supabase
    .from('itemtypes')
    .select('id, name, category, description')
    .order('name');

  if (error) throw error;
  return data || [];
}

async function loadLocationTypes(): Promise<string[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('location_type')
    .order('location_type');

  if (error) throw error;

  // Get unique location types
  const types = Array.from(new Set(data?.map((l) => l.location_type).filter(Boolean) || []));
  return types as string[];
}

// Main generation function
async function main() {
  const flags = parseArgs();
  const removeBg = flags['remove-bg'] === true;
  const all = flags.all === true;
  const limit = flags.limit ? parseInt(flags.limit as string, 10) : undefined;

  // Parse types and styles
  let typesToGenerate: AssetType[] = all ? ['materials', 'items', 'locations', 'ui-icons'] : [];
  let stylesToGenerate = all ? STYLE_CONFIGS.map((s) => s.name) : [];

  if (!all) {
    if (flags.types) {
      typesToGenerate = (flags.types as string).split(',').map((t) => t.trim() as AssetType);
    }
    if (flags.styles) {
      stylesToGenerate = (flags.styles as string).split(',').map((s) => s.trim());
    }
  }

  if (typesToGenerate.length === 0 || stylesToGenerate.length === 0) {
    console.error('❌ Must specify --types and --styles, or use --all');
    console.log('\nUsage:');
    console.log('  pnpm seed:generate --types materials,items --styles rubberhose,chibi');
    console.log('  pnpm seed:generate --all');
    console.log('  pnpm seed:generate --types materials --styles rubberhose --remove-bg');
    process.exit(1);
  }

  console.log('🚀 Starting asset generation...');
  console.log(`   Types: ${typesToGenerate.join(', ')}`);
  console.log(`   Styles: ${stylesToGenerate.join(', ')}`);
  console.log(`   Remove BG: ${removeBg}`);
  console.log(`   Limit: ${limit ?? 'none'}\n`);

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Load assets from database
  let materials = typesToGenerate.includes('materials') ? await loadMaterials() : [];
  let itemTypes = typesToGenerate.includes('items') ? await loadItemTypes() : [];
  let locationTypes = typesToGenerate.includes('locations') ? await loadLocationTypes() : [];
  let uiIcons = typesToGenerate.includes('ui-icons') ? loadUIIcons() : [];

  // Apply limit if specified
  if (limit) {
    materials = materials.slice(0, limit);
    itemTypes = itemTypes.slice(0, limit);
    locationTypes = locationTypes.slice(0, limit);
    uiIcons = uiIcons.slice(0, limit);
  }

  console.log(`📊 Loaded from database:`);
  console.log(`   Materials: ${materials.length}`);
  console.log(`   Items: ${itemTypes.length}`);
  console.log(`   Locations: ${locationTypes.length}`);
  console.log(`   UI Icons: ${uiIcons.length}\n`);

  // Filter style configs
  const styleConfigs = STYLE_CONFIGS.filter((s) => stylesToGenerate.includes(s.name));

  // Generate all assets
  const allMetadata: AssetMetadata[] = [];
  const failures: Array<{ name: string; style: string; type: string; error: string }> = [];

  for (const styleConfig of styleConfigs) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎨 Generating ${styleConfig.display_name} assets`);
    console.log('='.repeat(60));

    // Generate materials
    for (const material of materials) {
      const metadata = await generateAsset(
        material.name,
        'material',
        styleConfig,
        null,
        material.description,
        removeBg
      );
      allMetadata.push(metadata);
      if (metadata.error) {
        failures.push({
          name: material.name,
          style: styleConfig.name,
          type: 'material',
          error: metadata.error,
        });
      }
    }

    // Generate items
    for (const item of itemTypes) {
      const metadata = await generateAsset(
        item.name,
        'item',
        styleConfig,
        item.category,
        item.description,
        removeBg
      );
      allMetadata.push(metadata);
      if (metadata.error) {
        failures.push({
          name: item.name,
          style: styleConfig.name,
          type: 'item',
          error: metadata.error,
        });
      }
    }

    // Generate locations
    for (const locationType of locationTypes) {
      const metadata = await generateAsset(
        locationType,
        'location',
        styleConfig,
        null,
        null,
        removeBg
      );
      allMetadata.push(metadata);
      if (metadata.error) {
        failures.push({
          name: locationType,
          style: styleConfig.name,
          type: 'location',
          error: metadata.error,
        });
      }
    }

    // Generate UI icons
    for (const icon of uiIcons) {
      const metadata = await generateAsset(
        icon.name,
        'ui-icon',
        styleConfig,
        null,
        icon.description,
        removeBg
      );
      allMetadata.push(metadata);
      if (metadata.error) {
        failures.push({
          name: icon.name,
          style: styleConfig.name,
          type: 'ui-icon',
          error: metadata.error,
        });
      }
    }
  }

  // Generate master manifest
  const stats: Record<AssetType, Record<string, number>> = {
    materials: {},
    items: {},
    locations: {},
    'ui-icons': {},
  };

  for (const style of stylesToGenerate) {
    stats.materials[style] = allMetadata.filter((m) => m.type === 'material' && m.style === style && !m.error).length;
    stats.items[style] = allMetadata.filter((m) => m.type === 'item' && m.style === style && !m.error).length;
    stats.locations[style] = allMetadata.filter((m) => m.type === 'location' && m.style === style && !m.error).length;
    stats['ui-icons'][style] = allMetadata.filter((m) => m.type === 'ui-icon' && m.style === style && !m.error).length;
  }

  const manifest: MasterManifest = {
    generated_at: new Date().toISOString(),
    styles: stylesToGenerate,
    types: typesToGenerate,
    stats,
    total_generated: allMetadata.filter((m) => !m.error).length,
    total_failed: failures.length,
    failures,
    assets: allMetadata,
  };

  const manifestPath = path.join(OUTPUT_DIR, 'metadata.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ Generation complete!');
  console.log('='.repeat(60));
  console.log(`📊 Stats:`);
  console.log(`   Total generated: ${manifest.total_generated}`);
  console.log(`   Total failed: ${manifest.total_failed}`);
  console.log(`\n📁 Output: ${OUTPUT_DIR}`);
  console.log(`📄 Manifest: ${manifestPath}\n`);

  if (failures.length > 0) {
    console.log('⚠️  Failures:');
    failures.forEach((f) => {
      console.log(`   - ${f.name} (${f.style}, ${f.type}): ${f.error}`);
    });
  }
}

main().catch(console.error);
