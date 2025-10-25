import { EnemyLootEntry } from './types.js';
import { EnemyRepository } from '../../repositories/EnemyRepository.js';
import { ItemTypeRepository } from '../../repositories/ItemTypeRepository.js';
import { MaterialRepository } from '../../repositories/MaterialRepository.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { locationService } from '../LocationService.js';
import { getMaterialImageUrl } from '../../utils/image-url.js';

export async function generateLoot(
  enemyRepository: EnemyRepository,
  itemTypeRepository: ItemTypeRepository,
  materialRepository: MaterialRepository,
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
    style_name: string;
    image_url: string;
  }>;
  items: Array<{
    item_type_id: string;
    name: string;
    category: string;
    rarity: string;
    style_id: string;
    style_name: string;
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
  );
  const itemLootEntries: EnemyLootEntry[] = enemyLootEntries.filter(
    entry => entry.lootable_type === 'item_type' && 'item_type_id' in entry && entry.item_type_id
  );

  const selectedMaterialLoots = selectRandomLoot(materialLootEntries, selectedEnemyStyleId);
  const selectedItemLoots = itemLootEntries.length > 0
    ? selectRandomLoot(itemLootEntries, selectedEnemyStyleId).slice(0, 1)
    : [];

  const materialDetails = await Promise.all(selectedMaterialLoots.map(async (mat) => {
    if (!mat.material_id) {
      throw new ValidationError('Missing material_id');
    }
    const material = await materialRepository.findMaterialById(mat.material_id);
    if (!material) {
      throw new NotFoundError('Material', mat.material_id);
    }

    if (!mat.style_id) {
      throw new ValidationError('Missing style_id for material');
    }
    const styleName = await locationService.getStyleName(mat.style_id);
    if (!styleName) {
      throw new NotFoundError('Style name', mat.style_id);
    }

    return {
      material_id: mat.material_id,
      name: material.name,
      style_id: mat.style_id,
      style_name: styleName,
      image_url: getMaterialImageUrl(material.name)
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

    if (!item.style_id) {
      throw new ValidationError('Missing style_id for item');
    }
    const styleName = await locationService.getStyleName(item.style_id);
    if (!styleName) {
      throw new NotFoundError('Style name', item.style_id);
    }

    return {
      item_type_id: item.item_type_id,
      name: itemType.name,
      category: itemType.category,
      rarity: itemType.rarity,
      style_id: item.style_id,
      style_name: styleName
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
          style_id: inheritedStyleId !== 'normal' ? inheritedStyleId : (entry.style_id ? entry.style_id : 'normal')
        });
        break;
      }
    }
  }

  return selectedLoots;
}
