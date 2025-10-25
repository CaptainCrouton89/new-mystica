import { UserProfile, Stats } from '../types/api.types.js';
import { mapSupabaseError, NotFoundError, BusinessLogicError, ValidationError } from '../utils/errors.js';
import { ProfileRepository } from '../repositories/ProfileRepository.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { EquipmentRepository } from '../repositories/EquipmentRepository.js';
import { analyticsService } from './AnalyticsService.js';
import { Database } from '../types/database.types.js';

type PlayerProgression = Database['public']['Tables']['playerprogression']['Row'];
type DeviceToken = Database['public']['Tables']['devicetokens']['Row'];

export class ProfileService {
  private profileRepository: ProfileRepository;
  private itemRepository: ItemRepository;
  private equipmentRepository: EquipmentRepository;

  constructor() {
    this.profileRepository = new ProfileRepository();
    this.itemRepository = new ItemRepository();
    this.equipmentRepository = new EquipmentRepository();
  }
  async initializeProfile(userId: string): Promise<UserProfile> {
    try {
      const existingItems = await this.itemRepository.findByUser(userId);
      if (existingItems.length > 0) {
        throw new BusinessLogicError('Profile already initialized');
      }

      await this.profileRepository.addCurrency(userId, 'GOLD', 0, 'profile_init');
      await this.profileRepository.addCurrency(userId, 'GEMS', 0, 'profile_init');

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

      await this.profileRepository.updateProgression(userId, {
        xp: 0,
        level: 1,
        xp_to_next_level: 100
      });

      await analyticsService.trackEvent(userId, 'profile_initialized', {
        starter_item_id: starterItem.id,
        starter_item_type: randomItemType.name
      });

      return this.getProfile(userId);
    } catch (error) {
      if (error instanceof BusinessLogicError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  async getProfile(userId: string): Promise<UserProfile> {
    try {
      const user = await this.profileRepository.findUserById(userId);
      if (!user) throw new NotFoundError('User', userId);

      const balances = await this.profileRepository.getAllCurrencyBalances(userId);

      const progression = await this.getProgression(userId);

      const totalStats = await this.calculateTotalStats(userId);

      const accountType = user.account_type || (user.email?.includes('@mystica.local') ? 'anonymous' : 'email');

      return {
        id: user.id,
        email: user.email,
        device_id: null,
        account_type: accountType,
        username: null,
        vanity_level: user.vanity_level,
        avg_item_level: user.avg_item_level || 0,
        gold: balances.GOLD,
        gems: balances.GEMS,
        total_stats: totalStats,
        level: progression?.level || 1,
        xp: progression?.xp || 0,
        created_at: user.created_at,
        last_login: user.last_login || user.created_at
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  async getCurrencyBalance(userId: string, currency: 'GOLD' | 'GEMS'): Promise<number> {
    return this.profileRepository.getCurrencyBalance(userId, currency);
  }

  async getAllCurrencyBalances(userId: string): Promise<{GOLD: number, GEMS: number}> {
    return this.profileRepository.getAllCurrencyBalances(userId);
  }

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

  async getProgression(userId: string): Promise<PlayerProgression | null> {
    return this.profileRepository.getProgression(userId);
  }

  async addXP(userId: string, amount: number): Promise<{newXP: number, newLevel: number, leveledUp: boolean}> {
    if (amount <= 0) {
      throw new ValidationError('XP amount must be positive');
    }

    return this.profileRepository.addXP(userId, amount);
  }

  async updateVanityLevel(userId: string): Promise<number> {
    try {
      return await this.profileRepository.updateVanityLevel(userId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const mappedError = mapSupabaseError(new Error(errorMessage));
      console.error(`Error in method: ${errorMessage}`);
      throw mappedError;
    }
  }

  async updateAvgItemLevel(userId: string): Promise<number> {
    try {
      return await this.profileRepository.updateAvgItemLevel(userId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const mappedError = mapSupabaseError(new Error(errorMessage));
      console.error(`Error in method: ${errorMessage}`);
      throw mappedError;
    }
  }

  async calculateTotalStats(userId: string): Promise<Stats> {
    try {
      return await this.equipmentRepository.getPlayerEquippedStats(userId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const mappedError = mapSupabaseError(new Error(errorMessage));
      console.error(`Error in method: ${errorMessage}`);
      throw mappedError;
    }
  }

  async registerDeviceToken(userId: string, platform: string, token: string): Promise<void> {
    return this.profileRepository.registerDeviceToken(userId, platform, token);
  }

  async getActiveDeviceTokens(userId: string): Promise<DeviceToken[]> {
    return this.profileRepository.getActiveDeviceTokens(userId);
  }
}

export const profileService = new ProfileService();