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
import { createMockSupabaseClient } from '../../helpers/mockSupabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

type Material = Database['public']['Tables']['materials']['Row'];
type MaterialStack = Database['public']['Tables']['materialstacks']['Row'];

describe('MaterialRepository', () => {
  let repository: MaterialRepository;
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockSupabaseClient();
    repository = new MaterialRepository();
    // Override the client for testing
    (repository as any).client = mockClient;
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
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockMaterial,
                error: null
              })
            })
          })
        });

        const result = await repository.findMaterialById('material-123');

        expect(result).toEqual(mockMaterial);
        expect(mockClient.from).toHaveBeenCalledWith('materials');
      });

      it('should return null when material not found', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows found' }
              })
            })
          })
        });

        const result = await repository.findMaterialById('non-existent');

        expect(result).toBeNull();
      });

      it('should throw DatabaseError on query failure', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'UNKNOWN', message: 'Database error' }
              })
            })
          })
        });

        await expect(repository.findMaterialById('material-123')).rejects.toThrow(DatabaseError);
      });
    });

    describe('findAllMaterials', () => {
      it('should return all materials ordered by name', async () => {
        const materials = [mockMaterial];

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: materials,
              error: null
            })
          })
        });

        const result = await repository.findAllMaterials();

        expect(result).toEqual(materials);
        expect(mockClient.from).toHaveBeenCalledWith('materials');
      });
    });

    describe('findMaterialsByTheme', () => {
      it('should find materials by theme using ilike search', async () => {
        const materials = [mockMaterial];

        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: materials,
                error: null
              })
            })
          })
        });

        const result = await repository.findMaterialsByTheme('mystical');

        expect(result).toEqual(materials);
        expect(mockClient.from).toHaveBeenCalledWith('materials');
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
        mockClient.from('materialstacks').select('*').eq('user_id', 'user-123').eq('material_id', 'material-456').eq('style_id', 'style-789').single.mockResolvedValue({ data: mockStack, error: null });

        const result = await repository.findStackByUser('user-123', 'material-456', 'style-789');

        expect(result).toEqual(mockStack);
        expect(mockClient.from).toHaveBeenCalledWith('materialstacks');
      });

      it('should return null when stack not found', async () => {
        mockClient.from('materialstacks').select('*').eq('user_id', 'user-123').eq('material_id', 'material-456').eq('style_id', 'style-789').single.mockResolvedValue({
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

        // Override order to return a promise since it's the terminal operation
        const mockQueryChain = mockClient.from('materialstacks').select('*').eq('user_id', 'user-123').gt('quantity', 0);
        mockQueryChain.order = jest.fn().mockResolvedValue({ data: stacks, error: null });

        const result = await repository.findAllStacksByUser('user-123');

        expect(result).toEqual(stacks);
        expect(mockClient.from).toHaveBeenCalledWith('materialstacks');
      });
    });

    describe('findStyledMaterialsByUser', () => {
      it('should find only styled materials (style_id != normal)', async () => {
        const styledStacks = [mockStack];

        // Override order to return a promise since it's the terminal operation
        const mockQueryChain = mockClient.from('materialstacks').select('*').eq('user_id', 'user-123').neq('style_id', 'normal').gt('quantity', 0);
        mockQueryChain.order = jest.fn().mockResolvedValue({ data: styledStacks, error: null });

        const result = await repository.findStyledMaterialsByUser('user-123');

        expect(result).toEqual(styledStacks);
        expect(mockClient.from).toHaveBeenCalledWith('materialstacks');
      });
    });

    describe('incrementStack', () => {
      it('should increment existing stack quantity', async () => {
        const existingStack = { ...mockStack, quantity: 3 };
        const updatedStack = { ...mockStack, quantity: 8 };

        // Mock findStackByUser
        mockClient.from('materialstacks').select('*').eq('user_id', 'user-123').eq('material_id', 'material-456').eq('style_id', 'style-789').single.mockResolvedValueOnce({ data: existingStack, error: null });
        // Mock update operation
        mockClient.from('materialstacks').update({ quantity: 8 }).eq('user_id', 'user-123').eq('material_id', 'material-456').eq('style_id', 'style-789').select().single.mockResolvedValueOnce({ data: updatedStack, error: null });

        const result = await repository.incrementStack('user-123', 'material-456', 'style-789', 5);

        expect(result).toEqual(updatedStack);
      });

      it('should create new stack if none exists', async () => {
        // Mock findStackByUser returns null
        mockClient.from('materialstacks').select('*').eq('user_id', 'user-123').eq('material_id', 'material-456').eq('style_id', 'style-789').single.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' }
        });
        // Mock create operation
        mockClient.from('materialstacks').insert({
          user_id: 'user-123',
          material_id: 'material-456',
          style_id: 'style-789',
          quantity: 5
        }).select().single.mockResolvedValueOnce({ data: mockStack, error: null });

        const result = await repository.incrementStack('user-123', 'material-456', 'style-789', 5);

        expect(result).toEqual(mockStack);
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

        mockClient.from('materialstacks').select('*').eq('user_id', 'user-123').eq('material_id', 'material-456').eq('style_id', 'style-789').single.mockResolvedValueOnce({ data: existingStack, error: null });
        mockClient.from('materialstacks').update({ quantity: 5 }).eq('user_id', 'user-123').eq('material_id', 'material-456').eq('style_id', 'style-789').select().single.mockResolvedValueOnce({ data: updatedStack, error: null });

        const result = await repository.decrementStack('user-123', 'material-456', 'style-789', 5);

        expect(result).toEqual(updatedStack);
      });

      it('should delete stack when quantity reaches zero', async () => {
        const existingStack = { ...mockStack, quantity: 5 };
        const zeroStack = { ...mockStack, quantity: 0 };

        // Mock the findStackByUser call first
        mockClient.from
          .mockReturnValueOnce({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: existingStack, error: null })
                  })
                })
              })
            })
          })
          // Then mock the delete call
          .mockReturnValueOnce({
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({ error: null, count: 1 })
                })
              })
            })
          });

        const result = await repository.decrementStack('user-123', 'material-456', 'style-789', 5);

        expect(result).toEqual(zeroStack);
      });

      it('should throw error when stack not found', async () => {
        mockClient.from('materialstacks').select('*').eq('user_id', 'user-123').eq('material_id', 'material-456').eq('style_id', 'style-789').single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' }
        });

        await expect(
          repository.decrementStack('user-123', 'material-456', 'style-789', 5)
        ).rejects.toThrow(NotFoundError);
      });

      it('should throw error when insufficient quantity', async () => {
        const existingStack = { ...mockStack, quantity: 3 };
        mockClient.from('materialstacks').select('*').eq('user_id', 'user-123').eq('material_id', 'material-456').eq('style_id', 'style-789').single.mockResolvedValue({ data: existingStack, error: null });

        await expect(
          repository.decrementStack('user-123', 'material-456', 'style-789', 5)
        ).rejects.toThrow(BusinessLogicError);
      });
    });

    describe('createStack', () => {
      it('should create new material stack', async () => {
        mockClient.from('materialstacks').insert({
          user_id: 'user-123',
          material_id: 'material-456',
          style_id: 'style-789',
          quantity: 5
        }).select().single.mockResolvedValue({ data: mockStack, error: null });

        const result = await repository.createStack('user-123', 'material-456', 'style-789', 5);

        expect(result).toEqual(mockStack);
        expect(mockClient.from).toHaveBeenCalledWith('materialstacks');
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
        mockClient.from('materialinstances').insert({
          user_id: 'user-456',
          material_id: 'material-789',
          style_id: 'style-abc'
        }).select().single.mockResolvedValue({ data: mockInstance, error: null });

        const result = await repository.createInstance('user-456', 'material-789', 'style-abc');

        expect(result).toEqual(mockInstance);
        expect(mockClient.from).toHaveBeenCalledWith('materialinstances');
      });
    });

    describe('findInstanceById', () => {
      it('should find instance by ID', async () => {
        mockClient.from('materialinstances').select('*').eq('id', 'instance-123').single.mockResolvedValue({ data: mockInstance, error: null });

        const result = await repository.findInstanceById('instance-123');

        expect(result).toEqual(mockInstance);
        expect(mockClient.from).toHaveBeenCalledWith('materialinstances');
      });

      it('should return null when not found', async () => {
        mockClient.from('materialinstances').select('*').eq('id', 'non-existent').single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' }
        });

        const result = await repository.findInstanceById('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('deleteInstance', () => {
      it('should delete instance and return its data', async () => {
        // Mock the findInstanceById call first
        mockClient.from
          .mockReturnValueOnce({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockInstance, error: null })
              })
            })
          })
          // Then mock the delete call
          .mockReturnValueOnce({
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null, count: 1 })
            })
          });

        const result = await repository.deleteInstance('instance-123');

        expect(result).toEqual(mockInstance);
      });

      it('should throw error when instance not found', async () => {
        mockClient.from('materialinstances').select('*').eq('id', 'non-existent').single.mockResolvedValue({
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
        // Override the terminal insert operation to return a promise
        const insertChain = mockClient.from('itemmaterials');
        insertChain.insert = jest.fn().mockResolvedValue({ error: null });

        await repository.applyToItem('item-123', 'instance-456', 1);

        expect(mockClient.from).toHaveBeenCalledWith('itemmaterials');
      });

      it('should throw error for invalid slot index', async () => {
        await expect(repository.applyToItem('item-123', 'instance-456', -1)).rejects.toThrow(BusinessLogicError);
        await expect(repository.applyToItem('item-123', 'instance-456', 3)).rejects.toThrow(BusinessLogicError);
      });

      it('should throw error when slot is occupied', async () => {
        // Override the terminal insert operation to return a promise
        const insertChain = mockClient.from('itemmaterials');
        insertChain.insert = jest.fn().mockResolvedValue({
          error: { code: '23505', message: 'unique_item_slot constraint violation' }
        });

        await expect(repository.applyToItem('item-123', 'instance-456', 1)).rejects.toThrow(BusinessLogicError);
      });

      it('should throw error when instance already applied', async () => {
        // Override the terminal insert operation to return a promise
        const insertChain = mockClient.from('itemmaterials');
        insertChain.insert = jest.fn().mockResolvedValue({
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
        // Mock the sequence of calls: find junction, find instance, delete junction
        mockClient.from
          .mockReturnValueOnce({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { material_instance_id: 'instance-456' },
                    error: null
                  })
                })
              })
            })
          })
          .mockReturnValueOnce({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockInstance, error: null })
              })
            })
          })
          .mockReturnValueOnce({
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null, count: 1 })
              })
            })
          });

        const result = await repository.removeFromItem('item-123', 1);

        expect(result).toEqual(mockInstance);
      });

      it('should throw error when slot is empty', async () => {
        mockClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116', message: 'No rows found' }
                })
              })
            })
          })
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

        // Override order to return a promise since it's the terminal operation
        const mockQueryChain = mockClient.from('itemmaterials').select('slot_index').eq('item_id', 'item-123');
        mockQueryChain.order = jest.fn().mockResolvedValue({ data: occupiedSlots, error: null });

        const result = await repository.getSlotOccupancy('item-123');

        expect(result).toEqual([0, 2]);
        expect(mockClient.from).toHaveBeenCalledWith('itemmaterials');
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

        mockClient.rpc.mockResolvedValue({ data: rpcResult, error: null });
        mockClient.from('materialinstances').select('*').eq('id', 'instance-123').single.mockResolvedValue({ data: mockInstance, error: null });

        const result = await repository.applyMaterialToItemAtomic(
          'user-123', 'item-456', 'material-789', 'style-abc', 1
        );

        expect(result.instance).toEqual(mockInstance);
        expect(result.newStackQuantity).toBe(4);
        expect(mockClient.rpc).toHaveBeenCalledWith('apply_material_to_item', {
          p_user_id: 'user-123',
          p_item_id: 'item-456',
          p_material_id: 'material-789',
          p_style_id: 'style-abc',
          p_slot_index: 1
        });
      });

      it('should throw error when RPC returns no result', async () => {
        mockClient.rpc.mockResolvedValue({ data: [], error: null });

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

        mockClient.rpc.mockResolvedValue({ data: rpcResult, error: null });

        const result = await repository.removeMaterialFromItemAtomic('item-456', 1);

        expect(result.removedInstance.id).toBe('instance-123');
        expect(result.removedInstance.material_id).toBe('material-456');
        expect(result.newStackQuantity).toBe(6);
        expect(mockClient.rpc).toHaveBeenCalledWith('remove_material_from_item', {
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

        mockClient.rpc.mockResolvedValue({ data: rpcResult, error: null });
        mockClient.from('materialinstances').select('*').eq('id', 'new-instance-456').single.mockResolvedValue({ data: mockNewInstance, error: null });

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
  // Material Templates with Details (Missing Coverage)
  // ============================================================================

  describe('findStacksByUserWithDetails', () => {
    it('should return stacks with material and style details', async () => {
      const mockDetailsData = [
        {
          material_id: 'mat-1',
          style_id: 'style-1',
          quantity: 5,
          materials: { name: 'Steel' },
          styledefinitions: { style_name: 'Mystical' }
        }
      ];

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gt: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockDetailsData,
                  error: null
                })
              })
            })
          })
        })
      });

      const result = await repository.findStacksByUserWithDetails('user-123');

      expect(result).toEqual(mockDetailsData);
      expect(mockClient.from).toHaveBeenCalledWith('materialstacks');
    });

    it('should handle database errors', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gt: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'DATABASE_ERROR', message: 'Connection failed' }
                })
              })
            })
          })
        })
      });

      await expect(repository.findStacksByUserWithDetails('user-123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('deleteStackIfEmpty', () => {
    const mockStackForCleanup: MaterialStack = {
      user_id: 'user-123',
      material_id: 'material-456',
      style_id: 'style-789',
      quantity: 5,
      updated_at: '2024-01-01T00:00:00.000Z'
    };

    it('should delete stack when quantity is zero', async () => {
      const zeroStack = { ...mockStackForCleanup, quantity: 0 };

      // Mock findStackByUser returning zero quantity stack
      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: zeroStack, error: null })
                })
              })
            })
          })
        })
        // Mock delete operation
        .mockReturnValueOnce({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null, count: 1 })
              })
            })
          })
        });

      await repository.deleteStackIfEmpty('user-123', 'material-456', 'style-789');

      expect(mockClient.from).toHaveBeenCalledWith('materialstacks');
    });

    it('should not delete stack when quantity is positive', async () => {
      const positiveStack = { ...mockStackForCleanup, quantity: 5 };

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: positiveStack, error: null })
              })
            })
          })
        })
      });

      await repository.deleteStackIfEmpty('user-123', 'material-456', 'style-789');

      // Should only call findStackByUser, not delete
      expect(mockClient.from).toHaveBeenCalledTimes(1);
    });

    it('should handle non-existent stack gracefully', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
              })
            })
          })
        })
      });

      await repository.deleteStackIfEmpty('user-123', 'material-456', 'style-789');

      expect(mockClient.from).toHaveBeenCalledWith('materialstacks');
    });
  });

  describe('findInstanceWithTemplate', () => {
    const mockInstanceForTemplate: MaterialInstance = {
      id: 'instance-123',
      user_id: 'user-456',
      material_id: 'material-789',
      style_id: 'style-abc',
      created_at: '2024-01-01T00:00:00.000Z'
    };

    it('should find instance with material template data', async () => {
      const mockInstanceWithTemplate = {
        ...mockInstanceForTemplate,
        material: {
          id: 'material-789',
          name: 'Crystal',
          stat_modifiers: { atkPower: 5, atkAccuracy: -2, defPower: 0, defAccuracy: 0 },
          description: 'Mystical crystal'
        }
      };

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockInstanceWithTemplate, error: null })
          })
        })
      });

      const result = await repository.findInstanceWithTemplate('instance-123');

      expect(result).toEqual(mockInstanceWithTemplate);
      expect(mockClient.from).toHaveBeenCalledWith('materialinstances');
    });

    it('should return null when instance not found', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
          })
        })
      });

      const result = await repository.findInstanceWithTemplate('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findMaterialsByItem', () => {
    it('should find all materials applied to an item', async () => {
      const mockAppliedMaterials = [
        {
          id: 'applied-1',
          slot_index: 0,
          material_instance: {
            material_id: 'mat-1',
            style_id: 'style-1'
          },
          material: {
            material: {
              id: 'mat-1',
              name: 'Steel',
              stat_modifiers: { atkPower: 2, atkAccuracy: 1, defPower: 0, defAccuracy: 0 }
            }
          }
        }
      ];

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockAppliedMaterials,
              error: null
            })
          })
        })
      });

      const result = await repository.findMaterialsByItem('item-123');

      expect(result).toHaveLength(1);
      expect(result[0].material_id).toBe('mat-1');
      expect(result[0].slot_index).toBe(0);
      expect(mockClient.from).toHaveBeenCalledWith('itemmaterials');
    });

    it('should return empty array when no materials applied', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      });

      const result = await repository.findMaterialsByItem('item-123');

      expect(result).toEqual([]);
    });
  });

  describe('getLootPoolMaterialWeights', () => {
    it('should get material weights for loot pools', async () => {
      const mockWeights = [
        {
          loot_pool_id: 'pool-1',
          material_id: 'mat-1',
          spawn_weight: 100
        },
        {
          loot_pool_id: 'pool-1',
          material_id: 'mat-2',
          spawn_weight: 50
        }
      ];

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: mockWeights,
            error: null
          })
        })
      });

      const result = await repository.getLootPoolMaterialWeights(['pool-1']);

      expect(result).toEqual(mockWeights);
      expect(mockClient.from).toHaveBeenCalledWith('v_loot_pool_material_weights');
    });

    it('should return empty array for empty loot pool list', async () => {
      const result = await repository.getLootPoolMaterialWeights([]);

      expect(result).toEqual([]);
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'DATABASE_ERROR', message: 'Query failed' }
          })
        })
      });

      await expect(repository.getLootPoolMaterialWeights(['pool-1'])).rejects.toThrow(DatabaseError);
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

        // Mock both stacks don't exist (findStackByUser returns null) and then creation
        mockClient.from('materialstacks').select('*').eq('user_id', 'user-123').eq('material_id', 'mat-1').eq('style_id', 'style-1').single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
        mockClient.from('materialstacks').insert({ user_id: 'user-123', material_id: 'mat-1', style_id: 'style-1', quantity: 3 }).select().single.mockResolvedValueOnce({ data: mockStacks[0], error: null });
        mockClient.from('materialstacks').select('*').eq('user_id', 'user-123').eq('material_id', 'mat-2').eq('style_id', 'style-2').single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
        mockClient.from('materialstacks').insert({ user_id: 'user-123', material_id: 'mat-2', style_id: 'style-2', quantity: 5 }).select().single.mockResolvedValueOnce({ data: mockStacks[1], error: null });

        const result = await repository.batchIncrementStacks(updates);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(mockStacks[0]);
        expect(result[1]).toEqual(mockStacks[1]);
      });
    });
  });
});