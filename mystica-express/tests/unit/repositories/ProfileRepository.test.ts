/**
 * ProfileRepository unit tests
 *
 * Comprehensive test coverage for ProfileRepository methods including:
 * - User account operations (CRUD, auth types)
 * - Currency management with atomic RPC operations
 * - Transaction logging and history
 * - Player progression with XP/level-ups
 * - Device token management for push notifications
 * - Derived stats calculation (vanity level, avg item level)
 * - Error handling and edge cases
 */

import { ProfileRepository } from '../../../src/repositories/ProfileRepository.js';
import { BusinessLogicError, ValidationError } from '../../../src/utils/errors.js';
import { createMockSupabaseClient } from '../../helpers/mockSupabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock data factories
const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00Z',
  last_login: null,
  vanity_level: 0,
  avg_item_level: null,
  gold_balance: 100, // deprecated field
  ...overrides,
});

const createMockCurrencyBalance = (overrides = {}) => ({
  user_id: 'user-123',
  currency_code: 'GOLD',
  balance: 1000,
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const createMockProgression = (overrides = {}) => ({
  user_id: 'user-123',
  xp: 250,
  level: 3,
  xp_to_next_level: 50,
  last_level_up_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const createMockDeviceToken = (overrides = {}) => ({
  id: 'token-123',
  user_id: 'user-123',
  platform: 'iOS',
  token: 'device-token-abc',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  last_seen_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('ProfileRepository', () => {
  let repository: ProfileRepository;
  let mockClient: SupabaseClient;

  beforeEach(() => {
    mockClient = createMockSupabaseClient() as any;
    repository = new ProfileRepository(mockClient);
  });

  describe('User Account Operations', () => {
    describe('findUserById', () => {
      it('should return user when found', async () => {
        const mockUser = createMockUser();
        (mockClient as any).from().select().eq().single.mockResolvedValue({
          data: mockUser,
          error: null
        });

        const result = await repository.findUserById('user-123');

        expect(result).toEqual(mockUser);
        expect(mockClient.from).toHaveBeenCalledWith('users');
      });

      it('should return null when user not found', async () => {
        (mockClient as any).from().select().eq().single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        const result = await repository.findUserById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('findUserByDeviceId', () => {
      it('should return user when device ID found', async () => {
        const mockUser = createMockUser();
        (mockClient as any).from().select().eq().eq().single.mockResolvedValue({
          data: mockUser,
          error: null
        });

        const result = await repository.findUserByDeviceId('device-123');

        expect(result).toEqual(mockUser);
        expect(mockClient.from).toHaveBeenCalledWith('users');
      });

      it('should return null when device ID not found', async () => {
        (mockClient as any).from().select().eq().eq().single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        const result = await repository.findUserByDeviceId('invalid-device');

        expect(result).toBeNull();
      });
    });

    describe('updateUser', () => {
      it('should update user data and ignore deprecated gold_balance', async () => {
        const mockUser = createMockUser({ last_login: '2024-01-02T00:00:00Z' });
        (mockClient as any).from().update().eq().select().single.mockResolvedValue({ data: mockUser, error: null });

        const updateData = {
          last_login: '2024-01-02T00:00:00Z',
          gold_balance: 500, // deprecated - should be ignored
        };

        const result = await repository.updateUser('user-123', updateData);

        expect(result).toEqual(mockUser);
      });
    });

    describe('findUserByDeviceToken', () => {
      it('should return user when device token found', async () => {
        const mockUser = createMockUser();
        const mockTokenData = { user_id: 'user-123', users: mockUser };
        (mockClient as any).from().select().eq().eq().single.mockResolvedValue({
          data: mockTokenData,
          error: null
        });

        const result = await repository.findUserByDeviceToken('device-token-abc');

        expect(result).toEqual(mockUser);
        expect(mockClient.from).toHaveBeenCalledWith('devicetokens');
      });

      it('should return null when device token not found', async () => {
        (mockClient as any).from().select().eq().eq().single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        const result = await repository.findUserByDeviceToken('invalid-token');

        expect(result).toBeNull();
      });
    });

    describe('findUserByEmail', () => {
      it('should return user when email found', async () => {
        const mockUser = createMockUser({ email: 'test@example.com' });
        (mockClient as any).from().select().eq().single.mockResolvedValue({
          data: mockUser,
          error: null
        });

        const result = await repository.findUserByEmail('test@example.com');

        expect(result).toEqual(mockUser);
      });

      it('should return null when email not found', async () => {
        (mockClient as any).from().select().eq().single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        const result = await repository.findUserByEmail('nonexistent@example.com');

        expect(result).toBeNull();
      });
    });

    describe('updateLastLogin', () => {
      it('should update last login timestamp', async () => {
        const mockUser = createMockUser({ last_login: expect.any(String) });
        (mockClient as any).from().update().eq().select().single.mockResolvedValue({
          data: mockUser,
          error: null
        });

        await repository.updateLastLogin('user-123');

        expect(mockClient.from).toHaveBeenCalledWith('users');
      });
    });

    describe('createAnonymousUser', () => {
      it('should create anonymous user with device ID', async () => {
        const mockUser = createMockUser({
          id: 'user-123',
          device_id: 'device-abc',
          account_type: 'anonymous',
          is_anonymous: true,
          email: null
        });
        (mockClient as any).from().insert().select().single.mockResolvedValue({
          data: mockUser,
          error: null
        });

        const result = await repository.createAnonymousUser('user-123', 'device-abc');

        expect(result).toEqual(mockUser);
        expect(mockClient.from).toHaveBeenCalledWith('users');
      });

      it('should handle constraint violations gracefully', async () => {
        (mockClient as any).from().insert().select().single.mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint' }
        });

        await expect(
          repository.createAnonymousUser('user-123', 'device-abc')
        ).rejects.toThrow();
      });
    });

    describe('createEmailUser', () => {
      it('should create email user profile', async () => {
        const mockUser = createMockUser({
          id: 'user-123',
          email: 'test@example.com',
          account_type: 'email',
          is_anonymous: false,
          device_id: null
        });
        (mockClient as any).from().insert().select().single.mockResolvedValue({
          data: mockUser,
          error: null
        });

        const result = await repository.createEmailUser('user-123', 'test@example.com');

        expect(result).toEqual(mockUser);
        expect(mockClient.from).toHaveBeenCalledWith('users');
      });
    });
  });

  describe('Currency Management', () => {
    describe('getCurrencyBalance', () => {
      it('should return balance when found', async () => {
        const mockBalance = createMockCurrencyBalance({ balance: 1500 });
        (mockClient as any).from().select().eq().eq().single.mockResolvedValue({ data: mockBalance, error: null });

        const result = await repository.getCurrencyBalance('user-123', 'GOLD');

        expect(result).toBe(1500);
        expect(mockClient.from).toHaveBeenCalledWith('usercurrencybalances');
      });

      it('should return 0 when balance not found', async () => {
        (mockClient as any).from().select().eq().eq().single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        const result = await repository.getCurrencyBalance('user-123', 'GEMS');

        expect(result).toBe(0);
      });
    });

    describe('deductCurrency', () => {
      it('should deduct currency successfully using RPC', async () => {
        const mockResponse = {
          success: true,
          data: {
            previous_balance: 1000,
            new_balance: 750,
            transaction_id: 'tx-123'
          }
        };
        (mockClient as any).rpc.mockResolvedValue({
          data: mockResponse,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK'
        });

        const result = await repository.deductCurrency('user-123', 'GOLD', 250, 'item_upgrade', 'item-456');

        expect(result).toBe(750);
        expect(mockClient.rpc).toHaveBeenCalledWith('deduct_currency_with_logging', {
          p_user_id: 'user-123',
          p_currency_code: 'GOLD',
          p_amount: 250,
          p_source_type: 'item_upgrade',
          p_source_id: 'item-456',
          p_metadata: {},
        });
      });

      it('should throw BusinessLogicError for insufficient funds', async () => {
        const mockResponse = {
          success: false,
          error_code: 'INSUFFICIENT_FUNDS',
          message: 'Not enough GOLD (have: 100, need: 250)'
        };
        (mockClient as any).rpc.mockResolvedValue({
          data: mockResponse,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK'
        });

        await expect(
          repository.deductCurrency('user-123', 'GOLD', 250)
        ).rejects.toThrow(BusinessLogicError);
      });

      it('should throw ValidationError for invalid amount', async () => {
        await expect(
          repository.deductCurrency('user-123', 'GOLD', -50)
        ).rejects.toThrow(ValidationError);

        await expect(
          repository.deductCurrency('user-123', 'GOLD', 0)
        ).rejects.toThrow(ValidationError);
      });
    });

    describe('addCurrency', () => {
      it('should add currency successfully using RPC', async () => {
        const mockResponse = {
          success: true,
          data: {
            previous_balance: 1000,
            new_balance: 1250,
            transaction_id: 'tx-124'
          }
        };
        (mockClient as any).rpc.mockResolvedValue({
          data: mockResponse,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK'
        });

        const result = await repository.addCurrency('user-123', 'GOLD', 250, 'combat_victory', 'combat-789');

        expect(result).toBe(1250);
        expect(mockClient.rpc).toHaveBeenCalledWith('add_currency_with_logging', {
          p_user_id: 'user-123',
          p_currency_code: 'GOLD',
          p_amount: 250,
          p_source_type: 'combat_victory',
          p_source_id: 'combat-789',
          p_metadata: {},
        });
      });

      it('should throw ValidationError for invalid amount', async () => {
        await expect(
          repository.addCurrency('user-123', 'GOLD', -50)
        ).rejects.toThrow(ValidationError);

        await expect(
          repository.addCurrency('user-123', 'GOLD', 0)
        ).rejects.toThrow(ValidationError);
      });

      it('should throw BusinessLogicError on RPC failure', async () => {
        const mockResponse = {
          success: false,
          error_code: 'UNKNOWN_ERROR',
          message: 'Database error occurred'
        };
        (mockClient as any).rpc.mockResolvedValue({
          data: mockResponse,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK'
        });

        await expect(
          repository.addCurrency('user-123', 'GOLD', 250)
        ).rejects.toThrow(BusinessLogicError);
      });
    });

    describe('getAllCurrencyBalances', () => {
      it('should return all currency balances', async () => {
        const mockBalances = [
          { currency_code: 'GOLD', balance: 1500 },
          { currency_code: 'GEMS', balance: 50 }
        ];
        (mockClient as any).from().select().eq.mockResolvedValue({
          data: mockBalances,
          error: null
        });

        const result = await repository.getAllCurrencyBalances('user-123');

        expect(result).toEqual({ GOLD: 1500, GEMS: 50 });
        expect(mockClient.from).toHaveBeenCalledWith('usercurrencybalances');
      });

      it('should return default balances when no records found', async () => {
        (mockClient as any).from().select().eq.mockResolvedValue({
          data: [],
          error: null
        });

        const result = await repository.getAllCurrencyBalances('user-123');

        expect(result).toEqual({ GOLD: 0, GEMS: 0 });
      });
    });

    describe('deductCurrencyWithLogging', () => {
      it('should return full RPC response for EconomyService', async () => {
        const mockResponse = {
          success: true,
          data: {
            previous_balance: 1000,
            new_balance: 750,
            transaction_id: 'tx-125'
          }
        };
        (mockClient as any).rpc.mockResolvedValue({
          data: mockResponse,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK'
        });

        const result = await repository.deductCurrencyWithLogging(
          'user-123', 'GOLD', 250, 'item_upgrade', 'item-456', { reason: 'level up' }
        );

        expect(result).toEqual(mockResponse);
        expect(mockClient.rpc).toHaveBeenCalledWith('deduct_currency_with_logging', {
          p_user_id: 'user-123',
          p_currency_code: 'GOLD',
          p_amount: 250,
          p_source_type: 'item_upgrade',
          p_source_id: 'item-456',
          p_metadata: { reason: 'level up' },
        });
      });
    });

    describe('addCurrencyWithLogging', () => {
      it('should return full RPC response for EconomyService', async () => {
        const mockResponse = {
          success: true,
          data: {
            previous_balance: 1000,
            new_balance: 1250,
            transaction_id: 'tx-126'
          }
        };
        (mockClient as any).rpc.mockResolvedValue({
          data: mockResponse,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK'
        });

        const result = await repository.addCurrencyWithLogging(
          'user-123', 'GOLD', 250, 'combat_victory', 'combat-789', { enemy: 'orc' }
        );

        expect(result).toEqual(mockResponse);
        expect(mockClient.rpc).toHaveBeenCalledWith('add_currency_with_logging', {
          p_user_id: 'user-123',
          p_currency_code: 'GOLD',
          p_amount: 250,
          p_source_type: 'combat_victory',
          p_source_id: 'combat-789',
          p_metadata: { enemy: 'orc' },
        });
      });
    });
  });

  describe('Player Progression', () => {
    describe('addXP', () => {
      it('should add XP without level up', async () => {
        const mockResponse = {
          success: true,
          data: {
            previous_xp: 250,
            previous_level: 3,
            new_xp: 300,
            new_level: 3,
            xp_to_next_level: 0,
            leveled_up: false,
            levels_gained: 0
          }
        };
        (mockClient as any).rpc.mockResolvedValue({
          data: mockResponse,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK'
        });

        const result = await repository.addXP('user-123', 50);

        expect(result).toEqual({
          newXP: 300,
          newLevel: 3,
          leveledUp: false
        });
        expect(mockClient.rpc).toHaveBeenCalledWith('add_xp_and_level_up', {
          p_user_id: 'user-123',
          p_xp_amount: 50,
        });
      });

      it('should add XP with level up', async () => {
        const mockResponse = {
          success: true,
          data: {
            previous_xp: 290,
            previous_level: 3,
            new_xp: 350,
            new_level: 4,
            xp_to_next_level: 50,
            leveled_up: true,
            levels_gained: 1
          }
        };
        (mockClient as any).rpc.mockResolvedValue({
          data: mockResponse,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK'
        });

        const result = await repository.addXP('user-123', 60);

        expect(result).toEqual({
          newXP: 350,
          newLevel: 4,
          leveledUp: true
        });
      });

      it('should throw ValidationError for invalid XP amount', async () => {
        await expect(
          repository.addXP('user-123', -10)
        ).rejects.toThrow(ValidationError);

        await expect(
          repository.addXP('user-123', 0)
        ).rejects.toThrow(ValidationError);
      });

      it('should throw BusinessLogicError on RPC failure', async () => {
        const mockResponse = {
          success: false,
          error_code: 'PROGRESSION_ERROR',
          message: 'Failed to update progression'
        };
        (mockClient as any).rpc.mockResolvedValue({
          data: mockResponse,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK'
        });

        await expect(
          repository.addXP('user-123', 50)
        ).rejects.toThrow(BusinessLogicError);
      });
    });

    describe('getProgression', () => {
      it('should return progression data when found', async () => {
        const mockProgression = createMockProgression();
        (mockClient as any).from().select().eq().single.mockResolvedValue({
          data: mockProgression,
          error: null
        });

        const result = await repository.getProgression('user-123');

        expect(result).toEqual(mockProgression);
        expect(mockClient.from).toHaveBeenCalledWith('playerprogression');
      });

      it('should return null when progression not found', async () => {
        (mockClient as any).from().select().eq().single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        const result = await repository.getProgression('user-123');

        expect(result).toBeNull();
      });
    });

    describe('updateProgression', () => {
      it('should update progression data', async () => {
        (mockClient as any).from().upsert.mockResolvedValue({ error: null });

        const updateData = { xp: 350, level: 4, xp_to_next_level: 50 };
        await repository.updateProgression('user-123', updateData);

        expect(mockClient.from).toHaveBeenCalledWith('playerprogression');
      });
    });
  });

  describe('Transaction Logging', () => {
    describe('logTransaction', () => {
      it('should log economy transaction', async () => {
        (mockClient as any).from().insert.mockResolvedValue({ error: null });

        const transaction = {
          user_id: 'user-123',
          transaction_type: 'source' as const,
          currency: 'GOLD' as const,
          amount: 250,
          balance_after: 1250,
          source_type: 'combat_victory',
          source_id: 'combat-789',
          metadata: { enemy: 'orc' }
        };

        await repository.logTransaction(transaction);

        expect(mockClient.from).toHaveBeenCalledWith('economytransactions');
      });
    });

    describe('getTransactionHistory', () => {
      it('should return transaction history with default limit', async () => {
        const mockTransactions = [
          {
            id: 'tx-1',
            user_id: 'user-123',
            transaction_type: 'add',
            currency: 'GOLD',
            amount: 250,
            balance_after: 1250,
            source_type: 'combat_victory',
            created_at: '2024-01-01T00:00:00Z'
          }
        ];
        (mockClient as any).from().select().eq().order().limit.mockResolvedValue({
          data: mockTransactions,
          error: null
        });

        const result = await repository.getTransactionHistory('user-123');

        expect(result).toEqual(mockTransactions);
        expect(mockClient.from).toHaveBeenCalledWith('economytransactions');
      });

      it('should return transaction history with custom limit', async () => {
        const mockTransactions: any[] = [];
        (mockClient as any).from().select().eq().order().limit.mockResolvedValue({
          data: mockTransactions,
          error: null
        });

        const result = await repository.getTransactionHistory('user-123', 10);

        expect(result).toEqual(mockTransactions);
      });
    });

    describe('getTransactionsByType', () => {
      it('should return transactions by source type', async () => {
        const mockTransactions = [
          {
            id: 'tx-1',
            user_id: 'user-123',
            transaction_type: 'add',
            currency: 'GOLD',
            amount: 250,
            source_type: 'combat_victory',
            created_at: '2024-01-01T00:00:00Z'
          }
        ];
        (mockClient as any).from().select().eq().eq().order.mockResolvedValue({
          data: mockTransactions,
          error: null
        });

        const result = await repository.getTransactionsByType('user-123', 'combat_victory');

        expect(result).toEqual(mockTransactions);
        expect(mockClient.from).toHaveBeenCalledWith('economytransactions');
      });
    });
  });

  describe('Device Token Management', () => {
    describe('registerDeviceToken', () => {
      it('should register new device token', async () => {
        (mockClient as any).from().upsert.mockResolvedValue({ error: null });

        await repository.registerDeviceToken('user-123', 'iOS', 'new-device-token');

        expect(mockClient.from).toHaveBeenCalledWith('devicetokens');
      });

      it('should handle duplicate token constraint gracefully', async () => {
        (mockClient as any).from().upsert.mockRejectedValue({
          message: 'duplicate key value violates unique constraint'
        });
        (mockClient as any).from().update().eq.mockResolvedValue({ error: null });

        await repository.registerDeviceToken('user-123', 'iOS', 'duplicate-token');

        expect(mockClient.from).toHaveBeenCalledWith('devicetokens');
      });
    });

    describe('getActiveDeviceTokens', () => {
      it('should return active device tokens', async () => {
        const mockTokens = [createMockDeviceToken({ is_active: true })];
        (mockClient as any).from().select().order().eq.mockResolvedValue({
          data: mockTokens,
          error: null
        });

        const result = await repository.getActiveDeviceTokens('user-123');

        expect(result).toEqual(mockTokens);
        expect(mockClient.from).toHaveBeenCalledWith('devicetokens');
      });

      it('should filter out inactive tokens', async () => {
        const mockTokens = [
          createMockDeviceToken({ is_active: true }),
          createMockDeviceToken({ is_active: false })
        ];
        (mockClient as any).from().select().order().eq.mockResolvedValue({
          data: mockTokens,
          error: null
        });

        const result = await repository.getActiveDeviceTokens('user-123');

        expect(result).toHaveLength(1);
        expect(result[0].is_active).toBe(true);
      });
    });

    describe('deactivateDeviceToken', () => {
      it('should deactivate device token', async () => {
        (mockClient as any).from().update().eq.mockResolvedValue({ error: null });

        await repository.deactivateDeviceToken('device-token-abc');

        expect(mockClient.from).toHaveBeenCalledWith('devicetokens');
      });
    });
  });

  describe('Derived Stats', () => {
    describe('updateVanityLevel', () => {
      it('should calculate and update vanity level', async () => {
        const mockEquipmentData = [
          { items: { level: 10 } },
          { items: { level: 15 } },
          { items: { level: 8 } }
        ];

        // Mock both queries - equipment query first, then update query
        const mockQueryBuilder = {
          select: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnThis(),
        };

        // First call - equipment query
        mockQueryBuilder.eq.mockResolvedValueOnce({ data: mockEquipmentData, error: null });

        // Second call - update query
        const mockUpdatedUser = createMockUser({ vanity_level: 33 });
        mockQueryBuilder.single.mockResolvedValueOnce({ data: mockUpdatedUser, error: null });

        mockClient.from = jest.fn().mockReturnValue(mockQueryBuilder);

        const result = await repository.updateVanityLevel('user-123');

        expect(result).toBe(33);
        expect(mockClient.from).toHaveBeenCalledWith('userequipment');
      });

      it('should return 0 for user with no equipment', async () => {
        const mockQueryBuilder = {
          select: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnThis(),
        };

        // Equipment query returns empty array
        mockQueryBuilder.eq.mockResolvedValueOnce({ data: [], error: null });

        // Update query
        const mockUpdatedUser = createMockUser({ vanity_level: 0 });
        mockQueryBuilder.single.mockResolvedValueOnce({ data: mockUpdatedUser, error: null });

        mockClient.from = jest.fn().mockReturnValue(mockQueryBuilder);

        const result = await repository.updateVanityLevel('user-123');

        expect(result).toBe(0);
      });
    });

    describe('updateAvgItemLevel', () => {
      it('should calculate and update average item level', async () => {
        const mockEquipmentData = [
          { items: { level: 10 } },
          { items: { level: 20 } },
          { items: { level: 15 } }
        ];

        const mockQueryBuilder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnThis(),
        };

        // Equipment query
        mockQueryBuilder.not.mockResolvedValueOnce({ data: mockEquipmentData, error: null });

        // Update query
        const mockUpdatedUser = createMockUser({ avg_item_level: 15 });
        mockQueryBuilder.single.mockResolvedValueOnce({ data: mockUpdatedUser, error: null });

        mockClient.from = jest.fn().mockReturnValue(mockQueryBuilder);

        const result = await repository.updateAvgItemLevel('user-123');

        expect(result).toBe(15);
        expect(mockClient.from).toHaveBeenCalledWith('userequipment');
      });

      it('should return 0 for user with no equipment', async () => {
        const mockQueryBuilder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnThis(),
        };

        // Equipment query returns empty array
        mockQueryBuilder.not.mockResolvedValueOnce({ data: [], error: null });

        // Update query
        const mockUpdatedUser = createMockUser({ avg_item_level: 0 });
        mockQueryBuilder.single.mockResolvedValueOnce({ data: mockUpdatedUser, error: null });

        mockClient.from = jest.fn().mockReturnValue(mockQueryBuilder);

        const result = await repository.updateAvgItemLevel('user-123');

        expect(result).toBe(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      (mockClient as any).from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: '23503', message: 'foreign key constraint violation' }
      });

      await expect(
        repository.findUserById('user-123')
      ).rejects.toThrow();
    });

    it('should handle RPC errors gracefully', async () => {
      (mockClient as any).rpc.mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'RPC function not found' },
        count: null,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(
        repository.addXP('user-123', 50)
      ).rejects.toThrow();
    });
  });
});