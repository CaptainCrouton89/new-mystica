/**
 * RarityRepository - Manages rarity definitions and material strength tiers
 *
 * Key Distinction:
 * - Rarity: ONLY for items (common → legendary) with stat multipliers and drop rates
 * - Strength Tiers: ONLY for materials (derived from stat_modifiers abs_sum)
 */

import { BaseRepository } from './BaseRepository.js';
import { Database } from '../types/database.types.js';
import { DatabaseError, ValidationError } from '../utils/errors.js';
import { supabase } from '../config/supabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Type aliases for cleaner code
type RarityDefinition = Database['public']['Tables']['raritydefinitions']['Row'];
type MaterialStrengthTier = Database['public']['Tables']['materialstrengthtiers']['Row'];
type RarityEnum = Database['public']['Enums']['rarity'];

// Stats interface for abs_sum calculation
interface Stats {
  atkPower: number;
  atkAccuracy: number;
  defPower: number;
  defAccuracy: number;
}

// Material tier with abs_sum from v_material_tiers view
interface MaterialTierResult {
  material_id: string;
  abs_sum: number;
  tier_name: string;
}

export class RarityRepository extends BaseRepository<RarityDefinition> {
  constructor(client: SupabaseClient = supabase) {
    super('raritydefinitions', client);
  }

  // ================== RARITY DEFINITIONS (ITEMS ONLY) ==================

  /**
   * Find rarity definition by name
   *
   * @param rarity - Rarity enum value
   * @returns Rarity definition or null if not found
   * @throws DatabaseError on query failure
   */
  async findRarityByName(rarity: RarityEnum): Promise<RarityDefinition | null> {
    return this.findOne({ rarity });
  }

  /**
   * Get all rarity definitions ordered by stat multiplier (ascending)
   *
   * @returns Array of all rarity definitions
   * @throws DatabaseError on query failure
   */
  async getAllRarities(): Promise<RarityDefinition[]> {
    return this.findMany({}, {
      sort: { orderBy: 'stat_multiplier', ascending: true }
    });
  }

  /**
   * Get stat multiplier for a rarity level
   *
   * @param rarity - Rarity name
   * @returns Stat multiplier (1.00 - 2.00 range)
   * @throws ValidationError if rarity not found
   * @throws DatabaseError on query failure
   */
  async getStatMultiplier(rarity: string): Promise<number> {
    const rarityDef = await this.findRarityByName(rarity as RarityEnum);

    if (!rarityDef) {
      throw new ValidationError(`Rarity '${rarity}' not found`);
    }

    // Validate multiplier range (defensive check)
    if (rarityDef.stat_multiplier < 1.0 || rarityDef.stat_multiplier > 2.0) {
      throw new ValidationError(
        `Invalid stat multiplier ${rarityDef.stat_multiplier} for rarity '${rarity}'. Expected range: 1.00-2.00`
      );
    }

    return rarityDef.stat_multiplier;
  }

  /**
   * Get base drop rate for a rarity level
   *
   * @param rarity - Rarity name
   * @returns Base drop rate (0.0 - 1.0 range)
   * @throws ValidationError if rarity not found
   * @throws DatabaseError on query failure
   */
  async getBaseDropRate(rarity: string): Promise<number> {
    const rarityDef = await this.findRarityByName(rarity as RarityEnum);

    if (!rarityDef) {
      throw new ValidationError(`Rarity '${rarity}' not found`);
    }

    // Validate drop rate range (defensive check)
    if (rarityDef.base_drop_rate < 0.0 || rarityDef.base_drop_rate > 1.0) {
      throw new ValidationError(
        `Invalid drop rate ${rarityDef.base_drop_rate} for rarity '${rarity}'. Expected range: 0.0-1.0`
      );
    }

    return rarityDef.base_drop_rate;
  }

  // ================== MATERIAL STRENGTH TIERS (DERIVED) ==================

  /**
   * Find material tier using v_material_tiers view
   *
   * @param materialId - Material UUID
   * @returns Material tier data with abs_sum or null if not found
   * @throws DatabaseError on query failure
   */
  async findMaterialTier(materialId: string): Promise<MaterialTierResult | null> {
    const { data, error } = await this.client
      .from('v_material_tiers')
      .select('material_id, abs_sum, tier_name')
      .eq('material_id', materialId)
      .single();

    if (error) {
      // PGRST116 = no rows returned
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new DatabaseError(`Failed to find material tier: ${error.message}`, error);
    }

    return data as MaterialTierResult;
  }

  /**
   * Get all material strength tier definitions
   *
   * @returns Array of tier definitions ordered by min_abs_sum
   * @throws DatabaseError on query failure
   */
  async getAllMaterialTiers(): Promise<MaterialStrengthTier[]> {
    const { data, error } = await this.client
      .from('materialstrengthtiers')
      .select('*')
      .order('min_abs_sum', { ascending: true });

    if (error) {
      throw new DatabaseError(`Failed to get material tiers: ${error.message}`, error);
    }

    return data as MaterialStrengthTier[];
  }

  /**
   * Compute material absolute sum for tier classification
   *
   * Helper method that computes: ABS(atkPower) + ABS(atkAccuracy) + ABS(defPower) + ABS(defAccuracy)
   * Used for material tier classification and validation.
   *
   * @param statModifiers - Material stat modifiers
   * @returns Absolute sum of all stat modifiers
   */
  computeMaterialAbsSum(statModifiers: Stats): number {
    return Math.abs(statModifiers.atkPower) +
           Math.abs(statModifiers.atkAccuracy) +
           Math.abs(statModifiers.defPower) +
           Math.abs(statModifiers.defAccuracy);
  }

  /**
   * Find tier for computed abs_sum value
   *
   * Helper method to determine which tier an abs_sum falls into.
   * Uses [min_abs_sum, max_abs_sum) range logic.
   *
   * @param absSum - Computed absolute sum
   * @returns Tier name or null if no tier matches
   * @throws DatabaseError on query failure
   */
  async findTierForAbsSum(absSum: number): Promise<string | null> {
    const { data, error } = await this.client
      .from('materialstrengthtiers')
      .select('tier_name')
      .gte('max_abs_sum', absSum)  // max_abs_sum >= absSum
      .lte('min_abs_sum', absSum)  // min_abs_sum <= absSum
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No tier found for this abs_sum
      }
      throw new DatabaseError(`Failed to find tier for abs_sum ${absSum}: ${error.message}`, error);
    }

    return data.tier_name;
  }

  /**
   * Validate material tier assignment
   *
   * Verifies that a material's computed abs_sum matches its assigned tier.
   * Used for data validation and debugging.
   *
   * @param materialId - Material UUID
   * @param expectedTier - Expected tier name
   * @returns true if tier assignment is correct
   * @throws ValidationError if tier mismatch
   * @throws DatabaseError on query failure
   */
  async validateMaterialTierAssignment(materialId: string, expectedTier: string): Promise<boolean> {
    const materialTier = await this.findMaterialTier(materialId);

    if (!materialTier) {
      throw new ValidationError(`Material '${materialId}' not found in tier view`);
    }

    if (materialTier.tier_name !== expectedTier) {
      throw new ValidationError(
        `Material '${materialId}' tier mismatch. Expected: '${expectedTier}', Found: '${materialTier.tier_name}' (abs_sum: ${materialTier.abs_sum})`
      );
    }

    return true;
  }

  // ================== BATCH OPERATIONS ==================

  /**
   * Get materials by tier name using v_material_tiers view
   *
   * @param tierName - Target tier name
   * @returns Array of material tier results
   * @throws DatabaseError on query failure
   */
  async getMaterialsByTier(tierName: string): Promise<MaterialTierResult[]> {
    const { data, error } = await this.client
      .from('v_material_tiers')
      .select('material_id, abs_sum, tier_name')
      .eq('tier_name', tierName)
      .order('abs_sum', { ascending: false }); // Strongest first within tier

    if (error) {
      throw new DatabaseError(`Failed to get materials for tier '${tierName}': ${error.message}`, error);
    }

    return data as MaterialTierResult[];
  }

  /**
   * Get tier distribution statistics
   *
   * Returns count of materials in each tier for analytics.
   *
   * @returns Object with tier_name -> count mapping
   * @throws DatabaseError on query failure
   */
  async getTierDistribution(): Promise<Record<string, number>> {
    const { data, error } = await this.client
      .from('v_material_tiers')
      .select('tier_name')
      .order('tier_name');

    if (error) {
      throw new DatabaseError(`Failed to get tier distribution: ${error.message}`, error);
    }

    // Count occurrences of each tier
    const distribution: Record<string, number> = {};
    for (const row of data) {
      distribution[row.tier_name] = (distribution[row.tier_name] || 0) + 1;
    }

    return distribution;
  }
}

/**
 * Singleton instance of RarityRepository for use across the application
 */
export const rarityRepository = new RarityRepository();