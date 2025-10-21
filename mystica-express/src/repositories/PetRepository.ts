/**
 * PetRepository
 *
 * Handles pet-related data operations including:
 * - Pet item extensions (items where category='pet')
 * - Pet personality assignment
 * - Custom pet naming with validation
 * - Chatter history management with size limits
 * - Personality template lookups
 */

import { BaseRepository } from './BaseRepository.js';
import { Database } from '../types/database.types.js';
import { ValidationError, BusinessLogicError } from '../utils/errors.js';

// Type aliases for cleaner code
type Pet = Database['public']['Tables']['pets']['Row'];
type PetInsert = Database['public']['Tables']['pets']['Insert'];
type PetUpdate = Database['public']['Tables']['pets']['Update'];
type PetPersonality = Database['public']['Tables']['petpersonalities']['Row'];

export class PetRepository extends BaseRepository<Pet> {
  constructor() {
    super('pets');
  }

  // ================================
  // Pet Management
  // ================================

  /**
   * Find pet by item ID
   *
   * @param itemId - Pet item ID
   * @returns Pet data or null if not found
   * @throws DatabaseError on query failure
   */
  async findPetByItemId(itemId: string): Promise<Pet | null> {
    const { data, error } = await this.client
      .from('pets')
      .select('*')
      .eq('item_id', itemId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.mapSupabaseError(error);
    }

    return data;
  }

  /**
   * Create pet record for pet item
   *
   * @param itemId - Pet item ID (must reference item with category='pet')
   * @returns Created pet record
   * @throws ValidationError if item is not a pet
   * @throws DatabaseError on creation failure
   */
  async createPet(itemId: string): Promise<Pet> {
    // Validate that item is a pet before creating
    const isValidPet = await this.validatePetItemCategory(itemId);
    if (!isValidPet) {
      throw new ValidationError('Item is not a pet category item');
    }

    const petData: PetInsert = {
      item_id: itemId,
      personality_id: null,
      custom_name: null,
      chatter_history: null,
    };

    return this.create(petData);
  }

  /**
   * Update pet personality and optionally custom name
   *
   * @param itemId - Pet item ID
   * @param personalityId - Personality template ID
   * @param customName - Optional custom name
   * @throws ValidationError if custom name is invalid
   * @throws DatabaseError on update failure
   */
  async updatePetPersonality(
    itemId: string,
    personalityId: string,
    customName?: string
  ): Promise<void> {
    // Validate custom name if provided
    if (customName !== undefined) {
      this.validateCustomName(customName);
    }

    const updateData: PetUpdate = {
      personality_id: personalityId,
    };

    if (customName !== undefined) {
      updateData.custom_name = customName;
    }

    const { error } = await this.client
      .from('pets')
      .update(updateData)
      .eq('item_id', itemId);

    if (error) {
      throw this.mapSupabaseError(error);
    }
  }

  /**
   * Update pet custom name
   *
   * @param itemId - Pet item ID
   * @param customName - New custom name
   * @throws ValidationError if name is invalid
   * @throws DatabaseError on update failure
   */
  async updateCustomName(itemId: string, customName: string): Promise<void> {
    this.validateCustomName(customName);

    const { error } = await this.client
      .from('pets')
      .update({ custom_name: customName })
      .eq('item_id', itemId);

    if (error) {
      throw this.mapSupabaseError(error);
    }
  }

  /**
   * Update pet chatter history with size limit enforcement
   *
   * @param itemId - Pet item ID
   * @param chatterHistory - Updated chatter history
   * @throws ValidationError if history exceeds size limits
   * @throws DatabaseError on update failure
   */
  async updateChatterHistory(itemId: string, chatterHistory: any): Promise<void> {
    // Validate chatter history size to prevent bloat
    this.validateChatterHistory(chatterHistory);

    const { error } = await this.client
      .from('pets')
      .update({ chatter_history: chatterHistory })
      .eq('item_id', itemId);

    if (error) {
      throw this.mapSupabaseError(error);
    }
  }

  /**
   * Add message to pet chatter history with automatic truncation
   *
   * @param itemId - Pet item ID
   * @param message - New message to add
   * @param maxMessages - Maximum messages to keep (default 50)
   * @throws DatabaseError on update failure
   */
  async addChatterMessage(
    itemId: string,
    message: { text: string; timestamp: string; type?: string },
    maxMessages: number = 50
  ): Promise<void> {
    const pet = await this.findPetByItemId(itemId);
    if (!pet) {
      throw new ValidationError('Pet not found');
    }

    // Get existing history or initialize empty array
    const history = (pet.chatter_history as any[]) || [];

    // Add new message
    history.push(message);

    // Keep only the most recent messages
    const truncatedHistory = history.slice(-maxMessages);

    await this.updateChatterHistory(itemId, truncatedHistory);
  }

  // ================================
  // Personality Templates
  // ================================

  /**
   * Find personality by ID
   *
   * @param personalityId - Personality template ID
   * @returns Personality data or null if not found
   * @throws DatabaseError on query failure
   */
  async findPersonalityById(personalityId: string): Promise<PetPersonality | null> {
    const { data, error } = await this.client
      .from('petpersonalities')
      .select('*')
      .eq('id', personalityId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.mapSupabaseError(error);
    }

    return data;
  }

  /**
   * Get all available personality templates
   *
   * @returns Array of all personality templates
   * @throws DatabaseError on query failure
   */
  async getAllPersonalities(): Promise<PetPersonality[]> {
    const { data, error } = await this.client
      .from('petpersonalities')
      .select('*')
      .order('display_name', { ascending: true });

    if (error) {
      throw this.mapSupabaseError(error);
    }

    return data || [];
  }

  /**
   * Find personality by type
   *
   * @param personalityType - Personality type string
   * @returns Personality data or null if not found
   * @throws DatabaseError on query failure
   */
  async findPersonalityByType(personalityType: string): Promise<PetPersonality | null> {
    const { data, error } = await this.client
      .from('petpersonalities')
      .select('*')
      .eq('personality_type', personalityType)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.mapSupabaseError(error);
    }

    return data;
  }

  /**
   * Get personalities by verbosity level
   *
   * @param verbosity - Verbosity level (e.g., 'low', 'medium', 'high')
   * @returns Array of matching personalities
   * @throws DatabaseError on query failure
   */
  async getPersonalitiesByVerbosity(verbosity: string): Promise<PetPersonality[]> {
    const { data, error } = await this.client
      .from('petpersonalities')
      .select('*')
      .eq('verbosity', verbosity)
      .order('display_name', { ascending: true });

    if (error) {
      throw this.mapSupabaseError(error);
    }

    return data || [];
  }

  // ================================
  // Validation Methods
  // ================================

  /**
   * Validate that item category is 'pet'
   *
   * @param itemId - Item ID to validate
   * @returns true if item is pet category, false otherwise
   * @throws DatabaseError on query failure
   */
  async validatePetItemCategory(itemId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('items')
      .select(`
        itemtypes (
          category
        )
      `)
      .eq('id', itemId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return false; // Item not found
      }
      throw this.mapSupabaseError(error);
    }

    return (data as any)?.itemtypes?.category === 'pet';
  }

  /**
   * Get pet with item and personality details
   *
   * @param itemId - Pet item ID
   * @returns Enhanced pet data with related information
   * @throws DatabaseError on query failure
   */
  async getPetWithDetails(itemId: string): Promise<any> {
    const { data, error } = await this.client
      .from('pets')
      .select(`
        *,
        items (
          id,
          name,
          level,
          itemtypes (
            name,
            category
          )
        ),
        petpersonalities (
          id,
          personality_type,
          display_name,
          description,
          verbosity
        )
      `)
      .eq('item_id', itemId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.mapSupabaseError(error);
    }

    return data;
  }

  /**
   * Get all pets for a user
   *
   * @param userId - User ID
   * @returns Array of user's pets with details
   * @throws DatabaseError on query failure
   */
  async getUserPets(userId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('pets')
      .select(`
        *,
        items!inner (
          id,
          name,
          level,
          user_id,
          itemtypes (
            name,
            category
          )
        ),
        petpersonalities (
          id,
          personality_type,
          display_name,
          description
        )
      `)
      .eq('items.user_id', userId)
      .order('items.name', { ascending: true });

    if (error) {
      throw this.mapSupabaseError(error);
    }

    return data || [];
  }

  // ================================
  // Private Validation Helpers
  // ================================

  /**
   * Validate custom pet name
   *
   * @param customName - Name to validate
   * @throws ValidationError if name is invalid
   */
  private validateCustomName(customName: string): void {
    if (!customName || customName.trim().length === 0) {
      throw new ValidationError('Custom name cannot be empty');
    }

    if (customName.length > 50) {
      throw new ValidationError('Custom name cannot exceed 50 characters');
    }

    // Basic profanity filter - can be enhanced with external service
    const profanityPattern = /\b(fuck|shit|damn|hell|ass|bitch)\b/i;
    if (profanityPattern.test(customName)) {
      throw new ValidationError('Custom name contains inappropriate language');
    }

    // Check for special characters (allow only letters, numbers, spaces, hyphens, apostrophes)
    const allowedPattern = /^[a-zA-Z0-9\s\-']+$/;
    if (!allowedPattern.test(customName)) {
      throw new ValidationError('Custom name contains invalid characters');
    }
  }

  /**
   * Validate chatter history size to prevent database bloat
   *
   * @param chatterHistory - History to validate
   * @throws ValidationError if history exceeds limits
   */
  private validateChatterHistory(chatterHistory: any): void {
    if (!chatterHistory) {
      return; // null/undefined is valid
    }

    // Convert to JSON string to check size
    const jsonString = JSON.stringify(chatterHistory);
    const sizeInBytes = Buffer.byteLength(jsonString, 'utf8');

    // Limit chatter history to 50KB
    const maxSizeBytes = 50 * 1024;
    if (sizeInBytes > maxSizeBytes) {
      throw new ValidationError(`Chatter history too large: ${sizeInBytes} bytes (max: ${maxSizeBytes})`);
    }

    // If it's an array, limit number of messages
    if (Array.isArray(chatterHistory)) {
      const maxMessages = 100;
      if (chatterHistory.length > maxMessages) {
        throw new ValidationError(`Too many chatter messages: ${chatterHistory.length} (max: ${maxMessages})`);
      }
    }
  }

  /**
   * Map Supabase error to domain error
   *
   * @param error - Supabase error
   * @returns Appropriate domain error
   */
  private mapSupabaseError(error: any): Error {
    // Check for CHECK constraint violation (pet item category)
    if (error.code === '23514' && error.message?.includes('check_pet_item_category')) {
      return new ValidationError('Item must be of category "pet"');
    }

    // Check for foreign key violations
    if (error.code === '23503') {
      if (error.message?.includes('fk_pets_item')) {
        return new ValidationError('Referenced item does not exist');
      }
      if (error.message?.includes('fk_pets_personality')) {
        return new ValidationError('Referenced personality does not exist');
      }
    }

    // Default to business logic error for other database errors
    return new BusinessLogicError(`Database operation failed: ${error.message}`);
  }
}