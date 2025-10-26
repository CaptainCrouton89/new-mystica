import { EnemyRepository } from '../../repositories/EnemyRepository.js';
import { ItemTypeRepository } from '../../repositories/ItemTypeRepository.js';
import { MaterialRepository } from '../../repositories/MaterialRepository.js';
import { RarityRepository } from '../../repositories/RarityRepository.js';
import { StyleRepository } from '../../repositories/StyleRepository.js';
import type { Database } from '../../types/database.types.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { getMaterialImageUrl } from '../../utils/image-url.js';
import { EnemyLootEntry } from './types.js';

type RarityDefinition = Database['public']['Tables']['raritydefinitions']['Row'];
type RarityEnum = Database['public']['Enums']['rarity'];

export async function generateLoot(
  enemyRepository: EnemyRepository,
  itemTypeRepository: ItemTypeRepository,
  materialRepository: MaterialRepository,
  rarityRepository: RarityRepository,
  styleRepository: StyleRepository,
  locationId: string,
  combatLevel: number,
  enemyTypeId: string,
  selectedEnemyStyleId: string
): Promise<{
  currencies: { gold: number };
  materials: Array<{
    material_id: string;
    name: string;
    style_id: string;
    display_name: string;
    image_url: string;
  }>;
  items: Array<{
    item_type_id: string;
    name: string;
    category: string;
    rarity: RarityEnum;
    style_id: string;
    display_name: string;
  }>;
  experience: number;
}> {
  if (combatLevel < 1) {
    throw new ValidationError('Combat level must be positive');
  }

  const enemyWithTier = await enemyRepository.getEnemyTypeWithTier(enemyTypeId);
  if (!enemyWithTier?.enemyType || !enemyWithTier.tier) {
    throw new NotFoundError('Enemy type or tier', enemyTypeId);
  }

  const enemyTier = enemyWithTier.tier;

  const enemyLootEntries = await enemyRepository.getEnemyLootTable(enemyTypeId);
  if (enemyLootEntries.length === 0) {
    throw new ValidationError('No loot entries found for enemy type');
  }

  const materialLootEntries: EnemyLootEntry[] = enemyLootEntries.filter(
    entry => entry.lootable_type === 'material' && 'material_id' in entry && entry.material_id
  ) as EnemyLootEntry[];
  const itemLootEntries: EnemyLootEntry[] = enemyLootEntries.filter(
    entry => entry.lootable_type === 'item_type' && 'item_type_id' in entry && entry.item_type_id
  ) as EnemyLootEntry[];

  const selectedMaterialLoots = selectRandomLoot(materialLootEntries, selectedEnemyStyleId);
  const selectedItemLoots = itemLootEntries.length > 0
    ? selectRandomLoot(itemLootEntries, selectedEnemyStyleId).slice(0, 1)
    : [];

  // Fetch enemy style display name
  const enemyStyle = await styleRepository.findById(selectedEnemyStyleId);
  if (!enemyStyle) {
    throw new NotFoundError('Style', selectedEnemyStyleId);
  }

  const materialDetails = await Promise.all(selectedMaterialLoots.map(async (mat) => {
    if (!mat.material_id) {
      throw new ValidationError('Missing material_id');
    }
    const material = await materialRepository.findMaterialById(mat.material_id);
    if (!material) {
      throw new NotFoundError('Material', mat.material_id);
    }

    // Use material's own style if it has one, otherwise use enemy's style
    let styleId = selectedEnemyStyleId;
    let displayName = enemyStyle.display_name;

    if (material.style_id) {
      const materialStyle = await styleRepository.findById(material.style_id);
      if (materialStyle) {
        styleId = material.style_id;
        displayName = materialStyle.display_name;
      }
    }

    return {
      material_id: mat.material_id,
      name: material.name,
      style_id: styleId,
      display_name: displayName,
      image_url: material.image_url || getMaterialImageUrl(material.name)
    };
  }));

  const itemDetails = await Promise.all(selectedItemLoots.map(async (item) => {
    if (!item.item_type_id) {
      throw new ValidationError('Missing item_type_id');
    }
    const itemType = await itemTypeRepository.findById(item.item_type_id);
    if (!itemType) {
      throw new NotFoundError('ItemType', item.item_type_id);
    }

    // Select rarity based on combat level and drop rates
    const selectedRarity = await selectRarity(rarityRepository, combatLevel);

    return {
      item_type_id: item.item_type_id,
      name: itemType.name,
      category: itemType.category,
      rarity: selectedRarity,
      style_id: selectedEnemyStyleId,
      display_name: enemyStyle.display_name,
    };
  }));

  if (typeof enemyTier.gold_multiplier !== 'number' || enemyTier.gold_multiplier <= 0) {
    throw new ValidationError('Invalid gold multiplier');
  }
  if (typeof enemyTier.xp_multiplier !== 'number' || enemyTier.xp_multiplier <= 0) {
    throw new ValidationError('Invalid XP multiplier');
  }

  return {
    currencies: {
      gold: Math.floor(10 * combatLevel * enemyTier.gold_multiplier)
    },
    materials: materialDetails,
    items: itemDetails,
    experience: Math.floor(20 * combatLevel * enemyTier.xp_multiplier)
  };
}

export function selectRandomLoot(lootEntries: EnemyLootEntry[], inheritedStyleId: string): EnemyLootEntry[] {
  if (lootEntries.length === 0) {
    throw new ValidationError('No loot entries available');
  }

  if (lootEntries.some(entry => entry.drop_weight <= 0)) {
    throw new ValidationError('Invalid drop weight');
  }

  const totalWeight = lootEntries.reduce((sum, entry) => sum + entry.drop_weight, 0);
  const dropCount = Math.floor(Math.random() * 3) + 1;

  const selectedLoots: EnemyLootEntry[] = [];
  for (let i = 0; i < dropCount; i++) {
    const randomVal = Math.random() * totalWeight;
    let cumulativeWeight = 0;

    for (const entry of lootEntries) {
      cumulativeWeight += entry.drop_weight;
      if (randomVal <= cumulativeWeight) {
        selectedLoots.push({
          ...entry,
        });
        break;
      }
    }
  }

  return selectedLoots;
}

/**
 * Select a rarity for dropped items using weighted random selection
 *
 * Uses base_drop_rate from rarity definitions and scales by combat level.
 * Higher combat levels have better chances for higher rarities.
 *
 * Algorithm:
 * 1. Get all rarity definitions with their base_drop_rates
 * 2. Weight each rarity: base_drop_rate * (1 + combatLevel * 0.05)
 * 3. Use cumulative weight selection to choose one
 *
 * @param rarityRepository - Repository instance for rarity lookups
 * @param combatLevel - Current combat level (affects rarity scaling)
 * @returns Selected rarity enum value
 * @throws ValidationError if no rarities found
 */
export async function selectRarity(
  rarityRepository: RarityRepository,
  combatLevel: number
): Promise<RarityEnum> {
  const rarities = await rarityRepository.getAllRarities();

  if (rarities.length === 0) {
    throw new ValidationError('No rarity definitions found');
  }

  // Scale drop rates by combat level
  // Higher levels increase chance of rare drops
  const combatMultiplier = 1 + (combatLevel * 0.05);

  // Calculate weighted values for each rarity
  const weightedRarities = rarities.map(rarity => ({
    rarity: rarity.rarity as RarityEnum,
    weight: rarity.base_drop_rate * combatMultiplier
  }));

  // Calculate total weight
  const totalWeight = weightedRarities.reduce((sum, r) => sum + r.weight, 0);

  if (totalWeight <= 0) {
    throw new ValidationError('Invalid rarity weights: total weight must be positive');
  }

  // Select using cumulative weight
  const randomVal = Math.random() * totalWeight;
  let cumulativeWeight = 0;

  for (const { rarity, weight } of weightedRarities) {
    cumulativeWeight += weight;
    if (randomVal <= cumulativeWeight) {
      return rarity;
    }
  }

  // Should never reach here - indicates algorithm error
  throw new ValidationError(
    `Failed to select rarity: randomVal=${randomVal}, totalWeight=${totalWeight}, cumulativeWeight=${cumulativeWeight}`
  );
}
