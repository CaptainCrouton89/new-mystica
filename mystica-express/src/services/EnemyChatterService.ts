import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { ChatterLogEntry, CombatRepository } from '../repositories/CombatRepository.js';
import { EnemyRepository } from '../repositories/EnemyRepository.js';
import type {
  CombatEventDetails,
  CombatEventType,
  DialogueResponse,
  PlayerCombatContext
} from '../types/api.types.js';
import { Database } from '../types/database.types.js';
import { DatabaseError, ExternalAPIError, NotFoundError } from '../utils/errors';

const aiDialogueSchema = z.object({
  dialogue: z.string().describe('A single line of dialogue appropriate for the combat event'),
  dialogue_tone: z.string().describe('The emotional tone of the dialogue (aggressive, mocking, desperate, etc.)'),
});

// Type alias for enemy type from database
type EnemyType = Database['public']['Tables']['enemytypes']['Row'];

// Personality traits shape for AI dialogue generation
interface PersonalityTraits {
  aggression?: number;
  intelligence?: number;
  cunning?: number;
  hostility?: number;
  [key: string]: number | undefined;
}

export class EnemyChatterService {
  private readonly AI_TIMEOUT_MS = 2000;
  private readonly combatRepository: CombatRepository;
  private readonly enemyRepository: EnemyRepository;

  constructor(
    combatRepository: CombatRepository = new CombatRepository(),
    enemyRepository: EnemyRepository = new EnemyRepository()
  ) {
    this.combatRepository = combatRepository;
    this.enemyRepository = enemyRepository;
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

        dialogue = this.selectFallbackTaunt(enemyTypeData, eventType, eventDetails);
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
    // Extract personality traits from database JSON field
    const personalityDescription = this.formatPersonalityTraits(enemyType.ai_personality_traits);

    // Dialogue guidelines are required for prompt generation
    if (!enemyType.dialogue_guidelines) {
      throw new DatabaseError(`Enemy type ${enemyType.id} missing required dialogue_guidelines field`);
    }

    let systemContext = `You are a ${enemyType.name} in combat.

Personality Traits:
${personalityDescription}

Dialogue Guidelines:
${enemyType.dialogue_guidelines}

Generate a single line of dialogue appropriate for the current combat situation. The dialogue should:
- Reflect your personality and combat situation
- Be contextually appropriate for the event type
- Use 10 words or less
- Show awareness of the combat situation (HP levels, turn progression, zones hit, etc.)
`;

    if (eventType === 'player_hit') {
      // Player attacked and hit us
      systemContext += `
SCENARIO: PLAYER ATTACKED YOU
The player just launched an attack that hit you! Respond to being hit by their attack.

ZONE RESPONSE GUIDANCE:
- Player zone 1-2 (green): They landed a good/excellent strike! You should be worried, concerned, or show respect.
- Player zone 3 (yellow): Neutral attack. Standard defensive banter.
- Player zone 4 (orange): Poor attack that barely connected. Mock their weakness.
- Player zone 5 (red): They hurt THEMSELVES attacking you! Maximum mockery - "Did you just hurt yourself?"`;
    } else if (eventType === 'enemy_hit') {
      // Enemy's automatic attack during player's defense turn
      systemContext += `
SCENARIO: YOUR TURN - YOU ATTACK
It's your turn to attack while the player defends. Their defense zone determines damage mitigation.

THEIR DEFENSE ZONE GUIDANCE (determines damage mitigation):
- Player zone 1-2 (green): Excellent defense! Show respect while remaining confident.
- Player zone 3 (yellow): Neutral defense. Standard aggressive taunt.
- Player zone 4 (orange): Weak defense! Mock their poor defensive effort.
- Player zone 5 (red): Terrible defense - they injured themselves! Brutal mockery.

YOUR ATTACK ZONE GUIDANCE (your attack power):
- Your zone 1-2 (green): Powerful attack! Be very confident.
- Your zone 3 (yellow): Standard attack. Neutral aggression.
- Your zone 4 (orange): Weak attack. Less confident.`;
    }

    systemContext += `

Consider the player's combat history when crafting your response - if they're experienced, you might be more respectful or challenging. If they're new, you might be more mocking or confident.`;

    const system = systemContext;

    const eventContext = this.formatEventContext(eventType, eventDetails);
    const playerContextText = this.formatPlayerContext(playerContext);

    const user = `Combat Event: ${eventType}
${eventContext}

Player Combat History:
${playerContextText}

Generate appropriate dialogue for this situation.`;

    return { system, user };
  }

  private formatPersonalityTraits(traits: unknown): string {
    // Personality traits must be defined and be an object
    if (!traits || typeof traits !== 'object') {
      throw new DatabaseError('Enemy type missing required ai_personality_traits field');
    }

    const personalityTraits = traits as PersonalityTraits;
    const traitList = Object.entries(personalityTraits)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    // At least some traits must be present
    if (!traitList) {
      throw new DatabaseError('Enemy type ai_personality_traits is empty');
    }

    return traitList;
  }

  private formatEventContext(eventType: CombatEventType, eventDetails: CombatEventDetails): string {
    const { damage, is_critical, turn_number, player_hp_pct, enemy_hp_pct, player_zone, enemy_zone } = eventDetails;
    const playerHpPercent = Math.round((player_hp_pct ?? 0) * 100);
    const enemyHpPercent = Math.round((enemy_hp_pct ?? 0) * 100);

    // Zone descriptions for narrative context
    const zoneNames = {
      1: 'perfect green zone (best)',
      2: 'good green zone',
      3: 'neutral yellow zone',
      4: 'poor orange zone',
      5: 'disastrous red zone (self-injury)'
    };

    const playerZoneText = player_zone ? ` hitting ${zoneNames[player_zone]}` : '';
    const enemyZoneText = enemy_zone ? ` with ${zoneNames[enemy_zone]}` : '';

    switch (eventType) {
      case 'combat_start':
        return `Turn ${turn_number}: Combat begins. Player HP: ${playerHpPercent}%, Enemy HP: ${enemyHpPercent}%`;

      case 'player_hit':
        if (player_zone === 5) {
          return `Turn ${turn_number}: Player ATTACKED and hit RED ZONE - they injured themselves for ${damage} damage! The enemy is unscathed. This is the ultimate humiliation${playerZoneText}. Player HP: ${playerHpPercent}%, Enemy HP: ${enemyHpPercent}%`;
        } else if (player_zone === 1 || player_zone === 2) {
          return `Turn ${turn_number}: Player hit enemy for ${damage} damage${is_critical ? ' (CRITICAL!)' : ''}. Player hit ${zoneNames[player_zone || 3]} - they're doing very well. Enemy should be concerned. Player HP: ${playerHpPercent}%, Enemy HP: ${enemyHpPercent}%`;
        } else {
          return `Turn ${turn_number}: Player hit enemy for ${damage} damage${is_critical ? ' (CRITICAL!)' : ''}${playerZoneText}. Player HP: ${playerHpPercent}%, Enemy HP: ${enemyHpPercent}%`;
        }

      case 'player_miss':
        return `Turn ${turn_number}: Player missed their attack completely${playerZoneText}. Player HP: ${playerHpPercent}%, Enemy HP: ${enemyHpPercent}%`;

      case 'enemy_hit':
        // Enemy attacks during defense phase - use both player's defense zone and enemy's attack zone
        if (player_zone === 5) {
          return `Turn ${turn_number}: Player tried to DEFEND but hit RED ZONE - catastrophic defense failure! Enemy struck${enemyZoneText} for ${damage} damage. Player HP: ${playerHpPercent}%, Enemy HP: ${enemyHpPercent}%`;
        } else if (player_zone === 1 || player_zone === 2) {
          return `Turn ${turn_number}: Player defended well (${zoneNames[player_zone || 3]}), but enemy still managed to strike${enemyZoneText} for ${damage} damage. Player HP: ${playerHpPercent}%, Enemy HP: ${enemyHpPercent}%`;
        } else {
          return `Turn ${turn_number}: Player tried to defend${playerZoneText}, but enemy struck${enemyZoneText} for ${damage} damage${is_critical ? ' (CRITICAL!)' : ''}. Player HP: ${playerHpPercent}%, Enemy HP: ${enemyHpPercent}%`;
        }

      case 'low_player_hp':
        return `Turn ${turn_number}: Player health is critically low (${playerHpPercent}%). Enemy HP: ${enemyHpPercent}%. Victory is near!`;

      case 'near_victory':
        return `Turn ${turn_number}: Enemy health is critically low (${enemyHpPercent}%). Player HP: ${playerHpPercent}%. The player is winning!`;

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

  private selectFallbackTaunt(enemyType: EnemyType, eventType: CombatEventType, eventDetails?: CombatEventDetails): string {
    return this.getGenericTaunt(eventType, eventDetails);
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

  private getGenericTaunt(eventType: CombatEventType, eventDetails?: CombatEventDetails): string {
    // Zone 5 self-injury gets special taunts
    if (eventDetails?.player_zone === 5) {
      const zone5Taunts = [
        "Did you just hurt yourself? Hilarious!",
        "You're your own worst enemy!",
        "Keep it up, you're doing my job for me!",
        "That's embarrassing...",
        "Maybe try NOT hitting yourself?"
      ];
      return zone5Taunts[Math.floor(Math.random() * zone5Taunts.length)];
    }

    // Green zone (1-2) - player doing well, enemy concerned
    if (eventDetails?.player_zone && eventDetails.player_zone <= 2) {
      if (eventType === 'player_hit') {
        return "You're getting lucky...";
      } else if (eventType === 'enemy_hit') {
        // Enemy's attack against strong defense
        return "This changes nothing!";
      }
    }

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

    // Fetch enemy type from database instead of hardcoded list
    const enemyType = await this.enemyRepository.findEnemyTypeById(session.enemy_type_id);

    if (!enemyType) {
      throw new NotFoundError('enemy_type', session.enemy_type_id);
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