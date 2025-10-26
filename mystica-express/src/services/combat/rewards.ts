import { CombatRewards } from './types.js';
import { ItemRepository } from '../../repositories/ItemRepository.js';
import { MaterialRepository } from '../../repositories/MaterialRepository.js';
import { ProfileRepository } from '../../repositories/ProfileRepository.js';
import { logger } from '../../utils/logger.js';

export interface AppliedRewardsResult {
  createdItems: Array<{
    id: string;
    item_type_id: string;
    name: string;
    category: string;
    rarity: string;
    style_id: string;
    style_name: string;
    generated_image_url: string | null;
  }>;
}

export async function applyRewards(
  itemRepository: ItemRepository,
  materialRepository: MaterialRepository,
  profileRepository: ProfileRepository,
  userId: string,
  sessionId: string,
  rewards: CombatRewards,
  combatLevel?: number
): Promise<AppliedRewardsResult> {
  const createdItems: AppliedRewardsResult['createdItems'] = [];

  if (rewards.result === 'victory' && rewards.currencies) {
    logger.info('Applying victory rewards (all DB mutations)', {
      userId,
      sessionId,
      gold: rewards.currencies.gold,
      materials: rewards.materials?.length ?? 0,
      items: rewards.items?.length ?? 0,
      experience: rewards.experience ?? 0
    });

    // Apply gold currency
    if (rewards.currencies.gold > 0) {
      await profileRepository.addCurrency(
        userId,
        'GOLD',
        rewards.currencies.gold,
        'combat_victory',
        sessionId,
        { sessionId, combatType: 'victory' }
      );
      logger.debug('✅ Gold awarded', {
        userId,
        amount: rewards.currencies.gold,
      });
    }

    // Create material stacks
    if (rewards.materials) {
      for (const material of rewards.materials) {
        try {
          await materialRepository.createStack(
            userId,
            material.material_id,
            1,
            material.style_id
          );
          logger.debug('✅ Material awarded', {
            userId,
            materialId: material.material_id,
            styleName: material.style_name,
          });
        } catch (error) {
          logger.warn('Failed to award material', {
            userId,
            materialId: material.material_id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Create items
    if (rewards.items) {
      for (const item of rewards.items) {
        try {
          const createdItem = await itemRepository.create({
            user_id: userId,
            item_type_id: item.item_type_id,
            level: combatLevel ?? 1,
          });
          createdItems.push({
            id: createdItem.id,
            item_type_id: createdItem.item_type_id,
            name: item.name,
            category: item.category,
            rarity: item.rarity,
            style_id: item.style_id,
            style_name: item.style_name,
            generated_image_url: createdItem.generated_image_url,
          });
          logger.debug('✅ Item created', {
            userId,
            itemId: createdItem.id,
            itemTypeId: item.item_type_id,
            itemName: item.name,
          });
        } catch (error) {
          logger.warn('Failed to award item', {
            userId,
            itemTypeId: item.item_type_id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Apply experience
    if (rewards.experience && rewards.experience > 0) {
      await profileRepository.addXP(userId, rewards.experience);
      logger.debug('✅ XP awarded', {
        userId,
        amount: rewards.experience,
      });
    }

    logger.info('✅ Victory rewards applied successfully', { userId, sessionId, createdItemCount: createdItems.length });
  } else if (rewards.result === 'defeat') {
    logger.info('Defeat - no rewards to apply', { userId, sessionId });
  }

  return { createdItems };
}
