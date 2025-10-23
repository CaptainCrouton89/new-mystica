#!/usr/bin/env tsx

/**
 * Seed User Data Script
 *
 * Populates a test user with comprehensive game data including:
 * - User creation/retrieval with device ID "test-device-001"
 * - 5 PlayerItems with various types and levels
 * - MaterialStacks for iron, copper, crystal
 * - Default loadout with all 8 equipment slots filled
 * - Data verification and logging
 *
 * Usage: cd mystica-express && npx tsx scripts/seed-user-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('  SUPABASE_URL:', !!SUPABASE_URL);
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_ROLE_KEY);
  process.exit(1);
}

// Supabase client with service role for direct access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TEST_DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';

// Test data configuration
const ITEM_CONFIGS = [
  { category: 'weapon', level: 5, name: 'Sword' },
  { category: 'offhand', level: 3, name: 'Shield' },
  { category: 'head', level: 2, name: 'Helmet' },
  { category: 'armor', level: 4, name: 'Chestplate' },
  { category: 'feet', level: 1, name: 'Boots' }
];

const MATERIAL_CONFIGS = [
  { name: 'Coffee', quantity: 25 },
  { name: 'Diamond', quantity: 15 },
  { name: 'Sparkles', quantity: 8 }
];

interface User {
  id: string;
  device_id: string | null;
  account_type: string;
  vanity_level: number;
  avg_item_level: number | null;
  created_at: string;
}

interface ItemType {
  id: string;
  name: string;
  category: string;
  base_stats_normalized: any;
  rarity: string;
}

interface Material {
  id: string;
  name: string;
  stat_modifiers: any;
}

interface CreatedItem {
  id: string;
  user_id: string;
  item_type_id: string;
  level: number;
  item_type: ItemType;
}

async function findOrCreateTestUser(): Promise<User> {
  console.log('🔍 Finding or creating test user...');

  // First, try to find existing user with device ID
  const { data: existingUser, error: findError } = await supabase
    .from('users')
    .select('*')
    .eq('device_id', TEST_DEVICE_ID)
    .single();

  if (existingUser && !findError) {
    console.log('✅ Found existing test user:', existingUser.id);
    return existingUser;
  }

  // Create new anonymous user
  console.log('👤 Creating new test user...');
  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert({
      id: crypto.randomUUID(),
      device_id: TEST_DEVICE_ID,
      account_type: 'anonymous',
      is_anonymous: true,
      vanity_level: 0,
      avg_item_level: null
    })
    .select()
    .single();

  if (createError) {
    throw new Error(`Failed to create test user: ${createError.message}`);
  }

  console.log('✅ Created new test user:', newUser.id);
  return newUser;
}

async function getItemTypesByCategory(): Promise<Record<string, ItemType>> {
  console.log('📋 Fetching item types...');

  const { data: itemTypes, error } = await supabase
    .from('itemtypes')
    .select('*');

  if (error) {
    throw new Error(`Failed to fetch item types: ${error.message}`);
  }

  const itemTypeMap: Record<string, ItemType> = {};
  for (const itemType of itemTypes) {
    if (!itemTypeMap[itemType.category]) {
      itemTypeMap[itemType.category] = itemType;
    }
  }

  console.log('✅ Found item types for categories:', Object.keys(itemTypeMap));
  return itemTypeMap;
}

async function getMaterialsByName(): Promise<Record<string, Material>> {
  console.log('💎 Fetching materials...');

  const { data: materials, error } = await supabase
    .from('materials')
    .select('*');

  if (error) {
    throw new Error(`Failed to fetch materials: ${error.message}`);
  }

  const materialMap: Record<string, Material> = {};
  for (const material of materials) {
    materialMap[material.name] = material;
  }

  console.log('✅ Found materials:', Object.keys(materialMap));
  return materialMap;
}

async function createPlayerItems(userId: string, itemTypeMap: Record<string, ItemType>): Promise<CreatedItem[]> {
  console.log('⚔️ Creating player items...');

  // Check existing items first
  const { data: existingItems } = await supabase
    .from('items')
    .select(`
      *,
      itemtypes:item_type_id (*)
    `)
    .eq('user_id', userId);

  const existingCategories = new Set(
    existingItems?.map(item => item.itemtypes.category) || []
  );

  const itemsToCreate = [];
  for (const config of ITEM_CONFIGS) {
    const itemType = itemTypeMap[config.category];
    if (!itemType) {
      console.warn(`⚠️ No item type found for category: ${config.category}`);
      continue;
    }

    // Only create if we don't already have an item of this category
    if (!existingCategories.has(config.category)) {
      itemsToCreate.push({
        user_id: userId,
        item_type_id: itemType.id,
        level: config.level,
        is_styled: false,
        current_stats: itemType.base_stats_normalized
      });
    }
  }

  if (itemsToCreate.length === 0) {
    console.log('✅ All item types already exist for user');
    return existingItems?.map(item => ({
      ...item,
      item_type: item.itemtypes
    })) || [];
  }

  const { data: createdItems, error } = await supabase
    .from('items')
    .insert(itemsToCreate)
    .select(`
      *,
      itemtypes:item_type_id (*)
    `);

  if (error) {
    throw new Error(`Failed to create items: ${error.message}`);
  }

  console.log(`✅ Created ${createdItems.length} new items`);

  // Return all items (existing + newly created)
  const allItems = [...(existingItems || []), ...createdItems];
  return allItems.map(item => ({
    ...item,
    item_type: item.itemtypes
  }));
}

async function createMaterialStacks(userId: string, materialMap: Record<string, Material>): Promise<void> {
  console.log('💎 Creating material stacks...');

  // Get the normal style ID
  const { data: normalStyle, error: styleError } = await supabase
    .from('styledefinitions')
    .select('id')
    .eq('style_name', 'normal')
    .single();

  if (styleError) {
    throw new Error(`Failed to find normal style: ${styleError.message}`);
  }

  const stacksToCreate = [];
  for (const config of MATERIAL_CONFIGS) {
    const material = materialMap[config.name];
    if (!material) {
      console.warn(`⚠️ No material found for name: ${config.name}`);
      continue;
    }

    stacksToCreate.push({
      user_id: userId,
      material_id: material.id,
      style_id: normalStyle.id,
      quantity: config.quantity
    });
  }

  const { error } = await supabase
    .from('materialstacks')
    .upsert(stacksToCreate, {
      onConflict: 'user_id,material_id,style_id'
    });

  if (error) {
    throw new Error(`Failed to create material stacks: ${error.message}`);
  }

  console.log(`✅ Created ${stacksToCreate.length} material stacks`);
}

async function createDefaultLoadout(userId: string): Promise<string> {
  console.log('📋 Creating default loadout...');

  // Check if loadout already exists
  const { data: existingLoadout, error: findError } = await supabase
    .from('loadouts')
    .select('*')
    .eq('user_id', userId)
    .eq('name', 'Default Loadout')
    .single();

  if (existingLoadout && !findError) {
    console.log('✅ Found existing loadout:', existingLoadout.id);
    return existingLoadout.id;
  }

  const { data: loadout, error } = await supabase
    .from('loadouts')
    .insert({
      user_id: userId,
      name: 'Default Loadout',
      is_active: true
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create loadout: ${error.message}`);
  }

  console.log('✅ Created default loadout:', loadout.id);
  return loadout.id;
}

async function equipItemsToSlots(userId: string, items: CreatedItem[]): Promise<void> {
  console.log('🛡️ Equipping items to slots...');

  // Equipment slot mapping
  const slotMapping = {
    'weapon': 'weapon',
    'offhand': 'offhand',
    'head': 'head',
    'armor': 'armor',
    'feet': 'feet'
  };

  // First, ensure all 8 equipment slots exist for the user
  const allSlots = ['weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'];

  const slotsToCreate = allSlots.map(slot => ({
    user_id: userId,
    slot_name: slot,
    item_id: null,
    equipped_at: null
  }));

  // Insert or ignore (in case some slots already exist)
  const { error: slotsError } = await supabase
    .from('userequipment')
    .upsert(slotsToCreate, {
      onConflict: 'user_id,slot_name',
      ignoreDuplicates: true
    });

  if (slotsError) {
    throw new Error(`Failed to create equipment slots: ${slotsError.message}`);
  }

  // Equip items to their appropriate slots
  const equipUpdates = [];
  for (const item of items) {
    const slotName = slotMapping[item.item_type.category];
    if (slotName) {
      equipUpdates.push({
        user_id: userId,
        slot_name: slotName,
        item_id: item.id,
        equipped_at: new Date().toISOString()
      });
    }
  }

  for (const update of equipUpdates) {
    const { error } = await supabase
      .from('userequipment')
      .update({
        item_id: update.item_id,
        equipped_at: update.equipped_at
      })
      .eq('user_id', update.user_id)
      .eq('slot_name', update.slot_name);

    if (error) {
      throw new Error(`Failed to equip item to ${update.slot_name}: ${error.message}`);
    }
  }

  console.log(`✅ Equipped ${equipUpdates.length} items to slots`);
}

async function verifySeededData(userId: string): Promise<void> {
  console.log('🔍 Verifying seeded data...');

  // Check user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (userError) {
    throw new Error(`Failed to verify user: ${userError.message}`);
  }

  console.log('👤 User:', {
    id: user.id,
    device_id: user.device_id,
    account_type: user.account_type,
    vanity_level: user.vanity_level
  });

  // Check items
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select(`
      *,
      itemtypes:item_type_id (name, category)
    `)
    .eq('user_id', userId);

  if (itemsError) {
    throw new Error(`Failed to verify items: ${itemsError.message}`);
  }

  console.log('⚔️ Items:', items.map(item => ({
    type: item.itemtypes.name,
    category: item.itemtypes.category,
    level: item.level
  })));

  // Check material stacks
  const { data: stacks, error: stacksError } = await supabase
    .from('materialstacks')
    .select(`
      *,
      materials:material_id (name)
    `)
    .eq('user_id', userId);

  if (stacksError) {
    throw new Error(`Failed to verify material stacks: ${stacksError.message}`);
  }

  console.log('💎 Material Stacks:', stacks.map(stack => ({
    material: stack.materials.name,
    quantity: stack.quantity
  })));

  // Check loadout
  const { data: loadouts, error: loadoutError } = await supabase
    .from('loadouts')
    .select('*')
    .eq('user_id', userId);

  if (loadoutError) {
    throw new Error(`Failed to verify loadouts: ${loadoutError.message}`);
  }

  console.log('📋 Loadouts:', loadouts.map(loadout => ({
    name: loadout.name,
    is_active: loadout.is_active
  })));

  // Check equipment
  const { data: equipment, error: equipError } = await supabase
    .from('userequipment')
    .select(`
      *,
      items:item_id (
        level,
        itemtypes:item_type_id (name, category)
      )
    `)
    .eq('user_id', userId)
    .not('item_id', 'is', null);

  if (equipError) {
    throw new Error(`Failed to verify equipment: ${equipError.message}`);
  }

  console.log('🛡️ Equipped Items:', equipment.map(eq => ({
    slot: eq.slot_name,
    item: eq.items?.itemtypes?.name,
    level: eq.items?.level
  })));

  console.log('\n✅ Data verification complete!');
}

async function main(): Promise<void> {
  try {
    console.log('🚀 Starting user data seeding process...\n');

    // Step 1: Find or create test user
    const user = await findOrCreateTestUser();

    // Step 2: Get available item types and materials
    const [itemTypeMap, materialMap] = await Promise.all([
      getItemTypesByCategory(),
      getMaterialsByName()
    ]);

    // Step 3: Create player items
    const createdItems = await createPlayerItems(user.id, itemTypeMap);

    // Step 4: Create material stacks
    await createMaterialStacks(user.id, materialMap);

    // Step 5: Create default loadout
    await createDefaultLoadout(user.id);

    // Step 6: Equip items to slots
    await equipItemsToSlots(user.id, createdItems);

    // Step 7: Verify all data
    await verifySeededData(user.id);

    console.log('\n🎉 Seeding completed successfully!');
    console.log(`📱 Test user device ID: ${TEST_DEVICE_ID}`);
    console.log(`👤 Test user ID: ${user.id}`);

  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { main as seedUserData };