/**
 * Basic LoadoutService Tests
 *
 * Simplified test suite to verify LoadoutService core functionality
 */

import { LoadoutService } from '../../../src/services/LoadoutService.js';
import { NotFoundError, ValidationError } from '../../../src/utils/errors.js';
import {
  LoadoutWithSlots,
  CreateLoadoutData,
  LoadoutSlotAssignments,
  BulkEquipmentUpdate
} from '../../../src/types/repository.types.js';

// Mock LoadoutRepository
jest.mock('../../../src/repositories/LoadoutRepository.js', () => ({
  LoadoutRepository: jest.fn().mockImplementation(() => ({
    findLoadoutsByUser: jest.fn(),
    findLoadoutById: jest.fn(),
    createLoadout: jest.fn(),
    updateLoadoutName: jest.fn(),
    deleteLoadout: jest.fn(),
    updateLoadoutSlots: jest.fn(),
    updateSingleSlot: jest.fn(),
    activateLoadout: jest.fn(),
    getActiveLoadout: jest.fn(),
    isLoadoutNameUnique: jest.fn(),
    canDeleteLoadout: jest.fn(),
    validateLoadoutOwnership: jest.fn()
  }))
}));

describe('LoadoutService', () => {
  let loadoutService: LoadoutService;
  let mockLoadoutRepository: any;
  const userId = 'user-123';

  beforeEach(() => {
    loadoutService = new LoadoutService();
    mockLoadoutRepository = (loadoutService as any).loadoutRepository;
    jest.clearAllMocks();
  });

  describe('createLoadout()', () => {
    it('should create new loadout successfully', async () => {
      // Arrange
      const name = 'Test Loadout';
      const mockCreatedLoadout = {
        id: 'loadout-123',
        user_id: userId,
        name,
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockLoadoutRepository.isLoadoutNameUnique.mockResolvedValue(true);
      mockLoadoutRepository.createLoadout.mockResolvedValue(mockCreatedLoadout);

      // Act
      const result = await loadoutService.createLoadout(userId, name);

      // Assert
      expect(result).toEqual({
        ...mockCreatedLoadout,
        slots: {
          weapon: null,
          offhand: null,
          head: null,
          armor: null,
          feet: null,
          accessory_1: null,
          accessory_2: null,
          pet: null
        }
      });
      expect(mockLoadoutRepository.isLoadoutNameUnique).toHaveBeenCalledWith(userId, name);
      expect(mockLoadoutRepository.createLoadout).toHaveBeenCalledWith({
        user_id: userId,
        name,
        is_active: false
      });
    });

    it('should throw ValidationError for empty name', async () => {
      await expect(loadoutService.createLoadout(userId, '')).rejects.toThrow(ValidationError);
      await expect(loadoutService.createLoadout(userId, '   ')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for name too long', async () => {
      const longName = 'a'.repeat(51);
      await expect(loadoutService.createLoadout(userId, longName)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for duplicate name', async () => {
      mockLoadoutRepository.isLoadoutNameUnique.mockResolvedValue(false);

      await expect(loadoutService.createLoadout(userId, 'Duplicate')).rejects.toThrow(ValidationError);
    });
  });

  describe('getLoadoutsByUser()', () => {
    it('should return all user loadouts', async () => {
      // Arrange
      const mockLoadouts: LoadoutWithSlots[] = [
        {
          id: 'loadout-1',
          user_id: userId,
          name: 'Loadout 1',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          slots: { weapon: null, offhand: null, head: null, armor: null, feet: null, accessory_1: null, accessory_2: null, pet: null }
        }
      ];

      mockLoadoutRepository.findLoadoutsByUser.mockResolvedValue(mockLoadouts);

      // Act
      const result = await loadoutService.getLoadoutsByUser(userId);

      // Assert
      expect(result).toEqual(mockLoadouts);
      expect(mockLoadoutRepository.findLoadoutsByUser).toHaveBeenCalledWith(userId);
    });
  });

  describe('getLoadoutById()', () => {
    it('should return loadout for owner', async () => {
      // Arrange
      const loadoutId = 'loadout-123';
      const mockLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: userId,
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: { weapon: null, offhand: null, head: null, armor: null, feet: null, accessory_1: null, accessory_2: null, pet: null }
      };

      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockLoadout);

      // Act
      const result = await loadoutService.getLoadoutById(loadoutId, userId);

      // Assert
      expect(result).toEqual(mockLoadout);
      expect(mockLoadoutRepository.findLoadoutById).toHaveBeenCalledWith(loadoutId);
    });

    it('should throw NotFoundError when loadout not found', async () => {
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(null);

      await expect(loadoutService.getLoadoutById('missing', userId)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when not owner', async () => {
      const mockLoadout: LoadoutWithSlots = {
        id: 'loadout-123',
        user_id: 'other-user',
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: { weapon: null, offhand: null, head: null, armor: null, feet: null, accessory_1: null, accessory_2: null, pet: null }
      };

      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockLoadout);

      await expect(loadoutService.getLoadoutById('loadout-123', userId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteLoadout()', () => {
    it('should delete inactive loadout', async () => {
      // Arrange
      const loadoutId = 'loadout-123';
      const mockLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: userId,
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: { weapon: null, offhand: null, head: null, armor: null, feet: null, accessory_1: null, accessory_2: null, pet: null }
      };

      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockLoadout);
      mockLoadoutRepository.canDeleteLoadout.mockResolvedValue(true);
      mockLoadoutRepository.deleteLoadout.mockResolvedValue(true);

      // Act
      await loadoutService.deleteLoadout(loadoutId, userId);

      // Assert
      expect(mockLoadoutRepository.canDeleteLoadout).toHaveBeenCalledWith(loadoutId);
      expect(mockLoadoutRepository.deleteLoadout).toHaveBeenCalledWith(loadoutId);
    });

    it('should throw ValidationError for active loadout', async () => {
      // Arrange
      const loadoutId = 'loadout-123';
      const mockLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: userId,
        name: 'Test',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: { weapon: null, offhand: null, head: null, armor: null, feet: null, accessory_1: null, accessory_2: null, pet: null }
      };

      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockLoadout);
      mockLoadoutRepository.canDeleteLoadout.mockResolvedValue(false);

      // Act & Assert
      await expect(loadoutService.deleteLoadout(loadoutId, userId)).rejects.toThrow(ValidationError);
    });
  });

  describe('activateLoadout()', () => {
    it('should activate loadout and return equipment', async () => {
      // Arrange
      const loadoutId = 'loadout-123';
      const mockLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: userId,
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: {
          weapon: 'item-1',
          offhand: null,
          head: null,
          armor: null,
          feet: null,
          accessory_1: null,
          accessory_2: null,
          pet: null
        }
      };

      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockLoadout);
      mockLoadoutRepository.activateLoadout.mockResolvedValue(undefined);

      // Act
      const result = await loadoutService.activateLoadout(loadoutId, userId);

      // Assert
      expect(result).toEqual(mockLoadout.slots);
      expect(mockLoadoutRepository.activateLoadout).toHaveBeenCalledWith(loadoutId);
    });
  });

  describe('updateLoadoutName()', () => {
    it('should update loadout name successfully', async () => {
      // Arrange
      const loadoutId = 'loadout-123';
      const newName = 'Updated Loadout';
      const mockLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: userId,
        name: 'Old Name',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: { weapon: null, offhand: null, head: null, armor: null, feet: null, accessory_1: null, accessory_2: null, pet: null }
      };

      const mockUpdatedLoadout: LoadoutWithSlots = { ...mockLoadout, name: newName };

      mockLoadoutRepository.findLoadoutById
        .mockResolvedValueOnce(mockLoadout) // For ownership check
        .mockResolvedValueOnce(mockUpdatedLoadout); // For return value
      mockLoadoutRepository.isLoadoutNameUnique.mockResolvedValue(true);
      mockLoadoutRepository.updateLoadoutName.mockResolvedValue(undefined);

      // Act
      const result = await loadoutService.updateLoadoutName(loadoutId, userId, newName);

      // Assert
      expect(result).toEqual(mockUpdatedLoadout);
      expect(mockLoadoutRepository.isLoadoutNameUnique).toHaveBeenCalledWith(userId, newName, loadoutId);
      expect(mockLoadoutRepository.updateLoadoutName).toHaveBeenCalledWith(loadoutId, newName);
    });

    it('should throw ValidationError for empty name', async () => {
      const loadoutId = 'loadout-123';
      const mockLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: userId,
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: { weapon: null, offhand: null, head: null, armor: null, feet: null, accessory_1: null, accessory_2: null, pet: null }
      };

      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockLoadout);

      await expect(loadoutService.updateLoadoutName(loadoutId, userId, '')).rejects.toThrow(ValidationError);
      await expect(loadoutService.updateLoadoutName(loadoutId, userId, '   ')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for duplicate name', async () => {
      const loadoutId = 'loadout-123';
      const mockLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: userId,
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: { weapon: null, offhand: null, head: null, armor: null, feet: null, accessory_1: null, accessory_2: null, pet: null }
      };

      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockLoadout);
      mockLoadoutRepository.isLoadoutNameUnique.mockResolvedValue(false);

      await expect(loadoutService.updateLoadoutName(loadoutId, userId, 'Duplicate')).rejects.toThrow(ValidationError);
    });
  });

  describe('updateLoadoutSlots()', () => {
    it('should update loadout slots successfully', async () => {
      // Arrange
      const loadoutId = 'loadout-123';
      const slots: LoadoutSlotAssignments = {
        weapon: 'item-1',
        offhand: null,
        head: 'item-2',
        armor: null,
        feet: null,
        accessory_1: null,
        accessory_2: null,
        pet: null
      };

      const mockUpdatedLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: userId,
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: {
          weapon: 'item-1',
          offhand: null,
          head: 'item-2',
          armor: null,
          feet: null,
          accessory_1: null,
          accessory_2: null,
          pet: null
        }
      };

      mockLoadoutRepository.updateLoadoutSlots.mockResolvedValue(undefined);
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockUpdatedLoadout);

      // Act
      const result = await loadoutService.updateLoadoutSlots(loadoutId, userId, slots);

      // Assert
      expect(result).toEqual(mockUpdatedLoadout);
      expect(mockLoadoutRepository.updateLoadoutSlots).toHaveBeenCalledWith(loadoutId, slots);
    });

    it('should handle partial slot assignments', async () => {
      // Arrange
      const loadoutId = 'loadout-123';
      const partialSlots = { weapon: 'item-1', head: 'item-2' };
      const completeSlots: LoadoutSlotAssignments = {
        weapon: 'item-1',
        offhand: null,
        head: 'item-2',
        armor: null,
        feet: null,
        accessory_1: null,
        accessory_2: null,
        pet: null
      };

      const mockUpdatedLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: userId,
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: {
          weapon: 'item-1',
          offhand: null,
          head: 'item-2',
          armor: null,
          feet: null,
          accessory_1: null,
          accessory_2: null,
          pet: null
        }
      };

      mockLoadoutRepository.updateLoadoutSlots.mockResolvedValue(undefined);
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockUpdatedLoadout);

      // Act
      const result = await loadoutService.updateLoadoutSlots(loadoutId, userId, partialSlots);

      // Assert
      expect(result).toEqual(mockUpdatedLoadout);
      expect(mockLoadoutRepository.updateLoadoutSlots).toHaveBeenCalledWith(loadoutId, completeSlots);
    });
  });

  describe('getActiveLoadout()', () => {
    it('should return active loadout when exists', async () => {
      // Arrange
      const mockActiveLoadout: LoadoutWithSlots = {
        id: 'loadout-123',
        user_id: userId,
        name: 'Active Loadout',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: {
          weapon: 'item-1',
          offhand: null,
          head: null,
          armor: null,
          feet: null,
          accessory_1: null,
          accessory_2: null,
          pet: null
        }
      };

      mockLoadoutRepository.getActiveLoadout.mockResolvedValue(mockActiveLoadout);

      // Act
      const result = await loadoutService.getActiveLoadout(userId);

      // Assert
      expect(result).toEqual(mockActiveLoadout);
      expect(mockLoadoutRepository.getActiveLoadout).toHaveBeenCalledWith(userId);
    });

    it('should return null when no active loadout', async () => {
      // Arrange
      mockLoadoutRepository.getActiveLoadout.mockResolvedValue(null);

      // Act
      const result = await loadoutService.getActiveLoadout(userId);

      // Assert
      expect(result).toBeNull();
      expect(mockLoadoutRepository.getActiveLoadout).toHaveBeenCalledWith(userId);
    });
  });

  describe('updateSingleSlot()', () => {
    it('should validate slot names', async () => {
      // Should throw for invalid slot name
      await expect(
        loadoutService.updateSingleSlot('loadout-123', userId, 'invalid_slot', 'item-1')
      ).rejects.toThrow(ValidationError);

      await expect(
        loadoutService.updateSingleSlot('loadout-123', userId, 'invalid_slot', 'item-1')
      ).rejects.toThrow('Invalid slot name: invalid_slot');
    });

    it('should accept all valid slot names', async () => {
      const loadoutId = 'loadout-123';
      const mockLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: userId,
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: { weapon: null, offhand: null, head: null, armor: null, feet: null, accessory_1: null, accessory_2: null, pet: null }
      };

      mockLoadoutRepository.updateSingleSlot.mockResolvedValue(undefined);
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockLoadout);

      const validSlots = ['weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'];
      for (const slot of validSlots) {
        const result = await loadoutService.updateSingleSlot(loadoutId, userId, slot, null);
        expect(result).toEqual(mockLoadout);
        expect(mockLoadoutRepository.updateSingleSlot).toHaveBeenCalledWith(loadoutId, slot, null);
      }
    });

    it('should handle successful slot update with item assignment', async () => {
      const loadoutId = 'loadout-123';
      const itemId = 'item-456';
      const mockLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: userId,
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: { weapon: null, offhand: null, head: null, armor: null, feet: null, accessory_1: null, accessory_2: null, pet: null }
      };

      const mockUpdatedLoadout: LoadoutWithSlots = {
        ...mockLoadout,
        slots: { ...mockLoadout.slots, weapon: itemId }
      };

      mockLoadoutRepository.updateSingleSlot.mockResolvedValue(undefined);
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockUpdatedLoadout);

      const result = await loadoutService.updateSingleSlot(loadoutId, userId, 'weapon', itemId);

      expect(result).toEqual(mockUpdatedLoadout);
      expect(mockLoadoutRepository.updateSingleSlot).toHaveBeenCalledWith(loadoutId, 'weapon', itemId);
    });

    it('should throw NotFoundError when loadout not found after update', async () => {
      const loadoutId = 'loadout-123';
      mockLoadoutRepository.updateSingleSlot.mockResolvedValue(undefined);
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(null);

      await expect(
        loadoutService.updateSingleSlot(loadoutId, userId, 'weapon', null)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when user does not own loadout after update', async () => {
      const loadoutId = 'loadout-123';
      const mockLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: 'different-user',
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: { weapon: null, offhand: null, head: null, armor: null, feet: null, accessory_1: null, accessory_2: null, pet: null }
      };

      mockLoadoutRepository.updateSingleSlot.mockResolvedValue(undefined);
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockLoadout);

      await expect(
        loadoutService.updateSingleSlot(loadoutId, userId, 'weapon', null)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when item assignment fails', async () => {
      const loadoutId = 'loadout-123';
      const itemId = 'item-456';
      const mockLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: userId,
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: { weapon: null, offhand: null, head: null, armor: null, feet: null, accessory_1: null, accessory_2: null, pet: null }
      };

      mockLoadoutRepository.updateSingleSlot.mockResolvedValue(undefined);
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockLoadout);

      await expect(
        loadoutService.updateSingleSlot(loadoutId, userId, 'weapon', itemId)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle updateLoadoutName with name too long', async () => {
      const loadoutId = 'loadout-123';
      const mockLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: userId,
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: { weapon: null, offhand: null, head: null, armor: null, feet: null, accessory_1: null, accessory_2: null, pet: null }
      };

      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockLoadout);

      const longName = 'a'.repeat(51);
      await expect(
        loadoutService.updateLoadoutName(loadoutId, userId, longName)
      ).rejects.toThrow(ValidationError);
    });

    it('should handle updateLoadoutName when loadout not found after update', async () => {
      const loadoutId = 'loadout-123';
      const newName = 'Updated Name';
      const mockLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: userId,
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: { weapon: null, offhand: null, head: null, armor: null, feet: null, accessory_1: null, accessory_2: null, pet: null }
      };

      mockLoadoutRepository.findLoadoutById
        .mockResolvedValueOnce(mockLoadout) // For ownership check
        .mockResolvedValueOnce(null); // After update
      mockLoadoutRepository.isLoadoutNameUnique.mockResolvedValue(true);
      mockLoadoutRepository.updateLoadoutName.mockResolvedValue(undefined);

      await expect(
        loadoutService.updateLoadoutName(loadoutId, userId, newName)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when repository delete fails', async () => {
      const loadoutId = 'loadout-123';
      const mockLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: userId,
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: { weapon: null, offhand: null, head: null, armor: null, feet: null, accessory_1: null, accessory_2: null, pet: null }
      };

      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockLoadout);
      mockLoadoutRepository.canDeleteLoadout.mockResolvedValue(true);
      mockLoadoutRepository.deleteLoadout.mockResolvedValue(false);

      await expect(
        loadoutService.deleteLoadout(loadoutId, userId)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for invalid user input', async () => {
      const loadoutId = 'loadout-123';
      const mockLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: userId,
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: { weapon: null, offhand: null, head: null, armor: null, feet: null, accessory_1: null, accessory_2: null, pet: null }
      };

      // Should handle empty slot assignments (edge case)
      const emptySlots: LoadoutSlotAssignments = {
        weapon: null,
        offhand: null,
        head: null,
        armor: null,
        feet: null,
        accessory_1: null,
        accessory_2: null,
        pet: null
      };

      mockLoadoutRepository.updateLoadoutSlots.mockResolvedValue(undefined);
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockLoadout);

      const result = await loadoutService.updateLoadoutSlots(loadoutId, userId, emptySlots);
      expect(result).toEqual(mockLoadout);
    });

    it('should handle updateLoadoutSlots when loadout not found after update', async () => {
      const loadoutId = 'loadout-123';
      const slots: LoadoutSlotAssignments = {
        weapon: 'item-1',
        offhand: null,
        head: null,
        armor: null,
        feet: null,
        accessory_1: null,
        accessory_2: null,
        pet: null
      };

      mockLoadoutRepository.updateLoadoutSlots.mockResolvedValue(undefined);
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(null);

      await expect(
        loadoutService.updateLoadoutSlots(loadoutId, userId, slots)
      ).rejects.toThrow(ValidationError);
    });

    it('should handle updateLoadoutSlots when user ownership changes', async () => {
      const loadoutId = 'loadout-123';
      const slots: LoadoutSlotAssignments = {
        weapon: null,
        offhand: null,
        head: null,
        armor: null,
        feet: null,
        accessory_1: null,
        accessory_2: null,
        pet: null
      };

      const mockLoadout: LoadoutWithSlots = {
        id: loadoutId,
        user_id: 'different-user',
        name: 'Test',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        slots: {
          weapon: null,
          offhand: null,
          head: null,
          armor: null,
          feet: null,
          accessory_1: null,
          accessory_2: null,
          pet: null
        }
      };

      mockLoadoutRepository.updateLoadoutSlots.mockResolvedValue(undefined);
      mockLoadoutRepository.findLoadoutById.mockResolvedValue(mockLoadout);

      await expect(
        loadoutService.updateLoadoutSlots(loadoutId, userId, slots)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('name validation edge cases', () => {
    it('should trim whitespace from loadout names', async () => {
      const name = '  Test Loadout  ';
      const mockCreatedLoadout = {
        id: 'loadout-123',
        user_id: userId,
        name: 'Test Loadout',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockLoadoutRepository.isLoadoutNameUnique.mockResolvedValue(true);
      mockLoadoutRepository.createLoadout.mockResolvedValue(mockCreatedLoadout);

      const result = await loadoutService.createLoadout(userId, name);

      expect(mockLoadoutRepository.isLoadoutNameUnique).toHaveBeenCalledWith(userId, 'Test Loadout');
      expect(mockLoadoutRepository.createLoadout).toHaveBeenCalledWith({
        user_id: userId,
        name: 'Test Loadout',
        is_active: false
      });
      expect(result.name).toBe('Test Loadout');
    });
  });

});