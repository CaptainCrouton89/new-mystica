#!/usr/bin/env tsx

/**
 * Phase 1: Generate styled images with AI-generated metadata
 *
 * PRIMARY MODE (Input files - creates NEW assets):
 *   Each item in input JSON specifies its own style. Generate only that style.
 *
 *   pnpm seed:generate --types materials,items
 *   pnpm seed:generate --types materials --remove-bg
 *   pnpm seed:generate --types items --limit 3
 *   pnpm seed:generate --all  # Generate everything from input/*.json
 *
 * LEGACY MODE (Database - regenerates EXISTING assets):
 *   Matrix mode: all items × specified styles
 *
 *   pnpm seed:generate --from-db --types materials --styles rubberhose
 *   pnpm seed:generate --from-db --all --styles rubberhose,chibi
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import Replicate from 'replicate';
import {
  STYLE_CONFIGS,
  loadUIIcons,
  loadInputMaterials,
  loadInputItems,
  loadInputUIIcons,
  AssetType,
  StyleConfig,
  InputMaterial,
  InputItem,
  InputUIIcon,
  MATERIAL_STAT_GENERATION_PROMPT,
} from './seed-config.js';

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

// R2 Public URL
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

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

interface AssetMetadata {
  name: string;
  type: 'material' | 'item' | 'ui-icon';
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
  from_input: boolean; // true = new asset from input file, false = regenerating from DB
  db_id?: string; // For existing assets from DB
  base_stats_normalized?: Record<string, number>; // For items
  stat_modifiers?: Record<string, number>; // For materials
}

interface MasterManifest {
  generated_at: string;
  mode: 'input' | 'database'; // input = new assets from input files, database = regenerate from DB
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

// Generate stat modifiers for materials using GPT
async function generateMaterialStats(
  name: string,
  description: string
): Promise<Record<string, number>> {
  try {
    const { text } = await generateText({
      model: openai('gpt-4.1-mini'),
      prompt: MATERIAL_STAT_GENERATION_PROMPT(name, description),
    });

    // Parse the JSON response
    const stats = JSON.parse(text.trim());

    // Validate the structure and sum
    if (
      typeof stats.atkPower === 'number' &&
      typeof stats.atkAccuracy === 'number' &&
      typeof stats.defPower === 'number' &&
      typeof stats.defAccuracy === 'number'
    ) {
      // Check that stats sum to 0
      const sum = stats.atkPower + stats.atkAccuracy + stats.defPower + stats.defAccuracy;
      if (Math.abs(sum) > 0.001) { // Allow small floating point error
        throw new Error(`Stats must sum to 0, got ${sum}`);
      }
      console.log(`  📊 Generated stats: ${JSON.stringify(stats)}`);
      return stats;
    } else {
      throw new Error('Invalid stat structure');
    }
  } catch (error) {
    console.warn(`⚠️  Stat generation failed for ${name}, using balanced defaults`);
    return {
      atkPower: 0.05,
      atkAccuracy: 0.05,
      defPower: -0.05,
      defAccuracy: -0.05,
    };
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
  type: 'material' | 'item' | 'ui-icon',
  style: string
): string {
  const normalized = normalizeName(name);
  const typeDir = type === 'ui-icon' ? 'ui-icons' : type === 'item' ? 'items' : 'materials';
  return `${typeDir}/${style}/${normalized}.png`;
}

// Generate single asset
async function generateAsset(
  name: string,
  type: 'material' | 'item' | 'ui-icon',
  styleConfig: StyleConfig,
  category: string | null,
  existingDescription: string | null,
  removeBg: boolean,
  fromInput: boolean,
  dbId?: string,
  baseStatsNormalized?: Record<string, number>
): Promise<AssetMetadata> {
  const normalized = normalizeName(name);
  const typeDir = type === 'ui-icon' ? 'ui-icons' : `${type}s`;
  const localDir = path.join(OUTPUT_DIR, typeDir, styleConfig.name);
  const localPath = path.join(localDir, `${normalized}.png`);
  const localPathNobg = path.join(localDir, `${normalized}-nobg.png`);

  const r2Key = buildR2Key(name, type, styleConfig.name);
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
    r2_key: r2Key,
    r2_url: `${R2_PUBLIC_URL}/${r2Key}`,
    from_input: fromInput,
    db_id: dbId,
    base_stats_normalized: baseStatsNormalized,
  };

  try {
    // Step 1: Generate AI description
    console.log(`\n📝 ${name} (${styleConfig.display_name})`);
    const aiDescription = await generateAssetDescription(name, type, category ?? undefined, existingDescription);
    metadata.ai_description = aiDescription;

    // Step 1.5: Generate material stats if this is a material
    if (type === 'material') {
      const stats = await generateMaterialStats(name, aiDescription);
      metadata.stat_modifiers = stats;
    }

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


// Main generation function
async function main() {
  const flags = parseArgs();
  const removeBg = flags['remove-bg'] === true;
  const all = flags.all === true;
  const fromDb = flags['from-db'] === true;
  const limit = flags.limit ? parseInt(flags.limit as string, 10) : undefined;

  // Parse types and styles
  let typesToGenerate: AssetType[] = all ? ['materials', 'items', 'ui-icons'] : [];
  let stylesToGenerate: string[] = [];

  if (!all && flags.types) {
    typesToGenerate = (flags.types as string).split(',').map((t) => t.trim() as AssetType);
  }

  // For --from-db mode, --styles is REQUIRED (matrix generation)
  // For input mode, --styles is OPTIONAL (items define their own style)
  if (fromDb) {
    if (all) {
      stylesToGenerate = STYLE_CONFIGS.map((s) => s.name);
    } else if (flags.styles) {
      stylesToGenerate = (flags.styles as string).split(',').map((s) => s.trim());
    } else {
      console.error('❌ --from-db mode requires --styles flag');
      console.log('\nUsage (LEGACY - from database):');
      console.log('  pnpm seed:generate --from-db --types materials --styles rubberhose');
      console.log('  pnpm seed:generate --from-db --all --styles rubberhose,chibi');
      process.exit(1);
    }
  }

  if (typesToGenerate.length === 0) {
    console.error('❌ Must specify --types or use --all');
    console.log('\nUsage (PRIMARY - input files):');
    console.log('  pnpm seed:generate --types materials,items');
    console.log('  pnpm seed:generate --all');
    console.log('\nUsage (LEGACY - from database):');
    console.log('  pnpm seed:generate --from-db --types materials --styles rubberhose');
    console.log('  pnpm seed:generate --from-db --all --styles rubberhose,chibi');
    process.exit(1);
  }

  console.log('🚀 Starting asset generation...');
  console.log(`   Mode: ${fromDb ? 'DATABASE (regenerate existing)' : 'INPUT FILES (create new)'}`);
  console.log(`   Types: ${typesToGenerate.join(', ')}`);
  if (fromDb) {
    console.log(`   Styles: ${stylesToGenerate.join(', ')} [matrix generation]`);
  } else {
    console.log(`   Styles: [per-item from input files]`);
  }
  console.log(`   Remove BG: ${removeBg}`);
  console.log(`   Limit: ${limit ?? 'none'}\n`);

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Load assets based on mode
  let materials: Array<{ name: string; description: string | null; style?: string; id?: string }> = [];
  let itemTypes: Array<{
    name: string;
    category: string;
    description: string | null;
    style?: string;
    id?: string;
    base_stats_normalized?: Record<string, number>;
  }> = [];
  let uiIcons: Array<{ name: string; description: string; style?: string }> = [];

  if (fromDb) {
    // LEGACY MODE: Load from database (no style - will use matrix generation)
    if (typesToGenerate.includes('materials')) {
      const dbMaterials = await loadMaterials();
      materials = dbMaterials.map(m => ({ name: m.name, description: m.description, id: m.id }));
    }
    if (typesToGenerate.includes('items')) {
      const dbItems = await loadItemTypes();
      itemTypes = dbItems.map(i => ({ name: i.name, category: i.category, description: i.description, id: i.id }));
    }
    if (typesToGenerate.includes('ui-icons')) {
      uiIcons = loadUIIcons();
    }
  } else {
    // PRIMARY MODE: Load from input files (with per-item style)
    if (typesToGenerate.includes('materials')) {
      const inputMaterials = loadInputMaterials();
      materials = inputMaterials.map(m => ({ name: m.name, description: m.description, style: m.style }));
    }
    if (typesToGenerate.includes('items')) {
      const inputItems = loadInputItems();
      itemTypes = inputItems.map(i => ({
        name: i.name,
        category: i.category,
        description: i.description,
        style: 'rubberhose', // Items always use rubberhose style
        base_stats_normalized: i.base_stats_normalized,
      }));
    }
    if (typesToGenerate.includes('ui-icons')) {
      uiIcons = loadInputUIIcons().map(u => ({ name: u.name, description: u.description, style: u.style }));
    }
  }

  // Apply limit if specified
  if (limit) {
    materials = materials.slice(0, limit);
    itemTypes = itemTypes.slice(0, limit);
    uiIcons = uiIcons.slice(0, limit);
  }

  console.log(`📊 Loaded assets:`);
  console.log(`   Source: ${fromDb ? 'Database' : 'Input files'}`);
  console.log(`   Materials: ${materials.length}`);
  console.log(`   Items: ${itemTypes.length}`);
  console.log(`   UI Icons: ${uiIcons.length}\n`);

  // Generate all assets
  const allMetadata: AssetMetadata[] = [];
  const failures: Array<{ name: string; style: string; type: string; error: string }> = [];

  // Helper to get style config by name
  const getStyleConfig = (styleName: string): StyleConfig | undefined => {
    return STYLE_CONFIGS.find(s => s.name === styleName);
  };

  if (fromDb) {
    // LEGACY MODE: Matrix generation (all assets × all styles)
    const styleConfigs = STYLE_CONFIGS.filter((s) => stylesToGenerate.includes(s.name));

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
          removeBg,
          false,
          material.id
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
          removeBg,
          false,
          item.id
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

      // Generate UI icons
      for (const icon of uiIcons) {
        const metadata = await generateAsset(
          icon.name,
          'ui-icon',
          styleConfig,
          null,
          icon.description,
          removeBg,
          false,
          undefined
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
  } else {
    // PRIMARY MODE: Per-item style generation
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎨 Generating assets with per-item styles`);
    console.log('='.repeat(60));

    // Generate materials
    for (const material of materials) {
      const styleConfig = getStyleConfig(material.style!);
      if (!styleConfig) {
        console.error(`❌ Unknown style "${material.style}" for ${material.name}`);
        failures.push({
          name: material.name,
          style: material.style!,
          type: 'material',
          error: `Unknown style: ${material.style}`,
        });
        continue;
      }

      const metadata = await generateAsset(
        material.name,
        'material',
        styleConfig,
        null,
        material.description,
        removeBg,
        true,
        undefined
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

    // Generate items (always rubberhose style)
    for (const item of itemTypes) {
      const styleConfig = getStyleConfig('rubberhose');
      if (!styleConfig) {
        console.error(`❌ Rubberhose style not found for ${item.name}`);
        failures.push({
          name: item.name,
          style: 'rubberhose',
          type: 'item',
          error: `Rubberhose style not configured`,
        });
        continue;
      }

      const metadata = await generateAsset(
        item.name,
        'item',
        styleConfig,
        item.category,
        item.description,
        removeBg,
        true,
        undefined,
        item.base_stats_normalized
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

    // Generate UI icons
    for (const icon of uiIcons) {
      const styleConfig = getStyleConfig(icon.style!);
      if (!styleConfig) {
        console.error(`❌ Unknown style "${icon.style}" for ${icon.name}`);
        failures.push({
          name: icon.name,
          style: icon.style!,
          type: 'ui-icon',
          error: `Unknown style: ${icon.style}`,
        });
        continue;
      }

      const metadata = await generateAsset(
        icon.name,
        'ui-icon',
        styleConfig,
        null,
        icon.description,
        removeBg,
        true,
        undefined
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
  // Collect all unique styles from generated assets
  const usedStyles = Array.from(new Set(allMetadata.map(m => m.style)));

  const stats: Record<AssetType, Record<string, number>> = {
    materials: {},
    items: {},
    'ui-icons': {},
  };

  for (const style of usedStyles) {
    stats.materials[style] = allMetadata.filter((m) => m.type === 'material' && m.style === style && !m.error).length;
    stats.items[style] = allMetadata.filter((m) => m.type === 'item' && m.style === style && !m.error).length;
    stats['ui-icons'][style] = allMetadata.filter((m) => m.type === 'ui-icon' && m.style === style && !m.error).length;
  }

  const manifest: MasterManifest = {
    generated_at: new Date().toISOString(),
    mode: fromDb ? 'database' : 'input',
    styles: usedStyles,
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
