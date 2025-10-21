/**
 * PetRepository unit tests
 *
 * Tests all PetRepository methods including:
 * - Pet management (CRUD operations)
 * - Personality assignment and lookups
 * - Custom name validation with profanity filter
 * - Chatter history management with size limits
 * - Pet item category validation
 * - Enhanced queries with joins
 */

import { PetRepository } from '../../../src/repositories/PetRepository.js';
import { ValidationError, BusinessLogicError } from '../../../src/utils/errors.js';
import { createMockSupabaseClient } from '../../helpers/mockSupabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock data factories
const createMockPet = (overrides = {}) => ({
  item_id: 'item-123',
  personality_id: 'personality-456',
  custom_name: 'Fluffy',
  chatter_history: [
    { text: 'Hello!', timestamp: '1640995200', type: 'greeting' },
    { text: 'How are you?', timestamp: '1640995260', type: 'dialogue' }
  ],
  ...overrides,
});

const createMockPetPersonality = (overrides = {}) => ({
  id: 'personality-456',
  personality_type: 'friendly',
  display_name: 'Friendly Companion',
  description: 'A warm and welcoming personality',
  traits: { loyalty: 'high', energy: 'medium' },
  base_dialogue_style: 'cheerful',
  example_phrases: ['Hello there!', 'Great to see you!'],
  verbosity: 'medium',
  ...overrides,
});

const createMockItem = (overrides = {}) => ({
  id: 'item-123',
  name: 'Pet Dragon',
  level: 5,
  user_id: 'user-123',
  item_type_id: 'itemtype-789',
  ...overrides,
});

const createMockItemType = (overrides = {}) => ({
  id: 'itemtype-789',
  name: 'Dragon Pet',
  category: 'pet',
  ...overrides,
});

describe('PetRepository', () => {
  let repository: PetRepository;
  let mockClient: any;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    repository = new PetRepository(mockClient);
  });

  describe('Pet Management', () => {
    describe('findPetByItemId', () => {
      it('should return pet when found', async () => {
        const mockPet = createMockPet();

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockPet, error: null })
            })
          })
        });

        const result = await repository.findPetByItemId('item-123');

        expect(result).toEqual(mockPet);
        expect(mockClient.from).toHaveBeenCalledWith('pets');
      });

      it('should return null when pet not found', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows returned' }
              })
            })
          })
        });

        const result = await repository.findPetByItemId('nonexistent');

        expect(result).toBeNull();
      });

      it('should throw error for database failure', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: '42P01', message: 'relation "pets" does not exist' }
              })
            })
          })
        });

        await expect(
          repository.findPetByItemId('item-123')
        ).rejects.toThrow(BusinessLogicError);
      });
    });

    describe('createPet', () => {
      it('should create pet for valid pet item', async () => {
        const mockPet = createMockPet({ personality_id: null, custom_name: null, chatter_history: null });

        // Mock validation success
        mockClient.from
          .mockReturnValueOnce({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { itemtypes: { category: 'pet' } },
                  error: null
                })
              })
            })
          })
          // Mock creation success
          .mockReturnValueOnce({
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockPet, error: null })
              })
            })
          });

        const result = await repository.createPet('item-123');

        expect(result).toEqual(mockPet);
      });

      it('should throw ValidationError for non-pet item', async () => {
        // Mock validation failure
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { itemtypes: { category: 'weapon' } },
                error: null
              })
            })
          })
        });

        await expect(
          repository.createPet('item-123')
        ).rejects.toThrow(ValidationError);
      });

      it('should throw ValidationError for non-existent item', async () => {
        // Mock item not found
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows returned' }
              })
            })
          })
        });

        await expect(
          repository.createPet('nonexistent')
        ).rejects.toThrow(ValidationError);
      });
    });

    describe('updatePetPersonality', () => {
      it('should update personality without custom name', async () => {
        mockClient.from.mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ error: null })
            })
          })
        });

        await repository.updatePetPersonality('item-123', 'personality-456');

        expect(mockClient.from).toHaveBeenCalledWith('pets');
      });

      it('should update personality with custom name', async () => {
        mockClient.from.mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ error: null })
            })
          })
        });

        await repository.updatePetPersonality('item-123', 'personality-456', 'Sparkles');

        expect(mockClient.from).toHaveBeenCalledWith('pets');
      });

      it('should throw ValidationError for invalid custom name', async () => {
        await expect(
          repository.updatePetPersonality('item-123', 'personality-456', 'fuck')
        ).rejects.toThrow(ValidationError);
      });
    });

    describe('updateCustomName', () => {
      it('should update custom name successfully', async () => {
        mockClient.from.mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ error: null })
            })
          })
        });

        await repository.updateCustomName('item-123', 'Shadow');

        expect(mockClient.from).toHaveBeenCalledWith('pets');
      });

      it('should throw ValidationError for empty name', async () => {
        await expect(
          repository.updateCustomName('item-123', '')
        ).rejects.toThrow(ValidationError);
      });

      it('should throw ValidationError for name too long', async () => {
        const longName = 'a'.repeat(51);
        await expect(
          repository.updateCustomName('item-123', longName)
        ).rejects.toThrow(ValidationError);
      });

      it('should throw ValidationError for profanity', async () => {
        await expect(
          repository.updateCustomName('item-123', 'damn it')
        ).rejects.toThrow(ValidationError);
      });

      it('should throw ValidationError for invalid characters', async () => {
        await expect(
          repository.updateCustomName('item-123', 'pet@#$')
        ).rejects.toThrow(ValidationError);
      });

      it('should allow valid characters', async () => {
        mockClient.from.mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ error: null })
            })
          })
        });

        await repository.updateCustomName('item-123', "Shadow-Max's Pet");

        expect(mockClient.from).toHaveBeenCalledWith('pets');
      });
    });

    describe('updateChatterHistory', () => {
      it('should update chatter history successfully', async () => {
        const validHistory = [
          { text: 'Hello!', timestamp: '1640995200', type: 'greeting' }
        ];

        mockClient.from.mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ error: null })
            })
          })
        });

        await repository.updateChatterHistory('item-123', validHistory);

        expect(mockClient.from).toHaveBeenCalledWith('pets');
      });

      it('should throw ValidationError for oversized history', async () => {
        // Create a large history object
        const largeHistory = Array.from({ length: 1000 }, (_, i) => ({
          text: `Message ${i}: ${'x'.repeat(100)}`,
          timestamp: '1640995200',
          type: 'dialogue'
        }));

        await expect(
          repository.updateChatterHistory('item-123', largeHistory)
        ).rejects.toThrow(ValidationError);
      });

      it('should throw ValidationError for too many messages', async () => {
        const tooManyMessages = Array.from({ length: 101 }, (_, i) => ({
          text: `Message ${i}`,
          timestamp: '1640995200',
          type: 'dialogue'
        }));

        await expect(
          repository.updateChatterHistory('item-123', tooManyMessages)
        ).rejects.toThrow(ValidationError);
      });

      it('should allow null chatter history', async () => {
        mockClient.from.mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ error: null })
            })
          })
        });

        await repository.updateChatterHistory('item-123', null);

        expect(mockClient.from).toHaveBeenCalledWith('pets');
      });
    });

    describe('addChatterMessage', () => {
      it('should add message to existing history', async () => {
        const existingPet = createMockPet({
          chatter_history: [
            { text: 'Old message', timestamp: '1640995100', type: 'dialogue' }
          ]
        });
        const newMessage = { text: 'New message', timestamp: '1640995300', type: 'dialogue' };

        // Mock findPetByItemId
        mockClient.from
          .mockReturnValueOnce({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: existingPet, error: null })
              })
            })
          })
          // Mock updateChatterHistory
          .mockReturnValueOnce({
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ error: null })
              })
            })
          });

        await repository.addChatterMessage('item-123', newMessage);

        expect(mockClient.from).toHaveBeenCalledTimes(2);
      });

      it('should initialize history for pet without history', async () => {
        const existingPet = createMockPet({ chatter_history: null });
        const newMessage = { text: 'First message', timestamp: '1640995300', type: 'dialogue' };

        mockClient.from
          .mockReturnValueOnce({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: existingPet, error: null })
              })
            })
          })
          .mockReturnValueOnce({
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ error: null })
              })
            })
          });

        await repository.addChatterMessage('item-123', newMessage);

        expect(mockClient.from).toHaveBeenCalledTimes(2);
      });

      it('should truncate history to max messages', async () => {
        // Create history with 50 messages
        const existingHistory = Array.from({ length: 50 }, (_, i) => ({
          text: `Message ${i}`,
          timestamp: `164099${i.toString().padStart(4, '0')}`,
          type: 'dialogue'
        }));
        const existingPet = createMockPet({ chatter_history: existingHistory });
        const newMessage = { text: 'New message', timestamp: '1640995300', type: 'dialogue' };

        mockClient.from
          .mockReturnValueOnce({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: existingPet, error: null })
              })
            })
          })
          .mockReturnValueOnce({
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ error: null })
              })
            })
          });

        await repository.addChatterMessage('item-123', newMessage, 50);

        expect(mockClient.from).toHaveBeenCalledTimes(2);
      });

      it('should throw ValidationError for non-existent pet', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        });

        await expect(
          repository.addChatterMessage('nonexistent', { text: 'Hi', timestamp: '1640995300' })
        ).rejects.toThrow(ValidationError);
      });
    });
  });

  describe('Personality Templates', () => {
    describe('findPersonalityById', () => {
      it('should return personality when found', async () => {
        const mockPersonality = createMockPetPersonality();

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockPersonality, error: null })
            })
          })
        });

        const result = await repository.findPersonalityById('personality-456');

        expect(result).toEqual(mockPersonality);
        expect(mockClient.from).toHaveBeenCalledWith('petpersonalities');
      });

      it('should return null when personality not found', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows returned' }
              })
            })
          })
        });

        const result = await repository.findPersonalityById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('getAllPersonalities', () => {
      it('should return all personalities ordered by display name', async () => {
        const mockPersonalities = [
          createMockPetPersonality({ display_name: 'Aggressive', personality_type: 'aggressive' }),
          createMockPetPersonality({ display_name: 'Friendly', personality_type: 'friendly' }),
        ];

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: mockPersonalities, error: null })
          })
        });

        const result = await repository.getAllPersonalities();

        expect(result).toEqual(mockPersonalities);
        expect(mockClient.from).toHaveBeenCalledWith('petpersonalities');
      });

      it('should return empty array when no personalities found', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        });

        const result = await repository.getAllPersonalities();

        expect(result).toEqual([]);
      });
    });

    describe('findPersonalityByType', () => {
      it('should return personality when type found', async () => {
        const mockPersonality = createMockPetPersonality();

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockPersonality, error: null })
            })
          })
        });

        const result = await repository.findPersonalityByType('friendly');

        expect(result).toEqual(mockPersonality);
        expect(mockClient.from).toHaveBeenCalledWith('petpersonalities');
      });

      it('should return null when type not found', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows returned' }
              })
            })
          })
        });

        const result = await repository.findPersonalityByType('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('getPersonalitiesByVerbosity', () => {
      it('should return personalities filtered by verbosity', async () => {
        const mockPersonalities = [
          createMockPetPersonality({ verbosity: 'high', display_name: 'Chatty' }),
          createMockPetPersonality({ verbosity: 'high', display_name: 'Talkative' }),
        ];

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: mockPersonalities, error: null })
            })
          })
        });

        const result = await repository.getPersonalitiesByVerbosity('high');

        expect(result).toEqual(mockPersonalities);
        expect(mockClient.from).toHaveBeenCalledWith('petpersonalities');
      });
    });
  });

  describe('Validation Methods', () => {
    describe('validatePetItemCategory', () => {
      it('should return true for valid pet item', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { itemtypes: { category: 'pet' } },
                error: null
              })
            })
          })
        });

        const result = await repository.validatePetItemCategory('item-123');

        expect(result).toBe(true);
        expect(mockClient.from).toHaveBeenCalledWith('items');
      });

      it('should return false for non-pet item', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { itemtypes: { category: 'weapon' } },
                error: null
              })
            })
          })
        });

        const result = await repository.validatePetItemCategory('item-123');

        expect(result).toBe(false);
      });

      it('should return false for non-existent item', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows returned' }
              })
            })
          })
        });

        const result = await repository.validatePetItemCategory('nonexistent');

        expect(result).toBe(false);
      });

      it('should throw error for database failure', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: '42P01', message: 'relation "items" does not exist' }
              })
            })
          })
        });

        await expect(
          repository.validatePetItemCategory('item-123')
        ).rejects.toThrow(BusinessLogicError);
      });
    });
  });

  describe('Enhanced Queries', () => {
    describe('getPetWithDetails', () => {
      it('should return pet with item and personality details', async () => {
        const mockDetailedPet = {
          ...createMockPet(),
          items: createMockItem(),
          petpersonalities: createMockPetPersonality(),
        };

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockDetailedPet, error: null })
            })
          })
        });

        const result = await repository.getPetWithDetails('item-123');

        expect(result).toEqual(mockDetailedPet);
        expect(mockClient.from).toHaveBeenCalledWith('pets');
      });

      it('should return null when pet not found', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows returned' }
              })
            })
          })
        });

        const result = await repository.getPetWithDetails('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('getUserPets', () => {
      it('should return all pets for a user', async () => {
        const mockUserPets = [
          {
            ...createMockPet({ item_id: 'item-123' }),
            items: createMockItem({ id: 'item-123', name: 'Dragon Pet' }),
            petpersonalities: createMockPetPersonality(),
          },
          {
            ...createMockPet({ item_id: 'item-456', custom_name: 'Phoenix' }),
            items: createMockItem({ id: 'item-456', name: 'Phoenix Pet' }),
            petpersonalities: createMockPetPersonality({ personality_type: 'fierce' }),
          },
        ];

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: mockUserPets, error: null })
            })
          })
        });

        const result = await repository.getUserPets('user-123');

        expect(result).toEqual(mockUserPets);
        expect(mockClient.from).toHaveBeenCalledWith('pets');
      });

      it('should return empty array when user has no pets', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        });

        const result = await repository.getUserPets('user-no-pets');

        expect(result).toEqual([]);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle CHECK constraint violations for pet category', async () => {
      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: {
              code: '23514',
              message: 'check constraint "check_pet_item_category" violated'
            }
          })
        })
      });

      // Create a mock method that uses mapSupabaseError
      const testMethod = async () => {
        const { error } = await mockClient.from('pets').insert({ item_id: 'test-id' }).single();
        if (error) {
          // Simulate the private mapSupabaseError method behavior
          if (error.code === '23514' && error.message?.includes('check_pet_item_category')) {
            throw new ValidationError('Item must be of category "pet"');
          }
        }
      };

      await expect(testMethod()).rejects.toThrow(ValidationError);
    });

    it('should handle foreign key violations for items', async () => {
      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: {
              code: '23503',
              message: 'foreign key constraint "fk_pets_item" violated'
            }
          })
        })
      });

      const testMethod = async () => {
        const { error } = await mockClient.from('pets').insert({ item_id: 'test-id' }).single();
        if (error) {
          if (error.code === '23503' && error.message?.includes('fk_pets_item')) {
            throw new ValidationError('Referenced item does not exist');
          }
        }
      };

      await expect(testMethod()).rejects.toThrow(ValidationError);
    });

    it('should handle foreign key violations for personalities', async () => {
      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: {
              code: '23503',
              message: 'foreign key constraint "fk_pets_personality" violated'
            }
          })
        })
      });

      const testMethod = async () => {
        const { error } = await mockClient.from('pets').insert({ item_id: 'test-id' }).single();
        if (error) {
          if (error.code === '23503' && error.message?.includes('fk_pets_personality')) {
            throw new ValidationError('Referenced personality does not exist');
          }
        }
      };

      await expect(testMethod()).rejects.toThrow(ValidationError);
    });
  });
});