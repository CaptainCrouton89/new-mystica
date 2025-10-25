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

type Pet = Database['public']['Tables']['pets']['Row'];
type PetPersonality = Database['public']['Tables']['petpersonalities']['Row'];
type Item = Database['public']['Tables']['items']['Row'];

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

export class PetService {
  private petRepository: PetRepository;
  private equipmentRepository: EquipmentRepository;
  private itemRepository: ItemRepository;

  constructor() {
    this.petRepository = new PetRepository();
    this.equipmentRepository = new EquipmentRepository();
    this.itemRepository = new ItemRepository();
  }

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

  async getUserPets(userId: string): Promise<PetSummary[]> {
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    try {
      const pets = await this.petRepository.getUserPets(userId.trim());
      const equippedPet = await this.getEquippedPet(userId.trim());

      return pets.map(petData => {
        
        if (!petData.items) {
          throw new ValidationError(`Missing item data for pet: ${JSON.stringify(petData)}`);
        }
        if (!petData.items.name) {
          throw new ValidationError(`Missing pet name in item data: ${JSON.stringify(petData.items)}`);
        }

        if (petData.items.level === undefined || petData.items.level === null) {
          throw new ValidationError(`Missing or null level in item data: ${JSON.stringify(petData.items)}`);
        }
        if (typeof petData.items.level !== 'number') {
          throw new ValidationError(`Invalid level type in item data: ${typeof petData.items.level}`);
        }

        const chatterMessageCount = Array.isArray(petData.chatter_history)
          ? petData.chatter_history.length
          : 0;

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

  async deletePet(itemId: string, userId: string): Promise<void> {
    if (!itemId || itemId.trim().length === 0) {
      throw new ValidationError('Item ID is required');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    try {
      
      const pet = await this.getPetById(itemId.trim());
      if (!pet) {
        throw new PetNotFoundError(`Pet with item ID ${itemId} not found`);
      }

      if (pet.item.user_id !== userId.trim()) {
        throw new ValidationError('User does not own this pet');
      }

    } catch (error) {
      if (error instanceof ValidationError || error instanceof PetNotFoundError) {
        throw error;
      }
      throw new BusinessLogicError(`Failed to delete pet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPersonalityTypes(): Promise<PetPersonality[]> {
    try {
      return await this.petRepository.getAllPersonalities();
    } catch (error) {
      throw new BusinessLogicError(`Failed to fetch personality types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

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
      
      const pet = await this.getPetById(itemId.trim());
      if (!pet) {
        throw new PetNotFoundError(`Pet with item ID ${itemId} not found`);
      }

      if (pet.item.user_id !== userId.trim()) {
        throw new ValidationError('User does not own this pet');
      }

      const personality = await this.petRepository.findPersonalityById(personalityId.trim());
      if (!personality) {
        throw new PersonalityNotFoundError(`Personality with ID ${personalityId} not found`);
      }

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
      
      const pet = await this.getPetById(itemId.trim());
      if (!pet) {
        throw new PetNotFoundError(`Pet with item ID ${itemId} not found`);
      }

      if (pet.item.user_id !== userId.trim()) {
        throw new ValidationError('User does not own this pet');
      }

      await this.petRepository.updateCustomName(itemId.trim(), customName.trim());
    } catch (error) {
      if (error instanceof ValidationError || error instanceof PetNotFoundError) {
        throw error;
      }
      throw new BusinessLogicError(`Failed to update custom name: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

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
      
      const pet = await this.getPetById(itemId.trim());
      if (!pet) {
        throw new PetNotFoundError(`Pet with item ID ${itemId} not found`);
      }

      if (pet.item.user_id !== userId.trim()) {
        throw new ValidationError('User does not own this pet');
      }

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
      
      const pet = await this.getPetById(itemId.trim());
      if (!pet) {
        throw new PetNotFoundError(`Pet with item ID ${itemId} not found`);
      }

      if (pet.item.user_id !== userId.trim()) {
        throw new ValidationError('User does not own this pet');
      }

      const history = Array.isArray(pet.pet.chatter_history)
        ? (pet.pet.chatter_history as unknown as ChatterMessage[])
        : [];

      return history.slice(-limit);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof PetNotFoundError) {
        throw error;
      }
      throw new BusinessLogicError(`Failed to fetch chatter history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async clearChatterHistory(itemId: string, userId: string): Promise<void> {
    if (!itemId || itemId.trim().length === 0) {
      throw new ValidationError('Item ID is required');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    try {
      
      const pet = await this.getPetById(itemId.trim());
      if (!pet) {
        throw new PetNotFoundError(`Pet with item ID ${itemId} not found`);
      }

      if (pet.item.user_id !== userId.trim()) {
        throw new ValidationError('User does not own this pet');
      }

      await this.petRepository.updateChatterHistory(itemId.trim(), null);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof PetNotFoundError) {
        throw error;
      }
      throw new BusinessLogicError(`Failed to clear chatter history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

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

  async requireEquippedPet(userId: string): Promise<PetWithDetails> {
    const equippedPet = await this.getEquippedPet(userId);

    if (!equippedPet) {
      throw new NoPetEquippedError('Player has no pet equipped');
    }

    return equippedPet;
  }

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

export const petService = new PetService();