/**
 * Integration Tests: Enemy and Player Combat History Endpoints
 *
 * Tests enemy types and player combat history endpoints
 */

import request from 'supertest';
import { extractResponseData } from '../helpers/assertions.js';

// Create mock functions BEFORE importing app
const mockGetClaims = jest.fn();
const mockFrom = jest.fn();

// Mock UUID to avoid ES module issues in Jest
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-v4')
}));

// Mock Supabase BEFORE importing app
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getClaims: mockGetClaims,
    },
    from: mockFrom,
  }))
}));

// Import app AFTER mocking
import app from '../../src/app';

describe('Enemy API Endpoints', () => {
  // Test data
  const validLocationId = 'e6a0d42c-a301-4505-96a7-c71447fbec16'; // Golden Gate Park
  const invalidLocationId = '550e8400-e29b-41d4-a716-446655440099';
  const malformedLocationId = 'not-a-uuid';

  const mockEnemyTypes = [
    {
      id: 'd9e715fb-5de0-4639-96f8-3b4f03476314',
      name: 'Spray Paint Goblin',
      ai_personality_traits: ['mischievous', 'artistic', 'territorial'],
      dialogue_tone: 'taunting',
      dialogue_guidelines: 'You are a mischievous spray paint goblin who is territorial about art spaces.',
      atk_power: 25,
      atk_accuracy: 75,
      def_power: 15,
      def_accuracy: 70,
      base_hp: 80,
      tier_id: 1,
      style_id: 'normal'
    },
    {
      id: '4637f636-0b6a-4825-b1aa-492cf8d9d1bb',
      name: 'Goopy Floating Eye',
      ai_personality_traits: ['surreal', 'omniscient', 'cryptic'],
      dialogue_tone: 'mysterious',
      dialogue_guidelines: 'You are a cryptic floating eye that speaks in riddles and sees everything.',
      atk_power: 20,
      atk_accuracy: 90,
      def_power: 25,
      def_accuracy: 85,
      base_hp: 70,
      tier_id: 2,
      style_id: 'magical'
    },
    {
      id: '63d218fc-5cd9-4404-9090-fb72537da205',
      name: 'Feral Unicorn',
      ai_personality_traits: ['aggressive', 'proud', 'magical'],
      dialogue_tone: 'arrogant',
      dialogue_guidelines: 'You are an arrogant and aggressive unicorn who believes in your superiority.',
      atk_power: 40,
      atk_accuracy: 80,
      def_power: 30,
      def_accuracy: 75,
      base_hp: 150,
      tier_id: 3,
      style_id: 'legendary'
    },
    {
      id: '19cd32dc-e874-4836-a3e9-851431262cc8',
      name: 'Bipedal Deer',
      ai_personality_traits: ['noble', 'forest-wise', 'protective'],
      dialogue_tone: 'dignified',
      dialogue_guidelines: 'You are a wise and noble bipedal deer, protector of the forest.',
      atk_power: 30,
      atk_accuracy: 85,
      def_power: 35,
      def_accuracy: 90,
      base_hp: 120,
      tier_id: 2,
      style_id: 'natural'
    },
    {
      id: 'beb6ea68-597a-4052-92f6-ad73d0fd02b3',
      name: 'Politician',
      ai_personality_traits: ['manipulative', 'eloquent', 'power-hungry'],
      dialogue_tone: 'condescending',
      dialogue_guidelines: 'You are a corrupt politician who uses words as weapons and believes in your own power.',
      atk_power: 35,
      atk_accuracy: 70,
      def_power: 40,
      def_accuracy: 95,
      base_hp: 200,
      tier_id: 4,
      style_id: 'political'
    }
  ];

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup valid auth by default
    const futureTime = Math.floor(Date.now() / 1000) + 3600;
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: 'a7f99fed-262b-43e2-a88c-a8c5e4720577', // Real user from CombatStubService
          email: 'test@example.com',
          exp: futureTime
        }
      },
      error: null
    });

    // Default mock for database queries
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    });
  });

  describe('GET /api/v1/enemies/types', () => {
    it('should return all enemy types with personality data (public endpoint)', async () => {
      // Mock the database response for enemy types
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockEnemyTypes,
          error: null
        }),
      });

      const response = await request(app)
        .get('/api/v1/enemies/types');

      expect(response.status).toBe(200);
      expect(extractResponseData(response.body)).toEqual({
        enemy_types: mockEnemyTypes
      });

      expect(mockFrom).toHaveBeenCalledWith('enemytypes');
    });

    it('should work without authentication (public endpoint)', async () => {
      // Mock the database response
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockEnemyTypes,
          error: null
        }),
      });

      const response = await request(app)
        .get('/api/v1/enemies/types');

      expect(response.status).toBe(200);
      expect(extractResponseData(response.body).enemy_types).toHaveLength(5);

      // Verify no auth checks were attempted
      expect(mockGetClaims).not.toHaveBeenCalled();
    });

    it('should validate response structure contains required fields', async () => {
      // Mock the database response
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockEnemyTypes,
          error: null
        }),
      });

      const response = await request(app)
        .get('/api/v1/enemies/types');

      expect(response.status).toBe(200);
      expect(extractResponseData(response.body).enemy_types).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            ai_personality_traits: expect.any(Array),
            dialogue_tone: expect.any(String),
            dialogue_guidelines: expect.any(String),
            atk_power: expect.any(Number),
            atk_accuracy: expect.any(Number),
            def_power: expect.any(Number),
            def_accuracy: expect.any(Number),
            base_hp: expect.any(Number),
            tier_id: expect.any(Number),
            style_id: expect.any(String)
          })
        ])
      );

      // Verify specific enemy types exist
      const enemyNames = extractResponseData(response.body).enemy_types.map((enemy: any) => enemy.name);
      expect(enemyNames).toContain('Spray Paint Goblin');
      expect(enemyNames).toContain('Goopy Floating Eye');
      expect(enemyNames).toContain('Feral Unicorn');
      expect(enemyNames).toContain('Bipedal Deer');
      expect(enemyNames).toContain('Politician');
    });

    it('should return empty array when no enemy types exist', async () => {
      // Mock empty database response
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null
        }),
      });

      const response = await request(app)
        .get('/api/v1/enemies/types');

      expect(response.status).toBe(200);
      expect(extractResponseData(response.body)).toEqual({
        enemy_types: []
      });
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' }
        }),
      });

      const response = await request(app)
        .get('/api/v1/enemies/types');

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/v1/enemies/players/combat-history/:location_id', () => {
    const existingCombatHistory = {
      location_id: validLocationId,
      total_attempts: 15,
      victories: 10,
      defeats: 5,
      current_streak: 3,
      longest_streak: 7,
      last_attempt: '2023-12-01T10:30:00Z'
    };

    beforeEach(() => {
      // Reset the default mock to return a proper structure
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null
        }),
      });
    });

    it('should return combat history for valid location and authenticated user', async () => {
      // Mock location exists
      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: validLocationId },
            error: null
          }),
        })
        // Mock combat history exists
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: existingCombatHistory,
            error: null
          }),
        });

      const response = await request(app)
        .get(`/api/v1/enemies/players/combat-history/${validLocationId}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(extractResponseData(response.body)).toEqual({
        location_id: validLocationId,
        attempts: 15,
        victories: 10,
        defeats: 5,
        win_rate: 0.667, // 10/15 rounded to 3 decimal places
        current_streak: 3,
        longest_streak: 7,
        last_attempt: '2023-12-01T10:30:00Z'
      });
    });

    it('should return zeroed stats for first-time player at location', async () => {
      // Mock location exists
      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: validLocationId },
            error: null
          }),
        })
        // Mock no combat history (PGRST116 error indicates no rows)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'No rows returned' }
          }),
        });

      const response = await request(app)
        .get(`/api/v1/enemies/players/combat-history/${validLocationId}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(extractResponseData(response.body)).toEqual({
        location_id: validLocationId,
        attempts: 0,
        victories: 0,
        defeats: 0,
        win_rate: 0,
        current_streak: 0,
        longest_streak: 0,
        last_attempt: null
      });
    });

    it('should require authentication (401 without token)', async () => {
      const response = await request(app)
        .get(`/api/v1/enemies/players/combat-history/${validLocationId}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('missing_token');

      // Should not query database without auth
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent location', async () => {
      // Mock location does not exist
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null
        }),
      });

      const response = await request(app)
        .get(`/api/v1/enemies/players/combat-history/${invalidLocationId}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Location not found');
    });

    it('should return 400 for malformed location UUID', async () => {
      const response = await request(app)
        .get(`/api/v1/enemies/players/combat-history/${malformedLocationId}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'params.location_id',
            message: 'Invalid UUID format'
          })
        ])
      );
    });

    it('should handle database errors during location lookup', async () => {
      // Mock location lookup database error
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection timeout' }
        }),
      });

      const response = await request(app)
        .get(`/api/v1/enemies/players/combat-history/${validLocationId}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Location not found');
    });

    it('should handle database errors during combat history lookup', async () => {
      // Mock location exists
      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: validLocationId },
            error: null
          }),
        })
        // Mock combat history database error (not PGRST116)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'UNKNOWN', message: 'Database error' }
          }),
        });

      const response = await request(app)
        .get(`/api/v1/enemies/players/combat-history/${validLocationId}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('UNKNOWN');
    });

    it('should calculate win rate correctly for different scenarios', async () => {
      const perfectWinHistory = {
        location_id: validLocationId,
        total_attempts: 10,
        victories: 10,
        defeats: 0,
        current_streak: 10,
        longest_streak: 10,
        last_attempt: '2023-12-01T10:30:00Z'
      };

      // Mock location exists and perfect win history
      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: validLocationId },
            error: null
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: perfectWinHistory,
            error: null
          }),
        });

      const response = await request(app)
        .get(`/api/v1/enemies/players/combat-history/${validLocationId}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(extractResponseData(response.body).win_rate).toBe(1.0);
    });

    it('should reject request with expired token', async () => {
      const expiredTime = Math.floor(Date.now() / 1000) - 3600;
      mockGetClaims.mockResolvedValue({
        data: {
          claims: {
            sub: 'user-123',
            email: 'test@example.com',
            exp: expiredTime
          }
        },
        error: null
      });

      const response = await request(app)
        .get(`/api/v1/enemies/players/combat-history/${validLocationId}`)
        .set('Authorization', 'Bearer expired-token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('token_expired');
    });
  });
});