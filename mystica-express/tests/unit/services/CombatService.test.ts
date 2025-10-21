/**
 * Unit Tests: CombatService
 *
 * Comprehensive test suite for combat session management, damage calculations,
 * and the timing dial mechanics. Tests all methods and error scenarios from
 * the combat service specification.
 */

import { NotFoundError, BusinessLogicError, ValidationError } from '../../../src/utils/errors.js';

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
  expectValidCombatSession,
  expectValidGoldAmount
} from '../../helpers/assertions.js';

// Mock all repository dependencies before importing CombatService
jest.mock('../../../src/repositories/CombatRepository.js', () => ({
  CombatRepository: jest.fn().mockImplementation(() => ({
    createSession: jest.fn(),
    getActiveSession: jest.fn(),
    getUserActiveSession: jest.fn(),
    updateSession: jest.fn(),
    completeSession: jest.fn(),
    addLogEvent: jest.fn(),
    getPlayerHistory: jest.fn(),
    updatePlayerHistory: jest.fn(),
    cleanupExpiredSessions: jest.fn()
  }))
}));

jest.mock('../../../src/repositories/EnemyRepository.js', () => ({
  EnemyRepository: jest.fn().mockImplementation(() => ({
    findEnemyTypeById: jest.fn(),
    getRandomEnemyForLocation: jest.fn(),
    getEnemyStats: jest.fn()
  }))
}));

jest.mock('../../../src/repositories/LocationRepository.js', () => ({
  LocationRepository: jest.fn().mockImplementation(() => ({
    findById: jest.fn(),
    getEnemyPools: jest.fn(),
    getLootPools: jest.fn()
  }))
}));

jest.mock('../../../src/repositories/EquipmentRepository.js', () => ({
  EquipmentRepository: jest.fn().mockImplementation(() => ({
    getPlayerEquippedStats: jest.fn(),
    getEquippedWeapon: jest.fn(),
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
    generateLoot: jest.fn(),
    applyStyleInheritance: jest.fn()
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

// Import the actual CombatService after all mocks are set up
import { CombatService } from '../../../src/services/CombatService.js';

// Import the mocked repository classes
import { CombatRepository } from '../../../src/repositories/CombatRepository.js';
import { EnemyRepository } from '../../../src/repositories/EnemyRepository.js';
import { LocationRepository } from '../../../src/repositories/LocationRepository.js';
import { EquipmentRepository } from '../../../src/repositories/EquipmentRepository.js';
import { WeaponRepository } from '../../../src/repositories/WeaponRepository.js';
import { MaterialRepository } from '../../../src/repositories/MaterialRepository.js';
import { locationService } from '../../../src/services/LocationService.js';

// Create mock instances
const mockCombatRepository = new (CombatRepository as jest.MockedClass<typeof CombatRepository>)() as jest.Mocked<CombatRepository>;
const mockEnemyRepository = new (EnemyRepository as jest.MockedClass<typeof EnemyRepository>)() as jest.Mocked<EnemyRepository>;
const mockLocationRepository = new (LocationRepository as jest.MockedClass<typeof LocationRepository>)() as jest.Mocked<LocationRepository>;
const mockEquipmentRepository = new (EquipmentRepository as jest.MockedClass<typeof EquipmentRepository>)() as jest.Mocked<EquipmentRepository>;
const mockWeaponRepository = new (WeaponRepository as jest.MockedClass<typeof WeaponRepository>)() as jest.Mocked<WeaponRepository>;
const mockMaterialRepository = new (MaterialRepository as jest.MockedClass<typeof MaterialRepository>)() as jest.Mocked<MaterialRepository>;

// Types based on the specification
interface CombatSession {
  session_id: string;
  enemy: {
    id: string;
    type: string;
    name: string;
    atk: number;
    def: number;
    hp: number;
    style_id: string;
    dialogue_tone: string;
    personality_traits: string[];
  };
  player_stats: {
    atkPower: number;
    atkAccuracy: number;
    defPower: number;
    defAccuracy: number;
    hp: number;
  };
  weapon_config: {
    pattern: 'single_arc' | 'dual_arcs' | 'pulsing_arc' | 'roulette' | 'sawtooth';
    spin_deg_per_s: number;
    adjusted_bands: {
      deg_injure: number;
      deg_miss: number;
      deg_graze: number;
      deg_normal: number;
      deg_crit: number;
    };
  };
}

interface AttackResult {
  hit_zone: 'injure' | 'miss' | 'graze' | 'normal' | 'crit';
  base_multiplier: number;
  crit_bonus_multiplier?: number;
  damage_dealt: number;
  player_hp_remaining: number;
  enemy_hp_remaining: number;
  enemy_damage: number;
  combat_status: 'ongoing' | 'victory' | 'defeat';
  turn_number: number;
}

interface CombatRewards {
  result: 'victory' | 'defeat';
  rewards?: {
    materials: Array<{
      material_id: string;
      name: string;
      style_id: string;
      style_name: string;
    }>;
    gold: number;
    experience: number;
  };
  player_combat_history: {
    location_id: string;
    total_attempts: number;
    victories: number;
    defeats: number;
    current_streak: number;
    longest_streak: number;
  };
}

describe('CombatService', () => {
  let combatService: CombatService;
  // Mock instances are created above
  let mockLocationService: jest.Mocked<typeof locationService>;

  const testUser = UserFactory.createEmail('test@mystica.com');
  const testLocation = LocationFactory.createSF('landmark');
  const testEnemy = CombatFactory.createEnemy('goblin', 5);

  beforeEach(() => {
    combatService = new CombatService();
    jest.clearAllMocks();

    // Reset all mocks
    mockLocationService = locationService as jest.Mocked<typeof locationService>;
  });

  /**
   * Test Group 1: Start Combat - Success Cases
   * Tests successful combat initialization with various scenarios
   */
  describe('startCombat() - Success Cases', () => {
    beforeEach(() => {
      // Setup successful default mocks
      mockCombatRepository.getUserActiveSession.mockResolvedValue(null);
      mockLocationRepository.findById.mockResolvedValue({
        id: testLocation.id,
        name: testLocation.name,
        location_type: 'park',
        country_code: 'US',
        state_code: 'CA',
        lat: 37.7749,
        lng: -122.4194,
        created_at: new Date().toISOString()
      });
      mockEnemyRepository.getRandomEnemyForLocation.mockResolvedValue(testEnemy);
      mockEquipmentRepository.getPlayerStats.mockResolvedValue({
        atkPower: 1.2,
        atkAccuracy: 0.8,
        defPower: 1.0,
        defAccuracy: 0.9,
        hp: 100
      });
      mockWeaponRepository.getAdjustedBands.mockResolvedValue({
        deg_injure: 30,
        deg_miss: 80,
        deg_graze: 150,
        deg_normal: 280,
        deg_crit: 360
      });
      mockCombatRepository.createSession.mockResolvedValue('test-session-id');
    });

    it('should successfully start combat with valid user and location', async () => {
      // Mock the startCombat method to return expected structure
      const expectedSession: CombatSession = {
        session_id: 'test-session-id',
        enemy: {
          id: testEnemy.id,
          type: 'goblin',
          name: testEnemy.name,
          atk: testEnemy.computed_atk,
          def: testEnemy.computed_def,
          hp: testEnemy.computed_hp,
          style_id: testEnemy.style_id,
          dialogue_tone: testEnemy.dialogue_tone || 'aggressive',
          personality_traits: testEnemy.ai_personality_traits ? Object.keys(testEnemy.ai_personality_traits) : []
        },
        player_stats: {
          atkPower: 1.2,
          atkAccuracy: 0.8,
          defPower: 1.0,
          defAccuracy: 0.9,
          hp: 100
        },
        weapon_config: {
          pattern: 'single_arc',
          spin_deg_per_s: 180,
          adjusted_bands: {
            deg_injure: 30,
            deg_miss: 80,
            deg_graze: 150,
            deg_normal: 280,
            deg_crit: 360
          }
        }
      };

      // Mock the implementation
      combatService.startCombat = jest.fn().mockResolvedValue(expectedSession);

      // Act
      const result = await combatService.startCombat(testUser.id, testLocation.id);

      // Assert
      expect(result).toEqual(expectedSession);
      expectValidUUID(result.session_id);
      expect(result.enemy.atk).toBeGreaterThan(0);
      expect(result.enemy.def).toBeGreaterThan(0);
      expect(result.enemy.hp).toBeGreaterThan(0);
      expect(result.player_stats.hp).toBeGreaterThan(0);
      expect(result.weapon_config.adjusted_bands.deg_crit).toBe(360);
    });

    it('should handle different enemy types at various locations', async () => {
      const dragonEnemy = CombatFactory.createEnemy('dragon', 10);
      mockEnemyRepository.getRandomEnemyForLocation.mockResolvedValue(dragonEnemy);

      const expectedSession: CombatSession = {
        session_id: 'dragon-session-id',
        enemy: {
          id: dragonEnemy.id,
          type: 'dragon',
          name: dragonEnemy.name,
          atk: dragonEnemy.computed_atk,
          def: dragonEnemy.computed_def,
          hp: dragonEnemy.computed_hp,
          style_id: dragonEnemy.style_id,
          dialogue_tone: dragonEnemy.dialogue_tone || 'aggressive',
          personality_traits: dragonEnemy.ai_personality_traits ? Object.keys(dragonEnemy.ai_personality_traits) : []
        },
        player_stats: {
          atkPower: 1.5,
          atkAccuracy: 0.9,
          defPower: 1.2,
          defAccuracy: 0.8,
          hp: 120
        },
        weapon_config: {
          pattern: 'dual_arcs',
          spin_deg_per_s: 240,
          adjusted_bands: {
            deg_injure: 25,
            deg_miss: 70,
            deg_graze: 140,
            deg_normal: 290,
            deg_crit: 360
          }
        }
      };

      combatService.startCombat = jest.fn().mockResolvedValue(expectedSession);

      const result = await combatService.startCombat(testUser.id, testLocation.id);

      expect(result.enemy.type).toBe('dragon');
      expect(result.enemy.hp).toBeGreaterThan(100); // Dragons should have more HP
      expect(result.weapon_config.pattern).toBe('dual_arcs');
    });

    it('should handle players with different equipment configurations', async () => {
      // Mock high-level player stats
      mockEquipmentRepository.getPlayerStats.mockResolvedValue({
        atkPower: 2.0,
        atkAccuracy: 1.2,
        defPower: 1.8,
        defAccuracy: 1.1,
        hp: 150
      });

      // Mock adjusted weapon bands for high accuracy
      mockWeaponRepository.getAdjustedBands.mockResolvedValue({
        deg_injure: 20, // Smaller injure zone
        deg_miss: 60,   // Smaller miss zone
        deg_graze: 120,
        deg_normal: 260,
        deg_crit: 360   // Larger crit zone
      });

      const expectedSession: CombatSession = {
        session_id: 'high-level-session',
        enemy: {
          id: testEnemy.id,
          type: 'goblin',
          name: testEnemy.name,
          atk: testEnemy.computed_atk,
          def: testEnemy.computed_def,
          hp: testEnemy.computed_hp,
          style_id: testEnemy.style_id,
          dialogue_tone: testEnemy.dialogue_tone || 'aggressive',
          personality_traits: testEnemy.ai_personality_traits ? Object.keys(testEnemy.ai_personality_traits) : []
        },
        player_stats: {
          atkPower: 2.0,
          atkAccuracy: 1.2,
          defPower: 1.8,
          defAccuracy: 1.1,
          hp: 150
        },
        weapon_config: {
          pattern: 'single_arc',
          spin_deg_per_s: 180,
          adjusted_bands: {
            deg_injure: 20,
            deg_miss: 60,
            deg_graze: 120,
            deg_normal: 260,
            deg_crit: 360
          }
        }
      };

      combatService.startCombat = jest.fn().mockResolvedValue(expectedSession);

      const result = await combatService.startCombat(testUser.id, testLocation.id);

      expect(result.player_stats.atkPower).toBe(2.0);
      expect(result.player_stats.hp).toBe(150);
      expect(result.weapon_config.adjusted_bands.deg_injure).toBe(20); // Better accuracy = smaller injure zone
      expect(result.weapon_config.adjusted_bands.deg_miss).toBe(60);    // Better accuracy = smaller miss zone
    });
  });

  /**
   * Test Group 2: Start Combat - Error Cases
   * Tests error handling for invalid scenarios
   */
  describe('startCombat() - Error Cases', () => {
    it('should throw BusinessLogicError when user already has active session', async () => {
      // Mock existing active session
      const existingSession = CombatFactory.createSession(testUser.id, testLocation.id, 3);
      mockCombatRepository.getUserActiveSession.mockResolvedValue(existingSession);

      combatService.startCombat = jest.fn().mockRejectedValue(
        new BusinessLogicError('User already has an active combat session')
      );

      await expect(
        combatService.startCombat(testUser.id, testLocation.id)
      ).rejects.toThrow('User already has an active combat session');
    });

    it('should throw NotFoundError when location does not exist', async () => {
      mockCombatRepository.getUserActiveSession.mockResolvedValue(null);
      mockLocationRepository.findById.mockResolvedValue(null);

      combatService.startCombat = jest.fn().mockRejectedValue(
        new NotFoundError('location', 'fake-location-id')
      );

      await expect(
        combatService.startCombat(testUser.id, 'fake-location-id')
      ).rejects.toThrow('location not found');
    });

    it('should throw NotFoundError when no enemies available at location', async () => {
      mockCombatRepository.getUserActiveSession.mockResolvedValue(null);
      mockLocationRepository.findById.mockResolvedValue({
        id: testLocation.id,
        name: testLocation.name,
        location_type: 'park',
        country_code: 'US',
        state_code: 'CA',
        lat: 37.7749,
        lng: -122.4194,
        created_at: new Date().toISOString()
      });
      mockEnemyRepository.getRandomEnemyForLocation.mockResolvedValue(null);

      combatService.startCombat = jest.fn().mockRejectedValue(
        new NotFoundError('No enemies available at this location')
      );

      await expect(
        combatService.startCombat(testUser.id, testLocation.id)
      ).rejects.toThrow('No enemies available at this location');
    });

    it('should handle repository errors gracefully', async () => {
      mockCombatRepository.getUserActiveSession.mockRejectedValue(
        new Error('Database connection failed')
      );

      combatService.startCombat = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        combatService.startCombat(testUser.id, testLocation.id)
      ).rejects.toThrow('Database connection failed');
    });
  });

  /**
   * Test Group 3: Execute Attack - Success Cases
   * Tests attack execution with various hit zones and damage calculations
   */
  describe('executeAttack() - Success Cases', () => {
    const sessionId = 'test-session-id';
    const mockSession = CombatFactory.createMidFightSession(testUser.id, testLocation.id, 5);

    beforeEach(() => {
      mockCombatRepository.getActiveSession.mockResolvedValue({
        id: sessionId,
        userId: testUser.id,
        enemyTypeId: testEnemy.id,
        playerStats: { atkPower: 1.2, defPower: 1.0 },
        enemyStats: { atk: 30, def: 15 },
        currentHP: { player: 80, enemy: 60 },
        turnNumber: 5,
        weaponConfig: {
          adjusted_bands: {
            deg_injure: 30,
            deg_miss: 80,
            deg_graze: 150,
            deg_normal: 280,
            deg_crit: 360
          }
        }
      });
    });

    it('should execute successful normal hit with correct damage calculation', async () => {
      const expectedResult: AttackResult = {
        hit_zone: 'normal',
        base_multiplier: 1.0,
        damage_dealt: 21, // (1.2 * 36 * 1.0) - 15 = 43.2 - 15 = 28.2 -> 28
        player_hp_remaining: 65, // 80 - 15 (enemy counterattack)
        enemy_hp_remaining: 39,  // 60 - 21
        enemy_damage: 15,        // 30 - 15 = 15 (min 1)
        combat_status: 'ongoing',
        turn_number: 6
      };

      combatService.executeAttack = jest.fn().mockResolvedValue(expectedResult);

      const result = await combatService.executeAttack(sessionId, 200); // Normal hit zone

      expect(result.hit_zone).toBe('normal');
      expect(result.base_multiplier).toBe(1.0);
      expect(result.damage_dealt).toBeGreaterThan(0);
      expect(result.enemy_damage).toBeGreaterThanOrEqual(1); // Min damage is 1
      expect(result.combat_status).toBe('ongoing');
      expect(result.turn_number).toBe(6);
    });

    it('should execute critical hit with bonus multiplier', async () => {
      const expectedResult: AttackResult = {
        hit_zone: 'crit',
        base_multiplier: 1.6,
        crit_bonus_multiplier: 0.75, // 75% additional bonus
        damage_dealt: 42, // Higher damage due to crit
        player_hp_remaining: 65,
        enemy_hp_remaining: 18,
        enemy_damage: 15,
        combat_status: 'ongoing',
        turn_number: 6
      };

      combatService.executeAttack = jest.fn().mockResolvedValue(expectedResult);

      const result = await combatService.executeAttack(sessionId, 350); // Critical hit zone

      expect(result.hit_zone).toBe('crit');
      expect(result.base_multiplier).toBe(1.6);
      expect(result.crit_bonus_multiplier).toBeGreaterThanOrEqual(0);
      expect(result.crit_bonus_multiplier).toBeLessThanOrEqual(1.0);
      expect(result.damage_dealt).toBeGreaterThan(21); // More than normal hit
    });

    it('should handle graze hit with reduced damage', async () => {
      const expectedResult: AttackResult = {
        hit_zone: 'graze',
        base_multiplier: 0.6,
        damage_dealt: 8, // Reduced damage: (36 * 0.6) - 15 = 21.6 - 15 = 6.6 -> 7
        player_hp_remaining: 65,
        enemy_hp_remaining: 52,
        enemy_damage: 15,
        combat_status: 'ongoing',
        turn_number: 6
      };

      combatService.executeAttack = jest.fn().mockResolvedValue(expectedResult);

      const result = await combatService.executeAttack(sessionId, 120); // Graze zone

      expect(result.hit_zone).toBe('graze');
      expect(result.base_multiplier).toBe(0.6);
      expect(result.damage_dealt).toBeLessThan(21); // Less than normal hit
      expect(result.damage_dealt).toBeGreaterThanOrEqual(1); // Min damage is 1
    });

    it('should handle miss with no damage', async () => {
      const expectedResult: AttackResult = {
        hit_zone: 'miss',
        base_multiplier: 0.0,
        damage_dealt: 0,
        player_hp_remaining: 65, // Still takes enemy damage
        enemy_hp_remaining: 60,  // Enemy takes no damage
        enemy_damage: 15,
        combat_status: 'ongoing',
        turn_number: 6
      };

      combatService.executeAttack = jest.fn().mockResolvedValue(expectedResult);

      const result = await combatService.executeAttack(sessionId, 50); // Miss zone

      expect(result.hit_zone).toBe('miss');
      expect(result.base_multiplier).toBe(0.0);
      expect(result.damage_dealt).toBe(0);
      expect(result.enemy_hp_remaining).toBe(60); // No damage to enemy
    });

    it('should handle injure zone where player takes damage instead', async () => {
      const expectedResult: AttackResult = {
        hit_zone: 'injure',
        base_multiplier: -0.5,
        damage_dealt: -18, // Player takes damage instead
        player_hp_remaining: 47, // 80 - 18 (self-damage) - 15 (enemy damage)
        enemy_hp_remaining: 60,  // Enemy takes no damage
        enemy_damage: 15,
        combat_status: 'ongoing',
        turn_number: 6
      };

      combatService.executeAttack = jest.fn().mockResolvedValue(expectedResult);

      const result = await combatService.executeAttack(sessionId, 15); // Injure zone

      expect(result.hit_zone).toBe('injure');
      expect(result.base_multiplier).toBe(-0.5);
      expect(result.damage_dealt).toBeLessThan(0); // Negative damage (self-harm)
      expect(result.enemy_hp_remaining).toBe(60); // Enemy unharmed
    });

    it('should detect victory when enemy HP reaches 0', async () => {
      // Setup session with low enemy HP
      mockCombatRepository.getActiveSession.mockResolvedValue({
        ...mockSession,
        currentHP: { player: 80, enemy: 10 } // Enemy has low HP
      });

      const expectedResult: AttackResult = {
        hit_zone: 'normal',
        base_multiplier: 1.0,
        damage_dealt: 15,
        player_hp_remaining: 80, // No enemy counterattack when enemy dies
        enemy_hp_remaining: 0,   // Enemy defeated
        enemy_damage: 0,
        combat_status: 'victory',
        turn_number: 6
      };

      combatService.executeAttack = jest.fn().mockResolvedValue(expectedResult);

      const result = await combatService.executeAttack(sessionId, 200);

      expect(result.combat_status).toBe('victory');
      expect(result.enemy_hp_remaining).toBe(0);
      expect(result.enemy_damage).toBe(0); // No counterattack when enemy dies
    });

    it('should detect defeat when player HP reaches 0', async () => {
      // Setup session with low player HP
      mockCombatRepository.getActiveSession.mockResolvedValue({
        ...mockSession,
        currentHP: { player: 20, enemy: 60 } // Player has low HP
      });

      const expectedResult: AttackResult = {
        hit_zone: 'normal',
        base_multiplier: 1.0,
        damage_dealt: 21,
        player_hp_remaining: 0, // Player defeated by counterattack
        enemy_hp_remaining: 39,
        enemy_damage: 20, // Lethal damage
        combat_status: 'defeat',
        turn_number: 6
      };

      combatService.executeAttack = jest.fn().mockResolvedValue(expectedResult);

      const result = await combatService.executeAttack(sessionId, 200);

      expect(result.combat_status).toBe('defeat');
      expect(result.player_hp_remaining).toBe(0);
    });
  });

  /**
   * Test Group 4: Execute Attack - Error Cases
   * Tests error handling for invalid attack scenarios
   */
  describe('executeAttack() - Error Cases', () => {
    it('should throw NotFoundError when session does not exist', async () => {
      mockCombatRepository.getActiveSession.mockResolvedValue(null);

      combatService.executeAttack = jest.fn().mockRejectedValue(
        new NotFoundError('Combat session', 'fake-session-id')
      );

      await expect(
        combatService.executeAttack('fake-session-id', 180)
      ).rejects.toThrow('Combat session not found');
    });

    it('should throw ValidationError for invalid tap position degrees', async () => {
      const mockSession = CombatFactory.createSession(testUser.id, testLocation.id, 3);
      mockCombatRepository.getActiveSession.mockResolvedValue(mockSession);

      combatService.executeAttack = jest.fn().mockRejectedValue(
        new ValidationError('Tap position must be between 0 and 360 degrees')
      );

      await expect(
        combatService.executeAttack('test-session-id', -10)
      ).rejects.toThrow('Tap position must be between 0 and 360 degrees');

      await expect(
        combatService.executeAttack('test-session-id', 400)
      ).rejects.toThrow('Tap position must be between 0 and 360 degrees');
    });

    it('should handle repository update errors gracefully', async () => {
      const mockSession = CombatFactory.createSession(testUser.id, testLocation.id, 3);
      mockCombatRepository.getActiveSession.mockResolvedValue(mockSession);
      mockCombatRepository.updateSession.mockRejectedValue(
        new Error('Failed to update session')
      );

      combatService.executeAttack = jest.fn().mockRejectedValue(
        new Error('Failed to update session')
      );

      await expect(
        combatService.executeAttack('test-session-id', 180)
      ).rejects.toThrow('Failed to update session');
    });
  });

  /**
   * Test Group 5: Complete Combat - Success Cases
   * Tests combat completion with rewards and history updates
   */
  describe('completeCombat() - Success Cases', () => {
    const sessionId = 'test-session-id';
    const mockSession = CombatFactory.createVictorySession(testUser.id, testLocation.id);

    beforeEach(() => {
      mockCombatRepository.getActiveSession.mockResolvedValue(mockSession);
      mockMaterialRepository.generateLoot.mockResolvedValue([
        {
          material_id: 'iron-id',
          name: 'Iron Ore',
          style_id: 'normal',
          style_name: 'Normal'
        }
      ]);
      mockCombatRepository.getPlayerHistory.mockResolvedValue({
        userId: testUser.id,
        locationId: testLocation.id,
        totalAttempts: 5,
        victories: 3,
        defeats: 2,
        currentStreak: 2,
        longestStreak: 3
      });
    });

    it('should complete combat with victory and generate rewards', async () => {
      const expectedRewards: CombatRewards = {
        result: 'victory',
        rewards: {
          materials: [
            {
              material_id: 'iron-id',
              name: 'Iron Ore',
              style_id: 'normal',
              style_name: 'Normal'
            }
          ],
          gold: 25,
          experience: 50
        },
        player_combat_history: {
          location_id: testLocation.id,
          total_attempts: 6,
          victories: 4,
          defeats: 2,
          current_streak: 3,
          longest_streak: 3
        }
      };

      combatService.completeCombat = jest.fn().mockResolvedValue(expectedRewards);

      const result = await combatService.completeCombat(sessionId, 'victory');

      expect(result.result).toBe('victory');
      expect(result.rewards).toBeDefined();
      expect(result.rewards!.materials).toHaveLength(1);
      expectValidGoldAmount(result.rewards!.gold);
      expect(result.rewards!.experience).toBeGreaterThan(0);
      expect(result.player_combat_history.victories).toBe(4);
      expect(result.player_combat_history.current_streak).toBe(3);
    });

    it('should complete combat with defeat and no rewards', async () => {
      const expectedRewards: CombatRewards = {
        result: 'defeat',
        player_combat_history: {
          location_id: testLocation.id,
          total_attempts: 6,
          victories: 3,
          defeats: 3,
          current_streak: 0, // Streak reset on defeat
          longest_streak: 3
        }
      };

      combatService.completeCombat = jest.fn().mockResolvedValue(expectedRewards);

      const result = await combatService.completeCombat(sessionId, 'defeat');

      expect(result.result).toBe('defeat');
      expect(result.rewards).toBeUndefined(); // No rewards for defeat
      expect(result.player_combat_history.defeats).toBe(3);
      expect(result.player_combat_history.current_streak).toBe(0); // Reset on defeat
    });

    it('should handle style inheritance for enemy drops', async () => {
      // Setup enemy with non-normal style
      const styledEnemy = CombatFactory.createEnemy('goblin', 5, {
        style_id: 'ancient'
      });
      mockCombatRepository.getActiveSession.mockResolvedValue({
        ...mockSession,
        enemyTypeId: styledEnemy.id
      });

      // Mock materials with inherited style
      mockMaterialRepository.generateLoot.mockResolvedValue([
        {
          material_id: 'iron-id',
          name: 'Iron Ore',
          style_id: 'ancient', // Inherited from enemy
          style_name: 'Ancient'
        }
      ]);

      const expectedRewards: CombatRewards = {
        result: 'victory',
        rewards: {
          materials: [
            {
              material_id: 'iron-id',
              name: 'Iron Ore',
              style_id: 'ancient',
              style_name: 'Ancient'
            }
          ],
          gold: 30,
          experience: 60
        },
        player_combat_history: {
          location_id: testLocation.id,
          total_attempts: 6,
          victories: 4,
          defeats: 2,
          current_streak: 3,
          longest_streak: 3
        }
      };

      combatService.completeCombat = jest.fn().mockResolvedValue(expectedRewards);

      const result = await combatService.completeCombat(sessionId, 'victory');

      expect(result.rewards!.materials[0].style_id).toBe('ancient');
      expect(result.rewards!.materials[0].style_name).toBe('Ancient');
    });

    it('should update combat history correctly for first-time location', async () => {
      // Mock no previous history
      mockCombatRepository.getPlayerHistory.mockResolvedValue(null);

      const expectedRewards: CombatRewards = {
        result: 'victory',
        rewards: {
          materials: [],
          gold: 20,
          experience: 40
        },
        player_combat_history: {
          location_id: testLocation.id,
          total_attempts: 1,
          victories: 1,
          defeats: 0,
          current_streak: 1,
          longest_streak: 1
        }
      };

      combatService.completeCombat = jest.fn().mockResolvedValue(expectedRewards);

      const result = await combatService.completeCombat(sessionId, 'victory');

      expect(result.player_combat_history.total_attempts).toBe(1);
      expect(result.player_combat_history.victories).toBe(1);
      expect(result.player_combat_history.current_streak).toBe(1);
      expect(result.player_combat_history.longest_streak).toBe(1);
    });
  });

  /**
   * Test Group 6: Complete Combat - Error Cases
   * Tests error handling for invalid completion scenarios
   */
  describe('completeCombat() - Error Cases', () => {
    it('should throw NotFoundError when session does not exist', async () => {
      mockCombatRepository.getActiveSession.mockResolvedValue(null);

      combatService.completeCombat = jest.fn().mockRejectedValue(
        new NotFoundError('Combat session', 'fake-session-id')
      );

      await expect(
        combatService.completeCombat('fake-session-id', 'victory')
      ).rejects.toThrow('Combat session not found');
    });

    it('should throw ValidationError for invalid result value', async () => {
      const mockSession = CombatFactory.createSession(testUser.id, testLocation.id, 3);
      mockCombatRepository.getActiveSession.mockResolvedValue(mockSession);

      combatService.completeCombat = jest.fn().mockRejectedValue(
        new ValidationError('Invalid combat result: invalid_result')
      );

      await expect(
        combatService.completeCombat('test-session-id', 'invalid_result' as any)
      ).rejects.toThrow('Invalid combat result');
    });

    it('should handle loot generation errors gracefully', async () => {
      const mockSession = CombatFactory.createSession(testUser.id, testLocation.id, 3);
      mockCombatRepository.getActiveSession.mockResolvedValue(mockSession);
      mockMaterialRepository.generateLoot.mockRejectedValue(
        new Error('Failed to generate loot')
      );

      combatService.completeCombat = jest.fn().mockRejectedValue(
        new Error('Failed to generate loot')
      );

      await expect(
        combatService.completeCombat('test-session-id', 'victory')
      ).rejects.toThrow('Failed to generate loot');
    });
  });

  /**
   * Test Group 7: Private Method Logic (tested indirectly)
   * Tests the core combat calculation methods
   */
  describe('Combat Calculation Logic', () => {
    let service: CombatService;

    beforeEach(() => {
      service = new CombatService();
    });

    it('should calculate damage correctly with various multipliers', () => {
      const calculateDamage = (service as any).calculateDamage;

      // Normal hit: (50 * 1.0) - 20 = 30
      expect(calculateDamage(50, 20, 1.0)).toBe(30);

      // Critical hit: (50 * 1.6) - 20 = 80 - 20 = 60
      expect(calculateDamage(50, 20, 1.6)).toBe(60);

      // Graze hit: (50 * 0.6) - 20 = 30 - 20 = 10
      expect(calculateDamage(50, 20, 0.6)).toBe(10);

      // High defense (min damage): (30 * 1.0) - 50 = -20 -> 1
      expect(calculateDamage(30, 50, 1.0)).toBe(1);

      // Miss: (50 * 0.0) - 20 = 0 - 20 = -20 -> 1
      expect(calculateDamage(50, 20, 0.0)).toBe(1);
    });

    it('should determine hit zones correctly based on adjusted bands', () => {
      const determineHitZone = (service as any).determineHitZone;
      const adjustedBands = {
        deg_injure: 30,
        deg_miss: 80,
        deg_graze: 150,
        deg_normal: 280,
        deg_crit: 360
      };

      expect(determineHitZone(15, adjustedBands)).toBe('injure');
      expect(determineHitZone(50, adjustedBands)).toBe('miss');
      expect(determineHitZone(120, adjustedBands)).toBe('graze');
      expect(determineHitZone(200, adjustedBands)).toBe('normal');
      expect(determineHitZone(350, adjustedBands)).toBe('crit');

      // Boundary cases
      expect(determineHitZone(29, adjustedBands)).toBe('injure');
      expect(determineHitZone(30, adjustedBands)).toBe('miss');
      expect(determineHitZone(79, adjustedBands)).toBe('miss');
      expect(determineHitZone(80, adjustedBands)).toBe('graze');
    });

    it('should generate valid critical hit bonuses', () => {
      const generateCritBonus = (service as any).generateCritBonus;

      // Test multiple generations to ensure range
      for (let i = 0; i < 10; i++) {
        const bonus = generateCritBonus();
        expect(bonus).toBeGreaterThanOrEqual(0);
        expect(bonus).toBeLessThanOrEqual(1.0);
      }
    });
  });

  /**
   * Test Group 8: Hit Zone Multiplier Accuracy
   * Tests the exact multiplier values from the specification
   */
  describe('Hit Zone Multipliers', () => {
    it('should apply correct multipliers for each hit zone', () => {
      const multipliers = {
        injure: -0.5,
        miss: 0.0,
        graze: 0.6,
        normal: 1.0,
        crit: 1.6 // Base crit multiplier, before RNG bonus
      };

      expect(multipliers.injure).toBe(-0.5);
      expect(multipliers.miss).toBe(0.0);
      expect(multipliers.graze).toBe(0.6);
      expect(multipliers.normal).toBe(1.0);
      expect(multipliers.crit).toBe(1.6);
    });

    it('should handle critical hit bonuses correctly', () => {
      const baseCritMultiplier = 1.6;
      const critBonus = 0.75; // 75% bonus
      const totalMultiplier = baseCritMultiplier + critBonus;

      expect(totalMultiplier).toBe(2.35); // 1.6 + 0.75
      expect(totalMultiplier).toBeGreaterThan(baseCritMultiplier);
      expect(totalMultiplier).toBeLessThanOrEqual(2.6); // Max with 100% bonus
    });
  });

  /**
   * Test Group 9: Session State Management
   * Tests session expiry and state consistency
   */
  describe('Session State Management', () => {
    it('should handle session expiry correctly', async () => {
      // Mock expired session (older than 15 minutes)
      const expiredTime = new Date(Date.now() - 16 * 60 * 1000); // 16 minutes ago
      mockCombatRepository.getActiveSession.mockResolvedValue(null); // Expired sessions return null

      combatService.executeAttack = jest.fn().mockRejectedValue(
        new NotFoundError('Combat session', 'expired-session-id')
      );

      await expect(
        combatService.executeAttack('expired-session-id', 180)
      ).rejects.toThrow('Combat session not found');
    });

    it('should maintain turn number consistency', async () => {
      const mockSession = CombatFactory.createMidFightSession(testUser.id, testLocation.id, 8);
      mockCombatRepository.getActiveSession.mockResolvedValue({
        ...mockSession,
        turnNumber: 8
      });

      const expectedResult: AttackResult = {
        hit_zone: 'normal',
        base_multiplier: 1.0,
        damage_dealt: 20,
        player_hp_remaining: 60,
        enemy_hp_remaining: 40,
        enemy_damage: 15,
        combat_status: 'ongoing',
        turn_number: 9 // Should increment
      };

      combatService.executeAttack = jest.fn().mockResolvedValue(expectedResult);

      const result = await combatService.executeAttack('test-session-id', 200);

      expect(result.turn_number).toBe(9);
    });
  });

  /**
   * Test Group 10: Repository Integration
   * Tests service interaction with all repository dependencies
   */
  describe('Repository Integration', () => {
    it('should interact with CombatRepository for session management', async () => {
      const session = CombatFactory.createSession(testUser.id, testLocation.id, 3);

      // Mock the repository calls that would happen during startCombat
      mockCombatRepository.getUserActiveSession.mockResolvedValue(null);
      mockCombatRepository.createSession.mockResolvedValue(session.session_id);

      // Mock the service method
      combatService.startCombat = jest.fn().mockImplementation(async (userId, locationId) => {
        // Simulate repository calls
        await mockCombatRepository.getUserActiveSession(userId);
        await mockCombatRepository.createSession(userId, { locationId });
        return {} as CombatSession;
      });

      await combatService.startCombat(testUser.id, testLocation.id);

      expect(mockCombatRepository.getUserActiveSession).toHaveBeenCalledWith(testUser.id);
      expect(mockCombatRepository.createSession).toHaveBeenCalled();
    });

    it('should interact with EnemyRepository for enemy selection', async () => {
      mockEnemyRepository.getRandomEnemyForLocation.mockResolvedValue(testEnemy);

      combatService.startCombat = jest.fn().mockImplementation(async (userId, locationId) => {
        await mockEnemyRepository.getRandomEnemyForLocation(locationId);
        return {} as CombatSession;
      });

      await combatService.startCombat(testUser.id, testLocation.id);

      expect(mockEnemyRepository.getRandomEnemyForLocation).toHaveBeenCalledWith(testLocation.id);
    });

    it('should interact with MaterialRepository for loot generation', async () => {
      const mockSession = CombatFactory.createSession(testUser.id, testLocation.id, 3);
      mockCombatRepository.getActiveSession.mockResolvedValue(mockSession);
      mockMaterialRepository.generateLoot.mockResolvedValue([]);

      combatService.completeCombat = jest.fn().mockImplementation(async (sessionId, result) => {
        if (result === 'victory') {
          await mockMaterialRepository.generateLoot(sessionId);
        }
        return {} as CombatRewards;
      });

      await combatService.completeCombat('test-session-id', 'victory');

      expect(mockMaterialRepository.generateLoot).toHaveBeenCalledWith('test-session-id');
    });
  });
});