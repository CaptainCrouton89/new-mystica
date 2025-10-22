/**
 * Seed Data Loaders for Tests
 *
 * Utilities to load real game configuration from docs/ JSON files.
 * Provides access to actual items, materials, monsters, and equipment
 * slots for validation against real game data.
 */

import fs from 'fs/promises';
import path from 'path';
import type { ItemType, Material, EquipmentSlot, Rarity } from '../../src/types/api.types.js';

// ============================================================================
// Seed Data Interfaces (matches docs/ JSON structure)
// ============================================================================

interface SeedItemType {
  id: string;
  name: string;
  slot: 'weapon' | 'offhand' | 'head' | 'armor' | 'feet' | 'accessory' | 'pet';
  base_stats: {
    atkPower: number;
    atkAccuracy: number;
    defPower: number;
    defAccuracy: number;
  };
  description: string;
  rarity: Rarity;
}

interface SeedMaterial {
  id: string;
  name: string;
  description: string;
  stat_modifiers: {
    atkPower: number;
    atkAccuracy: number;
    defPower: number;
    defAccuracy: number;
  };
  rarity: Rarity;
}

interface SeedMonster {
  id: string;
  name: string;
  min_combat_level: number;
  base_stats: {
    atkPower: number;
    atkAccuracy: number;
    defPower: number;
    defAccuracy: number;
  };
  personality_traits: string[];
  dialogue_tone: string;
  description: string;
}

interface SeedEquipmentSlot {
  slot_name: EquipmentSlot;
  display_name: string;
  sort_order: number;
  description: string;
}

// ============================================================================
// Data Transformation Helpers
// ============================================================================

/**
 * Convert seed item to ItemType (API format)
 */
function transformSeedItem(seed: SeedItemType): ItemType {
  // Map simplified seed slot names to full equipment slot names
  let equipmentSlot: EquipmentSlot;
  let category: 'weapon' | 'offhand' | 'head' | 'armor' | 'feet' | 'accessory' | 'pet';

  switch (seed.slot) {
    case 'weapon':
      equipmentSlot = 'weapon';
      category = 'weapon';
      break;
    case 'offhand':
      equipmentSlot = 'offhand'; // offhand maps to offhand in equipment system
      category = 'offhand';
      break;
    case 'head':
      equipmentSlot = 'head';
      category = 'head';
      break;
    case 'armor':
      equipmentSlot = 'armor';
      category = 'armor';
      break;
    case 'feet':
      equipmentSlot = 'feet';
      category = 'feet';
      break;
    case 'accessory':
      equipmentSlot = 'accessory_1'; // default accessories to slot 1
      category = 'accessory';
      break;
    case 'pet':
      equipmentSlot = 'pet';
      category = 'pet';
      break;
    default:
      equipmentSlot = seed.slot;
      category = seed.slot;
  }

  return {
    id: seed.id,
    name: seed.name,
    category,
    equipment_slot: equipmentSlot,
    base_stats: seed.base_stats,
    rarity: seed.rarity,
    description: seed.description
  };
}

/**
 * Convert seed material to Material (API format)
 */
function transformSeedMaterial(seed: SeedMaterial): Material {
  return {
    id: seed.id,
    name: seed.name,
    stat_modifiers: seed.stat_modifiers,
    base_drop_weight: 1, // Default weight for seed materials
    description: seed.description
  };
}

// ============================================================================
// Core Loader Functions
// ============================================================================

/**
 * Load item types from seed data
 */
export async function loadSeededItems(): Promise<ItemType[]> {
  try {
    const filePath = path.join(__dirname, '../../..', 'docs', 'seed-data-items.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as { items: SeedItemType[] };

    return data.items.map(transformSeedItem);
  } catch (error) {
    throw new Error(`Failed to load seed items: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load materials from seed data
 */
export async function loadSeededMaterials(): Promise<Material[]> {
  try {
    const filePath = path.join(__dirname, '../../..', 'docs', 'seed-data-materials.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as { materials: SeedMaterial[] };

    return data.materials.map(transformSeedMaterial);
  } catch (error) {
    throw new Error(`Failed to load seed materials: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load monster/enemy types from seed data
 */
export async function loadSeededMonsters(): Promise<SeedMonster[]> {
  try {
    const filePath = path.join(__dirname, '../../..', 'docs', 'seed-data-monsters.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as { monsters: SeedMonster[] };

    return data.monsters;
  } catch (error) {
    throw new Error(`Failed to load seed monsters: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load equipment slots from seed data
 */
export async function loadSeededEquipmentSlots(): Promise<SeedEquipmentSlot[]> {
  try {
    const filePath = path.join(__dirname, '../../..', 'docs', 'seed-data-equipment-slots.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as { slots: SeedEquipmentSlot[] };

    return data.slots;
  } catch (error) {
    throw new Error(`Failed to load seed equipment slots: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Lookup Functions
// ============================================================================

/**
 * Get specific item by type
 */
export async function getItemByType(type: string): Promise<ItemType | null> {
  const items = await loadSeededItems();
  return items.find(i => i.id === type) || null;
}

/**
 * Get specific material by ID
 */
export async function getMaterialById(id: string): Promise<Material | null> {
  const materials = await loadSeededMaterials();
  return materials.find(m => m.id === id) || null;
}

/**
 * Get materials by rarity level
 * Note: Materials don't have rarity in the database schema, returning empty array
 */
export async function getMaterialsByRarity(rarity: Rarity): Promise<Material[]> {
  // Materials don't have rarity property in the actual database schema
  return [];
}

/**
 * Get enemy type by ID
 */
export async function getEnemyById(id: string): Promise<SeedMonster | null> {
  const monsters = await loadSeededMonsters();
  return monsters.find(m => m.id === id) || null;
}

/**
 * Get equipment slot definition by name
 */
export async function getEquipmentSlotByName(slotName: EquipmentSlot): Promise<SeedEquipmentSlot | null> {
  const slots = await loadSeededEquipmentSlots();
  return slots.find(s => s.slot_name === slotName) || null;
}

// ============================================================================
// Filtering and Search Functions
// ============================================================================

/**
 * Get items by equipment slot
 */
export async function getItemsBySlot(slot: EquipmentSlot): Promise<ItemType[]> {
  const items = await loadSeededItems();
  return items.filter(i => i.equipment_slot === slot);
}

/**
 * Get items by rarity
 */
export async function getItemsByRarity(rarity: Rarity): Promise<ItemType[]> {
  const items = await loadSeededItems();
  return items.filter(i => i.rarity === rarity);
}

/**
 * Get monsters by minimum combat level
 */
export async function getMonstersByMinLevel(minLevel: number): Promise<SeedMonster[]> {
  const monsters = await loadSeededMonsters();
  return monsters.filter(m => m.min_combat_level >= minLevel);
}

/**
 * Get random material for testing
 */
export async function getRandomMaterial(): Promise<Material> {
  const materials = await loadSeededMaterials();
  const randomIndex = Math.floor(Math.random() * materials.length);
  return materials[randomIndex];
}

/**
 * Get random item for testing
 */
export async function getRandomItem(): Promise<ItemType> {
  const items = await loadSeededItems();
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex];
}

/**
 * Get multiple random materials (without duplicates)
 */
export async function getRandomMaterials(count: number): Promise<Material[]> {
  const materials = await loadSeededMaterials();
  const shuffled = [...materials].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, materials.length));
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that all item base stats sum to 1.0
 */
export async function validateItemStatNormalization(): Promise<{ valid: boolean; errors: string[] }> {
  const items = await loadSeededItems();
  const errors: string[] = [];

  for (const item of items) {
    const sum = item.base_stats.atkPower + item.base_stats.atkAccuracy +
                item.base_stats.defPower + item.base_stats.defAccuracy;

    if (Math.abs(sum - 1.0) > 0.001) {
      errors.push(`Item ${item.id} stats sum to ${sum.toFixed(3)}, expected 1.0`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate that all material modifiers sum to 0.0
 */
export async function validateMaterialModifierBalance(): Promise<{ valid: boolean; errors: string[] }> {
  const materials = await loadSeededMaterials();
  const errors: string[] = [];

  for (const material of materials) {
    const sum = material.stat_modifiers.atkPower + material.stat_modifiers.atkAccuracy +
                material.stat_modifiers.defPower + material.stat_modifiers.defAccuracy;

    if (Math.abs(sum) > 0.001) {
      errors.push(`Material ${material.id} modifiers sum to ${sum.toFixed(3)}, expected 0.0`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get count of items per equipment slot
 */
export async function getItemSlotDistribution(): Promise<Record<EquipmentSlot, number>> {
  const items = await loadSeededItems();
  const distribution: Record<string, number> = {};

  for (const item of items) {
    distribution[item.equipment_slot] = (distribution[item.equipment_slot] || 0) + 1;
  }

  return distribution as Record<EquipmentSlot, number>;
}

/**
 * Get count of items per rarity
 */
export async function getItemRarityDistribution(): Promise<Record<Rarity, number>> {
  const items = await loadSeededItems();
  const distribution: Record<string, number> = {};

  for (const item of items) {
    distribution[item.rarity] = (distribution[item.rarity] || 0) + 1;
  }

  return distribution as Record<Rarity, number>;
}