import { Item, UpgradeResult, Stats } from '../types/api.types';
import { NotImplementedError, NotFoundError, BusinessLogicError, mapSupabaseError } from '../utils/errors';
import { supabase } from '../config/supabase';
import { statsService } from './StatsService';
import { profileService } from './ProfileService';

/**
 * Handles individual item operations and upgrades
 */
export class ItemService {
  /**
   * Get detailed item information by ID
   * - Fetches item with all associated data
   * - Includes applied materials and computed stats
   * - Validates user ownership
   */
  async getItemDetails(userId: string, itemId: string): Promise<Item> {
    // TODO: Implement item retrieval workflow
    // 1. Query Items table for itemId and user_id
    // 2. Join with ItemTypes for base stats and data
    // 3. Join with ItemMaterials -> MaterialInstances -> Materials
    // 4. Compute current stats (base × level + material modifiers)
    // 5. Return complete item data
    // 6. Throw NotFoundError if item doesn't exist or wrong owner
    throw new NotImplementedError('ItemService.getItemDetails not implemented');
  }

  /**
   * Get upgrade cost for item
   * - Calculates gold cost for next level
   * - Returns current level and cost information
   */
  async getUpgradeCost(userId: string, itemId: string): Promise<{
    current_level: number;
    next_level: number;
    gold_cost: number;
    player_gold: number;
    can_afford: boolean;
  }> {
    try {
      // 1. Validate user owns item and get current level
      const { data: item, error: itemError } = await supabase
        .from('Items')
        .select('level')
        .eq('id', itemId)
        .eq('user_id', userId)
        .single();

      if (itemError) {
        if (itemError.code === 'PGRST116') {
          throw new NotFoundError('Item', itemId);
        }
        throw mapSupabaseError(itemError);
      }

      const currentLevel = item.level;
      const nextLevel = currentLevel + 1;

      // 2. Calculate upgrade cost using formula: cost = 100 * Math.pow(1.5, level - 1)
      const goldCost = Math.floor(100 * Math.pow(1.5, currentLevel - 1));

      // 3. Get user's current gold from UserCurrencyBalances
      const { data: balance, error: balanceError } = await supabase
        .from('UserCurrencyBalances')
        .select('balance')
        .eq('user_id', userId)
        .eq('currency_code', 'GOLD')
        .single();

      if (balanceError && balanceError.code !== 'PGRST116') {
        throw mapSupabaseError(balanceError);
      }

      const playerGold = balance?.balance || 0;
      const canAfford = playerGold >= goldCost;

      return {
        current_level: currentLevel,
        next_level: nextLevel,
        gold_cost: goldCost,
        player_gold: playerGold,
        can_afford: canAfford
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BusinessLogicError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Upgrade item level using gold
   * - Costs gold based on current level (exponential scaling)
   * - Increases base stats linearly with level
   * - Updates average item level trigger
   */
  async upgradeItem(userId: string, itemId: string): Promise<UpgradeResult> {
    try {
      // 1. Get upgrade cost info (validates ownership)
      const costInfo = await this.getUpgradeCost(userId, itemId);

      if (!costInfo.can_afford) {
        throw new BusinessLogicError(`Insufficient gold. Need ${costInfo.gold_cost}, have ${costInfo.player_gold}`);
      }

      // 2. Get item details for stats calculation
      const { data: item, error: itemError } = await supabase
        .from('Items')
        .select(`
          *,
          item_type:ItemTypes(*)
        `)
        .eq('id', itemId)
        .eq('user_id', userId)
        .single();

      if (itemError) {
        throw mapSupabaseError(itemError);
      }

      // 3. Calculate stats before and after upgrade
      const statsBefore = statsService.computeItemStatsForLevel(item, costInfo.current_level);
      const statsAfter = statsService.computeItemStatsForLevel(item, costInfo.next_level);
      const statIncrease: Stats = {
        atkPower: statsAfter.atkPower - statsBefore.atkPower,
        atkAccuracy: statsAfter.atkAccuracy - statsBefore.atkAccuracy,
        defPower: statsAfter.defPower - statsBefore.defPower,
        defAccuracy: statsAfter.defAccuracy - statsBefore.defAccuracy
      };

      // 4. Perform atomic transaction
      const { error: transactionError } = await supabase.rpc('process_item_upgrade', {
        p_user_id: userId,
        p_item_id: itemId,
        p_gold_cost: costInfo.gold_cost,
        p_new_level: costInfo.next_level,
        p_new_stats: statsAfter
      });

      if (transactionError) {
        // If the RPC function doesn't exist, perform manual transaction
        await this.performManualUpgradeTransaction(
          userId,
          itemId,
          costInfo.gold_cost,
          costInfo.next_level,
          statsAfter
        );
      }

      // 5. Update vanity level
      await profileService.updateVanityLevel(userId);

      // 6. Return upgrade result
      return {
        success: true,
        updated_item: {
          ...item,
          level: costInfo.next_level,
          current_stats: statsAfter
        },
        gold_spent: costInfo.gold_cost,
        new_level: costInfo.next_level,
        stat_increase: statIncrease,
        message: `Item upgraded to level ${costInfo.next_level}!`
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BusinessLogicError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Manual transaction for item upgrade when RPC is not available
   */
  private async performManualUpgradeTransaction(
    userId: string,
    itemId: string,
    goldCost: number,
    newLevel: number,
    newStats: Stats
  ): Promise<void> {
    // Start a manual transaction using multiple operations
    // Note: Supabase doesn't support true transactions via client, so this is best effort

    // 1. First check current balance and deduct gold
    const { data: currentBalance, error: balanceError } = await supabase
      .from('UserCurrencyBalances')
      .select('balance')
      .eq('user_id', userId)
      .eq('currency_code', 'GOLD')
      .single();

    if (balanceError || !currentBalance || currentBalance.balance < goldCost) {
      throw new BusinessLogicError('Insufficient gold for upgrade');
    }

    const newBalance = currentBalance.balance - goldCost;
    const { error: deductError } = await supabase
      .from('UserCurrencyBalances')
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('currency_code', 'GOLD');

    if (deductError) {
      throw new BusinessLogicError('Failed to deduct gold - insufficient funds');
    }

    // 2. Log transaction
    const { error: logError } = await supabase
      .from('EconomyTransactions')
      .insert({
        user_id: userId,
        transaction_type: 'sink',
        currency: 'GOLD',
        amount: -goldCost,
        balance_after: newBalance,
        source_type: 'ITEM_UPGRADE',
        source_id: itemId,
        metadata: { item_id: itemId, new_level: newLevel }
      });

    if (logError) {
      // Log error but don't fail the upgrade
      console.error('Failed to log economy transaction:', logError);
    }

    // 3. Update item level and stats
    const { error: updateError } = await supabase
      .from('Items')
      .update({
        level: newLevel,
        current_stats: newStats
      })
      .eq('id', itemId)
      .eq('user_id', userId);

    if (updateError) {
      throw mapSupabaseError(updateError);
    }
  }
}

export const itemService = new ItemService();