import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

config({ path: '.env.local' });
config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    }
  }
);

// Function to convert name to snake_case (matching image generation logic)
function toSnakeCase(name) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

// Load ItemTypes from seed data
const seedDataPath = path.join('..', 'docs', 'seed-data-items.json');
const seedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));

// R2 base URL
const R2_BASE_URL = 'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev';

async function populateBaseImageUrls() {
  console.log('🔄 Populating base_image_url for all ItemTypes...');

  try {
    // Build the update data
    const updates = seedData.items.map(item => {
      const snakeCaseName = toSnakeCase(item.name);
      const imageUrl = `${R2_BASE_URL}/items/${snakeCaseName}.png`;

      return {
        id: item.id,
        name: item.name,
        base_image_url: imageUrl
      };
    });

    console.log(`📋 Processing ${updates.length} ItemTypes:`);
    updates.forEach(item => {
      console.log(`  ${item.name} -> ${item.base_image_url}`);
    });

    // Update each ItemType individually to ensure proper error handling
    let successCount = 0;
    let errorCount = 0;

    for (const update of updates) {
      try {
        const { data, error } = await supabase
          .from('itemtypes')
          .update({ base_image_url: update.base_image_url })
          .eq('id', update.id)
          .select();

        if (error) {
          console.error(`❌ Failed to update ${update.name} (${update.id}):`, error.message);
          errorCount++;
        } else if (data && data.length > 0) {
          console.log(`✅ Updated ${update.name}`);
          successCount++;
        } else {
          console.warn(`⚠️ No rows updated for ${update.name} (${update.id}) - ItemType may not exist`);
          errorCount++;
        }
      } catch (err) {
        console.error(`❌ Error updating ${update.name}:`, err.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Update Summary:`);
    console.log(`  ✅ Successful updates: ${successCount}`);
    console.log(`  ❌ Failed updates: ${errorCount}`);
    console.log(`  📋 Total ItemTypes: ${updates.length}`);

    if (successCount === updates.length) {
      console.log('\n🎉 All ItemTypes updated successfully!');

      // Verify the updates
      console.log('\n🔍 Verifying updates...');
      const { data: verifyData, error: verifyError } = await supabase
        .from('itemtypes')
        .select('id, name, base_image_url')
        .not('base_image_url', 'is', null);

      if (verifyError) {
        console.error('❌ Verification failed:', verifyError.message);
      } else {
        console.log(`✅ Verified ${verifyData.length} ItemTypes have base_image_url set`);

        // Show a few examples
        console.log('\n📋 Sample verified entries:');
        verifyData.slice(0, 5).forEach(item => {
          console.log(`  ${item.name}: ${item.base_image_url}`);
        });
      }
    } else {
      console.log('\n⚠️ Some updates failed. Please check the errors above.');
    }

    return successCount === updates.length;

  } catch (error) {
    console.error('❌ Population failed:', error.message);
    return false;
  }
}

populateBaseImageUrls().then(success => {
  process.exit(success ? 0 : 1);
});