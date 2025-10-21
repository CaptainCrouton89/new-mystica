/**
 * Unit Tests: EconomyService
 *
 * Comprehensive test suite for EconomyService following the specification.
 * Tests all methods, error cases, and transaction type validation.
 */

import { EconomyService } from '../../../src/services/EconomyService.js';
import {
  ValidationError,
  DatabaseError,
  InsufficientFundsError
} from '../../../src/utils/errors.js';
import { ProfileRepository } from '../../../src/repositories/ProfileRepository.js';

// Mock ProfileRepository
jest.mock('../../../src/repositories/ProfileRepository.js');

describe('EconomyService', () => {
  let economyService: EconomyService;
  let mockProfileRepository: jest.Mocked<ProfileRepository>;

  const userId = 'test-user-id';

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create service instance
    economyService = new EconomyService();

    // Get the mocked repository instance
    mockProfileRepository = (economyService as any).profileRepository;
  });

  describe('addCurrency()', () => {
    const validRpcResponse = {
      success: true,
      data: {
        previous_balance: 1000,
        new_balance: 1500,
        transaction_id: 'txn-123'
      }
    };

    it('should successfully add currency with valid parameters', async () => {
      mockProfileRepository.addCurrencyWithLogging.mockResolvedValue(validRpcResponse);

      const result = await economyService.addCurrency(
        userId,
        'GOLD',
        500,
        'combat_victory',
        'enemy-123',
        { location_id: 'loc-456' }
      );

      expect(mockProfileRepository.addCurrencyWithLogging).toHaveBeenCalledWith(
        userId,
        'GOLD',
        500,
        'combat_victory',
        'enemy-123',
        { location_id: 'loc-456' }
      );

      expect(result).toEqual({
        success: true,
        previousBalance: 1000,
        newBalance: 1500,
        transactionId: 'txn-123',
        currency: 'GOLD',
        amount: 500
      });
    });

    it('should handle missing optional parameters', async () => {
      mockProfileRepository.addCurrencyWithLogging.mockResolvedValue(validRpcResponse);

      await economyService.addCurrency(userId, 'GEMS', 100, 'daily_quest');

      expect(mockProfileRepository.addCurrencyWithLogging).toHaveBeenCalledWith(
        userId,
        'GEMS',
        100,
        'daily_quest',
        null,
        {}
      );
    });

    it('should throw ValidationError for negative amount', async () => {
      await expect(
        economyService.addCurrency(userId, 'GOLD', -100, 'combat_victory')
      ).rejects.toThrow(ValidationError);

      await expect(
        economyService.addCurrency(userId, 'GOLD', -100, 'combat_victory')
      ).rejects.toThrow('Amount must be positive');
    });

    it('should throw ValidationError for zero amount', async () => {
      await expect(
        economyService.addCurrency(userId, 'GOLD', 0, 'combat_victory')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid source type', async () => {
      await expect(
        economyService.addCurrency(userId, 'GOLD', 100, 'invalid_source' as any)
      ).rejects.toThrow(ValidationError);

      await expect(
        economyService.addCurrency(userId, 'GOLD', 100, 'invalid_source' as any)
      ).rejects.toThrow('Invalid source type: invalid_source');
    });

    it('should validate all source types', async () => {
      const validSourceTypes = [
        'combat_victory',
        'daily_quest',
        'achievement',
        'iap',
        'admin',
        'profile_init'
      ];

      mockProfileRepository.addCurrencyWithLogging.mockResolvedValue(validRpcResponse);

      for (const sourceType of validSourceTypes) {
        await expect(
          economyService.addCurrency(userId, 'GOLD', 100, sourceType as any)
        ).resolves.toBeDefined();
      }
    });

    it('should throw DatabaseError when RPC returns failure', async () => {
      mockProfileRepository.addCurrencyWithLogging.mockResolvedValue({
        success: false,
        message: 'Database constraint violation'
      });

      await expect(
        economyService.addCurrency(userId, 'GOLD', 100, 'combat_victory')
      ).rejects.toThrow(DatabaseError);

      await expect(
        economyService.addCurrency(userId, 'GOLD', 100, 'combat_victory')
      ).rejects.toThrow('Currency addition failed: Database constraint violation');
    });

    it('should throw DatabaseError when repository throws', async () => {
      mockProfileRepository.addCurrencyWithLogging.mockRejectedValue(
        new Error('Connection lost')
      );

      await expect(
        economyService.addCurrency(userId, 'GOLD', 100, 'combat_victory')
      ).rejects.toThrow(DatabaseError);

      await expect(
        economyService.addCurrency(userId, 'GOLD', 100, 'combat_victory')
      ).rejects.toThrow('Failed to add GOLD: Connection lost');
    });
  });

  describe('deductCurrency()', () => {
    const validRpcResponse = {
      success: true,
      data: {
        previous_balance: 1000,
        new_balance: 500,
        transaction_id: 'txn-456'
      }
    };

    it('should successfully deduct currency with valid parameters', async () => {
      mockProfileRepository.deductCurrencyWithLogging.mockResolvedValue(validRpcResponse);

      const result = await economyService.deductCurrency(
        userId,
        'GOLD',
        500,
        'item_upgrade',
        'item-123',
        { from_level: 1, to_level: 2 }
      );

      expect(mockProfileRepository.deductCurrencyWithLogging).toHaveBeenCalledWith(
        userId,
        'GOLD',
        500,
        'item_upgrade',
        'item-123',
        { from_level: 1, to_level: 2 }
      );

      expect(result).toEqual({
        success: true,
        previousBalance: 1000,
        newBalance: 500,
        transactionId: 'txn-456',
        currency: 'GOLD',
        amount: -500 // Negative for deduction
      });
    });

    it('should handle missing optional parameters', async () => {
      mockProfileRepository.deductCurrencyWithLogging.mockResolvedValue(validRpcResponse);

      await economyService.deductCurrency(userId, 'GOLD', 250, 'shop_purchase');

      expect(mockProfileRepository.deductCurrencyWithLogging).toHaveBeenCalledWith(
        userId,
        'GOLD',
        250,
        'shop_purchase',
        null,
        {}
      );
    });

    it('should throw ValidationError for invalid amount', async () => {
      await expect(
        economyService.deductCurrency(userId, 'GOLD', -100, 'item_upgrade')
      ).rejects.toThrow(ValidationError);

      await expect(
        economyService.deductCurrency(userId, 'GOLD', 0, 'item_upgrade')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid sink type', async () => {
      await expect(
        economyService.deductCurrency(userId, 'GOLD', 100, 'invalid_sink' as any)
      ).rejects.toThrow(ValidationError);

      await expect(
        economyService.deductCurrency(userId, 'GOLD', 100, 'invalid_sink' as any)
      ).rejects.toThrow('Invalid sink type: invalid_sink');
    });

    it('should validate all sink types', async () => {
      const validSinkTypes = [
        'item_upgrade',
        'material_replacement',
        'shop_purchase',
        'loadout_slot_unlock'
      ];

      mockProfileRepository.deductCurrencyWithLogging.mockResolvedValue(validRpcResponse);

      for (const sinkType of validSinkTypes) {
        await expect(
          economyService.deductCurrency(userId, 'GOLD', 100, sinkType as any)
        ).resolves.toBeDefined();
      }
    });

    it('should throw InsufficientFundsError when RPC returns INSUFFICIENT_FUNDS', async () => {
      mockProfileRepository.deductCurrencyWithLogging.mockResolvedValue({
        success: false,
        error_code: 'INSUFFICIENT_FUNDS',
        message: 'Not enough GOLD (have: 100, need: 500)'
      });

      await expect(
        economyService.deductCurrency(userId, 'GOLD', 500, 'item_upgrade')
      ).rejects.toThrow(InsufficientFundsError);

      await expect(
        economyService.deductCurrency(userId, 'GOLD', 500, 'item_upgrade')
      ).rejects.toThrow('Not enough GOLD. Required: 500, Available: 100');
    });

    it('should throw DatabaseError for other RPC failures', async () => {
      mockProfileRepository.deductCurrencyWithLogging.mockResolvedValue({
        success: false,
        message: 'Database lock timeout'
      });

      await expect(
        economyService.deductCurrency(userId, 'GOLD', 100, 'item_upgrade')
      ).rejects.toThrow(DatabaseError);

      await expect(
        economyService.deductCurrency(userId, 'GOLD', 100, 'item_upgrade')
      ).rejects.toThrow('Currency deduction failed: Database lock timeout');
    });
  });

  describe('getCurrencyBalance()', () => {
    it('should return current balance for existing user', async () => {
      mockProfileRepository.getCurrencyBalance.mockResolvedValue(1500);

      const balance = await economyService.getCurrencyBalance(userId, 'GOLD');

      expect(mockProfileRepository.getCurrencyBalance).toHaveBeenCalledWith(userId, 'GOLD');
      expect(balance).toBe(1500);
    });

    it('should return 0 for user with no balance record', async () => {
      mockProfileRepository.getCurrencyBalance.mockResolvedValue(null as any);

      const balance = await economyService.getCurrencyBalance(userId, 'GEMS');

      expect(balance).toBe(0);
    });

    it('should throw DatabaseError when repository throws', async () => {
      mockProfileRepository.getCurrencyBalance.mockRejectedValue(
        new Error('User not found')
      );

      await expect(
        economyService.getCurrencyBalance(userId, 'GOLD')
      ).rejects.toThrow(DatabaseError);

      await expect(
        economyService.getCurrencyBalance(userId, 'GOLD')
      ).rejects.toThrow('Failed to get GOLD balance: User not found');
    });
  });

  describe('getAllBalances()', () => {
    it('should return all currency balances', async () => {
      mockProfileRepository.getAllCurrencyBalances.mockResolvedValue({
        GOLD: 1500,
        GEMS: 250
      });

      const balances = await economyService.getAllBalances(userId);

      expect(mockProfileRepository.getAllCurrencyBalances).toHaveBeenCalledWith(userId);
      expect(balances).toEqual({
        GOLD: 1500,
        GEMS: 250
      });
    });

    it('should return 0 for missing currency balances', async () => {
      mockProfileRepository.getAllCurrencyBalances.mockResolvedValue({
        GOLD: 500,
        GEMS: null as any
      });

      const balances = await economyService.getAllBalances(userId);

      expect(balances).toEqual({
        GOLD: 500,
        GEMS: 0
      });
    });

    it('should throw DatabaseError when repository throws', async () => {
      mockProfileRepository.getAllCurrencyBalances.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        economyService.getAllBalances(userId)
      ).rejects.toThrow(DatabaseError);

      await expect(
        economyService.getAllBalances(userId)
      ).rejects.toThrow('Failed to get currency balances: Database error');
    });
  });

  describe('validateSufficientFunds()', () => {
    it('should return true when user has sufficient funds', async () => {
      mockProfileRepository.getCurrencyBalance.mockResolvedValue(1000);

      const result = await economyService.validateSufficientFunds(userId, 'GOLD', 500);

      expect(result).toBe(true);
    });

    it('should return true when user has exact amount', async () => {
      mockProfileRepository.getCurrencyBalance.mockResolvedValue(500);

      const result = await economyService.validateSufficientFunds(userId, 'GOLD', 500);

      expect(result).toBe(true);
    });

    it('should return false when user has insufficient funds', async () => {
      mockProfileRepository.getCurrencyBalance.mockResolvedValue(250);

      const result = await economyService.validateSufficientFunds(userId, 'GOLD', 500);

      expect(result).toBe(false);
    });

    it('should return false for users with no balance', async () => {
      mockProfileRepository.getCurrencyBalance.mockResolvedValue(0);

      const result = await economyService.validateSufficientFunds(userId, 'GOLD', 100);

      expect(result).toBe(false);
    });
  });

  describe('getAffordabilityCheck()', () => {
    it('should return detailed affordability for sufficient funds', async () => {
      mockProfileRepository.getCurrencyBalance.mockResolvedValue(1500);

      const result = await economyService.getAffordabilityCheck(userId, 'GOLD', 1000);

      expect(result).toEqual({
        canAfford: true,
        currentBalance: 1500,
        requiredAmount: 1000,
        shortfall: 0
      });
    });

    it('should return detailed affordability for insufficient funds', async () => {
      mockProfileRepository.getCurrencyBalance.mockResolvedValue(300);

      const result = await economyService.getAffordabilityCheck(userId, 'GOLD', 500);

      expect(result).toEqual({
        canAfford: false,
        currentBalance: 300,
        requiredAmount: 500,
        shortfall: 200
      });
    });

    it('should handle exact balance match', async () => {
      mockProfileRepository.getCurrencyBalance.mockResolvedValue(750);

      const result = await economyService.getAffordabilityCheck(userId, 'GOLD', 750);

      expect(result).toEqual({
        canAfford: true,
        currentBalance: 750,
        requiredAmount: 750,
        shortfall: 0
      });
    });

    it('should handle zero balance', async () => {
      mockProfileRepository.getCurrencyBalance.mockResolvedValue(0);

      const result = await economyService.getAffordabilityCheck(userId, 'GEMS', 100);

      expect(result).toEqual({
        canAfford: false,
        currentBalance: 0,
        requiredAmount: 100,
        shortfall: 100
      });
    });
  });

  describe('Helper Methods', () => {
    describe('extractCurrentBalance()', () => {
      it('should extract balance from RPC error message', async () => {
        mockProfileRepository.deductCurrencyWithLogging.mockResolvedValue({
          success: false,
          error_code: 'INSUFFICIENT_FUNDS',
          message: 'Not enough GOLD (have: 250, need: 500)'
        });

        await expect(
          economyService.deductCurrency(userId, 'GOLD', 500, 'item_upgrade')
        ).rejects.toThrow('Not enough GOLD. Required: 500, Available: 250');
      });

      it('should handle malformed error messages', async () => {
        mockProfileRepository.deductCurrencyWithLogging.mockResolvedValue({
          success: false,
          error_code: 'INSUFFICIENT_FUNDS',
          message: 'Balance check failed'
        });

        await expect(
          economyService.deductCurrency(userId, 'GOLD', 500, 'item_upgrade')
        ).rejects.toThrow('Not enough GOLD. Required: 500, Available: 0');
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle combat victory reward flow', async () => {
      const goldReward = 150;
      mockProfileRepository.addCurrencyWithLogging.mockResolvedValue({
        success: true,
        data: {
          previous_balance: 500,
          new_balance: 650,
          transaction_id: 'combat-txn-123'
        }
      });

      const result = await economyService.addCurrency(
        userId,
        'GOLD',
        goldReward,
        'combat_victory',
        'enemy-orc-warrior',
        {
          enemy_type: 'orc_warrior',
          location_id: 'forest-clearing-1',
          difficulty_multiplier: 1.2
        }
      );

      expect(result.success).toBe(true);
      expect(result.amount).toBe(150);
      expect(result.newBalance).toBe(650);
    });

    it('should handle item upgrade cost flow', async () => {
      // First check affordability
      mockProfileRepository.getCurrencyBalance.mockResolvedValue(1000);

      const affordability = await economyService.getAffordabilityCheck(userId, 'GOLD', 500);
      expect(affordability.canAfford).toBe(true);

      // Then deduct payment
      mockProfileRepository.deductCurrencyWithLogging.mockResolvedValue({
        success: true,
        data: {
          previous_balance: 1000,
          new_balance: 500,
          transaction_id: 'upgrade-txn-456'
        }
      });

      const result = await economyService.deductCurrency(
        userId,
        'GOLD',
        500,
        'item_upgrade',
        'sword-legendary-123',
        {
          from_level: 5,
          to_level: 6
        }
      );

      expect(result.success).toBe(true);
      expect(result.amount).toBe(-500);
      expect(result.newBalance).toBe(500);
    });

    it('should handle insufficient funds for material replacement', async () => {
      mockProfileRepository.getCurrencyBalance.mockResolvedValue(50);

      const affordability = await economyService.getAffordabilityCheck(userId, 'GOLD', 200);
      expect(affordability.canAfford).toBe(false);
      expect(affordability.shortfall).toBe(150);

      // Attempting deduction should fail
      mockProfileRepository.deductCurrencyWithLogging.mockResolvedValue({
        success: false,
        error_code: 'INSUFFICIENT_FUNDS',
        message: 'Not enough GOLD (have: 50, need: 200)'
      });

      await expect(
        economyService.deductCurrency(userId, 'GOLD', 200, 'material_replacement')
      ).rejects.toThrow(InsufficientFundsError);
    });
  });
});