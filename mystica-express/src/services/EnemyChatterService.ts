import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { env } from '../config/env';
import { DatabaseError, ExternalAPIError } from '../utils/errors';
import {
  CombatEventType,
  CombatEventDetails,
  DialogueResponse,
  PlayerCombatContext,
} from '../types/combat.types';

/**
 * Schema for AI-generated dialogue response
 */
const aiDialogueSchema = z.object({
  dialogue: z.string().describe('A single line of dialogue appropriate for the combat event'),
  dialogue_tone: z.string().describe('The emotional tone of the dialogue (aggressive, mocking, desperate, etc.)'),
});

/**
 * Enemy personality data from database
 */
interface EnemyType {
  id: string;
  name: string;
  base_dialogue_prompt: string;
  example_taunts: string[];
  personality_traits: string[];
  combat_style: string;
}

/**
 * Service for generating AI-powered enemy dialogue during combat events
 *
 * Responsibilities:
 * - Generate contextual dialogue using OpenAI GPT-4.1-mini
 * - Fallback to random example_taunts on AI failure
 * - Log all dialogue attempts to enemychatterlog table
 * - Integrate player combat history into AI context
 */
export class EnemyChatterService {
  private readonly AI_TIMEOUT_MS = 2000; // 2 second timeout

  /**
   * Generate dialogue for a combat event
   * Main entry point for combat dialogue generation
   */
  async generateDialogue(
    sessionId: string,
    eventType: CombatEventType,
    eventDetails: CombatEventDetails,
    playerContext?: PlayerCombatContext
  ): Promise<DialogueResponse> {
    const startTime = Date.now();

    try {
      // Get combat session and enemy type data
      const [sessionData, enemyTypeData] = await Promise.all([
        this.getCombatSession(sessionId),
        this.getEnemyTypeFromSession(sessionId),
      ]);

      // Get player combat history if not provided
      const finalPlayerContext = playerContext || await this.getPlayerCombatHistory(
        sessionData.player_id,
        sessionData.location_id
      );

      let dialogue: string;
      let dialogueTone: string;
      let wasAIGenerated = false;

      // Try AI generation first
      try {
        const aiResult = await this.generateAIDialogue(
          enemyTypeData,
          eventType,
          eventDetails,
          finalPlayerContext
        );
        dialogue = aiResult.dialogue;
        dialogueTone = aiResult.dialogue_tone;
        wasAIGenerated = true;
      } catch (error) {
        // Fallback to example taunts on AI failure
        dialogue = this.selectFallbackTaunt(enemyTypeData, eventType);
        dialogueTone = this.getDefaultToneForEvent(eventType);
        wasAIGenerated = false;
      }

      const generationTimeMs = Date.now() - startTime;

      const response: DialogueResponse = {
        dialogue,
        enemy_type: enemyTypeData.name,
        dialogue_tone: dialogueTone,
        generation_time_ms: generationTimeMs,
        was_ai_generated: wasAIGenerated,
        player_context_used: finalPlayerContext,
      };

      // Log the dialogue attempt
      await this.logDialogueAttempt(
        sessionId,
        eventType,
        response,
        wasAIGenerated ? null : 'AI_TIMEOUT_FALLBACK'
      );

      return response;
    } catch (error) {
      const generationTimeMs = Date.now() - startTime;

      // Log failed attempt
      await this.logDialogueAttempt(
        sessionId,
        eventType,
        null,
        error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      );

      throw error;
    }
  }

  /**
   * Generate AI dialogue using OpenAI GPT-4.1-mini
   */
  private async generateAIDialogue(
    enemyType: EnemyType,
    eventType: CombatEventType,
    eventDetails: CombatEventDetails,
    playerContext: PlayerCombatContext
  ): Promise<{ dialogue: string; dialogue_tone: string }> {
    const prompts = this.buildAIPrompt(enemyType, eventType, eventDetails, playerContext);

    try {
      const { object } = await generateObject({
        model: openai('gpt-4.1-mini'),
        schema: aiDialogueSchema,
        system: prompts.system,
        prompt: prompts.user,
        maxRetries: 0,
      });

      return object;
    } catch (error) {
      throw new ExternalAPIError(
        'OpenAI',
        error instanceof Error ? error.message : 'Failed to generate dialogue'
      );
    }
  }

  /**
   * Build AI prompts for dialogue generation
   * Combines enemy personality with combat context
   */
  private buildAIPrompt(
    enemyType: EnemyType,
    eventType: CombatEventType,
    eventDetails: CombatEventDetails,
    playerContext: PlayerCombatContext
  ): { system: string; user: string } {
    const personalityTraits = enemyType.personality_traits.join(', ');

    const system = `${enemyType.base_dialogue_prompt}

You are a ${enemyType.name} with these personality traits: ${personalityTraits}.
Your combat style is: ${enemyType.combat_style}.

Generate a single line of dialogue appropriate for the current combat situation. The dialogue should:
- Reflect your personality and combat style
- Be contextually appropriate for the event type
- Be concise (1-2 sentences maximum)
- Match the tone and style of fantasy combat encounters
- Show awareness of the combat situation (HP levels, turn progression, etc.)

Consider the player's combat history when crafting your response - if they're experienced, you might be more respectful or challenging. If they're new, you might be more mocking or confident.`;

    const eventContext = this.formatEventContext(eventType, eventDetails);
    const playerContextText = this.formatPlayerContext(playerContext);

    const user = `Combat Event: ${eventType}
${eventContext}

Player Combat History:
${playerContextText}

Generate appropriate dialogue for this situation.`;

    return { system, user };
  }

  /**
   * Format combat event details for AI prompt
   */
  private formatEventContext(eventType: CombatEventType, eventDetails: CombatEventDetails): string {
    const { damage, accuracy, is_critical, turn_number, player_hp_percentage, enemy_hp_percentage } = eventDetails;

    switch (eventType) {
      case 'combat_start':
        return `Turn ${turn_number}: Combat begins. Player HP: ${Math.round(player_hp_percentage)}%, Enemy HP: ${Math.round(enemy_hp_percentage)}%`;

      case 'player_hit':
        return `Turn ${turn_number}: Player hit enemy for ${damage} damage${is_critical ? ' (CRITICAL!)' : ''}. Player HP: ${Math.round(player_hp_percentage)}%, Enemy HP: ${Math.round(enemy_hp_percentage)}%`;

      case 'player_miss':
        return `Turn ${turn_number}: Player missed their attack. Player HP: ${Math.round(player_hp_percentage)}%, Enemy HP: ${Math.round(enemy_hp_percentage)}%`;

      case 'enemy_hit':
        return `Turn ${turn_number}: Enemy hit player for ${damage} damage${is_critical ? ' (CRITICAL!)' : ''}. Player HP: ${Math.round(player_hp_percentage)}%, Enemy HP: ${Math.round(enemy_hp_percentage)}%`;

      case 'low_player_hp':
        return `Turn ${turn_number}: Player health is critically low (${Math.round(player_hp_percentage)}%). Enemy HP: ${Math.round(enemy_hp_percentage)}%`;

      case 'near_victory':
        return `Turn ${turn_number}: Enemy health is critically low (${Math.round(enemy_hp_percentage)}%). Player HP: ${Math.round(player_hp_percentage)}%`;

      case 'defeat':
        return `Turn ${turn_number}: Player has been defeated. Final Enemy HP: ${Math.round(enemy_hp_percentage)}%`;

      case 'victory':
        return `Turn ${turn_number}: Enemy has been defeated. Final Player HP: ${Math.round(player_hp_percentage)}%`;

      default:
        return `Turn ${turn_number}: ${eventType}. Player HP: ${Math.round(player_hp_percentage)}%, Enemy HP: ${Math.round(enemy_hp_percentage)}%`;
    }
  }

  /**
   * Format player combat context for AI prompt
   */
  private formatPlayerContext(playerContext: PlayerCombatContext): string {
    const { attempts, victories, defeats, current_streak } = playerContext;
    const winRate = attempts > 0 ? Math.round((victories / attempts) * 100) : 0;

    return `- Total battles: ${attempts}
- Victories: ${victories}
- Defeats: ${defeats}
- Win rate: ${winRate}%
- Current streak: ${current_streak} ${current_streak >= 0 ? 'wins' : 'losses'}`;
  }

  /**
   * Select fallback taunt from enemy's example_taunts
   */
  private selectFallbackTaunt(enemyType: EnemyType, eventType: CombatEventType): string {
    if (!enemyType.example_taunts || enemyType.example_taunts.length === 0) {
      return this.getGenericTaunt(eventType);
    }

    // Simple random selection from available taunts
    const randomIndex = Math.floor(Math.random() * enemyType.example_taunts.length);
    return enemyType.example_taunts[randomIndex];
  }

  /**
   * Get default dialogue tone for event type
   */
  private getDefaultToneForEvent(eventType: CombatEventType): string {
    switch (eventType) {
      case 'combat_start':
        return 'confident';
      case 'player_hit':
        return 'angry';
      case 'player_miss':
        return 'mocking';
      case 'enemy_hit':
        return 'triumphant';
      case 'low_player_hp':
        return 'cruel';
      case 'near_victory':
        return 'desperate';
      case 'defeat':
        return 'defiant';
      case 'victory':
        return 'victorious';
      default:
        return 'neutral';
    }
  }

  /**
   * Get generic taunt when no example_taunts available
   */
  private getGenericTaunt(eventType: CombatEventType): string {
    const genericTaunts = {
      combat_start: "You dare challenge me?",
      player_hit: "Is that the best you can do?",
      player_miss: "Pathetic! You can't even hit me!",
      enemy_hit: "Feel my power!",
      low_player_hp: "You're finished!",
      near_victory: "This cannot be!",
      defeat: "I... will... return...",
      victory: "Victory is mine!"
    };

    return genericTaunts[eventType] || "...";
  }

  /**
   * Get combat session data
   * Currently uses stub service since we're in development
   */
  private async getCombatSession(sessionId: string) {
    // Use stub service for now since we're in development
    const { combatStubService } = await import('./CombatStubService.js');
    return combatStubService.getCombatSession(sessionId);
  }

  /**
   * Get enemy type data from combat session
   * Currently uses hardcoded data since we're in development
   */
  private async getEnemyTypeFromSession(sessionId: string): Promise<EnemyType> {
    // Get the session to find the enemy_type_id
    const session = await this.getCombatSession(sessionId);

    // Return hardcoded enemy type data that matches our stub data
    const enemyTypes: Record<string, EnemyType> = {
      'd9e715fb-5de0-4639-96f8-3b4f03476314': {
        id: 'd9e715fb-5de0-4639-96f8-3b4f03476314',
        name: 'Spray Paint Goblin',
        base_dialogue_prompt: 'You are a mischievous urban creature that loves to tag buildings.',
        example_taunts: [
          "Your technique is messier than mine!",
          "This wall needs my artistic touch!",
          "You can't stop street art!"
        ],
        personality_traits: ['mischievous', 'artistic', 'rebellious'],
        combat_style: 'hit-and-run'
      },
      '4637f636-0b6a-4825-b1aa-492cf8d9d1bb': {
        id: '4637f636-0b6a-4825-b1aa-492cf8d9d1bb',
        name: 'Goopy Floating Eye',
        base_dialogue_prompt: 'You are an unsettling floating eyeball that observes everything.',
        example_taunts: [
          "I see your weaknesses...",
          "*stares unblinkingly*",
          "Nothing escapes my gaze!"
        ],
        personality_traits: ['observant', 'creepy', 'mysterious'],
        combat_style: 'ranged-harassment'
      },
      '63d218fc-5cd9-4404-9090-fb72537da205': {
        id: '63d218fc-5cd9-4404-9090-fb72537da205',
        name: 'Feral Unicorn',
        base_dialogue_prompt: 'You are a once-majestic unicorn corrupted by urban pollution.',
        example_taunts: [
          "My horn shall pierce your lies!",
          "Magic is dead in this concrete jungle!",
          "*angry magical horse noises*"
        ],
        personality_traits: ['corrupted', 'majestic', 'angry'],
        combat_style: 'charging-attacks'
      },
      '19cd32dc-e874-4836-a3e9-851431262cc8': {
        id: '19cd32dc-e874-4836-a3e9-851431262cc8',
        name: 'Bipedal Deer',
        base_dialogue_prompt: 'You are a deer that learned to walk upright and became aggressive.',
        example_taunts: [
          "Evolution chose violence!",
          "*stomps aggressively on hind legs*",
          "The forest remembers your kind!"
        ],
        personality_traits: ['evolved', 'aggressive', 'prideful'],
        combat_style: 'aggressive-melee'
      },
      'beb6ea68-597a-4052-92f6-ad73d0fd02b3': {
        id: 'beb6ea68-597a-4052-92f6-ad73d0fd02b3',
        name: 'Politician',
        base_dialogue_prompt: 'You are a cunning politician who uses words as weapons.',
        example_taunts: [
          "I promise to defeat you!",
          "This meeting could have been an email!",
          "Let me redirect that question..."
        ],
        personality_traits: ['cunning', 'verbose', 'manipulative'],
        combat_style: 'bureaucratic-warfare'
      }
    };

    const enemyType = enemyTypes[session.enemy_type_id];
    if (!enemyType) {
      throw new DatabaseError(`Unknown enemy type: ${session.enemy_type_id}`);
    }

    return enemyType;
  }

  /**
   * Get player combat history for context
   */
  private async getPlayerCombatHistory(playerId: string, locationId: string): Promise<PlayerCombatContext> {
    const { data, error } = await supabase
      .from('playercombathistory')
      .select('*')
      .eq('user_id', playerId)
      .eq('location_id', locationId)
      .single();

    if (error || !data) {
      // Return default context for new players
      return {
        attempts: 0,
        victories: 0,
        defeats: 0,
        current_streak: 0,
      };
    }

    return {
      attempts: data.attempts || 0,
      victories: data.victories || 0,
      defeats: data.defeats || 0,
      current_streak: data.current_streak || 0,
    };
  }

  /**
   * Log dialogue attempt to database
   */
  private async logDialogueAttempt(
    sessionId: string,
    eventType: CombatEventType,
    response: DialogueResponse | null,
    errorMessage: string | null
  ): Promise<void> {
    try {
      const logEntry = {
        session_id: sessionId,
        event_type: eventType,
        dialogue_generated: response?.dialogue || null,
        dialogue_tone: response?.dialogue_tone || null,
        generation_time_ms: response?.generation_time_ms || 0,
        was_ai_generated: response?.was_ai_generated || false,
        player_context_used: response?.player_context_used || null,
        error_message: errorMessage,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('enemychatterlog')
        .insert([logEntry]);

      if (error) {
        console.error('Failed to log dialogue attempt:', error);
        // Don't throw here - logging failure shouldn't break dialogue generation
      }
    } catch (error) {
      console.error('Failed to log dialogue attempt:', error);
      // Don't throw here - logging failure shouldn't break dialogue generation
    }
  }
}

export const enemyChatterService = new EnemyChatterService();