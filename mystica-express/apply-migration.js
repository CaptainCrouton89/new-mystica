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

async function applyMigration() {
  console.log('Applying migration 011: Add base_image_url to ItemTypes...');

  try {
    // Step 1: Add base_image_url column
    console.log('Adding base_image_url column...');
    const { error: addColumnError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE ItemTypes ADD COLUMN base_image_url TEXT;'
    });

    if (addColumnError && !addColumnError.message.includes('already exists')) {
      throw addColumnError;
    }
    console.log('✅ base_image_url column added');

    // Step 2: Drop appearance_data column if exists
    console.log('Dropping appearance_data column...');
    const { error: dropColumnError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE ItemTypes DROP COLUMN IF EXISTS appearance_data;'
    });

    if (dropColumnError) {
      throw dropColumnError;
    }
    console.log('✅ appearance_data column dropped');

    // Step 3: Create index
    console.log('Creating index on base_image_url...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: 'CREATE INDEX IF NOT EXISTS idx_itemtypes_base_image_url ON ItemTypes (base_image_url) WHERE base_image_url IS NOT NULL;'
    });

    if (indexError) {
      throw indexError;
    }
    console.log('✅ Index created');

    console.log('🎉 Migration 011 applied successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);

    // Try alternative direct SQL execution
    console.log('Trying alternative approach...');
    try {
      const { error: sqlError } = await supabase
        .from('ItemTypes')
        .select('id')
        .limit(1);

      if (sqlError) {
        throw sqlError;
      }

      console.log('✅ Database connection verified');
      console.log('⚠️ Migration may need to be applied manually via Supabase dashboard');

    } catch (connectionError) {
      console.error('❌ Database connection failed:', connectionError.message);
    }
  }
}

applyMigration();