/**
 * WeaponRepository
 *
 * Manages weapon timing mechanics, hit band configurations, and combat calculations.
 * Extends Items where category='weapon' with specialized timing gameplay features.
 */

import { BaseRepository } from './BaseRepository.js';
import { DatabaseError, ValidationError, NotFoundError } from '../utils/errors.js';
import { Database } from '../types/database.types.js';
import {
  DegreeConfig,
  AdjustedBands,
  CreateWeaponData,
  UpdateWeaponData,
  WeaponWithItem
} from '../types/repository.types.js';

export type Weapon = Database['public']['Tables']['weapons']['Row'];
export type WeaponInsert = Database['public']['Tables']['weapons']['Insert'];
export type WeaponUpdate = Database['public']['Tables']['weapons']['Update'];

/**
 * Repository for weapon timing mechanics and combat calculations
 */
export class WeaponRepository extends BaseRepository<Weapon> {
  constructor() {
    super('weapons');
  }

  // ============================================================================
  // Weapon Data Operations
  // ============================================================================

  /**
   * Find weapon by associated item ID
   *
   * @param itemId - Item ID (weapons.item_id foreign key)
   * @returns Weapon data or null if not found
   * @throws DatabaseError on query failure
   */
  async findWeaponByItemId(itemId: string): Promise<Weapon | null> {
    const { data, error } = await this.client
      .from('weapons')
      .select('*')
      .eq('item_id', itemId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new DatabaseError('Failed to find weapon by item ID', error);
    }

    return data;
  }

  /**
   * Find weapon with item details
   *
   * @param itemId - Item ID
   * @returns Weapon with related item data or null if not found
   * @throws DatabaseError on query failure
   */
  async findWeaponWithItem(itemId: string): Promise<WeaponWithItem | null> {
    const { data, error } = await this.client
      .from('weapons')
      .select(`
        *,
        item:items!inner(*)
      `)
      .eq('item_id', itemId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new DatabaseError('Failed to find weapon with item details', error);
    }

    return data as WeaponWithItem;
  }

  /**
   * Create weapon with validation
   *
   * @param weaponData - Weapon creation data
   * @returns Created weapon
   * @throws ValidationError if degree sum exceeds 360 or spin speed invalid
   * @throws DatabaseError on creation failure
   */
  async createWeapon(weaponData: CreateWeaponData): Promise<Weapon> {
    // Validate degree configuration
    const degreeConfig: DegreeConfig = {
      deg_injure: weaponData.deg_injure ?? 5.0,
      deg_miss: weaponData.deg_miss ?? 45.0,
      deg_graze: weaponData.deg_graze ?? 60.0,
      deg_normal: weaponData.deg_normal ?? 200.0,
      deg_crit: weaponData.deg_crit ?? 50.0
    };

    if (!this.validateDegreeSum(degreeConfig)) {
      throw new ValidationError('Total degree sum cannot exceed 360');
    }

    const spinSpeed = weaponData.spin_deg_per_s ?? 360.0;
    if (!this.validateSpinSpeed(spinSpeed)) {
      throw new ValidationError('Spin speed must be greater than 0');
    }

    // MVP0 constraint: Only single_arc pattern allowed
    if (weaponData.pattern !== 'single_arc') {
      throw new ValidationError('MVP0 only supports single_arc pattern');
    }

    const insertData: WeaponInsert = {
      item_id: weaponData.item_id,
      pattern: weaponData.pattern,
      spin_deg_per_s: spinSpeed,
      ...degreeConfig
    };

    return this.create(insertData);
  }

  /**
   * Update weapon pattern
   *
   * @param itemId - Item ID
   * @param pattern - New weapon pattern
   * @throws ValidationError if pattern not allowed in MVP0
   * @throws NotFoundError if weapon doesn't exist
   * @throws DatabaseError on update failure
   */
  async updateWeaponPattern(itemId: string, pattern: Database['public']['Enums']['weapon_pattern']): Promise<void> {
    // MVP0 constraint: Only single_arc pattern allowed
    if (pattern !== 'single_arc') {
      throw new ValidationError('MVP0 only supports single_arc pattern');
    }

    const { data, error } = await this.client
      .from('weapons')
      .update({ pattern })
      .eq('item_id', itemId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('weapon', itemId);
      }
      throw new DatabaseError('Failed to update weapon pattern', error);
    }
  }

  /**
   * Update weapon hit bands with validation
   *
   * @param itemId - Item ID
   * @param bands - New degree configuration
   * @throws ValidationError if degree sum exceeds 360
   * @throws NotFoundError if weapon doesn't exist
   * @throws DatabaseError on update failure
   */
  async updateHitBands(itemId: string, bands: DegreeConfig): Promise<void> {
    if (!this.validateDegreeSum(bands)) {
      throw new ValidationError('Total degree sum cannot exceed 360');
    }

    const { data, error } = await this.client
      .from('weapons')
      .update(bands)
      .eq('item_id', itemId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('weapon', itemId);
      }
      throw new DatabaseError('Failed to update hit bands', error);
    }
  }

  /**
   * Update weapon with full validation
   *
   * @param itemId - Item ID
   * @param updateData - Fields to update
   * @returns Updated weapon
   * @throws ValidationError on validation failure
   * @throws NotFoundError if weapon doesn't exist
   * @throws DatabaseError on update failure
   */
  async updateWeapon(itemId: string, updateData: UpdateWeaponData): Promise<Weapon> {
    // Validate pattern if provided
    if (updateData.pattern && updateData.pattern !== 'single_arc') {
      throw new ValidationError('MVP0 only supports single_arc pattern');
    }

    // Validate spin speed if provided
    if (updateData.spin_deg_per_s !== undefined && !this.validateSpinSpeed(updateData.spin_deg_per_s)) {
      throw new ValidationError('Spin speed must be greater than 0');
    }

    // If any degree fields are provided, validate the complete configuration
    const hasDegreeMods = ['deg_injure', 'deg_miss', 'deg_graze', 'deg_normal', 'deg_crit']
      .some(field => updateData[field as keyof UpdateWeaponData] !== undefined);

    if (hasDegreeMods) {
      // Get current weapon to merge with updates
      const current = await this.findWeaponByItemId(itemId);
      if (!current) {
        throw new NotFoundError('weapon', itemId);
      }

      const mergedDegrees: DegreeConfig = {
        deg_injure: updateData.deg_injure ?? current.deg_injure,
        deg_miss: updateData.deg_miss ?? current.deg_miss,
        deg_graze: updateData.deg_graze ?? current.deg_graze,
        deg_normal: updateData.deg_normal ?? current.deg_normal,
        deg_crit: updateData.deg_crit ?? current.deg_crit
      };

      if (!this.validateDegreeSum(mergedDegrees)) {
        throw new ValidationError('Total degree sum cannot exceed 360');
      }
    }

    const { data, error } = await this.client
      .from('weapons')
      .update(updateData)
      .eq('item_id', itemId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('weapon', itemId);
      }
      throw new DatabaseError('Failed to update weapon', error);
    }

    return data;
  }

  // ============================================================================
  // Combat Calculations
  // ============================================================================

  /**
   * Get accuracy-adjusted weapon bands using PostgreSQL function
   *
   * @param weaponId - Weapon item ID
   * @param playerAccuracy - Player accuracy rating (0.0 - 100.0)
   * @returns Adjusted band degrees
   * @throws NotFoundError if weapon doesn't exist
   * @throws DatabaseError on function call failure
   */
  async getAdjustedBands(weaponId: string, playerAccuracy: number): Promise<AdjustedBands> {
    try {
      const result = await this.rpc<{
        deg_injure: number;
        deg_miss: number;
        deg_graze: number;
        deg_normal: number;
        deg_crit: number;
      }>('fn_weapon_bands_adjusted', {
        w_id: weaponId,
        player_acc: playerAccuracy
      });

      const totalDegrees = result.deg_injure + result.deg_miss + result.deg_graze +
                          result.deg_normal + result.deg_crit;

      return {
        ...result,
        total_degrees: totalDegrees
      };
    } catch (error) {
      if (error instanceof DatabaseError && error.message.includes('Weapon not found')) {
        throw new NotFoundError('weapon', weaponId);
      }
      throw new DatabaseError('Failed to calculate adjusted bands', error as Record<string, any>);
    }
  }

  /**
   * Get expected damage multiplier using PostgreSQL function
   *
   * @param weaponId - Weapon item ID
   * @param playerAccuracy - Player accuracy rating (0.0 - 100.0)
   * @returns Expected damage multiplier
   * @throws NotFoundError if weapon doesn't exist
   * @throws DatabaseError on function call failure
   */
  async getExpectedDamageMultiplier(weaponId: string, playerAccuracy: number): Promise<number> {
    try {
      const result = await this.rpc<number>('fn_expected_mul_quick', {
        w_id: weaponId,
        player_acc: playerAccuracy
      });

      return result;
    } catch (error) {
      if (error instanceof DatabaseError && error.message.includes('Weapon not found')) {
        throw new NotFoundError('weapon', weaponId);
      }
      throw new DatabaseError('Failed to calculate expected damage multiplier', error as Record<string, any>);
    }
  }

  // ============================================================================
  // Validation Methods
  // ============================================================================

  /**
   * Validate that degree sum does not exceed 360
   *
   * @param degrees - Degree configuration to validate
   * @returns true if valid, false if exceeds 360
   */
  validateDegreeSum(degrees: DegreeConfig): boolean {
    const total = degrees.deg_injure + degrees.deg_miss + degrees.deg_graze +
                  degrees.deg_normal + degrees.deg_crit;
    return total <= 360.0;
  }

  /**
   * Validate spin speed is positive
   *
   * @param spinDegPerS - Spin speed in degrees per second
   * @returns true if valid (> 0), false otherwise
   */
  validateSpinSpeed(spinDegPerS: number): boolean {
    return spinDegPerS > 0;
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Find all weapons for a user (via items join)
   *
   * @param userId - User ID
   * @returns Array of weapons with item details
   * @throws DatabaseError on query failure
   */
  async findUserWeapons(userId: string): Promise<WeaponWithItem[]> {
    const { data, error } = await this.client
      .from('weapons')
      .select(`
        *,
        item:items!inner(*)
      `)
      .eq('item.user_id', userId);

    if (error) {
      throw new DatabaseError('Failed to find user weapons', error);
    }

    return (data || []) as WeaponWithItem[];
  }

  /**
   * Get weapon combat statistics
   *
   * @param weaponId - Weapon item ID
   * @param playerAccuracy - Player accuracy for calculations
   * @returns Combat stats including adjusted bands and expected multiplier
   * @throws NotFoundError if weapon doesn't exist
   * @throws DatabaseError on calculation failure
   */
  async getWeaponCombatStats(weaponId: string, playerAccuracy: number): Promise<{
    weapon: Weapon;
    adjustedBands: AdjustedBands;
    expectedDamageMultiplier: number;
  }> {
    const weapon = await this.findWeaponByItemId(weaponId);
    if (!weapon) {
      throw new NotFoundError('weapon', weaponId);
    }

    const [adjustedBands, expectedDamageMultiplier] = await Promise.all([
      this.getAdjustedBands(weaponId, playerAccuracy),
      this.getExpectedDamageMultiplier(weaponId, playerAccuracy)
    ]);

    return {
      weapon,
      adjustedBands,
      expectedDamageMultiplier
    };
  }
}