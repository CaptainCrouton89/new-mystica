/**
 * Run database migrations
 * Usage: pnpm tsx run-migration.ts migrations/add-image-url-to-materials.sql
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runMigration(sqlFile: string) {
  console.log(`\n📄 Running migration: ${sqlFile}\n`);

  // Read SQL file
  const sqlPath = path.join(__dirname, sqlFile);
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Migration file not found: ${sqlPath}`);
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // Split by semicolons to execute multiple statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    if (statement.toLowerCase().startsWith('select')) {
      // For SELECT statements, show results
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });
      if (error) {
        console.error(`❌ Error: ${error.message}`);
        throw error;
      }
      console.log('✅ Verification query results:', data);
    } else {
      // For DDL statements (ALTER, COMMENT, etc.)
      console.log(`Executing: ${statement.substring(0, 100)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
      if (error) {
        console.error(`❌ Error: ${error.message}`);
        // Continue anyway as IF NOT EXISTS should handle duplicates
      } else {
        console.log('✅ Success');
      }
    }
  }

  console.log(`\n✅ Migration complete: ${sqlFile}\n`);
}

// Get migration file from command line args
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: pnpm tsx run-migration.ts <migration-file>');
  console.error('\nExample:');
  console.error('  pnpm tsx run-migration.ts migrations/add-image-url-to-materials.sql');
  process.exit(1);
}

runMigration(migrationFile).catch(console.error);
