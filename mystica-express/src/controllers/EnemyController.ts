import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import type { LocationIdParams } from '../types/schemas.js';
import type { Database } from '../types/database.types.js';

type EnemyType = Database['public']['Tables']['enemytypes']['Row'];
type PlayerCombatHistory = Database['public']['Tables']['playercombathistory']['Row'];

/**
 * Enemy Controller
 * Handles enemy-related endpoints for combat system
 */
export class EnemyController {
  /**
   * GET /enemies/types
   * Return all enemy personality data from database
   * Public endpoint - no authentication required
   */
  getEnemyTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { data: enemyTypes, error } = await supabase
        .from('enemytypes')
        .select(`
          id,
          name,
          ai_personality_traits,
          dialogue_tone,
          dialogue_guidelines,
          atk_power,
          atk_accuracy,
          def_power,
          def_accuracy,
          base_hp,
          tier_id
        `)
        .order('name');

      if (error) {
        throw error;
      }

      res.json({
        enemy_types: enemyTypes || []
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /players/combat-history/:location_id
   * Return player combat stats at specific location
   * Requires authentication - uses req.user from auth middleware
   */
  getPlayerCombatHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { location_id } = req.params as unknown as LocationIdParams;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // First verify the location exists
      const { data: location, error: locationError } = await supabase
        .from('locations')
        .select('id')
        .eq('id', location_id)
        .single();

      if (locationError || !location) {
        res.status(404).json({ error: 'Location not found' });
        return;
      }

      // Get player combat history for this location
      const { data: combatHistory, error: historyError } = await supabase
        .from('playercombathistory')
        .select('*')
        .eq('user_id', userId)
        .eq('location_id', location_id)
        .single();

      if (historyError && historyError.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is acceptable for new players
        throw historyError;
      }

      // If no history exists, return zeroed stats for first-time player
      const historyData = combatHistory || {
        location_id,
        total_attempts: 0,
        victories: 0,
        defeats: 0,
        current_streak: 0,
        longest_streak: 0,
        last_attempt: null
      };

      // Calculate win rate
      const winRate = historyData.total_attempts > 0
        ? historyData.victories / historyData.total_attempts
        : 0;

      res.json({
        location_id: historyData.location_id,
        attempts: historyData.total_attempts,
        victories: historyData.victories,
        defeats: historyData.defeats,
        win_rate: Number(winRate.toFixed(3)), // Round to 3 decimal places
        current_streak: historyData.current_streak,
        longest_streak: historyData.longest_streak,
        last_attempt: historyData.last_attempt
      });
    } catch (error) {
      next(error);
    }
  };
}

export const enemyController = new EnemyController();