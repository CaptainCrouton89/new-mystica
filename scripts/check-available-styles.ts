import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log('Available styles in database:\n');
  
  const { data: styles } = await supabase.from('styledefinitions').select('id, name');
  
  console.log(`Total styles: ${styles?.length || 0}\n`);
  styles?.forEach(s => console.log(`  - ${s.name} (${s.id})`));
}

main();
