/**
 * Unit Tests: RarityService
 *
 * Tests business logic for rarity system - simple read-only service for rarity definitions
 */

import { DatabaseError } from '../../../src/utils/errors.js';

// Mock the repository
const mockGetAllRarities = jest.fn();

jest.mock('../../../src/repositories/RarityRepository.js', () => ({
  rarityRepository: {
    getAllRarities: mockGetAllRarities,
  }
}));

// Import after mocking
import { RarityService } from '../../../src/services/RarityService.js';

describe('RarityService', () => {
  let rarityService: RarityService;

  beforeEach(() => {
    rarityService = new RarityService();
    jest.clearAllMocks();
  });

  describe('getAllRarities', () => {
    it('should return all rarity definitions from repository', async () => {
      const mockRarities = [
        {
          rarity: 'common' as const,
          stat_multiplier: 1.0,
          base_drop_rate: 0.6,
          display_name: 'Common',
          color_hex: '#FFFFFF',
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          rarity: 'uncommon' as const,
          stat_multiplier: 1.25,
          base_drop_rate: 0.25,
          display_name: 'Uncommon',
          color_hex: '#1EFF00',
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          rarity: 'rare' as const,
          stat_multiplier: 1.5,
          base_drop_rate: 0.1,
          display_name: 'Rare',
          color_hex: '#0070DD',
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          rarity: 'epic' as const,
          stat_multiplier: 1.75,
          base_drop_rate: 0.03,
          display_name: 'Epic',
          color_hex: '#A335EE',
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          rarity: 'legendary' as const,
          stat_multiplier: 2.0,
          base_drop_rate: 0.01,
          display_name: 'Legendary',
          color_hex: '#FF8000',
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      mockGetAllRarities.mockResolvedValue(mockRarities);

      const result = await rarityService.getAllRarities();

      expect(mockGetAllRarities).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockRarities);
      expect(result).toHaveLength(5);
      expect(result[0].rarity).toBe('common');
      expect(result[4].rarity).toBe('legendary');
    });

    it('should return empty array when no rarities exist', async () => {
      mockGetAllRarities.mockResolvedValue([]);

      const result = await rarityService.getAllRarities();

      expect(mockGetAllRarities).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should propagate database errors from repository', async () => {
      const error = new DatabaseError('Failed to fetch rarity definitions');
      mockGetAllRarities.mockRejectedValue(error);

      await expect(rarityService.getAllRarities()).rejects.toThrow(DatabaseError);
      await expect(rarityService.getAllRarities()).rejects.toThrow('Failed to fetch rarity definitions');

      expect(mockGetAllRarities).toHaveBeenCalledTimes(2);
    });

    it('should validate expected rarity structure', async () => {
      const mockRarity = {
        rarity: 'rare' as const,
        stat_multiplier: 1.5,
        base_drop_rate: 0.1,
        display_name: 'Rare',
        color_hex: '#0070DD',
        created_at: '2024-01-01T00:00:00Z'
      };

      mockGetAllRarities.mockResolvedValue([mockRarity]);

      const result = await rarityService.getAllRarities();

      expect(result[0]).toHaveProperty('rarity');
      expect(result[0]).toHaveProperty('stat_multiplier');
      expect(result[0]).toHaveProperty('base_drop_rate');
      expect(result[0]).toHaveProperty('display_name');
      expect(result[0]).toHaveProperty('color_hex');
      expect(result[0]).toHaveProperty('created_at');

      // Validate data types
      expect(typeof result[0].rarity).toBe('string');
      expect(typeof result[0].stat_multiplier).toBe('number');
      expect(typeof result[0].base_drop_rate).toBe('number');
      expect(typeof result[0].display_name).toBe('string');
      expect(typeof result[0].color_hex).toBe('string');
      expect(typeof result[0].created_at).toBe('string');
    });
  });
});