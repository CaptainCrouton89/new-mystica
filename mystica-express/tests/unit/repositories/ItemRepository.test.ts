/**
 * ItemRepository unit tests
 *
 * Tests all CRUD operations, complex queries, N+1 prevention, ownership validation,
 * level management, image generation, and history tracking functionality.
 */

import { ItemRepository } from '../../../src/repositories/ItemRepository.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../../src/utils/errors.js';
import { createMockSupabaseClient } from '../../helpers/mockSupabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Test data
const mockUserId = 'user-123';
const mockItemId = 'item-456';
const mockItemTypeId = 'itemtype-789';

const mockItemRow = {
  id: mockItemId,
  user_id: mockUserId,
  item_type_id: mockItemTypeId,
  level: 5,
  is_styled: true,
  current_stats: '{"atkPower": 25, "defPower": 15}',
  material_combo_hash: 'hash-abc123',
  generated_image_url: 'https://example.com/item.png',
  image_generation_status: 'complete',
  created_at: '2024-01-01T00:00:00Z'
};

const mockItemType = {
  id: mockItemTypeId,
  name: 'Magic Sword',
  category: 'weapon',
  base_stats_normalized: { atkPower: 0.6, defPower: 0.4 },
  rarity: 'epic',
  description: 'A powerful magical sword'
};

const mockMaterialInstance = {
  id: 'instance-123',
  material_id: 'material-456',
  style_id: 'style-789',
  created_at: '2024-01-01T00:00:00Z',
  materials: {
    id: 'material-456',
    name: 'Crystal',
    description: 'Magical crystal',
    rarity: 'rare',
    stat_modifiers: { atkPower: 5 },
    image_url: 'https://example.com/crystal.png'
  }
};

const mockItemWithMaterials = {
  ...mockItemRow,
  itemtypes: mockItemType,
  itemmaterials: [
    {
      slot_index: 0,
      applied_at: '2024-01-01T01:00:00Z',
      materialinstances: mockMaterialInstance
    }
  ]
};

const mockHistoryEvent = {
  id: 'history-123',
  item_id: mockItemId,
  user_id: mockUserId,
  event_type: 'level_up',
  event_data: { old_level: 4, new_level: 5 },
  created_at: '2024-01-01T02:00:00Z'
};

describe('ItemRepository', () => {
  let repository: ItemRepository;
  let mockClient: SupabaseClient;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    repository = new ItemRepository(mockClient);
  });

  describe('Basic CRUD Operations', () => {
    describe('findById', () => {
      it('should find item by ID without user validation', async () => {
        mockClient.from('items').select('*').eq('id', mockItemId).single.mockResolvedValue({
          data: mockItemRow,
          error: null
        });

        const result = await repository.findById(mockItemId);

        expect(result).toEqual(mockItemRow);
        expect(mockClient.from).toHaveBeenCalledWith('items');
      });

      it('should find item by ID with user validation', async () => {
        mockClient.from('items').select('*').eq('id', mockItemId).eq('user_id', mockUserId).single.mockResolvedValue({
          data: mockItemRow,
          error: null
        });

        const result = await repository.findById(mockItemId, mockUserId);

        expect(result).toEqual(mockItemRow);
      });

      it('should return null when item not found', async () => {
        mockClient.from('items').select('*').eq('id', mockItemId).single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        const result = await repository.findById(mockItemId);

        expect(result).toBeNull();
      });

      it('should throw NotFoundError for ownership validation failure', async () => {
        mockClient.from('items').select('*').eq('id', mockItemId).eq('user_id', mockUserId).single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        await expect(repository.findById(mockItemId, mockUserId)).rejects.toThrow(NotFoundError);
      });

      it('should throw DatabaseError on query failure', async () => {
        mockClient.from('items').select('*').eq('id', mockItemId).single.mockResolvedValue({
          data: null,
          error: { code: 'ERROR', message: 'Database error' }
        });

        await expect(repository.findById(mockItemId)).rejects.toThrow(DatabaseError);
      });
    });

    describe('findByUser', () => {
      it('should find all items for a user', async () => {
        const userItems = [mockItemRow, { ...mockItemRow, id: 'item-789' }];

        mockClient.from('items').select('*').eq('user_id', mockUserId).mockResolvedValue({
          data: userItems,
          error: null
        });

        const result = await repository.findByUser(mockUserId);

        expect(result).toEqual(userItems);
        expect(mockClient.from('items').select('*').eq).toHaveBeenCalledWith('user_id', mockUserId);
      });

      it('should return empty array when user has no items', async () => {
        mockClient.from('items').select('*').eq('user_id', mockUserId).mockResolvedValue({
          data: [],
          error: null
        });

        const result = await repository.findByUser(mockUserId);

        expect(result).toEqual([]);
      });
    });

    describe('create', () => {
      const createData = {
        user_id: mockUserId,
        item_type_id: mockItemTypeId,
        level: 3
      };

      it('should create new item with provided data', async () => {
        const expectedInsert = {
          user_id: mockUserId,
          item_type_id: mockItemTypeId,
          level: 3,
          is_styled: false,
          current_stats: null,
          material_combo_hash: null,
          generated_image_url: null,
          image_generation_status: null
        };

        mockClient.from('items').insert(expectedInsert).select().single.mockResolvedValue({
          data: { ...mockItemRow, level: 3 },
          error: null
        });

        const result = await repository.create(createData);

        expect(result.level).toBe(3);
        expect(mockClient.from('items').insert).toHaveBeenCalledWith(expectedInsert);
      });

      it('should create item with default level 1 when not provided', async () => {
        const createDataNoLevel = {
          user_id: mockUserId,
          item_type_id: mockItemTypeId
        };

        const expectedInsert = {
          user_id: mockUserId,
          item_type_id: mockItemTypeId,
          level: 1,
          is_styled: false,
          current_stats: null,
          material_combo_hash: null,
          generated_image_url: null,
          image_generation_status: null
        };

        mockClient.from('items').insert(expectedInsert).select().single.mockResolvedValue({
          data: { ...mockItemRow, level: 1 },
          error: null
        });

        const result = await repository.create(createDataNoLevel);

        expect(result.level).toBe(1);
      });

      it('should throw DatabaseError on creation failure', async () => {
        mockClient.from('items').insert(expect.any(Object)).select().single.mockResolvedValue({
          data: null,
          error: { code: 'ERROR', message: 'Insert failed' }
        });

        await expect(repository.create(createData)).rejects.toThrow(DatabaseError);
      });
    });

    describe('update', () => {
      const updateData = {
        level: 10,
        current_stats: { atkPower: 30, defPower: 20 }
      };

      it('should update item with ownership validation', async () => {
        // Mock ownership validation
        mockClient.from('items').select('*').eq('id', mockItemId).eq('user_id', mockUserId).single.mockResolvedValue({
          data: mockItemRow,
          error: null
        });

        // Mock update
        const expectedUpdate = {
          level: 10,
          current_stats: JSON.stringify({ atkPower: 30, defPower: 20 })
        };

        mockClient.from('items').update(expectedUpdate).eq('id', mockItemId).select().single.mockResolvedValue({
          data: { ...mockItemRow, ...updateData },
          error: null
        });

        const result = await repository.update(mockItemId, mockUserId, updateData);

        expect(result.level).toBe(10);
        expect(mockClient.from('items').update).toHaveBeenCalledWith(expectedUpdate);
      });

      it('should throw NotFoundError for invalid ownership', async () => {
        mockClient.from('items').select('*').eq('id', mockItemId).eq('user_id', mockUserId).single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        await expect(repository.update(mockItemId, mockUserId, updateData)).rejects.toThrow(NotFoundError);
      });
    });

    describe('delete', () => {
      it('should delete item with ownership validation', async () => {
        // Mock ownership validation
        mockClient.from('items').select('*').eq('id', mockItemId).eq('user_id', mockUserId).single.mockResolvedValue({
          data: mockItemRow,
          error: null
        });

        // Mock delete
        mockClient.from('items').delete({ count: 'exact' }).eq('id', mockItemId).mockResolvedValue({
          error: null,
          count: 1
        });

        const result = await repository.delete(mockItemId, mockUserId);

        expect(result).toBe(true);
      });

      it('should return false when item not found', async () => {
        // Mock ownership validation
        mockClient.from('items').select('*').eq('id', mockItemId).eq('user_id', mockUserId).single.mockResolvedValue({
          data: mockItemRow,
          error: null
        });

        // Mock delete with no rows affected
        mockClient.from('items').delete({ count: 'exact' }).eq('id', mockItemId).mockResolvedValue({
          error: null,
          count: 0
        });

        const result = await repository.delete(mockItemId, mockUserId);

        expect(result).toBe(false);
      });
    });
  });

  describe('Complex Query Operations (N+1 Prevention)', () => {
    describe('findWithMaterials', () => {
      it('should find item with complete material details using single query', async () => {
        const expectedQuery = `
        id,
        user_id,
        item_type_id,
        level,
        is_styled,
        current_stats,
        material_combo_hash,
        generated_image_url,
        image_generation_status,
        created_at,
        itemtypes (
          id,
          name,
          category,
          base_stats_normalized,
          rarity,
          description
        ),
        itemmaterials (
          slot_index,
          applied_at,
          materialinstances (
            id,
            material_id,
            style_id,
            created_at,
            materials (
              id,
              name,
              description,
              rarity,
              stat_modifiers,
              image_url
            )
          )
        )
      `;

        mockClient.from('items').select(expectedQuery.replace(/\s+/g, ' ').trim()).eq('id', mockItemId).single.mockResolvedValue({
          data: mockItemWithMaterials,
          error: null
        });

        const result = await repository.findWithMaterials(mockItemId);

        expect(result).toBeDefined();
        expect(result?.id).toBe(mockItemId);
        expect(result?.item_type.name).toBe('Magic Sword');
        expect(result?.materials).toHaveLength(1);
        expect(result?.materials[0].material.name).toBe('Crystal');
        expect(result?.materials[0].slot_index).toBe(0);
      });

      it('should include ownership filter when userId provided', async () => {
        mockClient.from('items').select(expect.any(String)).eq('id', mockItemId).eq('user_id', mockUserId).single.mockResolvedValue({
          data: mockItemWithMaterials,
          error: null
        });

        await repository.findWithMaterials(mockItemId, mockUserId);

        expect(mockClient.from('items').select(expect.any(String)).eq('id', mockItemId).eq).toHaveBeenCalledWith('user_id', mockUserId);
      });

      it('should return null when item not found', async () => {
        mockClient.from('items').select(expect.any(String)).eq('id', mockItemId).single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        const result = await repository.findWithMaterials(mockItemId);

        expect(result).toBeNull();
      });
    });

    describe('findWithItemType', () => {
      it('should find item with item type only (lighter query)', async () => {
        const itemWithTypeOnly = {
          ...mockItemRow,
          itemtypes: mockItemType
        };

        mockClient.from('items').select(expect.any(String)).eq('id', mockItemId).single.mockResolvedValue({
          data: itemWithTypeOnly,
          error: null
        });

        const result = await repository.findWithItemType(mockItemId);

        expect(result).toBeDefined();
        expect(result?.item_type.name).toBe('Magic Sword');
        expect(result?.materials).toEqual([]); // No materials in this query
      });
    });

    describe('findEquippedByUser', () => {
      it('should find equipped items using inner join with UserEquipment', async () => {
        const equippedItem = {
          ...mockItemRow,
          itemtypes: mockItemType,
          userequipment: {
            slot_name: 'weapon',
            equipped_at: '2024-01-01T03:00:00Z'
          }
        };

        mockClient.from('items').select(expect.any(String)).eq('user_id', mockUserId).mockResolvedValue({
          data: [equippedItem],
          error: null
        });

        const result = await repository.findEquippedByUser(mockUserId);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(mockItemId);
        expect(result[0].item_type.name).toBe('Magic Sword');
      });
    });

    describe('findByType', () => {
      it('should find items by type for user', async () => {
        const typeItems = [mockItemRow, { ...mockItemRow, id: 'item-999' }];

        mockClient.from('items').select('*').eq('user_id', mockUserId).eq('item_type_id', mockItemTypeId).mockResolvedValue({
          data: typeItems,
          error: null
        });

        const result = await repository.findByType(mockUserId, mockItemTypeId);

        expect(result).toEqual(typeItems);
      });
    });
  });

  describe('Level & Stats Management', () => {
    describe('updateLevel', () => {
      it('should update item level with validation', async () => {
        // Mock ownership validation
        mockClient.from('items').select('*').eq('id', mockItemId).eq('user_id', mockUserId).single.mockResolvedValue({
          data: mockItemRow,
          error: null
        });

        // Mock update
        mockClient.from('items').update({ level: 15 }).eq('id', mockItemId).select().single.mockResolvedValue({
          data: { ...mockItemRow, level: 15 },
          error: null
        });

        await repository.updateLevel(mockItemId, mockUserId, 15);

        expect(mockClient.from('items').update).toHaveBeenCalledWith({ level: 15 });
      });

      it('should throw ValidationError for invalid level', async () => {
        await expect(repository.updateLevel(mockItemId, mockUserId, 0)).rejects.toThrow(ValidationError);
        await expect(repository.updateLevel(mockItemId, mockUserId, -5)).rejects.toThrow(ValidationError);
      });
    });

    describe('updateStats', () => {
      it('should update current stats', async () => {
        const newStats = { atkPower: 40, defPower: 30 };

        // Mock ownership validation
        mockClient.from('items').select('*').eq('id', mockItemId).eq('user_id', mockUserId).single.mockResolvedValue({
          data: mockItemRow,
          error: null
        });

        // Mock update
        mockClient.from('items').update({ current_stats: JSON.stringify(newStats) }).eq('id', mockItemId).select().single.mockResolvedValue({
          data: { ...mockItemRow, current_stats: JSON.stringify(newStats) },
          error: null
        });

        await repository.updateStats(mockItemId, mockUserId, newStats);

        expect(mockClient.from('items').update).toHaveBeenCalledWith({
          current_stats: JSON.stringify(newStats)
        });
      });
    });

    describe('updateImageData', () => {
      it('should update image generation data atomically', async () => {
        const comboHash = 'new-hash-456';
        const imageUrl = 'https://example.com/new-image.png';
        const status = 'complete';

        // Mock ownership validation
        mockClient.from('items').select('*').eq('id', mockItemId).eq('user_id', mockUserId).single.mockResolvedValue({
          data: mockItemRow,
          error: null
        });

        // Mock update
        const expectedUpdate = {
          material_combo_hash: comboHash,
          generated_image_url: imageUrl,
          image_generation_status: status
        };

        mockClient.from('items').update(expectedUpdate).eq('id', mockItemId).select().single.mockResolvedValue({
          data: { ...mockItemRow, ...expectedUpdate },
          error: null
        });

        await repository.updateImageData(mockItemId, mockUserId, comboHash, imageUrl, status);

        expect(mockClient.from('items').update).toHaveBeenCalledWith(expectedUpdate);
      });
    });
  });

  describe('History Tracking', () => {
    describe('addHistoryEvent', () => {
      it('should add history event with ownership validation', async () => {
        // Mock ownership validation
        mockClient.from('items').select('*').eq('id', mockItemId).eq('user_id', mockUserId).single.mockResolvedValue({
          data: mockItemRow,
          error: null
        });

        // Mock history insert
        mockClient.from('itemhistory').insert({
          item_id: mockItemId,
          user_id: mockUserId,
          event_type: 'level_up',
          event_data: { old_level: 4, new_level: 5 }
        }).mockResolvedValue({
          error: null
        });

        await repository.addHistoryEvent(mockItemId, mockUserId, 'level_up', { old_level: 4, new_level: 5 });

        expect(mockClient.from('itemhistory').insert).toHaveBeenCalledWith({
          item_id: mockItemId,
          user_id: mockUserId,
          event_type: 'level_up',
          event_data: { old_level: 4, new_level: 5 }
        });
      });

      it('should add history event without event data', async () => {
        // Mock ownership validation
        mockClient.from('items').select('*').eq('id', mockItemId).eq('user_id', mockUserId).single.mockResolvedValue({
          data: mockItemRow,
          error: null
        });

        // Mock history insert
        mockClient.from('itemhistory').insert({
          item_id: mockItemId,
          user_id: mockUserId,
          event_type: 'equipped',
          event_data: null
        }).mockResolvedValue({
          error: null
        });

        await repository.addHistoryEvent(mockItemId, mockUserId, 'equipped');

        expect(mockClient.from('itemhistory').insert).toHaveBeenCalledWith({
          item_id: mockItemId,
          user_id: mockUserId,
          event_type: 'equipped',
          event_data: null
        });
      });
    });

    describe('getItemHistory', () => {
      it('should get item history with ownership validation', async () => {
        // Mock ownership validation
        mockClient.from('items').select('*').eq('id', mockItemId).eq('user_id', mockUserId).single.mockResolvedValue({
          data: mockItemRow,
          error: null
        });

        // Mock history query
        mockClient.from('itemhistory').select('*').eq('item_id', mockItemId).eq('user_id', mockUserId).order('created_at', { ascending: false }).mockResolvedValue({
          data: [mockHistoryEvent],
          error: null
        });

        const result = await repository.getItemHistory(mockItemId, mockUserId);

        expect(result).toEqual([mockHistoryEvent]);
        expect(mockClient.from('itemhistory').select('*').eq('item_id', mockItemId).eq('user_id', mockUserId).order).toHaveBeenCalledWith('created_at', { ascending: false });
      });

      it('should return empty array when no history exists', async () => {
        // Mock ownership validation
        mockClient.from('items').select('*').eq('id', mockItemId).eq('user_id', mockUserId).single.mockResolvedValue({
          data: mockItemRow,
          error: null
        });

        // Mock empty history
        mockClient.from('itemhistory').select('*').eq('item_id', mockItemId).eq('user_id', mockUserId).order('created_at', { ascending: false }).mockResolvedValue({
          data: [],
          error: null
        });

        const result = await repository.getItemHistory(mockItemId, mockUserId);

        expect(result).toEqual([]);
      });
    });
  });

  describe('Batch Operations', () => {
    describe('findManyWithDetails', () => {
      it('should find multiple items with details using single query', async () => {
        const itemIds = [mockItemId, 'item-789'];
        const multipleItems = [mockItemWithMaterials, { ...mockItemWithMaterials, id: 'item-789' }];

        mockClient.from('items').select(expect.any(String)).in('id', itemIds).mockResolvedValue({
          data: multipleItems,
          error: null
        });

        const result = await repository.findManyWithDetails(itemIds);

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe(mockItemId);
        expect(result[1].id).toBe('item-789');
      });

      it('should return empty array for empty input', async () => {
        const result = await repository.findManyWithDetails([]);

        expect(result).toEqual([]);
      });

      it('should include ownership filter when userId provided', async () => {
        const itemIds = [mockItemId];

        mockClient.from('items').select(expect.any(String)).in('id', itemIds).eq('user_id', mockUserId).mockResolvedValue({
          data: [mockItemWithMaterials],
          error: null
        });

        await repository.findManyWithDetails(itemIds, mockUserId);

        expect(mockClient.from('items').select(expect.any(String)).in('id', itemIds).eq).toHaveBeenCalledWith('user_id', mockUserId);
      });
    });

    describe('findByUserWithPagination', () => {
      it('should find user items with pagination and sorting', async () => {
        const paginatedItems = [mockItemRow];

        mockClient.from('items').select('*').eq('user_id', mockUserId).order('created_at', { ascending: false }).limit(10).range(0, 9).mockResolvedValue({
          data: paginatedItems,
          error: null
        });

        const result = await repository.findByUserWithPagination(mockUserId, 10, 0);

        expect(result).toEqual(paginatedItems);
        expect(mockClient.from('items').select('*').eq('user_id', mockUserId).order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(mockClient.from('items').select('*').eq('user_id', mockUserId).order('created_at', { ascending: false }).limit).toHaveBeenCalledWith(10);
      });
    });
  });

  describe('Private Helper Methods', () => {
    describe('transformToItemWithDetails', () => {
      it('should transform raw Supabase data to ItemWithDetails interface', async () => {
        // This is tested indirectly through findWithMaterials, but we can verify the transformation
        mockClient.from('items').select(expect.any(String)).eq('id', mockItemId).single.mockResolvedValue({
          data: mockItemWithMaterials,
          error: null
        });

        const result = await repository.findWithMaterials(mockItemId);

        expect(result).toBeDefined();
        expect(result?.current_stats).toEqual(JSON.parse(mockItemRow.current_stats));
        expect(result?.item_type).toEqual(mockItemType);
        expect(result?.materials[0].material.name).toBe('Crystal');
        expect(result?.materials[0].slot_index).toBe(0);
      });

      it('should handle items without materials', async () => {
        const itemWithoutMaterials = {
          ...mockItemRow,
          itemtypes: mockItemType
        };

        mockClient.from('items').select(expect.any(String)).eq('id', mockItemId).single.mockResolvedValue({
          data: itemWithoutMaterials,
          error: null
        });

        const result = await repository.findWithItemType(mockItemId);

        expect(result).toBeDefined();
        expect(result?.materials).toEqual([]);
      });
    });
  });
});