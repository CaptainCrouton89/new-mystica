import { createHash } from 'crypto';

/**
 * Material combination hash utilities for New Mystica
 *
 * Provides deterministic hashing for material combinations to enable
 * global image caching regardless of application order.
 */

/**
 * Material combination data for hashing
 */
export interface MaterialCombo {
  materialId: string;
  isShiny: boolean;
}

/**
 * Compute deterministic hash for material combination
 *
 * Features:
 * - Order-insensitive (same materials = same hash regardless of order)
 * - Includes shiny flags in hash computation
 * - Uses SHA-256 for collision resistance
 * - Handles empty material arrays
 *
 * @param materialIds - Array of material UUIDs
 * @param shinyFlags - Array of shiny flags (must match length of materialIds)
 * @returns SHA-256 hash string (64 characters)
 *
 * @example
 * ```typescript
 * // These produce the same hash:
 * computeComboHash(['wood-uuid', 'crystal-uuid'], [false, true]);
 * computeComboHash(['crystal-uuid', 'wood-uuid'], [true, false]);
 *
 * // Result: "a1b2c3d4e5f6..."
 * ```
 *
 * @throws {Error} If materialIds and shinyFlags arrays have different lengths
 */
export function computeComboHash(
  materialIds: string[],
  shinyFlags: boolean[]
): string {
  // Validate input arrays
  if (materialIds.length !== shinyFlags.length) {
    throw new Error(
      `Material IDs and shiny flags arrays must have same length: ${materialIds.length} vs ${shinyFlags.length}`
    );
  }

  // Handle empty arrays
  if (materialIds.length === 0) {
    return createHash('sha256').update('empty').digest('hex');
  }

  // Create material combo objects and sort for order-insensitive hashing
  const combos: MaterialCombo[] = materialIds.map((id, index) => ({
    materialId: id,
    isShiny: shinyFlags[index],
  }));

  // Sort by material ID to ensure consistent ordering
  combos.sort((a, b) => a.materialId.localeCompare(b.materialId));

  // Create hash input string
  const hashInput = combos
    .map(combo => `${combo.materialId}:${combo.isShiny ? 'shiny' : 'normal'}`)
    .join('|');

  // Compute SHA-256 hash
  return createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Compute hash from material combo objects
 * Convenience function for when you already have MaterialCombo objects
 *
 * @param combos - Array of material combo objects
 * @returns SHA-256 hash string
 */
export function computeComboHashFromObjects(combos: MaterialCombo[]): string {
  const materialIds = combos.map(c => c.materialId);
  const shinyFlags = combos.map(c => c.isShiny);

  return computeComboHash(materialIds, shinyFlags);
}

/**
 * Validate combo hash format
 * Ensures hash is a valid SHA-256 hex string
 *
 * @param hash - Hash string to validate
 * @returns True if valid SHA-256 hash format
 */
export function isValidComboHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Extract material information from database ItemMaterials join
 * Helper for computing hashes from database query results
 *
 * @param itemMaterials - Array of ItemMaterials with joined MaterialInstance data
 * @returns Computed combo hash
 *
 * @example
 * ```typescript
 * const itemMaterials = await supabase
 *   .from('item_materials')
 *   .select(`
 *     material_instance:material_instances(
 *       material_id,
 *       is_shiny
 *     )
 *   `)
 *   .eq('item_id', itemId);
 *
 * const hash = computeHashFromItemMaterials(itemMaterials.data);
 * ```
 */
export function computeHashFromItemMaterials(
  itemMaterials: Array<{
    material_instance: {
      material_id: string;
      is_shiny: boolean;
    } | null;
  }>
): string {
  // Filter out null material instances and extract data
  const validMaterials = itemMaterials
    .map(im => im.material_instance)
    .filter((mi): mi is NonNullable<typeof mi> => mi !== null);

  const materialIds = validMaterials.map(mi => mi.material_id);
  const shinyFlags = validMaterials.map(mi => mi.is_shiny);

  return computeComboHash(materialIds, shinyFlags);
}

/**
 * Generate a short hash for display purposes
 * Takes first 8 characters of the full hash for UI display
 *
 * @param fullHash - Full SHA-256 hash
 * @returns Short hash (8 characters)
 */
export function getShortHash(fullHash: string): string {
  if (!isValidComboHash(fullHash)) {
    throw new Error('Invalid hash format for shortening');
  }

  return fullHash.substring(0, 8);
}

/**
 * Debug utility to explain hash composition
 * Useful for development and debugging hash mismatches
 *
 * @param materialIds - Material IDs used in hash
 * @param shinyFlags - Shiny flags used in hash
 * @returns Object with hash details for debugging
 */
export function debugComboHash(materialIds: string[], shinyFlags: boolean[]) {
  const combos: MaterialCombo[] = materialIds.map((id, index) => ({
    materialId: id,
    isShiny: shinyFlags[index],
  }));

  const sortedCombos = [...combos].sort((a, b) => a.materialId.localeCompare(b.materialId));

  const hashInput = sortedCombos
    .map(combo => `${combo.materialId}:${combo.isShiny ? 'shiny' : 'normal'}`)
    .join('|');

  const hash = computeComboHash(materialIds, shinyFlags);

  return {
    originalOrder: combos,
    sortedOrder: sortedCombos,
    hashInput,
    fullHash: hash,
    shortHash: getShortHash(hash),
  };
}