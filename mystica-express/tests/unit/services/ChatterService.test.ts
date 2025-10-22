/**
 * Unit Tests: ChatterService
 *
 * Comprehensive test suite for the ChatterService following TDD patterns.
 * Tests all public methods, error conditions, AI service integration,
 * timeout scenarios, and fallback mechanisms.
 *
 * Repository Dependencies:
 * - CombatRepository (session and history management)
 * - PetRepository (pet data and personality management)
 * - EnemyRepository (enemy type data)
 * - AnalyticsRepository (chatter event logging)
 */

// Mock all repository dependencies (must be at top level before imports)
const mockCombatRepository = {
  getActiveSession: jest.fn(),
  getPlayerCombatHistory: jest.fn(),
  getPlayerHistory: jest.fn()
};

const mockPetRepository = {
  getEquippedPet: jest.fn(),
  getPersonalityData: jest.fn(),
  getAllPersonalities: jest.fn(),
  findPetById: jest.fn(),
  updatePetPersonality: jest.fn(),
  findPersonalityByType: jest.fn(),
  findPetByItemId: jest.fn(),
  findPersonalityById: jest.fn()
};

const mockEnemyRepository = {
  getEnemyType: jest.fn(),
  getAllEnemyTypes: jest.fn(),
  findEnemyTypeById: jest.fn(),
  findAllEnemyTypes: jest.fn()
};

const mockAnalyticsRepository = {
  logChatterEvent: jest.fn(),
  logPetChatter: jest.fn(),
  logEnemyChatter: jest.fn()
};

// Mock EquipmentRepository (imported dynamically)
const mockEquipmentRepository = {
  findItemInSlot: jest.fn()
};

// Mock AI service functions
const mockGenerateText = jest.fn();
const mockOpenAI = jest.fn();

// Mock service dependencies
jest.mock('../../../src/repositories/CombatRepository', () => ({
  CombatRepository: jest.fn().mockImplementation(() => mockCombatRepository)
}));

jest.mock('../../../src/repositories/PetRepository', () => ({
  PetRepository: jest.fn().mockImplementation(() => mockPetRepository)
}));

jest.mock('../../../src/repositories/EnemyRepository', () => ({
  EnemyRepository: jest.fn().mockImplementation(() => mockEnemyRepository)
}));

jest.mock('../../../src/repositories/AnalyticsRepository', () => ({
  AnalyticsRepository: jest.fn().mockImplementation(() => mockAnalyticsRepository)
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn()
}));

jest.mock('ai', () => ({
  generateText: jest.fn()
}));

jest.mock('../../../src/repositories/EquipmentRepository', () => ({
  EquipmentRepository: jest.fn().mockImplementation(() => mockEquipmentRepository)
}));

import { ChatterService } from '../../../src/services/ChatterService.js';
import {
  SessionNotFoundError,
  NoPetEquippedError,
  PersonalityNotFoundError,
  PetNotFoundError,
  InvalidPersonalityError,
  EnemyTypeNotFoundError,
  ExternalServiceError
} from '../../../src/utils/errors.js';

// Import test infrastructure
import {
  ChatterFactory,
  type PetPersonality,
  type EnemyType,
  type EquippedPet,
  type CombatEventDetails,
  type PlayerCombatHistory,
  type ChatterResponse,
  type EnemyChatterResponse,
  type PetChatterEventType,
  type EnemyChatterEventType
} from '../../factories/chatter.factory.js';

import { UserFactory, CombatFactory } from '../../factories/index.js';

describe('ChatterService', () => {
  let chatterService: ChatterService;
  let user: any;
  let sessionId: string;
  let locationId: string;

  beforeEach(() => {
    chatterService = new ChatterService();
    user = UserFactory.createEmail();
    sessionId = 'test-session-123';
    locationId = 'test-location-456';

    // Clear all mocks
    jest.clearAllMocks();

    // Setup default successful responses
    mockAnalyticsRepository.logChatterEvent.mockResolvedValue(undefined);
    mockAnalyticsRepository.logPetChatter.mockResolvedValue(undefined);
    mockAnalyticsRepository.logEnemyChatter.mockResolvedValue(undefined);

    // Mock EquipmentRepository for getEquippedPet
    mockEquipmentRepository.findItemInSlot.mockResolvedValue({ id: 'pet-item-123' });
  });

  /**
   * Test Group 1: generatePetChatter() method
   * Tests pet dialogue generation with various scenarios
   */
  describe('generatePetChatter()', () => {
    describe('successful generation', () => {
      it('should generate AI-powered pet chatter for player attack', async () => {
        // Arrange
        const session = CombatFactory.createSession(user.id, locationId, 3);
        const pet = ChatterFactory.createEquippedPet(user.id, 'sassy');
        const personality = ChatterFactory.createPetPersonality('sassy');
        const eventDetails = ChatterFactory.createCombatEventDetails('player_attack');

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockPetRepository.getEquippedPet.mockResolvedValue(pet);
        mockPetRepository.getPersonalityData.mockResolvedValue(personality);

        // Mock successful AI response
        mockOpenAIService.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: 'Oh please, is that the best you can do? I\'ve seen better swings from a sleepy kitten!'
            }
          }]
        });

        // Act
        const result = await chatterService.generatePetChatter(sessionId, 'player_attack', eventDetails);

        // Assert
        expect(result).toMatchObject({
          dialogue: expect.stringContaining('Oh please'),
          personality_type: 'sassy',
          was_ai_generated: true,
          generation_time_ms: expect.any(Number)
        });

        expect(mockCombatRepository.getActiveSession).toHaveBeenCalledWith(sessionId);
        expect(mockPetRepository.getEquippedPet).toHaveBeenCalledWith(user.id);
        expect(mockPetRepository.getPersonalityData).toHaveBeenCalledWith('sassy');
        expect(mockAnalyticsRepository.logChatterEvent).toHaveBeenCalledWith(
          sessionId,
          expect.any(String),
          expect.objectContaining({
            eventType: 'player_attack',
            personalityType: 'sassy',
            wasAIGenerated: true
          })
        );
      });

      it('should generate chatter for critical hit events', async () => {
        // Arrange
        const session = CombatFactory.createSession(user.id, locationId, 2);
        const pet = ChatterFactory.createEquippedPet(user.id, 'encouraging');
        const personality = ChatterFactory.createPetPersonality('encouraging');
        const eventDetails = ChatterFactory.createCombatEventDetails('critical_hit', {
          is_critical: true,
          damage: 50
        });

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockPetRepository.getEquippedPet.mockResolvedValue(pet);
        mockPetRepository.getPersonalityData.mockResolvedValue(personality);

        mockOpenAIService.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: 'YES! That was an amazing critical hit! You\'re unstoppable!'
            }
          }]
        });

        // Act
        const result = await chatterService.generatePetChatter(sessionId, 'critical_hit', eventDetails);

        // Assert
        expect(result.dialogue).toContain('critical hit');
        expect(result.personality_type).toBe('encouraging');
        expect(result.was_ai_generated).toBe(true);
      });

      it('should generate chatter for victory events', async () => {
        // Arrange
        const session = CombatFactory.createVictorySession(user.id, locationId);
        const pet = ChatterFactory.createEquippedPet(user.id, 'trash_talker');
        const personality = ChatterFactory.createPetPersonality('trash_talker');
        const eventDetails = ChatterFactory.createCombatEventDetails('victory');

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockPetRepository.getEquippedPet.mockResolvedValue(pet);
        mockPetRepository.getPersonalityData.mockResolvedValue(personality);

        mockOpenAIService.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: 'GET WRECKED! Nobody beats us! We are the CHAMPIONS!'
            }
          }]
        });

        // Act
        const result = await chatterService.generatePetChatter(sessionId, 'victory', eventDetails);

        // Assert
        expect(result.dialogue).toContain('CHAMPIONS');
        expect(result.personality_type).toBe('trash_talker');
      });
    });

    describe('fallback mechanism', () => {
      it('should use fallback phrases when AI service times out', async () => {
        // Arrange
        const session = CombatFactory.createSession(user.id, locationId, 1);
        const pet = ChatterFactory.createEquippedPet(user.id, 'stoic');
        const personality = ChatterFactory.createPetPersonality('stoic');
        const eventDetails = ChatterFactory.createCombatEventDetails('player_attack');

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockPetRepository.getEquippedPet.mockResolvedValue(pet);
        mockPetRepository.getPersonalityData.mockResolvedValue(personality);

        // Mock AI service timeout
        mockOpenAIService.chat.completions.create.mockRejectedValue(
          ChatterFactory.createTimeoutError()
        );

        // Act
        const result = await chatterService.generatePetChatter(sessionId, 'player_attack', eventDetails);

        // Assert
        expect(result.was_ai_generated).toBe(false);
        expect(result.dialogue).toBe(personality.example_phrases[0]); // Should use first fallback phrase
        expect(result.personality_type).toBe('stoic');
        expect(result.generation_time_ms).toBeLessThan(100); // Fallback should be fast

        expect(mockAnalyticsRepository.logChatterEvent).toHaveBeenCalledWith(
          sessionId,
          expect.any(String),
          expect.objectContaining({
            wasAIGenerated: false,
            fallbackReason: 'ai_timeout'
          })
        );
      });

      it('should use fallback phrases when AI service returns error', async () => {
        // Arrange
        const session = CombatFactory.createSession(user.id, locationId, 1);
        const pet = ChatterFactory.createEquippedPet(user.id, 'analytical');
        const personality = ChatterFactory.createPetPersonality('analytical');
        const eventDetails = ChatterFactory.createCombatEventDetails('miss');

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockPetRepository.getEquippedPet.mockResolvedValue(pet);
        mockPetRepository.getPersonalityData.mockResolvedValue(personality);

        // Mock AI service error
        mockOpenAIService.chat.completions.create.mockRejectedValue(
          ChatterFactory.createOpenAIError(500, 'Internal server error')
        );

        // Act
        const result = await chatterService.generatePetChatter(sessionId, 'miss', eventDetails);

        // Assert
        expect(result.was_ai_generated).toBe(false);
        expect(personality.example_phrases).toContain(result.dialogue);
        expect(result.personality_type).toBe('analytical');
      });

      it('should handle random fallback phrase selection', async () => {
        // Arrange
        const session = CombatFactory.createSession(user.id, locationId, 1);
        const pet = ChatterFactory.createEquippedPet(user.id, 'chaotic');
        const personality = ChatterFactory.createPetPersonality('chaotic');
        const eventDetails = ChatterFactory.createCombatEventDetails('player_defense');

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockPetRepository.getEquippedPet.mockResolvedValue(pet);
        mockPetRepository.getPersonalityData.mockResolvedValue(personality);

        // Mock AI service failure
        mockOpenAIService.chat.completions.create.mockRejectedValue(new Error('Network error'));

        // Act - call multiple times to test randomness
        const results = await Promise.all([
          chatterService.generatePetChatter(sessionId, 'player_defense', eventDetails),
          chatterService.generatePetChatter(sessionId, 'player_defense', eventDetails),
          chatterService.generatePetChatter(sessionId, 'player_defense', eventDetails)
        ]);

        // Assert - all should be valid fallback phrases
        results.forEach(result => {
          expect(result.was_ai_generated).toBe(false);
          expect(personality.example_phrases).toContain(result.dialogue);
        });
      });
    });

    describe('error conditions', () => {
      it('should throw SessionNotFoundError when combat session not found', async () => {
        // Arrange
        mockCombatRepository.getActiveSession.mockResolvedValue(null);

        const eventDetails = ChatterFactory.createCombatEventDetails('player_attack');

        // Act & Assert
        await expect(
          chatterService.generatePetChatter(sessionId, 'player_attack', eventDetails)
        ).rejects.toThrow(SessionNotFoundError);

        await expect(
          chatterService.generatePetChatter(sessionId, 'player_attack', eventDetails)
        ).rejects.toThrow(`Combat session ${sessionId} not found or expired`);
      });

      it('should throw NoPetEquippedError when player has no pet equipped', async () => {
        // Arrange
        const session = CombatFactory.createSession(user.id, locationId, 1);
        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockPetRepository.getEquippedPet.mockResolvedValue(null);

        const eventDetails = ChatterFactory.createCombatEventDetails('player_attack');

        // Act & Assert
        await expect(
          chatterService.generatePetChatter(sessionId, 'player_attack', eventDetails)
        ).rejects.toThrow(NoPetEquippedError);

        await expect(
          chatterService.generatePetChatter(sessionId, 'player_attack', eventDetails)
        ).rejects.toThrow('Player has no pet equipped for chatter generation');
      });

      it('should throw PersonalityNotFoundError when pet personality template missing', async () => {
        // Arrange
        const session = CombatFactory.createSession(user.id, locationId, 1);
        const pet = ChatterFactory.createEquippedPet(user.id, 'unknown_personality');

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockPetRepository.getEquippedPet.mockResolvedValue(pet);
        mockPetRepository.getPersonalityData.mockResolvedValue(null);

        const eventDetails = ChatterFactory.createCombatEventDetails('player_attack');

        // Act & Assert
        await expect(
          chatterService.generatePetChatter(sessionId, 'player_attack', eventDetails)
        ).rejects.toThrow(PersonalityNotFoundError);

        await expect(
          chatterService.generatePetChatter(sessionId, 'player_attack', eventDetails)
        ).rejects.toThrow('Pet personality unknown_personality not found');
      });
    });

    describe('all event types', () => {
      const eventTypes: PetChatterEventType[] = [
        'player_attack',
        'player_defense',
        'enemy_attack',
        'enemy_defense',
        'critical_hit',
        'miss',
        'victory',
        'defeat'
      ];

      eventTypes.forEach(eventType => {
        it(`should handle ${eventType} events`, async () => {
          // Arrange
          const session = CombatFactory.createSession(user.id, locationId, 2);
          const pet = ChatterFactory.createEquippedPet(user.id, 'sassy');
          const personality = ChatterFactory.createPetPersonality('sassy');
          const eventDetails = ChatterFactory.createCombatEventDetails(eventType);

          mockCombatRepository.getActiveSession.mockResolvedValue(session);
          mockPetRepository.getEquippedPet.mockResolvedValue(pet);
          mockPetRepository.getPersonalityData.mockResolvedValue(personality);

          mockOpenAIService.chat.completions.create.mockResolvedValue({
            choices: [{
              message: {
                content: `Generated response for ${eventType}`
              }
            }]
          });

          // Act
          const result = await chatterService.generatePetChatter(sessionId, eventType, eventDetails);

          // Assert
          expect(result.dialogue).toContain(eventType);
          expect(result.personality_type).toBe('sassy');
          expect(mockAnalyticsRepository.logChatterEvent).toHaveBeenCalledWith(
            sessionId,
            expect.any(String),
            expect.objectContaining({
              eventType
            })
          );
        });
      });
    });
  });

  /**
   * Test Group 2: generateEnemyChatter() method
   * Tests enemy trash-talk generation with player history context
   */
  describe('generateEnemyChatter()', () => {
    describe('successful generation', () => {
      it('should generate AI-powered enemy chatter with player history context', async () => {
        // Arrange
        const session = CombatFactory.createSession(user.id, locationId, 3, {
          enemy_type_id: 'goblin-123'
        });
        const enemyType = ChatterFactory.createEnemyType('goblin');
        const playerHistory = ChatterFactory.createPlayerCombatHistory(user.id, locationId, {
          victories: 2,
          defeats: 8,
          current_streak: -3
        });
        const eventDetails = ChatterFactory.createCombatEventDetails('player_miss');

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockEnemyRepository.getEnemyType.mockResolvedValue(enemyType);
        mockCombatRepository.getPlayerCombatHistory.mockResolvedValue(playerHistory);

        mockOpenAIService.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: 'Hah! You\'ve only won 2 out of 10 fights here. This will be easy!'
            }
          }]
        });

        // Act
        const result = await chatterService.generateEnemyChatter(sessionId, 'player_miss', eventDetails);

        // Assert
        expect(result).toMatchObject({
          dialogue: expect.stringContaining('2 out of 10'),
          enemy_type: 'goblin',
          dialogue_tone: 'sarcastic',
          was_ai_generated: true,
          player_context_used: {
            attempts: playerHistory.attempts,
            victories: playerHistory.victories,
            defeats: playerHistory.defeats,
            current_streak: playerHistory.current_streak
          }
        });

        expect(mockCombatRepository.getPlayerCombatHistory).toHaveBeenCalledWith(user.id, locationId);
        expect(mockAnalyticsRepository.logChatterEvent).toHaveBeenCalledWith(
          sessionId,
          expect.any(String),
          expect.objectContaining({
            eventType: 'player_miss',
            enemyType: 'goblin',
            dialogueTone: 'sarcastic',
            playerContextUsed: expect.objectContaining({
              victories: 2,
              defeats: 8
            })
          })
        );
      });

      it('should generate different taunts based on enemy dialogue tone', async () => {
        // Arrange - Dragon with condescending tone
        const session = CombatFactory.createSession(user.id, locationId, 5, {
          enemy_type_id: 'dragon-456'
        });
        const enemyType = ChatterFactory.createEnemyType('dragon');
        const playerHistory = ChatterFactory.createPlayerCombatHistory(user.id, locationId);
        const eventDetails = ChatterFactory.createCombatEventDetails('combat_start');

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockEnemyRepository.getEnemyType.mockResolvedValue(enemyType);
        mockCombatRepository.getPlayerCombatHistory.mockResolvedValue(playerHistory);

        mockOpenAIService.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: 'Another mortal seeks to challenge me. How... quaint.'
            }
          }]
        });

        // Act
        const result = await chatterService.generateEnemyChatter(sessionId, 'combat_start', eventDetails);

        // Assert
        expect(result.dialogue).toContain('mortal');
        expect(result.enemy_type).toBe('dragon');
        expect(result.dialogue_tone).toBe('condescending');
      });

      it('should handle low player HP taunting', async () => {
        // Arrange
        const session = CombatFactory.createSession(user.id, locationId, 4);
        const enemyType = ChatterFactory.createEnemyType('orc');
        const playerHistory = ChatterFactory.createPlayerCombatHistory(user.id, locationId);
        const eventDetails = ChatterFactory.createCombatEventDetails('low_player_hp', {
          player_hp_pct: 15
        });

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockEnemyRepository.getEnemyType.mockResolvedValue(enemyType);
        mockCombatRepository.getPlayerCombatHistory.mockResolvedValue(playerHistory);

        mockOpenAIService.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: 'GRAAAH! You weak! Soon you fall!'
            }
          }]
        });

        // Act
        const result = await chatterService.generateEnemyChatter(sessionId, 'low_player_hp', eventDetails);

        // Assert
        expect(result.dialogue).toContain('weak');
        expect(result.dialogue_tone).toBe('aggressive');
      });
    });

    describe('fallback mechanism', () => {
      it('should use enemy fallback taunts when AI service fails', async () => {
        // Arrange
        const session = CombatFactory.createSession(user.id, locationId, 2);
        const enemyType = ChatterFactory.createEnemyType('wizard');
        const playerHistory = ChatterFactory.createPlayerCombatHistory(user.id, locationId);
        const eventDetails = ChatterFactory.createCombatEventDetails('near_victory');

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockEnemyRepository.getEnemyType.mockResolvedValue(enemyType);
        mockCombatRepository.getPlayerCombatHistory.mockResolvedValue(playerHistory);

        // Mock AI service timeout
        mockOpenAIService.chat.completions.create.mockRejectedValue(
          ChatterFactory.createTimeoutError()
        );

        // Act
        const result = await chatterService.generateEnemyChatter(sessionId, 'near_victory', eventDetails);

        // Assert
        expect(result.was_ai_generated).toBe(false);
        expect(enemyType.example_taunts).toContain(result.dialogue);
        expect(result.enemy_type).toBe('wizard');
        expect(result.dialogue_tone).toBe('chaotic');

        expect(mockAnalyticsRepository.logChatterEvent).toHaveBeenCalledWith(
          sessionId,
          expect.any(String),
          expect.objectContaining({
            wasAIGenerated: false,
            fallbackReason: 'ai_timeout'
          })
        );
      });
    });

    describe('error conditions', () => {
      it('should throw SessionNotFoundError when combat session not found', async () => {
        // Arrange
        mockCombatRepository.getActiveSession.mockResolvedValue(null);
        const eventDetails = ChatterFactory.createCombatEventDetails('combat_start');

        // Act & Assert
        await expect(
          chatterService.generateEnemyChatter(sessionId, 'combat_start', eventDetails)
        ).rejects.toThrow(SessionNotFoundError);
      });

      it('should throw EnemyTypeNotFoundError when enemy type not found', async () => {
        // Arrange
        const session = CombatFactory.createSession(user.id, locationId, 1, {
          enemy_type_id: 'unknown-enemy'
        });

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockEnemyRepository.getEnemyType.mockResolvedValue(null);

        const eventDetails = ChatterFactory.createCombatEventDetails('combat_start');

        // Act & Assert
        await expect(
          chatterService.generateEnemyChatter(sessionId, 'combat_start', eventDetails)
        ).rejects.toThrow(EnemyTypeNotFoundError);

        await expect(
          chatterService.generateEnemyChatter(sessionId, 'combat_start', eventDetails)
        ).rejects.toThrow('Enemy type unknown-enemy not found');
      });
    });

    describe('all event types', () => {
      const eventTypes: EnemyChatterEventType[] = [
        'combat_start',
        'player_hit',
        'player_miss',
        'enemy_hit',
        'low_player_hp',
        'near_victory',
        'defeat',
        'victory'
      ];

      eventTypes.forEach(eventType => {
        it(`should handle ${eventType} events`, async () => {
          // Arrange
          const session = CombatFactory.createSession(user.id, locationId, 3);
          const enemyType = ChatterFactory.createEnemyType('politician');
          const playerHistory = ChatterFactory.createPlayerCombatHistory(user.id, locationId);
          const eventDetails = ChatterFactory.createCombatEventDetails(eventType);

          mockCombatRepository.getActiveSession.mockResolvedValue(session);
          mockEnemyRepository.getEnemyType.mockResolvedValue(enemyType);
          mockCombatRepository.getPlayerCombatHistory.mockResolvedValue(playerHistory);

          mockOpenAIService.chat.completions.create.mockResolvedValue({
            choices: [{
              message: {
                content: `Political response for ${eventType}!`
              }
            }]
          });

          // Act
          const result = await chatterService.generateEnemyChatter(sessionId, eventType, eventDetails);

          // Assert
          expect(result.dialogue).toContain(eventType);
          expect(result.enemy_type).toBe('politician');
          expect(result.dialogue_tone).toBe('political');
        });
      });
    });
  });

  /**
   * Test Group 3: Pet Personality Management
   * Tests personality-related methods
   */
  describe('personality management', () => {
    describe('getPetPersonalities()', () => {
      it('should return all available pet personalities', async () => {
        // Arrange
        const personalities = ChatterFactory.createManyPersonalities([
          'sassy', 'encouraging', 'analytical', 'chaotic', 'stoic', 'trash_talker'
        ]);

        mockPetRepository.getAllPersonalities.mockResolvedValue(personalities);

        // Act
        const result = await chatterService.getPetPersonalities();

        // Assert
        expect(result).toHaveLength(6);
        expect(result).toEqual(personalities);
        expect(mockPetRepository.getAllPersonalities).toHaveBeenCalledWith();

        // Verify personality structure
        result.forEach(personality => {
          expect(personality).toHaveProperty('personality_type');
          expect(personality).toHaveProperty('display_name');
          expect(personality).toHaveProperty('description');
          expect(personality).toHaveProperty('traits');
          expect(personality).toHaveProperty('example_phrases');
          expect(personality).toHaveProperty('verbosity');
        });
      });

      it('should return empty array when no personalities available', async () => {
        // Arrange
        mockPetRepository.getAllPersonalities.mockResolvedValue([]);

        // Act
        const result = await chatterService.getPetPersonalities();

        // Assert
        expect(result).toEqual([]);
      });
    });

    describe('assignPetPersonality()', () => {
      it('should successfully assign personality to pet', async () => {
        // Arrange
        const pet = ChatterFactory.createEquippedPet(user.id, 'sassy');
        const personality = ChatterFactory.createPetPersonality('encouraging');
        const petId = pet.id;
        const newPersonalityType = 'encouraging';

        mockPetRepository.findPetById.mockResolvedValue(pet);
        mockPetRepository.getPersonalityData.mockResolvedValue(personality);
        mockPetRepository.updatePetPersonality.mockResolvedValue(undefined);

        // Act
        const result = await chatterService.assignPetPersonality(petId, newPersonalityType);

        // Assert
        expect(result).toMatchObject({
          success: true,
          pet_id: petId,
          personality_type: newPersonalityType,
          custom_name: undefined
        });

        expect(mockPetRepository.findPetById).toHaveBeenCalledWith(petId);
        expect(mockPetRepository.getPersonalityData).toHaveBeenCalledWith(newPersonalityType);
        expect(mockPetRepository.updatePetPersonality).toHaveBeenCalledWith(
          petId,
          newPersonalityType,
          undefined
        );
      });

      it('should assign personality with custom name', async () => {
        // Arrange
        const pet = ChatterFactory.createEquippedPet(user.id, 'stoic');
        const personality = ChatterFactory.createPetPersonality('chaotic');
        const petId = pet.id;
        const customName = 'Zany McZoom';

        mockPetRepository.findPetById.mockResolvedValue(pet);
        mockPetRepository.getPersonalityData.mockResolvedValue(personality);
        mockPetRepository.updatePetPersonality.mockResolvedValue(undefined);

        // Act
        const result = await chatterService.assignPetPersonality(petId, 'chaotic', customName);

        // Assert
        expect(result.custom_name).toBe(customName);
        expect(mockPetRepository.updatePetPersonality).toHaveBeenCalledWith(
          petId,
          'chaotic',
          customName
        );
      });

      it('should throw PetNotFoundError when pet does not exist', async () => {
        // Arrange
        mockPetRepository.findPetById.mockResolvedValue(null);

        // Act & Assert
        await expect(
          chatterService.assignPetPersonality('fake-pet-id', 'sassy')
        ).rejects.toThrow(PetNotFoundError);

        await expect(
          chatterService.assignPetPersonality('fake-pet-id', 'sassy')
        ).rejects.toThrow('Pet fake-pet-id not found');
      });

      it('should throw InvalidPersonalityError when personality type invalid', async () => {
        // Arrange
        const pet = ChatterFactory.createEquippedPet(user.id, 'sassy');
        mockPetRepository.findPetById.mockResolvedValue(pet);
        mockPetRepository.getPersonalityData.mockResolvedValue(null);

        // Act & Assert
        await expect(
          chatterService.assignPetPersonality(pet.id, 'invalid_personality')
        ).rejects.toThrow(InvalidPersonalityError);

        await expect(
          chatterService.assignPetPersonality(pet.id, 'invalid_personality')
        ).rejects.toThrow('Personality type invalid_personality not found');
      });
    });

    describe('getEnemyTypes()', () => {
      it('should return all available enemy types', async () => {
        // Arrange
        const enemyTypes = ChatterFactory.createManyEnemyTypes([
          'goblin', 'orc', 'dragon', 'wizard', 'politician'
        ]);

        mockEnemyRepository.getAllEnemyTypes.mockResolvedValue(enemyTypes);

        // Act
        const result = await chatterService.getEnemyTypes();

        // Assert
        expect(result).toHaveLength(5);
        expect(result).toEqual(enemyTypes);
        expect(mockEnemyRepository.getAllEnemyTypes).toHaveBeenCalledWith();

        // Verify enemy type structure
        result.forEach(enemyType => {
          expect(enemyType).toHaveProperty('type');
          expect(enemyType).toHaveProperty('display_name');
          expect(enemyType).toHaveProperty('personality_traits');
          expect(enemyType).toHaveProperty('dialogue_tone');
          expect(enemyType).toHaveProperty('example_taunts');
          expect(enemyType).toHaveProperty('verbosity');
        });
      });
    });
  });

  /**
   * Test Group 4: AI Service Integration & Timeout Handling
   * Tests OpenAI integration, timeout scenarios, and error recovery
   */
  describe('AI service integration', () => {
    describe('timeout scenarios', () => {
      it('should timeout after 2 seconds and use fallback', async () => {
        // Arrange
        const session = CombatFactory.createSession(user.id, locationId, 1);
        const pet = ChatterFactory.createEquippedPet(user.id, 'analytical');
        const personality = ChatterFactory.createPetPersonality('analytical');
        const eventDetails = ChatterFactory.createCombatEventDetails('player_attack');

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockPetRepository.getEquippedPet.mockResolvedValue(pet);
        mockPetRepository.getPersonalityData.mockResolvedValue(personality);

        // Mock slow AI response (simulates timeout)
        mockOpenAIService.chat.completions.create.mockImplementation(() => {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 3000); // 3 seconds
          });
        });

        // Act
        const startTime = Date.now();
        const result = await chatterService.generatePetChatter(sessionId, 'player_attack', eventDetails);
        const elapsed = Date.now() - startTime;

        // Assert
        expect(elapsed).toBeLessThan(2500); // Should timeout around 2 seconds
        expect(result.was_ai_generated).toBe(false);
        expect(personality.example_phrases).toContain(result.dialogue);
      });

      it('should handle AI service rate limiting errors', async () => {
        // Arrange
        const session = CombatFactory.createSession(user.id, locationId, 1);
        const enemyType = ChatterFactory.createEnemyType('goblin');
        const playerHistory = ChatterFactory.createPlayerCombatHistory(user.id, locationId);
        const eventDetails = ChatterFactory.createCombatEventDetails('player_hit');

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockEnemyRepository.getEnemyType.mockResolvedValue(enemyType);
        mockCombatRepository.getPlayerCombatHistory.mockResolvedValue(playerHistory);

        // Mock rate limit error
        const rateLimitError = ChatterFactory.createOpenAIError(429, 'Rate limit exceeded');
        mockOpenAIService.chat.completions.create.mockRejectedValue(rateLimitError);

        // Act
        const result = await chatterService.generateEnemyChatter(sessionId, 'player_hit', eventDetails);

        // Assert
        expect(result.was_ai_generated).toBe(false);
        expect(enemyType.example_taunts).toContain(result.dialogue);
      });

      it('should handle network connectivity issues', async () => {
        // Arrange
        const session = CombatFactory.createSession(user.id, locationId, 1);
        const pet = ChatterFactory.createEquippedPet(user.id, 'trash_talker');
        const personality = ChatterFactory.createPetPersonality('trash_talker');
        const eventDetails = ChatterFactory.createCombatEventDetails('victory');

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockPetRepository.getEquippedPet.mockResolvedValue(pet);
        mockPetRepository.getPersonalityData.mockResolvedValue(personality);

        // Mock network error
        const networkError = new Error('ECONNREFUSED');
        networkError.name = 'NetworkError';
        mockOpenAIService.chat.completions.create.mockRejectedValue(networkError);

        // Act
        const result = await chatterService.generatePetChatter(sessionId, 'victory', eventDetails);

        // Assert
        expect(result.was_ai_generated).toBe(false);
        expect(personality.example_phrases).toContain(result.dialogue);
      });
    });

    describe('prompt generation', () => {
      it('should include personality traits in pet prompts', async () => {
        // Arrange
        const session = CombatFactory.createSession(user.id, locationId, 2);
        const pet = ChatterFactory.createEquippedPet(user.id, 'sassy');
        const personality = ChatterFactory.createPetPersonality('sassy');
        const eventDetails = ChatterFactory.createCombatEventDetails('critical_hit');

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockPetRepository.getEquippedPet.mockResolvedValue(pet);
        mockPetRepository.getPersonalityData.mockResolvedValue(personality);

        let capturedPrompt = '';
        mockOpenAIService.chat.completions.create.mockImplementation((params) => {
          capturedPrompt = params.messages[0].content;
          return Promise.resolve({
            choices: [{
              message: {
                content: 'Test response'
              }
            }]
          });
        });

        // Act
        await chatterService.generatePetChatter(sessionId, 'critical_hit', eventDetails);

        // Assert
        expect(capturedPrompt).toContain('sassy');
        expect(capturedPrompt).toContain('critical_hit');
        expect(capturedPrompt).toContain(personality.traits.join(', '));
      });

      it('should include player history in enemy prompts', async () => {
        // Arrange
        const session = CombatFactory.createSession(user.id, locationId, 3);
        const enemyType = ChatterFactory.createEnemyType('dragon');
        const playerHistory = ChatterFactory.createPlayerCombatHistory(user.id, locationId, {
          victories: 15,
          defeats: 5,
          current_streak: 8
        });
        const eventDetails = ChatterFactory.createCombatEventDetails('combat_start');

        mockCombatRepository.getActiveSession.mockResolvedValue(session);
        mockEnemyRepository.getEnemyType.mockResolvedValue(enemyType);
        mockCombatRepository.getPlayerCombatHistory.mockResolvedValue(playerHistory);

        let capturedPrompt = '';
        mockOpenAIService.chat.completions.create.mockImplementation((params) => {
          capturedPrompt = params.messages[0].content;
          return Promise.resolve({
            choices: [{
              message: {
                content: 'Test response'
              }
            }]
          });
        });

        // Act
        await chatterService.generateEnemyChatter(sessionId, 'combat_start', eventDetails);

        // Assert
        expect(capturedPrompt).toContain('Victories: 15');
        expect(capturedPrompt).toContain('Defeats: 5');
        expect(capturedPrompt).toContain('Current streak: 8');
        expect(capturedPrompt).toContain('condescending');
      });
    });
  });

  /**
   * Test Group 5: Analytics and Performance
   * Tests logging, metrics, and performance tracking
   */
  describe('analytics and performance', () => {
    it('should log all chatter events with complete metadata', async () => {
      // Arrange
      const session = CombatFactory.createSession(user.id, locationId, 4);
      const pet = ChatterFactory.createEquippedPet(user.id, 'encouraging');
      const personality = ChatterFactory.createPetPersonality('encouraging');
      const eventDetails = ChatterFactory.createCombatEventDetails('victory');

      mockCombatRepository.getActiveSession.mockResolvedValue(session);
      mockPetRepository.getEquippedPet.mockResolvedValue(pet);
      mockPetRepository.getPersonalityData.mockResolvedValue(personality);

      mockOpenAIService.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'We did it! Amazing victory!'
          }
        }]
      });

      // Act
      await chatterService.generatePetChatter(sessionId, 'victory', eventDetails);

      // Assert
      expect(mockAnalyticsRepository.logChatterEvent).toHaveBeenCalledWith(
        sessionId,
        'We did it! Amazing victory!',
        expect.objectContaining({
          eventType: 'victory',
          personalityType: 'encouraging',
          wasAIGenerated: true,
          generationTime: expect.any(Number),
          fallbackReason: null
        })
      );
    });

    it('should track generation time accurately', async () => {
      // Arrange
      const session = CombatFactory.createSession(user.id, locationId, 1);
      const pet = ChatterFactory.createEquippedPet(user.id, 'analytical');
      const personality = ChatterFactory.createPetPersonality('analytical');
      const eventDetails = ChatterFactory.createCombatEventDetails('player_attack');

      mockCombatRepository.getActiveSession.mockResolvedValue(session);
      mockPetRepository.getEquippedPet.mockResolvedValue(pet);
      mockPetRepository.getPersonalityData.mockResolvedValue(personality);

      // Mock AI response with artificial delay
      mockOpenAIService.chat.completions.create.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              choices: [{
                message: {
                  content: 'Calculated response time: 500ms'
                }
              }]
            });
          }, 500);
        });
      });

      // Act
      const result = await chatterService.generatePetChatter(sessionId, 'player_attack', eventDetails);

      // Assert
      expect(result.generation_time_ms).toBeGreaterThanOrEqual(500);
      expect(result.generation_time_ms).toBeLessThan(1000); // Should be close to 500ms
    });

    it('should log fallback events with failure reasons', async () => {
      // Arrange
      const session = CombatFactory.createSession(user.id, locationId, 2);
      const enemyType = ChatterFactory.createEnemyType('orc');
      const playerHistory = ChatterFactory.createPlayerCombatHistory(user.id, locationId);
      const eventDetails = ChatterFactory.createCombatEventDetails('enemy_hit');

      mockCombatRepository.getActiveSession.mockResolvedValue(session);
      mockEnemyRepository.getEnemyType.mockResolvedValue(enemyType);
      mockCombatRepository.getPlayerCombatHistory.mockResolvedValue(playerHistory);

      // Mock AI service failure
      mockOpenAIService.chat.completions.create.mockRejectedValue(
        new Error('Service unavailable')
      );

      // Act
      await chatterService.generateEnemyChatter(sessionId, 'enemy_hit', eventDetails);

      // Assert
      expect(mockAnalyticsRepository.logChatterEvent).toHaveBeenCalledWith(
        sessionId,
        expect.any(String),
        expect.objectContaining({
          wasAIGenerated: false,
          fallbackReason: 'ai_timeout'
        })
      );
    });
  });
});