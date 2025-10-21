// Simple UUID generator for tests (avoids ESM import issues)
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
import type { Database } from '../../src/types/database.types.js';
import type { CombatSession } from '../../src/types/combat.types.js';

type EnemyType = Database['public']['Tables']['enemytypes']['Row'];
type EnemyTypeInsert = Database['public']['Tables']['enemytypes']['Insert'];

/**
 * Enemy interface extending EnemyType with computed values
 */
export interface Enemy extends EnemyType {
  computed_hp: number;
  computed_atk: number;
  computed_def: number;
  gold_min: number;
  gold_max: number;
  material_drop_pool: string[];
}

/**
 * Factory for generating Combat-related test data with flexible overrides
 */
export class CombatFactory {
  /**
   * Create combat session
   */
  static createSession(
    userId: string,
    locationId: string,
    enemyLevel: number,
    overrides?: Partial<CombatSession>
  ): CombatSession {
    const enemy = this.createEnemy('goblin', enemyLevel);
    const maxPlayerHp = 100 + (enemyLevel * 10); // Scale player HP with enemy level
    const maxEnemyHp = enemy.computed_hp;

    const baseCombatSession: CombatSession = {
      session_id: generateUuid(),
      enemy_type_id: enemy.id,
      player_id: userId,
      location_id: locationId,
      turn_number: 1,
      player_hp: maxPlayerHp,
      enemy_hp: maxEnemyHp,
      max_player_hp: maxPlayerHp,
      max_enemy_hp: maxEnemyHp,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    };

    return baseCombatSession;
  }

  /**
   * Create enemy of specific type
   */
  static createEnemy(type: string, level: number, overrides?: Partial<Enemy>): Enemy {
    const baseStats = this.getBaseEnemyStats(type);

    // Scale stats with level
    const levelMultiplier = 1 + (level - 1) * 0.15;
    const computed_hp = Math.floor(baseStats.base_hp * levelMultiplier);
    const computed_atk = Math.floor(baseStats.base_atk * levelMultiplier);
    const computed_def = Math.floor(baseStats.base_def * levelMultiplier);

    // Scale gold rewards with level
    const gold_min = Math.floor(10 * levelMultiplier);
    const gold_max = Math.floor(25 * levelMultiplier);

    const baseEnemy: Enemy = {
      id: generateUuid(),
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Lv.${level}`,
      base_hp: baseStats.base_hp,
      base_atk: baseStats.base_atk,
      base_def: baseStats.base_def,
      hp_offset: baseStats.hp_offset,
      atk_offset: baseStats.atk_offset,
      def_offset: baseStats.def_offset,
      tier_id: Math.min(Math.floor(level / 5) + 1, 5), // Tier 1-5 based on level
      style_id: 'normal',
      dialogue_tone: baseStats.dialogue_tone,
      verbosity: 'medium',
      base_dialogue_prompt: `You are a ${type} enemy in combat.`,
      ai_personality_traits: { aggressive: 0.7, cunning: 0.5, taunting: 0.6 },
      example_taunts: [`Prepare to face the wrath of a ${type}!`, `You cannot defeat me!`],
      appearance_data: { color: baseStats.color, size: baseStats.size },
      computed_hp,
      computed_atk,
      computed_def,
      gold_min,
      gold_max,
      material_drop_pool: this.getMaterialDropPool(type, level),
      ...overrides
    };

    return baseEnemy;
  }

  /**
   * Create combat session in victory state
   */
  static createVictorySession(userId: string, locationId: string): CombatSession {
    const session = this.createSession(userId, locationId, 3);

    // Set enemy to very low HP (victory imminent)
    return {
      ...session,
      enemy_hp: 5,
      turn_number: 8,
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Create combat session in defeat state
   */
  static createDefeatSession(userId: string, locationId: string): CombatSession {
    const session = this.createSession(userId, locationId, 5);

    // Set player to very low HP (defeat imminent)
    return {
      ...session,
      player_hp: 10,
      turn_number: 12,
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Create combat session mid-fight
   */
  static createMidFightSession(userId: string, locationId: string, turnNumber: number = 5): CombatSession {
    const session = this.createSession(userId, locationId, 4);

    // Simulate mid-fight damage
    const playerDamage = Math.floor(session.max_player_hp * 0.3);
    const enemyDamage = Math.floor(session.max_enemy_hp * 0.4);

    return {
      ...session,
      player_hp: session.max_player_hp - playerDamage,
      enemy_hp: session.max_enemy_hp - enemyDamage,
      turn_number: turnNumber,
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Create enemy for database insertion (Insert type)
   */
  static createEnemyForInsert(overrides?: Partial<EnemyTypeInsert>): EnemyTypeInsert {
    const enemy = this.createEnemy('orc', 1);
    return {
      id: enemy.id,
      name: enemy.name,
      base_hp: enemy.base_hp,
      base_atk: enemy.base_atk,
      base_def: enemy.base_def,
      hp_offset: enemy.hp_offset,
      atk_offset: enemy.atk_offset,
      def_offset: enemy.def_offset,
      tier_id: enemy.tier_id,
      style_id: enemy.style_id,
      dialogue_tone: enemy.dialogue_tone,
      verbosity: enemy.verbosity,
      base_dialogue_prompt: enemy.base_dialogue_prompt,
      ai_personality_traits: enemy.ai_personality_traits,
      example_taunts: enemy.example_taunts,
      appearance_data: enemy.appearance_data,
      ...overrides
    };
  }

  /**
   * Create multiple combat sessions at once
   */
  static createManySessions(
    count: number,
    userId: string,
    locationId: string,
    factory: () => CombatSession = () => this.createSession(userId, locationId, 1)
  ): CombatSession[] {
    return Array.from({ length: count }, () => factory());
  }

  /**
   * Create multiple enemies at once
   */
  static createManyEnemies(count: number, factory: () => Enemy = () => this.createEnemy('goblin', 1)): Enemy[] {
    return Array.from({ length: count }, () => factory());
  }

  /**
   * Get base stats for enemy type
   */
  private static getBaseEnemyStats(type: string): {
    base_hp: number;
    base_atk: number;
    base_def: number;
    hp_offset: number;
    atk_offset: number;
    def_offset: number;
    dialogue_tone: string;
    color: string;
    size: string;
  } {
    const enemyStats: Record<string, any> = {
      goblin: {
        base_hp: 80, base_atk: 25, base_def: 15,
        hp_offset: 10, atk_offset: 5, def_offset: 3,
        dialogue_tone: 'mischievous', color: 'green', size: 'small'
      },
      orc: {
        base_hp: 120, base_atk: 35, base_def: 20,
        hp_offset: 15, atk_offset: 8, def_offset: 5,
        dialogue_tone: 'aggressive', color: 'brown', size: 'large'
      },
      skeleton: {
        base_hp: 60, base_atk: 30, base_def: 10,
        hp_offset: 8, atk_offset: 6, def_offset: 2,
        dialogue_tone: 'eerie', color: 'white', size: 'medium'
      },
      dragon: {
        base_hp: 300, base_atk: 60, base_def: 40,
        hp_offset: 30, atk_offset: 15, def_offset: 10,
        dialogue_tone: 'arrogant', color: 'red', size: 'huge'
      },
      wolf: {
        base_hp: 70, base_atk: 28, base_def: 12,
        hp_offset: 8, atk_offset: 4, def_offset: 2,
        dialogue_tone: 'feral', color: 'gray', size: 'medium'
      }
    };

    return enemyStats[type] || enemyStats['goblin'];
  }

  /**
   * Get material drop pool for enemy type and level
   */
  private static getMaterialDropPool(type: string, level: number): string[] {
    const basePools: Record<string, string[]> = {
      goblin: ['iron', 'leather', 'bone'],
      orc: ['steel', 'hide', 'tusk'],
      skeleton: ['bone', 'dust', 'crystal'],
      dragon: ['scale', 'fire_crystal', 'gold'],
      wolf: ['fur', 'fang', 'claw']
    };

    const basePool = basePools[type] || basePools['goblin'];

    // Higher level enemies can drop rarer materials
    if (level >= 10) {
      basePool.push('rare_gem', 'enchanted_ore');
    }
    if (level >= 20) {
      basePool.push('legendary_essence');
    }

    return basePool;
  }
}