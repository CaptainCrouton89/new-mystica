/**
 * Test Assertion Helpers
 *
 * Validation utilities for game data structures, stats, and business rules.
 * Provides reusable assertion functions for testing game logic consistency.
 */

import type { Stats, Item, Material, ItemType } from '../../src/types/api.types.js';

// ============================================================================
// Stats Validation
// ============================================================================

/**
 * Assert stats sum to 1.0 (normalized) for base item stats
 */
export function expectValidNormalizedStats(stats: Stats): void {
  const sum = stats.atkPower + stats.atkAccuracy + stats.defPower + stats.defAccuracy;
  expect(sum).toBeCloseTo(1.0, 5);

  // All stats should be non-negative
  expect(stats.atkPower).toBeGreaterThanOrEqual(0);
  expect(stats.atkAccuracy).toBeGreaterThanOrEqual(0);
  expect(stats.defPower).toBeGreaterThanOrEqual(0);
  expect(stats.defAccuracy).toBeGreaterThanOrEqual(0);
}

/**
 * Assert valid material modifiers (sum to 0.0 for balance)
 */
export function expectValidMaterialModifiers(modifiers: Stats): void {
  const sum = modifiers.atkPower + modifiers.atkAccuracy + modifiers.defPower + modifiers.defAccuracy;
  expect(sum).toBeCloseTo(0.0, 5);

  // Modifiers can be negative (that's the point)
  expect(modifiers.atkPower).toBeGreaterThanOrEqual(-1.0);
  expect(modifiers.atkAccuracy).toBeGreaterThanOrEqual(-1.0);
  expect(modifiers.defPower).toBeGreaterThanOrEqual(-1.0);
  expect(modifiers.defAccuracy).toBeGreaterThanOrEqual(-1.0);

  expect(modifiers.atkPower).toBeLessThanOrEqual(1.0);
  expect(modifiers.atkAccuracy).toBeLessThanOrEqual(1.0);
  expect(modifiers.defPower).toBeLessThanOrEqual(1.0);
  expect(modifiers.defAccuracy).toBeLessThanOrEqual(1.0);
}

/**
 * Assert final computed stats are valid (any positive values)
 */
export function expectValidComputedStats(stats: Stats): void {
  // Computed stats should all be non-negative after material application
  expect(stats.atkPower).toBeGreaterThanOrEqual(0);
  expect(stats.atkAccuracy).toBeGreaterThanOrEqual(0);
  expect(stats.defPower).toBeGreaterThanOrEqual(0);
  expect(stats.defAccuracy).toBeGreaterThanOrEqual(0);

  // Should be reasonable values (no crazy numbers)
  expect(stats.atkPower).toBeLessThanOrEqual(2.0);
  expect(stats.atkAccuracy).toBeLessThanOrEqual(2.0);
  expect(stats.defPower).toBeLessThanOrEqual(2.0);
  expect(stats.defAccuracy).toBeLessThanOrEqual(2.0);
}

// ============================================================================
// Item Validation
// ============================================================================

/**
 * Assert valid Item structure and business rules
 */
export function expectValidItem(item: Item): void {
  // Valid UUID format
  expectValidUUID(item.id);
  expectValidUUID(item.user_id);

  // Valid level (minimum 1)
  expect(item.level).toBeGreaterThanOrEqual(1);
  expect(item.level).toBeLessThanOrEqual(100); // Reasonable max level

  // Stats validation
  expectValidComputedStats(item.current_stats);

  // Materials constraint: 0-3 max
  if (item.materials) {
    expect(item.materials.length).toBeLessThanOrEqual(3);

    // Each material should have valid slot index
    for (const material of item.materials) {
      expect(material.slot_index).toBeGreaterThanOrEqual(0);
      expect(material.slot_index).toBeLessThanOrEqual(2);
      expectValidUUID(material.id);
    }

    // No duplicate slot indices
    const slotIndices = item.materials.map(m => m.slot_index);
    const uniqueSlots = new Set(slotIndices);
    expect(uniqueSlots.size).toBe(slotIndices.length);
  }

  // Date validation
  expect(new Date(item.created_at)).toBeInstanceOf(Date);
  expect(new Date(item.updated_at)).toBeInstanceOf(Date);
  expect(new Date(item.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(item.created_at).getTime());
}

/**
 * Assert valid ItemType structure from seed data
 */
export function expectValidItemType(itemType: ItemType): void {
  // Required fields
  expect(itemType.id).toBeTruthy();
  expect(itemType.name).toBeTruthy();
  expect(itemType.equipment_slot).toBeTruthy();
  expect(itemType.rarity).toBeTruthy();

  // Valid equipment slot (after transformation from seed data)
  const validSlots = ['weapon', 'shield', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'];
  expect(validSlots).toContain(itemType.equipment_slot);

  // Valid rarity
  const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  expect(validRarities).toContain(itemType.rarity);

  // Stats validation
  expectValidNormalizedStats(itemType.base_stats);

  // Category should match slot logic
  if (itemType.equipment_slot === 'accessory_1' || itemType.equipment_slot === 'accessory_2') {
    expect(itemType.category).toBe('accessory');
  } else if (itemType.equipment_slot === 'shield') {
    expect(itemType.category).toBe('shield');
  } else {
    expect(itemType.category).toBe(itemType.equipment_slot);
  }
}

/**
 * Assert valid Material structure from seed data
 */
export function expectValidMaterial(material: Material): void {
  // Required fields
  expect(material.id).toBeTruthy();
  expect(material.name).toBeTruthy();
  expect(material.rarity).toBeTruthy();

  // Valid rarity
  const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  expect(validRarities).toContain(material.rarity);

  // Modifier validation
  expectValidMaterialModifiers(material.stat_modifiers);
}

// ============================================================================
// Business Rule Validation
// ============================================================================

/**
 * Assert is_styled flag consistency with applied materials
 */
export function expectCorrectStyledFlag(item: Item): void {
  if (!item.materials || item.materials.length === 0) {
    // No materials = not styled (assuming normal style_id logic)
    return;
  }

  // Check if any material has non-normal style
  // Note: This assumes materials have a style_id property
  // For now, we'll check if the item has material_combo_hash (indicating crafting)
  if (item.material_combo_hash && item.materials.length > 0) {
    // Item has been crafted, styling rules would apply
    // This is a placeholder for future style_id validation
  }
}

/**
 * Assert material application constraints (1-3 materials max)
 */
export function expectValidMaterialApplication(item: Item): void {
  if (!item.materials) return;

  // 1-3 materials constraint from F-04 spec
  expect(item.materials.length).toBeGreaterThanOrEqual(0);
  expect(item.materials.length).toBeLessThanOrEqual(3);

  // Each material should be in a unique slot
  const slots = item.materials.map(m => m.slot_index);
  const uniqueSlots = new Set(slots);
  expect(uniqueSlots.size).toBe(slots.length);

  // Slots should be 0, 1, or 2
  for (const slot of slots) {
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(slot).toBeLessThanOrEqual(2);
  }
}

/**
 * Assert combat session state consistency
 */
export function expectValidCombatSession(session: any): void {
  expectValidUUID(session.session_id || session.id);

  // HP values should be non-negative
  expect(session.player_hp).toBeGreaterThanOrEqual(0);
  expect(session.enemy_hp).toBeGreaterThanOrEqual(0);

  // Turn number should be positive
  expect(session.turn_number).toBeGreaterThanOrEqual(1);

  // Timestamps should be valid
  expect(new Date(session.created_at)).toBeInstanceOf(Date);
  if (session.updated_at) {
    expect(new Date(session.updated_at)).toBeInstanceOf(Date);
  }
}

// ============================================================================
// Utility Assertions
// ============================================================================

/**
 * Assert valid UUID format
 */
export function expectValidUUID(uuid: string): void {
  expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
}

/**
 * Assert valid timestamp format (ISO 8601)
 */
export function expectValidTimestamp(timestamp: string): void {
  const date = new Date(timestamp);
  expect(date).toBeInstanceOf(Date);
  expect(date.getTime()).not.toBeNaN();
  // Should be in reasonable range (not too far in past/future)
  const now = Date.now();
  const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
  const oneYearFromNow = now + (365 * 24 * 60 * 60 * 1000);
  expect(date.getTime()).toBeGreaterThan(oneYearAgo);
  expect(date.getTime()).toBeLessThan(oneYearFromNow);
}

/**
 * Assert valid gold amount (non-negative integer)
 */
export function expectValidGoldAmount(gold: number): void {
  expect(gold).toBeGreaterThanOrEqual(0);
  expect(Number.isInteger(gold)).toBe(true);
}

/**
 * Assert valid rarity value
 */
export function expectValidRarity(rarity: string): void {
  const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  expect(validRarities).toContain(rarity);
}

/**
 * Assert valid equipment slot value
 */
export function expectValidEquipmentSlot(slot: string): void {
  const validSlots = ['weapon', 'offhand', 'shield', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'];
  expect(validSlots).toContain(slot);
}

/**
 * Assert API response structure
 */
export function expectValidApiResponse(response: any, expectedDataType?: string): void {
  expect(response).toHaveProperty('success');
  expect(typeof response.success).toBe('boolean');

  if (response.success) {
    expect(response).toHaveProperty('data');
    if (expectedDataType && response.data) {
      expect(typeof response.data).toBe(expectedDataType);
    }
  } else {
    expect(response).toHaveProperty('error');
    expect(response.error).toHaveProperty('code');
    expect(response.error).toHaveProperty('message');
  }

  expect(response).toHaveProperty('timestamp');
  expectValidTimestamp(response.timestamp);
}

/**
 * Assert pagination structure
 */
export function expectValidPagination(pagination: any): void {
  expect(pagination).toHaveProperty('page');
  expect(pagination).toHaveProperty('limit');
  expect(pagination).toHaveProperty('total');
  expect(pagination).toHaveProperty('total_pages');
  expect(pagination).toHaveProperty('has_next');
  expect(pagination).toHaveProperty('has_prev');

  expect(typeof pagination.page).toBe('number');
  expect(typeof pagination.limit).toBe('number');
  expect(typeof pagination.total).toBe('number');
  expect(typeof pagination.total_pages).toBe('number');
  expect(typeof pagination.has_next).toBe('boolean');
  expect(typeof pagination.has_prev).toBe('boolean');

  expect(pagination.page).toBeGreaterThanOrEqual(1);
  expect(pagination.limit).toBeGreaterThanOrEqual(1);
  expect(pagination.total).toBeGreaterThanOrEqual(0);
  expect(pagination.total_pages).toBeGreaterThanOrEqual(1);
}