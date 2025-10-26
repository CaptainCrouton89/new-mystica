#!/usr/bin/env tsx

/**
 * Phase 2: Upload generated images to R2 and sync to Supabase
 *
 * PRIMARY MODE (Insert new records - for input file generation):
 *   pnpm seed:upload --dry-run     # Preview changes
 *   pnpm seed:upload               # Execute uploads + DB inserts
 *   pnpm seed:upload --use-nobg    # Upload nobg versions
 *
 * LEGACY MODE (Update existing records - for database regeneration):
 *   pnpm seed:upload --update-existing --dry-run
 *   pnpm seed:upload --update-existing
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local'), override: true });

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// R2 configuration
const R2_CONFIG = {
  bucket: process.env.R2_BUCKET_NAME!,
  publicUrl: process.env.R2_PUBLIC_URL!,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
};

// Create R2 client
function createR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_CONFIG.accessKeyId,
      secretAccessKey: R2_CONFIG.secretAccessKey,
    },
  });
}

// Input directory
const INPUT_DIR = path.join(process.cwd(), 'seed-output');
const MANIFEST_PATH = path.join(INPUT_DIR, 'metadata.json');

// Types (matching seed-generate.ts)
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
  types: string[];
  stats: Record<string, Record<string, number>>;
  total_generated: number;
  total_failed: number;
  failures: Array<{ name: string; style: string; type: string; error: string }>;
  assets: AssetMetadata[];
}

interface UploadResult {
  name: string;
  type: string;
  style: string;
  r2_url: string;
  db_updated: boolean;
  error?: string;
}

// CLI argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const flags: Record<string, boolean> = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      flags[arg.slice(2)] = true;
    }
  }

  return flags;
}

// Upload to R2
async function uploadToR2(
  localPath: string,
  r2Key: string,
  dryRun: boolean
): Promise<string> {
  if (dryRun) {
    console.log(`  [DRY RUN] Would upload to R2: ${r2Key}`);
    return `${R2_CONFIG.publicUrl}/${r2Key}`;
  }

  if (!fs.existsSync(localPath)) {
    throw new Error(`Local file not found: ${localPath}`);
  }

  const client = createR2Client();
  const fileBuffer = fs.readFileSync(localPath);

  await client.send(
    new PutObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: r2Key,
      Body: fileBuffer,
      ContentType: 'image/png',
    })
  );

  const publicUrl = `${R2_CONFIG.publicUrl}/${r2Key}`;
  console.log(`  ✅ Uploaded to R2: ${r2Key}`);
  return publicUrl;
}

// Update database for materials
async function updateMaterialInDB(
  name: string,
  styleId: string,
  _imageUrl: string,
  dryRun: boolean
): Promise<boolean> {
  if (dryRun) {
    console.log(`  [DRY RUN] Would update materials: ${name} -> style_id=${styleId}`);
    return true;
  }

  // Note: We're only setting style_id, not image_url
  // Client will construct URLs using convention: ${R2_PUBLIC_URL}/materials/${styleName}/${materialName}.png
  // Using PostgREST API directly to bypass schema cache
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/materials?name=eq.${encodeURIComponent(name)}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ style_id: styleId })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`  ❌ DB update failed for material ${name}: ${error}`);
    return false;
  }

  console.log(`  ✅ Updated DB: materials.${name}`);
  return true;
}

// Update database for items
async function updateItemTypeInDB(
  name: string,
  imageUrl: string,
  dryRun: boolean
): Promise<boolean> {
  if (dryRun) {
    console.log(`  [DRY RUN] Would update itemtypes: ${name} -> base_image_url=${imageUrl}`);
    return true;
  }

  // For items, we only store the rubberhose image URL in base_image_url
  // Items always use rubberhose style (no style_id)
  // Using PostgREST API directly to bypass schema cache
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/itemtypes?name=eq.${encodeURIComponent(name)}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ base_image_url: imageUrl })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`  ❌ DB update failed for itemtype ${name}: ${error}`);
    return false;
  }

  console.log(`  ✅ Updated DB: itemtypes.${name}`);
  return true;
}

// Insert new material into database
async function insertMaterialInDB(
  name: string,
  description: string,
  styleId: string,
  imageUrl: string,
  statModifiers: Record<string, number>,
  dryRun: boolean
): Promise<boolean> {
  if (dryRun) {
    console.log(`  [DRY RUN] Would insert material: ${name} -> style_id=${styleId}, description="${description}", image_url="${imageUrl}", stat_modifiers=${JSON.stringify(statModifiers)}`);
    return true;
  }

  const { error } = await supabase
    .from('materials')
    .insert({
      name,
      description,
      style_id: styleId,
      image_url: imageUrl,
      stat_modifiers: statModifiers,
    });

  if (error) {
    console.error(`  ❌ DB insert failed for material ${name}: ${error.message}`);
    return false;
  }

  console.log(`  ✅ Inserted into DB: materials.${name}`);
  return true;
}

// Insert new item type into database
async function insertItemTypeInDB(
  name: string,
  description: string,
  category: string,
  imageUrl: string,
  baseStatsNormalized: Record<string, number>,
  dryRun: boolean
): Promise<boolean> {
  if (dryRun) {
    console.log(`  [DRY RUN] Would insert itemtype: ${name} -> category=${category}, base_image_url=${imageUrl}`);
    return true;
  }

  const { error } = await supabase
    .from('itemtypes')
    .insert({
      name,
      description,
      category,
      base_stats_normalized: baseStatsNormalized,
      base_image_url: imageUrl,
    });

  if (error) {
    console.error(`  ❌ DB insert failed for itemtype ${name}: ${error.message}`);
    return false;
  }

  console.log(`  ✅ Inserted into DB: itemtypes.${name}`);
  return true;
}

// Process single asset
async function processAsset(
  asset: AssetMetadata,
  dryRun: boolean,
  useNobg: boolean,
  updateExisting: boolean
): Promise<UploadResult> {
  const result: UploadResult = {
    name: asset.name,
    type: asset.type,
    style: asset.style,
    r2_url: '',
    db_updated: false,
  };

  try {
    // Skip if generation failed
    if (asset.error) {
      result.error = `Skipped (generation failed): ${asset.error}`;
      return result;
    }

    // Determine which file to upload
    const localPath = useNobg && asset.local_path_nobg ? asset.local_path_nobg : asset.local_path;

    if (!fs.existsSync(localPath)) {
      result.error = `Local file not found: ${localPath}`;
      return result;
    }

    console.log(`\n📦 ${asset.name} (${asset.style}, ${asset.type})`);

    // Upload to R2
    const r2Url = await uploadToR2(localPath, asset.r2_key, dryRun);
    result.r2_url = r2Url;

    // Update or insert into database based on mode
    let dbUpdated = false;

    if (updateExisting) {
      // LEGACY MODE: Update existing records
      switch (asset.type) {
        case 'material':
          dbUpdated = await updateMaterialInDB(asset.name, asset.style_id, r2Url, dryRun);
          break;
        case 'item':
          dbUpdated = await updateItemTypeInDB(asset.name, r2Url, dryRun);
          break;
        case 'ui-icon':
          console.log(`  ℹ️  UI icons are not stored in database`);
          dbUpdated = true;
          break;
      }
    } else {
      // PRIMARY MODE: Insert new records
      switch (asset.type) {
        case 'material':
          dbUpdated = await insertMaterialInDB(
            asset.name,
            asset.ai_description,
            asset.style_id,
            r2Url,
            asset.stat_modifiers || { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 },
            dryRun
          );
          break;
        case 'item':
          dbUpdated = await insertItemTypeInDB(
            asset.name,
            asset.ai_description,
            asset.category || 'misc',
            r2Url,
            asset.base_stats_normalized || { atkPower: 0.25, atkAccuracy: 0.25, defPower: 0.25, defAccuracy: 0.25 },
            dryRun
          );
          break;
        case 'ui-icon':
          console.log(`  ℹ️  UI icons are not stored in database`);
          dbUpdated = true;
          break;
      }
    }

    result.db_updated = dbUpdated;
  } catch (error) {
    result.error = (error as Error).message;
    console.error(`  ❌ ${result.error}`);
  }

  return result;
}

// Main upload function
async function main() {
  const flags = parseArgs();
  const dryRun = flags['dry-run'] === true;
  const useNobg = flags['use-nobg'] === true;
  const updateExisting = flags['update-existing'] === true;

  console.log('🚀 Starting upload process...');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   DB Operation: ${updateExisting ? 'UPDATE existing records' : 'INSERT new records'}`);
  console.log(`   Use nobg: ${useNobg}\n`);

  // Check manifest exists
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`❌ Manifest not found: ${MANIFEST_PATH}`);
    console.error('   Run pnpm seed:generate first');
    process.exit(1);
  }

  // Load manifest
  const manifest: MasterManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

  console.log(`📊 Loaded manifest:`);
  console.log(`   Generated at: ${manifest.generated_at}`);
  console.log(`   Generation mode: ${manifest.mode}`);
  console.log(`   Total assets: ${manifest.assets.length}`);
  console.log(`   Successful: ${manifest.total_generated}`);
  console.log(`   Failed: ${manifest.total_failed}\n`);

  // Validate mode compatibility
  const expectedUpdate = manifest.mode === 'database';
  if (updateExisting !== expectedUpdate) {
    console.log(`⚠️  WARNING: Mode mismatch detected!`);
    console.log(`   Generation mode was: ${manifest.mode}`);
    console.log(`   Upload mode is: ${updateExisting ? 'update-existing' : 'insert-new'}`);
    console.log(`   Recommended: ${expectedUpdate ? 'Add --update-existing flag' : 'Remove --update-existing flag'}\n`);
  }

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  // Process all assets
  const results: UploadResult[] = [];

  for (const asset of manifest.assets) {
    const result = await processAsset(asset, dryRun, useNobg, updateExisting);
    results.push(result);
  }

  // Generate report
  const successful = results.filter((r) => !r.error && r.db_updated);
  const failed = results.filter((r) => r.error || !r.db_updated);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`${dryRun ? '🔍 DRY RUN COMPLETE' : '✅ UPLOAD COMPLETE'}`);
  console.log('='.repeat(60));
  console.log(`📊 Results:`);
  console.log(`   Successful: ${successful.length}`);
  console.log(`   Failed: ${failed.length}\n`);

  if (failed.length > 0) {
    console.log('⚠️  Failed uploads:');
    failed.forEach((f) => {
      console.log(`   - ${f.name} (${f.style}, ${f.type}): ${f.error || 'DB update failed'}`);
    });
    console.log('');
  }

  // Save upload report
  const reportPath = path.join(INPUT_DIR, 'upload-report.json');
  const report = {
    uploaded_at: new Date().toISOString(),
    generation_mode: manifest.mode,
    db_operation: updateExisting ? 'update' : 'insert',
    dry_run: dryRun,
    use_nobg: useNobg,
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    results,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved: ${reportPath}\n`);

  if (dryRun) {
    console.log('💡 Run without --dry-run to execute uploads\n');
  }
}

main().catch(console.error);
