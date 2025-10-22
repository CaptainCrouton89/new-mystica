import { UserProfile, Stats } from '../types/api.types.js';
import { mapSupabaseError, NotFoundError, BusinessLogicError, ValidationError } from '../utils/errors.js';
import { ProfileRepository } from '../repositories/ProfileRepository.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { EquipmentRepository } from '../repositories/EquipmentRepository.js';
import { analyticsService } from './AnalyticsService.js';
import { Database } from '../types/database.types.js';

// Database row types
type PlayerProgression = Database['public']['Tables']['playerprogression']['Row'];
type DeviceToken = Database['public']['Tables']['devicetokens']['Row'];

/**
 * Handles user profile management and initialization
 */
export class ProfileService {
  private profileRepository: ProfileRepository;
  private itemRepository: ItemRepository;
  private equipmentRepository: EquipmentRepository;

  constructor() {
    this.profileRepository = new ProfileRepository();
    this.itemRepository = new ItemRepository();
    this.equipmentRepository = new EquipmentRepository();
  }
  /**
   * Initialize a new player profile with starter inventory
   * Creates exactly 1 random common item, 0 currency, level 1 progression
   * Throws BusinessLogicError if profile already initialized
   */
  async initializeProfile(userId: string): Promise<UserProfile> {
    try {
      // 1. Check if already initialized
      const existingItems = await this.itemRepository.findByUser(userId);
      if (existingItems.length > 0) {
        throw new BusinessLogicError('Profile already initialized');
      }

      // 2. Initialize currency balances (0 GOLD, 0 GEMS)
      await this.profileRepository.addCurrency(userId, 'GOLD', 0, 'profile_init');
      await this.profileRepository.addCurrency(userId, 'GEMS', 0, 'profile_init');

      // 3. Create random common item
      const commonItemTypes = await this.itemRepository.findItemTypesByRarity('common');
      if (commonItemTypes.length === 0) {
        throw new NotFoundError('No common item types available for profile initialization');
      }
      const randomItemType = commonItemTypes[Math.floor(Math.random() * commonItemTypes.length)];

      const starterItem = await this.itemRepository.create({
        user_id: userId,
        item_type_id: randomItemType.id,
        level: 1
      });

      // 4. Initialize progression
      await this.profileRepository.updateProgression(userId, {
        xp: 0,
        level: 1,
        xp_to_next_level: 100 // Standard level 1→2 requirement
      });

      // 5. Log profile initialization event
      await analyticsService.trackEvent(userId, 'profile_initialized', {
        starter_item_id: starterItem.id,
        starter_item_type: randomItemType.name
      });

      // 6. Return complete profile
      return this.getProfile(userId);
    } catch (error) {
      if (error instanceof BusinessLogicError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Get user profile by user ID
   * - Fetches complete profile data with stats and currency balances
   */
  async getProfile(userId: string): Promise<UserProfile> {
    try {
      // 1. Get base user data
      const user = await this.profileRepository.findUserById(userId);
      if (!user) throw new NotFoundError('User not found');

      // 2. Get currency balances
      const balances = await this.profileRepository.getAllCurrencyBalances(userId);

      // 3. Get progression data
      const progression = await this.getProgression(userId);

      // 4. Calculate total stats from equipped items (if needed)
      const totalStats = await this.calculateTotalStats(userId);

      // 5. Get account type from Users.account_type column (with fallback to email derivation)
      const accountType = user.account_type || (user.email?.includes('@mystica.local') ? 'anonymous' : 'email');

      // 6. Return aggregated profile
      return {
        id: user.id,
        email: user.email,
        device_id: null, // Will be set from device tokens if available
        account_type: accountType,
        username: null, // Users table doesn't have username field yet
        vanity_level: user.vanity_level,
        gold: balances.GOLD,
        gems: balances.GEMS,
        total_stats: totalStats,
        level: progression?.level || 1,
        xp: progression?.xp || 0,
        created_at: user.created_at,
        last_login: user.last_login || user.created_at // Default to created_at if last_login is null
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  // ============================================================================
  // Currency Operations
  // ============================================================================

  /**
   * Get balance for specific currency
   */
  async getCurrencyBalance(userId: string, currency: 'GOLD' | 'GEMS'): Promise<number> {
    return this.profileRepository.getCurrencyBalance(userId, currency);
  }

  /**
   * Get all currency balances for user
   */
  async getAllCurrencyBalances(userId: string): Promise<{GOLD: number, GEMS: number}> {
    return this.profileRepository.getAllCurrencyBalances(userId);
  }

  /**
   * Add currency using RPC function with transaction logging
   */
  async addCurrency(
    userId: string,
    currency: 'GOLD' | 'GEMS',
    amount: number,
    sourceType: string,
    sourceId?: string,
    metadata?: Record<string, any>
  ): Promise<number> {
    if (amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    return this.profileRepository.addCurrency(userId, currency, amount, sourceType, sourceId, metadata);
  }

  /**
   * Deduct currency using RPC function with transaction logging
   */
  async deductCurrency(
    userId: string,
    currency: 'GOLD' | 'GEMS',
    amount: number,
    sourceType: string,
    sourceId?: string,
    metadata?: Record<string, any>
  ): Promise<number> {
    if (amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    return this.profileRepository.deductCurrency(userId, currency, amount, sourceType, sourceId, metadata);
  }

  // ============================================================================
  // Progression System
  // ============================================================================

  /**
   * Get player progression data
   */
  async getProgression(userId: string): Promise<PlayerProgression | null> {
    return this.profileRepository.getProgression(userId);
  }

  /**
   * Add XP using RPC function with automatic level-up
   */
  async addXP(userId: string, amount: number): Promise<{newXP: number, newLevel: number, leveledUp: boolean}> {
    if (amount <= 0) {
      throw new ValidationError('XP amount must be positive');
    }

    return this.profileRepository.addXP(userId, amount);
  }

  // ============================================================================
  // Derived Statistics
  // ============================================================================

  /**
   * Update user vanity level based on equipped item levels
   */
  async updateVanityLevel(userId: string): Promise<number> {
    try {
      return await this.profileRepository.updateVanityLevel(userId);
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Update average item level of equipped items
   */
  async updateAvgItemLevel(userId: string): Promise<number> {
    try {
      return await this.profileRepository.updateAvgItemLevel(userId);
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Calculate total combat stats from equipped items using v_player_equipped_stats view
   */
  async calculateTotalStats(userId: string): Promise<Stats> {
    try {
      return await this.equipmentRepository.getPlayerEquippedStats(userId);
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  // ============================================================================
  // Device Management
  // ============================================================================

  /**
   * Register device token for push notifications
   */
  async registerDeviceToken(userId: string, platform: string, token: string): Promise<void> {
    return this.profileRepository.registerDeviceToken(userId, platform, token);
  }

  /**
   * Get active device tokens for user
   */
  async getActiveDeviceTokens(userId: string): Promise<DeviceToken[]> {
    return this.profileRepository.getActiveDeviceTokens(userId);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================
}

export const profileService = new ProfileService();