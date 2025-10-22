/**
 * Unit Tests: ImageCacheRepository
 *
 * Tests image cache management, UNIQUE constraint handling, atomic operations, and analytics queries
 */

import { DatabaseError, NotFoundError, ValidationError } from '../../../src/utils/errors.js';
import { ImageCacheRepository } from '../../../src/repositories/ImageCacheRepository.js';
import { ItemImageCacheEntry, CreateImageCacheData } from '../../../src/types/repository.types.js';
import { createMockSupabaseClient } from '../../helpers/mockSupabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('ImageCacheRepository', () => {
  let repository: ImageCacheRepository;
  let mockClient: any;

  // Test data
  const mockCacheEntry: ItemImageCacheEntry = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    item_type_id: '456e7890-e89b-12d3-a456-426614174001',
    combo_hash: 'abc123def456',
    image_url: 'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items/magic_wand.png',
    craft_count: 5,
    provider: 'gemini',
    created_at: '2024-01-15T10:30:00Z',
  };

  const mockCreateData: CreateImageCacheData = {
    item_type_id: '456e7890-e89b-12d3-a456-426614174001',
    combo_hash: 'abc123def456',
    image_url: 'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items/magic_wand.png',
    provider: 'gemini',
  };

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    repository = new ImageCacheRepository();
    // Override the client for testing
    (repository as any).client = mockClient;
  });

  describe('findByComboHash', () => {
    it('should find cache entry by item type and combo hash', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockCacheEntry, error: null })
            })
          })
        })
      });

      const result = await repository.findByComboHash('456e7890-e89b-12d3-a456-426614174001', 'abc123def456');

      expect(mockClient.from).toHaveBeenCalledWith('itemimagecache');
      expect(result).toEqual(mockCacheEntry);
    });

    it('should return null when cache entry not found', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows returned' }
              })
            })
          })
        })
      });

      const result = await repository.findByComboHash('nonexistent', 'hash');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on query failure', async () => {
      const mockError = { code: 'PGRST000', message: 'Database error' };
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: mockError })
            })
          })
        })
      });

      await expect(
        repository.findByComboHash('456e7890-e89b-12d3-a456-426614174001', 'abc123def456')
      ).rejects.toThrow(DatabaseError);
    });
  });

  describe('createCacheEntry', () => {
    it('should create new cache entry successfully', async () => {
      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockCacheEntry, error: null })
          })
        })
      });

      const result = await repository.createCacheEntry(mockCreateData);

      expect(mockClient.from).toHaveBeenCalledWith('itemimagecache');
      expect(result).toEqual(mockCacheEntry);
    });

    it('should handle UNIQUE constraint violation gracefully', async () => {
      // First call (insert) fails with constraint violation
      mockClient.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint "unique_item_type_combo"' }
            })
          })
        })
      });

      // Second call (findByComboHash) returns existing entry
      mockClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockCacheEntry, error: null })
            })
          })
        })
      });

      const result = await repository.createCacheEntry(mockCreateData);

      expect(result).toEqual(mockCacheEntry);
    });

    it('should validate R2 URL format', async () => {
      const invalidData = {
        ...mockCreateData,
        image_url: 'https://example.com/invalid.png'
      };

      await expect(repository.createCacheEntry(invalidData)).rejects.toThrow(ValidationError);
    });

    it('should validate image file extension', async () => {
      const invalidData = {
        ...mockCreateData,
        image_url: 'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items/magic_wand.txt'
      };

      await expect(repository.createCacheEntry(invalidData)).rejects.toThrow(ValidationError);
    });

    it('should throw DatabaseError on non-constraint database errors', async () => {
      const mockError = { code: 'PGRST000', message: 'Database error' };
      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: mockError })
          })
        })
      });

      await expect(repository.createCacheEntry(mockCreateData)).rejects.toThrow(DatabaseError);
    });
  });

  describe('incrementCraftCount', () => {
    it('should atomically increment craft count via RPC', async () => {
      const expectedNewCount = 6;

      mockClient.rpc.mockResolvedValue({ data: expectedNewCount, error: null });

      const result = await repository.incrementCraftCount('123e4567-e89b-12d3-a456-426614174000');

      expect(mockClient.rpc).toHaveBeenCalledWith('increment_craft_count', { cache_id: '123e4567-e89b-12d3-a456-426614174000' });
      expect(result).toBe(expectedNewCount);
    });

    it('should throw NotFoundError when cache entry does not exist', async () => {
      mockClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Cache entry not found' }
      });

      await expect(
        repository.incrementCraftCount('nonexistent-id')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw DatabaseError on RPC failure', async () => {
      const mockError = { code: 'PGRST000', message: 'Database error' };
      mockClient.rpc.mockResolvedValue({ data: null, error: mockError });

      await expect(
        repository.incrementCraftCount('123e4567-e89b-12d3-a456-426614174000')
      ).rejects.toThrow(DatabaseError);
    });
  });

  describe('getCraftCount', () => {
    it('should return current craft count', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { craft_count: 5 }, error: null })
            })
          })
        })
      });

      const result = await repository.getCraftCount('456e7890-e89b-12d3-a456-426614174001', 'abc123def456');

      expect(mockClient.from).toHaveBeenCalledWith('itemimagecache');
      expect(result).toBe(5);
    });

    it('should return 0 when cache entry not found', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows returned' }
              })
            })
          })
        })
      });

      const result = await repository.getCraftCount('nonexistent', 'hash');

      expect(result).toBe(0);
    });

    it('should throw DatabaseError on query failure', async () => {
      const mockError = { code: 'PGRST000', message: 'Database error' };
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: mockError })
            })
          })
        })
      });

      await expect(
        repository.getCraftCount('456e7890-e89b-12d3-a456-426614174001', 'abc123def456')
      ).rejects.toThrow(DatabaseError);
    });
  });

  describe('getMostPopularCombos', () => {
    it('should return most popular combos ordered by craft count', async () => {
      const mockCombos = [mockCacheEntry, { ...mockCacheEntry, craft_count: 3 }];
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: mockCombos, error: null })
          })
        })
      });

      const result = await repository.getMostPopularCombos(10);

      expect(mockClient.from).toHaveBeenCalledWith('itemimagecache');
      expect(result).toEqual(mockCombos);
    });

    it('should handle empty results', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      });

      const result = await repository.getMostPopularCombos(10);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on query failure', async () => {
      const mockError = { code: 'PGRST000', message: 'Database error' };
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: null, error: mockError })
          })
        })
      });

      await expect(repository.getMostPopularCombos(10)).rejects.toThrow(DatabaseError);
    });
  });

  describe('getCombosByProvider', () => {
    it('should return combos filtered by provider', async () => {
      const mockCombos = [mockCacheEntry];
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: mockCombos, error: null })
          })
        })
      });

      const result = await repository.getCombosByProvider('gemini');

      expect(mockClient.from).toHaveBeenCalledWith('itemimagecache');
      expect(result).toEqual(mockCombos);
    });

    it('should handle empty results', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      });

      const result = await repository.getCombosByProvider('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('getCombosByItemType', () => {
    it('should return combos filtered by item type', async () => {
      const mockCombos = [mockCacheEntry];
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: mockCombos, error: null })
          })
        })
      });

      const result = await repository.getCombosByItemType('456e7890-e89b-12d3-a456-426614174001');

      expect(mockClient.from).toHaveBeenCalledWith('itemimagecache');
      expect(result).toEqual(mockCombos);
    });
  });

  describe('getProviderStats', () => {
    it('should return aggregated stats by provider', async () => {
      const mockRawData = [
        { provider: 'gemini', craft_count: 5 },
        { provider: 'gemini', craft_count: 3 },
        { provider: 'seedream', craft_count: 2 },
        { provider: null, craft_count: 1 },
      ];

      mockClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: mockRawData, error: null })
      });

      const result = await repository.getProviderStats();

      expect(mockClient.from).toHaveBeenCalledWith('itemimagecache');
      expect(result).toEqual([
        { provider: 'gemini', combo_count: 2, total_crafts: 8 },
        { provider: 'seedream', combo_count: 1, total_crafts: 2 },
        { provider: null, combo_count: 1, total_crafts: 1 },
      ]);
    });

    it('should handle empty data', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: [], error: null })
      });

      const result = await repository.getProviderStats();

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on query failure', async () => {
      const mockError = { code: 'PGRST000', message: 'Database error' };
      mockClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: null, error: mockError })
      });

      await expect(repository.getProviderStats()).rejects.toThrow(DatabaseError);
    });
  });

  describe('getTotalUniqueComboCount', () => {
    it('should return total count of unique combos', async () => {
      // Mock the count method from BaseRepository
      const mockCount = jest.spyOn(repository, 'count').mockResolvedValue(42);

      const result = await repository.getTotalUniqueComboCount();

      expect(mockCount).toHaveBeenCalledWith();
      expect(result).toBe(42);

      mockCount.mockRestore();
    });
  });

  describe('URL validation', () => {
    const validUrls = [
      'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items/magic_wand.png',
      'https://storage.r2.cloudflarestorage.com/bucket/items/sword.jpg',
      'https://example.r2.dev/materials/crystal.jpeg',
      'https://test.r2.dev/items/potion.webp',
    ];

    const invalidUrls = [
      'https://example.com/image.png', // Not R2 domain
      'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items/magic_wand.txt', // Invalid extension
      'not-a-url', // Invalid URL format
      'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items/', // No file
    ];

    it.each(validUrls)('should accept valid R2 URL: %s', async (url) => {
      const data = { ...mockCreateData, image_url: url };
      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockCacheEntry, error: null })
          })
        })
      });

      await expect(repository.createCacheEntry(data)).resolves.toBeDefined();
    });

    it.each(invalidUrls)('should reject invalid URL: %s', async (url) => {
      const data = { ...mockCreateData, image_url: url };

      await expect(repository.createCacheEntry(data)).rejects.toThrow(ValidationError);
    });
  });

  describe('first craft detection', () => {
    it('should enable first craft detection through craft count', async () => {
      // Test scenario: Service can detect first craft by checking if craft_count is 1
      const newCacheEntry = { ...mockCacheEntry, craft_count: 1 };
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: newCacheEntry, error: null })
            })
          })
        })
      });

      const result = await repository.findByComboHash('456e7890-e89b-12d3-a456-426614174001', 'abc123def456');

      expect(result?.craft_count).toBe(1);
      // Service layer can use: is_first_craft = (result.craft_count === 1)
    });

    it('should enable cache miss detection through null return', async () => {
      // Test scenario: Service can detect cache miss by null return
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows returned' }
              })
            })
          })
        })
      });

      const result = await repository.findByComboHash('nonexistent', 'hash');

      expect(result).toBeNull();
      // Service layer can use: is_first_craft = (result === null)
    });
  });
});