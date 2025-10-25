import { CombatRewards } from './types.js';
import { ItemRepository } from '../../repositories/ItemRepository.js';
import { MaterialRepository } from '../../repositories/MaterialRepository.js';
import { ProfileRepository } from '../../repositories/ProfileRepository.js';
import { logger } from '../../utils/logger.js';

export async function applyRewards(
  itemRepository: ItemRepository,
  materialRepository: MaterialRepository,
  profileRepository: ProfileRepository,
  userId: string,
  sessionId: string,
  rewards: CombatRewards
): Promise<void> {
  if (rewards.result === 'victory' && rewards.currencies) {
    logger.info('Applying victory rewards atomically', {
      userId,
      sessionId,
      gold: rewards.currencies.gold,
      materials: rewards.materials?.length ?? 0,
      items: rewards.items?.length ?? 0,
      experience: rewards.experience ?? 0
    });

    if (rewards.currencies.gold > 0) {
      await profileRepository.addCurrency(
        userId,
        'GOLD',
        rewards.currencies.gold,
        'combat_victory',
        sessionId,
        { sessionId, combatType: 'victory' }
      );
    }

    if (rewards.materials) {
      for (const material of rewards.materials) {
        await materialRepository.incrementStack(
          userId,
          material.material_id,
          1, 
          material.style_id
        );
      }
    }

    if (rewards.items) {
      for (const item of rewards.items) {
        
        await itemRepository.create({
          user_id: userId,
          item_type_id: item.item_type_id,
          level: 1, 
        });

        logger.debug('Item created without unlocking ItemType', {
          userId,
          itemTypeId: item.item_type_id
        });
      }
    }

    if (rewards.experience && rewards.experience > 0) {
      await profileRepository.addXP(userId, rewards.experience);
    }

    logger.info('Victory rewards applied successfully', { userId, sessionId });
  } else if (rewards.result === 'defeat') {
    logger.info('Defeat - no rewards to apply', { userId, sessionId });
    
  }
}
