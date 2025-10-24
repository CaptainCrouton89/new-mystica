import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

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

async function checkItemTypes() {
  console.log('🔍 Checking ItemTypes in database...');

  try {
    const { data, error } = await supabase
      .from('itemtypes')
      .select('id, name, category, rarity, base_image_url')
      .order('name');

    if (error) {
      console.error('❌ Query failed:', error.message);
      return;
    }

    console.log(`📋 Found ${data.length} ItemTypes in database:`);
    data.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} (${item.id}) - ${item.category} - ${item.rarity}`);
      if (item.base_image_url) {
        console.log(`   🖼️ Has base_image_url: ${item.base_image_url}`);
      } else {
        console.log(`   ❌ No base_image_url`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkItemTypes();