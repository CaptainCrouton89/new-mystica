/**
 * Run database migrations using direct PostgreSQL connection
 * Usage: pnpm tsx run-migrations.ts
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local', override: true });

async function runMigrations() {
  // Create PostgreSQL client
  const client = new Client({
    connectionString: process.env.SUPABASE_CONNECTION_STRING,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Migration 1: Add image_url to materials
    console.log('📄 Running migration: add-image-url-to-materials.sql');
    await client.query(`
      ALTER TABLE materials
      ADD COLUMN IF NOT EXISTS image_url TEXT;
    `);
    console.log('✅ Added image_url column to materials table');

    await client.query(`
      COMMENT ON COLUMN materials.image_url IS 'URL to material image in R2 storage';
    `);
    console.log('✅ Added comment to materials.image_url\n');

    // Migration 2: Add image_url to enemytypes
    console.log('📄 Running migration: add-image-url-to-enemytypes.sql');
    await client.query(`
      ALTER TABLE enemytypes
      ADD COLUMN IF NOT EXISTS image_url TEXT;
    `);
    console.log('✅ Added image_url column to enemytypes table');

    await client.query(`
      COMMENT ON COLUMN enemytypes.image_url IS 'URL to enemy type base image in R2 storage';
    `);
    console.log('✅ Added comment to enemytypes.image_url\n');

    // Verify migrations
    console.log('🔍 Verifying migrations...\n');

    const materialsCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'materials' AND column_name = 'image_url';
    `);

    const enemytypesCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'enemytypes' AND column_name = 'image_url';
    `);

    console.log('Materials table:');
    console.table(materialsCheck.rows);

    console.log('\nEnemytypes table:');
    console.table(enemytypesCheck.rows);

    console.log('\n✅ All migrations completed successfully!');

  } catch (error: any) {
    console.error('❌ Migration error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

runMigrations().catch(console.error);
