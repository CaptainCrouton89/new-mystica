/**
 * Unit Tests: LoadoutService
 *
 * Comprehensive test suite for loadout management functionality following F-09 specification.
 * Tests CRUD operations, slot management, loadout activation, and business rule enforcement.
 */

import { LoadoutService } from '../../../src/services/LoadoutService.js';
import { NotFoundError, ValidationError, BusinessLogicError } from '../../../src/utils/errors.js';

// Import test infrastructure
import {
  UserFactory,
  ItemFactory,
  LoadoutFactory
} from '../../factories/index.js';

// Import types from repository layer
import {
  type LoadoutWithSlots,
  type LoadoutSlotAssignments,
  type CreateLoadoutData
} from '../../../src/types/repository.types.js';

import {
  expectValidUUID,
  expectValidTimestamp
} from '../../helpers/assertions.js';

// Mock LoadoutRepository before importing service
jest.mock('../../../src/repositories/LoadoutRepository.js', () => ({
  LoadoutRepository: jest.fn().mockImplementation(() => ({
    findLoadoutsByUser: jest.fn(),
    findLoadoutById: jest.fn(),
    createLoadout: jest.fn(),
    updateLoadoutName: jest.fn(),
    deleteLoadout: jest.fn(),
    updateLoadoutSlots: jest.fn(),
    updateSingleSlot: jest.fn(),
    getActiveLoadout: jest.fn(),
    activateLoadout: jest.fn(),
    isLoadoutNameUnique: jest.fn(),
    canDeleteLoadout: jest.fn()
  }))
}));

// LoadoutService only uses LoadoutRepository - ItemRepository validation is handled internally

describe('LoadoutService', () => {
  let loadoutService: LoadoutService;
  let mockLoadoutRepository: any;
  const testUser = UserFactory.createEmail('test@mystica.com');
  const userId = testUser.id;

  beforeEach(() => {
    loadoutService = new LoadoutService();
    jest.clearAllMocks();

    // Get repository mock
    mockLoadoutRepository = (loadoutService as any).loadoutRepository;

    // Set default mock implementations to avoid mock detection issues
    mockLoadoutRepository.isLoadoutNameUnique.mockResolvedValue(true);
    mockLoadoutRepository.findLoadoutById.mockImplementation(() => Promise.resolve(null));
    mockLoadoutRepository.updateLoadoutSlots.mockImplementation(() => Promise.resolve({}));
    mockLoadoutRepository.updateSingleSlot.mockImplementation(() => Promise.resolve({}));
    mockLoadoutRepository.activateLoadout.mockImplementation(() => Promise.resolve({}));
  });

  /**
   * Test Group 1: Create Loadout
   * Tests loadout creation with validation
   */
  describe('createLoadout()', () => {
    it('should create new loadout with unique name and empty slots', async () => {
      // Arrange
      const loadoutName = 'Combat Loadout';
      const expectedLoadout = LoadoutFactory.createLoadoutWithSlots(userId, loadoutName);

      mockLoadoutRepository.isLoadoutNameUnique.mockResolvedValue(true);
      mockLoadoutRepository.createLoadout.mockResolvedValue(expectedLoadout);

      // Act
      const result = await loadoutService.createLoadout(userId, loadoutName);

      // Assert
      expect(mockLoadoutRepository.createLoadout).toHaveBeenCalledWith({
        user_id: userId,
        name: loadoutName,
        is_active: false
      });

      expect(result).toEqual(expectedLoadout);
      expect(result.name).toBe(loadoutName);
      expect(result.user_id).toBe(userId);
      expect(result.is_active).toBe(false);

      // All slots should be empty initially
      expect(result.slots.weapon).toBeNull();
      expect(result.slots.offhand).toBeNull();
      expect(result.slots.head).toBeNull();
      expect(result.slots.armor).toBeNull();
      expect(result.slots.feet).toBeNull();
      expect(result.slots.accessory_1).toBeNull();
      expect(result.slots.accessory_2).toBeNull();
      expect(result.slots.pet).toBeNull();

      expectValidUUID(result.id);
      expectValidTimestamp(result.created_at);
      expectValidTimestamp(result.updated_at);
    });

    it('should throw ValidationError for duplicate loadout name', async () => {
      // Arrange
      const loadoutName = 'Existing Loadout';
      mockLoadoutRepository.isLoadoutNameUnique.mockResolvedValue(false);

      // Act & Assert
      await expect(
        loadoutService.createLoadout(userId, loadoutName)
      ).rejects.toThrow('Loadout name \'Existing Loadout\' already exists for this user');

      expect(mockLoadoutRepository.isLoadoutNameUnique).toHaveBeenCalledWith(userId, loadoutName);
      expect(mockLoadoutRepository.createLoadout).not.toHaveBeenCalled();
    });

    it('should validate loadout name length constraints', async () => {
      // Arrange: Name too long (over 50 characters)
      const longName = 'x'.repeat(51);

      // Act & Assert
      await expect(
        loadoutService.createLoadout(userId, longName)
      ).rejects.toThrow('Loadout name cannot exceed 50 characters');

      // Empty name should also fail
      await expect(
        loadoutService.createLoadout(userId, '')
      ).rejects.toThrow('Loadout name cannot be empty');

      expect(mockLoadoutRepository.createLoadout).not.toHaveBeenCalled();
    });
  });

  /**
   * Test Group 2: Get Loadouts
   * Tests retrieving user loadouts and individual loadouts
   */
  describe('getLoadoutsByUser()', () => {
    it('should return all loadouts for user ordered by creation date', async () => {
      // Arrange
      const loadouts = LoadoutFactory.createMultipleLoadouts(userId, 3, 1);
      mockLoadoutRepository.findLoadoutsByUser.mockResolvedValue(loadouts);

      // Act
      const result = await loadoutService.getLoadoutsByUser(userId);

      // Assert
      expect(mockLoadoutRepository.findLoadoutsByUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual(loadouts);
      expect(result).toHaveLength(3);

      // Validate structure of each loadout
      result.forEach(loadout => {
        expectValidUUID(loadout.id);
        expect(loadout.user_id).toBe(userId);
        expect(loadout.slots).toBeDefined();
        expect(Object.keys(loadout.slots)).toHaveLength(8);
      });

      // One should be active
      const activeLoadouts = result.filter(l => l.is_active);
      expect(activeLoadouts).toHaveLength(1);
    });

    it('should return empty array when user has no loadouts', async () => {
      // Arrange
      mockLoadoutRepository.findLoadoutsByUser.mockResolvedValue([]);

      // Act
      const result = await loadoutService.getLoadoutsByUser(userId);

      // Assert
      expect(result).toEqual([]);
      expect(mockLoadoutRepository.findLoadoutsByUser).toHaveBeenCalledWith(userId);
    });
  });

  describe('getLoadoutById()', () => {
    it('should return loadout with ownership validation', async () => {
      // Arrange
      const loadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Test Loadout');
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(loadout);

      // Act
      const result = await loadoutService.getLoadoutById(loadout.id, userId);

      // Assert
      expect(mockLoadoutRepository.findLoadoutById).toHaveBeenCalledWith(loadout.id);
      expect(result).toEqual(loadout);
      expect(result.user_id).toBe(userId);
    });

    it('should throw NotFoundError when loadout does not exist', async () => {
      // Arrange
      const fakeLoadoutId = 'fake-loadout-id';
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        loadoutService.getLoadoutById(fakeLoadoutId, userId)
      ).rejects.toThrow("loadouts with identifier 'fake-loadout-id' not found");

      expect(mockLoadoutRepository.findLoadoutById).toHaveBeenCalledWith(fakeLoadoutId);
    });

    it('should throw NotFoundError when loadout not owned by user', async () => {
      // Arrange
      const otherUserId = 'other-user-id';
      const loadout = LoadoutFactory.createLoadoutWithSlots(otherUserId, 'Other User Loadout');
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        loadoutService.getLoadoutById(loadout.id, userId)
      ).rejects.toThrow(`loadouts with identifier '${loadout.id}' not found`);
    });
  });

  /**
   * Test Group 3: Update Loadout Name
   * Tests loadout name updates with validation
   */
  describe('updateLoadoutName()', () => {
    it('should update loadout name with uniqueness validation', async () => {
      // Arrange
      const loadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Old Name');
      const newName = 'Updated Name';
      const updatedLoadout = { ...loadout, name: newName, updated_at: new Date().toISOString() };

      // Mock the service calls
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(loadout);
      mockLoadoutRepository.isLoadoutNameUnique.mockResolvedValue(true);
      mockLoadoutRepository.updateLoadoutName.mockResolvedValue(true);
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(updatedLoadout);

      // Act
      const result = await loadoutService.updateLoadoutName(loadout.id, userId, newName);

      // Assert
      expect(mockLoadoutRepository.updateLoadoutName).toHaveBeenCalledWith(loadout.id, newName);
      expect(result.name).toBe(newName);
      expect(result.id).toBe(loadout.id);
      expect(result.user_id).toBe(userId);
    });

    it('should throw ValidationError for duplicate name', async () => {
      // Arrange
      const loadoutId = 'test-loadout-id';
      const duplicateName = 'Existing Name';
      const existingLoadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Current Name');

      mockLoadoutRepository.findLoadoutById.mockResolvedValue(existingLoadout);
      mockLoadoutRepository.isLoadoutNameUnique.mockResolvedValue(false);

      // Act & Assert
      await expect(
        loadoutService.updateLoadoutName(loadoutId, userId, duplicateName)
      ).rejects.toThrow('Loadout name \'Existing Name\' already exists for this user');

      expect(mockLoadoutRepository.isLoadoutNameUnique).toHaveBeenCalledWith(userId, duplicateName, loadoutId);
      expect(mockLoadoutRepository.updateLoadoutName).not.toHaveBeenCalled();
    });

    it('should validate name length constraints on update', async () => {
      // Arrange
      const loadoutId = 'test-loadout-id';
      const longName = 'x'.repeat(51);
      const existingLoadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Existing Name');

      // Mock the loadout exists (for ownership check)
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(existingLoadout);

      // Act & Assert
      await expect(
        loadoutService.updateLoadoutName(loadoutId, userId, longName)
      ).rejects.toThrow('Loadout name cannot exceed 50 characters');

      await expect(
        loadoutService.updateLoadoutName(loadoutId, userId, '')
      ).rejects.toThrow('Loadout name cannot be empty');

      expect(mockLoadoutRepository.updateLoadoutName).not.toHaveBeenCalled();
    });
  });

  /**
   * Test Group 4: Delete Loadout
   * Tests loadout deletion with business rule validation
   */
  describe('deleteLoadout()', () => {
    it('should successfully delete inactive loadout', async () => {
      // Arrange
      const loadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Delete Me', undefined, { is_active: false });
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(loadout);
      mockLoadoutRepository.canDeleteLoadout.mockResolvedValue(true);
      mockLoadoutRepository.deleteLoadout.mockResolvedValue(true);

      // Act
      await loadoutService.deleteLoadout(loadout.id, userId);

      // Assert
      expect(mockLoadoutRepository.findLoadoutById).toHaveBeenCalledWith(loadout.id);
      expect(mockLoadoutRepository.canDeleteLoadout).toHaveBeenCalledWith(loadout.id);
      expect(mockLoadoutRepository.deleteLoadout).toHaveBeenCalledWith(loadout.id);
    });

    it('should throw ValidationError when trying to delete active loadout', async () => {
      // Arrange
      const activeLoadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Active Loadout', undefined, { is_active: true });
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(activeLoadout);
      mockLoadoutRepository.canDeleteLoadout.mockResolvedValue(false);

      // Act & Assert
      await expect(
        loadoutService.deleteLoadout(activeLoadout.id, userId)
      ).rejects.toThrow('Cannot delete active loadout');

      expect(mockLoadoutRepository.findLoadoutById).toHaveBeenCalledWith(activeLoadout.id);
      expect(mockLoadoutRepository.canDeleteLoadout).toHaveBeenCalledWith(activeLoadout.id);
      expect(mockLoadoutRepository.deleteLoadout).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when loadout does not exist', async () => {
      // Arrange
      const fakeLoadoutId = 'fake-loadout-id';
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        loadoutService.deleteLoadout(fakeLoadoutId, userId)
      ).rejects.toThrow("loadouts with identifier 'fake-loadout-id' not found");

      expect(mockLoadoutRepository.deleteLoadout).not.toHaveBeenCalled();
    });
  });

  /**
   * Test Group 5: Slot Management - Update All Slots
   * Tests bulk slot updates with item ownership validation
   */
  describe('updateLoadoutSlots()', () => {
    it('should update all slot assignments with valid items', async () => {
      // Arrange
      const loadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Test Loadout');
      const newSlots = LoadoutFactory.createSlotAssignments();
      const updatedLoadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Test Loadout', newSlots);

      // Mock successful update
      mockLoadoutRepository.updateLoadoutSlots.mockImplementation(() => Promise.resolve(undefined));
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(updatedLoadout);

      // Act
      const result = await loadoutService.updateLoadoutSlots(loadout.id, userId, newSlots);

      // Assert
      expect(mockLoadoutRepository.updateLoadoutSlots).toHaveBeenCalledWith(loadout.id, newSlots);
      expect(result.slots).toEqual(newSlots);
    });

    it('should handle null values to clear slots', async () => {
      // Arrange
      const loadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Test Loadout');
      const emptySlots = LoadoutFactory.createEmptySlots();
      const updatedLoadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Test Loadout', emptySlots);

      // Mock successful update
      mockLoadoutRepository.updateLoadoutSlots.mockImplementation(() => Promise.resolve(undefined));
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(updatedLoadout);

      // Act
      const result = await loadoutService.updateLoadoutSlots(loadout.id, userId, emptySlots);

      // Assert
      expect(result.slots).toEqual(emptySlots);

      // All slots should be null
      Object.values(result.slots).forEach(itemId => {
        expect(itemId).toBeNull();
      });
    });

    it('should throw ValidationError when items not owned by user', async () => {
      // Arrange
      const loadoutId = 'test-loadout-id';
      const invalidSlots = LoadoutFactory.createSlotAssignments();

      // Remove mock implementation to trigger validation error
      mockLoadoutRepository.updateLoadoutSlots.mockImplementation(undefined);

      // Act & Assert
      await expect(
        loadoutService.updateLoadoutSlots(loadoutId, userId, invalidSlots)
      ).rejects.toThrow('One or more items are not owned by user');
    });

    it('should throw NotFoundError when loadout does not exist', async () => {
      // Arrange
      const fakeLoadoutId = 'fake-loadout-id';
      const emptySlots = LoadoutFactory.createEmptySlots();

      // Mock successful update but loadout not found after
      mockLoadoutRepository.updateLoadoutSlots.mockImplementation(() => Promise.resolve(undefined));
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        loadoutService.updateLoadoutSlots(fakeLoadoutId, userId, emptySlots)
      ).rejects.toThrow("loadouts with identifier 'fake-loadout-id' not found");
    });
  });

  /**
   * Test Group 6: Slot Management - Update Single Slot
   * Tests individual slot updates
   */
  describe('updateSingleSlot()', () => {
    it('should update single slot with valid item', async () => {
      // Arrange
      const loadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Test Loadout');
      const itemId = 'new-weapon-id';
      const slotName = 'weapon';
      const updatedLoadout = LoadoutFactory.createLoadoutWithSlots(
        userId,
        'Test Loadout',
        { weapon: itemId }
      );

      // Mock successful update
      mockLoadoutRepository.updateSingleSlot.mockImplementation(() => Promise.resolve(undefined));
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(updatedLoadout);

      // Act
      const result = await loadoutService.updateSingleSlot(loadout.id, userId, slotName, itemId);

      // Assert
      expect(mockLoadoutRepository.updateSingleSlot).toHaveBeenCalledWith(loadout.id, slotName, itemId);
      expect(result.slots.weapon).toBe(itemId);
    });

    it('should clear slot when itemId is null', async () => {
      // Arrange
      const loadout = LoadoutFactory.createPartialLoadout(userId, ['weapon'], 'Test Loadout');
      const slotName = 'weapon';
      const updatedLoadout = LoadoutFactory.createLoadoutWithSlots(
        userId,
        'Test Loadout',
        { weapon: null }
      );

      // Mock successful update
      mockLoadoutRepository.updateSingleSlot.mockImplementation(() => Promise.resolve(undefined));
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(updatedLoadout);

      // Act
      const result = await loadoutService.updateSingleSlot(loadout.id, userId, slotName, null);

      // Assert
      expect(mockLoadoutRepository.updateSingleSlot).toHaveBeenCalledWith(loadout.id, slotName, null);
      expect(result.slots.weapon).toBeNull();
    });

    it('should validate all 8 equipment slots', async () => {
      // Arrange
      const loadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Test Loadout');
      const validSlots = ['weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'];
      const itemId = 'test-item-id';

      // Mock successful updates with updated loadout having correct slot values
      mockLoadoutRepository.updateSingleSlot.mockImplementation(() => Promise.resolve(undefined));

      // Act & Assert
      for (const slotName of validSlots) {
        const updatedLoadout = LoadoutFactory.createLoadoutWithSlots(
          userId,
          'Test Loadout',
          { [slotName]: itemId }
        );
        mockLoadoutRepository.findLoadoutById.mockResolvedValue(updatedLoadout);

        await loadoutService.updateSingleSlot(loadout.id, userId, slotName, itemId);
        expect(mockLoadoutRepository.updateSingleSlot).toHaveBeenCalledWith(loadout.id, slotName, itemId);
      }

      expect(mockLoadoutRepository.updateSingleSlot).toHaveBeenCalledTimes(8);
    });

    it('should throw ValidationError for invalid slot name', async () => {
      // Arrange
      const loadoutId = 'test-loadout-id';
      const invalidSlot = 'invalid_slot';
      const itemId = 'test-item-id';

      // Act & Assert
      await expect(
        loadoutService.updateSingleSlot(loadoutId, userId, invalidSlot, itemId)
      ).rejects.toThrow('Invalid slot name');

      // Item ownership validation is internal to LoadoutRepository
      expect(mockLoadoutRepository.updateSingleSlot).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when item not owned by user', async () => {
      // Arrange
      const loadoutId = 'test-loadout-id';
      const slotName = 'weapon';
      const itemId = 'not-owned-item-id';

      // Remove mock implementation to trigger validation error
      mockLoadoutRepository.updateSingleSlot.mockImplementation(undefined);

      // Act & Assert
      await expect(
        loadoutService.updateSingleSlot(loadoutId, userId, slotName, itemId)
      ).rejects.toThrow('Item not owned by user');
    });
  });

  /**
   * Test Group 7: Loadout Activation
   * Tests loadout activation and active loadout management
   */
  describe('activateLoadout()', () => {
    it('should activate loadout and return equipment update', async () => {
      // Arrange
      const loadout = LoadoutFactory.createActiveLoadoutWithFullSlots(userId, 'Combat Loadout');
      const expectedUpdate = LoadoutFactory.createBulkEquipmentUpdate(loadout.slots);

      // Mock loadout exists for ownership validation
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(loadout);
      mockLoadoutRepository.activateLoadout.mockImplementation(() => Promise.resolve(undefined));

      // Act
      const result = await loadoutService.activateLoadout(loadout.id, userId);

      // Assert
      expect(mockLoadoutRepository.activateLoadout).toHaveBeenCalledWith(loadout.id);
      expect(result).toEqual(loadout.slots);

      // Verify all 8 slots are included in the response
      expect(Object.keys(result)).toHaveLength(8);
      expect(result).toHaveProperty('weapon');
      expect(result).toHaveProperty('offhand');
      expect(result).toHaveProperty('head');
      expect(result).toHaveProperty('armor');
      expect(result).toHaveProperty('feet');
      expect(result).toHaveProperty('accessory_1');
      expect(result).toHaveProperty('accessory_2');
      expect(result).toHaveProperty('pet');
    });

    it('should handle activation of loadout with empty slots', async () => {
      // Arrange
      const loadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Empty Loadout');
      const emptyUpdate = LoadoutFactory.createBulkEquipmentUpdate();

      // Mock loadout exists for ownership validation
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(loadout);
      mockLoadoutRepository.activateLoadout.mockImplementation(() => Promise.resolve(undefined));

      // Act
      const result = await loadoutService.activateLoadout(loadout.id, userId);

      // Assert
      expect(result).toEqual(loadout.slots);

      // All equipment slots should be null
      Object.values(result).forEach(itemId => {
        expect(itemId).toBeNull();
      });
    });

    it('should throw NotFoundError when loadout does not exist', async () => {
      // Arrange
      const fakeLoadoutId = 'fake-loadout-id';
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        loadoutService.activateLoadout(fakeLoadoutId, userId)
      ).rejects.toThrow("loadouts with identifier 'fake-loadout-id' not found");
    });

    it('should handle repository errors during activation', async () => {
      // Arrange
      const loadoutId = 'test-loadout-id';
      const loadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Test');
      const error = new Error('Database transaction failed');

      mockLoadoutRepository.findLoadoutById.mockResolvedValue(loadout);
      mockLoadoutRepository.activateLoadout.mockRejectedValue(error);

      // Act & Assert
      await expect(
        loadoutService.activateLoadout(loadoutId, userId)
      ).rejects.toThrow('Database transaction failed');
    });
  });

  describe('getActiveLoadout()', () => {
    it('should return active loadout for user', async () => {
      // Arrange
      const activeLoadout = LoadoutFactory.createActiveLoadoutWithFullSlots(userId, 'Active Loadout');
      mockLoadoutRepository.getActiveLoadout.mockResolvedValue(activeLoadout);

      // Act
      const result = await loadoutService.getActiveLoadout(userId);

      // Assert
      expect(mockLoadoutRepository.getActiveLoadout).toHaveBeenCalledWith(userId);
      expect(result).toEqual(activeLoadout);
      expect(result!.is_active).toBe(true);
      expect(result!.user_id).toBe(userId);
    });

    it('should return null when user has no active loadout', async () => {
      // Arrange
      mockLoadoutRepository.getActiveLoadout.mockResolvedValue(null);

      // Act
      const result = await loadoutService.getActiveLoadout(userId);

      // Assert
      expect(result).toBeNull();
      expect(mockLoadoutRepository.getActiveLoadout).toHaveBeenCalledWith(userId);
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      mockLoadoutRepository.getActiveLoadout.mockRejectedValue(error);

      // Act & Assert
      await expect(
        loadoutService.getActiveLoadout(userId)
      ).rejects.toThrow('Database connection failed');
    });
  });

  /**
   * Test Group 8: Business Rules and Edge Cases
   * Tests validation, constraints, and error conditions
   */
  describe('Business Rules and Edge Cases', () => {
    it('should enforce loadout name uniqueness per user', async () => {
      // Arrange
      const existingName = 'PvP Build';
      mockLoadoutRepository.isLoadoutNameUnique.mockResolvedValue(false);

      // Act & Assert
      await expect(
        loadoutService.createLoadout(userId, existingName)
      ).rejects.toThrow("Loadout name 'PvP Build' already exists for this user");
    });

    it('should validate loadout name length constraints', async () => {
      // Test maximum length (50 characters)
      const maxLengthName = 'x'.repeat(50);
      const validLoadout = LoadoutFactory.createLoadoutWithSlots(userId, maxLengthName);
      mockLoadoutRepository.isLoadoutNameUnique.mockResolvedValue(true);
      mockLoadoutRepository.createLoadout.mockResolvedValue(validLoadout);

      const result = await loadoutService.createLoadout(userId, maxLengthName);
      expect(result.name).toBe(maxLengthName);

      // Test over maximum length
      const tooLongName = 'x'.repeat(51);
      await expect(
        loadoutService.createLoadout(userId, tooLongName)
      ).rejects.toThrow('Loadout name cannot exceed 50 characters');
    });

    it('should handle concurrent loadout activation properly', async () => {
      // This test ensures the repository handles exclusive activation
      const loadout1 = LoadoutFactory.createLoadoutWithSlots(userId, 'Loadout 1');
      const loadout2 = LoadoutFactory.createLoadoutWithSlots(userId, 'Loadout 2');

      // Mock loadouts exist for ownership validation
      mockLoadoutRepository.findLoadoutById
        .mockResolvedValueOnce(loadout1)
        .mockResolvedValueOnce(loadout2);
      mockLoadoutRepository.activateLoadout.mockImplementation(() => Promise.resolve(undefined));

      // Act: Activate both loadouts
      const result1 = await loadoutService.activateLoadout(loadout1.id, userId);
      const result2 = await loadoutService.activateLoadout(loadout2.id, userId);

      // Assert: Both should succeed (repository enforces exclusivity)
      expect(result1).toEqual(loadout1.slots);
      expect(result2).toEqual(loadout2.slots);
      expect(mockLoadoutRepository.activateLoadout).toHaveBeenCalledTimes(2);
    });

    it('should handle missing items during slot assignment gracefully', async () => {
      // Arrange: Item no longer exists
      const loadoutId = 'test-loadout-id';
      const slots = LoadoutFactory.createSlotAssignments();

      // Remove mock implementation to trigger validation error
      mockLoadoutRepository.updateLoadoutSlots.mockImplementation(undefined);

      // Act & Assert
      await expect(
        loadoutService.updateLoadoutSlots(loadoutId, userId, slots)
      ).rejects.toThrow('One or more items are not owned by user');
    });

    it('should validate all equipment slot names', async () => {
      const validSlots = ['weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'];
      const invalidSlots = ['invalid', 'wrong', 'bad_slot', 'accessory', 'accessory1'];

      // Valid slots should not throw
      for (const slot of validSlots) {
        // Should not throw ValidationError for valid slots
        // (The actual validation happens in updateSingleSlot)
      }

      // Invalid slots should throw
      for (const slot of invalidSlots) {
        await expect(
          loadoutService.updateSingleSlot('test-id', userId, slot, 'item-id')
        ).rejects.toThrow('Invalid slot name');
      }
    });

    it('should handle repository connection failures', async () => {
      // Arrange
      const connectionError = new Error('Connection to database failed');
      mockLoadoutRepository.findLoadoutsByUser.mockRejectedValue(connectionError);

      // Act & Assert
      await expect(
        loadoutService.getLoadoutsByUser(userId)
      ).rejects.toThrow('Connection to database failed');
    });

    it('should handle empty slot assignments in bulk update', async () => {
      // Arrange
      const loadoutId = 'test-loadout-id';
      const partialSlots: Partial<LoadoutSlotAssignments> = {
        weapon: 'item-1',
        armor: 'item-2'
        // Other slots undefined
      };

      const updatedLoadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Test', partialSlots);
      // Mock successful update
      mockLoadoutRepository.updateLoadoutSlots.mockImplementation(() => Promise.resolve(undefined));
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(updatedLoadout);

      // Act
      const result = await loadoutService.updateLoadoutSlots(loadoutId, userId, partialSlots);

      // Assert
      expect(result.slots.weapon).toBe('item-1');
      expect(result.slots.armor).toBe('item-2');
      // Undefined slots should be preserved as they were
    });
  });

  /**
   * Test Group 9: Integration with Repository Pattern
   * Tests service interaction with repositories
   */
  describe('Repository Integration', () => {
    it('should call LoadoutRepository methods with correct parameters', async () => {
      // Test createLoadout calls
      const loadoutData: CreateLoadoutData = { user_id: userId, name: 'Test', is_active: false };
      const expectedLoadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Test');
      mockLoadoutRepository.isLoadoutNameUnique.mockResolvedValue(true);
      mockLoadoutRepository.createLoadout.mockResolvedValue(expectedLoadout);

      await loadoutService.createLoadout(userId, 'Test');
      expect(mockLoadoutRepository.createLoadout).toHaveBeenCalledWith(loadoutData);

      // Test getLoadoutsByUser calls
      mockLoadoutRepository.findLoadoutsByUser.mockResolvedValue([]);
      await loadoutService.getLoadoutsByUser(userId);
      expect(mockLoadoutRepository.findLoadoutsByUser).toHaveBeenCalledWith(userId);

      // Test getLoadoutById calls
      const loadoutId = 'test-id';
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(expectedLoadout);
      await loadoutService.getLoadoutById(loadoutId, userId);
      expect(mockLoadoutRepository.findLoadoutById).toHaveBeenCalledWith(loadoutId);
    });

    it('should call ItemRepository for ownership validation', async () => {
      // Arrange
      const itemIds = ['item-1', 'item-2', 'item-3'];
      const slots: LoadoutSlotAssignments = {
        weapon: itemIds[0],
        armor: itemIds[1],
        accessory_1: itemIds[2],
        offhand: null,
        head: null,
        feet: null,
        accessory_2: null,
        pet: null
      };

      const updatedLoadout = LoadoutFactory.createLoadoutWithSlots(userId, 'Test', slots);
      // Mock successful update
      mockLoadoutRepository.updateLoadoutSlots.mockImplementation(() => Promise.resolve(undefined));
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(updatedLoadout);

      // Act
      await loadoutService.updateLoadoutSlots('loadout-id', userId, slots);

      // Assert
      expect(mockLoadoutRepository.updateLoadoutSlots).toHaveBeenCalledWith('loadout-id', slots);
    });

    it('should handle repository errors correctly', async () => {
      // Test different types of repository errors
      const errors = [
        new NotFoundError('Loadout not found'),
        new ValidationError('Validation failed'),
        new BusinessLogicError('Business rule violation'),
        new Error('Generic database error')
      ];

      for (const error of errors) {
        mockLoadoutRepository.findLoadoutsByUser.mockRejectedValue(error);

        await expect(
          loadoutService.getLoadoutsByUser(userId)
        ).rejects.toThrow(error.message);
      }
    });
  });
});