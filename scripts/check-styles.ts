import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log('Checking enemy style associations...\n');
  
  const { data: enemies } = await supabase.from('enemytypes').select('id, name');
  
  for (const enemy of enemies || []) {
    const { data: styles } = await supabase
      .from('enemytypestyles')
      .select('style_id, weight_multiplier')
      .eq('enemy_type_id', enemy.id);
    
    console.log(`${enemy.name}: ${styles?.length || 0} styles`);
    if (styles && styles.length === 0) {
      console.log(`  ❌ NO STYLES ASSIGNED!`);
    }
  }
}

main();
