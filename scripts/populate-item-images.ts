/**
 * Populate generated_image_url for all items in database
 *
 * Strategy:
 * 1. For items with combo_hash (materials applied): Use items-crafted/{slug}/{hash}.png
 * 2. For base items: Check if specific image exists (items/{snake_case_name}.png)
 * 3. Fallback: Use category default (items/default_{category}.png)
 *
 * @deprecated This functionality has been integrated into sync-to-db.ts
 * Please use: pnpm sync-to-db --type items --all
 */

import { createClient } from '@supabase/supabase-js';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true });

// Runtime validation for required env vars
function validateRequiredEnvVars(): void {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CLOUDFLARE_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_PUBLIC_URL',
    'R2_BUCKET_NAME'
  ];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Validate environment variables on startup
validateRequiredEnvVars();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;
const BUCKET = process.env.R2_BUCKET_NAME!;

/**
 * Normalize name to snake_case for R2 file lookup
 */
function normalizeNameForR2(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/**
 * Check if a file exists in R2
 */
async function checkR2FileExists(key: string): Promise<boolean> {
  try {
    await r2Client.send(new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Get the best available image URL for an item
 */
async function getImageUrlForItem(item: any): Promise<string | null> {
  const itemTypeName = item.itemtypes.name;
  const category = item.itemtypes.category;
  const comboHash = item.material_combo_hash;

  // 1. If item has combo_hash (materials applied), use items-crafted path
  if (comboHash) {
    const slug = normalizeNameForR2(itemTypeName);
    const craftedKey = `items-crafted/${slug}/${comboHash}.png`;

    if (await checkR2FileExists(craftedKey)) {
      return `${R2_PUBLIC_URL}/${craftedKey}`;
    }
  }

  // 2. Check for specific item image
  const specificKey = `items/${normalizeNameForR2(itemTypeName)}.png`;
  if (await checkR2FileExists(specificKey)) {
    return `${R2_PUBLIC_URL}/${specificKey}`;
  }

  // 3. Use category default
  const defaultKey = `items/default_${category}.png`;
  if (await checkR2FileExists(defaultKey)) {
    return `${R2_PUBLIC_URL}/${defaultKey}`;
  }

  console.warn(`⚠️  No image found for ${itemTypeName} (${category})`);
  return null;
}

async function populateItemImages() {
  console.log('🔍 Fetching all items from database...\n');

  // Fetch all items with their item types
  const { data: items, error } = await supabase
    .from('items')
    .select(`
      id,
      material_combo_hash,
      generated_image_url,
      itemtypes!inner (
        name,
        category
      )
    `);

  if (error) {
    throw new Error(`Failed to fetch items: ${error.message}`);
  }

  if (!items || items.length === 0) {
    console.log('No items found in database');
    return;
  }

  console.log(`Found ${items.length} items\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    try {
      // Skip if already has image URL
      if (item.generated_image_url) {
        skipped++;
        continue;
      }

      const imageUrl = await getImageUrlForItem(item);

      if (imageUrl) {
        // Update database
        const { error: updateError } = await supabase
          .from('items')
          .update({ generated_image_url: imageUrl })
          .eq('id', item.id);

        if (updateError) {
          console.error(`❌ Failed to update item ${item.id}: ${updateError.message}`);
          failed++;
        } else {
          console.log(`✓ ${item.itemtypes.name}: ${imageUrl}`);
          updated++;
        }
      } else {
        failed++;
      }
    } catch (err: any) {
      console.error(`❌ Error processing item ${item.id}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (already had image): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total: ${items.length}`);
}

populateItemImages().catch(console.error);
