/**
 * Sync to Database - Database Sync Tool
 *
 * Syncs R2 asset URLs to the Supabase database for items and materials.
 *
 * Items support smart URL resolution:
 * - Combo items (with material_combo_hash): items-crafted/{slug}/{hash}.png
 * - Specific items: items/{name}.png
 * - Category defaults: items/default_{category}.png
 *
 * Usage:
 *   pnpm sync-to-db --type items --name "Fire Sword"
 *   pnpm sync-to-db --type materials --batch "wood,crystal,metal"
 *   pnpm sync-to-db --type items --all
 *   pnpm sync-to-db --type items --verify --dry-run
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';

dotenv.config({ path: '.env.local', override: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

type TableType = 'items' | 'materials';

interface SyncOptions {
  type: TableType;
  name?: string;
  batch?: string;
  all?: boolean;
  verify?: boolean;
  dryRun?: boolean;
}

interface SyncResult {
  name: string;
  success: boolean;
  url?: string;
  error?: string;
  status?: 'updated' | 'already-set' | 'not-found' | 'r2-missing';
}

const R2_CONFIG = {
  bucket: 'mystica-assets',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
};

function createR2Client(): S3Client {
  const { accountId, accessKeyId, secretAccessKey } = R2_CONFIG;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not found in .env.local');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function createSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function normalizeNameForR2(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function getR2Key(type: TableType, name: string): string {
  const sanitizedName = normalizeNameForR2(name);

  switch (type) {
    case 'materials':
      return `materials/${sanitizedName}.png`;
    default:
      throw new Error(`getR2Key should not be called for type: ${type}. Use getImageUrlForItem for items.`);
  }
}

function getTableConfig(type: TableType): { tableName: string; nameColumn: string; imageColumn: string } {
  switch (type) {
    case 'items':
      return { tableName: 'items', nameColumn: 'name', imageColumn: 'generated_image_url' };
    case 'materials':
      return { tableName: 'materials', nameColumn: 'name', imageColumn: 'image_url' };
    default:
      throw new Error(`Unknown table type: ${type}`);
  }
}

/**
 * Smart URL resolution for items (from populate-item-images.ts logic)
 * Priority: combo_hash → specific → category default
 */
async function getImageUrlForItem(item: any): Promise<string | null> {
  const itemTypeName = item.itemtypes.name;
  const category = item.itemtypes.category;
  const comboHash = item.material_combo_hash;

  // 1. If item has combo_hash (materials applied), use items-crafted path
  if (comboHash) {
    const slug = normalizeNameForR2(itemTypeName);
    const craftedKey = `items-crafted/${slug}/${comboHash}.png`;

    if (await checkR2AssetExists(craftedKey)) {
      return `${R2_PUBLIC_URL}/${craftedKey}`;
    }
  }

  // 2. Check for specific item image
  const specificKey = `items/${normalizeNameForR2(itemTypeName)}.png`;
  if (await checkR2AssetExists(specificKey)) {
    return `${R2_PUBLIC_URL}/${specificKey}`;
  }

  // 3. Use category default
  const defaultKey = `items/default_${category}.png`;
  if (await checkR2AssetExists(defaultKey)) {
    return `${R2_PUBLIC_URL}/${defaultKey}`;
  }

  console.warn(`  ⚠️  No image found for ${itemTypeName} (${category})`);
  return null;
}

async function checkR2AssetExists(r2Key: string): Promise<boolean> {
  const client = createR2Client();

  try {
    await client.send(new HeadObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: r2Key,
    }));
    return true;
  } catch (error) {
    return false;
  }
}

async function syncSingle(
  supabase: SupabaseClient,
  type: TableType,
  name: string,
  verify: boolean,
  dryRun: boolean
): Promise<SyncResult> {
  const config = getTableConfig(type);

  console.log(`\n🔄 Processing: ${name}`);

  // Fetch record from database (need full record for items)
  let selectQuery = `${config.nameColumn}, ${config.imageColumn}`;
  if (type === 'items') {
    selectQuery += `, material_combo_hash, itemtypes!inner (name, category)`;
  }

  const { data: existing, error: fetchError } = await supabase
    .from(config.tableName)
    .select(selectQuery)
    .ilike(config.nameColumn, name)
    .single();

  if (fetchError || !existing) {
    console.log(`  ❌ Not found in database`);
    return { name, success: false, status: 'not-found', error: 'Record not found in database' };
  }

  // Determine image URL based on type
  let imageUrl: string | null;

  if (type === 'items') {
    // Use smart URL resolution for items
    imageUrl = await getImageUrlForItem(existing);
    if (!imageUrl) {
      return { name, success: false, status: 'r2-missing', error: 'No suitable image found in R2' };
    }
  } else {
    // Simple path for materials
    const r2Key = getR2Key(type, name);
    imageUrl = `${R2_PUBLIC_URL}/${r2Key}`;

    // Verify R2 asset exists if requested
    if (verify) {
      console.log(`  🔍 Verifying R2 asset exists...`);
      const exists = await checkR2AssetExists(r2Key);
      if (!exists) {
        console.log(`  ⚠️  R2 asset not found: ${r2Key}`);
        return { name, success: false, status: 'r2-missing', error: 'R2 asset not found' };
      }
      console.log(`  ✓ R2 asset exists`);
    }
  }

  // Check if already set
  if (existing[config.imageColumn] === imageUrl) {
    console.log(`  ℹ️  Already set to: ${imageUrl}`);
    return { name, success: true, url: imageUrl, status: 'already-set' };
  }

  if (dryRun) {
    console.log(`  [DRY RUN] Would update ${config.imageColumn} to: ${imageUrl}`);
    return { name, success: true, url: imageUrl, status: 'updated' };
  }

  // Update database
  const { error: updateError } = await supabase
    .from(config.tableName)
    .update({ [config.imageColumn]: imageUrl })
    .ilike(config.nameColumn, name);

  if (updateError) {
    console.log(`  ❌ Database update failed: ${updateError.message}`);
    return { name, success: false, error: updateError.message };
  }

  console.log(`  ✅ Updated ${config.imageColumn} to: ${imageUrl}`);
  return { name, success: true, url: imageUrl, status: 'updated' };
}

async function syncAll(
  supabase: SupabaseClient,
  type: TableType,
  verify: boolean,
  dryRun: boolean
): Promise<void> {
  console.log(`\n📦 Syncing all ${type}...`);

  const config = getTableConfig(type);

  // Fetch all records without image URLs (need full record for items)
  let selectQuery = config.nameColumn;
  if (type === 'items') {
    selectQuery += `, material_combo_hash, itemtypes!inner (name, category)`;
  }

  const { data: records, error } = await supabase
    .from(config.tableName)
    .select(selectQuery)
    .is(config.imageColumn, null);

  if (error) {
    throw new Error(`Failed to fetch ${type}: ${error.message}`);
  }

  if (!records || records.length === 0) {
    console.log(`\n✅ All ${type} already have image URLs set`);
    return;
  }

  console.log(`Found ${records.length} ${type} without image URLs`);

  if (dryRun) {
    console.log('\n[DRY RUN MODE - No database updates will be made]');
  }

  const results: SyncResult[] = [];

  for (const record of records) {
    const name = record[config.nameColumn];
    const result = await syncSingle(supabase, type, name, verify, dryRun);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`SYNC SUMMARY ${dryRun ? '[DRY RUN]' : ''}`);
  console.log('='.repeat(60));

  const updated = results.filter(r => r.status === 'updated');
  const alreadySet = results.filter(r => r.status === 'already-set');
  const notFound = results.filter(r => r.status === 'not-found');
  const r2Missing = results.filter(r => r.status === 'r2-missing');

  if (updated.length > 0) {
    console.log(`\n✅ Updated: ${updated.length}`);
    updated.forEach(r => console.log(`   • ${r.name}`));
  }

  if (alreadySet.length > 0) {
    console.log(`\nℹ️  Already Set: ${alreadySet.length}`);
    alreadySet.forEach(r => console.log(`   • ${r.name}`));
  }

  if (notFound.length > 0) {
    console.log(`\n⚠️  Not Found in DB: ${notFound.length}`);
    notFound.forEach(r => console.log(`   • ${r.name}`));
  }

  if (r2Missing.length > 0) {
    console.log(`\n❌ R2 Asset Missing: ${r2Missing.length}`);
    r2Missing.forEach(r => console.log(`   • ${r.name}`));
  }

  console.log('\n' + '='.repeat(60));
}

async function syncBatch(
  supabase: SupabaseClient,
  type: TableType,
  names: string[],
  verify: boolean,
  dryRun: boolean
): Promise<void> {
  console.log(`\n📦 Syncing batch of ${names.length} ${type}...`);

  if (dryRun) {
    console.log('\n[DRY RUN MODE - No database updates will be made]');
  }

  const results: SyncResult[] = [];

  for (const name of names) {
    const result = await syncSingle(supabase, type, name.trim(), verify, dryRun);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`BATCH SYNC SUMMARY ${dryRun ? '[DRY RUN]' : ''}`);
  console.log('='.repeat(60));

  const updated = results.filter(r => r.status === 'updated');
  const alreadySet = results.filter(r => r.status === 'already-set');
  const notFound = results.filter(r => r.status === 'not-found');
  const r2Missing = results.filter(r => r.status === 'r2-missing');

  if (updated.length > 0) {
    console.log(`\n✅ Updated: ${updated.length}/${results.length}`);
    updated.forEach(r => console.log(`   • ${r.name} → ${r.url}`));
  }

  if (alreadySet.length > 0) {
    console.log(`\nℹ️  Already Set: ${alreadySet.length}/${results.length}`);
    alreadySet.forEach(r => console.log(`   • ${r.name}`));
  }

  if (notFound.length > 0) {
    console.log(`\n⚠️  Not Found in DB: ${notFound.length}/${results.length}`);
    notFound.forEach(r => console.log(`   • ${r.name}`));
  }

  if (r2Missing.length > 0) {
    console.log(`\n❌ R2 Asset Missing: ${r2Missing.length}/${results.length}`);
    r2Missing.forEach(r => console.log(`   • ${r.name}`));
  }

  console.log('\n' + '='.repeat(60));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 1 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Sync to Database - Database Sync Tool

Syncs R2 asset URLs to the Supabase database for items and materials.

Usage:
  pnpm sync-to-db --type TYPE [--name NAME | --batch NAMES | --all] [options]

Required Arguments:
  --type TYPE           Table type: items, materials

Sync Modes (choose one):
  --name NAME           Sync single record by name
  --batch NAMES         Sync multiple records (comma-separated names)
  --all                 Sync all records missing image URLs

Options:
  --verify              Verify R2 asset exists before updating database
  --dry-run             Preview changes without updating database
  -h, --help            Show this help message

Table Configurations:
  items       → items.generated_image_url (Smart URL resolution)
                • items-crafted/{slug}/{combo_hash}.png (combo items)
                • items/{name}.png (specific items)
                • items/default_{category}.png (category defaults)
  materials   → materials.image_url (R2: materials/{name}.png)

Examples:
  # Sync single item
  pnpm sync-to-db --type items --name "Fire Sword"

  # Sync batch of materials
  pnpm sync-to-db --type materials --batch "wood,crystal,metal"

  # Sync all items without image URLs
  pnpm sync-to-db --type items --all

  # Dry run to preview changes
  pnpm sync-to-db --type items --all --dry-run

  # Verify R2 assets exist before syncing
  pnpm sync-to-db --type materials --all --verify

Environment Variables Required:
  SUPABASE_URL              Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY Service role key (for database writes)
  R2_PUBLIC_URL             R2 public URL (for generating image URLs)

  For --verify:
  CLOUDFLARE_ACCOUNT_ID     Cloudflare account ID
  R2_ACCESS_KEY_ID          R2 API token
  R2_SECRET_ACCESS_KEY      R2 API token secret

Notes:
  - Uses case-insensitive name matching
  - Skips records that already have image URLs set
  - Items use smart URL resolution with combo_hash support
  - Reports detailed status for each record
`);
    process.exit(0);
  }

  const options: Partial<SyncOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--type' && args[i + 1]) {
      options.type = args[++i] as TableType;
    } else if (arg === '--name' && args[i + 1]) {
      options.name = args[++i];
    } else if (arg === '--batch' && args[i + 1]) {
      options.batch = args[++i];
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--verify') {
      options.verify = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  // Validate options
  if (!options.type) {
    console.error('❌ --type is required');
    process.exit(1);
  }

  const validTypes: TableType[] = ['items', 'materials'];
  if (!validTypes.includes(options.type)) {
    console.error(`❌ Invalid type. Choose from: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  const modeCount = [options.name, options.batch, options.all].filter(Boolean).length;
  if (modeCount === 0) {
    console.error('❌ One of --name, --batch, or --all is required');
    process.exit(1);
  }

  if (modeCount > 1) {
    console.error('❌ Cannot use --name, --batch, and --all together');
    process.exit(1);
  }

  const supabase = createSupabaseClient();

  if (options.name) {
    const result = await syncSingle(
      supabase,
      options.type,
      options.name,
      options.verify || false,
      options.dryRun || false
    );

    if (!result.success) {
      console.error(`\n❌ Sync failed: ${result.error}`);
      process.exit(1);
    }

    console.log('\n✅ Sync complete');
  } else if (options.batch) {
    const names = options.batch.split(',').map(n => n.trim());
    await syncBatch(supabase, options.type, names, options.verify || false, options.dryRun || false);
  } else if (options.all) {
    await syncAll(supabase, options.type, options.verify || false, options.dryRun || false);
  }
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

export { syncSingle, syncBatch, syncAll };
export type { SyncOptions, SyncResult, TableType };
