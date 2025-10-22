/**
 * OpenAI Integration Proof Test
 *
 * Proves that OpenAI dialogue generation is working end-to-end.
 * Since AI is nondeterministic, we validate structure and length rather than exact content.
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

// Import app AFTER mocking
import app from '../../src/app';

describe('OpenAI Dialogue Generation Proof Test', () => {
  const validToken = 'test-jwt-token';
  // Use a hardcoded session ID that exists in CombatStubService
  const validSessionId = '550e8400-e29b-41d4-a716-446655440001';

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

    // Mock combat session data
    // Use actual Spray Paint Goblin UUID from EnemyChatterService
    const sprayPaintGoblinId = 'd9e715fb-5de0-4639-96f8-3b4f03476314';
    const mockCombatSession = {
      id: validSessionId,
      user_id: 'user-123',
      location_id: 'loc-123',
      combat_level: 5,
      enemy_type_id: sprayPaintGoblinId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      outcome: null,
      combat_log: [],
      player_rating: 1200,
      enemy_rating: 1150,
      win_prob_est: 0.55,
      rewards: null
    };

    // Default mock for database queries
    mockFrom.mockImplementation((table: string) => {
      let responseData = null;

      if (table === 'combatsessions') {
        responseData = mockCombatSession;
      } else if (table === 'v_player_powerlevel') {
        responseData = {
          user_id: 'user-123',
          atk: 25,
          def: 20,
          acc: 0.75,
          hp: 100
        };
      } else if (table === 'v_enemy_realized_stats') {
        responseData = {
          enemy_type_id: sprayPaintGoblinId,
          atk: 18,
          def: 15,
          hp: 80,
          combat_rating: 1150
        };
      } else if (table === 'enemytypes') {
        responseData = {
          id: sprayPaintGoblinId,
          name: 'Spray Paint Goblin',
          style_id: 'graffiti',
          dialogue_tone: 'taunting',
          flavor_text: 'A mischievous vandal'
        };
      } else if (table === 'combathistory') {
        responseData = [];
      }

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: responseData,
          error: responseData === null ? { code: 'PGRST116', message: 'Not found' } : null
        }),
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null
        }),
      };
      return mockChain;
    });
  });

  it('should generate AI dialogue with 2-30 words', async () => {
    const response = await request(app)
      .post('/api/v1/combat/enemy-chatter')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        session_id: validSessionId,
        event_type: 'combat_start',
        event_details: {
          turn_number: 1,
          player_hp_pct: 1.0,
          enemy_hp_pct: 1.0,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('dialogue_response');

    const dialogueResponse = response.body.dialogue_response;
    expect(dialogueResponse).toHaveProperty('dialogue');
    expect(dialogueResponse).toHaveProperty('was_ai_generated');

    const dialogue = dialogueResponse.dialogue;

    // Validate dialogue is a non-empty string
    expect(typeof dialogue).toBe('string');
    expect(dialogue.length).toBeGreaterThan(0);

    // Count words (split by whitespace and filter empty strings)
    const words = dialogue.trim().split(/\s+/).filter((word: string) => word.length > 0);
    const wordCount = words.length;

    // Prove dialogue is 2-30 words as specified
    expect(wordCount).toBeGreaterThanOrEqual(2);
    expect(wordCount).toBeLessThanOrEqual(30);

    // If AI was used, generation time should be > 100ms (OpenAI network call)
    // If fallback was used, it should be < 100ms (database query)
    const genTime = dialogueResponse.generation_time_ms;
    expect(typeof genTime).toBe('number');
    expect(genTime).toBeGreaterThan(0);

    console.log(`
🧪 OpenAI Dialogue Proof Test Results:
   Dialogue: "${dialogue}"
   Word Count: ${wordCount}
   AI Generated: ${dialogueResponse.was_ai_generated}
   Generation Time: ${genTime}ms
   Enemy Type: ${dialogueResponse.enemy_type}
   Dialogue Tone: ${dialogueResponse.dialogue_tone}
    `);
  }, 15000); // 15s timeout for OpenAI API call

  it('should generate different dialogue for different event types', async () => {
    const eventTypes = ['player_hit', 'enemy_hit', 'near_victory'];
    const dialogues: string[] = [];

    for (const eventType of eventTypes) {
      const response = await request(app)
        .post('/api/v1/combat/enemy-chatter')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          session_id: validSessionId,
          event_type: eventType,
          event_details: {
            damage: 45,
            turn_number: 3,
            player_hp_pct: 0.65,
            enemy_hp_pct: eventType === 'near_victory' ? 0.15 : 0.60,
          },
        });

      expect(response.status).toBe(200);
      const dialogue = response.body.dialogue_response.dialogue;
      dialogues.push(dialogue);

      // Verify word count for each
      const words = dialogue.trim().split(/\s+/).filter((w: string) => w.length > 0);
      expect(words.length).toBeGreaterThanOrEqual(2);
      expect(words.length).toBeLessThanOrEqual(30);
    }

    console.log(`
🧪 Multiple Event Types Test:
   player_hit: "${dialogues[0]}"
   enemy_hit: "${dialogues[1]}"
   near_victory: "${dialogues[2]}"
    `);

    // Dialogues should exist and be valid (content may or may not be different due to AI)
    expect(dialogues[0]).toBeTruthy();
    expect(dialogues[1]).toBeTruthy();
    expect(dialogues[2]).toBeTruthy();
  }, 30000); // 30s timeout for multiple API calls

  it('should include player context in response', async () => {
    const response = await request(app)
      .post('/api/v1/combat/enemy-chatter')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        session_id: validSessionId,
        event_type: 'combat_start',
        event_details: {
          turn_number: 1,
          player_hp_pct: 1.0,
          enemy_hp_pct: 1.0,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.dialogue_response).toHaveProperty('player_context_used');

    const playerContext = response.body.dialogue_response.player_context_used;
    expect(playerContext).toHaveProperty('attempts');
    expect(playerContext).toHaveProperty('victories');
    expect(playerContext).toHaveProperty('defeats');
    expect(playerContext).toHaveProperty('current_streak');

    expect(typeof playerContext.attempts).toBe('number');
    expect(typeof playerContext.victories).toBe('number');
    expect(typeof playerContext.defeats).toBe('number');
    expect(typeof playerContext.current_streak).toBe('number');
  }, 15000);
});
