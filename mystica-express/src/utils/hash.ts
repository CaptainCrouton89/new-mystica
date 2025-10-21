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
  styleId: string;
}

/**
 * Compute deterministic hash for material combination
 *
 * Features:
 * - Order-insensitive (same materials = same hash regardless of order)
 * - Includes style IDs in hash computation
 * - Uses SHA-256 for collision resistance
 * - Handles empty material arrays
 *
 * @param materialIds - Array of material UUIDs
 * @param styleIds - Array of style UUIDs (must match length of materialIds)
 * @returns SHA-256 hash string (64 characters)
 *
 * @example
 * ```typescript
 * // These produce the same hash:
 * computeComboHash(['wood-uuid', 'crystal-uuid'], ['normal-uuid', 'shiny-uuid']);
 * computeComboHash(['crystal-uuid', 'wood-uuid'], ['shiny-uuid', 'normal-uuid']);
 *
 * // Result: "a1b2c3d4e5f6..."
 * ```
 *
 * @throws {Error} If materialIds and styleIds arrays have different lengths
 */
export function computeComboHash(
  materialIds: string[],
  styleIds: string[]
): string {
  // Validate input arrays
  if (materialIds.length !== styleIds.length) {
    throw new Error(
      `Material IDs and style IDs arrays must have same length: ${materialIds.length} vs ${styleIds.length}`
    );
  }

  // Handle empty arrays
  if (materialIds.length === 0) {
    return createHash('sha256').update('empty').digest('hex');
  }

  // Create material combo objects and sort for order-insensitive hashing
  const combos: MaterialCombo[] = materialIds.map((id, index) => ({
    materialId: id,
    styleId: styleIds[index],
  }));

  // Sort by material ID to ensure consistent ordering
  combos.sort((a, b) => a.materialId.localeCompare(b.materialId));

  // Create hash input string
  const hashInput = combos
    .map(combo => `${combo.materialId}:${combo.styleId}`)
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
  const styleIds = combos.map(c => c.styleId);

  return computeComboHash(materialIds, styleIds);
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
 *       style_id
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
      style_id: string;
    } | null;
  }>
): string {
  // Filter out null material instances and extract data
  const validMaterials = itemMaterials
    .map(im => im.material_instance)
    .filter((mi): mi is NonNullable<typeof mi> => mi !== null);

  const materialIds = validMaterials.map(mi => mi.material_id);
  const styleIds = validMaterials.map(mi => mi.style_id);

  return computeComboHash(materialIds, styleIds);
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
 * Alias for computeComboHash to match service specification naming
 * @param materialIds - Array of material UUIDs
 * @param styleIds - Array of style UUIDs
 * @returns SHA-256 hash string
 */
export const computeComboHashWithStyles = computeComboHash;

/**
 * Debug utility to explain hash composition
 * Useful for development and debugging hash mismatches
 *
 * @param materialIds - Material IDs used in hash
 * @param styleIds - Style IDs used in hash
 * @returns Object with hash details for debugging
 */
export function debugComboHash(materialIds: string[], styleIds: string[]) {
  const combos: MaterialCombo[] = materialIds.map((id, index) => ({
    materialId: id,
    styleId: styleIds[index],
  }));

  const sortedCombos = [...combos].sort((a, b) => a.materialId.localeCompare(b.materialId));

  const hashInput = sortedCombos
    .map(combo => `${combo.materialId}:${combo.styleId}`)
    .join('|');

  const hash = computeComboHash(materialIds, styleIds);

  return {
    originalOrder: combos,
    sortedOrder: sortedCombos,
    hashInput,
    fullHash: hash,
    shortHash: getShortHash(hash),
  };
}