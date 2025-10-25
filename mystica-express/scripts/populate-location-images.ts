#!/usr/bin/env tsx

/**
 * Populate Location Images Script
 *
 * Updates locations in the database with R2 image URLs based on their location_type.
 * Images should be uploaded to R2 manually first at: location-images/{type}.png
 *
 * This script:
 * - Queries all unique location types
 * - For each type, constructs the R2 URL: https://pub-{account-id}.r2.dev/location-images/{type}.png
 * - Updates all locations of that type with the image URL
 *
 * Usage: cd mystica-express && npx tsx scripts/populate-location-images.ts
 *
 * NOTE: Images must be uploaded to R2 first. Use Wrangler CLI:
 *   wrangler r2 object put item-images/location-images/forest.png --file path/to/forest.png
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CLOUDFLARE_ACCOUNT_ID || !R2_BUCKET_NAME) {
  console.error('❌ Missing required environment variables:');
  console.error('  SUPABASE_URL:', !!SUPABASE_URL);
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_ROLE_KEY);
  console.error('  CLOUDFLARE_ACCOUNT_ID:', !!CLOUDFLARE_ACCOUNT_ID);
  console.error('  R2_BUCKET_NAME:', !!R2_BUCKET_NAME);
  process.exit(1);
}

// Supabase client with service role for direct access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Construct R2 public URL base
const R2_PUBLIC_URL = `https://pub-${CLOUDFLARE_ACCOUNT_ID}.r2.dev/${R2_BUCKET_NAME}`;

interface LocationTypeRow {
  location_type: string | null;
}

/**
 * Get all unique location types from the database
 */
async function getUniqueLocationTypes(): Promise<string[]> {
  console.log('🔍 Fetching unique location types...');

  const { data, error } = await supabase
    .from('locations')
    .select('location_type')
    .not('location_type', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch location types: ${error.message}`);
  }

  // Extract unique location types
  const uniqueTypes = Array.from(
    new Set((data as LocationTypeRow[]).map(row => row.location_type))
  ).filter(Boolean) as string[];

  console.log(`✅ Found ${uniqueTypes.length} unique location types:`, uniqueTypes);
  return uniqueTypes;
}

/**
 * Update all locations of a given type with the image URL
 */
async function updateLocationsWithImage(locationType: string): Promise<number> {
  const imageUrl = `${R2_PUBLIC_URL}/location-images/${locationType}.png`;

  console.log(`📍 Updating ${locationType} locations with image: ${imageUrl}`);

  const { data, error } = await supabase
    .from('locations')
    .update({ image_url: imageUrl })
    .eq('location_type', locationType)
    .select('id');

  if (error) {
    console.error(`❌ Error updating ${locationType} locations:`, error.message);
    return 0;
  }

  const updateCount = data?.length || 0;
  console.log(`✅ Updated ${updateCount} ${locationType} locations`);
  return updateCount;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting location image population...\n');

  try {
    // Get all unique location types
    const locationTypes = await getUniqueLocationTypes();

    if (locationTypes.length === 0) {
      console.log('⚠️  No location types found in database');
      return;
    }

    console.log('\n📝 Location type image URLs (ensure these images exist in R2):');
    locationTypes.forEach(type => {
      console.log(`  - ${R2_PUBLIC_URL}/location-images/${type}.png`);
    });
    console.log('');

    // Update each location type
    let totalUpdated = 0;
    for (const type of locationTypes) {
      const count = await updateLocationsWithImage(type);
      totalUpdated += count;
    }

    console.log(`\n✅ Successfully updated ${totalUpdated} locations across ${locationTypes.length} types`);
    console.log('\n📋 Next steps:');
    console.log('  1. Upload images to R2 using Wrangler CLI');
    console.log('  2. Test by fetching locations via API: GET /api/v1/locations/nearby');
    console.log('  3. Verify imageUrl field is populated in responses');

  } catch (error) {
    console.error('\n❌ Error populating location images:', error);
    process.exit(1);
  }
}

// Run the script
main();
