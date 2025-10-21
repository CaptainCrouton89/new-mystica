/**
 * Unit tests for AnalyticsRepository
 *
 * Tests cover:
 * - General analytics event logging and querying
 * - Pet chatter logging (F-11 personality system)
 * - Enemy chatter logging (F-12 AI trash-talk)
 * - Time-series aggregation queries
 * - JSONB property queries
 * - Bulk operations and cleanup
 */

import { AnalyticsRepository } from '../../../src/repositories/AnalyticsRepository.js';
import { DatabaseError, ValidationError } from '../../../src/utils/errors.js';
import { createMockSupabaseClient } from '../../helpers/mockSupabase.js';

describe('AnalyticsRepository', () => {
  let repository: AnalyticsRepository;
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    repository = new AnalyticsRepository();
    // Override the client with our mock
    (repository as any).client = mockClient;
  });

  describe('General Analytics Events', () => {
    describe('logEvent', () => {
      it('should log event with user ID and properties', async () => {
        const mockInsert = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'event-1',
                user_id: 'user-1',
                event_name: 'item_crafted',
                properties: { item_type: 'sword', materials: ['iron', 'wood'] },
                timestamp: '2023-01-01T00:00:00Z'
              },
              error: null
            })
          })
        });

        mockClient.from.mockReturnValue({
          insert: mockInsert
        } as any);

        await repository.logEvent(
          'user-1',
          'item_crafted',
          { item_type: 'sword', materials: ['iron', 'wood'] }
        );

        expect(mockClient.from).toHaveBeenCalledWith('analyticsevents');
        expect(mockInsert).toHaveBeenCalledWith({
          user_id: 'user-1',
          event_name: 'item_crafted',
          properties: { item_type: 'sword', materials: ['iron', 'wood'] }
        });
      });

      it('should log system event with null user ID', async () => {
        const mockInsert = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'event-1', user_id: null, event_name: 'server_restart' },
              error: null
            })
          })
        });

        mockClient.from.mockReturnValue({
          insert: mockInsert
        } as any);

        await repository.logEvent(null, 'server_restart');

        expect(mockInsert).toHaveBeenCalledWith({
          user_id: null,
          event_name: 'server_restart',
          properties: null
        });
      });

      it('should throw ValidationError for empty event name', async () => {
        await expect(repository.logEvent('user-1', '')).rejects.toThrow(ValidationError);
        await expect(repository.logEvent('user-1', '   ')).rejects.toThrow(ValidationError);
      });
    });

    describe('getEventsByUser', () => {
      it('should get all events for user ordered by timestamp desc', async () => {
        const mockEvents = [
          { id: 'event-2', user_id: 'user-1', event_name: 'login', timestamp: '2023-01-02T00:00:00Z' },
          { id: 'event-1', user_id: 'user-1', event_name: 'item_crafted', timestamp: '2023-01-01T00:00:00Z' }
        ];

        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockEvents, error: null })
        };

        mockClient.from.mockReturnValue(mockQuery as any);

        const result = await repository.getEventsByUser('user-1');

        expect(mockClient.from).toHaveBeenCalledWith('analyticsevents');
        expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
        expect(mockQuery.order).toHaveBeenCalledWith('timestamp', { ascending: false });
        expect(result).toEqual(mockEvents);
      });

      it('should filter by event name when provided', async () => {
        const mockEvents = [
          { id: 'event-1', user_id: 'user-1', event_name: 'login', timestamp: '2023-01-01T00:00:00Z' }
        ];

        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: jest.fn(),
          catch: jest.fn(),
        };
        // Make the final query awaitable
        mockQuery.then.mockImplementation((resolve: any) =>
          resolve({ data: mockEvents, error: null })
        );

        mockClient.from.mockReturnValue(mockQuery as any);

        const result = await repository.getEventsByUser('user-1', 'login');

        expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
        expect(mockQuery.eq).toHaveBeenCalledWith('event_name', 'login');
        expect(result).toEqual(mockEvents);
      });
    });

    describe('getEventsByTimeRange', () => {
      it('should get events within time range', async () => {
        const mockEvents = [
          { id: 'event-1', event_name: 'action', timestamp: '2023-01-01T12:00:00Z' }
        ];

        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: jest.fn(),
          catch: jest.fn(),
        };
        // Make the final query awaitable
        mockQuery.then.mockImplementation((resolve: any) =>
          resolve({ data: mockEvents, error: null })
        );

        mockClient.from.mockReturnValue(mockQuery as any);

        const result = await repository.getEventsByTimeRange(
          '2023-01-01T00:00:00Z',
          '2023-01-01T23:59:59Z',
          'action'
        );

        expect(mockQuery.gte).toHaveBeenCalledWith('timestamp', '2023-01-01T00:00:00Z');
        expect(mockQuery.lte).toHaveBeenCalledWith('timestamp', '2023-01-01T23:59:59Z');
        expect(mockQuery.eq).toHaveBeenCalledWith('event_name', 'action');
        expect(result).toEqual(mockEvents);
      });
    });

    describe('getEventCounts', () => {
      it('should get event counts grouped by time period', async () => {
        const mockRpcResult = [
          { period: '2023-01-01 00:00:00', count: 5 },
          { period: '2023-01-01 01:00:00', count: 3 }
        ];

        mockClient.rpc.mockResolvedValue({ data: mockRpcResult, error: null });

        const result = await repository.getEventCounts('login', 'hour');

        expect(mockClient.rpc).toHaveBeenCalledWith('get_event_counts', {
          p_event_name: 'login',
          p_group_by: 'hour'
        });

        expect(result).toEqual({
          '2023-01-01 00:00:00': 5,
          '2023-01-01 01:00:00': 3
        });
      });
    });
  });

  describe('Pet Chatter Logging (F-11)', () => {
    describe('logPetChatter', () => {
      it('should log pet chatter with all required fields', async () => {
        const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });

        mockClient.from.mockReturnValue({
          insert: mockInsert
        } as any);

        await repository.logPetChatter(
          'session-1',
          'pet-item-1',
          'combat_start',
          'Let me help you fight!',
          150,
          true
        );

        expect(mockClient.from).toHaveBeenCalledWith('combatchatterlog');
        expect(mockInsert).toHaveBeenCalledWith({
          session_id: 'session-1',
          pet_item_id: 'pet-item-1',
          event_type: 'combat_start',
          generated_dialogue: 'Let me help you fight!',
          generation_time_ms: 150,
          was_ai_generated: true
        });
      });
    });

    describe('getPetChatterBySession', () => {
      it('should get pet chatter ordered by timestamp', async () => {
        const mockChatter = [
          { id: 'chat-1', session_id: 'session-1', event_type: 'combat_start', timestamp: '2023-01-01T00:00:00Z' },
          { id: 'chat-2', session_id: 'session-1', event_type: 'hit_taken', timestamp: '2023-01-01T00:01:00Z' }
        ];

        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockChatter, error: null })
        };

        mockClient.from.mockReturnValue(mockQuery as any);

        const result = await repository.getPetChatterBySession('session-1');

        expect(mockClient.from).toHaveBeenCalledWith('combatchatterlog');
        expect(mockQuery.eq).toHaveBeenCalledWith('session_id', 'session-1');
        expect(mockQuery.order).toHaveBeenCalledWith('timestamp', { ascending: true });
        expect(result).toEqual(mockChatter);
      });
    });

    describe('getAvgGenerationTime', () => {
      it('should calculate average generation time', async () => {
        const mockData = [
          { generation_time_ms: 100 },
          { generation_time_ms: 200 },
          { generation_time_ms: 150 }
        ];

        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockResolvedValue({ data: mockData, error: null })
        };

        mockClient.from.mockReturnValue(mockQuery as any);

        const result = await repository.getAvgGenerationTime('friendly');

        expect(mockQuery.eq).toHaveBeenCalledWith('personality_type', 'friendly');
        expect(mockQuery.not).toHaveBeenCalledWith('generation_time_ms', 'is', null);
        expect(result).toBe(150); // (100 + 200 + 150) / 3
      });

      it('should return 0 for empty dataset', async () => {
        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockResolvedValue({ data: [], error: null })
        };

        mockClient.from.mockReturnValue(mockQuery as any);

        const result = await repository.getAvgGenerationTime('friendly');
        expect(result).toBe(0);
      });
    });
  });

  describe('Enemy Chatter Logging (F-12)', () => {
    describe('logEnemyChatter', () => {
      it('should log enemy chatter with player context', async () => {
        const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });

        mockClient.from.mockReturnValue({
          insert: mockInsert
        } as any);

        const playerContext = { level: 5, equipment: ['sword', 'armor'] };

        await repository.logEnemyChatter(
          'session-1',
          'enemy-type-1',
          'player_miss',
          'Haha, you missed!',
          playerContext,
          200,
          true
        );

        expect(mockClient.from).toHaveBeenCalledWith('enemychatterlog');
        expect(mockInsert).toHaveBeenCalledWith({
          session_id: 'session-1',
          enemy_type_id: 'enemy-type-1',
          event_type: 'player_miss',
          generated_dialogue: 'Haha, you missed!',
          player_metadata: playerContext,
          generation_time_ms: 200,
          was_ai_generated: true
        });
      });
    });

    describe('getEnemyChatterByType', () => {
      it('should get enemy chatter by type ordered by timestamp desc', async () => {
        const mockChatter = [
          { id: 'chat-2', enemy_type_id: 'goblin', event_type: 'taunt', timestamp: '2023-01-01T00:02:00Z' },
          { id: 'chat-1', enemy_type_id: 'goblin', event_type: 'combat_start', timestamp: '2023-01-01T00:01:00Z' }
        ];

        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockChatter, error: null })
        };

        mockClient.from.mockReturnValue(mockQuery as any);

        const result = await repository.getEnemyChatterByType('goblin');

        expect(mockQuery.eq).toHaveBeenCalledWith('enemy_type_id', 'goblin');
        expect(mockQuery.order).toHaveBeenCalledWith('timestamp', { ascending: false });
        expect(result).toEqual(mockChatter);
      });
    });
  });

  describe('JSONB Property Queries', () => {
    describe('getEventsByProperty', () => {
      it('should query events by JSONB property path', async () => {
        const mockEvents = [
          { id: 'event-1', properties: { item_type: 'sword' } }
        ];

        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: jest.fn(),
          catch: jest.fn(),
        };
        // Make the final query awaitable
        mockQuery.then.mockImplementation((resolve: any) =>
          resolve({ data: mockEvents, error: null })
        );

        mockClient.from.mockReturnValue(mockQuery as any);

        const result = await repository.getEventsByProperty('item_type', 'sword', 'item_crafted');

        expect(mockQuery.eq).toHaveBeenCalledWith('properties->item_type', '"sword"');
        expect(mockQuery.eq).toHaveBeenCalledWith('event_name', 'item_crafted');
        expect(result).toEqual(mockEvents);
      });
    });

    describe('getUniquePropertyValues', () => {
      it('should get unique property values via RPC', async () => {
        const mockValues = ['sword', 'bow', 'staff'];

        mockClient.rpc.mockResolvedValue({ data: mockValues, error: null });

        const result = await repository.getUniquePropertyValues('item_type', 'item_crafted');

        expect(mockClient.rpc).toHaveBeenCalledWith('get_unique_property_values', {
          p_property_path: 'item_type',
          p_event_name: 'item_crafted'
        });
        expect(result).toEqual(mockValues);
      });
    });
  });

  describe('Bulk Operations', () => {
    describe('logEventsBatch', () => {
      it('should batch insert multiple events', async () => {
        const events = [
          { user_id: 'user-1', event_name: 'action1', properties: null },
          { user_id: 'user-2', event_name: 'action2', properties: { key: 'value' } }
        ];

        const mockCreatedEvents = events.map((e, i) => ({ ...e, id: `event-${i + 1}` }));

        const mockInsert = jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: mockCreatedEvents, error: null })
        });

        mockClient.from.mockReturnValue({
          insert: mockInsert
        } as any);

        const result = await repository.logEventsBatch(events);

        expect(mockInsert).toHaveBeenCalledWith(events);
        expect(result).toEqual(mockCreatedEvents);
      });

      it('should return empty array for empty input', async () => {
        const result = await repository.logEventsBatch([]);
        expect(result).toEqual([]);
      });
    });

    describe('cleanupOldEvents', () => {
      it('should delete events older than retention period', async () => {
        const mockDelete = jest.fn().mockReturnValue({
          lt: jest.fn().mockResolvedValue({ error: null, count: 5 })
        });

        mockClient.from.mockReturnValue({
          delete: mockDelete
        } as any);

        const result = await repository.cleanupOldEvents(30);

        expect(mockDelete).toHaveBeenCalledWith({ count: 'exact' });
        expect(result).toBe(5);
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw DatabaseError on query failure', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest.fn(),
        catch: jest.fn(),
      };
      // Make the final query awaitable with error
      mockQuery.then.mockImplementation((resolve: any) =>
        resolve({ data: null, error: { message: 'Database error' } })
      );

      mockClient.from.mockReturnValue(mockQuery as any);

      await expect(repository.getEventsByUser('user-1')).rejects.toThrow(DatabaseError);
    });

    it('should throw DatabaseError on RPC failure', async () => {
      mockClient.rpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } });

      await expect(repository.getEventCounts('login', 'hour')).rejects.toThrow(DatabaseError);
    });
  });
});