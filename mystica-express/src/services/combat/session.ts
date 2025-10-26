import { PlayerStats, EnemyStats, WeaponConfig, EquipmentSnapshot } from './types.js';
import { DEFAULT_WEAPON_CONFIG, SESSION_EXPIRY_MS } from './constants.js';
import { calculateEnemyStats, selectRandomStyle } from './calculations.js';
import { EnemyRepository } from '../../repositories/EnemyRepository.js';
import { EquipmentRepository } from '../../repositories/EquipmentRepository.js';
import { WeaponRepository } from '../../repositories/WeaponRepository.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { locationService } from '../LocationService.js';
import { Stats } from '../../types/api.types.js';
import { logger } from '../../utils/logger.js';
import { statsService } from '../StatsService.js';

export async function selectEnemy(
  enemyRepository: EnemyRepository,
  locationId: string,
  combatLevel: number
): Promise<{
  id: string;
  type: string;
  name: string;
  level: number;
  atk_power: number;
  atk_accuracy: number;
  def_power: number;
  def_accuracy: number;
  hp: number;
  style_id: string;
  dialogue_tone: string;
  personality_traits: string[];
}> {

  const poolIds = await locationService.getMatchingEnemyPools(locationId, combatLevel);
  if (!poolIds || poolIds.length === 0) {
    throw new NotFoundError('No enemies available for this location and level');
  }

  const poolMembers = await locationService.getEnemyPoolMembers(poolIds);
  if (!poolMembers || poolMembers.length === 0) {
    throw new NotFoundError('No enemies found in available pools');
  }

  const selectedEnemyTypeId = locationService.selectRandomEnemy(poolMembers);

  const enemyType = await enemyRepository.findEnemyTypeById(selectedEnemyTypeId);
  if (!enemyType) {
    throw new NotFoundError('Enemy type', selectedEnemyTypeId);
  }

  const enemyStyles = await enemyRepository.getStylesForEnemyType(selectedEnemyTypeId);
  const selectedStyleId = selectRandomStyle(enemyStyles.map(style => ({ style_id: style, weight_multiplier: 1 })));

  const enemyStats = await calculateEnemyStats(enemyRepository, selectedEnemyTypeId, selectedStyleId);

  return {
    id: enemyType.id,
    type: enemyType.name,
    name: enemyType.name,
    level: combatLevel,
    atk_power: enemyStats.atk_power,
    atk_accuracy: enemyStats.atk_accuracy,
    def_power: enemyStats.def_power,
    def_accuracy: enemyStats.def_accuracy,
    hp: enemyStats.hp,
    style_id: enemyStats.style_id,
    dialogue_tone: enemyStats.dialogue_tone,
    personality_traits: enemyStats.personality_traits,
  };
}

export async function getWeaponConfig(
  equipmentRepository: EquipmentRepository,
  weaponRepository: WeaponRepository,
  userId: string,
  playerAccuracy: number
): Promise<WeaponConfig> {
  
  const equippedWeapon = await equipmentRepository.findItemInSlot(userId, 'weapon');

  if (!equippedWeapon) {
    
    return DEFAULT_WEAPON_CONFIG;
  }

  const weapon = await weaponRepository.findWeaponByItemId(equippedWeapon.id);
  if (!weapon) {
    throw new NotFoundError('Weapon data', equippedWeapon.id);
  }

  const adjustedBands = await weaponRepository.getAdjustedBands(weapon.item_id, playerAccuracy);

  return {
    pattern: weapon.pattern,
    spin_deg_per_s: weapon.spin_deg_per_s,
    adjusted_bands: adjustedBands,
  };
}

export async function captureEquipmentSnapshot(
  equipmentRepository: EquipmentRepository,
  userId: string
): Promise<EquipmentSnapshot> {

  const totalStats = await equipmentRepository.getPlayerEquippedStats(userId);

  const equippedItems = await equipmentRepository.findEquippedByUser(userId);

  const itemsSnapshot: Record<string, {
    item_id: string;
    item_type_id: string;
    level: number;
    current_stats: Stats;
    applied_materials?: Array<{material_id: string, slot_index: number}>;
  }> = {};

  for (const [slotName, item] of Object.entries(equippedItems)) {
    if (item) {
      // Compute current_stats using StatsService
      const computedStats = statsService.computeItemStatsForLevel(
        {
          rarity: item.rarity,
          item_type: {
            base_stats_normalized: item.item_type.base_stats_normalized
          }
        },
        item.level
      );

      itemsSnapshot[slotName] = {
        item_id: item.id,
        item_type_id: item.item_type.id,
        level: item.level,
        current_stats: computedStats,

      };
    }
  }

  return {
    total_stats: {
      atkPower: totalStats.atkPower,
      atkAccuracy: totalStats.atkAccuracy,
      defPower: totalStats.defPower,
      defAccuracy: totalStats.defAccuracy,
      hp: 100,
    },
    equipped_items: itemsSnapshot,
    snapshot_timestamp: new Date().toISOString(),
  };
}

export async function calculatePlayerStats(
  equipmentRepository: EquipmentRepository,
  userId: string
): Promise<PlayerStats> {
  
  const equippedStats = await equipmentRepository.getPlayerEquippedStats(userId);

  return {
    ...equippedStats,
    hp: 100, 
  };
}

export function calculateSessionExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + SESSION_EXPIRY_MS);
}
