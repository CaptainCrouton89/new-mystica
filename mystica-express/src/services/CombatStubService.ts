import { NotFoundError } from '../utils/errors.js';
import { CombatSession } from '../types/combat.types.js';

/**
 * Stubbed combat session service for testing until F-02 is implemented
 * Provides hardcoded combat sessions for development and testing
 */
export class CombatStubService {
  private hardcodedSessions: Map<string, CombatSession>;

  constructor() {
    this.hardcodedSessions = this.getHardcodedSessions();
  }

  /**
   * Get combat session by ID
   * Returns hardcoded session data for testing
   */
  async getCombatSession(sessionId: string): Promise<CombatSession> {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      throw new NotFoundError('Combat session', sessionId);
    }

    const session = this.hardcodedSessions.get(sessionId);
    if (!session) {
      throw new NotFoundError('Combat session', sessionId);
    }

    return session;
  }

  /**
   * Generate hardcoded combat sessions for testing
   * Uses real enemy type IDs and location IDs from database
   */
  private getHardcodedSessions(): Map<string, CombatSession> {
    const sessions = new Map<string, CombatSession>();
    const now = new Date().toISOString();
    const userId = 'a7f99fed-262b-43e2-a88c-a8c5e4720577'; // Real user from DB

    // Session 1: Early combat vs Spray Paint Goblin (fresh fight)
    sessions.set('550e8400-e29b-41d4-a716-446655440001', {
      session_id: '550e8400-e29b-41d4-a716-446655440001',
      enemy_type_id: 'd9e715fb-5de0-4639-96f8-3b4f03476314', // Spray Paint Goblin
      player_id: userId,
      location_id: 'e6a0d42c-a301-4505-96a7-c71447fbec16', // Golden Gate Park
      turn_number: 2,
      player_hp: 95,
      enemy_hp: 105,
      max_player_hp: 100,
      max_enemy_hp: 120,
      created_at: now,
      updated_at: now,
    });

    // Session 2: Mid-combat vs Goopy Floating Eye (player low HP)
    sessions.set('550e8400-e29b-41d4-a716-446655440002', {
      session_id: '550e8400-e29b-41d4-a716-446655440002',
      enemy_type_id: '4637f636-0b6a-4825-b1aa-492cf8d9d1bb', // Goopy Floating Eye
      player_id: userId,
      location_id: '0cf958ca-0c12-4e60-835b-9654682d943e', // Dolores Park
      turn_number: 5,
      player_hp: 25,
      enemy_hp: 80,
      max_player_hp: 100,
      max_enemy_hp: 140,
      created_at: now,
      updated_at: now,
    });

    // Session 3: Near victory vs Feral Unicorn (enemy low HP)
    sessions.set('550e8400-e29b-41d4-a716-446655440003', {
      session_id: '550e8400-e29b-41d4-a716-446655440003',
      enemy_type_id: '63d218fc-5cd9-4404-9090-fb72537da205', // Feral Unicorn
      player_id: userId,
      location_id: 'c7c9acfb-bac3-4839-93eb-e27c092227af', // Alamo Square Park
      turn_number: 8,
      player_hp: 70,
      enemy_hp: 15,
      max_player_hp: 100,
      max_enemy_hp: 160,
      created_at: now,
      updated_at: now,
    });

    // Session 4: High-tier combat vs Bipedal Deer (both healthy)
    sessions.set('550e8400-e29b-41d4-a716-446655440004', {
      session_id: '550e8400-e29b-41d4-a716-446655440004',
      enemy_type_id: '19cd32dc-e874-4836-a3e9-851431262cc8', // Bipedal Deer
      player_id: userId,
      location_id: 'e6a0d42c-a301-4505-96a7-c71447fbec16', // Golden Gate Park
      turn_number: 3,
      player_hp: 85,
      enemy_hp: 160,
      max_player_hp: 100,
      max_enemy_hp: 180,
      created_at: now,
      updated_at: now,
    });

    // Session 5: Boss fight vs Politician (extended combat)
    sessions.set('550e8400-e29b-41d4-a716-446655440005', {
      session_id: '550e8400-e29b-41d4-a716-446655440005',
      enemy_type_id: 'beb6ea68-597a-4052-92f6-ad73d0fd02b3', // Politician
      player_id: userId,
      location_id: '0cf958ca-0c12-4e60-835b-9654682d943e', // Dolores Park
      turn_number: 12,
      player_hp: 45,
      enemy_hp: 90,
      max_player_hp: 100,
      max_enemy_hp: 200,
      created_at: now,
      updated_at: now,
    });

    return sessions;
  }

  /**
   * Get all hardcoded sessions for testing purposes
   */
  getAllSessions(): Map<string, CombatSession> {
    return this.hardcodedSessions;
  }
}

export const combatStubService = new CombatStubService();