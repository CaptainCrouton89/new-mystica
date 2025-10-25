import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log('Getting normal style...\n');
  
  // Get the normal style that already exists
  const { data: normalStyle, error: styleError } = await supabase
    .from('styledefinitions')
    .select('id')
    .eq('style_name', 'normal')
    .single();
  
  if (styleError || !normalStyle) {
    console.error('Error finding normal style:', styleError);
    return;
  }
  
  console.log(`✅ Found normal style: ${normalStyle.id}\n`);
  console.log(`Assigning style to all enemies...\n`);
  
  // Get all enemies
  const { data: enemies } = await supabase.from('enemytypes').select('id, name');
  
  let successCount = 0;
  let skipCount = 0;
  
  for (const enemy of enemies || []) {
    // Check if already assigned
    const { data: existing } = await supabase
      .from('enemytypestyles')
      .select('id')
      .eq('enemy_type_id', enemy.id)
      .maybeSingle();
    
    if (existing) {
      skipCount++;
      continue;
    }
    
    // Assign the style
    const { error } = await supabase.from('enemytypestyles').insert({
      enemy_type_id: enemy.id,
      style_id: normalStyle.id,
      weight_multiplier: 1.0
    });
    
    if (error) {
      console.error(`❌ Error assigning to ${enemy.name}:`, error);
    } else {
      console.log(`✅ Assigned style to ${enemy.name}`);
      successCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Successfully assigned: ${successCount}`);
  console.log(`⏭️  Already had styles: ${skipCount}`);
  console.log('='.repeat(60));
}

main();
