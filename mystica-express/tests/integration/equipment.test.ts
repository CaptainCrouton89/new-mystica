/**
 * Integration Tests: Equipment Endpoints
 *
 * Tests equipment system functionality including:
 * - GET /equipment for authenticated users with equipment
 * - GET /equipment for new users with empty slots
 * - Unauthorized access handling
 * - Stats aggregation from multiple equipped items
 */

import request from 'supertest';
import { extractResponseData } from '../helpers/assertions.js';

// Mock uuid BEFORE importing app to avoid ES module issues
jest.mock('uuid', () => ({
  v4: () => 'test-device-id-1234-5678-9abc-def0'
}));

// Mock functions BEFORE importing app
const mockGetClaims = jest.fn();
const mockFrom = jest.fn();

// Mock Supabase BEFORE importing app
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getClaims: mockGetClaims,
    },
    from: mockFrom
  }))
}));

// Import app AFTER mocking
import app from '../../src/app';
import { UserFactory, ItemFactory } from '../factories/index.js';

describe('Equipment API Endpoints', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockEmail = 'test@example.com';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default successful auth mock
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: mockUserId,
          email: mockEmail,
          exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
        }
      },
      error: null
    });
  });

  describe('GET /api/v1/equipment', () => {
    it('should return equipped items and stats for authenticated user', async () => {
      // Create test data for equipped items
      const weaponItem = ItemFactory.createWeapon('sword', 5, {
        id: 'weapon-123',
        user_id: mockUserId,
        current_stats: { atkPower: 10, atkAccuracy: 5, defPower: 2, defAccuracy: 3 } as any
      });

      const armorItem = ItemFactory.createArmor('chestplate', 3, {
        id: 'armor-456',
        user_id: mockUserId,
        current_stats: { atkPower: 1, atkAccuracy: 1, defPower: 15, defAccuracy: 8 } as any
      });

      // Mock UserEquipment query response with equipped items
      // This must match the repository's nested query structure: userequipment -> items:item_id -> itemtypes:item_type_id
      const mockQueryChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [
            {
              slot_name: 'weapon',
              equipped_at: '2025-01-21T10:00:00Z',
              items: {
                id: weaponItem.id,
                level: weaponItem.level,
                is_styled: weaponItem.is_styled,
                current_stats: weaponItem.current_stats,
                generated_image_url: weaponItem.generated_image_url,
                itemtypes: {
                  id: 'sword',
                  name: 'Iron Sword',
                  category: 'weapon',
                  base_stats_normalized: { atkPower: 0.4, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.2 },
                  rarity: 'common'
                }
              }
            },
            {
              slot_name: 'armor',
              equipped_at: '2025-01-21T10:00:00Z',
              items: {
                id: armorItem.id,
                level: armorItem.level,
                is_styled: armorItem.is_styled,
                current_stats: armorItem.current_stats,
                generated_image_url: armorItem.generated_image_url,
                itemtypes: {
                  id: 'chestplate',
                  name: 'Iron Chestplate',
                  category: 'armor',
                  base_stats_normalized: { atkPower: 0.1, atkAccuracy: 0.1, defPower: 0.5, defAccuracy: 0.3 },
                  rarity: 'common'
                }
              }
            }
          ],
          error: null
        })
      };

      // Set up multiple mock responses for different tables
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'userequipment') {
          return mockQueryChain;
        } else if (tableName === 'v_player_equipped_stats') {
          // Mock the stats view query - return error to force fallback
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'View not found' }
            })
          };
        }
        return mockQueryChain;
      });

      const response = await request(app)
        .get('/api/v1/equipment')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(200);

      // Verify response structure
      expect(extractResponseData(response.body)).toHaveProperty('slots');
      expect(extractResponseData(response.body)).toHaveProperty('total_stats');
      expect(extractResponseData(response.body)).toHaveProperty('equipment_count');

      // Verify weapon slot is populated
      expect(extractResponseData(response.body).slots.weapon).toBeDefined();
      expect(extractResponseData(response.body).slots.weapon.id).toBe('weapon-123');
      expect(extractResponseData(response.body).slots.weapon.level).toBe(5);

      // Verify armor slot is populated
      expect(extractResponseData(response.body).slots.armor).toBeDefined();
      expect(extractResponseData(response.body).slots.armor.id).toBe('armor-456');
      expect(extractResponseData(response.body).slots.armor.level).toBe(3);

      // Verify empty slots are undefined
      expect(extractResponseData(response.body).slots.offhand).toBeUndefined();
      expect(extractResponseData(response.body).slots.head).toBeUndefined();
      expect(extractResponseData(response.body).slots.feet).toBeUndefined();
      expect(extractResponseData(response.body).slots.accessory_1).toBeUndefined();
      expect(extractResponseData(response.body).slots.accessory_2).toBeUndefined();
      expect(extractResponseData(response.body).slots.pet).toBeUndefined();

      // Verify stats aggregation (weapon + armor stats)
      expect(extractResponseData(response.body).total_stats.atkPower).toBe(11); // 10 + 1
      expect(extractResponseData(response.body).total_stats.atkAccuracy).toBe(6); // 5 + 1
      expect(extractResponseData(response.body).total_stats.defPower).toBe(17); // 2 + 15
      expect(extractResponseData(response.body).total_stats.defAccuracy).toBe(11); // 3 + 8

      // Verify equipment count
      expect(response.body.equipment_count).toBe(2);

      // Verify the query was called correctly
      expect(mockFrom).toHaveBeenCalledWith('userequipment');
      expect(mockQueryChain.select).toHaveBeenCalledWith(expect.stringContaining('slot_name'));
      expect(mockQueryChain.eq).toHaveBeenCalledWith('user_id', mockUserId);
    });

    it('should return empty slots for new user with no equipment', async () => {
      // Mock empty UserEquipment query response
      const mockQueryChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [], // No equipment records
          error: null
        })
      };

      // Set up multiple mock responses for different tables
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'userequipment') {
          return mockQueryChain;
        } else if (tableName === 'v_player_equipped_stats') {
          // Mock the stats view query - return error to force fallback
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'View not found' }
            })
          };
        }
        return mockQueryChain;
      });

      const response = await request(app)
        .get('/api/v1/equipment')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(200);

      // Verify response structure
      expect(extractResponseData(response.body)).toHaveProperty('slots');
      expect(extractResponseData(response.body)).toHaveProperty('total_stats');
      expect(extractResponseData(response.body)).toHaveProperty('equipment_count');

      // Verify all slots are empty
      expect(extractResponseData(response.body).slots.weapon).toBeUndefined();
      expect(extractResponseData(response.body).slots.offhand).toBeUndefined();
      expect(extractResponseData(response.body).slots.head).toBeUndefined();
      expect(extractResponseData(response.body).slots.armor).toBeUndefined();
      expect(extractResponseData(response.body).slots.feet).toBeUndefined();
      expect(extractResponseData(response.body).slots.accessory_1).toBeUndefined();
      expect(extractResponseData(response.body).slots.accessory_2).toBeUndefined();
      expect(extractResponseData(response.body).slots.pet).toBeUndefined();

      // Verify zero stats
      expect(extractResponseData(response.body).total_stats.atkPower).toBe(0);
      expect(extractResponseData(response.body).total_stats.atkAccuracy).toBe(0);
      expect(extractResponseData(response.body).total_stats.defPower).toBe(0);
      expect(extractResponseData(response.body).total_stats.defAccuracy).toBe(0);

      // Verify zero equipment count
      expect(response.body.equipment_count).toBe(0);
    });

    it('should return 401 without valid token', async () => {
      const response = await request(app)
        .get('/api/v1/equipment')
        .expect(401);

      expect(response.body.error.code).toBe('missing_token');
    });

    it('should return 401 with invalid token', async () => {
      mockGetClaims.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid token' }
      });

      const response = await request(app)
        .get('/api/v1/equipment')
        .set('Authorization', `Bearer invalid-token`)
        .expect(401);

      expect(response.body.error.code).toBe('invalid_token');
    });

    it('should correctly aggregate stats from multiple items', async () => {
      // Create test items with known stats for verification
      const weaponStats = { atkPower: 15, atkAccuracy: 8, defPower: 2, defAccuracy: 2 };
      const armorStats = { atkPower: 1, atkAccuracy: 1, defPower: 20, defAccuracy: 15 };
      const accessoryStats = { atkPower: 3, atkAccuracy: 4, defPower: 3, defAccuracy: 5 };

      // Mock UserEquipment query response with multiple equipped items
      const mockQueryChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [
            {
              slot_name: 'weapon',
              equipped_at: '2025-01-21T10:00:00Z',
              items: {
                id: 'weapon-123',
                level: 5,
                is_styled: false,
                current_stats: weaponStats,
                generated_image_url: null,
                itemtypes: {
                  id: 'sword',
                  name: 'Iron Sword',
                  category: 'weapon',
                  base_stats_normalized: { atkPower: 0.4, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.2 },
                  rarity: 'common'
                }
              }
            },
            {
              slot_name: 'armor',
              equipped_at: '2025-01-21T10:00:00Z',
              items: {
                id: 'armor-456',
                level: 7,
                is_styled: false,
                current_stats: armorStats,
                generated_image_url: null,
                itemtypes: {
                  id: 'chestplate',
                  name: 'Iron Chestplate',
                  category: 'armor',
                  base_stats_normalized: { atkPower: 0.1, atkAccuracy: 0.1, defPower: 0.5, defAccuracy: 0.3 },
                  rarity: 'common'
                }
              }
            },
            {
              slot_name: 'accessory_1',
              equipped_at: '2025-01-21T10:00:00Z',
              items: {
                id: 'accessory-789',
                level: 3,
                is_styled: false,
                current_stats: accessoryStats,
                generated_image_url: null,
                itemtypes: {
                  id: 'ring',
                  name: 'Magic Ring',
                  category: 'accessory',
                  base_stats_normalized: { atkPower: 0.25, atkAccuracy: 0.25, defPower: 0.25, defAccuracy: 0.25 },
                  rarity: 'uncommon'
                }
              }
            }
          ],
          error: null
        })
      };

      // Set up multiple mock responses for different tables
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'userequipment') {
          return mockQueryChain;
        } else if (tableName === 'v_player_equipped_stats') {
          // Mock the stats view query - return error to force fallback
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'View not found' }
            })
          };
        }
        return mockQueryChain;
      });

      const response = await request(app)
        .get('/api/v1/equipment')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(200);

      // Verify equipment count
      expect(response.body.equipment_count).toBe(3);

      // Verify stats aggregation (weapon + armor + accessory)
      expect(extractResponseData(response.body).total_stats.atkPower).toBe(19); // 15 + 1 + 3
      expect(extractResponseData(response.body).total_stats.atkAccuracy).toBe(13); // 8 + 1 + 4
      expect(extractResponseData(response.body).total_stats.defPower).toBe(25); // 2 + 20 + 3
      expect(extractResponseData(response.body).total_stats.defAccuracy).toBe(22); // 2 + 15 + 5

      // Verify individual items are present
      expect(extractResponseData(response.body).slots.weapon.id).toBe('weapon-123');
      expect(extractResponseData(response.body).slots.armor.id).toBe('armor-456');
      expect(extractResponseData(response.body).slots.accessory_1.id).toBe('accessory-789');

      // Verify empty slots remain undefined
      expect(extractResponseData(response.body).slots.offhand).toBeUndefined();
      expect(extractResponseData(response.body).slots.head).toBeUndefined();
      expect(extractResponseData(response.body).slots.feet).toBeUndefined();
      expect(extractResponseData(response.body).slots.accessory_2).toBeUndefined();
      expect(extractResponseData(response.body).slots.pet).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const mockQueryChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: {
            message: 'Database connection failed',
            code: '08001'
          }
        })
      };

      // Set up multiple mock responses for different tables
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'userequipment') {
          return mockQueryChain;
        } else if (tableName === 'v_player_equipped_stats') {
          // Mock the stats view query - return error to force fallback
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'View not found' }
            })
          };
        }
        return mockQueryChain;
      });

      const response = await request(app)
        .get('/api/v1/equipment')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(500);

      expect(response.body.error.code).toBe('DATABASE_ERROR');
    });

    it('should handle corrupted data by skipping invalid items', async () => {
      // Mock query response with item missing ItemTypes data (data integrity issue)
      const mockQueryChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [
            {
              slot_name: 'weapon',
              equipped_at: '2025-01-21T10:00:00Z',
              items: {
                id: 'weapon-123',
                level: 5,
                is_styled: false,
                current_stats: { atkPower: 10, atkAccuracy: 5, defPower: 2, defAccuracy: 3 },
                generated_image_url: null,
                itemtypes: null // Missing ItemTypes data - data integrity issue
              }
            }
          ],
          error: null
        })
      };

      // Set up multiple mock responses for different tables
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'userequipment') {
          return mockQueryChain;
        } else if (tableName === 'v_player_equipped_stats') {
          // Mock the stats view query - return error to force fallback
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'View not found' }
            })
          };
        }
        return mockQueryChain;
      });

      const response = await request(app)
        .get('/api/v1/equipment')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(200);

      // Should skip the corrupted item and return empty slots
      expect(extractResponseData(response.body).slots.weapon).toBeUndefined();
      expect(response.body.equipment_count).toBe(0);
      expect(response.body.total_stats).toEqual({
        atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0
      });
    });
  });
});