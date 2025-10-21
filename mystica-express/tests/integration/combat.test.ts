/**
 * Integration Tests: Combat System (TDD)
 *
 * Comprehensive test suite for the combat system following TDD practices.
 * These tests are designed to FAIL until CombatService is implemented.
 */

import request from 'supertest';

// Create mock functions BEFORE importing app
const mockGetClaims = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();

// Mock UUID to avoid ES module issues in Jest
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-session-uuid-v4')
}));

// Mock Redis client functions (Redis not yet installed)
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisSetEx = jest.fn();
const mockRedisDel = jest.fn();
const mockRedisExists = jest.fn();

// Mock Redis in CombatService when implemented
// jest.mock('redis', () => ({ ... }));

// Mock Supabase BEFORE importing app
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getClaims: mockGetClaims,
    },
    from: mockFrom,
    rpc: mockRpc
  }))
}));

// Import app AFTER mocking
import app from '../../src/app';

describe('Combat System API Endpoints (TDD)', () => {
  // Test data
  const testUserId = 'a7f99fed-262b-43e2-a88c-a8c5e4720577';
  const testLocationId = 'e6a0d42c-a301-4505-96a7-c71447fbec16'; // Golden Gate Park
  const testGymLocationId = '123e4567-e89b-12d3-a456-426614174000'; // Gym location
  const testSessionId = 'test-session-uuid-v4';
  const invalidLocationId = '00000000-0000-0000-0000-000000000000';
  const expiredSessionId = 'expired-session-uuid';

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup valid auth by default
    const futureTime = Math.floor(Date.now() / 1000) + 3600;
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: testUserId,
          email: 'test@example.com',
          exp: futureTime
        }
      },
      error: null
    });

    // Default Redis mocks
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockRedisSetEx.mockResolvedValue('OK');
    mockRedisDel.mockResolvedValue(1);
    mockRedisExists.mockResolvedValue(0);

    // Default database mock
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis()
    });

    // Default RPC mock
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  // ============================================================================
  // 1. Combat Session Creation Tests
  // ============================================================================

  describe('POST /api/v1/combat/start', () => {
    const startCombatRequest = {
      location_id: testLocationId
    };

    it('should create combat session with enemy from correct pool at valid location', async () => {
      // Given: Valid location with enemy pools
      const mockLocation = {
        id: testLocationId,
        name: 'Golden Gate Park',
        location_type: 'park',
        state: 'California',
        country: 'United States'
      };

      const mockSelectedEnemy = {
        enemy_type_id: 'd9e715fb-5de0-4639-96f8-3b4f03476314',
        enemy_name: 'Spray Paint Goblin',
        tier: 1,
        base_hp: 120,
        base_atk: 25,
        base_def: 10,
        style_id: 'normal'
      };

      const mockPlayerStats = {
        total_hp: 100,
        total_atk: 30,
        total_def: 15,
        accuracy: 0.75
      };

      // Mock location lookup
      mockFrom().single.mockResolvedValueOnce({
        data: mockLocation,
        error: null
      });

      // Mock enemy selection from pool
      mockRpc.mockResolvedValueOnce({
        data: mockSelectedEnemy,
        error: null
      });

      // Mock player stats calculation
      mockRpc.mockResolvedValueOnce({
        data: mockPlayerStats,
        error: null
      });

      // When: Starting combat
      const response = await request(app)
        .post('/api/v1/combat/start')
        .set('Authorization', 'Bearer valid-token')
        .send(startCombatRequest);

      // Then: Should create session successfully
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        session: {
          session_id: expect.any(String),
          enemy_type_id: mockSelectedEnemy.enemy_type_id,
          player_id: testUserId,
          location_id: testLocationId,
          turn_number: 1,
          player_hp: mockPlayerStats.total_hp,
          enemy_hp: mockSelectedEnemy.base_hp,
          max_player_hp: mockPlayerStats.total_hp,
          max_enemy_hp: mockSelectedEnemy.base_hp
        },
        enemy_info: {
          name: 'Spray Paint Goblin',
          tier: 1,
          style_id: 'normal'
        },
        player_stats: mockPlayerStats
      });

      // Should store session in Redis with 15min TTL
      expect(mockRedisSetEx).toHaveBeenCalledWith(
        expect.stringMatching(/^combat:session:/),
        900, // 15 minutes
        expect.any(String)
      );
    });

    it('should select enemy from level 1 universal pool for new player', async () => {
      // Given: Player at level 1
      const mockLocation = {
        id: testLocationId,
        location_type: 'park'
      };

      const mockLevel1Enemy = {
        enemy_type_id: 'd9e715fb-5de0-4639-96f8-3b4f03476314',
        tier: 1
      };

      mockFrom().single.mockResolvedValueOnce({
        data: mockLocation,
        error: null
      });

      // Mock combat level calculation (returns 1 for new player)
      mockRpc.mockResolvedValueOnce({
        data: { combat_level: 1 },
        error: null
      });

      // Mock enemy selection from universal level 1 pool
      mockRpc.mockResolvedValueOnce({
        data: mockLevel1Enemy,
        error: null
      });

      // When: Starting combat
      const response = await request(app)
        .post('/api/v1/combat/start')
        .set('Authorization', 'Bearer valid-token')
        .send(startCombatRequest);

      // Then: Should select from universal pool for level 1
      expect(mockRpc).toHaveBeenCalledWith(
        'select_enemy_from_pool',
        expect.objectContaining({
          p_combat_level: 1,
          p_location_type: 'park'
        })
      );
    });

    it('should select enemy from gym-specific pool with higher weight for Feral Unicorn', async () => {
      // Given: Gym location
      const gymRequest = { location_id: testGymLocationId };
      const mockGymLocation = {
        id: testGymLocationId,
        location_type: 'gym'
      };

      const mockGymEnemy = {
        enemy_type_id: '63d218fc-5cd9-4404-9090-fb72537da205', // Feral Unicorn
        tier: 2
      };

      mockFrom().single.mockResolvedValueOnce({
        data: mockGymLocation,
        error: null
      });

      mockRpc.mockResolvedValueOnce({
        data: mockGymEnemy,
        error: null
      });

      // When: Starting combat at gym
      const response = await request(app)
        .post('/api/v1/combat/start')
        .set('Authorization', 'Bearer valid-token')
        .send(gymRequest);

      // Then: Should query gym-specific pool
      expect(mockRpc).toHaveBeenCalledWith(
        'select_enemy_from_pool',
        expect.objectContaining({
          p_location_type: 'gym'
        })
      );
    });

    it('should scale enemy stats by tier correctly', async () => {
      // Given: Tier 3 enemy
      const mockTier3Enemy = {
        enemy_type_id: 'beb6ea68-597a-4052-92f6-ad73d0fd02b3',
        tier: 3,
        base_hp: 100,
        base_atk: 20,
        base_def: 8
      };

      mockFrom().single.mockResolvedValueOnce({
        data: { location_type: 'park' },
        error: null
      });

      mockRpc.mockResolvedValueOnce({
        data: mockTier3Enemy,
        error: null
      });

      // When: Starting combat
      const response = await request(app)
        .post('/api/v1/combat/start')
        .set('Authorization', 'Bearer valid-token')
        .send(startCombatRequest);

      // Then: Enemy stats should be scaled by tier
      expect(response.body.session.enemy_hp).toBe(300); // base_hp * tier (100 * 3)
      expect(response.body.session.max_enemy_hp).toBe(300);
    });

    it('should return 404 for invalid location_id', async () => {
      // Given: Invalid location
      const invalidRequest = { location_id: invalidLocationId };

      mockFrom().single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' } // Not found
      });

      // When: Starting combat at invalid location
      const response = await request(app)
        .post('/api/v1/combat/start')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidRequest);

      // Then: Should return 404
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('Location not found');
    });

    it('should return 401 without authentication', async () => {
      // When: Starting combat without auth token
      const response = await request(app)
        .post('/api/v1/combat/start')
        .send(startCombatRequest);

      // Then: Should return 401
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('missing_token');
    });
  });

  // ============================================================================
  // 2. Hit Zone Detection Tests
  // ============================================================================

  describe('POST /api/v1/combat/attack', () => {
    const attackRequest = {
      session_id: testSessionId,
      tap_position: 0.0 // Start of dial (0 degrees)
    };

    beforeEach(() => {
      // Mock active combat session in Redis
      const mockSession = {
        session_id: testSessionId,
        player_id: testUserId,
        enemy_hp: 100,
        player_hp: 90,
        turn_number: 2
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockSession));
      mockRedisExists.mockResolvedValue(1);
    });

    it('should correctly identify injure zone at tap_position=0.0', async () => {
      // Given: Weapon bands for medium accuracy player
      const mockWeaponBands = {
        deg_injure: 5,
        deg_miss: 45,
        deg_graze: 60,
        deg_normal: 200,
        deg_crit: 50
      };

      mockRpc.mockResolvedValueOnce({
        data: mockWeaponBands,
        error: null
      });

      // When: Attacking at position 0 (injure zone: 0-5 degrees)
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...attackRequest, tap_position: 0.0 });

      // Then: Should detect injure zone
      expect(response.status).toBe(200);
      expect(response.body.attack_result.hit_zone).toBe('injure');
      expect(response.body.attack_result.player_damage).toBeGreaterThan(0);
      expect(response.body.attack_result.enemy_damage).toBe(0);
    });

    it('should correctly identify miss zone', async () => {
      // Given: Standard weapon bands
      const mockWeaponBands = {
        deg_injure: 5,
        deg_miss: 45,
        deg_graze: 60,
        deg_normal: 200,
        deg_crit: 50
      };

      mockRpc.mockResolvedValueOnce({
        data: mockWeaponBands,
        error: null
      });

      // When: Attacking in miss zone (5-50 degrees)
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...attackRequest, tap_position: 0.139 }); // ~25 degrees

      // Then: Should detect miss zone
      expect(response.body.attack_result.hit_zone).toBe('miss');
      expect(response.body.attack_result.player_damage).toBe(0);
      expect(response.body.attack_result.enemy_damage).toBe(0);
    });

    it('should correctly identify crit zone', async () => {
      // Given: Standard weapon bands
      mockRpc.mockResolvedValueOnce({
        data: {
          deg_injure: 5,
          deg_miss: 45,
          deg_graze: 60,
          deg_normal: 200,
          deg_crit: 50
        },
        error: null
      });

      // When: Attacking in crit zone (310-360 degrees)
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...attackRequest, tap_position: 0.92 }); // ~330 degrees

      // Then: Should detect crit zone
      expect(response.body.attack_result.hit_zone).toBe('crit');
      expect(response.body.attack_result.is_critical).toBe(true);
      expect(response.body.attack_result.enemy_damage).toBeGreaterThan(0);
    });

    it('should use fn_weapon_bands_adjusted() for accuracy scaling', async () => {
      // Given: High accuracy player
      const mockSession = {
        session_id: testSessionId,
        player_id: testUserId,
        player_accuracy: 0.95
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockSession));

      // When: Calculating weapon bands
      await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send(attackRequest);

      // Then: Should call fn_weapon_bands_adjusted with player accuracy
      expect(mockRpc).toHaveBeenCalledWith(
        'fn_weapon_bands_adjusted',
        expect.objectContaining({
          p_player_accuracy: 0.95
        })
      );
    });

    it('should have smaller injure/miss zones for high accuracy player', async () => {
      // Given: High accuracy player gets better weapon bands
      const mockAdjustedBands = {
        deg_injure: 3,    // Smaller injure zone
        deg_miss: 30,     // Smaller miss zone
        deg_graze: 60,
        deg_normal: 200,
        deg_crit: 67      // Larger crit zone
      };

      mockRpc.mockResolvedValueOnce({
        data: mockAdjustedBands,
        error: null
      });

      // When: Attacking at position that would be injure for low accuracy
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...attackRequest, tap_position: 0.022 }); // ~8 degrees

      // Then: Should be miss zone for high accuracy player
      expect(response.body.attack_result.hit_zone).toBe('miss');
    });
  });

  // ============================================================================
  // 3. Damage Calculation Tests
  // ============================================================================

  describe('Damage Calculations', () => {
    beforeEach(() => {
      const mockSession = {
        session_id: testSessionId,
        player_id: testUserId,
        player_atk: 50,
        player_def: 20,
        enemy_atk: 40,
        enemy_def: 15,
        player_hp: 100,
        enemy_hp: 120
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockSession));
    });

    it('should apply -50% damage multiplier for injure hit', async () => {
      // Given: Injure hit zone
      mockRpc.mockResolvedValueOnce({
        data: { deg_injure: 10, deg_miss: 50, deg_graze: 60, deg_normal: 200, deg_crit: 40 },
        error: null
      });

      // When: Player gets injure hit
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: testSessionId,
          tap_position: 0.0 // Injure zone
        });

      // Then: Player should take damage (negative multiplier)
      expect(response.body.attack_result.hit_zone).toBe('injure');
      expect(response.body.attack_result.player_damage).toBeGreaterThan(0);
      expect(response.body.attack_result.enemy_damage).toBe(0);

      // Player damage = enemy_atk - player_def = 40 - 20 = 20
      expect(response.body.attack_result.player_damage).toBe(20);
    });

    it('should deal 0 damage for miss hit', async () => {
      // When: Player misses
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: testSessionId,
          tap_position: 0.083 // Miss zone (~30 degrees)
        });

      // Then: No damage dealt to either side
      expect(response.body.attack_result.hit_zone).toBe('miss');
      expect(response.body.attack_result.player_damage).toBe(0);
      expect(response.body.attack_result.enemy_damage).toBe(0);
    });

    it('should deal 60% base damage for graze hit', async () => {
      // When: Player hits graze zone
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: testSessionId,
          tap_position: 0.167 // Graze zone (~60 degrees)
        });

      // Then: Should deal 60% damage
      expect(response.body.attack_result.hit_zone).toBe('graze');
      expect(response.body.attack_result.player_damage).toBe(0);

      // Enemy damage = (player_atk * 0.6) - enemy_def = (50 * 0.6) - 15 = 15
      expect(response.body.attack_result.enemy_damage).toBe(15);
    });

    it('should deal 100% base damage for normal hit', async () => {
      // When: Player hits normal zone
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: testSessionId,
          tap_position: 0.5 // Normal zone (~180 degrees)
        });

      // Then: Should deal full damage
      expect(response.body.attack_result.hit_zone).toBe('normal');
      expect(response.body.attack_result.player_damage).toBe(0);

      // Enemy damage = player_atk - enemy_def = 50 - 15 = 35
      expect(response.body.attack_result.enemy_damage).toBe(35);
    });

    it('should deal 160% + random bonus for critical hit', async () => {
      // When: Player hits crit zone
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: testSessionId,
          tap_position: 0.92 // Crit zone (~330 degrees)
        });

      // Then: Should deal enhanced damage
      expect(response.body.attack_result.hit_zone).toBe('crit');
      expect(response.body.attack_result.is_critical).toBe(true);
      expect(response.body.attack_result.player_damage).toBe(0);

      // Base crit damage = player_atk * 1.6 - enemy_def = 50 * 1.6 - 15 = 65
      // Plus random 0-100% bonus = 65 + (0 to 50) = 65-115
      expect(response.body.attack_result.enemy_damage).toBeGreaterThanOrEqual(65);
      expect(response.body.attack_result.enemy_damage).toBeLessThanOrEqual(115);
    });

    it('should enforce minimum 1 damage', async () => {
      // Given: Low attack vs high defense
      const mockWeakSession = {
        session_id: testSessionId,
        player_id: testUserId,
        player_atk: 10,
        enemy_def: 50, // Much higher than attack
        player_hp: 100,
        enemy_hp: 120
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockWeakSession));

      // When: Player hits normal
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: testSessionId,
          tap_position: 0.5 // Normal hit
        });

      // Then: Should deal minimum 1 damage
      expect(response.body.attack_result.enemy_damage).toBe(1);
    });

    it('should trigger enemy counterattack after player hit', async () => {
      // When: Player successfully hits enemy
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: testSessionId,
          tap_position: 0.5 // Normal hit
        });

      // Then: Enemy should counterattack
      expect(response.body.attack_result.enemy_counterattack).toBeDefined();
      expect(response.body.attack_result.enemy_counterattack.damage).toBeGreaterThan(0);

      // Counterattack damage = enemy_atk - player_def = 40 - 20 = 20
      expect(response.body.attack_result.enemy_counterattack.damage).toBe(20);
    });

    it('should update HP values correctly in session', async () => {
      // When: Player deals damage and receives counterattack
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: testSessionId,
          tap_position: 0.5 // Normal hit (35 damage to enemy, 20 back to player)
        });

      // Then: Session should be updated with new HP values
      expect(response.body.session.player_hp).toBe(80); // 100 - 20
      expect(response.body.session.enemy_hp).toBe(85);  // 120 - 35
      expect(response.body.session.turn_number).toBe(3); // Incremented

      // Should update Redis session
      expect(mockRedisSetEx).toHaveBeenCalledWith(
        expect.stringMatching(/^combat:session:/),
        900,
        expect.stringContaining('"player_hp":80')
      );
    });
  });

  // ============================================================================
  // 4. Combat End Conditions Tests
  // ============================================================================

  describe('Combat End Conditions', () => {
    it('should detect victory when enemy HP reaches 0', async () => {
      // Given: Enemy at low HP
      const mockLowEnemySession = {
        session_id: testSessionId,
        player_id: testUserId,
        player_atk: 50,
        enemy_def: 15,
        player_hp: 100,
        enemy_hp: 30, // Low HP
        max_enemy_hp: 120
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockLowEnemySession));

      // When: Player deals fatal blow
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: testSessionId,
          tap_position: 0.5 // Normal hit (35 damage)
        });

      // Then: Should detect victory
      expect(response.body.combat_status).toBe('victory');
      expect(response.body.session.enemy_hp).toBe(0);
      expect(response.body.combat_complete).toBe(true);
    });

    it('should detect defeat when player HP reaches 0', async () => {
      // Given: Player at low HP
      const mockLowPlayerSession = {
        session_id: testSessionId,
        player_id: testUserId,
        player_def: 20,
        enemy_atk: 40,
        player_hp: 15, // Low HP
        enemy_hp: 100,
        max_player_hp: 100
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockLowPlayerSession));

      // When: Player takes counterattack that kills them
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: testSessionId,
          tap_position: 0.5 // Hit followed by 20 damage counterattack
        });

      // Then: Should detect defeat
      expect(response.body.combat_status).toBe('defeat');
      expect(response.body.session.player_hp).toBe(0);
      expect(response.body.combat_complete).toBe(true);
    });

    it('should continue combat when both combatants alive', async () => {
      // Given: Both at healthy HP
      const mockOngoingSession = {
        session_id: testSessionId,
        player_hp: 70,
        enemy_hp: 80
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockOngoingSession));

      // When: Player attacks
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: testSessionId,
          tap_position: 0.5
        });

      // Then: Should continue combat
      expect(response.body.combat_status).toBe('ongoing');
      expect(response.body.combat_complete).toBe(false);
      expect(response.body.session.player_hp).toBeGreaterThan(0);
      expect(response.body.session.enemy_hp).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // 5. Combat Completion and Loot Tests
  // ============================================================================

  describe('POST /api/v1/combat/complete', () => {
    const completeRequest = {
      session_id: testSessionId,
      result: 'victory'
    };

    it('should award loot for victory', async () => {
      // Given: Victory session
      const mockVictorySession = {
        session_id: testSessionId,
        player_id: testUserId,
        enemy_type_id: 'd9e715fb-5de0-4639-96f8-3b4f03476314',
        player_hp: 50,
        enemy_hp: 0,
        combat_level: 1
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockVictorySession));

      // Mock loot generation
      const mockLoot = {
        gold_earned: 25,
        items_found: [
          { item_type_id: 'magic-wand-id', quantity: 1 }
        ],
        materials_found: [
          { material_id: 'wood-id', style_id: 'normal', quantity: 3 }
        ],
        experience_gained: 50
      };

      mockRpc.mockResolvedValueOnce({
        data: mockLoot,
        error: null
      });

      // When: Completing combat with victory
      const response = await request(app)
        .post('/api/v1/combat/complete')
        .set('Authorization', 'Bearer valid-token')
        .send(completeRequest);

      // Then: Should award loot
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.rewards).toMatchObject({
        gold_earned: 25,
        items_found: expect.any(Array),
        materials_found: expect.any(Array),
        experience_gained: 50
      });

      // Should call loot generation with correct level
      expect(mockRpc).toHaveBeenCalledWith(
        'generate_combat_loot',
        expect.objectContaining({
          p_combat_level: 1,
          p_enemy_type_id: 'd9e715fb-5de0-4639-96f8-3b4f03476314'
        })
      );
    });

    it('should not award loot for defeat', async () => {
      // Given: Defeat session
      const mockDefeatSession = {
        session_id: testSessionId,
        player_id: testUserId,
        player_hp: 0,
        enemy_hp: 30
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockDefeatSession));

      // When: Completing combat with defeat
      const response = await request(app)
        .post('/api/v1/combat/complete')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: testSessionId,
          result: 'defeat'
        });

      // Then: Should not award loot
      expect(response.body.rewards).toBeNull();
      expect(mockRpc).not.toHaveBeenCalledWith('generate_combat_loot', expect.anything());
    });

    it('should cleanup session after completion', async () => {
      // Given: Valid session
      mockRedisGet.mockResolvedValue(JSON.stringify({
        session_id: testSessionId,
        player_id: testUserId
      }));

      // When: Completing combat
      const response = await request(app)
        .post('/api/v1/combat/complete')
        .set('Authorization', 'Bearer valid-token')
        .send(completeRequest);

      // Then: Should delete Redis session
      expect(mockRedisDel).toHaveBeenCalledWith(`combat:session:${testSessionId}`);
    });

    it('should return 404 for invalid session_id', async () => {
      // Given: No session in Redis
      mockRedisGet.mockResolvedValue(null);

      // When: Completing non-existent combat
      const response = await request(app)
        .post('/api/v1/combat/complete')
        .set('Authorization', 'Bearer valid-token')
        .send(completeRequest);

      // Then: Should return 404
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ============================================================================
  // 6. Pool Selection Tests
  // ============================================================================

  describe('Enemy Pool Selection', () => {
    it('should select from universal pool when no location-specific pool exists', async () => {
      // Given: Location without specific enemy pools
      const mockGenericLocation = {
        id: testLocationId,
        location_type: 'residential',
        state: 'California'
      };

      mockFrom().single.mockResolvedValueOnce({
        data: mockGenericLocation,
        error: null
      });

      // Mock: No location-specific pool found, fallback to universal
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { code: 'NO_LOCATION_SPECIFIC_POOL' }
      });

      // Mock: Universal pool selection
      mockRpc.mockResolvedValueOnce({
        data: { enemy_type_id: 'd9e715fb-5de0-4639-96f8-3b4f03476314' },
        error: null
      });

      // When: Starting combat
      await request(app)
        .post('/api/v1/combat/start')
        .set('Authorization', 'Bearer valid-token')
        .send({ location_id: testLocationId });

      // Then: Should fallback to universal pool
      expect(mockRpc).toHaveBeenCalledWith(
        'select_enemy_from_pool',
        expect.objectContaining({
          p_location_type: null // Universal pool query
        })
      );
    });

    it('should respect spawn_weight values in enemy selection', async () => {
      // Given: Pool with weighted enemies
      const mockWeightedSelection = {
        enemy_type_id: '63d218fc-5cd9-4404-9090-fb72537da205', // Higher weight enemy
        spawn_weight: 30
      };

      mockRpc.mockResolvedValueOnce({
        data: mockWeightedSelection,
        error: null
      });

      // When: Starting multiple combats (testing distribution)
      const response = await request(app)
        .post('/api/v1/combat/start')
        .set('Authorization', 'Bearer valid-token')
        .send({ location_id: testLocationId });

      // Then: Should use database's weighted random selection
      expect(mockRpc).toHaveBeenCalledWith(
        'select_enemy_from_pool',
        expect.any(Object)
      );
    });

    it('should match combat_level to enemy pools', async () => {
      // Given: Player at combat level 5
      mockRpc.mockResolvedValueOnce({
        data: { combat_level: 5 },
        error: null
      });

      // When: Starting combat
      await request(app)
        .post('/api/v1/combat/start')
        .set('Authorization', 'Bearer valid-token')
        .send({ location_id: testLocationId });

      // Then: Should query pools for level 5
      expect(mockRpc).toHaveBeenCalledWith(
        'select_enemy_from_pool',
        expect.objectContaining({
          p_combat_level: 5
        })
      );
    });
  });

  // ============================================================================
  // 7. Style Inheritance Tests
  // ============================================================================

  describe('Style Inheritance for Loot', () => {
    it('should inherit normal style_id from enemy with normal style', async () => {
      // Given: Enemy with normal style
      const mockNormalEnemy = {
        enemy_type_id: 'd9e715fb-5de0-4639-96f8-3b4f03476314',
        style_id: 'normal'
      };

      const mockSession = {
        session_id: testSessionId,
        enemy_type_id: mockNormalEnemy.enemy_type_id,
        enemy_style_id: 'normal'
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockSession));

      // Mock loot with inherited style
      const mockLoot = {
        materials_found: [
          { material_id: 'wood-id', style_id: 'normal', quantity: 2 }
        ]
      };

      mockRpc.mockResolvedValueOnce({
        data: mockLoot,
        error: null
      });

      // When: Completing combat
      const response = await request(app)
        .post('/api/v1/combat/complete')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: testSessionId,
          result: 'victory'
        });

      // Then: Materials should have normal style_id
      expect(response.body.rewards.materials_found[0].style_id).toBe('normal');
    });

    it('should inherit non-normal style_id from styled enemy', async () => {
      // Given: Enemy with special style
      const mockStyledEnemy = {
        enemy_type_id: '63d218fc-5cd9-4404-9090-fb72537da205',
        style_id: 'golden'
      };

      const mockSession = {
        session_id: testSessionId,
        enemy_type_id: mockStyledEnemy.enemy_type_id,
        enemy_style_id: 'golden'
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockSession));

      // Mock loot with inherited style
      const mockLoot = {
        materials_found: [
          { material_id: 'crystal-id', style_id: 'golden', quantity: 1 }
        ]
      };

      mockRpc.mockResolvedValueOnce({
        data: mockLoot,
        error: null
      });

      // When: Completing combat
      const response = await request(app)
        .post('/api/v1/combat/complete')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: testSessionId,
          result: 'victory'
        });

      // Then: Materials should inherit golden style_id
      expect(response.body.rewards.materials_found[0].style_id).toBe('golden');
    });

    it('should use correct drop_weight values for loot pools', async () => {
      // Given: Victory session
      const mockSession = {
        session_id: testSessionId,
        player_id: testUserId,
        combat_level: 3
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockSession));

      // When: Generating loot
      await request(app)
        .post('/api/v1/combat/complete')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: testSessionId,
          result: 'victory'
        });

      // Then: Should query loot pool with correct level
      expect(mockRpc).toHaveBeenCalledWith(
        'generate_combat_loot',
        expect.objectContaining({
          p_combat_level: 3
        })
      );
    });
  });

  // ============================================================================
  // 8. Session Management and Redis Tests
  // ============================================================================

  describe('Session Management', () => {
    it('should return 404 for expired session', async () => {
      // Given: Expired session (not in Redis)
      mockRedisGet.mockResolvedValue(null);
      mockRedisExists.mockResolvedValue(0);

      // When: Attacking with expired session
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: expiredSessionId,
          tap_position: 0.5
        });

      // Then: Should return 404
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('Combat session not found');
    });

    it('should return 404 for invalid session_id format', async () => {
      // When: Using malformed session ID
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: 'not-a-uuid',
          tap_position: 0.5
        });

      // Then: Should return validation error
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should support multiple concurrent sessions for different players', async () => {
      // Given: Two different player sessions
      const session1 = {
        session_id: 'session-player-1',
        player_id: 'player-1',
        player_hp: 100,
        enemy_hp: 120
      };

      const session2 = {
        session_id: 'session-player-2',
        player_id: 'player-2',
        player_hp: 90,
        enemy_hp: 100
      };

      // Mock Redis to return different sessions based on key
      mockRedisGet.mockImplementation((key) => {
        if (key.includes('session-player-1')) {
          return Promise.resolve(JSON.stringify(session1));
        } else if (key.includes('session-player-2')) {
          return Promise.resolve(JSON.stringify(session2));
        }
        return Promise.resolve(null);
      });

      // When: Both players attack simultaneously
      const [response1, response2] = await Promise.all([
        request(app)
          .post('/api/v1/combat/attack')
          .set('Authorization', 'Bearer token-player-1')
          .send({
            session_id: 'session-player-1',
            tap_position: 0.5
          }),
        request(app)
          .post('/api/v1/combat/attack')
          .set('Authorization', 'Bearer token-player-2')
          .send({
            session_id: 'session-player-2',
            tap_position: 0.3
          })
      ]);

      // Then: Both should work independently
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.session.session_id).toBe('session-player-1');
      expect(response2.body.session.session_id).toBe('session-player-2');
    });

    it('should use 15 minute TTL for combat sessions', async () => {
      // When: Creating a new combat session
      await request(app)
        .post('/api/v1/combat/start')
        .set('Authorization', 'Bearer valid-token')
        .send({ location_id: testLocationId });

      // Then: Should set 15 minute TTL (900 seconds)
      expect(mockRedisSetEx).toHaveBeenCalledWith(
        expect.any(String),
        900,
        expect.any(String)
      );
    });

    it('should extend session TTL on each action', async () => {
      // Given: Active session
      const mockSession = {
        session_id: testSessionId,
        player_id: testUserId,
        player_hp: 80,
        enemy_hp: 90
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockSession));

      // When: Player attacks
      await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: testSessionId,
          tap_position: 0.5
        });

      // Then: Should refresh TTL to 15 minutes
      expect(mockRedisSetEx).toHaveBeenCalledWith(
        expect.stringMatching(/^combat:session:/),
        900,
        expect.any(String)
      );
    });
  });
});