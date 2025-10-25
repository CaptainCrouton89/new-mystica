#!/usr/bin/env tsx

/**
 * Generate Location Images Script
 *
 * Generates AI images for each location type and uploads them to R2.
 * Then updates the database with the R2 URLs.
 *
 * Location types: library, gym, coffee_shop, park, restaurant
 *
 * Usage: cd scripts && npx tsx generate-location-images.ts
 */

import { generateArbitraryImage, GenerateArbitraryImageOptions } from './generate-arbitrary-image.js';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '..', 'mystica-express', '.env.local') });

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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const R2_PUBLIC_URL = `https://pub-${CLOUDFLARE_ACCOUNT_ID}.r2.dev/${R2_BUCKET_NAME}`;

// Location type definitions with prompts
const LOCATION_TYPES = [
  {
    type: 'library',
    prompt: 'a cozy public library building with books visible through windows, warm lighting, welcoming entrance'
  },
  {
    type: 'gym',
    prompt: 'a modern fitness gym building with large windows, athletic equipment visible, energetic atmosphere'
  },
  {
    type: 'coffee_shop',
    prompt: 'a charming coffee shop storefront with warm lighting, cozy atmosphere, coffee cups and pastries'
  },
  {
    type: 'park',
    prompt: 'a beautiful public park with green trees, walking paths, benches, peaceful natural setting'
  },
  {
    type: 'restaurant',
    prompt: 'an inviting restaurant building with outdoor seating, warm ambiance, welcoming entrance'
  }
];

/**
 * Generate image for a single location type
 */
async function generateLocationImage(locationType: { type: string; prompt: string }): Promise<string> {
  console.log(`\n🎨 Generating image for: ${locationType.type}`);
  console.log(`   Prompt: ${locationType.prompt}`);

  const options: GenerateArbitraryImageOptions = {
    prompt: locationType.prompt,
    outputFormat: 'png',
    r2Path: `location-images/${locationType.type}.png`
  };

  await generateArbitraryImage(options);
  const imageUrl = `${R2_PUBLIC_URL}/location-images/${locationType.type}.png`;
  console.log(`✅ Generated and uploaded: ${imageUrl}`);
  return imageUrl;
}

/**
 * Update database with image URL for a location type
 */
async function updateLocationTypeImage(locationType: string, imageUrl: string): Promise<number> {
  console.log(`\n📝 Updating database for ${locationType}...`);

  const { data, error } = await supabase
    .from('locations')
    .update({ image_url: imageUrl })
    .eq('location_type', locationType)
    .select('id');

  if (error) {
    throw new Error(`Database update failed for ${locationType}: ${error.message}`);
  }

  const count = data?.length || 0;
  console.log(`✅ Updated ${count} locations with type: ${locationType}`);
  return count;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting location image generation pipeline...\n');
  console.log(`📍 Generating images for ${LOCATION_TYPES.length} location types\n`);

  let totalGenerated = 0;
  let totalUpdated = 0;

  for (const locationType of LOCATION_TYPES) {
    try {
      // Generate and upload image
      const imageUrl = await generateLocationImage(locationType);
      totalGenerated++;

      // Update database
      const updateCount = await updateLocationTypeImage(locationType.type, imageUrl);
      totalUpdated += updateCount;

    } catch (error) {
      if (error instanceof Error) {
        console.error(`\n⚠️  Skipping ${locationType.type} due to error: ${error.message}`);
      } else {
        console.error(`\n⚠️  Skipping ${locationType.type} due to unknown error`);
      }
      // Continue with next location type
      continue;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Location image generation complete!');
  console.log('='.repeat(60));
  console.log(`📊 Summary:`);
  console.log(`   - Images generated: ${totalGenerated}/${LOCATION_TYPES.length}`);
  console.log(`   - Database records updated: ${totalUpdated}`);
  console.log(`\n💰 Estimated cost: ~$${(totalGenerated * 0.012).toFixed(3)} (2 Replicate calls per image)`);
  console.log('\n📋 Next steps:');
  console.log('   1. Test the API: GET /api/v1/locations/nearby');
  console.log('   2. Verify imageUrl field is populated');
  console.log('   3. Open the iOS app and check the map view');
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
