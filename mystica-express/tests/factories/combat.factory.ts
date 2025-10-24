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
import type { CombatSessionData } from '../../src/repositories/CombatRepository.js';

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
    overrides?: Partial<CombatSessionData>
  ): CombatSessionData {
    const enemy = this.createEnemy('goblin', enemyLevel);
    const maxPlayerHp = 100 + (enemyLevel * 10); // Scale player HP with enemy level
    const maxEnemyHp = enemy.computed_hp;

    const baseCombatSession: CombatSessionData = {
      id: generateUuid(),
      userId: userId,
      locationId: locationId,
      combatLevel: enemyLevel,
      enemyTypeId: enemy.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };

    return baseCombatSession;
  }

  /**
   * Create enemy of specific type
   */
  static createEnemy(type: string, level: number, overrides?: Partial<Enemy>): Enemy {
    // Validate enemy type exists before processing
    const enemyTypes = ['goblin', 'orc', 'skeleton', 'dragon', 'wolf'];
    if (!enemyTypes.includes(type)) {
      throw new Error(`Unknown enemy type in test factory: ${type}`);
    }

    const baseStats = this.getBaseEnemyStats(type);

    // Scale stats with level
    const levelMultiplier = 1 + (level - 1) * 0.15;
    const computed_hp = Math.floor(baseStats.base_hp * levelMultiplier);
    const computed_atk = Math.floor(baseStats.atk_power * levelMultiplier);
    const computed_def = Math.floor(baseStats.def_power * levelMultiplier);

    // Scale gold rewards with level
    const gold_min = Math.floor(10 * levelMultiplier);
    const gold_max = Math.floor(25 * levelMultiplier);

    const baseEnemy: Enemy = {
      id: generateUuid(),
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Lv.${level}`,
      base_hp: baseStats.base_hp,
      atk_power: baseStats.atk_power,
      atk_accuracy: baseStats.atk_accuracy,
      def_power: baseStats.def_power,
      def_accuracy: baseStats.def_accuracy,
      tier_id: Math.min(Math.floor(level / 5) + 1, 5), // Tier 1-5 based on level
      style_id: 'normal',
      dialogue_tone: baseStats.dialogue_tone,
      dialogue_guidelines: `You are a ${type} enemy in combat.`,
      ai_personality_traits: { aggressive: 0.7, cunning: 0.5, taunting: 0.6 },
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
  static createVictorySession(userId: string, locationId: string): CombatSessionData {
    const session = this.createSession(userId, locationId, 3);

    // Set enemy to very low HP (victory imminent) - CombatSessionData doesn't track HP
    return {
      ...session,
      updatedAt: new Date()
    };
  }

  /**
   * Create combat session in defeat state
   */
  static createDefeatSession(userId: string, locationId: string): CombatSessionData {
    const session = this.createSession(userId, locationId, 5);

    // Set session for defeat scenario - CombatSessionData doesn't track HP
    return {
      ...session,
      updatedAt: new Date()
    };
  }

  /**
   * Create combat session mid-fight
   */
  static createMidFightSession(userId: string, locationId: string, turnNumber: number = 5): CombatSessionData {
    const session = this.createSession(userId, locationId, 4);

    // Simulate mid-fight - CombatSessionData doesn't track HP
    return {
      ...session,
      updatedAt: new Date()
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
      atk_power: enemy.atk_power,
      atk_accuracy: enemy.atk_accuracy,
      def_power: enemy.def_power,
      def_accuracy: enemy.def_accuracy,
      tier_id: enemy.tier_id,
      style_id: enemy.style_id,
      dialogue_tone: enemy.dialogue_tone,
      dialogue_guidelines: enemy.dialogue_guidelines,
      ai_personality_traits: enemy.ai_personality_traits,
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
    factory: () => CombatSessionData = () => this.createSession(userId, locationId, 1)
  ): CombatSessionData[] {
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
    atk_power: number;
    atk_accuracy: number;
    def_power: number;
    def_accuracy: number;
    dialogue_tone: string;
    color: string;
    size: string;
  } {
    const enemyStats: Record<string, any> = {
      goblin: {
        base_hp: 80, atk_power: 25, atk_accuracy: 75, def_power: 15, def_accuracy: 70,
        dialogue_tone: 'mischievous', color: 'green', size: 'small'
      },
      orc: {
        base_hp: 120, atk_power: 35, atk_accuracy: 80, def_power: 20, def_accuracy: 75,
        dialogue_tone: 'aggressive', color: 'brown', size: 'large'
      },
      skeleton: {
        base_hp: 60, atk_power: 30, atk_accuracy: 70, def_power: 10, def_accuracy: 65,
        dialogue_tone: 'eerie', color: 'white', size: 'medium'
      },
      dragon: {
        base_hp: 300, atk_power: 60, atk_accuracy: 95, def_power: 40, def_accuracy: 90,
        dialogue_tone: 'arrogant', color: 'red', size: 'huge'
      },
      wolf: {
        base_hp: 70, atk_power: 28, atk_accuracy: 85, def_power: 12, def_accuracy: 80,
        dialogue_tone: 'feral', color: 'gray', size: 'medium'
      }
    };

    const stats = enemyStats[type];
    if (!stats) {
      throw new Error(`Unknown enemy type in test factory: ${type}`);
    }
    return stats;
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

    const basePool = basePools[type];
    if (!basePool) {
      throw new Error(`Unknown enemy type for material drop pool: ${type}`);
    }
    return basePool;

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