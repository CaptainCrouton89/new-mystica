/**
 * ProfileRepository - User profile and progression management
 *
 * Handles user account operations, currency balances, economy transaction logging,
 * player progression tracking, and device token management for push notifications.
 *
 * Tables: users, usercurrencybalances, economytransactions, playerprogression, devicetokens
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types.js';
import {
  EconomyTransactionData,
  PlayerProgressionUpdate
} from '../types/repository.types.js';
import { BusinessLogicError, ValidationError } from '../utils/errors.js';
import { BaseRepository } from './BaseRepository.js';

// Database row types
type User = Database['public']['Tables']['users']['Row'];
type EconomyTransaction = Database['public']['Tables']['economytransactions']['Row'];
type PlayerProgression = Database['public']['Tables']['playerprogression']['Row'];
type DeviceToken = Database['public']['Tables']['devicetokens']['Row'];

type UserUpdate = Database['public']['Tables']['users']['Update'];
type PlayerProgressionInsert = Database['public']['Tables']['playerprogression']['Insert'];

// RPC Response types for atomic operations
interface CurrencyRpcResponse {
  success: boolean;
  error_code?: string;
  message?: string;
  data: {
    previous_balance: number;
    new_balance: number;
    transaction_id: string;
  } | null;
}

interface XpRpcResponse {
  success: boolean;
  error_code?: string;
  message?: string;
  data?: {
    previous_xp: number;
    previous_level: number;
    new_xp: number;
    new_level: number;
    xp_to_next_level: number;
    leveled_up: boolean;
    levels_gained: number;
  };
}

/**
 * ProfileRepository
 *
 * Manages user profiles, currency balances, progression, and device tokens.
 * CRITICAL: ALL currency changes MUST use RPC functions for atomic operations.
 */
export class ProfileRepository extends BaseRepository<User> {
  constructor(client?: SupabaseClient) {
    super('users', client);
  }

  // ============================================================================
  // User Account Operations
  // ============================================================================

  /**
   * Find user by ID
   */
  async findUserById(userId: string): Promise<User | null> {
    return this.findById(userId);
  }

  /**
   * Find user by device ID (direct device_id field for anonymous users)
   */
  async findUserByDeviceId(deviceId: string, accountType: string = 'anonymous'): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('device_id', deviceId)
      .eq('account_type', accountType)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.mapError(error);
    }

    return data;
  }

  /**
   * Find user by device token (via device tokens table)
   */
  async findUserByDeviceToken(deviceToken: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('devicetokens')
      .select('user_id, users(*)')
      .eq('token', deviceToken)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.mapError(error);
    }

    const user = (data as any)?.users as User | null;
    if (!user) {
      throw new Error(`User not found for device token: ${deviceToken}`);
    }
    return user;
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }

  /**
   * Update user data
   */
  async updateUser(userId: string, data: Partial<UserUpdate>): Promise<User> {
    return this.update(userId, data);
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.update(userId, {
      last_login: new Date().toISOString()
    });
  }

  /**
   * Create anonymous user with device ID
   * Handles race conditions via unique constraint errors
   */
  async createAnonymousUser(userId: string, deviceId: string): Promise<User> {
    const { data, error } = await this.client
      .from('users')
      .insert({
        id: userId,
        device_id: deviceId,
        account_type: 'anonymous',
        is_anonymous: true,
        email: null,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
        vanity_level: 0,
        avg_item_level: 0
      })
      .select()
      .single();

    if (error) {
      throw this.mapError(error);
    }

    return data;
  }

  /**
   * Create email user profile
   */
  async createEmailUser(userId: string, email: string): Promise<User> {
    const { data, error } = await this.client
      .from('users')
      .insert({
        id: userId,
        email: email,
        account_type: 'email',
        is_anonymous: false,
        device_id: null,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
        vanity_level: 0,
        avg_item_level: 0
      })
      .select()
      .single();

    if (error) {
      throw this.mapError(error);
    }

    return data;
  }

  // ============================================================================
  // Currency Management
  // ============================================================================

  /**
   * Get balance for specific currency
   */
  async getCurrencyBalance(userId: string, currencyCode: 'GOLD' | 'GEMS'): Promise<number> {
    const { data, error } = await this.client
      .from('usercurrencybalances')
      .select('balance')
      .eq('user_id', userId)
      .eq('currency_code', currencyCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return 0; // No balance record = 0 balance
      }
      throw this.mapError(error);
    }

    return data.balance;
  }

  /**
   * Get all currency balances for user
   */
  async getAllCurrencyBalances(userId: string): Promise<{ GOLD: number; GEMS: number }> {
    const { data, error } = await this.client
      .from('usercurrencybalances')
      .select('currency_code, balance')
      .eq('user_id', userId);

    if (error) {
      throw this.mapError(error);
    }

    const balances: { GOLD: number; GEMS: number } = { GOLD: 0, GEMS: 0 };

    data?.forEach(row => {
      if (row.currency_code === 'GOLD') {
        balances.GOLD = row.balance;
      } else if (row.currency_code === 'GEMS') {
        balances.GEMS = row.balance;
      }
    });

    return balances;
  }

  /**
   * Update currency balance directly (DEPRECATED - use add/deduct instead)
   * @deprecated Use addCurrency/deductCurrency for transaction logging
   */
  async updateCurrencyBalance(userId: string, currencyCode: string, newBalance: number): Promise<void> {
    console.warn('ProfileRepository.updateCurrencyBalance is deprecated. Use addCurrency/deductCurrency for proper transaction logging.');

    const { error } = await this.client
      .from('usercurrencybalances')
      .upsert({
        user_id: userId,
        currency_code: currencyCode,
        balance: newBalance,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw this.mapError(error);
    }
  }

  /**
   * Deduct currency with atomic transaction logging
   * Throws BusinessLogicError if insufficient funds
   */
  async deductCurrency(
    userId: string,
    currencyCode: string,
    amount: number,
    sourceType: string = 'manual_deduction',
    sourceId?: string,
    metadata: Record<string, any> = {}
  ): Promise<number> {
    if (amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    const response = await this.rpc<CurrencyRpcResponse>('deduct_currency_with_logging', {
      p_user_id: userId,
      p_currency_code: currencyCode,
      p_amount: amount,
      p_source_type: sourceType,
      p_source_id: sourceId || null,
      p_metadata: metadata,
    });

    if (!response.success) {
      if (response.error_code === 'INSUFFICIENT_FUNDS') {
        throw new BusinessLogicError(response.message || 'Insufficient funds');
      }
      throw new BusinessLogicError(response.message || 'Failed to deduct currency');
    }

    return response.data!.new_balance;
  }

  /**
   * Deduct currency with logging - returns full RPC response for EconomyService
   */
  async deductCurrencyWithLogging(
    userId: string,
    currencyCode: string,
    amount: number,
    sourceType: string,
    sourceId: string | null,
    metadata: Record<string, any>
  ): Promise<CurrencyRpcResponse> {
    return this.rpc<CurrencyRpcResponse>('deduct_currency_with_logging', {
      p_user_id: userId,
      p_currency_code: currencyCode,
      p_amount: amount,
      p_source_type: sourceType,
      p_source_id: sourceId,
      p_metadata: metadata,
    });
  }

  /**
   * Add currency with atomic transaction logging
   */
  async addCurrency(
    userId: string,
    currencyCode: string,
    amount: number,
    sourceType: string = 'manual_addition',
    sourceId?: string,
    metadata: Record<string, any> = {}
  ): Promise<number> {
    if (amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    const response = await this.rpc<CurrencyRpcResponse>('add_currency_with_logging', {
      p_user_id: userId,
      p_currency_code: currencyCode,
      p_amount: amount,
      p_source_type: sourceType,
      p_source_id: sourceId || null,
      p_metadata: metadata,
    });

    if (!response.success) {
      throw new BusinessLogicError(response.message || 'Failed to add currency');
    }

    return response.data!.new_balance;
  }

  /**
   * Add currency with logging - returns full RPC response for EconomyService
   */
  async addCurrencyWithLogging(
    userId: string,
    currencyCode: string,
    amount: number,
    sourceType: string,
    sourceId: string | null,
    metadata: Record<string, any>
  ): Promise<CurrencyRpcResponse> {
    return this.rpc<CurrencyRpcResponse>('add_currency_with_logging', {
      p_user_id: userId,
      p_currency_code: currencyCode,
      p_amount: amount,
      p_source_type: sourceType,
      p_source_id: sourceId,
      p_metadata: metadata,
    });
  }

  // ============================================================================
  // Transaction Logging
  // ============================================================================

  /**
   * Log economy transaction manually (usually handled by RPC functions)
   */
  async logTransaction(transaction: EconomyTransactionData): Promise<void> {
    const { error } = await this.client
      .from('economytransactions')
      .insert({
        user_id: transaction.user_id,
        transaction_type: transaction.transaction_type === 'source' ? 'add' : 'deduct',
        currency: transaction.currency,
        amount: Math.abs(transaction.amount),
        balance_after: transaction.balance_after,
        source_type: transaction.source_type,
        source_id: transaction.source_id || null,
        metadata: transaction.metadata || null,
        created_at: new Date().toISOString(),
      });

    if (error) {
      throw this.mapError(error);
    }
  }

  /**
   * Get user's transaction history
   */
  async getTransactionHistory(userId: string, limit: number = 50): Promise<EconomyTransaction[]> {
    const { data, error } = await this.client
      .from('economytransactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw this.mapError(error);
    }

    return data || [];
  }

  /**
   * Get transactions by source type
   */
  async getTransactionsByType(userId: string, sourceType: string): Promise<EconomyTransaction[]> {
    const { data, error } = await this.client
      .from('economytransactions')
      .select('*')
      .eq('user_id', userId)
      .eq('source_type', sourceType)
      .order('created_at', { ascending: false });

    if (error) {
      throw this.mapError(error);
    }

    return data || [];
  }

  // ============================================================================
  // Player Progression
  // ============================================================================

  /**
   * Get player progression data
   */
  async getProgression(userId: string): Promise<PlayerProgression | null> {
    const { data, error } = await this.client
      .from('playerprogression')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.mapError(error);
    }

    return data;
  }

  /**
   * Update player progression
   */
  async updateProgression(userId: string, updateData: PlayerProgressionUpdate): Promise<void> {
    // Build the upsert object with user_id as the key
    const upsertData: PlayerProgressionInsert = {
      user_id: userId,
      updated_at: new Date().toISOString(),
      xp_to_next_level: updateData.xp_to_next_level ?? 0, // Required field - use 0 as default if not provided
      ...(updateData.xp !== undefined && { xp: updateData.xp }),
      ...(updateData.level !== undefined && { level: updateData.level }),
      ...(updateData.last_level_up_at !== undefined && { last_level_up_at: updateData.last_level_up_at })
    };

    const { error } = await this.client
      .from('playerprogression')
      .upsert(upsertData);

    if (error) {
      throw this.mapError(error);
    }
  }

  /**
   * Add XP with automatic level-up calculation
   * Uses RPC function for atomic level-up logic
   */
  async addXP(userId: string, xpAmount: number): Promise<{ newXP: number; newLevel: number; leveledUp: boolean }> {
    if (xpAmount <= 0) {
      throw new ValidationError('XP amount must be positive');
    }

    const response = await this.rpc<XpRpcResponse>('add_xp_and_level_up', {
      p_user_id: userId,
      p_xp_amount: xpAmount,
    });

    if (!response.success) {
      throw new BusinessLogicError(response.message || 'Failed to add XP');
    }

    const data = response.data!;
    return {
      newXP: data.new_xp,
      newLevel: data.new_level,
      leveledUp: data.leveled_up,
    };
  }

  // ============================================================================
  // Device Token Management
  // ============================================================================

  /**
   * Register device token for push notifications
   * Handles UNIQUE constraint gracefully
   */
  async registerDeviceToken(userId: string, platform: string, token: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('devicetokens')
        .upsert({
          user_id: userId,
          platform,
          token,
          is_active: true,
          last_seen_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });

      if (error) {
        throw this.mapError(error);
      }
    } catch (err: any) {
      // Handle duplicate token gracefully - update to new user
      if (err.message?.includes('unique constraint') || err.message?.includes('duplicate')) {
        await this.client
          .from('devicetokens')
          .update({
            user_id: userId,
            platform,
            is_active: true,
            last_seen_at: new Date().toISOString(),
          })
          .eq('token', token);
      } else {
        throw err;
      }
    }
  }

  /**
   * Get active device tokens for user
   */
  async getActiveDeviceTokens(userId: string): Promise<DeviceToken[]> {
    const baseQuery = this.client
      .from('devicetokens')
      .select('*')
      .order('last_seen_at', { ascending: false })
      .eq('user_id', userId);

    const { data, error } = await baseQuery;

    if (error) {
      throw this.mapError(error);
    }

    return data?.filter((token) => token.is_active) ?? [];
  }

  /**
   * Deactivate device token
   */
  async deactivateDeviceToken(token: string): Promise<void> {
    const { error } = await this.client
      .from('devicetokens')
      .update({ is_active: false })
      .eq('token', token);

    if (error) {
      throw this.mapError(error);
    }
  }

  // ============================================================================
  // Derived Stats (triggered by UserEquipment changes)
  // ============================================================================

  /**
   * Update vanity level (sum of equipped item levels)
   * Usually triggered by database triggers, but available for manual recalc
   */
  async updateVanityLevel(userId: string): Promise<number> {
    const equipmentQuery = this.client
      .from('userequipment')
      .select(`
        items!inner(level)
      `)
      .not('item_id', 'is', null);

    const { data, error } = await equipmentQuery.eq('user_id', userId);

    if (error) {
      throw this.mapError(error);
    }

    const vanityLevel = data?.reduce((sum, equipment) => {
      return sum + ((equipment as any).items?.level || 0);
    }, 0) || 0;

    await this.update(userId, { vanity_level: vanityLevel });
    return vanityLevel;
  }

  /**
   * Update average item level of equipped items
   * Usually triggered by database triggers, but available for manual recalc
   */
  async updateAvgItemLevel(userId: string): Promise<number> {
    const { data, error } = await this.client
      .from('userequipment')
      .select(`
        items!inner(level)
      `)
      .eq('user_id', userId)
      .not('item_id', 'is', null);

    if (error) {
      throw this.mapError(error);
    }

    let avgLevel = 0;
    if (data && data.length > 0) {
      const totalLevel = data.reduce((sum, equipment) => {
        return sum + ((equipment as any).items?.level || 0);
      }, 0);
      avgLevel = totalLevel / data.length;
    }

    await this.update(userId, { avg_item_level: avgLevel });
    return avgLevel;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Map Supabase errors to domain errors
   */
  private mapError(error: any): Error {
    // Use the inherited mapSupabaseError from BaseRepository
    const { mapSupabaseError } = require('../utils/errors.js');
    return mapSupabaseError(error);
  }
}
