/**
 * PetService - Centralized pet management service
 *
 * Handles all pet-related business logic including:
 * - Pet creation and lifecycle management
 * - Personality assignment and custom naming
 * - Chatter history management with size limits
 * - Pet validation and ownership checks
 * - Integration with equipment system (pet slot)
 *
 * References:
 * - F-11 (Pet Personality & Chatter) from system design
 * - Cross-referenced by ItemService and ChatterService
 * - Uses PetRepository for data access
 */

import { PetRepository } from '../repositories/PetRepository.js';
import { EquipmentRepository } from '../repositories/EquipmentRepository.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import {
  NotFoundError,
  ValidationError,
  BusinessLogicError,
  PetNotFoundError,
  NoPetEquippedError,
  PersonalityNotFoundError,
  InvalidPersonalityError
} from '../utils/errors.js';
import type { Database } from '../types/database.types.js';

// Type aliases from database schema
type Pet = Database['public']['Tables']['pets']['Row'];
type PetPersonality = Database['public']['Tables']['petpersonalities']['Row'];
type Item = Database['public']['Tables']['items']['Row'];

// Enhanced types for API responses
export interface PetWithDetails {
  pet: Pet;
  item: Item & {
    itemType: {
      name: string;
      category: string;
    };
  };
  personality?: PetPersonality;
}

export interface ChatterMessage {
  text: string;
  timestamp: string;
  type?: 'user' | 'ai' | 'system';
}

export interface PetSummary {
  itemId: string;
  name: string;
  customName?: string;
  personalityType?: string;
  personalityDisplayName?: string;
  level: number;
  isEquipped: boolean;
  chatterMessageCount: number;
}

/**
 * Centralized service for pet management operations
 */
export class PetService {
  private petRepository: PetRepository;
  private equipmentRepository: EquipmentRepository;
  private itemRepository: ItemRepository;

  constructor() {
    this.petRepository = new PetRepository();
    this.equipmentRepository = new EquipmentRepository();
    this.itemRepository = new ItemRepository();
  }

  // ============================================================================
  // Pet Creation and Lifecycle Management
  // ============================================================================

  /**
   * Create a new pet record for a pet item
   * - Validates that the item is a pet category
   * - Creates pet record with default values
   * - Returns the created pet data
   *
   * @param itemId - Pet item ID (must reference item with category='pet')
   * @returns Created pet record
   * @throws ValidationError if item is not a pet
   * @throws BusinessLogicError on creation failure
   */
  async createPet(itemId: string): Promise<Pet> {
    if (!itemId || itemId.trim().length === 0) {
      throw new ValidationError('Item ID is required');
    }

    try {
      return await this.petRepository.createPet(itemId.trim());
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new BusinessLogicError(`Failed to create pet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pet by item ID with full details
   * - Fetches pet data with item and personality information
   * - Returns null if pet not found
   *
   * @param itemId - Pet item ID
   * @returns Pet with details or null
   * @throws BusinessLogicError on query failure
   */
  async getPetById(itemId: string): Promise<PetWithDetails | null> {
    if (!itemId || itemId.trim().length === 0) {
      throw new ValidationError('Item ID is required');
    }

    try {
      const petData = await this.petRepository.getPetWithDetails(itemId.trim());

      if (!petData) {
        return null;
      }

      return {
        pet: petData,
        item: petData.items,
        personality: petData.petpersonalities !== null && petData.petpersonalities !== undefined ? petData.petpersonalities : undefined
      };
    } catch (error) {
      throw new BusinessLogicError(`Failed to fetch pet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all pets for a user with summary information
   * - Returns list of user's pets with key details
   * - Includes equipment status for each pet
   *
   * @param userId - User ID
   * @returns Array of pet summaries
   * @throws BusinessLogicError on query failure
   */
  async getUserPets(userId: string): Promise<PetSummary[]> {
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    try {
      const pets = await this.petRepository.getUserPets(userId.trim());
      const equippedPet = await this.getEquippedPet(userId.trim());

      return pets.map(petData => {
        // Validate items exist and have a name
        if (!petData.items) {
          throw new ValidationError(`Missing item data for pet: ${JSON.stringify(petData)}`);
        }
        if (!petData.items.name) {
          throw new ValidationError(`Missing pet name in item data: ${JSON.stringify(petData.items)}`);
        }

        // Validate level exists and is a number
        if (petData.items.level === undefined || petData.items.level === null) {
          throw new ValidationError(`Missing or null level in item data: ${JSON.stringify(petData.items)}`);
        }
        if (typeof petData.items.level !== 'number') {
          throw new ValidationError(`Invalid level type in item data: ${typeof petData.items.level}`);
        }

        // Validate chatter history is an array
        const chatterMessageCount = Array.isArray(petData.chatter_history)
          ? petData.chatter_history.length
          : 0;

        // Validate equipped pet reference
        const isEquipped = equippedPet?.pet?.item_id === petData.item_id;

        const personalityData = petData.petpersonalities;

        return {
          itemId: petData.item_id,
          name: petData.items.name,
          customName: petData.custom_name !== null && petData.custom_name !== undefined
            ? petData.custom_name
            : undefined,
          personalityType: personalityData?.personality_type !== null && personalityData?.personality_type !== undefined
            ? personalityData.personality_type
            : undefined,
          personalityDisplayName: personalityData?.display_name !== null && personalityData?.display_name !== undefined
            ? personalityData.display_name
            : undefined,
          level: petData.items.level,
          isEquipped: isEquipped,
          chatterMessageCount: chatterMessageCount
        };
      });
    } catch (error) {
      throw new BusinessLogicError(`Failed to fetch user pets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a pet (when item is deleted)
   * - Validates ownership through item ownership
   * - Removes pet record (cascade deletion from items table)
   *
   * @param itemId - Pet item ID
   * @param userId - User ID for ownership validation
   * @throws NotFoundError if pet not found
   * @throws ValidationError if user doesn't own the pet
   * @throws BusinessLogicError on deletion failure
   */
  async deletePet(itemId: string, userId: string): Promise<void> {
    if (!itemId || itemId.trim().length === 0) {
      throw new ValidationError('Item ID is required');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    try {
      // Validate ownership through item
      const pet = await this.getPetById(itemId.trim());
      if (!pet) {
        throw new PetNotFoundError(`Pet with item ID ${itemId} not found`);
      }

      if (pet.item.user_id !== userId.trim()) {
        throw new ValidationError('User does not own this pet');
      }

      // Pet will be deleted automatically via CASCADE when item is deleted
      // This method is primarily for validation
    } catch (error) {
      if (error instanceof ValidationError || error instanceof PetNotFoundError) {
        throw error;
      }
      throw new BusinessLogicError(`Failed to delete pet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Personality Management
  // ============================================================================

  /**
   * Get all available pet personality types
   * - Returns list of personality templates
   * - Includes traits, verbosity, and example phrases
   *
   * @returns Array of personality types
   * @throws BusinessLogicError on query failure
   */
  async getPersonalityTypes(): Promise<PetPersonality[]> {
    try {
      return await this.petRepository.getAllPersonalities();
    } catch (error) {
      throw new BusinessLogicError(`Failed to fetch personality types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get personality by type
   * - Fetches specific personality template
   * - Returns null if not found
   *
   * @param personalityType - Personality type string
   * @returns Personality data or null
   * @throws BusinessLogicError on query failure
   */
  async getPersonalityByType(personalityType: string): Promise<PetPersonality | null> {
    if (!personalityType || personalityType.trim().length === 0) {
      throw new ValidationError('Personality type is required');
    }

    try {
      return await this.petRepository.findPersonalityByType(personalityType.trim());
    } catch (error) {
      throw new BusinessLogicError(`Failed to fetch personality: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Assign personality to pet with optional custom name
   * - Validates pet ownership
   * - Updates pet personality and custom name
   * - Validates custom name if provided
   *
   * @param itemId - Pet item ID
   * @param userId - User ID for ownership validation
   * @param personalityId - Personality template ID
   * @param customName - Optional custom name
   * @throws NotFoundError if pet or personality not found
   * @throws ValidationError if user doesn't own pet or invalid data
   * @throws BusinessLogicError on update failure
   */
  async assignPersonality(
    itemId: string,
    userId: string,
    personalityId: string,
    customName?: string
  ): Promise<void> {
    if (!itemId || itemId.trim().length === 0) {
      throw new ValidationError('Item ID is required');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }
    if (!personalityId || personalityId.trim().length === 0) {
      throw new ValidationError('Personality ID is required');
    }

    try {
      // Validate pet exists and user owns it
      const pet = await this.getPetById(itemId.trim());
      if (!pet) {
        throw new PetNotFoundError(`Pet with item ID ${itemId} not found`);
      }

      if (pet.item.user_id !== userId.trim()) {
        throw new ValidationError('User does not own this pet');
      }

      // Validate personality exists
      const personality = await this.petRepository.findPersonalityById(personalityId.trim());
      if (!personality) {
        throw new PersonalityNotFoundError(`Personality with ID ${personalityId} not found`);
      }

      // Update pet personality
      await this.petRepository.updatePetPersonality(
        itemId.trim(),
        personalityId.trim(),
        customName?.trim()
      );
    } catch (error) {
      if (error instanceof ValidationError || error instanceof PetNotFoundError || error instanceof PersonalityNotFoundError) {
        throw error;
      }
      throw new BusinessLogicError(`Failed to assign personality: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update pet custom name only
   * - Validates pet ownership
   * - Updates custom name with validation
   *
   * @param itemId - Pet item ID
   * @param userId - User ID for ownership validation
   * @param customName - New custom name
   * @throws NotFoundError if pet not found
   * @throws ValidationError if user doesn't own pet or invalid name
   * @throws BusinessLogicError on update failure
   */
  async updateCustomName(itemId: string, userId: string, customName: string): Promise<void> {
    if (!itemId || itemId.trim().length === 0) {
      throw new ValidationError('Item ID is required');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }
    if (!customName || customName.trim().length === 0) {
      throw new ValidationError('Custom name is required');
    }

    try {
      // Validate pet exists and user owns it
      const pet = await this.getPetById(itemId.trim());
      if (!pet) {
        throw new PetNotFoundError(`Pet with item ID ${itemId} not found`);
      }

      if (pet.item.user_id !== userId.trim()) {
        throw new ValidationError('User does not own this pet');
      }

      // Update custom name
      await this.petRepository.updateCustomName(itemId.trim(), customName.trim());
    } catch (error) {
      if (error instanceof ValidationError || error instanceof PetNotFoundError) {
        throw error;
      }
      throw new BusinessLogicError(`Failed to update custom name: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Chatter Management
  // ============================================================================

  /**
   * Add message to pet chatter history
   * - Validates pet ownership
   * - Adds message with automatic truncation
   * - Maintains size limits for performance
   *
   * @param itemId - Pet item ID
   * @param userId - User ID for ownership validation
   * @param message - Chatter message to add
   * @param maxMessages - Maximum messages to keep (default 50)
   * @throws NotFoundError if pet not found
   * @throws ValidationError if user doesn't own pet or invalid message
   * @throws BusinessLogicError on update failure
   */
  async addChatterMessage(
    itemId: string,
    userId: string,
    message: ChatterMessage,
    maxMessages: number = 50
  ): Promise<void> {
    if (!itemId || itemId.trim().length === 0) {
      throw new ValidationError('Item ID is required');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }
    if (!message || !message.text || message.text.trim().length === 0) {
      throw new ValidationError('Message text is required');
    }
    if (maxMessages <= 0 || maxMessages > 100) {
      throw new ValidationError('Max messages must be between 1 and 100');
    }

    try {
      // Validate pet exists and user owns it
      const pet = await this.getPetById(itemId.trim());
      if (!pet) {
        throw new PetNotFoundError(`Pet with item ID ${itemId} not found`);
      }

      if (pet.item.user_id !== userId.trim()) {
        throw new ValidationError('User does not own this pet');
      }

      // Add message with truncation
      const messageWithTimestamp = {
        ...message,
        text: message.text.trim(),
        timestamp: message.timestamp !== null && message.timestamp !== undefined ? message.timestamp : new Date().toISOString()
      };

      await this.petRepository.addChatterMessage(itemId.trim(), messageWithTimestamp, maxMessages);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof PetNotFoundError) {
        throw error;
      }
      throw new BusinessLogicError(`Failed to add chatter message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pet chatter history
   * - Validates pet ownership
   * - Returns chatter messages with optional limit
   *
   * @param itemId - Pet item ID
   * @param userId - User ID for ownership validation
   * @param limit - Maximum messages to return (default 50)
   * @returns Array of chatter messages
   * @throws NotFoundError if pet not found
   * @throws ValidationError if user doesn't own pet
   * @throws BusinessLogicError on query failure
   */
  async getChatterHistory(itemId: string, userId: string, limit: number = 50): Promise<ChatterMessage[]> {
    if (!itemId || itemId.trim().length === 0) {
      throw new ValidationError('Item ID is required');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }
    if (limit <= 0 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }

    try {
      // Validate pet exists and user owns it
      const pet = await this.getPetById(itemId.trim());
      if (!pet) {
        throw new PetNotFoundError(`Pet with item ID ${itemId} not found`);
      }

      if (pet.item.user_id !== userId.trim()) {
        throw new ValidationError('User does not own this pet');
      }

      // Get chatter history
      const history = Array.isArray(pet.pet.chatter_history)
        ? (pet.pet.chatter_history as unknown as ChatterMessage[])
        : [];

      // Return most recent messages up to limit
      return history.slice(-limit);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof PetNotFoundError) {
        throw error;
      }
      throw new BusinessLogicError(`Failed to fetch chatter history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear pet chatter history
   * - Validates pet ownership
   * - Removes all chatter messages
   *
   * @param itemId - Pet item ID
   * @param userId - User ID for ownership validation
   * @throws NotFoundError if pet not found
   * @throws ValidationError if user doesn't own pet
   * @throws BusinessLogicError on update failure
   */
  async clearChatterHistory(itemId: string, userId: string): Promise<void> {
    if (!itemId || itemId.trim().length === 0) {
      throw new ValidationError('Item ID is required');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    try {
      // Validate pet exists and user owns it
      const pet = await this.getPetById(itemId.trim());
      if (!pet) {
        throw new PetNotFoundError(`Pet with item ID ${itemId} not found`);
      }

      if (pet.item.user_id !== userId.trim()) {
        throw new ValidationError('User does not own this pet');
      }

      // Clear chatter history
      await this.petRepository.updateChatterHistory(itemId.trim(), null);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof PetNotFoundError) {
        throw error;
      }
      throw new BusinessLogicError(`Failed to clear chatter history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Equipment Integration
  // ============================================================================

  /**
   * Get currently equipped pet for user
   * - Fetches pet from equipment slot
   * - Returns null if no pet equipped
   *
   * @param userId - User ID
   * @returns Equipped pet with details or null
   * @throws BusinessLogicError on query failure
   */
  async getEquippedPet(userId: string): Promise<PetWithDetails | null> {
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    try {
      const equipment = await this.equipmentRepository.findEquippedByUser(userId.trim());

      if (!equipment.pet) {
        return null;
      }

      return await this.getPetById(equipment.pet.id);
    } catch (error) {
      throw new BusinessLogicError(`Failed to fetch equipped pet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate that user has a pet equipped for chatter generation
   * - Used by ChatterService to validate prerequisites
   * - Returns pet data if equipped
   *
   * @param userId - User ID
   * @returns Equipped pet data
   * @throws NoPetEquippedError if no pet equipped
   * @throws BusinessLogicError on query failure
   */
  async requireEquippedPet(userId: string): Promise<PetWithDetails> {
    const equippedPet = await this.getEquippedPet(userId);

    if (!equippedPet) {
      throw new NoPetEquippedError('Player has no pet equipped');
    }

    return equippedPet;
  }

  // ============================================================================
  // Validation and Utility Methods
  // ============================================================================

  /**
   * Validate that item is a pet category
   * - Checks item type category
   * - Used for creation validation
   *
   * @param itemId - Item ID to validate
   * @returns true if item is pet category
   * @throws BusinessLogicError on query failure
   */
  async validatePetItem(itemId: string): Promise<boolean> {
    if (!itemId || itemId.trim().length === 0) {
      throw new ValidationError('Item ID is required');
    }

    try {
      return await this.petRepository.validatePetItemCategory(itemId.trim());
    } catch (error) {
      throw new BusinessLogicError(`Failed to validate pet item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get personalities by verbosity level
   * - Filters personalities by verbosity setting
   * - Useful for UI filtering options
   *
   * @param verbosity - Verbosity level (e.g., 'low', 'medium', 'high')
   * @returns Array of matching personalities
   * @throws BusinessLogicError on query failure
   */
  async getPersonalitiesByVerbosity(verbosity: string): Promise<PetPersonality[]> {
    if (!verbosity || verbosity.trim().length === 0) {
      throw new ValidationError('Verbosity level is required');
    }

    try {
      return await this.petRepository.getPersonalitiesByVerbosity(verbosity.trim());
    } catch (error) {
      throw new BusinessLogicError(`Failed to fetch personalities by verbosity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pet statistics for user
   * - Returns aggregated pet data for dashboard
   *
   * @param userId - User ID
   * @returns Pet statistics
   * @throws BusinessLogicError on query failure
   */
  async getPetStatistics(userId: string): Promise<{
    totalPets: number;
    equippedPet: string | null;
    personalityTypes: string[];
    totalChatterMessages: number;
  }> {
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    try {
      const pets = await this.getUserPets(userId.trim());
      const equippedPet = await this.getEquippedPet(userId.trim());

      if (!equippedPet || !equippedPet.pet) {
        throw new NoPetEquippedError('No pet equipped for statistics calculation');
      }

      if (equippedPet.pet.custom_name === undefined || equippedPet.pet.custom_name === null) {
        throw new ValidationError(`Equipped pet has no custom name: ${JSON.stringify(equippedPet.pet)}`);
      }

      const personalityTypes = Array.from(new Set(pets.map(p => p.personalityType).filter(p => p !== undefined && p !== null)));
      if (personalityTypes.length === 0) {
        // This is not necessarily an error, but you might want to log it
        console.warn('No personality types found for pets');
      }

      return {
        totalPets: pets.length,
        equippedPet: equippedPet.pet.custom_name,
        personalityTypes: personalityTypes,
        totalChatterMessages: pets.reduce((sum, p) => sum + p.chatterMessageCount, 0)
      };
    } catch (error) {
      throw new BusinessLogicError(`Failed to fetch pet statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const petService = new PetService();