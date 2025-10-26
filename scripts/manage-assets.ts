/**
 * Manage Assets - Asset Management Tool
 *
 * List, count, check status, and manage assets across local files, R2, and database.
 *
 * Usage:
 *   pnpm manage-assets --list items
 *   pnpm manage-assets --count --all
 *   pnpm manage-assets --status items --name "Fire Sword"
 *   pnpm manage-assets --diff materials
 *   pnpm manage-assets --delete items --name "Fire Sword" --confirm
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

dotenv.config({ path: '.env.local', override: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type AssetType = 'items' | 'materials' | 'monsters';

interface ManageOptions {
  list?: boolean;
  count?: boolean;
  status?: boolean;
  diff?: boolean;
  delete?: boolean;
  type?: AssetType;
  name?: string;
  all?: boolean;
  confirm?: boolean;
}

interface AssetStatus {
  name: string;
  local: boolean;
  r2: boolean;
  db: boolean;
  dbImageUrl?: string | null;
}

const R2_CONFIG = {
  bucket: 'mystica-assets',
  publicUrl: process.env.R2_PUBLIC_URL,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
};

const LOCAL_PATHS = {
  items: 'output/raw',
  materials: 'output/raw',
  monsters: 'output/monsters'
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

function getTableConfig(type: AssetType): { tableName: string; nameColumn: string; imageColumn: string } {
  switch (type) {
    case 'items':
      return { tableName: 'items', nameColumn: 'name', imageColumn: 'generated_image_url' };
    case 'materials':
      return { tableName: 'materials', nameColumn: 'name', imageColumn: 'image_url' };
    case 'monsters':
      return { tableName: 'enemytypes', nameColumn: 'name', imageColumn: 'image_url' };
    default:
      throw new Error(`Unknown asset type: ${type}`);
  }
}

function getR2Prefix(type: AssetType): string {
  switch (type) {
    case 'items':
      return 'items/';
    case 'materials':
      return 'materials/';
    case 'monsters':
      return 'monsters/';
    default:
      throw new Error(`Unknown asset type: ${type}`);
  }
}

async function listLocalAssets(type: AssetType): Promise<string[]> {
  const localPath = LOCAL_PATHS[type];

  if (!fs.existsSync(localPath)) {
    return [];
  }

  const files = fs.readdirSync(localPath);
  return files
    .filter(f => f.endsWith('.png'))
    .map(f => path.basename(f, '.png'));
}

async function listR2Assets(type: AssetType): Promise<string[]> {
  const client = createR2Client();
  const prefix = getR2Prefix(type);

  const response = await client.send(new ListObjectsV2Command({
    Bucket: R2_CONFIG.bucket,
    Prefix: prefix,
  }));

  if (!response.Contents) {
    return [];
  }

  return response.Contents
    .map(obj => obj.Key)
    .filter((key): key is string => !!key)
    .map(key => path.basename(key, '.png'));
}

async function listDatabaseAssets(supabase: SupabaseClient, type: AssetType): Promise<{ name: string; imageUrl: string | null }[]> {
  const config = getTableConfig(type);

  const { data, error } = await supabase
    .from(config.tableName)
    .select(`${config.nameColumn}, ${config.imageColumn}`);

  if (error) {
    throw new Error(`Failed to fetch ${type}: ${error.message}`);
  }

  return (data || []).map(record => ({
    name: record[config.nameColumn],
    imageUrl: record[config.imageColumn]
  }));
}

async function checkAssetStatus(
  type: AssetType,
  name: string,
  supabase: SupabaseClient
): Promise<AssetStatus> {
  const status: AssetStatus = {
    name,
    local: false,
    r2: false,
    db: false,
    dbImageUrl: null
  };

  // Check local
  const localPath = path.join(LOCAL_PATHS[type], `${name}.png`);
  status.local = fs.existsSync(localPath);

  // Check R2
  const client = createR2Client();
  const r2Key = `${getR2Prefix(type)}${name}.png`;

  try {
    await client.send(new HeadObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: r2Key,
    }));
    status.r2 = true;
  } catch {
    status.r2 = false;
  }

  // Check database
  const config = getTableConfig(type);
  const { data } = await supabase
    .from(config.tableName)
    .select(`${config.nameColumn}, ${config.imageColumn}`)
    .ilike(config.nameColumn, name)
    .single();

  if (data) {
    status.db = true;
    status.dbImageUrl = data[config.imageColumn];
  }

  return status;
}

async function promptConfirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function deleteAsset(
  type: AssetType,
  name: string,
  supabase: SupabaseClient,
  confirm: boolean
): Promise<void> {
  console.log(`\n🗑️  Delete asset: ${name} (${type})`);

  // Check status first
  const status = await checkAssetStatus(type, name, supabase);

  console.log('\nCurrent Status:');
  console.log(`  Local:    ${status.local ? '✓ exists' : '✗ not found'}`);
  console.log(`  R2:       ${status.r2 ? '✓ exists' : '✗ not found'}`);
  console.log(`  Database: ${status.db ? '✓ exists' : '✗ not found'}${status.dbImageUrl ? ` (${status.dbImageUrl})` : ''}`);

  if (!status.local && !status.r2 && !status.db) {
    console.log('\n⚠️  Asset not found in any location');
    return;
  }

  // Confirm deletion
  if (!confirm) {
    const shouldDelete = await promptConfirm('\n⚠️  This will delete the asset from all locations. Continue?');
    if (!shouldDelete) {
      console.log('❌ Deletion cancelled');
      return;
    }
  }

  console.log('\n🗑️  Deleting asset...');

  // Delete from local
  if (status.local) {
    const localPath = path.join(LOCAL_PATHS[type], `${name}.png`);
    fs.unlinkSync(localPath);
    console.log('  ✓ Deleted from local');
  }

  // Delete from R2
  if (status.r2) {
    const client = createR2Client();
    const r2Key = `${getR2Prefix(type)}${name}.png`;

    await client.send(new DeleteObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: r2Key,
    }));
    console.log('  ✓ Deleted from R2');
  }

  // Remove image URL from database (don't delete record)
  if (status.db && status.dbImageUrl) {
    const config = getTableConfig(type);

    await supabase
      .from(config.tableName)
      .update({ [config.imageColumn]: null })
      .ilike(config.nameColumn, name);

    console.log('  ✓ Removed image URL from database');
  }

  console.log('\n✅ Asset deleted successfully');
}

async function listAssets(type: AssetType, supabase: SupabaseClient): Promise<void> {
  console.log(`\n📋 Listing ${type}...\n`);

  const [localAssets, r2Assets, dbAssets] = await Promise.all([
    listLocalAssets(type),
    listR2Assets(type),
    listDatabaseAssets(supabase, type)
  ]);

  // Combine all unique names
  const allNames = new Set([
    ...localAssets,
    ...r2Assets,
    ...dbAssets.map(a => a.name)
  ]);

  console.log(`Total unique assets: ${allNames.size}\n`);

  const statuses: AssetStatus[] = [];

  for (const name of allNames) {
    const status = await checkAssetStatus(type, name, supabase);
    statuses.push(status);
  }

  // Group by status
  const complete = statuses.filter(s => s.local && s.r2 && s.db && s.dbImageUrl);
  const partial = statuses.filter(s => !complete.includes(s));

  if (complete.length > 0) {
    console.log(`✅ Complete (${complete.length}):`);
    complete.forEach(s => {
      console.log(`   • ${s.name}`);
    });
    console.log();
  }

  if (partial.length > 0) {
    console.log(`⚠️  Partial (${partial.length}):`);
    partial.forEach(s => {
      const locations = [];
      if (s.local) locations.push('local');
      if (s.r2) locations.push('R2');
      if (s.db) {
        if (s.dbImageUrl) {
          locations.push('DB✓');
        } else {
          locations.push('DB(no URL)');
        }
      }
      console.log(`   • ${s.name} [${locations.join(', ')}]`);
    });
  }
}

async function countAssets(types: AssetType[], supabase: SupabaseClient): Promise<void> {
  console.log('\n📊 Asset Count Summary\n');

  for (const type of types) {
    const [localAssets, r2Assets, dbAssets] = await Promise.all([
      listLocalAssets(type),
      listR2Assets(type),
      listDatabaseAssets(supabase, type)
    ]);

    const dbWithImages = dbAssets.filter(a => a.imageUrl);

    console.log(`${type}:`);
    console.log(`  Local:         ${localAssets.length}`);
    console.log(`  R2:            ${r2Assets.length}`);
    console.log(`  DB (total):    ${dbAssets.length}`);
    console.log(`  DB (with URL): ${dbWithImages.length}`);
    console.log();
  }
}

async function showDiff(type: AssetType, supabase: SupabaseClient): Promise<void> {
  console.log(`\n🔍 Diff Analysis for ${type}\n`);

  const [localAssets, r2Assets, dbAssets] = await Promise.all([
    listLocalAssets(type),
    listR2Assets(type),
    listDatabaseAssets(supabase, type)
  ]);

  const localSet = new Set(localAssets);
  const r2Set = new Set(r2Assets);
  const dbSet = new Set(dbAssets.map(a => a.name));
  const dbWithImageSet = new Set(dbAssets.filter(a => a.imageUrl).map(a => a.name));

  // Local only
  const localOnly = localAssets.filter(a => !r2Set.has(a) && !dbSet.has(a));
  if (localOnly.length > 0) {
    console.log(`📁 Local only (${localOnly.length}):`);
    localOnly.forEach(a => console.log(`   • ${a}`));
    console.log();
  }

  // R2 only
  const r2Only = r2Assets.filter(a => !localSet.has(a) && !dbSet.has(a));
  if (r2Only.length > 0) {
    console.log(`☁️  R2 only (${r2Only.length}):`);
    r2Only.forEach(a => console.log(`   • ${a}`));
    console.log();
  }

  // DB only
  const dbOnly = dbAssets.filter(a => !localSet.has(a.name) && !r2Set.has(a.name));
  if (dbOnly.length > 0) {
    console.log(`💾 DB only (${dbOnly.length}):`);
    dbOnly.forEach(a => console.log(`   • ${a.name}`));
    console.log();
  }

  // In R2 but not synced to DB
  const r2NotSynced = r2Assets.filter(a => dbSet.has(a) && !dbWithImageSet.has(a));
  if (r2NotSynced.length > 0) {
    console.log(`⚠️  In R2 but not synced to DB (${r2NotSynced.length}):`);
    r2NotSynced.forEach(a => console.log(`   • ${a}`));
    console.log();
  }

  // In DB with URL but not in R2
  const dbUrlNoR2 = dbAssets.filter(a => a.imageUrl && !r2Set.has(a.name));
  if (dbUrlNoR2.length > 0) {
    console.log(`🔗 DB has URL but asset not in R2 (${dbUrlNoR2.length}):`);
    dbUrlNoR2.forEach(a => console.log(`   • ${a.name} → ${a.imageUrl}`));
    console.log();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 1 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Manage Assets - Asset Management Tool

List, count, check status, and manage assets across local files, R2, and database.

Usage:
  pnpm manage-assets [--list | --count | --status | --diff | --delete] [options]

Operations (choose one):
  --list                List all assets with status
  --count               Count assets in each location
  --status              Check status of specific asset
  --diff                Show differences between local/R2/DB
  --delete              Delete asset from all locations

Options:
  --type TYPE           Asset type: items, materials, monsters
  --name NAME           Asset name (required for --status and --delete)
  --all                 Apply to all types (for --count)
  --confirm             Skip confirmation prompt (for --delete)
  -h, --help            Show this help message

Asset Types:
  items       → local: output/raw, R2: items/, DB: items.generated_image_url
  materials   → local: output/raw, R2: materials/, DB: materials.image_url
  monsters    → local: output/monsters, R2: monsters/, DB: enemytypes.image_url

Examples:
  # List all items with status
  pnpm manage-assets --list --type items

  # Count assets across all types
  pnpm manage-assets --count --all

  # Check status of specific material
  pnpm manage-assets --status --type materials --name "wood"

  # Show diff for monsters
  pnpm manage-assets --diff --type monsters

  # Delete asset (with confirmation)
  pnpm manage-assets --delete --type items --name "Fire Sword"

  # Delete asset (skip confirmation)
  pnpm manage-assets --delete --type items --name "Fire Sword" --confirm

Environment Variables Required:
  SUPABASE_URL              Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY Service role key
  R2_PUBLIC_URL             R2 public URL
  CLOUDFLARE_ACCOUNT_ID     Cloudflare account ID
  R2_ACCESS_KEY_ID          R2 API token
  R2_SECRET_ACCESS_KEY      R2 API token secret
`);
    process.exit(0);
  }

  const options: Partial<ManageOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--list') {
      options.list = true;
    } else if (arg === '--count') {
      options.count = true;
    } else if (arg === '--status') {
      options.status = true;
    } else if (arg === '--diff') {
      options.diff = true;
    } else if (arg === '--delete') {
      options.delete = true;
    } else if (arg === '--type' && args[i + 1]) {
      options.type = args[++i] as AssetType;
    } else if (arg === '--name' && args[i + 1]) {
      options.name = args[++i];
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--confirm') {
      options.confirm = true;
    }
  }

  // Validate operations
  const operations = [options.list, options.count, options.status, options.diff, options.delete].filter(Boolean).length;
  if (operations === 0) {
    console.error('❌ One operation is required: --list, --count, --status, --diff, or --delete');
    process.exit(1);
  }

  if (operations > 1) {
    console.error('❌ Only one operation allowed at a time');
    process.exit(1);
  }

  // Validate type
  const validTypes: AssetType[] = ['items', 'materials', 'monsters'];

  if (options.count && options.all) {
    // Count all types - no type validation needed
  } else {
    if (!options.type) {
      console.error('❌ --type is required (or use --all with --count)');
      process.exit(1);
    }

    if (!validTypes.includes(options.type)) {
      console.error(`❌ Invalid type. Choose from: ${validTypes.join(', ')}`);
      process.exit(1);
    }
  }

  // Validate name for status/delete
  if ((options.status || options.delete) && !options.name) {
    console.error('❌ --name is required for --status and --delete');
    process.exit(1);
  }

  const supabase = createSupabaseClient();

  if (options.list && options.type) {
    await listAssets(options.type, supabase);
  } else if (options.count) {
    const types = options.all ? validTypes : [options.type!];
    await countAssets(types, supabase);
  } else if (options.status && options.type && options.name) {
    const status = await checkAssetStatus(options.type, options.name, supabase);

    console.log(`\n📊 Status for: ${options.name} (${options.type})\n`);
    console.log(`  Local:    ${status.local ? '✓ exists' : '✗ not found'}`);
    console.log(`  R2:       ${status.r2 ? '✓ exists' : '✗ not found'}`);
    console.log(`  Database: ${status.db ? '✓ exists' : '✗ not found'}${status.dbImageUrl ? ` → ${status.dbImageUrl}` : ''}\n`);
  } else if (options.diff && options.type) {
    await showDiff(options.type, supabase);
  } else if (options.delete && options.type && options.name) {
    await deleteAsset(options.type, options.name, supabase, options.confirm || false);
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

export { listAssets, countAssets, checkAssetStatus, showDiff, deleteAsset };
export type { AssetType, AssetStatus, ManageOptions };
