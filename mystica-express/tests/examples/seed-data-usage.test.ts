/**
 * Example: Using Seed Data Utilities in Tests
 *
 * Demonstrates how to use seed data loaders and assertions
 * in actual test scenarios for game logic validation.
 */

import {
  loadSeededItems,
  loadSeededMaterials,
  getItemByType,
  getMaterialById,
  getRandomMaterials,
  validateItemStatNormalization,
  validateMaterialModifierBalance
} from '../helpers/seedData.js';

import {
  expectValidItemType,
  expectValidMaterial,
  expectValidNormalizedStats,
  expectValidMaterialModifiers,
  expectValidRarity
} from '../helpers/assertions.js';

describe('Example: Seed Data Usage', () => {
  describe('Item System Validation', () => {
    it('should validate all seed items have proper stats', async () => {
      const items = await loadSeededItems();

      for (const item of items) {
        expectValidItemType(item);
        expectValidNormalizedStats(item.base_stats);
        expectValidRarity(item.rarity);
      }

      console.log(`✓ Validated ${items.length} items from seed data`);
    });

    it('should verify specific items exist with correct properties', async () => {
      // Test getting specific items by ID
      const sword = await getItemByType('sword');
      const dragon = await getItemByType('dragon');

      expect(sword).toBeDefined();
      expect(sword?.equipment_slot).toBe('weapon');
      expect(sword?.rarity).toBe('epic');

      expect(dragon).toBeDefined();
      expect(dragon?.equipment_slot).toBe('pet');
      expect(dragon?.category).toBe('pet');

      console.log(`✓ Verified sword (${sword?.name}) and dragon (${dragon?.name}) exist`);
    });
  });

  describe('Material System Validation', () => {
    it('should validate all seed materials have balanced modifiers', async () => {
      const materials = await loadSeededMaterials();

      for (const material of materials) {
        expectValidMaterial(material);
        expectValidMaterialModifiers(material.stat_modifiers);
      }

      console.log(`✓ Validated ${materials.length} materials from seed data`);
    });

    it('should verify specific materials exist with correct modifiers', async () => {
      const coffee = await getMaterialById('coffee');
      const diamond = await getMaterialById('diamond');

      expect(coffee).toBeDefined();
      expect(coffee?.name).toBe('Coffee');
      // Materials don't have rarity - only items do
      // Coffee should boost attack at cost of defense
      expect(coffee?.stat_modifiers.atkPower).toBeGreaterThan(0);
      expect(coffee?.stat_modifiers.defPower).toBeLessThan(0);

      expect(diamond).toBeDefined();
      expect(diamond?.name).toBe('Diamond');
      // Diamond should boost defense at cost of attack
      expect(diamond?.stat_modifiers.defPower).toBeGreaterThan(0);
      expect(diamond?.stat_modifiers.atkPower).toBeLessThan(0);

      console.log(`✓ Verified coffee and diamond materials have expected stat trade-offs`);
    });
  });

  describe('Random Data Generation', () => {
    it('should generate random materials for crafting tests', async () => {
      // Get 3 random materials for a crafting test
      const materials = await getRandomMaterials(3);

      expect(materials).toHaveLength(3);

      // All should be unique
      const ids = materials.map(m => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);

      // All should be valid
      for (const material of materials) {
        expectValidMaterial(material);
      }

      console.log(`✓ Generated random materials: ${materials.map(m => m.name).join(', ')}`);
    });
  });

  describe('Game Balance Validation', () => {
    it('should verify game balance constraints are met', async () => {
      // Validate item stats are normalized (sum to 1.0)
      const itemValidation = await validateItemStatNormalization();
      expect(itemValidation.valid).toBe(true);

      if (!itemValidation.valid) {
        console.warn('Item stat normalization issues:', itemValidation.errors);
        throw new Error('Some items have non-normalized stats');
      }

      // Validate material modifiers are balanced (sum to 0.0)
      const materialValidation = await validateMaterialModifierBalance();
      expect(materialValidation.valid).toBe(true);

      if (!materialValidation.valid) {
        console.warn('Material balance issues:', materialValidation.errors);
        throw new Error('Some materials have unbalanced modifiers');
      }

      console.log('✓ Game balance validation passed');
    });
  });

  describe('Integration Test Examples', () => {
    it('should demonstrate crafting logic validation', async () => {
      // Get a weapon and specific materials for controlled testing
      const sword = await getItemByType('sword');
      const coffee = await getMaterialById('coffee');
      const materials = coffee ? [coffee] : [];

      expect(sword).toBeDefined();
      expect(materials.length).toBeGreaterThan(0);

      // Simulate applying materials to item (just stat calculation)
      const baseStats = sword!.base_stats;
      let modifiedStats = { ...baseStats };

      for (const material of materials) {
        modifiedStats.atkPower += material.stat_modifiers.atkPower;
        modifiedStats.atkAccuracy += material.stat_modifiers.atkAccuracy;
        modifiedStats.defPower += material.stat_modifiers.defPower;
        modifiedStats.defAccuracy += material.stat_modifiers.defAccuracy;
      }

      // Test the core crafting concept: stats are modified by materials
      expect(modifiedStats.atkPower).not.toBe(baseStats.atkPower);
      expect(modifiedStats.defPower).not.toBe(baseStats.defPower);

      // Coffee should increase attack and decrease defense
      expect(modifiedStats.atkPower).toBeGreaterThan(baseStats.atkPower);
      expect(modifiedStats.defPower).toBeLessThan(baseStats.defPower);

      console.log(`✓ Crafted ${sword!.name} with ${materials.map(m => m.name).join(' + ')}`);
      console.log(`  Base: atk=${baseStats.atkPower.toFixed(2)}, def=${baseStats.defPower.toFixed(2)}`);
      console.log(`  Modified: atk=${modifiedStats.atkPower.toFixed(2)}, def=${modifiedStats.defPower.toFixed(2)}`);
    });
  });
});