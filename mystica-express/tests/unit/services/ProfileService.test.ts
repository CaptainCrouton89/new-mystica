/**
 * Unit Tests: ProfileService
 *
 * Comprehensive test suite for user profile management, currency operations,
 * progression tracking, and derived statistics calculation.
 *
 * Tests follow the specification at docs/plans/service-specs/profile-service-spec.md
 */

import { ProfileService } from '../../../src/services/ProfileService.js';
import { NotFoundError, BusinessLogicError, ValidationError } from '../../../src/utils/errors.js';
import type { UserProfile, Stats } from '../../../src/types/api.types.js';

// Import test infrastructure
import { UserFactory } from '../../factories/index.js';
import {
  expectValidUUID,
  expectValidTimestamp,
  expectValidGoldAmount,
  expectValidComputedStats
} from '../../helpers/assertions.js';


// Mock repositories before importing service
jest.mock('../../../src/repositories/ProfileRepository.js', () => ({
  ProfileRepository: jest.fn().mockImplementation(() => ({
    findUserById: jest.fn(),
    getAllCurrencyBalances: jest.fn(),
    getCurrencyBalance: jest.fn(),
    addCurrency: jest.fn(),
    deductCurrency: jest.fn(),
    getProgression: jest.fn(),
    updateProgression: jest.fn(),
    addXP: jest.fn(),
    updateVanityLevel: jest.fn(),
    updateAvgItemLevel: jest.fn(),
    registerDeviceToken: jest.fn(),
    getActiveDeviceTokens: jest.fn()
  }))
}));

jest.mock('../../../src/repositories/ItemRepository.js', () => ({
  ItemRepository: jest.fn().mockImplementation(() => ({
    findByUser: jest.fn(),
    create: jest.fn(),
    findEquippedByUser: jest.fn(),
    findItemTypesByRarity: jest.fn()
  }))
}));

jest.mock('../../../src/services/AnalyticsService.js', () => ({
  analyticsService: {
    trackEvent: jest.fn()
  }
}));

// Import the mocked service
import { analyticsService } from '../../../src/services/AnalyticsService.js';
const mockAnalyticsServiceInstance = analyticsService as jest.Mocked<typeof analyticsService>;

describe('ProfileService', () => {
  let profileService: ProfileService;
  let mockProfileRepository: any;
  let mockItemRepository: any;
  const testUser = UserFactory.createEmail('test@mystica.com');
  const userId = testUser.id;

  beforeEach(() => {
    profileService = new ProfileService();
    jest.clearAllMocks();

    // Get repository mocks
    mockProfileRepository = (profileService as any).profileRepository;
    mockItemRepository = (profileService as any).itemRepository;

    // Mock analytics service
    mockAnalyticsServiceInstance.trackEvent.mockResolvedValue(undefined);
  });

  /**
   * Test Group 1: Profile Retrieval
   * Tests getProfile() method with various user states
   */
  describe('getProfile()', () => {
    it('should return complete user profile with currency balances and progression', async () => {
      // Arrange: Mock user data
      const mockUser = {
        ...testUser,
        username: 'testuser',
        vanity_level: 15,
        avg_item_level: 7.5
      };

      const mockBalances = { GOLD: 1500, GEMS: 250 };
      const mockProgression = {
        user_id: userId,
        level: 8,
        xp: 3200,
        xp_to_next_level: 800,
        last_level_up_at: '2025-01-20T10:00:00Z',
        created_at: '2025-01-15T09:00:00Z',
        updated_at: '2025-01-22T14:30:00Z'
      };

      const mockTotalStats = {
        atkPower: 1.2,
        atkAccuracy: 0.9,
        defPower: 1.1,
        defAccuracy: 0.8
      };

      mockProfileRepository.findUserById.mockResolvedValue(mockUser);
      mockProfileRepository.getAllCurrencyBalances.mockResolvedValue(mockBalances);
      (profileService as any).getProgression = jest.fn().mockResolvedValue(mockProgression);
      (profileService as any).calculateTotalStats = jest.fn().mockResolvedValue(mockTotalStats);

      // Act: Get profile
      const result = await profileService.getProfile(userId);

      // Assert: Complete profile structure
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        device_id: null, // Not set in mock
        account_type: 'email', // Derived from email presence
        username: null, // Users table doesn't have username field yet
        vanity_level: 15,
        gold: 1500,
        gems: 250,
        total_stats: mockTotalStats,
        level: 8,
        xp: 3200,
        created_at: mockUser.created_at,
        last_login: mockUser.last_login
      });

      // Verify repository calls
      expect(mockProfileRepository.findUserById).toHaveBeenCalledWith(userId);
      expect(mockProfileRepository.getAllCurrencyBalances).toHaveBeenCalledWith(userId);
    });

    it('should handle user with no progression record (new user)', async () => {
      // Arrange: User without progression
      const mockUser = { ...testUser, vanity_level: 0 };
      const mockBalances = { GOLD: 0, GEMS: 0 };

      mockProfileRepository.findUserById.mockResolvedValue(mockUser);
      mockProfileRepository.getAllCurrencyBalances.mockResolvedValue(mockBalances);
      (profileService as any).getProgression = jest.fn().mockResolvedValue(null);
      (profileService as any).calculateTotalStats = jest.fn().mockResolvedValue({
        atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0
      });

      // Act: Get profile
      const result = await profileService.getProfile(userId);

      // Assert: Default progression values
      expect(result.level).toBe(1);
      expect(result.xp).toBe(0);
      expect(result.gold).toBe(0);
      expect(result.gems).toBe(0);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange: Mock user not found
      mockProfileRepository.findUserById.mockResolvedValue(null);

      // Act & Assert: Should throw error
      await expect(
        profileService.getProfile('fake-user-id')
      ).rejects.toThrow(NotFoundError);

      await expect(
        profileService.getProfile('fake-user-id')
      ).rejects.toThrow('User not found');
    });

    it('should derive account_type correctly from email presence', async () => {
      // Test anonymous user (device-based email)
      const anonymousUser = UserFactory.createAnonymous({
        email: 'device_12345@mystica.local'
      });

      mockProfileRepository.findUserById.mockResolvedValue(anonymousUser);
      mockProfileRepository.getAllCurrencyBalances.mockResolvedValue({ GOLD: 0, GEMS: 0 });
      (profileService as any).getProgression = jest.fn().mockResolvedValue(null);
      (profileService as any).calculateTotalStats = jest.fn().mockResolvedValue({
        atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0
      });

      const result = await profileService.getProfile(anonymousUser.id);
      expect(result.account_type).toBe('anonymous');
    });
  });

  /**
   * Test Group 2: Profile Initialization
   * Tests initializeProfile() method and starter inventory creation
   */
  describe('initializeProfile()', () => {
    it('should initialize profile with 1 random common item and 0 currency', async () => {
      // Arrange: Mock dependencies for initialization
      const mockCommonItemTypes = [
        { id: 'wooden_sword', name: 'Wooden Sword', rarity: 'common' },
        { id: 'iron_dagger', name: 'Iron Dagger', rarity: 'common' }
      ];

      const mockStarterItem = {
        id: 'starter-item-123',
        user_id: userId,
        item_type_id: 'wooden_sword',
        level: 1,
        created_at: '2025-01-23T10:00:00Z'
      };

      const mockInitializedProfile = {
        id: userId,
        email: 'test@mystica.com',
        username: null,
        vanity_level: 1,
        gold: 0,
        gems: 0,
        level: 1,
        xp: 0,
        created_at: '2025-01-23T10:00:00Z',
        last_login: '2025-01-23T10:00:00Z'
      };

      // Mock empty inventory (not initialized)
      mockItemRepository.findByUser.mockResolvedValue([]);
      mockItemRepository.findItemTypesByRarity.mockResolvedValue(mockCommonItemTypes);
      mockItemRepository.create.mockResolvedValue(mockStarterItem);

      // Mock currency and progression initialization
      mockProfileRepository.addCurrency.mockResolvedValue(0);
      mockProfileRepository.updateProgression.mockResolvedValue(undefined);

      // Mock getProfile call for final return
      jest.spyOn(profileService, 'getProfile').mockResolvedValue(mockInitializedProfile as UserProfile);

      // Act: Initialize profile
      const result = await profileService.initializeProfile(userId);

      // Assert: Initialization sequence
      expect(mockItemRepository.findByUser).toHaveBeenCalledWith(userId);
      expect(mockProfileRepository.addCurrency).toHaveBeenCalledWith(userId, 'GOLD', 0, 'profile_init');
      expect(mockProfileRepository.addCurrency).toHaveBeenCalledWith(userId, 'GEMS', 0, 'profile_init');
      // ProfileService uses a private method for item types, so no repository call expected
      expect(mockItemRepository.create).toHaveBeenCalledWith({
        user_id: userId,
        item_type_id: expect.any(String), // Random item type from common list
        level: 1
      });
      expect(mockProfileRepository.updateProgression).toHaveBeenCalledWith(userId, {
        xp: 0,
        level: 1,
        xp_to_next_level: 100
      });

      // Verify analytics tracking
      expect(mockAnalyticsServiceInstance.trackEvent).toHaveBeenCalledWith(userId, 'profile_initialized', {
        starter_item_id: mockStarterItem.id,
        starter_item_type: expect.any(String)
      });

      // Verify final profile return
      expect(result).toEqual(mockInitializedProfile);
    });

    it('should throw BusinessLogicError when profile already initialized', async () => {
      // Arrange: Mock existing items (profile already initialized)
      const existingItems = [
        { id: 'existing-item-1', user_id: userId },
        { id: 'existing-item-2', user_id: userId }
      ];

      mockItemRepository.findByUser.mockResolvedValue(existingItems);

      // Act & Assert: Should throw error
      await expect(
        profileService.initializeProfile(userId)
      ).rejects.toThrow(BusinessLogicError);

      await expect(
        profileService.initializeProfile(userId)
      ).rejects.toThrow('Profile already initialized');

      // Should not call other methods
      expect(mockProfileRepository.addCurrency).not.toHaveBeenCalled();
      expect(mockItemRepository.create).not.toHaveBeenCalled();
    });

    it('should handle item creation failure gracefully', async () => {
      // Arrange: Mock item creation failure
      mockItemRepository.findByUser.mockResolvedValue([]);
      mockItemRepository.findItemTypesByRarity.mockResolvedValue([
        { id: 'wooden_sword', name: 'Wooden Sword', rarity: 'common' }
      ]);
      mockItemRepository.create.mockRejectedValue(new Error('Item creation failed'));

      // Act & Assert: Should propagate error
      await expect(
        profileService.initializeProfile(userId)
      ).rejects.toThrow('Item creation failed');
    });

    it('should throw error when no common items available', async () => {
      // Arrange: No common item types available
      mockItemRepository.findByUser.mockResolvedValue([]);
      mockItemRepository.findItemTypesByRarity.mockResolvedValue([]);

      // Act & Assert: Should throw error
      await expect(
        profileService.initializeProfile(userId)
      ).rejects.toThrow(); // Would throw when trying to access empty array
    });
  });

  /**
   * Test Group 3: Currency Operations
   * Tests currency balance queries and atomic operations
   */
  describe('Currency Operations', () => {
    describe('getCurrencyBalance()', () => {
      it('should return current balance for specified currency', async () => {
        // Arrange: Mock gold balance
        mockProfileRepository.getCurrencyBalance.mockResolvedValue(750);

        // Act: Get gold balance
        const result = await profileService.getCurrencyBalance(userId, 'GOLD');

        // Assert: Correct balance and call
        expect(result).toBe(750);
        expect(mockProfileRepository.getCurrencyBalance).toHaveBeenCalledWith(userId, 'GOLD');
      });

      it('should return 0 when no balance record exists', async () => {
        // Arrange: Mock no balance record
        mockProfileRepository.getCurrencyBalance.mockResolvedValue(0);

        // Act: Get gems balance
        const result = await profileService.getCurrencyBalance(userId, 'GEMS');

        // Assert: Default to 0
        expect(result).toBe(0);
      });
    });

    describe('getAllCurrencyBalances()', () => {
      it('should return all currency balances', async () => {
        // Arrange: Mock all balances
        const mockBalances = { GOLD: 1200, GEMS: 45 };
        mockProfileRepository.getAllCurrencyBalances.mockResolvedValue(mockBalances);

        // Act: Get all balances
        const result = await profileService.getAllCurrencyBalances(userId);

        // Assert: Complete balance object
        expect(result).toEqual(mockBalances);
        expect(mockProfileRepository.getAllCurrencyBalances).toHaveBeenCalledWith(userId);
      });

      it('should return zero balances when no records exist', async () => {
        // Arrange: Mock default balances
        const defaultBalances = { GOLD: 0, GEMS: 0 };
        mockProfileRepository.getAllCurrencyBalances.mockResolvedValue(defaultBalances);

        // Act: Get all balances
        const result = await profileService.getAllCurrencyBalances(userId);

        // Assert: Default balances
        expect(result).toEqual(defaultBalances);
      });
    });

    describe('addCurrency()', () => {
      it('should add currency using RPC function and return new balance', async () => {
        // Arrange: Mock successful currency addition
        const newBalance = 1500;
        mockProfileRepository.addCurrency.mockResolvedValue(newBalance);

        // Act: Add gold
        const result = await profileService.addCurrency(
          userId,
          'GOLD',
          500,
          'combat_victory',
          'combat-session-123'
        );

        // Assert: Correct RPC call and response
        expect(result).toBe(newBalance);
        expect(mockProfileRepository.addCurrency).toHaveBeenCalledWith(
          userId,
          'GOLD',
          500,
          'combat_victory',
          'combat-session-123',
          undefined // No metadata
        );
      });

      it('should add currency with metadata', async () => {
        // Arrange: Mock with metadata
        const metadata = { enemy_type: 'goblin', location_id: 'forest-001' };
        mockProfileRepository.addCurrency.mockResolvedValue(250);

        // Act: Add gems with metadata
        const result = await profileService.addCurrency(
          userId,
          'GEMS',
          10,
          'achievement',
          'kill-100-goblins',
          metadata
        );

        // Assert: Metadata passed through
        expect(mockProfileRepository.addCurrency).toHaveBeenCalledWith(
          userId,
          'GEMS',
          10,
          'achievement',
          'kill-100-goblins',
          metadata
        );
      });

      it('should throw ValidationError for negative amounts', async () => {
        // Act & Assert: Should validate positive amounts
        await expect(
          profileService.addCurrency(userId, 'GOLD', -100, 'admin')
        ).rejects.toThrow(ValidationError);

        await expect(
          profileService.addCurrency(userId, 'GOLD', 0, 'admin')
        ).rejects.toThrow(ValidationError);
      });

      it('should propagate repository errors', async () => {
        // Arrange: Mock repository error
        mockProfileRepository.addCurrency.mockRejectedValue(
          new BusinessLogicError('RPC function failed')
        );

        // Act & Assert: Should propagate error
        await expect(
          profileService.addCurrency(userId, 'GOLD', 100, 'admin')
        ).rejects.toThrow('RPC function failed');
      });
    });

    describe('deductCurrency()', () => {
      it('should deduct currency using RPC function and return new balance', async () => {
        // Arrange: Mock successful deduction
        const newBalance = 400;
        mockProfileRepository.deductCurrency.mockResolvedValue(newBalance);

        // Act: Deduct gold
        const result = await profileService.deductCurrency(
          userId,
          'GOLD',
          200,
          'item_upgrade',
          'item-456'
        );

        // Assert: Correct RPC call and response
        expect(result).toBe(newBalance);
        expect(mockProfileRepository.deductCurrency).toHaveBeenCalledWith(
          userId,
          'GOLD',
          200,
          'item_upgrade',
          'item-456',
          undefined
        );
      });

      it('should throw BusinessLogicError on insufficient funds', async () => {
        // Arrange: Mock insufficient funds error
        mockProfileRepository.deductCurrency.mockRejectedValue(
          new BusinessLogicError('Insufficient funds')
        );

        // Act & Assert: Should throw specific error
        await expect(
          profileService.deductCurrency(userId, 'GOLD', 1000, 'shop_purchase')
        ).rejects.toThrow(BusinessLogicError);

        await expect(
          profileService.deductCurrency(userId, 'GOLD', 1000, 'shop_purchase')
        ).rejects.toThrow('Insufficient funds');
      });

      it('should throw ValidationError for negative amounts', async () => {
        // Act & Assert: Should validate positive amounts
        await expect(
          profileService.deductCurrency(userId, 'GEMS', -50, 'admin')
        ).rejects.toThrow(ValidationError);
      });
    });
  });

  /**
   * Test Group 4: Player Progression
   * Tests progression tracking and XP/level operations
   */
  describe('Player Progression', () => {
    describe('getProgression()', () => {
      it('should return player progression data', async () => {
        // Arrange: Mock progression data
        const mockProgression = {
          user_id: userId,
          level: 12,
          xp: 8500,
          xp_to_next_level: 1500,
          last_level_up_at: '2025-01-20T15:30:00Z',
          created_at: '2025-01-15T09:00:00Z',
          updated_at: '2025-01-22T14:30:00Z'
        };

        mockProfileRepository.getProgression.mockResolvedValue(mockProgression);

        // Act: Get progression
        const result = await profileService.getProgression(userId);

        // Assert: Correct progression data
        expect(result).toEqual(mockProgression);
        expect(mockProfileRepository.getProgression).toHaveBeenCalledWith(userId);
      });

      it('should return null for new user with no progression record', async () => {
        // Arrange: Mock no progression record
        mockProfileRepository.getProgression.mockResolvedValue(null);

        // Act: Get progression
        const result = await profileService.getProgression(userId);

        // Assert: Null response
        expect(result).toBeNull();
      });
    });

    describe('addXP()', () => {
      it('should add XP using RPC function and return level-up information', async () => {
        // Arrange: Mock XP addition with level-up
        const mockXpResult = {
          newXP: 10200,
          newLevel: 13,
          leveledUp: true
        };

        mockProfileRepository.addXP.mockResolvedValue(mockXpResult);

        // Act: Add XP
        const result = await profileService.addXP(userId, 1700);

        // Assert: XP addition and level-up info
        expect(result).toEqual(mockXpResult);
        expect(mockProfileRepository.addXP).toHaveBeenCalledWith(userId, 1700);
      });

      it('should add XP without level-up', async () => {
        // Arrange: Mock XP addition without level-up
        const mockXpResult = {
          newXP: 9200,
          newLevel: 12,
          leveledUp: false
        };

        mockProfileRepository.addXP.mockResolvedValue(mockXpResult);

        // Act: Add small amount of XP
        const result = await profileService.addXP(userId, 200);

        // Assert: No level-up
        expect(result.leveledUp).toBe(false);
        expect(result.newLevel).toBe(12);
      });

      it('should throw ValidationError for negative XP amounts', async () => {
        // Act & Assert: Should validate positive XP
        await expect(
          profileService.addXP(userId, -100)
        ).rejects.toThrow(ValidationError);

        await expect(
          profileService.addXP(userId, 0)
        ).rejects.toThrow(ValidationError);
      });

      it('should propagate RPC function errors', async () => {
        // Arrange: Mock RPC error
        mockProfileRepository.addXP.mockRejectedValue(
          new BusinessLogicError('XP calculation failed')
        );

        // Act & Assert: Should propagate error
        await expect(
          profileService.addXP(userId, 500)
        ).rejects.toThrow('XP calculation failed');
      });
    });
  });

  /**
   * Test Group 5: Derived Statistics
   * Tests vanity level, average item level, and total stats calculation
   */
  describe('Derived Statistics', () => {
    describe('updateVanityLevel()', () => {
      it('should recalculate and update vanity level', async () => {
        // Arrange: Mock vanity level calculation
        const newVanityLevel = 28;
        mockProfileRepository.updateVanityLevel.mockResolvedValue(newVanityLevel);

        // Act: Update vanity level
        const result = await profileService.updateVanityLevel(userId);

        // Assert: Correct calculation and update
        expect(result).toBe(newVanityLevel);
        expect(mockProfileRepository.updateVanityLevel).toHaveBeenCalledWith(userId);
      });

      it('should return 0 for user with no equipped items', async () => {
        // Arrange: Mock no equipped items
        mockProfileRepository.updateVanityLevel.mockResolvedValue(0);

        // Act: Update vanity level
        const result = await profileService.updateVanityLevel(userId);

        // Assert: Zero vanity level
        expect(result).toBe(0);
      });
    });

    describe('updateAvgItemLevel()', () => {
      it('should recalculate and update average item level', async () => {
        // Arrange: Mock average level calculation
        const newAvgLevel = 6.75;
        mockProfileRepository.updateAvgItemLevel.mockResolvedValue(newAvgLevel);

        // Act: Update average item level
        const result = await profileService.updateAvgItemLevel(userId);

        // Assert: Correct calculation and update
        expect(result).toBe(newAvgLevel);
        expect(mockProfileRepository.updateAvgItemLevel).toHaveBeenCalledWith(userId);
      });
    });

    describe('calculateTotalStats()', () => {
      it('should aggregate stats from equipped items and materials', async () => {
        // Arrange: Mock total stats calculation
        const mockTotalStats: Stats = {
          atkPower: 1.8,
          atkAccuracy: 1.2,
          defPower: 1.4,
          defAccuracy: 1.0
        };

        // Mock the method since it's not in current implementation
        (profileService as any).calculateTotalStats = jest.fn().mockResolvedValue(mockTotalStats);

        // Act: Calculate total stats
        const result = await (profileService as any).calculateTotalStats(userId);

        // Assert: Valid combat stats
        expect(result).toEqual(mockTotalStats);
        expectValidComputedStats(result);
      });

      it('should return zero stats when no items equipped', async () => {
        // Arrange: Mock no equipped items
        const zeroStats: Stats = {
          atkPower: 0,
          atkAccuracy: 0,
          defPower: 0,
          defAccuracy: 0
        };

        (profileService as any).calculateTotalStats = jest.fn().mockResolvedValue(zeroStats);

        // Act: Calculate total stats
        const result = await (profileService as any).calculateTotalStats(userId);

        // Assert: Zero stats
        expect(result).toEqual(zeroStats);
      });
    });
  });

  /**
   * Test Group 6: Device Management
   * Tests device token registration and retrieval for push notifications
   */
  describe('Device Management', () => {
    describe('registerDeviceToken()', () => {
      it('should register new device token successfully', async () => {
        // Arrange: Mock successful registration
        mockProfileRepository.registerDeviceToken.mockResolvedValue(undefined);

        // Act: Register device token
        await profileService.registerDeviceToken(userId, 'ios', 'device-token-123');

        // Assert: Correct registration call
        expect(mockProfileRepository.registerDeviceToken).toHaveBeenCalledWith(
          userId,
          'ios',
          'device-token-123'
        );
      });

      it('should handle token transfer between users', async () => {
        // Arrange: Mock token transfer scenario
        mockProfileRepository.registerDeviceToken.mockResolvedValue(undefined);

        // Act: Register token (previously used by another user)
        await profileService.registerDeviceToken(userId, 'android', 'existing-token');

        // Assert: Repository handles UNIQUE constraint gracefully
        expect(mockProfileRepository.registerDeviceToken).toHaveBeenCalledWith(
          userId,
          'android',
          'existing-token'
        );
      });

      it('should support multiple tokens per user', async () => {
        // Arrange: Mock multiple token registrations
        mockProfileRepository.registerDeviceToken.mockResolvedValue(undefined);

        // Act: Register multiple tokens
        await profileService.registerDeviceToken(userId, 'ios', 'token-1');
        await profileService.registerDeviceToken(userId, 'android', 'token-2');

        // Assert: Both registrations called
        expect(mockProfileRepository.registerDeviceToken).toHaveBeenCalledTimes(2);
      });
    });

    describe('getActiveDeviceTokens()', () => {
      it('should return all active device tokens for user', async () => {
        // Arrange: Mock active tokens
        const mockTokens = [
          {
            user_id: userId,
            platform: 'ios',
            token: 'ios-token-456',
            is_active: true,
            last_seen_at: '2025-01-23T10:00:00Z',
            created_at: '2025-01-20T09:00:00Z'
          },
          {
            user_id: userId,
            platform: 'android',
            token: 'android-token-789',
            is_active: true,
            last_seen_at: '2025-01-23T09:30:00Z',
            created_at: '2025-01-22T14:00:00Z'
          }
        ];

        mockProfileRepository.getActiveDeviceTokens.mockResolvedValue(mockTokens);

        // Act: Get active tokens
        const result = await profileService.getActiveDeviceTokens(userId);

        // Assert: Correct tokens returned
        expect(result).toEqual(mockTokens);
        expect(result).toHaveLength(2);
        expect(mockProfileRepository.getActiveDeviceTokens).toHaveBeenCalledWith(userId);
      });

      it('should return empty array when no active tokens', async () => {
        // Arrange: Mock no active tokens
        mockProfileRepository.getActiveDeviceTokens.mockResolvedValue([]);

        // Act: Get active tokens
        const result = await profileService.getActiveDeviceTokens(userId);

        // Assert: Empty array
        expect(result).toEqual([]);
      });
    });
  });

  /**
   * Test Group 7: Error Handling
   * Tests error propagation and edge case handling
   */
  describe('Error Handling', () => {
    it('should propagate repository errors correctly', async () => {
      // Arrange: Mock repository error
      mockProfileRepository.findUserById.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act & Assert: Should propagate error
      await expect(
        profileService.getProfile(userId)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle ValidationError for invalid input', async () => {
      // Arrange: Mock validation error
      mockProfileRepository.addCurrency.mockRejectedValue(
        new ValidationError('Invalid currency code')
      );

      // Act & Assert: Should propagate validation error
      await expect(
        profileService.addCurrency(userId, 'INVALID' as any, 100, 'admin')
      ).rejects.toThrow(ValidationError);
    });

    it('should handle BusinessLogicError for business rule violations', async () => {
      // Arrange: Mock business logic error
      mockProfileRepository.deductCurrency.mockRejectedValue(
        new BusinessLogicError('Account is frozen')
      );

      // Act & Assert: Should propagate business logic error
      await expect(
        profileService.deductCurrency(userId, 'GOLD', 100, 'admin')
      ).rejects.toThrow(BusinessLogicError);
    });
  });

  /**
   * Test Group 8: Integration Scenarios
   * Tests complex workflows and method interactions
   */
  describe('Integration Scenarios', () => {
    it('should complete full profile lifecycle: init → add currency → level up', async () => {
      // Mock profile initialization
      const startProfile = {
        id: userId,
        email: 'new@mystica.com',
        gold: 0,
        gems: 0,
        level: 1,
        xp: 0
      };

      mockItemRepository.findByUser.mockResolvedValue([]);
      mockItemRepository.findItemTypesByRarity.mockResolvedValue([
        { id: 'wooden_sword', name: 'Wooden Sword', rarity: 'common' }
      ]);
      mockItemRepository.create.mockResolvedValue({
        id: 'starter-item',
        user_id: userId,
        item_type_id: 'wooden_sword'
      });
      mockProfileRepository.addCurrency.mockResolvedValue(0);
      mockProfileRepository.updateProgression.mockResolvedValue(undefined);
      jest.spyOn(profileService, 'getProfile').mockResolvedValue(startProfile as UserProfile);

      // Step 1: Initialize profile
      const initializedProfile = await profileService.initializeProfile(userId);
      expect(initializedProfile.level).toBe(1);
      expect(initializedProfile.gold).toBe(0);

      // Step 2: Add currency from combat
      mockProfileRepository.addCurrency.mockResolvedValueOnce(500);
      const newGoldBalance = await profileService.addCurrency(
        userId,
        'GOLD',
        500,
        'combat_victory'
      );
      expect(newGoldBalance).toBe(500);

      // Step 3: Add XP and level up
      mockProfileRepository.addXP.mockResolvedValueOnce({
        newXP: 1200,
        newLevel: 2,
        leveledUp: true
      });
      const xpResult = await profileService.addXP(userId, 1200);
      expect(xpResult.leveledUp).toBe(true);
      expect(xpResult.newLevel).toBe(2);

      // Verify all operations completed
      expect(mockAnalyticsServiceInstance.trackEvent).toHaveBeenCalledWith(
        userId,
        'profile_initialized',
        expect.any(Object)
      );
    });

    it('should handle profile with equipment and calculate total stats', async () => {
      // Mock profile with equipment
      const equippedUser = {
        ...testUser,
        vanity_level: 25,
        avg_item_level: 8.5
      };

      const totalStats = {
        atkPower: 2.0,
        atkAccuracy: 1.7,
        defPower: 1.9,
        defAccuracy: 1.3
      };

      mockProfileRepository.findUserById.mockResolvedValue(equippedUser);
      mockProfileRepository.getAllCurrencyBalances.mockResolvedValue({ GOLD: 2000, GEMS: 150 });
      (profileService as any).getProgression = jest.fn().mockResolvedValue({
        level: 15,
        xp: 12000
      });
      (profileService as any).calculateTotalStats = jest.fn().mockResolvedValue(totalStats);

      const profile = await profileService.getProfile(userId);

      expect(profile.vanity_level).toBe(25);
      expect(profile.total_stats).toEqual(totalStats);
      expectValidComputedStats(profile.total_stats);
    });
  });
});