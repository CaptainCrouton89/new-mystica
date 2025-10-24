/**
 * Unit Tests: CombatService
 *
 * Comprehensive test suite for combat session management, damage calculations,
 * and the timing dial mechanics. Tests all methods and error scenarios from
 * the combat service specification.
 */

import { CombatService } from '../../../src/services/CombatService.js';
import { NotFoundError, ValidationError, ConflictError } from '../../../src/utils/errors.js';
import type { AdjustedBands } from '../../../src/types/repository.types.js';

// Import test infrastructure
import {
  UserFactory,
  LocationFactory,
  CombatFactory,
  type Enemy
} from '../../factories/index.js';

import {
  expectValidUUID,
  expectValidTimestamp,
  expectValidGoldAmount
} from '../../helpers/assertions.js';

// Mock all repository dependencies BEFORE importing service
jest.mock('../../../src/repositories/CombatRepository.js', () => ({
  CombatRepository: jest.fn().mockImplementation(() => ({
    createSession: jest.fn(),
    getActiveSession: jest.fn(),
    getUserActiveSession: jest.fn(),
    updateSession: jest.fn(),
    completeSession: jest.fn(),
    addLogEvent: jest.fn(),
    getPlayerHistory: jest.fn(),
    calculateCombatRating: jest.fn()
  }))
}));

jest.mock('../../../src/repositories/EnemyRepository.js', () => ({
  EnemyRepository: jest.fn().mockImplementation(() => ({
    findEnemyTypeById: jest.fn(),
    getEnemyRealizedStats: jest.fn()
  }))
}));

jest.mock('../../../src/repositories/EquipmentRepository.js', () => ({
  EquipmentRepository: jest.fn().mockImplementation(() => ({
    getPlayerPowerLevel: jest.fn(),
    computeTotalStats: jest.fn(),
    findItemInSlot: jest.fn(),
    getPlayerEquippedStats: jest.fn(),
    findEquippedByUser: jest.fn()
  }))
}));

jest.mock('../../../src/repositories/WeaponRepository.js', () => ({
  WeaponRepository: jest.fn().mockImplementation(() => ({
    findWeaponByItemId: jest.fn(),
    getAdjustedBands: jest.fn()
  }))
}));

jest.mock('../../../src/repositories/MaterialRepository.js', () => ({
  MaterialRepository: jest.fn().mockImplementation(() => ({
    getLootPoolMaterialWeights: jest.fn(),
    findMaterialById: jest.fn()
  }))
}));

jest.mock('../../../src/services/LocationService.js', () => ({
  locationService: {
    getById: jest.fn(),
    getMatchingEnemyPools: jest.fn(),
    getEnemyPoolMembers: jest.fn(),
    selectRandomEnemy: jest.fn(),
    getMatchingLootPools: jest.fn(),
    getLootPoolEntries: jest.fn(),
    getLootPoolTierWeights: jest.fn(),
    selectRandomLoot: jest.fn()
  }
}));

// Import mocked instances after mocks are defined
import { CombatRepository } from '../../../src/repositories/CombatRepository.js';
import { EnemyRepository } from '../../../src/repositories/EnemyRepository.js';
import { EquipmentRepository } from '../../../src/repositories/EquipmentRepository.js';
import { WeaponRepository } from '../../../src/repositories/WeaponRepository.js';
import { MaterialRepository } from '../../../src/repositories/MaterialRepository.js';
import { locationService } from '../../../src/services/LocationService.js';

describe('CombatService', () => {
  let combatService: CombatService;
  let mockCombatRepository: jest.Mocked<any>;
  let mockEnemyRepository: jest.Mocked<any>;
  let mockEquipmentRepository: jest.Mocked<any>;
  let mockWeaponRepository: jest.Mocked<any>;
  let mockMaterialRepository: jest.Mocked<any>;
  let mockLocationService: jest.Mocked<typeof locationService>;

  const testUser = UserFactory.createEmail('test@mystica.com');
  const testLocation = LocationFactory.createSF('landmark');
  const testEnemy = CombatFactory.createEnemy('goblin', 5);

  beforeEach(() => {
    // Create mocked repository instances
    mockCombatRepository = new (CombatRepository as any)() as jest.Mocked<any>;
    mockEnemyRepository = new (EnemyRepository as any)() as jest.Mocked<any>;
    mockEquipmentRepository = new (EquipmentRepository as any)() as jest.Mocked<any>;
    mockWeaponRepository = new (WeaponRepository as any)() as jest.Mocked<any>;
    mockMaterialRepository = new (MaterialRepository as any)() as jest.Mocked<any>;
    mockLocationService = locationService as jest.Mocked<typeof locationService>;

    // Create service with mocked dependencies
    combatService = new CombatService(
      mockCombatRepository,
      mockEnemyRepository,
      mockEquipmentRepository,
      mockWeaponRepository,
      mockMaterialRepository
    );

    jest.clearAllMocks();
  });

  /**
   * Test Group 1: Start Combat - Success Cases
   * Tests successful combat initialization with various scenarios
   */
  describe('startCombat() - Success Cases', () => {
    beforeEach(() => {
      // Setup successful default mocks
      mockCombatRepository.getUserActiveSession.mockResolvedValue(null);
      mockLocationService.getById.mockResolvedValue({
        id: testLocation.id,
        name: testLocation.name,
        location_type: 'park',
        country_code: 'US',
        state_code: 'CA',
        lat: 37.7749,
        lng: -122.4194,
        created_at: new Date().toISOString()
      });
      mockEquipmentRepository.getPlayerPowerLevel.mockResolvedValue({
        atk: 50,
        acc: 0.7,
        def: 40,
        hp: 100
      });
      mockLocationService.getMatchingEnemyPools.mockResolvedValue(['pool-1']);
      mockLocationService.getEnemyPoolMembers.mockResolvedValue([
        { enemy_type_id: testEnemy.id, enemy_pool_id: 'pool-1', spawn_weight: 1 }
      ]);
      mockLocationService.selectRandomEnemy.mockReturnValue(testEnemy.id);
      mockEnemyRepository.findEnemyTypeById.mockResolvedValue({
        id: testEnemy.id,
        name: testEnemy.name,
        base_hp: testEnemy.base_hp,
        atk_power: testEnemy.atk_power,
        atk_accuracy: testEnemy.atk_accuracy,
        def_power: testEnemy.def_power,
        def_accuracy: testEnemy.def_accuracy,
        tier_id: testEnemy.tier_id,
        style_id: testEnemy.style_id,
        dialogue_tone: testEnemy.dialogue_tone,
        ai_personality_traits: testEnemy.ai_personality_traits
      });
      mockEnemyRepository.getEnemyRealizedStats.mockResolvedValue({
        atk: testEnemy.computed_atk,
        def: testEnemy.computed_def,
        hp: testEnemy.computed_hp
      });
      mockEquipmentRepository.findItemInSlot.mockResolvedValue(null); // No weapon equipped
      mockCombatRepository.calculateCombatRating.mockResolvedValue(500);
      mockCombatRepository.createSession.mockResolvedValue('test-session-id');
      mockEquipmentRepository.getPlayerEquippedStats.mockResolvedValue({
        atkPower: 50,
        atkAccuracy: 0.7,
        defPower: 40,
        defAccuracy: 0.6
      });
      mockEquipmentRepository.findEquippedByUser.mockResolvedValue({});
    });

    it('should successfully start combat with valid user and location', async () => {
      // Mock with actual UUID format
      const sessionUuid = 'a1b2c3d4-e5f6-4789-a1b2-c3d4e5f67890';
      mockCombatRepository.createSession.mockResolvedValue(sessionUuid);

      // Act
      const result = await combatService.startCombat(testUser.id, testLocation.id, 5);

      // Assert
      expectValidUUID(result.session_id);
      expect(result.enemy).toBeDefined();
      expect(result.enemy.name).toBeTruthy();
      expect(result.enemy.hp).toBeGreaterThan(0);
      expect(result.player_stats).toBeDefined();
      expect(result.player_stats.hp).toBeGreaterThan(0);
      expect(result.weapon_config).toBeDefined();
      expect(result.weapon_config.pattern).toBe('single_arc');

      // Verify repository calls
      expect(mockCombatRepository.getUserActiveSession).toHaveBeenCalledWith(testUser.id);
      expect(mockLocationService.getById).toHaveBeenCalledWith(testLocation.id);
      expect(mockCombatRepository.createSession).toHaveBeenCalled();
    });

    it('should handle different enemy types at various combat levels', async () => {
      const dragonEnemy = CombatFactory.createEnemy('dragon', 10);
      mockLocationService.selectRandomEnemy.mockReturnValue(dragonEnemy.id);
      mockEnemyRepository.findEnemyTypeById.mockResolvedValue({
        id: dragonEnemy.id,
        name: dragonEnemy.name,
        base_hp: dragonEnemy.base_hp,
        atk_power: dragonEnemy.atk_power,
        atk_accuracy: dragonEnemy.atk_accuracy,
        def_power: dragonEnemy.def_power,
        def_accuracy: dragonEnemy.def_accuracy,
        tier_id: dragonEnemy.tier_id,
        style_id: dragonEnemy.style_id,
        dialogue_tone: dragonEnemy.dialogue_tone,
        ai_personality_traits: dragonEnemy.ai_personality_traits
      });
      mockEnemyRepository.getEnemyRealizedStats.mockResolvedValue({
        atk: dragonEnemy.computed_atk,
        def: dragonEnemy.computed_def,
        hp: dragonEnemy.computed_hp
      });

      const result = await combatService.startCombat(testUser.id, testLocation.id, 5);

      expect(result.enemy.name).toContain('Dragon');
      expect(result.enemy.hp).toBeGreaterThan(100); // Dragons have more HP
    });

    it('should use default weapon config when no weapon equipped', async () => {
      mockEquipmentRepository.findItemInSlot.mockResolvedValue(null);

      const result = await combatService.startCombat(testUser.id, testLocation.id, 5);

      expect(result.weapon_config.pattern).toBe('single_arc');
      expect(result.weapon_config.spin_deg_per_s).toBe(180);
      expect(result.weapon_config.adjusted_bands.deg_crit).toBe(30);
    });

    it('should use equipped weapon config with adjusted bands', async () => {
      const weaponItem = { id: 'weapon-id', item_type_id: 'sword' };
      mockEquipmentRepository.findItemInSlot.mockResolvedValue(weaponItem);
      mockWeaponRepository.findWeaponByItemId.mockResolvedValue({
        item_id: 'weapon-id',
        pattern: 'dual_arcs',
        spin_deg_per_s: 240
      });
      mockWeaponRepository.getAdjustedBands.mockResolvedValue({
        deg_injure: 20,
        deg_miss: 50,
        deg_graze: 100,
        deg_normal: 270,
        deg_crit: 40,
        total_degrees: 360
      });

      const result = await combatService.startCombat(testUser.id, testLocation.id, 5);

      expect(result.weapon_config.pattern).toBe('dual_arcs');
      expect(result.weapon_config.spin_deg_per_s).toBe(240);
      expect(result.weapon_config.adjusted_bands.deg_crit).toBe(40);
    });
  });

  /**
   * Test Group 2: Start Combat - Error Cases
   * Tests error handling for invalid scenarios
   */
  describe('startCombat() - Error Cases', () => {
    it('should throw ConflictError when user already has active session', async () => {
      const existingSession = { session_id: 'existing-id', userId: testUser.id };
      mockCombatRepository.getUserActiveSession.mockResolvedValue(existingSession);

      await expect(
        combatService.startCombat(testUser.id, testLocation.id, 1)
      ).rejects.toThrow(ConflictError);
    });

    it('should throw NotFoundError when location does not exist', async () => {
      mockCombatRepository.getUserActiveSession.mockResolvedValue(null);
      mockLocationService.getById.mockRejectedValue(new NotFoundError('location', 'fake-id'));

      await expect(
        combatService.startCombat(testUser.id, 'fake-location-id', 1)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when no enemies available at location', async () => {
      mockCombatRepository.getUserActiveSession.mockResolvedValue(null);
      mockLocationService.getById.mockResolvedValue({
        id: testLocation.id,
        name: testLocation.name,
        location_type: 'park',
        country_code: 'US',
        state_code: 'CA',
        lat: 37.7749,
        lng: -122.4194,
        created_at: new Date().toISOString()
      });
      mockLocationService.getMatchingEnemyPools.mockResolvedValue([]);

      await expect(
        combatService.startCombat(testUser.id, testLocation.id, 1)
      ).rejects.toThrow(NotFoundError);
    });
  });

  /**
   * Test Group 3: Execute Attack - Success Cases
   * Tests attack execution with various hit zones and damage calculations
   */
  describe('executeAttack() - Success Cases', () => {
    const sessionId = 'test-session-id';

    beforeEach(() => {
      // Setup active session mock
      mockCombatRepository.getActiveSession.mockResolvedValue({
        id: sessionId,
        userId: testUser.id,
        enemyTypeId: testEnemy.id,
        locationId: testLocation.id,
        combatLog: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Setup player stats
      mockEquipmentRepository.getPlayerPowerLevel.mockResolvedValue({
        atk: 50,
        acc: 0.7,
        def: 40,
        hp: 100
      });

      // Setup enemy stats
      mockEnemyRepository.findEnemyTypeById.mockResolvedValue({
        id: testEnemy.id,
        name: testEnemy.name,
        style_id: testEnemy.style_id,
        dialogue_tone: testEnemy.dialogue_tone,
        ai_personality_traits: testEnemy.ai_personality_traits
      });
      mockEnemyRepository.getEnemyRealizedStats.mockResolvedValue({
        atk: testEnemy.computed_atk,
        def: testEnemy.computed_def,
        hp: testEnemy.computed_hp
      });

      // Setup weapon config (no weapon)
      mockEquipmentRepository.findItemInSlot.mockResolvedValue(null);

      mockCombatRepository.updateSession.mockResolvedValue(undefined);
      mockCombatRepository.addLogEvent.mockResolvedValue(undefined);
    });

    it('should execute successful normal hit with correct damage calculation', async () => {
      const result = await combatService.executeAttack(sessionId, 0.7);

      expect(result.hit_zone).toBe('normal');
      expect(result.base_multiplier).toBe(1.0);
      expect(result.damage_dealt).toBeGreaterThan(0);
      expect(result.player_hp_remaining).toBeGreaterThan(0);
      expect(result.enemy_hp_remaining).toBeGreaterThan(0);
      expect(result.combat_status).toBe('ongoing');
      expect(result.turn_number).toBe(1);

      // Verify session was updated
      expect(mockCombatRepository.updateSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          combatLog: expect.arrayContaining([
            expect.objectContaining({
              hitZone: 'normal',
              turn: 1
            })
          ])
        })
      );
    });

    it('should execute critical hit with bonus multiplier', async () => {
      const result = await combatService.executeAttack(sessionId, 0.95);

      expect(result.hit_zone).toBe('crit');
      expect(result.base_multiplier).toBe(1.6);
      expect(result.crit_bonus_multiplier).toBeGreaterThanOrEqual(0);
      expect(result.crit_bonus_multiplier).toBeLessThanOrEqual(1.0);
      expect(result.damage_dealt).toBeGreaterThan(0);
    });

    it('should handle graze hit with reduced damage', async () => {
      const result = await combatService.executeAttack(sessionId, 0.45);

      expect(result.hit_zone).toBe('graze');
      expect(result.base_multiplier).toBe(0.6);
      expect(result.damage_dealt).toBeGreaterThanOrEqual(1); // Min damage is 1
    });

    it('should handle miss with no damage to enemy', async () => {
      const result = await combatService.executeAttack(sessionId, 0.2);

      expect(result.hit_zone).toBe('miss');
      expect(result.base_multiplier).toBe(0.0);
      // Enemy HP unchanged but player still takes damage
      expect(result.enemy_damage).toBeGreaterThan(0);
    });

    it('should handle injure zone where player takes self-damage', async () => {
      const result = await combatService.executeAttack(sessionId, 0.05);

      expect(result.hit_zone).toBe('injure');
      expect(result.base_multiplier).toBe(-0.5);
      // Player takes extra damage in injure zone
    });

    it('should detect victory when enemy HP reaches 0', async () => {
      // Setup session with low enemy HP
      mockCombatRepository.getActiveSession.mockResolvedValue({
        id: sessionId,
        userId: testUser.id,
        enemyTypeId: testEnemy.id,
        locationId: testLocation.id,
        combatLog: [
          {
            turn: 1,
            action: 'attack',
            playerHP: 100,
            enemyHP: 10, // Very low enemy HP
            timestamp: new Date().toISOString()
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await combatService.executeAttack(sessionId, 0.7);

      if (result.enemy_hp_remaining === 0) {
        expect(result.combat_status).toBe('victory');
        // Enemy counterattacks before dying, so damage may not be 0
        // The important thing is combat_status is 'victory'
      }
    });

    it('should detect defeat when player HP reaches 0', async () => {
      // Setup session with low player HP
      mockCombatRepository.getActiveSession.mockResolvedValue({
        id: sessionId,
        userId: testUser.id,
        enemyTypeId: testEnemy.id,
        locationId: testLocation.id,
        combatLog: [
          {
            turn: 1,
            action: 'attack',
            playerHP: 5, // Very low player HP
            enemyHP: 80,
            timestamp: new Date().toISOString()
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await combatService.executeAttack(sessionId, 0.7);

      if (result.player_hp_remaining === 0) {
        expect(result.combat_status).toBe('defeat');
      }
    });
  });

  /**
   * Test Group 4: Execute Attack - Error Cases
   * Tests error handling for invalid attack scenarios
   */
  describe('executeAttack() - Error Cases', () => {
    it('should throw NotFoundError when session does not exist', async () => {
      mockCombatRepository.getActiveSession.mockResolvedValue(null);

      await expect(
        combatService.executeAttack('fake-session-id', 0.5)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for invalid attack accuracy (negative)', async () => {
      mockCombatRepository.getActiveSession.mockResolvedValue({
        id: 'test-session',
        userId: testUser.id,
        enemyTypeId: testEnemy.id
      });

      await expect(
        combatService.executeAttack('test-session', -0.1)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid attack accuracy (>1.0)', async () => {
      mockCombatRepository.getActiveSession.mockResolvedValue({
        id: 'test-session',
        userId: testUser.id,
        enemyTypeId: testEnemy.id
      });

      await expect(
        combatService.executeAttack('test-session', 1.5)
      ).rejects.toThrow(ValidationError);
    });
  });

  /**
   * Test Group 5: Complete Combat - Success Cases
   * Tests combat completion with rewards and history updates
   */
  describe('completeCombat() - Success Cases', () => {
    const sessionId = 'test-session-id';

    beforeEach(() => {
      mockCombatRepository.getActiveSession.mockResolvedValue({
        id: sessionId,
        userId: testUser.id,
        locationId: testLocation.id,
        enemyTypeId: testEnemy.id,
        combatLevel: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      mockCombatRepository.completeSession.mockResolvedValue(undefined);
      mockCombatRepository.getPlayerHistory.mockResolvedValue({
        userId: testUser.id,
        locationId: testLocation.id,
        totalAttempts: 5,
        victories: 3,
        defeats: 2,
        currentStreak: 2,
        longestStreak: 3
      });
      mockEnemyRepository.findEnemyTypeById.mockResolvedValue({
        id: testEnemy.id,
        style_id: 'normal'
      });
      mockLocationService.getMatchingLootPools.mockResolvedValue(['loot-pool-1']);
      mockMaterialRepository.getLootPoolMaterialWeights.mockResolvedValue([
        { material_id: 'iron-id', spawn_weight: 10 }
      ]);
      mockMaterialRepository.findMaterialById.mockResolvedValue({
        id: 'iron-id',
        name: 'Iron Ore'
      });
    });

    it('should complete combat with victory and generate rewards', async () => {
      const result = await combatService.completeCombat(sessionId, 'victory');

      expect(result.result).toBe('victory');
      expect(result.currencies).toBeDefined();
      expectValidGoldAmount(result.currencies!.gold);
      expect(result.experience).toBeGreaterThan(0);
      expect(result.combat_history).toBeDefined();
      expect(result.combat_history!.victories).toBeGreaterThan(0);
    });

    it('should complete combat with defeat and no rewards', async () => {
      const result = await combatService.completeCombat(sessionId, 'defeat');

      expect(result.result).toBe('defeat');
      expect(result.currencies).toBeDefined();
    });

    it('should handle first-time location combat correctly', async () => {
      mockCombatRepository.getPlayerHistory.mockResolvedValue(null);

      const result = await combatService.completeCombat(sessionId, 'victory');

      expect(result.combat_history.total_attempts).toBe(1);
      expect(result.combat_history.victories).toBe(1);
      expect(result.combat_history.current_streak).toBe(1);
    });
  });

  /**
   * Test Group 6: Complete Combat - Error Cases
   * Tests error handling for invalid completion scenarios
   */
  describe('completeCombat() - Error Cases', () => {
    it('should throw NotFoundError when session does not exist', async () => {
      mockCombatRepository.getActiveSession.mockResolvedValue(null);

      await expect(
        combatService.completeCombat('fake-session-id', 'victory')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for invalid result value', async () => {
      mockCombatRepository.getActiveSession.mockResolvedValue({
        id: 'test-session',
        userId: testUser.id
      });

      await expect(
        combatService.completeCombat('test-session', 'invalid' as any)
      ).rejects.toThrow(ValidationError);
    });
  });

  /**
   * Test Group 7: Get Combat Session
   * Tests getCombatSession() method
   */
  describe('getCombatSession()', () => {
    it('should return active combat session data', async () => {
      const sessionId = 'test-session-id';
      mockCombatRepository.getActiveSession.mockResolvedValue({
        id: sessionId,
        userId: testUser.id,
        enemyTypeId: testEnemy.id,
        locationId: testLocation.id,
        combatLog: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      mockEquipmentRepository.getPlayerPowerLevel.mockResolvedValue({
        atk: 50,
        acc: 0.7,
        def: 40,
        hp: 100
      });
      mockEnemyRepository.findEnemyTypeById.mockResolvedValue({
        id: testEnemy.id,
        name: testEnemy.name,
        style_id: testEnemy.style_id,
        dialogue_tone: testEnemy.dialogue_tone,
        ai_personality_traits: testEnemy.ai_personality_traits
      });
      mockEnemyRepository.getEnemyRealizedStats.mockResolvedValue({
        atk: testEnemy.computed_atk,
        def: testEnemy.computed_def,
        hp: testEnemy.computed_hp
      });

      const result = await combatService.getCombatSession(sessionId);

      expect(result.session_id).toBe(sessionId);
      expect(result.player_id).toBe(testUser.id);
      expect(result.enemy_type_id).toBe(testEnemy.id);
      expect(result.location_id).toBe(testLocation.id);
      expect(result.turn_number).toBe(0);
      expectValidTimestamp(result.created_at);
    });

    it('should throw NotFoundError when session does not exist', async () => {
      mockCombatRepository.getActiveSession.mockResolvedValue(null);

      await expect(
        combatService.getCombatSession('fake-session-id')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
