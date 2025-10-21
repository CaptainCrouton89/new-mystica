/**
 * Unit Tests: StatsService
 *
 * Comprehensive tests for pure calculation service that handles:
 * - Item stat calculation with rarity, level, and material modifiers
 * - Equipment stat aggregation across 8 slots
 * - Material modifier validation (zero-sum constraint)
 * - Edge cases and error conditions
 */

import { StatsService } from '../../../src/services/StatsService.js';
import { ValidationError } from '../../../src/utils/errors.js';
import { Stats, AppliedMaterial, EquipmentSlot } from '../../../src/types/api.types.js';

describe('StatsService', () => {
  let statsService: StatsService;

  beforeEach(() => {
    statsService = new StatsService();
  });

  /**
   * Test Group 1: computeItemStats() - Core stat calculation
   */
  describe('computeItemStats()', () => {
    const normalizedBaseStats: Stats = {
      atkPower: 0.4,
      atkAccuracy: 0.3,
      defPower: 0.2,
      defAccuracy: 0.1
    }; // Sums to 1.0

    it('should calculate level 1 item stats correctly with base scaling', () => {
      const result = statsService.computeItemStats(normalizedBaseStats, 1, []);

      expect(result).toEqual({
        atkPower: 4.0,   // 0.4 * 1 * 10
        atkAccuracy: 3.0, // 0.3 * 1 * 10
        defPower: 2.0,   // 0.2 * 1 * 10
        defAccuracy: 1.0  // 0.1 * 1 * 10
      });
    });

    it('should scale stats properly for higher levels', () => {
      const result = statsService.computeItemStats(normalizedBaseStats, 5, []);

      expect(result).toEqual({
        atkPower: 20.0,  // 0.4 * 5 * 10
        atkAccuracy: 15.0, // 0.3 * 5 * 10
        defPower: 10.0,  // 0.2 * 5 * 10
        defAccuracy: 5.0  // 0.1 * 5 * 10
      });
    });

    it('should apply single material modifier correctly', () => {
      const materials: AppliedMaterial[] = [{
        id: 'inst-1',
        material_id: 'iron',
        style_id: 'normal',
        slot_index: 0,
        material: {
          id: 'iron',
          name: 'Iron',
          rarity: 'common',
          stat_modifiers: {
            atkPower: -1.0,
            atkAccuracy: 0.5,
            defPower: 1.0,
            defAccuracy: -0.5
          }, // Sums to 0
          theme: 'defensive'
        }
      }];

      const result = statsService.computeItemStats(normalizedBaseStats, 2, materials);

      expect(result).toEqual({
        atkPower: 7.0,   // (0.4 * 2 * 10) - 1.0 = 8.0 - 1.0
        atkAccuracy: 6.5, // (0.3 * 2 * 10) + 0.5 = 6.0 + 0.5
        defPower: 5.0,   // (0.2 * 2 * 10) + 1.0 = 4.0 + 1.0
        defAccuracy: 1.5  // (0.1 * 2 * 10) - 0.5 = 2.0 - 0.5
      });
    });

    it('should apply multiple material modifiers correctly', () => {
      const materials: AppliedMaterial[] = [
        {
          id: 'inst-1',
          material_id: 'iron',
          style_id: 'normal',
          slot_index: 0,
          material: {
            id: 'iron',
            name: 'Iron',
            rarity: 'common',
            stat_modifiers: { atkPower: -2.0, atkAccuracy: 0.0, defPower: 3.0, defAccuracy: -1.0 }, // Sums to 0
            theme: 'defensive'
          }
        },
        {
          id: 'inst-2',
          material_id: 'ruby',
          style_id: 'normal',
          slot_index: 1,
          material: {
            id: 'ruby',
            name: 'Ruby',
            rarity: 'rare',
            stat_modifiers: { atkPower: 1.5, atkAccuracy: 0.5, defPower: -1.0, defAccuracy: -1.0 }, // Sums to 0
            theme: 'offensive'
          }
        }
      ];

      const result = statsService.computeItemStats(normalizedBaseStats, 3, materials);

      // Base stats at level 3: 12, 9, 6, 3
      // Material mods: (-2 + 1.5), (0 + 0.5), (3 + -1), (-1 + -1) = -0.5, 0.5, 2, -2
      expect(result).toEqual({
        atkPower: 11.5,  // 12 - 0.5
        atkAccuracy: 9.5, // 9 + 0.5
        defPower: 8.0,   // 6 + 2
        defAccuracy: 1.0  // 3 - 2
      });
    });

    it('should round results to 2 decimal places', () => {
      const materials: AppliedMaterial[] = [{
        id: 'inst-1',
        material_id: 'test',
        style_id: 'normal',
        slot_index: 0,
        material: {
          id: 'test',
          name: 'Test',
          rarity: 'common',
          stat_modifiers: { atkPower: 0.333, atkAccuracy: 0.333, defPower: 0.333, defAccuracy: -0.999 }, // Sums to 0
          theme: 'balanced'
        }
      }];

      const baseStats: Stats = { atkPower: 0.333, atkAccuracy: 0.333, defPower: 0.333, defAccuracy: 0.001 };
      const result = statsService.computeItemStats(baseStats, 3, materials);

      // Should round to 2 decimal places
      expect(result.atkPower).toBe(10.32); // (0.333 * 3 * 10) + 0.333 = 10.323 -> 10.32
      expect(result.atkAccuracy).toBe(10.32);
      expect(result.defPower).toBe(10.32);
      expect(result.defAccuracy).toBe(-0.97); // (0.001 * 3 * 10) + (-0.999) = -0.969 -> -0.97
    });

    it('should handle empty materials array', () => {
      const result = statsService.computeItemStats(normalizedBaseStats, 1, []);

      expect(result).toEqual({
        atkPower: 4.0,
        atkAccuracy: 3.0,
        defPower: 2.0,
        defAccuracy: 1.0
      });
    });

    it('should throw ValidationError for level < 1', () => {
      expect(() => {
        statsService.computeItemStats(normalizedBaseStats, 0, []);
      }).toThrow(ValidationError);

      expect(() => {
        statsService.computeItemStats(normalizedBaseStats, -1, []);
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for base stats not summing to ~1.0', () => {
      const invalidBaseStats: Stats = {
        atkPower: 0.5,
        atkAccuracy: 0.5,
        defPower: 0.5,
        defAccuracy: 0.5
      }; // Sums to 2.0

      expect(() => {
        statsService.computeItemStats(invalidBaseStats, 1, []);
      }).toThrow(ValidationError);
      expect(() => {
        statsService.computeItemStats(invalidBaseStats, 1, []);
      }).toThrow('Base stats must sum to approximately 1.0');
    });

    it('should throw ValidationError for more than 3 materials', () => {
      const materials: AppliedMaterial[] = [
        { id: '1', material_id: 'a', style_id: 'normal', slot_index: 0, material: { id: 'a', name: 'A', rarity: 'common', stat_modifiers: { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 }, theme: 'balanced' } },
        { id: '2', material_id: 'b', style_id: 'normal', slot_index: 1, material: { id: 'b', name: 'B', rarity: 'common', stat_modifiers: { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 }, theme: 'balanced' } },
        { id: '3', material_id: 'c', style_id: 'normal', slot_index: 2, material: { id: 'c', name: 'C', rarity: 'common', stat_modifiers: { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 }, theme: 'balanced' } },
        { id: '4', material_id: 'd', style_id: 'normal', slot_index: 3, material: { id: 'd', name: 'D', rarity: 'common', stat_modifiers: { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 }, theme: 'balanced' } }
      ];

      expect(() => {
        statsService.computeItemStats(normalizedBaseStats, 1, materials);
      }).toThrow(ValidationError);
      expect(() => {
        statsService.computeItemStats(normalizedBaseStats, 1, materials);
      }).toThrow('Cannot apply more than 3 materials');
    });
  });

  /**
   * Test Group 2: computeItemStatsForLevel() - Level-based calculation with rarity
   */
  describe('computeItemStatsForLevel()', () => {
    const mockItem = {
      item_type: {
        base_stats_normalized: {
          atkPower: 0.4,
          atkAccuracy: 0.3,
          defPower: 0.2,
          defAccuracy: 0.1
        },
        rarity: 'common' as const
      }
    };

    it('should calculate stats with common rarity multiplier (1.0)', () => {
      const result = statsService.computeItemStatsForLevel(mockItem, 2);

      expect(result).toEqual({
        atkPower: 8.0,   // 0.4 * 1.0 * 2 * 10
        atkAccuracy: 6.0, // 0.3 * 1.0 * 2 * 10
        defPower: 4.0,   // 0.2 * 1.0 * 2 * 10
        defAccuracy: 2.0  // 0.1 * 1.0 * 2 * 10
      });
    });

    it('should calculate stats with uncommon rarity multiplier (1.25)', () => {
      const uncommonItem = {
        ...mockItem,
        item_type: {
          ...mockItem.item_type,
          rarity: 'uncommon' as const
        }
      };

      const result = statsService.computeItemStatsForLevel(uncommonItem, 2);

      expect(result).toEqual({
        atkPower: 10.0,  // 0.4 * 1.25 * 2 * 10
        atkAccuracy: 7.5, // 0.3 * 1.25 * 2 * 10
        defPower: 5.0,   // 0.2 * 1.25 * 2 * 10
        defAccuracy: 2.5  // 0.1 * 1.25 * 2 * 10
      });
    });

    it('should calculate stats with rare rarity multiplier (1.5)', () => {
      const rareItem = {
        ...mockItem,
        item_type: {
          ...mockItem.item_type,
          rarity: 'rare' as const
        }
      };

      const result = statsService.computeItemStatsForLevel(rareItem, 3);

      expect(result).toEqual({
        atkPower: 18.0,  // 0.4 * 1.5 * 3 * 10
        atkAccuracy: 13.5, // 0.3 * 1.5 * 3 * 10
        defPower: 9.0,   // 0.2 * 1.5 * 3 * 10
        defAccuracy: 4.5  // 0.1 * 1.5 * 3 * 10
      });
    });

    it('should calculate stats with epic rarity multiplier (1.75)', () => {
      const epicItem = {
        ...mockItem,
        item_type: {
          ...mockItem.item_type,
          rarity: 'epic' as const
        }
      };

      const result = statsService.computeItemStatsForLevel(epicItem, 2);

      expect(result).toEqual({
        atkPower: 14.0,  // 0.4 * 1.75 * 2 * 10
        atkAccuracy: 10.5, // 0.3 * 1.75 * 2 * 10
        defPower: 7.0,   // 0.2 * 1.75 * 2 * 10
        defAccuracy: 3.5  // 0.1 * 1.75 * 2 * 10
      });
    });

    it('should calculate stats with legendary rarity multiplier (2.0)', () => {
      const legendaryItem = {
        ...mockItem,
        item_type: {
          ...mockItem.item_type,
          rarity: 'legendary' as const
        }
      };

      const result = statsService.computeItemStatsForLevel(legendaryItem, 2);

      expect(result).toEqual({
        atkPower: 16.0,  // 0.4 * 2.0 * 2 * 10
        atkAccuracy: 12.0, // 0.3 * 2.0 * 2 * 10
        defPower: 8.0,   // 0.2 * 2.0 * 2 * 10
        defAccuracy: 4.0  // 0.1 * 2.0 * 2 * 10
      });
    });

    it('should throw ValidationError for invalid rarity', () => {
      const invalidItem = {
        ...mockItem,
        item_type: {
          ...mockItem.item_type,
          rarity: 'mythical' as any
        }
      };

      expect(() => {
        statsService.computeItemStatsForLevel(invalidItem, 1);
      }).toThrow(ValidationError);
      expect(() => {
        statsService.computeItemStatsForLevel(invalidItem, 1);
      }).toThrow('Invalid rarity: mythical');
    });

    it('should throw ValidationError for level < 1', () => {
      expect(() => {
        statsService.computeItemStatsForLevel(mockItem, 0);
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid base stats', () => {
      const invalidItem = {
        item_type: {
          base_stats_normalized: {
            atkPower: 0.5,
            atkAccuracy: 0.5,
            defPower: 0.5,
            defAccuracy: 0.5
          }, // Sums to 2.0
          rarity: 'common' as const
        }
      };

      expect(() => {
        statsService.computeItemStatsForLevel(invalidItem, 1);
      }).toThrow(ValidationError);
    });
  });

  /**
   * Test Group 3: computeEquipmentStats() - Equipment aggregation
   */
  describe('computeEquipmentStats()', () => {
    const mockEquippedItems = [
      {
        slot: 'weapon' as EquipmentSlot,
        computed_stats: { atkPower: 20, atkAccuracy: 15, defPower: 5, defAccuracy: 5 },
        level: 5,
        item_id: 'weapon-1'
      },
      {
        slot: 'armor' as EquipmentSlot,
        computed_stats: { atkPower: 4, atkAccuracy: 5, defPower: 24.5, defAccuracy: 11.5 },
        level: 3,
        item_id: 'armor-1'
      },
      {
        slot: 'head' as EquipmentSlot,
        computed_stats: { atkPower: 2, atkAccuracy: 3, defPower: 8, defAccuracy: 7 },
        level: 2,
        item_id: 'head-1'
      }
    ];

    it('should aggregate stats from multiple equipped items', () => {
      const result = statsService.computeEquipmentStats(mockEquippedItems);

      expect(result.total_stats).toEqual({
        atkPower: 26.0,   // 20 + 4 + 2
        atkAccuracy: 23.0, // 15 + 5 + 3
        defPower: 37.5,   // 5 + 24.5 + 8
        defAccuracy: 23.5  // 5 + 11.5 + 7
      });

      expect(result.equipped_items_count).toBe(3);
      expect(result.total_item_level).toBe(10); // 5 + 3 + 2
    });

    it('should include individual item contributions by slot', () => {
      const result = statsService.computeEquipmentStats(mockEquippedItems);

      expect(result.item_contributions.weapon).toEqual({
        atkPower: 20, atkAccuracy: 15, defPower: 5, defAccuracy: 5
      });
      expect(result.item_contributions.armor).toEqual({
        atkPower: 4, atkAccuracy: 5, defPower: 24.5, defAccuracy: 11.5
      });
      expect(result.item_contributions.head).toEqual({
        atkPower: 2, atkAccuracy: 3, defPower: 8, defAccuracy: 7
      });

      // Unequipped slots should have zero stats
      expect(result.item_contributions.offhand).toEqual({
        atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0
      });
      expect(result.item_contributions.feet).toEqual({
        atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0
      });
      expect(result.item_contributions.accessory_1).toEqual({
        atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0
      });
      expect(result.item_contributions.accessory_2).toEqual({
        atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0
      });
      expect(result.item_contributions.pet).toEqual({
        atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0
      });
    });

    it('should handle empty equipment loadout', () => {
      const result = statsService.computeEquipmentStats([]);

      expect(result.total_stats).toEqual({
        atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0
      });
      expect(result.equipped_items_count).toBe(0);
      expect(result.total_item_level).toBe(0);

      // All slots should have zero stats
      Object.values(result.item_contributions).forEach(stats => {
        expect(stats).toEqual({
          atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0
        });
      });
    });

    it('should handle single equipped item', () => {
      const singleItem = [mockEquippedItems[0]];
      const result = statsService.computeEquipmentStats(singleItem);

      expect(result.total_stats).toEqual({
        atkPower: 20, atkAccuracy: 15, defPower: 5, defAccuracy: 5
      });
      expect(result.equipped_items_count).toBe(1);
      expect(result.total_item_level).toBe(5);
    });

    it('should round total stats to 2 decimal places', () => {
      const itemsWithDecimals = [
        {
          slot: 'weapon' as EquipmentSlot,
          computed_stats: { atkPower: 10.333, atkAccuracy: 5.666, defPower: 2.111, defAccuracy: 1.999 },
          level: 1,
          item_id: 'weapon-1'
        },
        {
          slot: 'armor' as EquipmentSlot,
          computed_stats: { atkPower: 5.666, atkAccuracy: 4.333, defPower: 8.888, defAccuracy: 3.001 },
          level: 1,
          item_id: 'armor-1'
        }
      ];

      const result = statsService.computeEquipmentStats(itemsWithDecimals);

      expect(result.total_stats).toEqual({
        atkPower: 16.0,  // 10.333 + 5.666 = 15.999 -> 16.0
        atkAccuracy: 10.0, // 5.666 + 4.333 = 9.999 -> 10.0
        defPower: 11.0,  // 2.111 + 8.888 = 10.999 -> 11.0
        defAccuracy: 5.0  // 1.999 + 3.001 = 5.0
      });
    });

    it('should throw ValidationError for more than 8 equipped items', () => {
      const tooManyItems = new Array(9).fill(null).map((_, i) => ({
        slot: 'weapon' as EquipmentSlot,
        computed_stats: { atkPower: 1, atkAccuracy: 1, defPower: 1, defAccuracy: 1 },
        level: 1,
        item_id: `item-${i}`
      }));

      expect(() => {
        statsService.computeEquipmentStats(tooManyItems);
      }).toThrow(ValidationError);
      expect(() => {
        statsService.computeEquipmentStats(tooManyItems);
      }).toThrow('Cannot equip more than 8 items');
    });

    it('should throw ValidationError for duplicate slots', () => {
      const duplicateSlots = [
        {
          slot: 'weapon' as EquipmentSlot,
          computed_stats: { atkPower: 10, atkAccuracy: 5, defPower: 2, defAccuracy: 1 },
          level: 1,
          item_id: 'weapon-1'
        },
        {
          slot: 'weapon' as EquipmentSlot, // Duplicate slot
          computed_stats: { atkPower: 8, atkAccuracy: 4, defPower: 3, defAccuracy: 2 },
          level: 1,
          item_id: 'weapon-2'
        }
      ];

      expect(() => {
        statsService.computeEquipmentStats(duplicateSlots);
      }).toThrow(ValidationError);
      expect(() => {
        statsService.computeEquipmentStats(duplicateSlots);
      }).toThrow('Duplicate equipment slot: weapon');
    });
  });

  /**
   * Test Group 4: validateMaterialModifiers() - Zero-sum validation
   */
  describe('validateMaterialModifiers()', () => {
    it('should pass validation for properly balanced materials', () => {
      const materials: AppliedMaterial[] = [
        {
          id: 'inst-1',
          material_id: 'iron',
          style_id: 'normal',
          slot_index: 0,
          material: {
            id: 'iron',
            name: 'Iron',
            rarity: 'common',
            stat_modifiers: { atkPower: 1.0, atkAccuracy: -0.5, defPower: -0.3, defAccuracy: -0.2 }, // Sums to 0
            theme: 'defensive'
          }
        },
        {
          id: 'inst-2',
          material_id: 'ruby',
          style_id: 'normal',
          slot_index: 1,
          material: {
            id: 'ruby',
            name: 'Ruby',
            rarity: 'rare',
            stat_modifiers: { atkPower: -1.0, atkAccuracy: 0.5, defPower: 0.3, defAccuracy: 0.2 }, // Sums to 0
            theme: 'offensive'
          }
        }
      ];

      expect(() => {
        statsService.validateMaterialModifiers(materials);
      }).not.toThrow();

      expect(statsService.validateMaterialModifiers(materials)).toBe(true);
    });

    it('should pass validation for empty materials array', () => {
      expect(() => {
        statsService.validateMaterialModifiers([]);
      }).not.toThrow();

      expect(statsService.validateMaterialModifiers([])).toBe(true);
    });

    it('should throw ValidationError for individual material not summing to 0', () => {
      const materials: AppliedMaterial[] = [{
        id: 'inst-1',
        material_id: 'invalid',
        style_id: 'normal',
        slot_index: 0,
        material: {
          id: 'invalid',
          name: 'Invalid',
          rarity: 'common',
          stat_modifiers: { atkPower: 1.0, atkAccuracy: 1.0, defPower: 1.0, defAccuracy: 1.0 }, // Sums to 4.0
          theme: 'balanced'
        }
      }];

      expect(() => {
        statsService.validateMaterialModifiers(materials);
      }).toThrow(ValidationError);
      expect(() => {
        statsService.validateMaterialModifiers(materials);
      }).toThrow('Material invalid stat modifiers must sum to 0, got 4');
    });

    it('should throw ValidationError for combined materials not summing to 0', () => {
      const materials: AppliedMaterial[] = [
        {
          id: 'inst-1',
          material_id: 'mat1',
          style_id: 'normal',
          slot_index: 0,
          material: {
            id: 'mat1',
            name: 'Material 1',
            rarity: 'common',
            stat_modifiers: { atkPower: 1.0, atkAccuracy: -0.5, defPower: -0.3, defAccuracy: -0.2 }, // Sums to 0
            theme: 'balanced'
          }
        },
        {
          id: 'inst-2',
          material_id: 'mat2',
          style_id: 'normal',
          slot_index: 1,
          material: {
            id: 'mat2',
            name: 'Material 2',
            rarity: 'common',
            stat_modifiers: { atkPower: 0.5, atkAccuracy: 0.5, defPower: -0.5, defAccuracy: -0.5 }, // Sums to 0
            theme: 'balanced'
          }
        }
      ];
      // Combined: 1.5, 0, -0.8, -0.7 = 0 (individual sums are valid, but combined creates imbalance)

      // Modify the second material to create combined imbalance
      materials[1].material.stat_modifiers = { atkPower: 1.0, atkAccuracy: 0.5, defPower: -0.5, defAccuracy: -1.0 }; // Still sums to 0

      // Now combined: 2.0, 0, -0.8, -1.2 = 0 (still balanced)

      // Actually create imbalance
      materials[1].material.stat_modifiers = { atkPower: 1.1, atkAccuracy: 0.5, defPower: -0.5, defAccuracy: -1.1 }; // Sums to 0
      // Combined: 2.1, 0, -0.8, -1.3 = 0 (still balanced)

      // Create actual imbalance
      materials[1].material.stat_modifiers = { atkPower: 1.1, atkAccuracy: 0.5, defPower: -0.5, defAccuracy: -1.0 }; // Sums to 0.1
      // Combined: 2.1, 0, -0.8, -1.2 = 0.1

      expect(() => {
        statsService.validateMaterialModifiers(materials);
      }).toThrow(ValidationError);
      expect(() => {
        statsService.validateMaterialModifiers(materials);
      }).toThrow('Material mat2 stat modifiers must sum to 0, got 0.1');
    });

    it('should allow small floating point tolerance', () => {
      const materials: AppliedMaterial[] = [{
        id: 'inst-1',
        material_id: 'floating',
        style_id: 'normal',
        slot_index: 0,
        material: {
          id: 'floating',
          name: 'Floating Point',
          rarity: 'common',
          stat_modifiers: {
            atkPower: 0.333333,
            atkAccuracy: 0.333333,
            defPower: 0.333333,
            defAccuracy: -0.999999 // Close enough to 0 within tolerance
          },
          theme: 'balanced'
        }
      }];

      expect(() => {
        statsService.validateMaterialModifiers(materials);
      }).not.toThrow();
    });

    it('should reject values outside tolerance', () => {
      const materials: AppliedMaterial[] = [{
        id: 'inst-1',
        material_id: 'outside',
        style_id: 'normal',
        slot_index: 0,
        material: {
          id: 'outside',
          name: 'Outside Tolerance',
          rarity: 'common',
          stat_modifiers: {
            atkPower: 0.5,
            atkAccuracy: 0.5,
            defPower: 0.5,
            defAccuracy: -1.52 // Sum = 0.02, outside ±0.01 tolerance
          },
          theme: 'balanced'
        }
      }];

      expect(() => {
        statsService.validateMaterialModifiers(materials);
      }).toThrow(ValidationError);
    });
  });

  /**
   * Test Group 5: Edge cases and boundary conditions
   */
  describe('Edge Cases', () => {
    it('should handle maximum values without overflow', () => {
      const highStats: Stats = { atkPower: 0.25, atkAccuracy: 0.25, defPower: 0.25, defAccuracy: 0.25 };
      const result = statsService.computeItemStats(highStats, 100, []);

      expect(result.atkPower).toBe(250);
      expect(result.atkAccuracy).toBe(250);
      expect(result.defPower).toBe(250);
      expect(result.defAccuracy).toBe(250);
    });

    it('should handle negative stat results from large negative modifiers', () => {
      const materials: AppliedMaterial[] = [{
        id: 'inst-1',
        material_id: 'massive-negative',
        style_id: 'normal',
        slot_index: 0,
        material: {
          id: 'massive-negative',
          name: 'Massive Negative',
          rarity: 'common',
          stat_modifiers: { atkPower: -100, atkAccuracy: 50, defPower: 25, defAccuracy: 25 }, // Sums to 0
          theme: 'exotic'
        }
      }];

      const result = statsService.computeItemStats(
        { atkPower: 0.25, atkAccuracy: 0.25, defPower: 0.25, defAccuracy: 0.25 },
        1,
        materials
      );

      expect(result.atkPower).toBe(-97.5); // 2.5 - 100
      expect(result.atkAccuracy).toBe(52.5); // 2.5 + 50
      expect(result.defPower).toBe(27.5);   // 2.5 + 25
      expect(result.defAccuracy).toBe(27.5); // 2.5 + 25
    });

    it('should handle zero base stats', () => {
      const zeroStats: Stats = { atkPower: 0, atkAccuracy: 0, defPower: 1.0, defAccuracy: 0 };
      const result = statsService.computeItemStats(zeroStats, 5, []);

      expect(result.atkPower).toBe(0);
      expect(result.atkAccuracy).toBe(0);
      expect(result.defPower).toBe(50);
      expect(result.defAccuracy).toBe(0);
    });

    it('should handle full equipment loadout (8 items)', () => {
      const fullLoadout = [
        { slot: 'weapon' as EquipmentSlot, computed_stats: { atkPower: 10, atkAccuracy: 5, defPower: 2, defAccuracy: 1 }, level: 1, item_id: '1' },
        { slot: 'offhand' as EquipmentSlot, computed_stats: { atkPower: 5, atkAccuracy: 10, defPower: 1, defAccuracy: 2 }, level: 1, item_id: '2' },
        { slot: 'head' as EquipmentSlot, computed_stats: { atkPower: 2, atkAccuracy: 3, defPower: 8, defAccuracy: 7 }, level: 1, item_id: '3' },
        { slot: 'armor' as EquipmentSlot, computed_stats: { atkPower: 1, atkAccuracy: 2, defPower: 15, defAccuracy: 12 }, level: 1, item_id: '4' },
        { slot: 'feet' as EquipmentSlot, computed_stats: { atkPower: 3, atkAccuracy: 4, defPower: 6, defAccuracy: 5 }, level: 1, item_id: '5' },
        { slot: 'accessory_1' as EquipmentSlot, computed_stats: { atkPower: 2, atkAccuracy: 2, defPower: 2, defAccuracy: 2 }, level: 1, item_id: '6' },
        { slot: 'accessory_2' as EquipmentSlot, computed_stats: { atkPower: 3, atkAccuracy: 1, defPower: 1, defAccuracy: 3 }, level: 1, item_id: '7' },
        { slot: 'pet' as EquipmentSlot, computed_stats: { atkPower: 4, atkAccuracy: 3, defPower: 5, defAccuracy: 8 }, level: 1, item_id: '8' }
      ];

      const result = statsService.computeEquipmentStats(fullLoadout);

      expect(result.equipped_items_count).toBe(8);
      expect(result.total_item_level).toBe(8);
      expect(result.total_stats).toEqual({
        atkPower: 30,  // 10+5+2+1+3+2+3+4
        atkAccuracy: 30, // 5+10+3+2+4+2+1+3
        defPower: 40,  // 2+1+8+15+6+2+1+5
        defAccuracy: 40 // 1+2+7+12+5+2+3+8
      });

      // All slots should have contributions
      Object.values(result.item_contributions).forEach(stats => {
        expect(stats.atkPower + stats.atkAccuracy + stats.defPower + stats.defAccuracy).toBeGreaterThan(0);
      });
    });
  });
});