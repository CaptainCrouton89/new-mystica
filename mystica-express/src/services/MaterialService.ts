import { MaterialStack, ApplyMaterialResult, ReplaceMaterialResult } from '../types/api.types';
import { NotImplementedError } from '../utils/errors';

/**
 * Handles material application to items with image generation
 */
export class MaterialService {
  /**
   * Get user's material inventory
   * - Fetches all material stacks owned by user
   * - Groups by material type and shiny status
   * - Returns stackable inventory data
   */
  async getMaterialInventory(userId: string): Promise<MaterialStack[]> {
    // TODO: Implement material inventory retrieval
    // 1. Query MaterialStacks table for user_id
    // 2. Join with Materials for base data
    // 3. Return grouped stacks with quantities
    throw new NotImplementedError('MaterialService.getMaterialInventory not implemented');
  }

  /**
   * Apply material to item (up to 3 total)
   * - Validates ownership and slot availability
   * - Decrements MaterialStacks quantity
   * - Creates MaterialInstance
   * - Computes material_combo_hash
   * - Checks ItemImageCache or generates (20s sync)
   * - Returns is_first_craft and craft_count
   */
  async applyMaterial(
    userId: string,
    itemId: string,
    materialId: string,
    styleId: string,
    slotIndex: number
  ): Promise<ApplyMaterialResult> {
    // TODO: Implement material application workflow
    // 1. Validate user owns item
    // 2. Check slot availability (max 3 materials per item)
    // 3. Validate slotIndex (0-2) and not occupied
    // 4. Check MaterialStacks for sufficient quantity (>=1)
    // 5. Create MaterialInstance record
    // 6. Insert ItemMaterials junction record
    // 7. Decrement MaterialStacks quantity
    // 8. Compute deterministic combo_hash (sorted material IDs)
    // 9. Check ItemImageCache for existing combo
    // 10. If not cached: call ImageGenerationService.generateImage (20s sync)
    // 11. Update Items table with new combo_hash and image_url
    // 12. Return result with cache status and craft count
    throw new NotImplementedError('MaterialService.applyMaterial not implemented');
  }

  /**
   * Replace existing material on item with new one
   * - Costs gold to replace (higher for styled materials)
   * - Returns old material to inventory as stack
   * - Regenerates image if combo changes
   */
  async replaceMaterial(
    userId: string,
    itemId: string,
    slotIndex: number,
    newMaterialId: string,
    newStyleId: string,
    goldCost: number
  ): Promise<ReplaceMaterialResult> {
    // TODO: Implement material replacement workflow
    // 1. Validate user owns item and has sufficient gold
    // 2. Check slot is occupied (slotIndex 0-2)
    // 3. Get existing MaterialInstance from slot
    // 4. Check user has new material in MaterialStacks
    // 5. Deduct gold from user profile
    // 6. Update MaterialInstance with new material/style_id
    // 7. Increment MaterialStacks for old material (return to inventory)
    // 8. Decrement MaterialStacks for new material
    // 9. Recompute combo_hash
    // 10. Check ItemImageCache or generate new image
    // 11. Update Items table
    // 12. Return result with gold spent and replaced material
    throw new NotImplementedError('MaterialService.replaceMaterial not implemented');
  }
}

export const materialService = new MaterialService();