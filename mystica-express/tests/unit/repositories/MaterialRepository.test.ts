/**
 * MaterialRepository Unit Tests
 *
 * Tests for the MaterialRepository including:
 * - Material template queries (seed data)
 * - MaterialStacks composite PK operations
 * - MaterialInstance lifecycle management
 * - ItemMaterials junction operations
 * - Atomic transaction RPC calls
 * - Error handling and edge cases
 */

import { MaterialRepository } from '../../../src/repositories/MaterialRepository.js';
import { DatabaseError, NotFoundError, BusinessLogicError } from '../../../src/utils/errors.js';
import { MaterialInstance, AppliedMaterial } from '../../../src/types/repository.types.js';
import { Database } from '../../../src/types/database.types.js';

type Material = Database['public']['Tables']['materials']['Row'];
type MaterialStack = Database['public']['Tables']['materialstacks']['Row'];

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn()
};

// Mock query builder
const mockQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis()
};

describe('MaterialRepository', () => {
  let repository: MaterialRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new MaterialRepository(mockSupabase as any);
    mockSupabase.from.mockReturnValue(mockQuery);
  });

  // ============================================================================
  // Material Templates (Seed Data)
  // ============================================================================

  describe('Material Templates', () => {
    const mockMaterial: Material = {
      id: 'material-123',
      name: 'Crystal',
      stat_modifiers: { atkPower: 5, atkAccuracy: -5, defPower: 0, defAccuracy: 0 },
      base_drop_weight: 100,
      description: 'A mystical crystal',
      created_at: '2024-01-01T00:00:00.000Z'
    };

    describe('findMaterialById', () => {
      it('should find material by ID', async () => {
        mockQuery.single.mockResolvedValue({ data: mockMaterial, error: null });

        const result = await repository.findMaterialById('material-123');

        expect(result).toEqual(mockMaterial);
        expect(mockSupabase.from).toHaveBeenCalledWith('materials');
        expect(mockQuery.select).toHaveBeenCalledWith('*');
        expect(mockQuery.eq).toHaveBeenCalledWith('id', 'material-123');
      });

      it('should return null when material not found', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' }
        });

        const result = await repository.findMaterialById('non-existent');

        expect(result).toBeNull();
      });

      it('should throw DatabaseError on query failure', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'UNKNOWN', message: 'Database error' }
        });

        await expect(repository.findMaterialById('material-123')).rejects.toThrow();
      });
    });

    describe('findAllMaterials', () => {
      it('should return all materials ordered by name', async () => {
        const materials = [mockMaterial];
        mockQuery.single.mockResolvedValue({ data: materials, error: null });

        const result = await repository.findAllMaterials();

        expect(result).toEqual(materials);
        expect(mockQuery.order).toHaveBeenCalledWith('name');
      });
    });

    describe('findMaterialsByTheme', () => {
      it('should find materials by theme using ilike search', async () => {
        const materials = [mockMaterial];
        mockQuery.single.mockResolvedValue({ data: materials, error: null });

        const result = await repository.findMaterialsByTheme('mystical');

        expect(result).toEqual(materials);
        expect(mockQuery.ilike).toHaveBeenCalledWith('description', '%mystical%');
      });
    });
  });

  // ============================================================================
  // MaterialStacks (Composite Primary Key)
  // ============================================================================

  describe('MaterialStacks', () => {
    const mockStack: MaterialStack = {
      user_id: 'user-123',
      material_id: 'material-456',
      style_id: 'style-789',
      quantity: 5,
      updated_at: '2024-01-01T00:00:00.000Z'
    };

    describe('findStackByUser', () => {
      it('should find stack by composite key', async () => {
        mockQuery.single.mockResolvedValue({ data: mockStack, error: null });

        const result = await repository.findStackByUser('user-123', 'material-456', 'style-789');

        expect(result).toEqual(mockStack);
        expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(mockQuery.eq).toHaveBeenCalledWith('material_id', 'material-456');
        expect(mockQuery.eq).toHaveBeenCalledWith('style_id', 'style-789');
      });

      it('should return null when stack not found', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' }
        });

        const result = await repository.findStackByUser('user-123', 'material-456', 'style-789');

        expect(result).toBeNull();
      });
    });

    describe('findAllStacksByUser', () => {
      it('should find all non-zero stacks for user', async () => {
        const stacks = [mockStack];
        mockQuery.single.mockResolvedValue({ data: stacks, error: null });

        const result = await repository.findAllStacksByUser('user-123');

        expect(result).toEqual(stacks);
        expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(mockQuery.gt).toHaveBeenCalledWith('quantity', 0);
        expect(mockQuery.order).toHaveBeenCalledWith('material_id');
      });
    });

    describe('findStyledMaterialsByUser', () => {
      it('should find only styled materials (style_id != normal)', async () => {
        const styledStacks = [mockStack];
        mockQuery.single.mockResolvedValue({ data: styledStacks, error: null });

        const result = await repository.findStyledMaterialsByUser('user-123');

        expect(result).toEqual(styledStacks);
        expect(mockQuery.neq).toHaveBeenCalledWith('style_id', 'normal');
      });
    });

    describe('incrementStack', () => {
      it('should increment existing stack quantity', async () => {
        const existingStack = { ...mockStack, quantity: 3 };
        const updatedStack = { ...mockStack, quantity: 8 };

        // Mock findStackByUser
        mockQuery.single.mockResolvedValueOnce({ data: existingStack, error: null });
        // Mock update operation
        mockQuery.single.mockResolvedValueOnce({ data: updatedStack, error: null });

        const result = await repository.incrementStack('user-123', 'material-456', 'style-789', 5);

        expect(result).toEqual(updatedStack);
      });

      it('should create new stack if none exists', async () => {
        // Mock findStackByUser returns null
        mockQuery.single.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' }
        });
        // Mock create operation
        mockQuery.single.mockResolvedValueOnce({ data: mockStack, error: null });

        const result = await repository.incrementStack('user-123', 'material-456', 'style-789', 5);

        expect(result).toEqual(mockStack);
        expect(mockQuery.insert).toHaveBeenCalledWith({
          user_id: 'user-123',
          material_id: 'material-456',
          style_id: 'style-789',
          quantity: 5
        });
      });

      it('should throw error for non-positive quantity', async () => {
        await expect(
          repository.incrementStack('user-123', 'material-456', 'style-789', 0)
        ).rejects.toThrow(BusinessLogicError);

        await expect(
          repository.incrementStack('user-123', 'material-456', 'style-789', -5)
        ).rejects.toThrow(BusinessLogicError);
      });
    });

    describe('decrementStack', () => {
      it('should decrement stack quantity', async () => {
        const existingStack = { ...mockStack, quantity: 10 };
        const updatedStack = { ...mockStack, quantity: 5 };

        mockQuery.single.mockResolvedValueOnce({ data: existingStack, error: null });
        mockQuery.single.mockResolvedValueOnce({ data: updatedStack, error: null });

        const result = await repository.decrementStack('user-123', 'material-456', 'style-789', 5);

        expect(result).toEqual(updatedStack);
      });

      it('should delete stack when quantity reaches zero', async () => {
        const existingStack = { ...mockStack, quantity: 5 };
        const zeroStack = { ...mockStack, quantity: 0 };

        mockQuery.single.mockResolvedValueOnce({ data: existingStack, error: null });
        mockQuery.delete.mockResolvedValue({ error: null, count: 1 });

        const result = await repository.decrementStack('user-123', 'material-456', 'style-789', 5);

        expect(result).toEqual(zeroStack);
        expect(mockQuery.delete).toHaveBeenCalled();
      });

      it('should throw error when stack not found', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' }
        });

        await expect(
          repository.decrementStack('user-123', 'material-456', 'style-789', 5)
        ).rejects.toThrow(NotFoundError);
      });

      it('should throw error when insufficient quantity', async () => {
        const existingStack = { ...mockStack, quantity: 3 };
        mockQuery.single.mockResolvedValue({ data: existingStack, error: null });

        await expect(
          repository.decrementStack('user-123', 'material-456', 'style-789', 5)
        ).rejects.toThrow(BusinessLogicError);
      });
    });

    describe('createStack', () => {
      it('should create new material stack', async () => {
        mockQuery.single.mockResolvedValue({ data: mockStack, error: null });

        const result = await repository.createStack('user-123', 'material-456', 'style-789', 5);

        expect(result).toEqual(mockStack);
        expect(mockQuery.insert).toHaveBeenCalledWith({
          user_id: 'user-123',
          material_id: 'material-456',
          style_id: 'style-789',
          quantity: 5
        });
      });

      it('should throw error for non-positive quantity', async () => {
        await expect(
          repository.createStack('user-123', 'material-456', 'style-789', 0)
        ).rejects.toThrow(BusinessLogicError);
      });
    });
  });

  // ============================================================================
  // MaterialInstances
  // ============================================================================

  describe('MaterialInstances', () => {
    const mockInstance: MaterialInstance = {
      id: 'instance-123',
      user_id: 'user-456',
      material_id: 'material-789',
      style_id: 'style-abc',
      created_at: '2024-01-01T00:00:00.000Z'
    };

    describe('createInstance', () => {
      it('should create material instance', async () => {
        mockQuery.single.mockResolvedValue({ data: mockInstance, error: null });

        const result = await repository.createInstance('user-456', 'material-789', 'style-abc');

        expect(result).toEqual(mockInstance);
        expect(mockQuery.insert).toHaveBeenCalledWith({
          user_id: 'user-456',
          material_id: 'material-789',
          style_id: 'style-abc'
        });
      });
    });

    describe('findInstanceById', () => {
      it('should find instance by ID', async () => {
        mockQuery.single.mockResolvedValue({ data: mockInstance, error: null });

        const result = await repository.findInstanceById('instance-123');

        expect(result).toEqual(mockInstance);
        expect(mockQuery.eq).toHaveBeenCalledWith('id', 'instance-123');
      });

      it('should return null when not found', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' }
        });

        const result = await repository.findInstanceById('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('deleteInstance', () => {
      it('should delete instance and return its data', async () => {
        mockQuery.single.mockResolvedValueOnce({ data: mockInstance, error: null });
        mockQuery.delete.mockResolvedValue({ error: null, count: 1 });

        const result = await repository.deleteInstance('instance-123');

        expect(result).toEqual(mockInstance);
        expect(mockQuery.delete).toHaveBeenCalled();
      });

      it('should throw error when instance not found', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' }
        });

        await expect(repository.deleteInstance('non-existent')).rejects.toThrow(NotFoundError);
      });
    });
  });

  // ============================================================================
  // ItemMaterials Junction Operations
  // ============================================================================

  describe('ItemMaterials', () => {
    describe('applyToItem', () => {
      it('should apply material instance to item slot', async () => {
        mockQuery.insert.mockResolvedValue({ error: null });

        await repository.applyToItem('item-123', 'instance-456', 1);

        expect(mockQuery.insert).toHaveBeenCalledWith({
          item_id: 'item-123',
          material_instance_id: 'instance-456',
          slot_index: 1
        });
      });

      it('should throw error for invalid slot index', async () => {
        await expect(repository.applyToItem('item-123', 'instance-456', -1)).rejects.toThrow(BusinessLogicError);
        await expect(repository.applyToItem('item-123', 'instance-456', 3)).rejects.toThrow(BusinessLogicError);
      });

      it('should throw error when slot is occupied', async () => {
        mockQuery.insert.mockResolvedValue({
          error: { code: '23505', message: 'unique_item_slot constraint violation' }
        });

        await expect(repository.applyToItem('item-123', 'instance-456', 1)).rejects.toThrow(BusinessLogicError);
      });

      it('should throw error when instance already applied', async () => {
        mockQuery.insert.mockResolvedValue({
          error: { code: '23505', message: 'material_instance_id unique constraint violation' }
        });

        await expect(repository.applyToItem('item-123', 'instance-456', 1)).rejects.toThrow(BusinessLogicError);
      });
    });

    describe('removeFromItem', () => {
      const mockInstance: MaterialInstance = {
        id: 'instance-456',
        user_id: 'user-123',
        material_id: 'material-789',
        style_id: 'style-abc',
        created_at: '2024-01-01T00:00:00.000Z'
      };

      it('should remove material from item slot', async () => {
        mockQuery.single.mockResolvedValueOnce({
          data: { material_instance_id: 'instance-456' },
          error: null
        });
        mockQuery.single.mockResolvedValueOnce({ data: mockInstance, error: null });
        mockQuery.delete.mockResolvedValue({ error: null, count: 1 });

        const result = await repository.removeFromItem('item-123', 1);

        expect(result).toEqual(mockInstance);
        expect(mockQuery.delete).toHaveBeenCalled();
      });

      it('should throw error when slot is empty', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' }
        });

        await expect(repository.removeFromItem('item-123', 1)).rejects.toThrow(NotFoundError);
      });
    });

    describe('getSlotOccupancy', () => {
      it('should return occupied slot indices', async () => {
        const occupiedSlots = [
          { slot_index: 0 },
          { slot_index: 2 }
        ];
        mockQuery.single.mockResolvedValue({ data: occupiedSlots, error: null });

        const result = await repository.getSlotOccupancy('item-123');

        expect(result).toEqual([0, 2]);
        expect(mockQuery.order).toHaveBeenCalledWith('slot_index');
      });
    });
  });

  // ============================================================================
  // Atomic Transaction Operations (RPC)
  // ============================================================================

  describe('Atomic Operations', () => {
    describe('applyMaterialToItemAtomic', () => {
      it('should atomically apply material via RPC', async () => {
        const rpcResult = [{
          instance_id: 'instance-123',
          new_stack_quantity: 4,
          item_is_styled: true
        }];
        const mockInstance: MaterialInstance = {
          id: 'instance-123',
          user_id: 'user-123',
          material_id: 'material-456',
          style_id: 'style-789',
          created_at: '2024-01-01T00:00:00.000Z'
        };

        mockSupabase.rpc.mockResolvedValue({ data: rpcResult, error: null });
        mockQuery.single.mockResolvedValue({ data: mockInstance, error: null });

        const result = await repository.applyMaterialToItemAtomic(
          'user-123', 'item-456', 'material-789', 'style-abc', 1
        );

        expect(result.instance).toEqual(mockInstance);
        expect(result.newStackQuantity).toBe(4);
        expect(mockSupabase.rpc).toHaveBeenCalledWith('apply_material_to_item', {
          p_user_id: 'user-123',
          p_item_id: 'item-456',
          p_material_id: 'material-789',
          p_style_id: 'style-abc',
          p_slot_index: 1
        });
      });

      it('should throw error when RPC returns no result', async () => {
        mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

        await expect(
          repository.applyMaterialToItemAtomic('user-123', 'item-456', 'material-789', 'style-abc', 1)
        ).rejects.toThrow(DatabaseError);
      });
    });

    describe('removeMaterialFromItemAtomic', () => {
      it('should atomically remove material via RPC', async () => {
        const rpcResult = [{
          removed_instance_id: 'instance-123',
          material_id: 'material-456',
          style_id: 'style-789',
          user_id: 'user-123',
          new_stack_quantity: 6,
          item_is_styled: false
        }];

        mockSupabase.rpc.mockResolvedValue({ data: rpcResult, error: null });

        const result = await repository.removeMaterialFromItemAtomic('item-456', 1);

        expect(result.removedInstance.id).toBe('instance-123');
        expect(result.removedInstance.material_id).toBe('material-456');
        expect(result.newStackQuantity).toBe(6);
        expect(mockSupabase.rpc).toHaveBeenCalledWith('remove_material_from_item', {
          p_item_id: 'item-456',
          p_slot_index: 1
        });
      });
    });

    describe('replaceMaterialOnItemAtomic', () => {
      it('should atomically replace material via RPC', async () => {
        const rpcResult = [{
          old_instance_id: 'old-instance-123',
          old_material_id: 'old-material-456',
          old_style_id: 'old-style-789',
          old_stack_quantity: 3,
          new_instance_id: 'new-instance-456',
          new_stack_quantity: 7,
          item_is_styled: true
        }];
        const mockNewInstance: MaterialInstance = {
          id: 'new-instance-456',
          user_id: 'user-123',
          material_id: 'new-material-789',
          style_id: 'new-style-abc',
          created_at: '2024-01-01T00:00:00.000Z'
        };

        mockSupabase.rpc.mockResolvedValue({ data: rpcResult, error: null });
        mockQuery.single.mockResolvedValue({ data: mockNewInstance, error: null });

        const result = await repository.replaceMaterialOnItemAtomic(
          'user-123', 'item-456', 1, 'new-material-789', 'new-style-abc'
        );

        expect(result.oldInstance.id).toBe('old-instance-123');
        expect(result.newInstance).toEqual(mockNewInstance);
        expect(result.oldStackQuantity).toBe(3);
        expect(result.newStackQuantity).toBe(7);
      });
    });
  });

  // ============================================================================
  // Batch Operations
  // ============================================================================

  describe('Batch Operations', () => {
    describe('batchIncrementStacks', () => {
      it('should batch increment multiple material stacks', async () => {
        const updates = [
          { userId: 'user-123', materialId: 'mat-1', styleId: 'style-1', quantity: 3 },
          { userId: 'user-123', materialId: 'mat-2', styleId: 'style-2', quantity: 5 }
        ];
        const mockStacks = [
          { user_id: 'user-123', material_id: 'mat-1', style_id: 'style-1', quantity: 3, updated_at: '2024-01-01T00:00:00.000Z' },
          { user_id: 'user-123', material_id: 'mat-2', style_id: 'style-2', quantity: 5, updated_at: '2024-01-01T00:00:00.000Z' }
        ];

        // Mock both stacks don't exist (findStackByUser returns null)
        mockQuery.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
        mockQuery.single.mockResolvedValueOnce({ data: mockStacks[0], error: null });
        mockQuery.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
        mockQuery.single.mockResolvedValueOnce({ data: mockStacks[1], error: null });

        const result = await repository.batchIncrementStacks(updates);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(mockStacks[0]);
        expect(result[1]).toEqual(mockStacks[1]);
      });
    });
  });
});