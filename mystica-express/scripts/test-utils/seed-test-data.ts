#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.test for admin credentials
const envTestPath = path.join(__dirname, '.env.test');
if (!fs.existsSync(envTestPath)) {
  console.error('✗ Admin account not found. Run create-admin-account.sh first.');
  process.exit(1);
}

const envTest = fs.readFileSync(envTestPath, 'utf-8');
const envVars: Record<string, string> = {};
envTest.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const ADMIN_USER_ID = envVars.ADMIN_USER_ID;
if (!ADMIN_USER_ID) {
  console.error('✗ ADMIN_USER_ID not found in .env.test');
  process.exit(1);
}

// Load Supabase credentials from .env.local
const envLocalPath = path.join(__dirname, '../../.env.local');
if (!fs.existsSync(envLocalPath)) {
  console.error('✗ .env.local not found');
  process.exit(1);
}

const envLocal = fs.readFileSync(envLocalPath, 'utf-8');
envLocal.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim();
  }
});

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function seedData() {
  console.log('\x1b[33m=== Seeding Test Data ===\x1b[0m');
  console.log(`User ID: ${ADMIN_USER_ID}\n`);

  try {
    // 0. Ensure user exists in users table
    console.log('\x1b[33m[0/5] Ensuring user exists in database...\x1b[0m');
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', ADMIN_USER_ID)
      .single();

    if (!existingUser) {
      const { error: userInsertError } = await supabase
        .from('users')
        .insert({
          id: ADMIN_USER_ID,
          email: envVars.ADMIN_EMAIL || 'thelabcook@protonmail.com',
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
          vanity_level: 0,
          avg_item_level: 0
        });

      if (userInsertError) {
        // If email already exists with different ID, delete old user first
        if (userInsertError.code === '23505') {
          console.log('\x1b[33m⚠ Email conflict detected, cleaning up old user...\x1b[0m');
          await supabase
            .from('users')
            .delete()
            .eq('email', envVars.ADMIN_EMAIL || 'thelabcook@protonmail.com');

          // Try insert again
          const { error: retryError } = await supabase
            .from('users')
            .insert({
              id: ADMIN_USER_ID,
              email: envVars.ADMIN_EMAIL || 'thelabcook@protonmail.com',
              created_at: new Date().toISOString(),
              last_login: new Date().toISOString(),
              vanity_level: 0,
              avg_item_level: 0
            });

          if (retryError) throw retryError;
        } else {
          throw userInsertError;
        }
      }
      console.log('\x1b[32m✓ User created in database\x1b[0m\n');
    } else {
      console.log('\x1b[32m✓ User already exists in database\x1b[0m\n');
    }

    // 1. Set up currency balance
    console.log('\x1b[33m[1/5] Setting up currency balance...\x1b[0m');
    const { error: currencyError } = await supabase
      .from('usercurrencybalances')
      .upsert({
        user_id: ADMIN_USER_ID,
        currency_code: 'GOLD',
        balance: 5000
      }, {
        onConflict: 'user_id,currency_code'
      });

    if (currencyError) throw currencyError;
    console.log('\x1b[32m✓ Currency balance set\x1b[0m\n');

    // 2. Get item types for starter items
    console.log('\x1b[33m[2/5] Creating starter items...\x1b[0m');
    const { data: itemTypes, error: itemTypesError } = await supabase
      .from('itemtypes')
      .select('id, name, base_stats')
      .in('name', ['Basic Sword', 'Wooden Shield', 'Leather Cap', 'Cloth Armor', 'Leather Boots', 'Jade Ring'])
      .limit(6);

    if (itemTypesError) throw itemTypesError;

    // Create items for this user
    if (itemTypes && itemTypes.length > 0) {
      const items = itemTypes.map(it => ({
        user_id: ADMIN_USER_ID,
        item_type_id: it.id,
        level: 1,
        is_styled: false,
        current_stats: {
          atkPower: (it.base_stats as any)?.atkPower * 10 || 10,
          atkAccuracy: (it.base_stats as any)?.atkAccuracy * 10 || 10,
          defPower: (it.base_stats as any)?.defPower * 10 || 10,
          defAccuracy: (it.base_stats as any)?.defAccuracy * 10 || 10
        }
      }));

      const { error: itemsError } = await supabase
        .from('items')
        .insert(items);

      if (itemsError && itemsError.code !== '23505') throw itemsError; // Ignore duplicate errors
    }
    console.log(`\x1b[32m✓ Created ${itemTypes?.length || 0} items\x1b[0m\n`);

    // 3. Give user basic materials
    console.log('\x1b[33m[3/5] Adding material stacks...\x1b[0m');
    const { data: materials, error: materialsError } = await supabase
      .from('materials')
      .select('id')
      .in('id', ['iron', 'wood', 'leather', 'crystal', 'flame']);

    if (materialsError) throw materialsError;

    if (materials && materials.length > 0) {
      const materialStacks = materials.map(m => ({
        user_id: ADMIN_USER_ID,
        material_id: m.id,
        style_id: 'normal',
        quantity: 5
      }));

      const { error: stacksError } = await supabase
        .from('materialstacks')
        .upsert(materialStacks, {
          onConflict: 'user_id,material_id,style_id'
        });

      if (stacksError) throw stacksError;
    }
    console.log(`\x1b[32m✓ Added ${materials?.length || 0} material stacks\x1b[0m\n`);

    // 4. Initialize equipment slots
    console.log('\x1b[33m[4/5] Initializing equipment slots...\x1b[0m');
    const slots = ['weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'];
    const equipmentSlots = slots.map(slot => ({
      user_id: ADMIN_USER_ID,
      slot
    }));

    const { error: slotsError } = await supabase
      .from('userequipment')
      .upsert(equipmentSlots, {
        onConflict: 'user_id,slot',
        ignoreDuplicates: true
      });

    if (slotsError && slotsError.code !== '23505') throw slotsError;
    console.log('\x1b[32m✓ Equipment slots initialized\x1b[0m\n');

    // 5. Update user stats
    console.log('\x1b[33m[5/5] Updating user stats...\x1b[0m');
    const { error: userError } = await supabase
      .from('users')
      .update({
        vanity_level: 0,
        avg_item_level: 1.0
      })
      .eq('id', ADMIN_USER_ID);

    if (userError) throw userError;
    console.log('\x1b[32m✓ User stats updated\x1b[0m\n');

    console.log('\x1b[32m=== Test Data Seeded ===' +'\x1b[0m');
    console.log('Summary:');
    console.log('  - 5000 gold');
    console.log('  - 6 level-1 items');
    console.log('  - 5 stacks of common materials (5 each)');
    console.log('  - 8 equipment slots initialized');
  } catch (error) {
    console.error('\x1b[31m✗ Seeding failed:\x1b[0m', error);
    process.exit(1);
  }
}

seedData();
