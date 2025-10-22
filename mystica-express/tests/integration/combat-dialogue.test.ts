/**
 * Integration Tests: Combat Dialogue Endpoints
 *
 * Tests AI-powered enemy dialogue generation with real combat sessions
 */

import request from 'supertest';

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

// Mock the AI service to avoid external API calls in tests
const mockGenerateDialogue = jest.fn();
jest.mock('../../src/services/EnemyChatterService.js', () => ({
  enemyChatterService: {
    generateDialogue: mockGenerateDialogue
  }
}));

// Mock CombatService to avoid database calls
const mockGetCombatSession = jest.fn();
jest.mock('../../src/services/CombatService.js', () => ({
  combatService: {
    getCombatSession: mockGetCombatSession
  }
}));

// Import app AFTER mocking
import app from '../../src/app';
import type { DialogueResponse } from '../../src/types/combat.types';

describe('Combat API Endpoints', () => {
  // Test data - use hardcoded session IDs from CombatStubService
  const validSessionId = '550e8400-e29b-41d4-a716-446655440001';
  const invalidSessionId = '550e8400-e29b-41d4-a716-446655440099';
  const malformedSessionId = 'not-a-uuid';

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup valid auth by default
    const futureTime = Math.floor(Date.now() / 1000) + 3600;
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: 'user-123',
          email: 'test@example.com',
          exp: futureTime
        }
      },
      error: null
    });

    // Default mock for database queries - properly chain Supabase methods
    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockIs = jest.fn().mockReturnThis();

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      is: mockIs
    });

    // Mock CombatService.getCombatSession for valid sessions
    mockGetCombatSession.mockImplementation((sessionId: string) => {
      if (sessionId === validSessionId) {
        return Promise.resolve({
          id: sessionId,
          player_id: 'user-123',
          location_id: 'location-123',
          enemy_type_id: 'd9e715fb-5de0-4639-96f8-3b4f03476314'
        });
      }
      if (sessionId === invalidSessionId) {
        const { NotFoundError } = require('../../src/utils/errors.js');
        throw new NotFoundError('Combat session', sessionId);
      }
      throw new Error('Invalid session ID format');
    });

    // Default mock for AI dialogue generation
    const mockDialogueResponse: DialogueResponse = {
      dialogue: "You think you can defeat me?! Ha!",
      enemy_type: "Spray Paint Goblin",
      dialogue_tone: "taunting",
      generation_time_ms: 1200,
      was_ai_generated: true,
      player_context_used: {
        attempts: 5,
        victories: 3,
        defeats: 2,
        current_streak: 1
      }
    };
    mockGenerateDialogue.mockResolvedValue(mockDialogueResponse);
  });

  describe('POST /api/v1/combat/enemy-chatter', () => {
    const validRequest = {
      session_id: validSessionId,
      event_type: 'combat_start',
      event_details: {
        turn_number: 1,
        player_hp_pct: 1.0,
        enemy_hp_pct: 1.0
      }
    };

    it('should generate dialogue for valid combat_start event', async () => {
      const response = await request(app)
        .post('/api/v1/combat/enemy-chatter')
        .set('Authorization', 'Bearer valid-token')
        .send(validRequest);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        dialogue_response: expect.objectContaining({
          dialogue: expect.any(String),
          enemy_type: expect.any(String),
          dialogue_tone: expect.any(String),
          generation_time_ms: expect.any(Number),
          was_ai_generated: expect.any(Boolean),
          player_context_used: expect.objectContaining({
            attempts: expect.any(Number),
            victories: expect.any(Number),
            defeats: expect.any(Number),
            current_streak: expect.any(Number)
          })
        }),
        cached: false
      });

      expect(mockGenerateDialogue).toHaveBeenCalledWith(
        validSessionId,
        'combat_start',
        expect.objectContaining({
          turn_number: 1,
          player_hp_percentage: 100,
          enemy_hp_percentage: 100
        })
      );
    });

    it('should generate dialogue for player_hit event with damage', async () => {
      const playerHitRequest = {
        session_id: validSessionId,
        event_type: 'player_hit',
        event_details: {
          damage: 25,
          accuracy: 0.85,
          is_critical: true,
          turn_number: 3,
          player_hp_pct: 0.95,
          enemy_hp_pct: 0.75
        }
      };

      const response = await request(app)
        .post('/api/v1/combat/enemy-chatter')
        .set('Authorization', 'Bearer valid-token')
        .send(playerHitRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockGenerateDialogue).toHaveBeenCalledWith(
        validSessionId,
        'player_hit',
        expect.objectContaining({
          damage: 25,
          accuracy: 0.85,
          is_critical: true,
          turn_number: 3,
          player_hp_percentage: 95,
          enemy_hp_percentage: 75
        })
      );
    });

    it('should generate dialogue for enemy_hit event', async () => {
      const enemyHitRequest = {
        session_id: validSessionId,
        event_type: 'enemy_hit',
        event_details: {
          damage: 15,
          turn_number: 4,
          player_hp_pct: 0.80,
          enemy_hp_pct: 0.75
        }
      };

      const response = await request(app)
        .post('/api/v1/combat/enemy-chatter')
        .set('Authorization', 'Bearer valid-token')
        .send(enemyHitRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockGenerateDialogue).toHaveBeenCalledWith(
        validSessionId,
        'enemy_hit',
        expect.objectContaining({
          damage: 15,
          turn_number: 4,
          player_hp_percentage: 80,
          enemy_hp_percentage: 75
        })
      );
    });

    it('should generate dialogue for victory event', async () => {
      const victoryRequest = {
        session_id: validSessionId,
        event_type: 'victory',
        event_details: {
          turn_number: 8,
          player_hp_pct: 0.65,
          enemy_hp_pct: 0.0
        }
      };

      const response = await request(app)
        .post('/api/v1/combat/enemy-chatter')
        .set('Authorization', 'Bearer valid-token')
        .send(victoryRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockGenerateDialogue).toHaveBeenCalledWith(
        validSessionId,
        'victory',
        expect.objectContaining({
          turn_number: 8,
          player_hp_percentage: 65,
          enemy_hp_percentage: 0
        })
      );
    });

    it('should require authentication (401 without token)', async () => {
      const response = await request(app)
        .post('/api/v1/combat/enemy-chatter')
        .send(validRequest);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('missing_token');
      expect(mockGenerateDialogue).not.toHaveBeenCalled();
    });

    it('should return 404 for invalid session_id', async () => {
      const invalidRequest = {
        ...validRequest,
        session_id: invalidSessionId
      };

      const response = await request(app)
        .post('/api/v1/combat/enemy-chatter')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidRequest);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('Combat session');
      expect(mockGenerateDialogue).not.toHaveBeenCalled();
    });

    it('should return 400 for malformed session_id UUID', async () => {
      const malformedRequest = {
        ...validRequest,
        session_id: malformedSessionId
      };

      const response = await request(app)
        .post('/api/v1/combat/enemy-chatter')
        .set('Authorization', 'Bearer valid-token')
        .send(malformedRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'body.session_id',
            message: 'Invalid UUID format'
          })
        ])
      );
    });

    it('should return 400 for invalid event_type', async () => {
      const invalidEventRequest = {
        ...validRequest,
        event_type: 'invalid_event'
      };

      const response = await request(app)
        .post('/api/v1/combat/enemy-chatter')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidEventRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'body.event_type'
          })
        ])
      );
    });

    it('should return 400 for missing event_details', async () => {
      const missingDetailsRequest = {
        session_id: validSessionId,
        event_type: 'combat_start'
        // Missing event_details
      };

      const response = await request(app)
        .post('/api/v1/combat/enemy-chatter')
        .set('Authorization', 'Bearer valid-token')
        .send(missingDetailsRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid HP percentages', async () => {
      const invalidHpRequest = {
        ...validRequest,
        event_details: {
          turn_number: 1,
          player_hp_pct: 1.5, // Invalid: > 1.0
          enemy_hp_pct: -0.1   // Invalid: < 0.0
        }
      };

      const response = await request(app)
        .post('/api/v1/combat/enemy-chatter')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidHpRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: expect.stringMatching(/player_hp_pct|enemy_hp_pct/)
          })
        ])
      );
    });

    it('should return 400 for negative damage', async () => {
      const negativeDamageRequest = {
        ...validRequest,
        event_details: {
          damage: -10,
          turn_number: 1,
          player_hp_pct: 1.0,
          enemy_hp_pct: 1.0
        }
      };

      const response = await request(app)
        .post('/api/v1/combat/enemy-chatter')
        .set('Authorization', 'Bearer valid-token')
        .send(negativeDamageRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'body.event_details.damage',
            message: 'Damage must be non-negative'
          })
        ])
      );
    });

    it('should return 400 for invalid accuracy range', async () => {
      const invalidAccuracyRequest = {
        ...validRequest,
        event_details: {
          accuracy: 1.5, // Invalid: > 1.0
          turn_number: 1,
          player_hp_pct: 1.0,
          enemy_hp_pct: 1.0
        }
      };

      const response = await request(app)
        .post('/api/v1/combat/enemy-chatter')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidAccuracyRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'body.event_details.accuracy',
            message: 'Accuracy must be between 0.0 and 1.0'
          })
        ])
      );
    });

    it('should return 503 when AI service is unavailable', async () => {
      // Mock AI service to throw ExternalAPIError
      const { ExternalAPIError } = require('../../src/utils/errors.js');
      mockGenerateDialogue.mockRejectedValue(
        new ExternalAPIError('OpenAI', 'API rate limit exceeded')
      );

      const response = await request(app)
        .post('/api/v1/combat/enemy-chatter')
        .set('Authorization', 'Bearer valid-token')
        .send(validRequest);

      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe('AI_SERVICE_UNAVAILABLE');
      expect(response.body.error.message).toContain('AI dialogue generation service is temporarily unavailable');
      expect(response.body.error.details).toContain('API rate limit exceeded');
    });

    it('should handle CombatService errors gracefully', async () => {
      // Mock CombatService to throw DatabaseError
      const { DatabaseError } = require('../../src/utils/errors.js');
      mockGetCombatSession.mockRejectedValue(
        new DatabaseError('Database connection failed')
      );

      const response = await request(app)
        .post('/api/v1/combat/enemy-chatter')
        .set('Authorization', 'Bearer valid-token')
        .send(validRequest);

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('DATABASE_ERROR');
      expect(mockGenerateDialogue).not.toHaveBeenCalled();
    });

    it('should validate turn_number is positive', async () => {
      const invalidTurnRequest = {
        ...validRequest,
        event_details: {
          turn_number: 0, // Invalid: must be positive
          player_hp_pct: 1.0,
          enemy_hp_pct: 1.0
        }
      };

      const response = await request(app)
        .post('/api/v1/combat/enemy-chatter')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidTurnRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'body.event_details.turn_number',
            message: 'Turn number must be positive'
          })
        ])
      );
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
        .post('/api/v1/combat/enemy-chatter')
        .set('Authorization', 'Bearer expired-token')
        .send(validRequest);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('token_expired');
      expect(mockGenerateDialogue).not.toHaveBeenCalled();
    });
  });
});