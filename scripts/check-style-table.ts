import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log('Checking styledefinitions table...\n');
  
  const { data, error } = await supabase
    .from('styledefinitions')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
    console.log('\nTrying to list tables...');
    // This won't work but let's see the error
  } else {
    console.log('Table exists, data:', data);
  }
}

main();
