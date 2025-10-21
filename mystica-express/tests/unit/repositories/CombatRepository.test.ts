/**
 * CombatRepository unit tests
 *
 * Tests PostgreSQL-only storage pattern, session management with expiry,
 * combat log events, player history tracking, and timestamp-based TTL.
 */

import { CombatRepository, CombatSessionData, CombatLogEventData, PlayerCombatHistoryData, COMBAT_SESSION_TTL } from '../../../src/repositories/CombatRepository.js';
import { ValidationError, BusinessLogicError, NotFoundError } from '../../../src/utils/errors.js';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(),
    onConflict: jest.fn().mockReturnThis(),
    ignoreDuplicates: jest.fn().mockReturnThis(),
  })),
  rpc: jest.fn(),
};

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-session-id'),
}));

describe('CombatRepository', () => {
  let repository: CombatRepository;
  let mockClient: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create repository with mocked client
    repository = new CombatRepository();
    mockClient = mockSupabase;
    (repository as any).client = mockClient;
  });

  describe('PostgreSQL Session Operations', () => {
    describe('createSession', () => {
      const sessionData = {
        userId: 'user-1',
        locationId: 'location-1',
        combatLevel: 5,
        enemyTypeId: 'enemy-1',
        playerRating: 100,
        enemyRating: 90,
        winProbEst: 0.6,
      };

      it('should create new session successfully', async () => {
        // Mock no existing active session
        mockClient.from.mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
        });

        // Mock successful creation
        mockClient.from.mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'test-session-id' }, error: null })
            })
          })
        });

        const sessionId = await repository.createSession(sessionData.userId, sessionData);

        expect(sessionId).toBe('test-session-id');
        expect(mockClient.from).toHaveBeenCalledWith('combatsessions');
      });

      it('should throw error if user already has active session', async () => {
        // Mock existing active session
        const existingSession = {
          id: 'existing-session-id',
          user_id: 'user-1',
          location_id: 'location-1',
          combat_level: 5,
          enemy_type_id: 'enemy-1',
          outcome: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: existingSession, error: null })
        });

        await expect(repository.createSession(sessionData.userId, sessionData))
          .rejects.toThrow(BusinessLogicError);
      });
    });

    describe('getActiveSession', () => {
      it('should return session data when found and not expired', async () => {
        const sessionRow = {
          id: 'session-1',
          user_id: 'user-1',
          location_id: 'location-1',
          combat_level: 5,
          enemy_type_id: 'enemy-1',
          outcome: null,
          created_at: new Date().toISOString(), // Recent timestamp
          updated_at: new Date().toISOString(),
        };

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: sessionRow, error: null })
        });

        const result = await repository.getActiveSession('session-1');

        expect(result).toEqual(expect.objectContaining({
          id: 'session-1',
          userId: 'user-1',
          locationId: 'location-1',
        }));
        expect(result!.createdAt).toBeInstanceOf(Date);
        expect(result!.updatedAt).toBeInstanceOf(Date);
      });

      it('should return null when session not found', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
        });

        const result = await repository.getActiveSession('session-1');

        expect(result).toBeNull();
      });

      it('should return null when session is expired', async () => {
        const expiredTimestamp = new Date(Date.now() - (COMBAT_SESSION_TTL + 60) * 1000).toISOString();
        const sessionRow = {
          id: 'session-1',
          user_id: 'user-1',
          location_id: 'location-1',
          combat_level: 5,
          enemy_type_id: 'enemy-1',
          outcome: null,
          created_at: expiredTimestamp,
          updated_at: expiredTimestamp,
        };

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: sessionRow, error: null })
        });

        const result = await repository.getActiveSession('session-1');

        expect(result).toBeNull();
      });

      it('should throw error for invalid session ID', async () => {
        await expect(repository.getActiveSession(''))
          .rejects.toThrow(ValidationError);

      });

    });

    describe('updateSession', () => {
      const existingSession: CombatSessionData = {
        id: 'session-1',
        userId: 'user-1',
        locationId: 'location-1',
        combatLevel: 5,
        enemyTypeId: 'enemy-1',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:05:00Z'),
      };

      it('should update session successfully', async () => {
        // Mock getActiveSession returning existing session
        const sessionRow = {
          id: 'session-1',
          user_id: 'user-1',
          location_id: 'location-1',
          combat_level: 5,
          enemy_type_id: 'enemy-1',
          outcome: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        mockClient.from.mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: sessionRow, error: null })
        });

        // Mock update operation
        mockClient.from.mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockResolvedValue({ error: null })
        });

        await repository.updateSession('session-1', { combatLog: [{ event: 'attack' }] });

        expect(mockClient.from).toHaveBeenCalledWith('combatsessions');
      });


      it('should throw error if session not found', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
        });

        await expect(repository.updateSession('session-1', { combatLog: [] }))
          .rejects.toThrow(NotFoundError);
      });

    });

    describe('completeSession', () => {
      const sessionData: CombatSessionData = {
        id: 'session-1',
        userId: 'user-1',
        locationId: 'location-1',
        combatLevel: 5,
        enemyTypeId: 'enemy-1',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:05:00Z'),
      };

      it('should complete session successfully', async () => {
        const sessionRow = {
          id: 'session-1',
          user_id: 'user-1',
          location_id: 'location-1',
          combat_level: 5,
          enemy_type_id: 'enemy-1',
          outcome: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Mock getActiveSession
        mockClient.from.mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: sessionRow, error: null })
        });

        // Mock update completion
        mockClient.from.mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockResolvedValue({ error: null })
        });

        // Mock RPC call
        mockClient.rpc.mockResolvedValue({ data: null, error: null });

        await repository.completeSession('session-1', 'victory');

        // Should update session with completion
        expect(mockClient.from).toHaveBeenCalledWith('combatsessions');

        // Should update player history
        expect(mockClient.rpc).toHaveBeenCalledWith('update_combat_history', {
          p_user_id: 'user-1',
          p_location_id: 'location-1',
          p_result: 'victory',
        });
      });

      it('should throw error if session not found', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
        });

        await expect(repository.completeSession('session-1', 'victory'))
          .rejects.toThrow(NotFoundError);
      });
    });

    describe('deleteSession', () => {
      it('should delete session from PostgreSQL', async () => {
        mockClient.from.mockReturnValue({
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null })
        });

        await repository.deleteSession('session-1');

        expect(mockClient.from).toHaveBeenCalledWith('combatsessions');
      });

      it('should handle session delete errors', async () => {
        mockClient.from.mockReturnValue({
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: { message: 'Delete failed' } })
        });

        await expect(repository.deleteSession('session-1'))
          .rejects.toThrow(ValidationError);
      });
    });
  });

  describe('Combat Log Events', () => {
    describe('addLogEvent', () => {
      it('should add log event successfully', async () => {
        mockClient.from.mockReturnValue({
          insert: jest.fn().mockResolvedValue({ error: null }),
        });

        const event: Omit<CombatLogEventData, 'combatId'> = {
          seq: 1,
          ts: new Date('2024-01-01T00:00:00Z'),
          actor: 'player',
          eventType: 'attack',
          payload: { damage: 10 },
          valueI: 10,
        };

        await repository.addLogEvent('combat-1', event);

        expect(mockClient.from).toHaveBeenCalledWith('combatlogevents');
        const insertCall = mockClient.from().insert;
        expect(insertCall).toHaveBeenCalledWith({
          combat_id: 'combat-1',
          seq: 1,
          ts: '2024-01-01T00:00:00.000Z',
          actor: 'player',
          event_type: 'attack',
          payload: { damage: 10 },
          value_i: 10,
        });
      });

      it('should throw error on database failure', async () => {
        mockClient.from.mockReturnValue({
          insert: jest.fn().mockResolvedValue({
            error: { message: 'Insert failed' }
          }),
        });

        const event: Omit<CombatLogEventData, 'combatId'> = {
          seq: 1,
          ts: new Date(),
          actor: 'player',
          eventType: 'attack',
        };

        await expect(repository.addLogEvent('combat-1', event))
          .rejects.toThrow(ValidationError);
      });
    });

    describe('getLogEvents', () => {
      it('should return log events ordered by sequence', async () => {
        const mockEvents = [
          {
            combat_id: 'combat-1',
            seq: 1,
            ts: '2024-01-01T00:00:00Z',
            actor: 'player',
            event_type: 'attack',
            payload: { damage: 10 },
            value_i: 10,
          },
          {
            combat_id: 'combat-1',
            seq: 2,
            ts: '2024-01-01T00:01:00Z',
            actor: 'enemy',
            event_type: 'attack',
            payload: { damage: 8 },
            value_i: 8,
          },
        ];

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockEvents, error: null }),
        });

        const result = await repository.getLogEvents('combat-1');

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          combatId: 'combat-1',
          seq: 1,
          ts: new Date('2024-01-01T00:00:00Z'),
          actor: 'player',
          eventType: 'attack',
          payload: { damage: 10 },
          valueI: 10,
        });

        const query = mockClient.from().select().eq().order;
        expect(query).toHaveBeenCalledWith('seq', { ascending: true });
      });
    });

    describe('getLogEventsByActor', () => {
      it('should filter events by actor', async () => {
        const mockEvents = [
          {
            combat_id: 'combat-1',
            seq: 1,
            ts: '2024-01-01T00:00:00Z',
            actor: 'player',
            event_type: 'attack',
            payload: null,
            value_i: null,
          },
        ];

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockEvents, error: null }),
        });

        const result = await repository.getLogEventsByActor('combat-1', 'player');

        expect(result).toHaveLength(1);
        expect(result[0].actor).toBe('player');

        const eqCalls = mockClient.from().select().eq;
        expect(eqCalls).toHaveBeenCalledWith('combat_id', 'combat-1');
        expect(eqCalls).toHaveBeenCalledWith('actor', 'player');
      });
    });
  });

  describe('Player Combat History', () => {
    describe('getPlayerHistory', () => {
      it('should return player history when found', async () => {
        const mockHistory = {
          user_id: 'user-1',
          location_id: 'location-1',
          total_attempts: 10,
          victories: 6,
          defeats: 4,
          current_streak: 2,
          longest_streak: 5,
          last_attempt: '2024-01-01T00:00:00Z',
        };

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: mockHistory, error: null }),
        });

        const result = await repository.getPlayerHistory('user-1', 'location-1');

        expect(result).toEqual({
          userId: 'user-1',
          locationId: 'location-1',
          totalAttempts: 10,
          victories: 6,
          defeats: 4,
          currentStreak: 2,
          longestStreak: 5,
          lastAttempt: new Date('2024-01-01T00:00:00Z'),
        });
      });

      it('should return null when no history found', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' }
          }),
        });

        const result = await repository.getPlayerHistory('user-1', 'location-1');

        expect(result).toBeNull();
      });
    });

    describe('updatePlayerHistory', () => {
      it('should call RPC with victory result', async () => {
        mockClient.rpc.mockResolvedValue({ data: null, error: null });

        await repository.updatePlayerHistory('user-1', 'location-1', 'victory');

        expect(mockClient.rpc).toHaveBeenCalledWith('update_combat_history', {
          p_user_id: 'user-1',
          p_location_id: 'location-1',
          p_result: 'victory',
        });
      });

      it('should map escape to defeat for streak tracking', async () => {
        mockClient.rpc.mockResolvedValue({ data: null, error: null });

        await repository.updatePlayerHistory('user-1', 'location-1', 'escape');

        expect(mockClient.rpc).toHaveBeenCalledWith('update_combat_history', {
          p_user_id: 'user-1',
          p_location_id: 'location-1',
          p_result: 'defeat', // escape mapped to defeat
        });
      });

      it('should map abandoned to defeat for streak tracking', async () => {
        mockClient.rpc.mockResolvedValue({ data: null, error: null });

        await repository.updatePlayerHistory('user-1', 'location-1', 'abandoned');

        expect(mockClient.rpc).toHaveBeenCalledWith('update_combat_history', {
          p_user_id: 'user-1',
          p_location_id: 'location-1',
          p_result: 'defeat', // abandoned mapped to defeat
        });
      });
    });
  });

  describe('Analytics and Reporting', () => {
    describe('getUserCombatStats', () => {
      it('should return aggregated stats', async () => {
        const mockHistoryData = [
          {
            user_id: 'user-1',
            location_id: 'location-1',
            total_attempts: 10,
            victories: 6,
            defeats: 4,
            current_streak: 2,
            longest_streak: 5,
          },
          {
            user_id: 'user-1',
            location_id: 'location-2',
            total_attempts: 5,
            victories: 3,
            defeats: 2,
            current_streak: 0,
            longest_streak: 3,
          },
        ];

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: mockHistoryData, error: null }),
        });

        const result = await repository.getUserCombatStats('user-1');

        expect(result).toEqual({
          totalLocations: 2,
          totalAttempts: 15,
          totalVictories: 9,
          totalDefeats: 6,
          winRate: 0.6,
          longestStreak: 5,
          currentActiveStreaks: 1, // Only one location has active streak
        });
      });

      it('should return zero stats for new user', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        });

        const result = await repository.getUserCombatStats('user-1');

        expect(result).toEqual({
          totalLocations: 0,
          totalAttempts: 0,
          totalVictories: 0,
          totalDefeats: 0,
          winRate: 0,
          longestStreak: 0,
          currentActiveStreaks: 0,
        });
      });
    });

    describe('hasActiveSession', () => {
      it('should return true when user has active session', async () => {
        const sessionRow = {
          id: 'session-123',
          user_id: 'user-1',
          location_id: 'location-1',
          combat_level: 5,
          enemy_type_id: 'enemy-1',
          outcome: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: sessionRow, error: null })
        });

        const result = await repository.hasActiveSession('user-1');

        expect(result).toBe(true);
      });

      it('should return false when user has no active session', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
        });

        const result = await repository.hasActiveSession('user-1');

        expect(result).toBe(false);
      });
    });

    describe('getSessionExpiry', () => {
      it('should return expiry time when session exists', async () => {
        const recentTime = new Date(); // Use current time to avoid expiry
        const sessionRow = {
          id: 'session-1',
          user_id: 'user-1',
          location_id: 'location-1',
          combat_level: 5,
          enemy_type_id: 'enemy-1',
          outcome: null,
          created_at: recentTime.toISOString(),
          updated_at: recentTime.toISOString(),
        };

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: sessionRow, error: null })
        });

        const result = await repository.getSessionExpiry('session-1');

        const expectedExpiry = new Date(recentTime.getTime() + (COMBAT_SESSION_TTL * 1000));
        expect(result).toEqual(expectedExpiry);
      });

      it('should return null when session expired or not found', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
        });

        const result = await repository.getSessionExpiry('session-1');

        expect(result).toBeNull();
      });
    });

    describe('extendSessionActivity', () => {
      it('should update session activity timestamp', async () => {
        mockClient.from.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockResolvedValue({ error: null })
        });

        await repository.extendSessionActivity('session-1');

        expect(mockClient.from).toHaveBeenCalledWith('combatsessions');
      });

      it('should throw error on database failure', async () => {
        mockClient.from.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockResolvedValue({ error: { message: 'Update failed' } })
        });

        await expect(repository.extendSessionActivity('session-1'))
          .rejects.toThrow(ValidationError);
      });
    });

    describe('Session Expiry Logic', () => {
      describe('isSessionExpired', () => {
        it('should return false for recent session', () => {
          const recentTime = new Date(Date.now() - 300000); // 5 minutes ago
          const result = repository.isSessionExpired(recentTime);
          expect(result).toBe(false);
        });

        it('should return true for expired session', () => {
          const expiredTime = new Date(Date.now() - (COMBAT_SESSION_TTL + 60) * 1000); // 16 minutes ago
          const result = repository.isSessionExpired(expiredTime);
          expect(result).toBe(true);
        });
      });

      describe('cleanupExpiredSessions', () => {
        it('should mark expired sessions as abandoned', async () => {
          const mockData = [{ id: 'session-1' }, { id: 'session-2' }];
          mockClient.from.mockReturnValue({
            update: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            lt: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue({ data: mockData, error: null })
          });

          const result = await repository.cleanupExpiredSessions();

          expect(result).toBe(2);
          expect(mockClient.from).toHaveBeenCalledWith('combatsessions');
        });
      });
    });
  });

});