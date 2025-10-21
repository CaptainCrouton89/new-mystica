import { UserProfile } from '../types/api.types';
import { NotImplementedError, mapSupabaseError, ConflictError, NotFoundError, DatabaseError } from '../utils/errors';
import { supabase } from '../config/supabase';

/**
 * Handles user profile management and initialization
 */
export class ProfileService {
  /**
   * Initialize a new player profile with default values
   * - Creates UserProfile record with starting gold and level
   * - Sets up initial inventory state
   * - Validates user_id uniqueness
   */
  async initializeProfile(userId: string, email: string): Promise<UserProfile> {
    try {
      // Call the stored procedure for atomic profile initialization
      const { data, error } = await supabase
        .rpc('init_profile', {
          p_user_id: userId,
          p_email: email
        })
        .single();

      if (error) {
        // Map specific SQL exceptions to appropriate error types
        if (error.message?.includes('conflict:already_initialized')) {
          throw new ConflictError('Profile already initialized for this user');
        }
        if (error.message?.includes('not_found:common_weapon_missing')) {
          throw new NotFoundError('No common weapons available for profile initialization');
        }
        throw mapSupabaseError(error);
      }

      if (!data) {
        throw new DatabaseError('Failed to create profile - no data returned');
      }

      // Transform database row to UserProfile format
      // Note: gold comes from UserCurrencyBalances, not the users table
      const userProfile: UserProfile = {
        id: data.id,
        user_id: data.id, // In our schema, user ID is the primary key
        username: data.username || '', // Username starts null, empty string for API
        gold: 0, // Starting gold is 0 as per requirements
        vanity_level: data.vanity_level,
        avg_item_level: data.avg_item_level,
        created_at: data.created_at,
        updated_at: data.updated_at
      };

      return userProfile;
    } catch (error) {
      // Re-throw AppErrors as-is, map others
      if (error instanceof ConflictError || error instanceof NotFoundError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Get user profile by user ID
   * - Fetches complete profile data
   * - Includes computed stats (avg_item_level, etc.)
   */
  async getProfile(userId: string): Promise<UserProfile> {
    // TODO: Implement profile retrieval
    // 1. Query UserProfile table by user_id
    // 2. Return profile data
    // 3. Throw NotFoundError if user doesn't exist
    throw new NotImplementedError('ProfileService.getProfile not implemented');
  }

  /**
   * Update user vanity level based on equipped item levels
   * - Calculates sum of all equipped item levels
   * - Updates Users.vanity_level field
   */
  async updateVanityLevel(userId: string): Promise<void> {
    try {
      // Calculate total level of all equipped items
      const { data: equipmentLevels, error: equipmentError } = await supabase
        .from('UserEquipment')
        .select(`
          Items!inner(
            level
          )
        `)
        .eq('user_id', userId)
        .not('item_id', 'is', null);

      if (equipmentError) {
        throw mapSupabaseError(equipmentError);
      }

      // Sum all equipped item levels
      const totalLevel = equipmentLevels?.reduce((sum, equipment) => {
        return sum + (equipment.Items as any)?.level || 0;
      }, 0) || 0;

      // Update user's vanity level
      const { error: updateError } = await supabase
        .from('Users')
        .update({ vanity_level: totalLevel })
        .eq('id', userId);

      if (updateError) {
        throw mapSupabaseError(updateError);
      }
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }
}

export const profileService = new ProfileService();