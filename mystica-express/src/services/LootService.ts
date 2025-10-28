/**
 * LOOT SERVICE
 *
 * Handles instant loot collection from locations without combat sessions.
 * Simplified flow: select enemy → generate loot → apply rewards → return results.
 */

import { EnemyRepository } from '../repositories/EnemyRepository.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { ItemTypeRepository } from '../repositories/ItemTypeRepository.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { ProfileRepository } from '../repositories/ProfileRepository.js';
import { RarityRepository } from '../repositories/RarityRepository.js';
import { StyleRepository } from '../repositories/StyleRepository.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { locationService } from './LocationService.js';

import { generateLoot } from './combat/loot.js';
import { applyRewards } from './combat/rewards.js';
import { selectEnemy } from './combat/session.js';
import { CombatRewards } from './combat/types.js';

let enemyRepository = new EnemyRepository();
let itemRepository = new ItemRepository();
let itemTypeRepository = new ItemTypeRepository();
let materialRepository = new MaterialRepository();
let profileRepository = new ProfileRepository();
let rarityRepository = new RarityRepository();
let styleRepository = new StyleRepository();

export class LootService {
  private enemyRepository: EnemyRepository;
  private itemRepository: ItemRepository;
  private itemTypeRepository: ItemTypeRepository;
  private materialRepository: MaterialRepository;
  private profileRepository: ProfileRepository;
  private rarityRepository: RarityRepository;
  private styleRepository: StyleRepository;

  constructor(
    enemyRepo?: EnemyRepository,
    itemRepo?: ItemRepository,
    itemTypeRepo?: ItemTypeRepository,
    materialRepo?: MaterialRepository,
    profileRepo?: ProfileRepository,
    rarityRepo?: RarityRepository,
    styleRepo?: StyleRepository
  ) {
    this.enemyRepository = enemyRepo || enemyRepository;
    this.itemRepository = itemRepo || itemRepository;
    this.itemTypeRepository = itemTypeRepo || itemTypeRepository;
    this.materialRepository = materialRepo || materialRepository;
    this.profileRepository = profileRepo || profileRepository;
    this.rarityRepository = rarityRepo || rarityRepository;
    this.styleRepository = styleRepo || styleRepository;
  }

  /**
   * Collect instant loot from a location without combat
   * 
   * Flow:
   * 1. Validate location exists
   * 2. Select random enemy at level 1
   * 3. Generate loot based on enemy
   * 4. Apply rewards to user inventory
   * 5. Return rewards with minimal combat_history (all zeros)
   * 
   * @param userId - User collecting loot
   * @param locationId - Location to collect loot from
   * @returns CombatRewards with applied loot
   */
  async collectInstantLoot(userId: string, locationId: string): Promise<CombatRewards> {
    logger.info('💰 Collecting instant loot', { userId, locationId });

    // Validate location exists
    const location = await locationService.getById(locationId);
    if (!location) {
      throw new NotFoundError('Location', locationId);
    }

    // Fixed level 1 for instant loot
    const combatLevel = 1;

    // Select random enemy at this location
    const enemy = await selectEnemy(this.enemyRepository, locationId, combatLevel);
    
    logger.debug('Selected enemy for loot', {
      enemyTypeId: enemy.id,
      enemyStyleId: enemy.style_id,
      locationId
    });

    // Generate loot based on enemy
    const baseRewards = await generateLoot(
      this.enemyRepository,
      this.itemTypeRepository,
      this.materialRepository,
      this.rarityRepository,
      this.styleRepository,
      locationId,
      combatLevel,
      enemy.id,
      enemy.style_id
    );

    logger.info('🎁 Loot generated', {
      userId,
      locationId,
      goldAmount: baseRewards.currencies.gold,
      materialsCount: baseRewards.materials.length,
      itemsCount: baseRewards.items.length,
      experience: baseRewards.experience
    });

    // Create rewards structure (include minimal combat_history for compatibility)
    const rewards: CombatRewards = {
      result: 'victory',
      currencies: baseRewards.currencies,
      materials: baseRewards.materials,
      items: [], // Will be populated after applyRewards
      experience: baseRewards.experience,
      combat_history: {
        location_id: locationId,
        total_attempts: 0,
        victories: 0,
        defeats: 0,
        current_streak: 0,
        longest_streak: 0
      }
    };

    // Generate unique operation ID for tracking
    const lootOperationId = crypto.randomUUID();

    // Apply rewards with items from baseRewards
    const rewardsForApplication = {
      ...rewards,
      items: baseRewards.items as CombatRewards['items']
    };

    const appliedResult = await applyRewards(
      this.itemRepository,
      this.materialRepository,
      this.profileRepository,
      userId,
      lootOperationId,
      rewardsForApplication,
      combatLevel
    );

    // Merge created items back into final rewards
    const finalRewards: CombatRewards = {
      ...rewards,
      items: appliedResult.createdItems,
      combat_history: rewards.combat_history
    };

    logger.info('✅ Instant loot collected successfully', {
      userId,
      locationId,
      lootOperationId,
      createdItemCount: appliedResult.createdItems.length
    });

    return finalRewards;
  }
}

export const lootService = new LootService();

