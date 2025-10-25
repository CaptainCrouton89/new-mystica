/**
 * Enemy Service
 *
 * Business logic for enemy/monster operations including:
 * - Retrieving enemy data with computed stats
 * - Constructing R2 asset URLs for sprites
 * - Enemy selection for combat encounters
 */

import { EnemyRepository, EnemyTypeWithPersonality, EnemyStats } from '../repositories/EnemyRepository.js';
import { NotFoundError } from '../utils/errors.js';

// R2 configuration
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev';

/**
 * Sprite animation data
 */
export interface SpriteAnimation {
  image_url: string;
  atlas_url: string;
}

/**
 * Monster images with all sprite animations
 */
export interface MonsterImages {
  base_url: string;
  sprites: {
    idle: SpriteAnimation[];
    attack: SpriteAnimation[];
    damage: SpriteAnimation[];
    death: SpriteAnimation[];
  };
}

/**
 * Complete monster data for API responses
 */
export interface MonsterData {
  id: string;
  name: string;
  description: string;
  tier: number;
  style_id: string;
  stats: {
    base_hp: number;
    atk_power: number;
    atk_accuracy: number;
    def_power: number;
    def_accuracy: number;
    combat_rating: number;
  };
  personality: {
    aggression: number;
    intelligence: number;
    cunning: number;
    hostility: number;
  };
  dialogue: {
    tone: string;
    guidelines: string;
  };
  images: MonsterImages;
}

/**
 * Enemy Service
 */
export class EnemyService {
  private enemyRepository: EnemyRepository;

  constructor(enemyRepository?: EnemyRepository) {
    this.enemyRepository = enemyRepository || new EnemyRepository();
  }

  /**
   * Get complete monster data by ID
   *
   * @param enemyTypeId - Enemy type UUID
   * @returns Complete monster data with images and stats
   * @throws NotFoundError if enemy doesn't exist
   */
  async getMonsterById(enemyTypeId: string): Promise<MonsterData> {
    // Fetch enemy type from database
    const enemy = await this.enemyRepository.findEnemyTypeById(enemyTypeId);

    if (!enemy) {
      throw new NotFoundError('enemy_type', enemyTypeId);
    }

    // Compute stats from normalized values (temp fix until view is updated)
    const stats = {
      atk: enemy.atk_power_normalized,
      def: enemy.def_power_normalized,
      hp: enemy.base_hp,
      combat_rating: enemy.base_hp * (enemy.atk_power_normalized + enemy.def_power_normalized)
    };

    // Construct image URLs using UUID
    const images = this.constructImageUrls(enemy.id);

    // Extract personality traits
    const personality = this.extractPersonalityTraits(enemy);

    return {
      id: enemy.id,
      name: enemy.name,
      description: '', // No longer stored in metadata
      tier: enemy.tier_id,
      style_id: 'normal', // Default style (column doesn't exist in schema)
      stats: {
        base_hp: enemy.base_hp,
        atk_power: enemy.atk_power_normalized,
        atk_accuracy: enemy.atk_accuracy_normalized,
        def_power: enemy.def_power_normalized,
        def_accuracy: enemy.def_accuracy_normalized,
        combat_rating: stats.combat_rating
      },
      personality,
      dialogue: {
        tone: enemy.dialogue_tone || '',
        guidelines: enemy.dialogue_guidelines || ''
      },
      images
    };
  }

  /**
   * Get multiple monsters by IDs
   *
   * @param enemyTypeIds - Array of enemy type UUIDs
   * @returns Array of monster data
   */
  async getMonstersByIds(enemyTypeIds: string[]): Promise<MonsterData[]> {
    const monsters = await Promise.all(
      enemyTypeIds.map(id => this.getMonsterById(id).catch(() => null))
    );

    return monsters.filter((m): m is MonsterData => m !== null);
  }

  /**
   * List all monsters with pagination
   *
   * @param options - Pagination and filter options
   * @returns Array of monster data
   */
  async listMonsters(options?: {
    limit?: number;
    offset?: number;
    orderBy?: 'name' | 'tier_id';
  }): Promise<MonsterData[]> {
    const enemies = await this.enemyRepository.findAllEnemyTypes(options);

    const monsters = await Promise.all(
      enemies.map(async (enemy) => {
        try {
          const stats = {
            atk: enemy.atk_power_normalized,
            def: enemy.def_power_normalized,
            hp: enemy.base_hp,
            combat_rating: enemy.base_hp * (enemy.atk_power_normalized + enemy.def_power_normalized)
          };

          const images = this.constructImageUrls(enemy.id);
          const personality = this.extractPersonalityTraits(enemy);

          return {
            id: enemy.id,
            name: enemy.name,
            description: '', // No longer stored in metadata
            tier: enemy.tier_id,
            style_id: 'normal', // Default style (column doesn't exist in schema)
            stats: {
              base_hp: enemy.base_hp,
              atk_power: enemy.atk_power_normalized,
              atk_accuracy: enemy.atk_accuracy_normalized,
              def_power: enemy.def_power_normalized,
              def_accuracy: enemy.def_accuracy_normalized,
              combat_rating: stats.combat_rating
            },
            personality,
            dialogue: {
              tone: enemy.dialogue_tone || '',
              guidelines: enemy.dialogue_guidelines || ''
            },
            images
          };
        } catch (error) {
          console.error(`Failed to load monster ${enemy.id}:`, error);
          return null;
        }
      })
    );

    return monsters.filter((m): m is MonsterData => m !== null);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Extract personality traits
   */
  private extractPersonalityTraits(enemy: EnemyTypeWithPersonality): {
    aggression: number;
    intelligence: number;
    cunning: number;
    hostility: number;
  } {
    if (!enemy.ai_personality_traits) {
      return { aggression: 5, intelligence: 5, cunning: 5, hostility: 5 };
    }

    const traits = enemy.ai_personality_traits as any;
    return {
      aggression: traits.aggression || 5,
      intelligence: traits.intelligence || 5,
      cunning: traits.cunning || 5,
      hostility: traits.hostility || 5
    };
  }

  /**
   * Construct R2 image URLs for monster sprites using UUID
   *
   * Assumes standard sprite naming convention:
   * - idle_sample1, idle_sample2
   * - attack_sample1, attack_sample2
   * - damage_sample1, damage_sample2
   * - death_sample1, death_sample2
   *
   * R2 structure: monsters/{uuid}/base.png, monsters/{uuid}/sprites/*
   *
   * @param monsterId - Monster UUID from database
   * @returns Structured image URLs
   */
  private constructImageUrls(monsterId: string): MonsterImages {
    const baseUrl = `${R2_PUBLIC_URL}/monsters/${monsterId}`;
    const spriteUrl = `${baseUrl}/sprites`;

    // Helper to create sprite animation URLs
    const createSpriteUrls = (type: string, count: number = 2): SpriteAnimation[] => {
      const sprites: SpriteAnimation[] = [];
      for (let i = 1; i <= count; i++) {
        sprites.push({
          image_url: `${spriteUrl}/${type}_sample${i}.png`,
          atlas_url: `${spriteUrl}/${type}_sample${i}.json`
        });
      }
      return sprites;
    };

    return {
      base_url: `${baseUrl}/base.png`,
      sprites: {
        idle: createSpriteUrls('idle'),
        attack: createSpriteUrls('attack'),
        damage: createSpriteUrls('damage'),
        death: createSpriteUrls('death')
      }
    };
  }
}
