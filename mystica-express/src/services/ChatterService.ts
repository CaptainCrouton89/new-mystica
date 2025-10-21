/**
 * ChatterService - AI-powered dialogue generation service
 *
 * Implements F-11 (Pet Personality & Chatter) and F-12 (Enemy Trash Talk)
 * Features:
 * - Pet personality-based dialogue generation
 * - Enemy trash-talk with player context
 * - OpenAI GPT-4.1-mini integration with fallback phrases
 * - 2-second timeout with graceful degradation
 * - Analytics logging for quality monitoring
 */

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import {
  PetChatterEventType,
  EnemyChatterEventType,
  CombatEventDetails,
  ChatterResponse,
  EnemyChatterResponse,
  PetPersonality,
  EnemyType,
  PlayerCombatHistory,
  PersonalityAssignmentResult,
  ChatterMetadata
} from '../types/api.types.js';
import {
  SessionNotFoundError,
  NoPetEquippedError,
  PersonalityNotFoundError,
  PetNotFoundError,
  InvalidPersonalityError,
  EnemyTypeNotFoundError,
  ExternalAPIError
} from '../utils/errors.js';
import { CombatRepository } from '../repositories/CombatRepository.js';
import { PetRepository } from '../repositories/PetRepository.js';
import { EnemyRepository } from '../repositories/EnemyRepository.js';
import { AnalyticsRepository } from '../repositories/AnalyticsRepository.js';

interface CombatContext {
  turnNumber: number;
  playerHpPct: number;
  enemyHpPct: number;
  eventType: string;
  damage?: number;
  isCritical?: boolean;
}

interface CombatEvent {
  damage?: number;
  accuracy?: number;
  is_critical?: boolean;
  turn_number: number;
  player_hp_pct: number;
  enemy_hp_pct: number;
}

/**
 * ChatterService implementation
 * Handles AI-powered dialogue generation for combat events
 */
export class ChatterService {
  private readonly AI_TIMEOUT_MS = 2000; // 2 second timeout
  private combatRepository: CombatRepository;
  private petRepository: PetRepository;
  private enemyRepository: EnemyRepository;
  private analyticsRepository: AnalyticsRepository;

  constructor() {
    this.combatRepository = new CombatRepository();
    this.petRepository = new PetRepository();
    this.enemyRepository = new EnemyRepository();
    this.analyticsRepository = new AnalyticsRepository();
  }

  // =====================================
  // PET CHATTER GENERATION (F-11)
  // =====================================

  /**
   * Generate AI-powered pet dialogue based on personality traits and combat events
   *
   * @param sessionId - Active combat session identifier
   * @param eventType - Combat event trigger
   * @param eventDetails - Event context data
   * @returns Generated pet chatter with metadata
   * @throws SessionNotFoundError if session not found/expired
   * @throws NoPetEquippedError if no pet equipped
   * @throws PersonalityNotFoundError if personality template missing
   */
  async generatePetChatter(
    sessionId: string,
    eventType: PetChatterEventType,
    eventDetails: CombatEventDetails
  ): Promise<ChatterResponse> {
    // 1. Validate session exists and get combat context
    const session = await this.combatRepository.getActiveSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(`Combat session ${sessionId} not found or expired`);
    }

    // 2. Get equipped pet and personality data
    const pet = await this.getEquippedPet(session.userId);
    if (!pet) {
      throw new NoPetEquippedError('Player has no pet equipped for chatter generation');
    }

    if (!pet.personality_type) {
      throw new PersonalityNotFoundError('Pet has no personality assigned');
    }

    const personality = await this.petRepository.findPersonalityByType(pet.personality_type);
    if (!personality) {
      throw new PersonalityNotFoundError(`Pet personality ${pet.personality_type} not found`);
    }

    // 3. Build AI prompt with personality context
    const combatContext: CombatContext = {
      turnNumber: eventDetails.turn_number,
      playerHpPct: eventDetails.player_hp_pct,
      enemyHpPct: eventDetails.enemy_hp_pct,
      eventType,
      damage: eventDetails.damage,
      isCritical: eventDetails.is_critical
    };

    const prompt = await this.buildPetPrompt(personality, combatContext, eventDetails);

    // 4. Generate dialogue with timeout and fallback
    let dialogue: string;
    let wasAIGenerated = true;
    const startTime = Date.now();

    try {
      dialogue = await this.callAIService(prompt, this.AI_TIMEOUT_MS);
    } catch (error) {
      // Fallback to example phrases
      dialogue = await this.getRandomFallbackPhrase(Array.isArray(personality.example_phrases) ? personality.example_phrases as string[] : []);
      wasAIGenerated = false;
    }

    const generationTime = Date.now() - startTime;

    // 5. Log chatter event for analytics
    await this.logChatterEvent(sessionId, dialogue, {
      eventType,
      personalityType: personality.personality_type,
      wasAIGenerated,
      generationTime,
      fallbackReason: !wasAIGenerated ? 'ai_timeout' : undefined
    });

    return {
      dialogue,
      personality_type: personality.personality_type,
      generation_time_ms: generationTime,
      was_ai_generated: wasAIGenerated
    };
  }

  // =====================================
  // ENEMY CHATTER GENERATION (F-12)
  // =====================================

  /**
   * Generate contextual enemy trash-talk using player combat history and performance
   *
   * @param sessionId - Active combat session identifier
   * @param eventType - Combat event trigger
   * @param eventDetails - Event context data
   * @returns Generated enemy chatter with metadata
   * @throws SessionNotFoundError if session not found/expired
   * @throws EnemyTypeNotFoundError if enemy type not found
   */
  async generateEnemyChatter(
    sessionId: string,
    eventType: EnemyChatterEventType,
    eventDetails: CombatEventDetails
  ): Promise<EnemyChatterResponse> {
    // 1. Validate session and get enemy context
    const session = await this.combatRepository.getActiveSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(`Combat session ${sessionId} not found or expired`);
    }

    const enemyType = await this.enemyRepository.findEnemyTypeById(session.enemyTypeId);
    if (!enemyType) {
      throw new EnemyTypeNotFoundError(`Enemy type ${session.enemyTypeId} not found`);
    }

    // 2. Get player combat history for contextual taunts
    const playerHistory = await this.combatRepository.getPlayerHistory(session.userId, session.locationId);

    // Convert to PlayerCombatHistory format
    const playerContext: PlayerCombatHistory = {
      attempts: playerHistory?.totalAttempts || 0,
      victories: playerHistory?.victories || 0,
      defeats: playerHistory?.defeats || 0,
      current_streak: playerHistory?.currentStreak || 0
    };

    // 3. Build AI prompt with enemy personality and player context
    const combatContext: CombatContext = {
      turnNumber: eventDetails.turn_number,
      playerHpPct: eventDetails.player_hp_pct,
      enemyHpPct: eventDetails.enemy_hp_pct,
      eventType,
      damage: eventDetails.damage,
      isCritical: eventDetails.is_critical
    };

    const prompt = await this.buildEnemyPrompt(enemyType, playerContext, combatContext, eventDetails);

    // 4. Generate dialogue with timeout and fallback
    let dialogue: string;
    let wasAIGenerated = true;
    const startTime = Date.now();

    try {
      dialogue = await this.callAIService(prompt, this.AI_TIMEOUT_MS);
    } catch (error) {
      // Fallback to example taunts
      dialogue = await this.getRandomFallbackPhrase(enemyType.example_taunts || []);
      wasAIGenerated = false;
    }

    const generationTime = Date.now() - startTime;

    // 5. Log chatter event for analytics
    await this.logChatterEvent(sessionId, dialogue, {
      eventType,
      enemyType: enemyType.name,
      dialogueTone: enemyType.dialogue_tone || '',
      wasAIGenerated,
      generationTime,
      playerContextUsed: playerContext,
      fallbackReason: !wasAIGenerated ? 'ai_timeout' : undefined
    });

    return {
      dialogue,
      personality_type: '', // Not applicable for enemies
      enemy_type: enemyType.name,
      dialogue_tone: enemyType.dialogue_tone || '',
      generation_time_ms: generationTime,
      was_ai_generated: wasAIGenerated,
      player_context_used: playerContext
    };
  }

  // =====================================
  // PERSONALITY MANAGEMENT (F-11)
  // =====================================

  /**
   * Return available pet personality types with example phrases and traits
   *
   * @returns Array of PetPersonality objects
   */
  async getPetPersonalities(): Promise<PetPersonality[]> {
    const personalities = await this.petRepository.getAllPersonalities();

    return personalities.map(p => ({
      personality_type: p.personality_type || '',
      display_name: p.display_name || '',
      description: p.description || '',
      traits: Array.isArray(p.traits) ? p.traits.map(t => String(t)) : [],
      example_phrases: Array.isArray(p.example_phrases) ? p.example_phrases.map(e => String(e)) : [],
      verbosity: (p.verbosity as 'terse' | 'moderate' | 'verbose') || 'moderate'
    }));
  }

  /**
   * Assign personality type and optional custom name to player's pet
   *
   * @param petId - Pet identifier to update
   * @param personalityType - Personality type to assign
   * @param customName - Optional custom pet name
   * @returns Assignment result
   * @throws PetNotFoundError if pet not found
   * @throws InvalidPersonalityError if personality type invalid
   */
  async assignPetPersonality(
    petId: string,
    personalityType: string,
    customName?: string
  ): Promise<PersonalityAssignmentResult> {
    // 1. Validate pet ownership and personality type exists
    const pet = await this.petRepository.findPetByItemId(petId);
    if (!pet) {
      throw new PetNotFoundError(`Pet ${petId} not found`);
    }

    const personality = await this.petRepository.findPersonalityByType(personalityType);
    if (!personality) {
      throw new InvalidPersonalityError(`Personality type ${personalityType} not found`);
    }

    // 2. Update pet with new personality and optional name
    await this.petRepository.updatePetPersonality(petId, personality.id!, customName);

    return {
      success: true,
      pet_id: petId,
      personality_type: personalityType,
      custom_name: customName
    };
  }

  // =====================================
  // ENEMY TYPE MANAGEMENT (F-12)
  // =====================================

  /**
   * Return available enemy types with personality traits and example taunts
   *
   * @returns Array of EnemyType objects
   */
  async getEnemyTypes(): Promise<EnemyType[]> {
    const enemyTypes = await this.enemyRepository.findAllEnemyTypes();

    return enemyTypes.map(e => ({
      type: e.name || '',
      display_name: e.name || '',
      personality_traits: e.ai_personality_traits ? Object.keys(e.ai_personality_traits) : [],
      dialogue_tone: 'aggressive' as const, // Default tone - should be from database
      example_taunts: e.example_taunts || [],
      verbosity: 'moderate' as const, // Default verbosity - should be from database
      tier_id: e.tier_id || 1,
      style_id: e.style_id || ''
    }));
  }

  // =====================================
  // PRIVATE HELPER METHODS
  // =====================================

  /**
   * Get equipped pet for user with personality data
   */
  private async getEquippedPet(userId: string): Promise<{
    item_id: string;
    personality_id: string | null;
    personality_type: string | null;
    custom_name: string | null;
  } | null> {
    try {
      // Import EquipmentRepository dynamically to avoid circular dependencies
      const { EquipmentRepository } = await import('../repositories/EquipmentRepository.js');
      const equipmentRepository = new EquipmentRepository();

      // Get equipped pet from pet slot
      const equippedPet = await equipmentRepository.findItemInSlot(userId, 'pet');
      if (!equippedPet) {
        return null; // No pet equipped
      }

      // Get pet details with personality from PetRepository
      const pet = await this.petRepository.findPetByItemId(equippedPet.id);
      if (!pet) {
        return null; // Pet item exists but no pet record (data inconsistency)
      }

      // Get personality details if personality_id exists
      let personalityType: string | null = null;
      if (pet.personality_id) {
        const personality = await this.petRepository.findPersonalityById(pet.personality_id);
        personalityType = personality?.personality_type || null;
      }

      return {
        item_id: equippedPet.id,
        personality_id: pet.personality_id,
        personality_type: personalityType,
        custom_name: pet.custom_name
      };

    } catch (error) {
      // Log error but don't fail chatter generation
      console.warn('Failed to get equipped pet:', error);
      return null;
    }
  }

  /**
   * Build AI prompt for pet chatter generation
   */
  private async buildPetPrompt(
    personality: any,
    context: CombatContext,
    event: CombatEventDetails
  ): Promise<string> {
    const personalityTraits = Array.isArray(personality.traits) ? personality.traits.join(', ') : '';

    return `You are a ${personality.personality_type} pet companion in a fantasy combat game. Your traits: ${personalityTraits}.

Combat Context:
- Turn ${context.turnNumber}, Player HP: ${Math.round(context.playerHpPct * 100)}%, Enemy HP: ${Math.round(context.enemyHpPct * 100)}%
- Event: ${context.eventType}
- ${this.formatEventContext(context)}

Generate a single, short ${personality.verbosity} comment (1-2 sentences) that matches your ${personality.personality_type} personality. Stay in character and react to the combat event.

Personality Guidelines:
- sassy: Witty, slightly sarcastic, confident
- encouraging: Supportive, motivational, optimistic
- analytical: Data-focused, strategic, logical
- chaotic: Unpredictable, energetic, random
- stoic: Calm, philosophical, reserved
- trash_talker: Competitive, provocative, boastful

Response:`;
  }

  /**
   * Build AI prompt for enemy chatter generation
   */
  private async buildEnemyPrompt(
    enemyType: any,
    playerHistory: PlayerCombatHistory,
    context: CombatContext,
    event: CombatEventDetails
  ): Promise<string> {
    const winRate = playerHistory.attempts > 0 ? Math.round((playerHistory.victories / playerHistory.attempts) * 100) : 0;
    const streakType = playerHistory.current_streak >= 0 ? 'wins' : 'losses';

    return `You are a ${enemyType.type} enemy with ${enemyType.dialogue_tone} personality in a fantasy combat game.

Player History at this location:
- Attempts: ${playerHistory.attempts}, Victories: ${playerHistory.victories}, Defeats: ${playerHistory.defeats}
- Current streak: ${Math.abs(playerHistory.current_streak)} ${streakType}
- Win rate: ${winRate}%

Combat Context:
- Turn ${context.turnNumber}, Player HP: ${Math.round(context.playerHpPct * 100)}%, Your HP: ${Math.round(context.enemyHpPct * 100)}%
- Event: ${context.eventType}
- ${this.formatEventContext(context)}

Generate a single, short taunt (1-2 sentences) that:
1. Matches your ${enemyType.dialogue_tone} personality
2. References the player's performance history when relevant
3. Reacts to the current combat event

Tone Guidelines:
- aggressive: Direct threats, intimidating
- sarcastic: Mocking, ironic, cutting
- condescending: Patronizing, superior, dismissive
- chaotic: Unpredictable, nonsensical, erratic
- political: References current events, philosophical

Response:`;
  }

  /**
   * Format combat event details for AI prompt
   */
  private formatEventContext(context: CombatContext): string {
    if (context.damage && context.isCritical) {
      return `${context.damage} damage dealt (CRITICAL HIT!)`;
    } else if (context.damage) {
      return `${context.damage} damage dealt`;
    } else {
      return 'No damage dealt';
    }
  }

  /**
   * Call AI service with timeout
   */
  private async callAIService(prompt: string, timeout: number): Promise<string> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI service timeout')), timeout);
      });

      const aiPromise = generateText({
        model: openai('gpt-4.1-mini'),
        prompt
      });

      const result = await Promise.race([aiPromise, timeoutPromise]);
      return result.text.trim();
    } catch (error) {
      throw new ExternalAPIError(
        'OpenAI',
        error instanceof Error ? error.message : 'Failed to generate dialogue'
      );
    }
  }

  /**
   * Get random fallback phrase from array
   */
  private async getRandomFallbackPhrase(phrases: string[]): Promise<string> {
    if (!phrases || phrases.length === 0) {
      return "..."; // Default fallback
    }

    const randomIndex = Math.floor(Math.random() * phrases.length);
    return phrases[randomIndex];
  }

  /**
   * Log chatter event to analytics
   */
  private async logChatterEvent(
    sessionId: string,
    dialogue: string,
    metadata: ChatterMetadata
  ): Promise<void> {
    try {
      if (metadata.personalityType) {
        // Pet chatter
        await this.analyticsRepository.logPetChatter(
          sessionId,
          '', // petItemId - would need to get from session
          metadata.eventType,
          dialogue,
          metadata.generationTime,
          metadata.wasAIGenerated
        );
      } else if (metadata.enemyType) {
        // Enemy chatter
        await this.analyticsRepository.logEnemyChatter(
          sessionId,
          '', // enemyTypeId - would need to get from session
          metadata.eventType,
          dialogue,
          metadata.playerContextUsed || null,
          metadata.generationTime,
          metadata.wasAIGenerated
        );
      }
    } catch (error) {
      // Don't throw here - logging failure shouldn't break chatter generation
      console.error('Failed to log chatter event:', error);
    }
  }
}

// Export a factory function for testing and lazy initialization
export const createChatterService = () => new ChatterService();

// Export singleton instance for use in controllers
export const chatterService = createChatterService();