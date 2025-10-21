import { UserProfile, NotImplementedError } from '../types/api.types';

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
  async initializeProfile(userId: string): Promise<UserProfile> {
    // TODO: Implement profile initialization workflow
    // 1. Check if profile already exists (prevent duplicates)
    // 2. Create UserProfile record with defaults:
    //    - username: auto-generated or from auth
    //    - gold: 1000 (starting amount)
    //    - vanity_level: 1
    //    - avg_item_level: 1
    // 3. Create initial starter items in inventory
    // 4. Return created profile
    throw new NotImplementedError('ProfileService.initializeProfile not implemented');
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
}

export const profileService = new ProfileService();