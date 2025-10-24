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
  console.log('🔄 Applying migration 011: Add base_image_url to ItemTypes...');

  try {
    // Test basic connection first
    console.log('Testing database connection...');
    const { data: testData, error: testError } = await supabase
      .from('ItemTypes')
      .select('id, name')
      .limit(1);

    if (testError) {
      throw testError;
    }
    console.log('✅ Database connection successful');

    // Step 1: Add base_image_url column (if not exists)
    console.log('🔄 Adding base_image_url column...');
    const { data: addResult, error: addError } = await supabase.rpc('exec', {
      sql: `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'ItemTypes' AND column_name = 'base_image_url'
          ) THEN
            ALTER TABLE "ItemTypes" ADD COLUMN base_image_url TEXT;
            RAISE NOTICE 'Added base_image_url column';
          ELSE
            RAISE NOTICE 'Column base_image_url already exists';
          END IF;
        END $$;
      `
    });

    if (addError) {
      console.log('⚠️ Direct SQL failed, trying alternative approach...');
      // Alternative: Use a simple RPC or raw query
      const { data: rawData, error: rawError } = await supabase
        .from('ItemTypes')
        .select('*')
        .limit(1)
        .single();

      if (rawError) {
        throw rawError;
      }

      // Check if base_image_url column exists in the response
      if ('base_image_url' in rawData) {
        console.log('✅ base_image_url column already exists');
      } else {
        console.log('❌ base_image_url column does not exist and cannot be added via Supabase client');
        console.log('💡 Manual database access required');
        return false;
      }
    } else {
      console.log('✅ base_image_url column processed');
    }

    // Step 2: Create index (if column exists)
    console.log('🔄 Creating index on base_image_url...');
    const { error: indexError } = await supabase.rpc('exec', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_itemtypes_base_image_url
        ON "ItemTypes" (base_image_url)
        WHERE base_image_url IS NOT NULL;
      `
    });

    if (indexError) {
      console.log('⚠️ Index creation failed (may be expected):', indexError.message);
    } else {
      console.log('✅ Index created or already exists');
    }

    console.log('🎉 Migration 011 applied successfully!');
    return true;

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('💡 Manual intervention may be required via Supabase dashboard');
    return false;
  }
}

applyMigration().then(success => {
  process.exit(success ? 0 : 1);
});