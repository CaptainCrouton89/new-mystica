/**
 * LoadoutRepository Unit Tests
 *
 * Comprehensive test suite for LoadoutRepository covering:
 * - Loadout CRUD operations
 * - Slot assignments and bulk updates
 * - Activation logic and active loadout tracking
 * - Validation helpers and constraint handling
 * - Error scenarios and edge cases
 */

import { LoadoutRepository } from '../../../src/repositories/LoadoutRepository.js';
import { ValidationError, NotFoundError, DatabaseError } from '../../../src/utils/errors.js';
import { createMockSupabaseClient } from '../../helpers/mockSupabase.js';

describe('LoadoutRepository', () => {
  let repository: LoadoutRepository;
  let mockClient: any;

  const mockUserId = 'user-123';
  const mockLoadoutId = 'loadout-456';
  const mockItemId = 'item-789';

  const mockLoadout = {
    id: mockLoadoutId,
    user_id: mockUserId,
    name: 'Test Loadout',
    is_active: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  const mockLoadoutSlots = [
    { slot_name: 'weapon', item_id: 'weapon-item-1' },
    { slot_name: 'armor', item_id: 'armor-item-1' },
    { slot_name: 'head', item_id: null }
  ];

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    repository = new LoadoutRepository();
    // Override the client for testing
    (repository as any).client = mockClient;
  });

  describe('findLoadoutsByUser', () => {
    it('should return user loadouts with slots', async () => {
      const mockResponseData = [{
        ...mockLoadout,
        loadoutslots: mockLoadoutSlots
      }];

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: mockResponseData, error: null })
          })
        })
      });

      const result = await repository.findLoadoutsByUser(mockUserId);

      expect(mockClient.from).toHaveBeenCalledWith('loadouts');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: mockLoadoutId,
        user_id: mockUserId,
        name: 'Test Loadout',
        slots: {
          weapon: 'weapon-item-1',
          armor: 'armor-item-1',
          head: null,
          offhand: null,
          feet: null,
          accessory_1: null,
          accessory_2: null,
          pet: null
        }
      });
    });

    it('should handle empty results', async () => {
      mockSupabase.select.mockResolvedValue({ data: [], error: null });

      const result = await repository.findLoadoutsByUser(mockUserId);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on query failure', async () => {
      mockSupabase.select.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(repository.findLoadoutsByUser(mockUserId))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('findLoadoutById', () => {
    it('should return loadout with slots by ID', async () => {
      const mockResponse = {
        data: {
          ...mockLoadout,
          loadoutslots: mockLoadoutSlots
        },
        error: null
      };

      mockSupabase.single.mockResolvedValue(mockResponse);

      const result = await repository.findLoadoutById(mockLoadoutId);

      expect(mockSupabase.from).toHaveBeenCalledWith('loadouts');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', mockLoadoutId);
      expect(result).toMatchObject({
        id: mockLoadoutId,
        slots: {
          weapon: 'weapon-item-1',
          armor: 'armor-item-1'
        }
      });
    });

    it('should return null when loadout not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      const result = await repository.findLoadoutById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createLoadout', () => {
    it('should create new loadout successfully', async () => {
      const createData = {
        user_id: mockUserId,
        name: 'New Loadout',
        is_active: false
      };

      mockSupabase.single.mockResolvedValue({
        data: { ...mockLoadout, name: 'New Loadout' },
        error: null
      });

      const result = await repository.createLoadout(createData);

      expect(mockSupabase.from).toHaveBeenCalledWith('loadouts');
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        user_id: mockUserId,
        name: 'New Loadout',
        is_active: false
      });
      expect(result.name).toBe('New Loadout');
    });

    it('should throw ValidationError on duplicate name', async () => {
      const createData = {
        user_id: mockUserId,
        name: 'Duplicate Name'
      };

      mockSupabase.single.mockRejectedValue({
        code: '23505',
        constraint: 'unique_loadout_name'
      });

      await expect(repository.createLoadout(createData))
        .rejects.toThrow(ValidationError);
    });

    it('should default is_active to false', async () => {
      const createData = {
        user_id: mockUserId,
        name: 'Test Loadout'
      };

      mockSupabase.single.mockResolvedValue({
        data: mockLoadout,
        error: null
      });

      await repository.createLoadout(createData);

      expect(mockSupabase.insert).toHaveBeenCalledWith({
        user_id: mockUserId,
        name: 'Test Loadout',
        is_active: false
      });
    });
  });

  describe('updateLoadoutName', () => {
    it('should update loadout name successfully', async () => {
      const newName = 'Updated Name';

      mockSupabase.single.mockResolvedValue({
        data: { ...mockLoadout, name: newName },
        error: null
      });

      const result = await repository.updateLoadoutName(mockLoadoutId, newName);

      expect(mockSupabase.from).toHaveBeenCalledWith('loadouts');
      expect(mockSupabase.update).toHaveBeenCalledWith({
        name: newName,
        updated_at: expect.any(String)
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', mockLoadoutId);
      expect(result.name).toBe(newName);
    });

    it('should throw NotFoundError when loadout not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      await expect(repository.updateLoadoutName('nonexistent', 'New Name'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError on duplicate name', async () => {
      mockSupabase.single.mockRejectedValue({
        code: '23505',
        constraint: 'unique_loadout_name'
      });

      await expect(repository.updateLoadoutName(mockLoadoutId, 'Duplicate'))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('deleteLoadout', () => {
    it('should delete loadout successfully when not active', async () => {
      // Mock canDeleteLoadout to return true
      jest.spyOn(repository, 'canDeleteLoadout').mockResolvedValue(true);

      mockSupabase.delete.mockResolvedValue({
        error: null,
        count: 1
      });

      const result = await repository.deleteLoadout(mockLoadoutId);

      expect(repository.canDeleteLoadout).toHaveBeenCalledWith(mockLoadoutId);
      expect(mockSupabase.from).toHaveBeenCalledWith('loadouts');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', mockLoadoutId);
      expect(result).toBe(true);
    });

    it('should throw ValidationError when trying to delete active loadout', async () => {
      jest.spyOn(repository, 'canDeleteLoadout').mockResolvedValue(false);

      await expect(repository.deleteLoadout(mockLoadoutId))
        .rejects.toThrow(ValidationError);
    });

    it('should return false when loadout not found', async () => {
      jest.spyOn(repository, 'canDeleteLoadout').mockResolvedValue(true);

      mockSupabase.delete.mockResolvedValue({
        error: null,
        count: 0
      });

      const result = await repository.deleteLoadout('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getLoadoutSlots', () => {
    it('should return loadout slots as object', async () => {
      mockSupabase.select.mockResolvedValue({
        data: mockLoadoutSlots,
        error: null
      });

      const result = await repository.getLoadoutSlots(mockLoadoutId);

      expect(mockSupabase.from).toHaveBeenCalledWith('loadoutslots');
      expect(mockSupabase.eq).toHaveBeenCalledWith('loadout_id', mockLoadoutId);
      expect(result).toEqual({
        weapon: 'weapon-item-1',
        armor: 'armor-item-1',
        head: null
      });
    });

    it('should return empty object when no slots', async () => {
      mockSupabase.select.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await repository.getLoadoutSlots(mockLoadoutId);

      expect(result).toEqual({});
    });
  });

  describe('updateLoadoutSlots', () => {
    const mockSlots = {
      weapon: 'weapon-item-1',
      armor: 'armor-item-1',
      head: null,
      offhand: null,
      feet: null,
      accessory_1: null,
      accessory_2: null,
      pet: null
    };

    beforeEach(() => {
      // Mock findById to return loadout
      jest.spyOn(repository, 'findById').mockResolvedValue(mockLoadout);

      // Mock validateItemOwnership
      jest.spyOn(repository as any, 'validateItemOwnership').mockResolvedValue(undefined);
    });

    it('should update all loadout slots atomically', async () => {
      mockSupabase.delete.mockResolvedValue({ error: null });
      mockSupabase.insert.mockResolvedValue({ error: null });
      mockSupabase.update.mockResolvedValue({ error: null });

      await repository.updateLoadoutSlots(mockLoadoutId, mockSlots);

      // Should delete existing slots
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('loadout_id', mockLoadoutId);

      // Should insert non-null slots
      expect(mockSupabase.insert).toHaveBeenCalledWith([
        { loadout_id: mockLoadoutId, slot_name: 'weapon', item_id: 'weapon-item-1' },
        { loadout_id: mockLoadoutId, slot_name: 'armor', item_id: 'armor-item-1' }
      ]);

      // Should update loadout timestamp
      expect(mockSupabase.update).toHaveBeenCalledWith({
        updated_at: expect.any(String)
      });
    });

    it('should throw NotFoundError when loadout not found', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      await expect(repository.updateLoadoutSlots('nonexistent', mockSlots))
        .rejects.toThrow(NotFoundError);
    });

    it('should validate item ownership', async () => {
      const validateSpy = jest.spyOn(repository as any, 'validateItemOwnership');

      mockSupabase.delete.mockResolvedValue({ error: null });
      mockSupabase.insert.mockResolvedValue({ error: null });
      mockSupabase.update.mockResolvedValue({ error: null });

      await repository.updateLoadoutSlots(mockLoadoutId, mockSlots);

      expect(validateSpy).toHaveBeenCalledWith(
        ['weapon-item-1', 'armor-item-1'],
        mockUserId
      );
    });
  });

  describe('updateSingleSlot', () => {
    beforeEach(() => {
      jest.spyOn(repository, 'findById').mockResolvedValue(mockLoadout);
      jest.spyOn(repository as any, 'validateItemOwnership').mockResolvedValue(undefined);
    });

    it('should update single slot with item', async () => {
      mockSupabase.upsert.mockResolvedValue({ error: null });
      mockSupabase.update.mockResolvedValue({ error: null });

      await repository.updateSingleSlot(mockLoadoutId, 'weapon', mockItemId);

      expect(mockSupabase.upsert).toHaveBeenCalledWith({
        loadout_id: mockLoadoutId,
        slot_name: 'weapon',
        item_id: mockItemId
      });
    });

    it('should remove slot when itemId is null', async () => {
      mockSupabase.delete.mockResolvedValue({ error: null });
      mockSupabase.update.mockResolvedValue({ error: null });

      await repository.updateSingleSlot(mockLoadoutId, 'weapon', null);

      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('loadout_id', mockLoadoutId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('slot_name', 'weapon');
    });
  });

  describe('setActiveLoadout', () => {
    beforeEach(() => {
      jest.spyOn(repository, 'validateLoadoutOwnership').mockResolvedValue(true);
    });

    it('should deactivate all loadouts and activate target', async () => {
      mockSupabase.update.mockResolvedValue({ error: null });

      await repository.setActiveLoadout(mockUserId, mockLoadoutId);

      // Should deactivate all user loadouts
      expect(mockSupabase.update).toHaveBeenCalledWith({
        is_active: false,
        updated_at: expect.any(String)
      });

      // Should activate target loadout
      expect(mockSupabase.update).toHaveBeenCalledWith({
        is_active: true,
        updated_at: expect.any(String)
      });
    });

    it('should throw NotFoundError for invalid ownership', async () => {
      jest.spyOn(repository, 'validateLoadoutOwnership').mockResolvedValue(false);

      await expect(repository.setActiveLoadout(mockUserId, 'wrong-loadout'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('getActiveLoadout', () => {
    it('should return active loadout with slots', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          ...mockLoadout,
          is_active: true,
          loadoutslots: mockLoadoutSlots
        },
        error: null
      });

      const result = await repository.getActiveLoadout(mockUserId);

      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('is_active', true);
      expect(result?.is_active).toBe(true);
    });

    it('should return null when no active loadout', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      const result = await repository.getActiveLoadout(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('activateLoadout', () => {
    const mockLoadoutWithSlots = {
      ...mockLoadout,
      slots: {
        weapon: 'weapon-item-1',
        armor: 'armor-item-1',
        head: null,
        offhand: null,
        feet: null,
        accessory_1: null,
        accessory_2: null,
        pet: null
      }
    };

    beforeEach(() => {
      jest.spyOn(repository, 'findLoadoutById').mockResolvedValue(mockLoadoutWithSlots);
      jest.spyOn(repository, 'setActiveLoadout').mockResolvedValue(undefined);
    });

    it('should activate loadout and copy slots to equipment', async () => {
      mockSupabase.delete.mockResolvedValue({ error: null });
      mockSupabase.insert.mockResolvedValue({ error: null });

      await repository.activateLoadout(mockLoadoutId);

      expect(repository.setActiveLoadout).toHaveBeenCalledWith(mockUserId, mockLoadoutId);

      // Should delete existing equipment
      expect(mockSupabase.delete).toHaveBeenCalled();

      // Should insert new equipment (only non-null slots)
      expect(mockSupabase.insert).toHaveBeenCalledWith([
        {
          user_id: mockUserId,
          slot_name: 'weapon',
          item_id: 'weapon-item-1',
          equipped_at: expect.any(String)
        },
        {
          user_id: mockUserId,
          slot_name: 'armor',
          item_id: 'armor-item-1',
          equipped_at: expect.any(String)
        }
      ]);
    });

    it('should throw NotFoundError when loadout not found', async () => {
      jest.spyOn(repository, 'findLoadoutById').mockResolvedValue(null);

      await expect(repository.activateLoadout('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('validation helpers', () => {
    describe('isLoadoutNameUnique', () => {
      it('should return true when name is unique', async () => {
        mockSupabase.count.mockResolvedValue({ count: 0, error: null });

        const result = await repository.isLoadoutNameUnique(mockUserId, 'Unique Name');

        expect(result).toBe(true);
      });

      it('should return false when name exists', async () => {
        mockSupabase.count.mockResolvedValue({ count: 1, error: null });

        const result = await repository.isLoadoutNameUnique(mockUserId, 'Existing Name');

        expect(result).toBe(false);
      });

      it('should exclude specific loadout ID from check', async () => {
        mockSupabase.count.mockResolvedValue({ count: 0, error: null });

        await repository.isLoadoutNameUnique(mockUserId, 'Name', 'exclude-id');

        expect(mockSupabase.neq).toHaveBeenCalledWith('id', 'exclude-id');
      });
    });

    describe('validateLoadoutOwnership', () => {
      it('should return true for valid ownership', async () => {
        mockSupabase.count.mockResolvedValue({ count: 1, error: null });

        const result = await repository.validateLoadoutOwnership(mockLoadoutId, mockUserId);

        expect(result).toBe(true);
      });

      it('should return false for invalid ownership', async () => {
        mockSupabase.count.mockResolvedValue({ count: 0, error: null });

        const result = await repository.validateLoadoutOwnership(mockLoadoutId, 'wrong-user');

        expect(result).toBe(false);
      });
    });

    describe('canDeleteLoadout', () => {
      it('should return true for inactive loadout', async () => {
        mockSupabase.single.mockResolvedValue({
          data: { is_active: false },
          error: null
        });

        const result = await repository.canDeleteLoadout(mockLoadoutId);

        expect(result).toBe(true);
      });

      it('should return false for active loadout', async () => {
        mockSupabase.single.mockResolvedValue({
          data: { is_active: true },
          error: null
        });

        const result = await repository.canDeleteLoadout(mockLoadoutId);

        expect(result).toBe(false);
      });

      it('should return false when loadout not found', async () => {
        mockSupabase.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        });

        const result = await repository.canDeleteLoadout('nonexistent');

        expect(result).toBe(false);
      });
    });
  });

  describe('validateItemOwnership', () => {
    it('should validate all items belong to user', async () => {
      const itemIds = ['item-1', 'item-2'];

      mockSupabase.count.mockResolvedValue({ count: 2, error: null });

      await (repository as any).validateItemOwnership(itemIds, mockUserId);

      expect(mockSupabase.from).toHaveBeenCalledWith('items');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockSupabase.in).toHaveBeenCalledWith('id', itemIds);
    });

    it('should throw ValidationError when ownership mismatch', async () => {
      const itemIds = ['item-1', 'item-2'];

      mockSupabase.count.mockResolvedValue({ count: 1, error: null }); // Only 1 found, 2 expected

      await expect((repository as any).validateItemOwnership(itemIds, mockUserId))
        .rejects.toThrow(ValidationError);
    });
  });
});