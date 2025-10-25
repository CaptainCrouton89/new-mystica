import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { ChatterLogEntry, CombatRepository } from '../repositories/CombatRepository.js';
import type {
  CombatEventDetails,
  CombatEventType,
  DialogueResponse,
  PlayerCombatContext
} from '../types/api.types.js';
import { DatabaseError, ExternalAPIError } from '../utils/errors';

const aiDialogueSchema = z.object({
  dialogue: z.string().describe('A single line of dialogue appropriate for the combat event'),
  dialogue_tone: z.string().describe('The emotional tone of the dialogue (aggressive, mocking, desperate, etc.)'),
});

interface EnemyType {
  id: string;
  name: string;
  dialogue_guidelines: string;
  personality_traits: string[];
  combat_style: string;
}

export class EnemyChatterService {
  private readonly AI_TIMEOUT_MS = 2000; 
  private readonly combatRepository: CombatRepository;

  constructor() {
    this.combatRepository = new CombatRepository();
  }

  async generateDialogue(
    sessionId: string,
    eventType: CombatEventType,
    eventDetails: CombatEventDetails,
    playerContext?: PlayerCombatContext
  ): Promise<DialogueResponse> {
    const startTime = Date.now();

    try {
      
      const [sessionData, enemyTypeData] = await Promise.all([
        this.getCombatSession(sessionId),
        this.getEnemyTypeFromSession(sessionId),
      ]);

      const finalPlayerContext = playerContext || await this.getPlayerCombatHistory(
        sessionData.player_id,
        sessionData.location_id
      );

      let dialogue: string;
      let dialogueTone: string;
      let wasAIGenerated = false;

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

      await this.logDialogueAttempt(
        sessionId,
        eventType,
        response,
        wasAIGenerated ? null : 'AI_TIMEOUT_FALLBACK'
      );

      return response;
    } catch (error) {
      const generationTimeMs = Date.now() - startTime;

      await this.logDialogueAttempt(
        sessionId,
        eventType,
        null,
        error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      );

      throw error;
    }
  }

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

  private buildAIPrompt(
    enemyType: EnemyType,
    eventType: CombatEventType,
    eventDetails: CombatEventDetails,
    playerContext: PlayerCombatContext
  ): { system: string; user: string } {
    const personalityTraits = enemyType.personality_traits.join(', ');

    const system = `You are a ${enemyType.name} with these personality traits: ${personalityTraits}.
Your combat style is: ${enemyType.combat_style}.

Dialogue Guidelines:
${enemyType.dialogue_guidelines}

Generate a single line of dialogue appropriate for the current combat situation. The dialogue should:
- Reflect your personality and combat style
- Be contextually appropriate for the event type
- Use 10 words or less
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

  private formatEventContext(eventType: CombatEventType, eventDetails: CombatEventDetails): string {
    const { damage, accuracy, is_critical, turn_number, player_hp_pct, enemy_hp_pct } = eventDetails;
    const playerHpPercent = Math.round((player_hp_pct ?? 0) * 100);
    const enemyHpPercent = Math.round((enemy_hp_pct ?? 0) * 100);

    switch (eventType) {
      case 'combat_start':
        return `Turn ${turn_number}: Combat begins. Player HP: ${playerHpPercent}%, Enemy HP: ${enemyHpPercent}%`;

      case 'player_hit':
        return `Turn ${turn_number}: Player hit enemy for ${damage} damage${is_critical ? ' (CRITICAL!)' : ''}. Player HP: ${playerHpPercent}%, Enemy HP: ${enemyHpPercent}%`;

      case 'player_miss':
        return `Turn ${turn_number}: Player missed their attack. Player HP: ${playerHpPercent}%, Enemy HP: ${enemyHpPercent}%`;

      case 'enemy_hit':
        return `Turn ${turn_number}: Enemy hit player for ${damage} damage${is_critical ? ' (CRITICAL!)' : ''}. Player HP: ${playerHpPercent}%, Enemy HP: ${enemyHpPercent}%`;

      case 'low_player_hp':
        return `Turn ${turn_number}: Player health is critically low (${playerHpPercent}%). Enemy HP: ${enemyHpPercent}%`;

      case 'near_victory':
        return `Turn ${turn_number}: Enemy health is critically low (${enemyHpPercent}%). Player HP: ${playerHpPercent}%`;

      case 'defeat':
        return `Turn ${turn_number}: Player has been defeated. Final Enemy HP: ${enemyHpPercent}%`;

      case 'victory':
        return `Turn ${turn_number}: Enemy has been defeated. Final Player HP: ${playerHpPercent}%`;

      default:
        return `Turn ${turn_number}: ${eventType}. Player HP: ${playerHpPercent}%, Enemy HP: ${enemyHpPercent}%`;
    }
  }

  private formatPlayerContext(playerContext: PlayerCombatContext): string {
    const { attempts, victories, defeats, current_streak } = playerContext;
    const winRate = attempts > 0 ? Math.round((victories / attempts) * 100) : 0;

    return `- Total battles: ${attempts}
- Victories: ${victories}
- Defeats: ${defeats}
- Win rate: ${winRate}%
- Current streak: ${current_streak} ${current_streak >= 0 ? 'wins' : 'losses'}`;
  }

  private selectFallbackTaunt(enemyType: EnemyType, eventType: CombatEventType): string {
    return this.getGenericTaunt(eventType);
  }

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

    const taunt = genericTaunts[eventType];
    if (!taunt) {
      throw new Error(`No generic taunt available for event type: ${eventType}`);
    }
    return taunt;
  }

  private async getCombatSession(sessionId: string) {
    const { combatService } = await import('./CombatService.js');
    return combatService.getCombatSession(sessionId);
  }

  private async getEnemyTypeFromSession(sessionId: string): Promise<EnemyType> {
    
    const session = await this.getCombatSession(sessionId);

    const enemyTypes: Record<string, EnemyType> = {
      'd9e715fb-5de0-4639-96f8-3b4f03476314': {
        id: 'd9e715fb-5de0-4639-96f8-3b4f03476314',
        name: 'Spray Paint Goblin',
        dialogue_guidelines: 'You are a mischievous urban creature that loves to tag buildings.',
        personality_traits: ['mischievous', 'artistic', 'rebellious'],
        combat_style: 'hit-and-run'
      },
      '4637f636-0b6a-4825-b1aa-492cf8d9d1bb': {
        id: '4637f636-0b6a-4825-b1aa-492cf8d9d1bb',
        name: 'Goopy Floating Eye',
        dialogue_guidelines: 'You are an unsettling floating eyeball that observes everything.',
        personality_traits: ['observant', 'creepy', 'mysterious'],
        combat_style: 'ranged-harassment'
      },
      '63d218fc-5cd9-4404-9090-fb72537da205': {
        id: '63d218fc-5cd9-4404-9090-fb72537da205',
        name: 'Feral Unicorn',
        dialogue_guidelines: 'You are a once-majestic unicorn corrupted by urban pollution.',
        personality_traits: ['corrupted', 'majestic', 'angry'],
        combat_style: 'charging-attacks'
      },
      '19cd32dc-e874-4836-a3e9-851431262cc8': {
        id: '19cd32dc-e874-4836-a3e9-851431262cc8',
        name: 'Bipedal Deer',
        dialogue_guidelines: 'You are a deer that learned to walk upright and became aggressive.',
        personality_traits: ['evolved', 'aggressive', 'prideful'],
        combat_style: 'aggressive-melee'
      },
      'beb6ea68-597a-4052-92f6-ad73d0fd02b3': {
        id: 'beb6ea68-597a-4052-92f6-ad73d0fd02b3',
        name: 'Politician',
        dialogue_guidelines: 'You are a cunning politician who uses words as weapons.',
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

  private async getPlayerCombatHistory(playerId: string, locationId: string): Promise<PlayerCombatContext> {
    return this.combatRepository.getPlayerCombatContext(playerId, locationId);
  }

  private async logDialogueAttempt(
    sessionId: string,
    eventType: CombatEventType,
    response: DialogueResponse | null,
    errorMessage: string | null
  ): Promise<void> {
    try {
      
      const session = await this.getCombatSession(sessionId);

      const logEntry: ChatterLogEntry = {
        sessionId: sessionId,
        enemyTypeId: session.enemy_type_id,
        eventType: eventType,
        generatedDialogue: response?.dialogue || undefined,
        dialogueTone: response?.dialogue_tone || undefined,
        generationTimeMs: response?.generation_time_ms || 0,
        wasAiGenerated: response?.was_ai_generated || false,
        playerMetadata: response?.player_context_used ? response.player_context_used as any : undefined,
        combatContext: errorMessage ? { error: errorMessage } as any : undefined,
      };

      await this.combatRepository.logChatterAttempt(logEntry);
    } catch (error) {
      console.error('Failed to log dialogue attempt:', error);
      
    }
  }
}

export const enemyChatterService = new EnemyChatterService();