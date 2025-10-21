/**
 * ProfileRepository unit tests
 *
 * Tests all ProfileRepository methods including:
 * - User account operations
 * - Currency management with atomic operations
 * - Transaction logging
 * - Player progression with XP/level-ups
 * - Device token management
 * - Derived stats calculation
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
      it('should return user when device token found', async () => {
        const mockUser = createMockUser();
        (mockClient as any).from().select().eq().eq().single.mockResolvedValue({
          data: { user_id: 'user-123', users: mockUser },
          error: null
        });

        const result = await repository.findUserByDeviceId('device-token-abc');

        expect(result).toEqual(mockUser);
        expect(mockClient.from).toHaveBeenCalledWith('devicetokens');
      });

      it('should return null when device token not found', async () => {
        (mockClient as any).from().select().eq().eq().single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        const result = await repository.findUserByDeviceId('invalid-token');

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

      it('should throw ValidationError for invalid XP amount', async () => {
        await expect(
          repository.addXP('user-123', -10)
        ).rejects.toThrow(ValidationError);
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
    });

    describe('getActiveDeviceTokens', () => {
      it('should return active device tokens', async () => {
        const mockTokens = [createMockDeviceToken()];
        (mockClient as any).from().select().order().eq.mockResolvedValue({ data: mockTokens, error: null });

        const result = await repository.getActiveDeviceTokens('user-123');

        expect(result).toEqual(mockTokens);
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
    });
  });
});