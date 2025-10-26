import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { AnalyticsRepository } from '../repositories/AnalyticsRepository.js';
import { CombatRepository } from '../repositories/CombatRepository.js';
import { EnemyRepository } from '../repositories/EnemyRepository.js';
import {
  ChatterMetadata,
  CombatEventDetails,
  EnemyChatterEventType,
  EnemyChatterResponse,
  EnemyType,
  PlayerCombatHistory
} from '../types/api.types.js';
import {
  EnemyTypeNotFoundError,
  ExternalAPIError,
  SessionNotFoundError,
  ValidationError
} from '../utils/errors.js';

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
export class ChatterService {
  private readonly AI_TIMEOUT_MS = 2000; 
  private combatRepository: CombatRepository;
  private enemyRepository: EnemyRepository;
  private analyticsRepository: AnalyticsRepository;

  constructor() {
    this.combatRepository = new CombatRepository();
    this.enemyRepository = new EnemyRepository();
    this.analyticsRepository = new AnalyticsRepository();
  }

  async generateEnemyChatter(
    sessionId: string,
    eventType: EnemyChatterEventType,
    eventDetails: CombatEventDetails
  ): Promise<EnemyChatterResponse> {
    console.log('[CHATTER_SERVICE] Starting enemy chatter generation', {
      sessionId,
      eventType,
      turnNumber: eventDetails.turn_number,
      playerHpPct: eventDetails.player_hp_pct,
      enemyHpPct: eventDetails.enemy_hp_pct
    });

    const session = await this.combatRepository.getActiveSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(`Combat session ${sessionId} not found or expired`);
    }

    const enemyType = await this.enemyRepository.findEnemyTypeById(session.enemyTypeId);
    if (!enemyType) {
      throw new EnemyTypeNotFoundError(`Enemy type ${session.enemyTypeId} not found`);
    }

    console.log('[CHATTER_SERVICE] Found enemy type', {
      sessionId,
      dialogueTone: enemyType.dialogue_tone
    });

    const playerHistory = await this.combatRepository.getPlayerHistory(session.userId, session.locationId);

    const playerContext: PlayerCombatHistory = {
      attempts: playerHistory?.totalAttempts ?? 0,
      victories: playerHistory?.victories ?? 0,
      defeats: playerHistory?.defeats ?? 0,
      current_streak: playerHistory?.currentStreak ?? 0
    };

    console.log('[CHATTER_SERVICE] Player combat history', {
      sessionId,
      attempts: playerContext.attempts,
      victories: playerContext.victories,
      defeats: playerContext.defeats,
      currentStreak: playerContext.current_streak
    });

    const combatContext: CombatContext = {
      turnNumber: eventDetails.turn_number,
      playerHpPct: eventDetails.player_hp_pct,
      enemyHpPct: eventDetails.enemy_hp_pct,
      eventType,
      damage: eventDetails.damage,
      isCritical: eventDetails.is_critical
    };

    const prompt = await this.buildEnemyPrompt(enemyType.dialogue_tone!, playerContext, combatContext, eventDetails);

    console.log('[CHATTER_SERVICE] Built AI prompt', {
      sessionId,
      promptLength: prompt.length
    });

    let dialogue: string;
    let wasAIGenerated = true;
    const startTime = Date.now();

    try {
      dialogue = await this.callAIService(prompt, this.AI_TIMEOUT_MS);
      console.log('[CHATTER_SERVICE] AI generation succeeded', {
        sessionId,
        dialogue,
        generationTime: Date.now() - startTime
      });
    } catch (error) {
      console.error('[CHATTER_SERVICE] AI generation failed', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        generationTime: Date.now() - startTime
      });
      
      throw error;
    }

    const generationTime = Date.now() - startTime;

    await this.logChatterEvent(sessionId, dialogue, {
      eventType,
      enemyType: enemyType.name ?? '',
      dialogueTone: enemyType.dialogue_tone ?? '',
      wasAIGenerated,
      generationTime,
      playerContextUsed: playerContext,
      fallbackReason: !wasAIGenerated ? 'ai_timeout' : undefined
    });

    console.log('[CHATTER_SERVICE] Returning enemy chatter response', {
      sessionId,
      dialogueLength: dialogue.length,
      generationTime,
      wasAIGenerated
    });

    return {
      dialogue,
      personality_type: '', 
      enemy_type: enemyType.name ?? '',
      dialogue_tone: enemyType.dialogue_tone ?? '',
      generation_time_ms: generationTime,
      was_ai_generated: wasAIGenerated,
      player_context_used: playerContext
    };
  }

  async getEnemyTypes(): Promise<EnemyType[]> {
    const enemyTypes = await this.enemyRepository.findAllEnemyTypes();

    return enemyTypes.map(e => {
      if (!e.name) {
        throw new ValidationError('Enemy type missing required name field');
      }
      return {
        type: e.name,
        display_name: e.name,
        personality_traits: e.ai_personality_traits ? Object.keys(e.ai_personality_traits) : [],
        dialogue_tone: 'aggressive' as const, 
        tier_id: e.tier_id ?? 1
        
      };
    });
  }

  private async buildPetPrompt(
    personality: {
      personality_type: string;
      traits?: string[];
      verbosity: 'terse' | 'moderate' | 'verbose';
    },
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

  private async buildEnemyPrompt(
    dialogueTone: string,
    playerHistory: PlayerCombatHistory,
    context: CombatContext,
    event: CombatEventDetails
  ): Promise<string> {
    const winRate = playerHistory.attempts > 0 ? Math.round((playerHistory.victories / playerHistory.attempts) * 100) : 0;
    const streakType = playerHistory.current_streak >= 0 ? 'wins' : 'losses';

    return `You are an enemy with ${dialogueTone} personality in a fantasy combat game.

Player History at this location:
- Attempts: ${playerHistory.attempts}, Victories: ${playerHistory.victories}, Defeats: ${playerHistory.defeats}
- Current streak: ${Math.abs(playerHistory.current_streak)} ${streakType}
- Win rate: ${winRate}%

Combat Context:
- Turn ${context.turnNumber}, Player HP: ${Math.round(context.playerHpPct * 100)}%, Your HP: ${Math.round(context.enemyHpPct * 100)}%
- Event: ${context.eventType}
- ${this.formatEventContext(context)}

Generate a single, short taunt (1-2 sentences) that:
1. Matches your ${dialogueTone} personality
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

  private formatEventContext(context: CombatContext): string {
    if (context.damage && context.isCritical) {
      return `${context.damage} damage dealt (CRITICAL HIT!)`;
    } else if (context.damage) {
      return `${context.damage} damage dealt`;
    } else {
      return 'No damage dealt';
    }
  }

  private async callAIService(prompt: string, timeout: number): Promise<string> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI service timeout')), timeout);
      });

      const aiPromise = generateText({
        model: openai('gpt-4.1-nano'),
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

  private async getRandomFallbackPhrase(phrases: string[]): Promise<string> {
    if (!phrases || phrases.length === 0) {
      return "...";
    }

    const randomIndex = Math.floor(Math.random() * phrases.length);
    return phrases[randomIndex];
  }

  private async logChatterEvent(
    sessionId: string,
    dialogue: string,
    metadata: ChatterMetadata
  ): Promise<void> {
    try {
      if (metadata.personalityType) {
        await this.analyticsRepository.logPetChatter(
          sessionId,
          '',
          metadata.eventType,
          dialogue,
          metadata.generationTime,
          metadata.wasAIGenerated
        );
      } else if (metadata.enemyType) {
        await this.analyticsRepository.logEnemyChatter(
          sessionId,
          '',
          metadata.eventType,
          dialogue,
          metadata.playerContextUsed!,
          metadata.generationTime,
          metadata.wasAIGenerated
        );
      }
    } catch (error) {
      console.error('Failed to log chatter event:', error);
    }
  }
}

export const createChatterService = () => new ChatterService();

export const chatterService = createChatterService();