#!/usr/bin/env node
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

async function executeQuery(query: string) {
  try {
    // Create a SQL execution function via Edge Functions workaround
    // Use PostgREST's raw query capability through a custom endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: query })
    });

    if (!response.ok) {
      // If function doesn't exist, provide instructions
      if (response.status === 404) {
        console.error('SQL execution function not found. Creating it now...\n');
        console.error('Run this SQL in your Supabase SQL Editor:');
        console.error('\n---\n');
        console.error(`CREATE OR REPLACE FUNCTION exec(sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || sql || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;`);
        console.error('\n---\n');
        process.exit(1);
      }

      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      console.log('No results');
      return;
    }

    // Get column names from first row
    const columns = Object.keys(data[0]);

    // Print header
    console.log('| ' + columns.join(' | ') + ' |');
    console.log('|' + columns.map(() => '---').join('|') + '|');

    // Print rows
    data.forEach((row: Record<string, any>) => {
      const values = columns.map(col => {
        const val = row[col];
        if (val === null) return 'null';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      });
      console.log('| ' + values.join(' | ') + ' |');
    });
  } catch (err) {
    if (err instanceof Error) {
      console.error('Query error:', err.message);
    } else {
      console.error('Unexpected error:', err);
    }
    process.exit(1);
  }
}

// Get SQL query from command line arguments
const query = process.argv.slice(2).join(' ');

if (!query) {
  console.error('Usage: cd scripts && pnpm query-db "SELECT * FROM your_table LIMIT 10"');
  process.exit(1);
}

executeQuery(query);
