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

      // Act & Assert
      await expect(loadoutService.deleteLoadout(loadoutId, userId)).resolves.not.toThrow();
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

  describe('updateSingleSlot()', () => {
    it('should validate slot names', async () => {
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

      // Should throw for invalid slot name
      await expect(
        loadoutService.updateSingleSlot(loadoutId, userId, 'invalid_slot', 'item-1')
      ).rejects.toThrow(ValidationError);

      // Should work for valid slot names
      mockLoadoutRepository.updateSingleSlot.mockResolvedValue(undefined);

      const validSlots = ['weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'];
      for (const slot of validSlots) {
        await expect(
          loadoutService.updateSingleSlot(loadoutId, userId, slot, null)
        ).resolves.not.toThrow();
      }
    });
  });

});