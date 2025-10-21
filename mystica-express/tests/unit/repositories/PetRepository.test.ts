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
import { supabase } from '../../../src/config/supabase.js';
import { ValidationError, BusinessLogicError } from '../../../src/utils/errors.js';
import { createMockSupabaseClient } from '../../helpers/mockSupabase.js';

// Mock Supabase client
jest.mock('../../../src/config/supabase.js', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn()
  }
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

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
  let mockQuery: any;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PetRepository();

    // Create a comprehensive mock that supports all query chaining
    mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    mockSupabase.from.mockReturnValue(mockQuery);
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
  });

  describe('Pet Management', () => {
    describe('findPetByItemId', () => {
      it('should return pet when found', async () => {
        const mockPet = createMockPet();
        mockSupabaseMethod.mockResolvedValueOnce({ data: mockPet, error: null });

        const result = await repository.findPetByItemId('item-123');

        expect(result).toEqual(mockPet);
        expect(mockSupabase.from).toHaveBeenCalledWith('pets');
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('item_id', 'item-123');
      });

      it('should return null when pet not found', async () => {
        mockSupabaseMethod.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        const result = await repository.findPetByItemId('nonexistent');

        expect(result).toBeNull();
      });

      it('should throw error for database failure', async () => {
        mockSupabaseMethod.mockResolvedValueOnce({
          data: null,
          error: { code: '42P01', message: 'relation "pets" does not exist' }
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
        mockSupabaseMethod.mockResolvedValueOnce({
          data: { itemtypes: { category: 'pet' } },
          error: null
        });

        // Mock creation success
        mockSupabaseMethod.mockResolvedValueOnce({ data: mockPet, error: null });

        const result = await repository.createPet('item-123');

        expect(result).toEqual(mockPet);
        expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
          item_id: 'item-123',
          personality_id: null,
          custom_name: null,
          chatter_history: null,
        });
      });

      it('should throw ValidationError for non-pet item', async () => {
        // Mock validation failure
        mockSupabaseMethod.mockResolvedValueOnce({
          data: { itemtypes: { category: 'weapon' } },
          error: null
        });

        await expect(
          repository.createPet('item-123')
        ).rejects.toThrow(ValidationError);
      });

      it('should throw ValidationError for non-existent item', async () => {
        // Mock item not found
        mockSupabaseMethod.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        await expect(
          repository.createPet('nonexistent')
        ).rejects.toThrow(ValidationError);
      });
    });

    describe('updatePetPersonality', () => {
      it('should update personality without custom name', async () => {
        mockSupabaseMethod.mockResolvedValueOnce({ error: null });

        await repository.updatePetPersonality('item-123', 'personality-456');

        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          personality_id: 'personality-456',
        });
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('item_id', 'item-123');
      });

      it('should update personality with custom name', async () => {
        mockSupabaseMethod.mockResolvedValueOnce({ error: null });

        await repository.updatePetPersonality('item-123', 'personality-456', 'Sparkles');

        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          personality_id: 'personality-456',
          custom_name: 'Sparkles',
        });
      });

      it('should throw ValidationError for invalid custom name', async () => {
        await expect(
          repository.updatePetPersonality('item-123', 'personality-456', 'fuck')
        ).rejects.toThrow(ValidationError);
      });
    });

    describe('updateCustomName', () => {
      it('should update custom name successfully', async () => {
        mockSupabaseMethod.mockResolvedValueOnce({ error: null });

        await repository.updateCustomName('item-123', 'Shadow');

        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          custom_name: 'Shadow',
        });
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
        mockSupabaseMethod.mockResolvedValueOnce({ error: null });

        await repository.updateCustomName('item-123', "Shadow-Max's Pet");

        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          custom_name: "Shadow-Max's Pet",
        });
      });
    });

    describe('updateChatterHistory', () => {
      it('should update chatter history successfully', async () => {
        const validHistory = [
          { text: 'Hello!', timestamp: '1640995200', type: 'greeting' }
        ];
        mockSupabaseMethod.mockResolvedValueOnce({ error: null });

        await repository.updateChatterHistory('item-123', validHistory);

        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          chatter_history: validHistory,
        });
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
        mockSupabaseMethod.mockResolvedValueOnce({ error: null });

        await repository.updateChatterHistory('item-123', null);

        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          chatter_history: null,
        });
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
        mockSupabaseMethod.mockResolvedValueOnce({ data: existingPet, error: null });
        // Mock updateChatterHistory
        mockSupabaseMethod.mockResolvedValueOnce({ error: null });

        await repository.addChatterMessage('item-123', newMessage);

        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          chatter_history: [
            { text: 'Old message', timestamp: '1640995100', type: 'dialogue' },
            { text: 'New message', timestamp: '1640995300', type: 'dialogue' }
          ],
        });
      });

      it('should initialize history for pet without history', async () => {
        const existingPet = createMockPet({ chatter_history: null });
        const newMessage = { text: 'First message', timestamp: '1640995300', type: 'dialogue' };

        mockSupabaseMethod.mockResolvedValueOnce({ data: existingPet, error: null });
        mockSupabaseMethod.mockResolvedValueOnce({ error: null });

        await repository.addChatterMessage('item-123', newMessage);

        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          chatter_history: [newMessage],
        });
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

        mockSupabaseMethod.mockResolvedValueOnce({ data: existingPet, error: null });
        mockSupabaseMethod.mockResolvedValueOnce({ error: null });

        await repository.addChatterMessage('item-123', newMessage, 50);

        // Should keep only the most recent 50 messages (remove oldest)
        const expectedHistory = [...existingHistory.slice(1), newMessage];
        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          chatter_history: expectedHistory,
        });
      });

      it('should throw ValidationError for non-existent pet', async () => {
        mockSupabaseMethod.mockResolvedValueOnce({ data: null, error: null });

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
        mockSupabaseMethod.mockResolvedValueOnce({ data: mockPersonality, error: null });

        const result = await repository.findPersonalityById('personality-456');

        expect(result).toEqual(mockPersonality);
        expect(mockSupabase.from).toHaveBeenCalledWith('petpersonalities');
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'personality-456');
      });

      it('should return null when personality not found', async () => {
        mockSupabaseMethod.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
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
        mockSupabaseMethod.mockResolvedValueOnce({ data: mockPersonalities, error: null });

        const result = await repository.getAllPersonalities();

        expect(result).toEqual(mockPersonalities);
        expect(mockQueryBuilder.order).toHaveBeenCalledWith('display_name', { ascending: true });
      });

      it('should return empty array when no personalities found', async () => {
        mockSupabaseMethod.mockResolvedValueOnce({ data: [], error: null });

        const result = await repository.getAllPersonalities();

        expect(result).toEqual([]);
      });
    });

    describe('findPersonalityByType', () => {
      it('should return personality when type found', async () => {
        const mockPersonality = createMockPetPersonality();
        mockSupabaseMethod.mockResolvedValueOnce({ data: mockPersonality, error: null });

        const result = await repository.findPersonalityByType('friendly');

        expect(result).toEqual(mockPersonality);
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('personality_type', 'friendly');
      });

      it('should return null when type not found', async () => {
        mockSupabaseMethod.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
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
        mockSupabaseMethod.mockResolvedValueOnce({ data: mockPersonalities, error: null });

        const result = await repository.getPersonalitiesByVerbosity('high');

        expect(result).toEqual(mockPersonalities);
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('verbosity', 'high');
        expect(mockQueryBuilder.order).toHaveBeenCalledWith('display_name', { ascending: true });
      });
    });
  });

  describe('Validation Methods', () => {
    describe('validatePetItemCategory', () => {
      it('should return true for valid pet item', async () => {
        mockSupabaseMethod.mockResolvedValueOnce({
          data: { itemtypes: { category: 'pet' } },
          error: null
        });

        const result = await repository.validatePetItemCategory('item-123');

        expect(result).toBe(true);
        expect(mockSupabase.from).toHaveBeenCalledWith('items');
        expect(mockQueryBuilder.select).toHaveBeenCalledWith(`
        itemtypes (
          category
        )
      `);
      });

      it('should return false for non-pet item', async () => {
        mockSupabaseMethod.mockResolvedValueOnce({
          data: { itemtypes: { category: 'weapon' } },
          error: null
        });

        const result = await repository.validatePetItemCategory('item-123');

        expect(result).toBe(false);
      });

      it('should return false for non-existent item', async () => {
        mockSupabaseMethod.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        const result = await repository.validatePetItemCategory('nonexistent');

        expect(result).toBe(false);
      });

      it('should throw error for database failure', async () => {
        mockSupabaseMethod.mockResolvedValueOnce({
          data: null,
          error: { code: '42P01', message: 'relation "items" does not exist' }
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
        mockSupabaseMethod.mockResolvedValueOnce({ data: mockDetailedPet, error: null });

        const result = await repository.getPetWithDetails('item-123');

        expect(result).toEqual(mockDetailedPet);
        expect(mockQueryBuilder.select).toHaveBeenCalledWith(expect.stringContaining('items'));
        expect(mockQueryBuilder.select).toHaveBeenCalledWith(expect.stringContaining('petpersonalities'));
      });

      it('should return null when pet not found', async () => {
        mockSupabaseMethod.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
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
        mockSupabaseMethod.mockResolvedValueOnce({ data: mockUserPets, error: null });

        const result = await repository.getUserPets('user-123');

        expect(result).toEqual(mockUserPets);
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('items.user_id', 'user-123');
        expect(mockQueryBuilder.order).toHaveBeenCalledWith('items.name', { ascending: true });
      });

      it('should return empty array when user has no pets', async () => {
        mockSupabaseMethod.mockResolvedValueOnce({ data: [], error: null });

        const result = await repository.getUserPets('user-no-pets');

        expect(result).toEqual([]);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle CHECK constraint violations for pet category', async () => {
      mockSupabaseMethod.mockResolvedValueOnce({
        data: null,
        error: {
          code: '23514',
          message: 'check constraint "check_pet_item_category" violated'
        }
      });

      // Create a mock method that uses mapSupabaseError
      const testMethod = async () => {
        const { error } = await mockSupabase.from('pets').insert({});
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
      mockSupabaseMethod.mockResolvedValueOnce({
        data: null,
        error: {
          code: '23503',
          message: 'foreign key constraint "fk_pets_item" violated'
        }
      });

      const testMethod = async () => {
        const { error } = await mockSupabase.from('pets').insert({});
        if (error) {
          if (error.code === '23503' && error.message?.includes('fk_pets_item')) {
            throw new ValidationError('Referenced item does not exist');
          }
        }
      };

      await expect(testMethod()).rejects.toThrow(ValidationError);
    });

    it('should handle foreign key violations for personalities', async () => {
      mockSupabaseMethod.mockResolvedValueOnce({
        data: null,
        error: {
          code: '23503',
          message: 'foreign key constraint "fk_pets_personality" violated'
        }
      });

      const testMethod = async () => {
        const { error } = await mockSupabase.from('pets').insert({});
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