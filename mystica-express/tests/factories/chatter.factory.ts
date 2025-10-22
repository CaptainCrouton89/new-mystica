// Simple UUID generator for tests (avoids ESM import issues)
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Factory for generating ChatterService test data
 *
 * Creates test data for pet personalities, enemy types, combat events,
 * and chatter responses for testing the ChatterService.
 */

export interface PetPersonality {
  personality_type: string;
  display_name: string;
  description: string;
  traits: string[];
  example_phrases: string[];
  verbosity: 'terse' | 'moderate' | 'verbose';
}

export interface EnemyType {
  id: string;
  type: string;
  name: string;
  display_name: string;
  personality_traits: string[];
  dialogue_tone: 'aggressive' | 'sarcastic' | 'condescending' | 'chaotic' | 'political';
  example_taunts: string[];
  verbosity: 'terse' | 'moderate' | 'verbose';
  tier_id: number;
  style_id: string;
}

export interface EquippedPet {
  id: string;
  user_id: string;
  name: string;
  personality_type: string;
  custom_name?: string;
  equipped: boolean;
}

export interface CombatEventDetails {
  damage?: number;
  accuracy?: number;
  is_critical?: boolean;
  turn_number: number;
  player_hp_pct: number;
  enemy_hp_pct: number;
}

export interface PlayerCombatHistory {
  user_id: string;
  location_id: string;
  attempts: number;
  victories: number;
  defeats: number;
  current_streak: number;
  longest_streak: number;
  last_attempt: string;
}

export interface ChatterResponse {
  dialogue: string;
  personality_type: string;
  generation_time_ms: number;
  was_ai_generated: boolean;
}

export interface EnemyChatterResponse extends ChatterResponse {
  enemy_type: string;
  dialogue_tone: string;
  player_context_used: {
    attempts: number;
    victories: number;
    defeats: number;
    current_streak: number;
  };
}

export type PetChatterEventType =
  | 'player_attack'
  | 'player_defense'
  | 'enemy_attack'
  | 'enemy_defense'
  | 'critical_hit'
  | 'miss'
  | 'victory'
  | 'defeat';

export type EnemyChatterEventType =
  | 'combat_start'
  | 'player_hit'
  | 'player_miss'
  | 'enemy_hit'
  | 'low_player_hp'
  | 'near_victory'
  | 'defeat'
  | 'victory';

/**
 * Factory for generating ChatterService test data
 */
export class ChatterFactory {
  /**
   * Create a pet personality template
   */
  static createPetPersonality(
    type: string = 'sassy',
    overrides?: Partial<PetPersonality>
  ): PetPersonality {
    const personalities = {
      sassy: {
        display_name: 'Sassy',
        description: 'Witty and confident with a sharp tongue',
        traits: ['witty', 'confident', 'sarcastic'],
        example_phrases: [
          'Oh please, I could do better blindfolded!',
          'Are we fighting or dancing? Make up your mind!',
          'That\'s what you call an attack? Adorable.'
        ],
        verbosity: 'moderate' as const
      },
      encouraging: {
        display_name: 'Encouraging',
        description: 'Supportive and optimistic companion',
        traits: ['supportive', 'optimistic', 'motivational'],
        example_phrases: [
          'You\'ve got this! Keep fighting!',
          'Great hit! Show them what you\'re made of!',
          'Don\'t give up, I believe in you!'
        ],
        verbosity: 'moderate' as const
      },
      analytical: {
        display_name: 'Analytical',
        description: 'Logical and data-focused strategist',
        traits: ['logical', 'strategic', 'observant'],
        example_phrases: [
          'Enemy defense decreased by 15%. Optimal strike zone identified.',
          'Statistical probability of victory: 73.2%',
          'Recommend targeting weak point at 45-degree angle.'
        ],
        verbosity: 'verbose' as const
      },
      chaotic: {
        display_name: 'Chaotic',
        description: 'Unpredictable and energetic wildcard',
        traits: ['unpredictable', 'energetic', 'random'],
        example_phrases: [
          'BANANA TORNADO STRIKE!',
          'Did you see that squirrel? Wait, we\'re fighting!',
          'Purple monkey dishwasher! ...What? It felt right.'
        ],
        verbosity: 'terse' as const
      },
      stoic: {
        display_name: 'Stoic',
        description: 'Calm and philosophical observer',
        traits: ['calm', 'philosophical', 'reserved'],
        example_phrases: [
          'All battles end in time.',
          'Victory and defeat are but sides of the same coin.',
          'Focus your mind. The body will follow.'
        ],
        verbosity: 'terse' as const
      },
      trash_talker: {
        display_name: 'Trash Talker',
        description: 'Competitive and provocative companion',
        traits: ['competitive', 'provocative', 'boastful'],
        example_phrases: [
          'Is that all you\'ve got? My grandmother hits harder!',
          'Call that a fight? I\'ve seen scarecrows with more skill!',
          'You\'re about to get schooled by the BEST!'
        ],
        verbosity: 'moderate' as const
      }
    };

    const basePersonality = personalities[type as keyof typeof personalities] || personalities.sassy;

    return {
      personality_type: type,
      ...basePersonality,
      ...overrides
    };
  }

  /**
   * Create an equipped pet
   */
  static createEquippedPet(
    userId: string,
    personalityType: string = 'sassy',
    overrides?: Partial<EquippedPet>
  ): EquippedPet {
    return {
      id: generateUuid(),
      user_id: userId,
      name: 'Test Pet',
      personality_type: personalityType,
      equipped: true,
      ...overrides
    };
  }

  /**
   * Create an enemy type
   */
  static createEnemyType(
    type: string = 'goblin',
    overrides?: Partial<EnemyType>
  ): EnemyType {
    const enemyTypes = {
      goblin: {
        display_name: 'Goblin',
        personality_traits: ['mischievous', 'cowardly', 'cunning'],
        dialogue_tone: 'sarcastic' as const,
        example_taunts: [
          'Heh heh, you think you can beat me?',
          'I\'ve stolen from better warriors than you!',
          'My precious shinies will be mine!'
        ],
        verbosity: 'moderate' as const,
        tier_id: 1,
        style_id: 'normal'
      },
      orc: {
        display_name: 'Orc',
        personality_traits: ['brutal', 'aggressive', 'simple'],
        dialogue_tone: 'aggressive' as const,
        example_taunts: [
          'GRAAAH! Me crush you!',
          'You weak! Me strong!',
          'Blood and bones! Fight me!'
        ],
        verbosity: 'terse' as const,
        tier_id: 2,
        style_id: 'normal'
      },
      dragon: {
        display_name: 'Ancient Dragon',
        personality_traits: ['arrogant', 'intelligent', 'ancient'],
        dialogue_tone: 'condescending' as const,
        example_taunts: [
          'Mortals... always so eager to throw away their lives.',
          'I have seen empires rise and fall. You are nothing.',
          'Your bravery is admirable, your chances are not.'
        ],
        verbosity: 'verbose' as const,
        tier_id: 5,
        style_id: 'legendary'
      },
      wizard: {
        display_name: 'Chaos Wizard',
        personality_traits: ['eccentric', 'unpredictable', 'magical'],
        dialogue_tone: 'chaotic' as const,
        example_taunts: [
          'Reality is optional! Let me show you!',
          'Purple! No, green! What were we talking about?',
          'Time flows backwards on Tuesdays!'
        ],
        verbosity: 'moderate' as const,
        tier_id: 3,
        style_id: 'magical'
      },
      politician: {
        display_name: 'Corrupt Politician',
        personality_traits: ['manipulative', 'verbose', 'deceitful'],
        dialogue_tone: 'political' as const,
        example_taunts: [
          'My policies will defeat you more thoroughly than my sword!',
          'I promise you a swift defeat - and I keep my promises!',
          'Vote for violence! It\'s what the people want!'
        ],
        verbosity: 'verbose' as const,
        tier_id: 4,
        style_id: 'political'
      }
    };

    const baseEnemyType = enemyTypes[type as keyof typeof enemyTypes] || enemyTypes.goblin;

    return {
      id: generateUuid(),
      type,
      name: type, // Add name field that service expects
      ...baseEnemyType,
      ...overrides
    };
  }

  /**
   * Create combat event details
   */
  static createCombatEventDetails(
    eventType: PetChatterEventType | EnemyChatterEventType,
    overrides?: Partial<CombatEventDetails>
  ): CombatEventDetails {
    const baseEvents = {
      player_attack: {
        damage: 25,
        accuracy: 85,
        is_critical: false,
        turn_number: 3,
        player_hp_pct: 80,
        enemy_hp_pct: 65
      },
      critical_hit: {
        damage: 50,
        accuracy: 85,
        is_critical: true,
        turn_number: 5,
        player_hp_pct: 70,
        enemy_hp_pct: 40
      },
      miss: {
        damage: 0,
        accuracy: 30,
        is_critical: false,
        turn_number: 2,
        player_hp_pct: 90,
        enemy_hp_pct: 85
      },
      victory: {
        damage: 30,
        accuracy: 90,
        is_critical: false,
        turn_number: 8,
        player_hp_pct: 45,
        enemy_hp_pct: 0
      },
      defeat: {
        damage: 40,
        accuracy: 75,
        is_critical: false,
        turn_number: 12,
        player_hp_pct: 0,
        enemy_hp_pct: 15
      },
      low_player_hp: {
        damage: 35,
        accuracy: 80,
        is_critical: false,
        turn_number: 10,
        player_hp_pct: 20,
        enemy_hp_pct: 30
      },
      near_victory: {
        damage: 15,
        accuracy: 70,
        is_critical: false,
        turn_number: 7,
        player_hp_pct: 60,
        enemy_hp_pct: 10
      }
    };

    const baseEvent = baseEvents[eventType as keyof typeof baseEvents] || baseEvents.player_attack;

    return {
      ...baseEvent,
      ...overrides
    };
  }

  /**
   * Create player combat history
   */
  static createPlayerCombatHistory(
    userId: string,
    locationId: string,
    overrides?: Partial<PlayerCombatHistory>
  ): PlayerCombatHistory {
    return {
      user_id: userId,
      location_id: locationId,
      attempts: 15,
      victories: 10,
      defeats: 5,
      current_streak: 3,
      longest_streak: 7,
      last_attempt: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Create a successful chatter response
   */
  static createChatterResponse(
    personalityType: string = 'sassy',
    wasAiGenerated: boolean = true,
    overrides?: Partial<ChatterResponse>
  ): ChatterResponse {
    const responses = {
      sassy: 'Oh please, I could do better with my eyes closed!',
      encouraging: 'Great job! Keep it up!',
      analytical: 'Optimal strike executed. Efficiency: 87.3%',
      chaotic: 'BANANA PHONE! Wait, did we win?',
      stoic: 'Victory was inevitable.',
      trash_talker: 'Get wrecked! Nobody beats us!'
    };

    return {
      dialogue: responses[personalityType as keyof typeof responses] || responses.sassy,
      personality_type: personalityType,
      generation_time_ms: wasAiGenerated ? 1250 : 45,
      was_ai_generated: wasAiGenerated,
      ...overrides
    };
  }

  /**
   * Create an enemy chatter response
   */
  static createEnemyChatterResponse(
    enemyType: string = 'goblin',
    dialogueTone: string = 'sarcastic',
    playerHistory: Partial<PlayerCombatHistory> = {},
    overrides?: Partial<EnemyChatterResponse>
  ): EnemyChatterResponse {
    const responses = {
      goblin: 'Heh heh, is that all you\'ve got?',
      orc: 'GRAAAH! Me stronger than you!',
      dragon: 'Mortals are so predictably disappointing.',
      wizard: 'Reality is optional! Observe!',
      politician: 'My campaign promises include your defeat!'
    };

    const defaultHistory = {
      attempts: 10,
      victories: 6,
      defeats: 4,
      current_streak: 2
    };

    return {
      dialogue: responses[enemyType as keyof typeof responses] || responses.goblin,
      personality_type: enemyType,
      enemy_type: enemyType,
      dialogue_tone: dialogueTone,
      generation_time_ms: 1180,
      was_ai_generated: true,
      player_context_used: {
        ...defaultHistory,
        ...playerHistory
      },
      ...overrides
    };
  }

  /**
   * Create AI service timeout error
   */
  static createTimeoutError(): Error {
    const error = new Error('AI service timeout after 2000ms');
    error.name = 'TimeoutError';
    return error;
  }

  /**
   * Create OpenAI API error
   */
  static createOpenAIError(status: number = 500, message: string = 'Internal server error'): Error {
    const error = new Error(message);
    error.name = 'OpenAIError';
    (error as any).status = status;
    return error;
  }

  /**
   * Create multiple pet personalities
   */
  static createManyPersonalities(
    types: string[] = ['sassy', 'encouraging', 'analytical']
  ): PetPersonality[] {
    return types.map(type => this.createPetPersonality(type));
  }

  /**
   * Create multiple enemy types
   */
  static createManyEnemyTypes(
    types: string[] = ['goblin', 'orc', 'dragon']
  ): EnemyType[] {
    return types.map(type => this.createEnemyType(type));
  }
}