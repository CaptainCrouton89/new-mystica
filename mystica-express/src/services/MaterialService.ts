import { Material, MaterialStack, ApplyMaterialResult, ReplaceMaterialResult } from '../types/api.types.js';
import { NotImplementedError, NotFoundError, ValidationError, BusinessLogicError } from '../utils/errors.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { ImageCacheRepository } from '../repositories/ImageCacheRepository.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { ImageGenerationService } from './ImageGenerationService.js';
import { MaterialInstance, CreateImageCacheData } from '../types/repository.types.js';
import { computeComboHash } from '../utils/hash.js';
import { economyService } from './EconomyService.js';

/**
 * Handles material application to items with image generation
 */
export class MaterialService {
  private materialRepository: MaterialRepository;
  private imageCacheRepository: ImageCacheRepository;
  private itemRepository: ItemRepository;
  private imageGenerationService: ImageGenerationService;

  constructor() {
    this.materialRepository = new MaterialRepository();
    this.imageCacheRepository = new ImageCacheRepository();
    this.itemRepository = new ItemRepository();
    this.imageGenerationService = new ImageGenerationService();
  }

  /**
   * Get all material templates (no auth required)
   * - Returns complete material library for client display
   * - Includes: id, name, description, stat_modifiers, theme
   * - Ordered by name alphabetically
   */
  async getAllMaterials(): Promise<Material[]> {
    return await this.materialRepository.findAllMaterials();
  }
  /**
   * Get user's material inventory
   * - Fetches all material stacks owned by user
   * - Groups by material type and style
   * - Returns stackable inventory data
   */
  async getMaterialInventory(userId: string): Promise<MaterialStack[]> {
    // TODO: Implement material inventory retrieval
    // 1. Query MaterialStacks table for user_id
    // 2. Join with Materials for base data
    // 3. Return grouped stacks with quantities

    // Get all material stacks for the user
    const stacks = await this.materialRepository.findAllStacksByUser(userId);

    // For each stack, fetch the material template data
    const stacksWithMaterials: MaterialStack[] = [];

    for (const stack of stacks) {
      const material = await this.materialRepository.findMaterialById(stack.material_id);
      if (!material) {
        continue; // Skip stacks with invalid material references
      }

      stacksWithMaterials.push({
        id: stack.user_id + ':' + stack.material_id + ':' + stack.style_id, // Composite key
        user_id: stack.user_id,
        material_id: stack.material_id,
        style_id: stack.style_id,
        quantity: stack.quantity,
        material: {
          id: material.id,
          name: material.name,
          rarity: material.rarity as any,
          stat_modifiers: material.stat_modifiers as any,
          theme: material.theme as any,
          image_url: material.image_url || undefined,
          description: material.description || undefined
        }
      });
    }

    return stacksWithMaterials;
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
  async applyMaterial(request: {
    userId: string;
    itemId: string;
    materialId: string;
    styleId: string;
    slotIndex: number;
  }): Promise<ApplyMaterialResult> {
    const { userId, itemId, materialId, styleId, slotIndex } = request;
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

    // 1. Validate user owns item
    const item = await this.itemRepository.findById(itemId, userId);
    if (!item) {
      throw new NotFoundError('Item', itemId);
    }

    // 2. Check slot availability (max 3 materials per item)
    const occupiedSlots = await this.materialRepository.getSlotOccupancy(itemId);
    if (occupiedSlots.length >= 3) {
      throw new BusinessLogicError('Item already has maximum 3 materials applied');
    }

    // 3. Validate slotIndex (0-2) and not occupied
    if (slotIndex < 0 || slotIndex > 2) {
      throw new ValidationError('Slot index must be between 0 and 2');
    }
    if (occupiedSlots.includes(slotIndex)) {
      throw new BusinessLogicError(`Slot ${slotIndex} is already occupied`);
    }

    // 4. Check MaterialStacks for sufficient quantity (>=1)
    const materialStack = await this.materialRepository.findStackByUser(userId, materialId, styleId);
    if (!materialStack || materialStack.quantity < 1) {
      throw new BusinessLogicError('Insufficient materials in inventory');
    }

    // 5-7. Use atomic RPC function for material application
    const { instance, newStackQuantity } = await this.materialRepository.applyMaterialToItemAtomic(
      userId,
      itemId,
      materialId,
      styleId,
      slotIndex
    );

    // 8. Compute deterministic combo_hash (sorted material IDs)
    const allMaterials = await this.materialRepository.findMaterialsByItem(itemId);
    const materialIds = allMaterials.map(m => m.material_id).filter(Boolean);
    const styleIds = allMaterials.map(m => m.style_id || '00000000-0000-0000-0000-000000000000');
    const comboHash = computeComboHash(materialIds, styleIds);

    // 9. Check ItemImageCache for existing combo
    let cacheEntry = await this.imageCacheRepository.findByComboHash(item.item_type_id, comboHash);
    let isFirstCraft = false;
    let craftCount = 1;
    let imageUrl = '';

    if (cacheEntry) {
      // Cache hit - increment craft count
      craftCount = await this.imageCacheRepository.incrementCraftCount(cacheEntry.id);
      imageUrl = cacheEntry.image_url;
    } else {
      // 10. Cache miss - generate new image (20s sync)
      isFirstCraft = true;
      const materialReferences = allMaterials.map(m => ({
        material_id: m.material_id,
        style_id: m.style_id || '00000000-0000-0000-0000-000000000000',
        image_url: '' // Will be filled by ImageGenerationService
      }));

      imageUrl = await this.imageGenerationService.generateImage(item.item_type_id, materialReferences);

      // Create cache entry
      cacheEntry = await this.imageCacheRepository.createCacheEntry({
        item_type_id: item.item_type_id,
        combo_hash: comboHash,
        image_url: imageUrl,
        provider: 'gemini' // Default provider
      });
      craftCount = cacheEntry.craft_count;
    }

    // 11. Update Items table with new combo_hash and image_url
    await this.itemRepository.updateImageData(itemId, userId, comboHash, imageUrl, 'complete');

    // 12. Return result with cache status and craft count
    const updatedItem = await this.itemRepository.findWithMaterials(itemId, userId);
    if (!updatedItem) {
      throw new NotFoundError('Item', itemId);
    }

    return {
      success: true,
      updated_item: this.transformItemToApiFormat(updatedItem),
      is_first_craft: isFirstCraft,
      craft_count: craftCount,
      image_url: imageUrl,
      materials_consumed: [{
        id: materialStack.user_id + ':' + materialStack.material_id + ':' + materialStack.style_id,
        user_id: materialStack.user_id,
        material_id: materialStack.material_id,
        style_id: styleId,
        quantity: 1,
        material: {} as any // Will be populated by calling service if needed
      }],
      message: `Applied material to slot ${slotIndex}`
    };
  }

  /**
   * Replace existing material on item with new one
   * - Costs gold to replace (higher for styled materials)
   * - Returns old material to inventory as stack
   * - Regenerates image if combo changes
   */
  async replaceMaterial(request: {
    userId: string;
    itemId: string;
    slotIndex: number;
    newMaterialId: string;
    newStyleId: string;
    goldCost: number;
  }): Promise<ReplaceMaterialResult> {
    const { userId, itemId, slotIndex, newMaterialId, newStyleId, goldCost } = request;
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

    // 1. Validate user owns item
    const item = await this.itemRepository.findById(itemId, userId);
    if (!item) {
      throw new NotFoundError('Item', itemId);
    }

    // 1.5. Validate gold cost and deduct currency BEFORE making changes
    const expectedCost = 100 * item.level;
    if (goldCost !== expectedCost) {
      throw new ValidationError(`Invalid cost: expected ${expectedCost}, got ${goldCost}`);
    }

    // Deduct gold before making any material changes (atomic with transaction)
    await economyService.deductCurrency(
      userId,
      'GOLD',
      goldCost,
      'material_replacement',
      itemId
    );

    // 2. Check slot is occupied (slotIndex 0-2)
    if (slotIndex < 0 || slotIndex > 2) {
      throw new ValidationError('Slot index must be between 0 and 2');
    }

    const occupiedSlots = await this.materialRepository.getSlotOccupancy(itemId);
    if (!occupiedSlots.includes(slotIndex)) {
      throw new BusinessLogicError(`Slot ${slotIndex} is not occupied`);
    }

    // 3. Get existing MaterialInstance from slot
    const oldMaterialInstance = await this.materialRepository.removeFromItem(itemId, slotIndex);

    // 4. Check user has new material in MaterialStacks
    const newMaterialStack = await this.materialRepository.findStackByUser(userId, newMaterialId, newStyleId);
    if (!newMaterialStack || newMaterialStack.quantity < 1) {
      // Restore the old material before failing
      await this.materialRepository.applyToItem(itemId, oldMaterialInstance.id, slotIndex);
      throw new BusinessLogicError('Insufficient new materials in inventory');
    }

    // 5-8. Use atomic RPC function for material replacement
    const { oldInstance, newInstance, oldStackQuantity, newStackQuantity } =
      await this.materialRepository.replaceMaterialOnItemAtomic(
        userId,
        itemId,
        slotIndex,
        newMaterialId,
        newStyleId
      );

    // 9. Recompute combo_hash
    const allMaterials = await this.materialRepository.findMaterialsByItem(itemId);
    const materialIds = allMaterials.map(m => m.material_id).filter(Boolean);
    const styleIds = allMaterials.map(m => m.style_id || '00000000-0000-0000-0000-000000000000');
    const comboHash = computeComboHash(materialIds, styleIds);

    // 10. Check ItemImageCache or generate new image
    let cacheEntry = await this.imageCacheRepository.findByComboHash(item.item_type_id, comboHash);
    let imageUrl = '';
    let craftCount = 1;

    if (cacheEntry) {
      // Cache hit - increment craft count
      craftCount = await this.imageCacheRepository.incrementCraftCount(cacheEntry.id);
      imageUrl = cacheEntry.image_url;
    } else {
      // Cache miss - generate new image (20s sync)
      const materialReferences = allMaterials.map(m => ({
        material_id: m.material_id,
        style_id: m.style_id || '00000000-0000-0000-0000-000000000000',
        image_url: '' // Will be filled by ImageGenerationService
      }));

      imageUrl = await this.imageGenerationService.generateImage(item.item_type_id, materialReferences);

      // Create cache entry
      cacheEntry = await this.imageCacheRepository.createCacheEntry({
        item_type_id: item.item_type_id,
        combo_hash: comboHash,
        image_url: imageUrl,
        provider: 'gemini' // Default provider
      });
      craftCount = cacheEntry.craft_count;
    }

    // 11. Update Items table
    await this.itemRepository.updateImageData(itemId, userId, comboHash, imageUrl, 'complete');

    // 12. Return result with gold spent and replaced material
    const updatedItem = await this.itemRepository.findWithMaterials(itemId, userId);
    if (!updatedItem) {
      throw new NotFoundError('Item', itemId);
    }

    // Get the old material details for the response
    const oldMaterial = await this.materialRepository.findMaterialById(oldInstance.material_id);

    return {
      success: true,
      updated_item: this.transformItemToApiFormat(updatedItem),
      gold_spent: goldCost,
      replaced_material: {
        id: oldInstance.id,
        material_id: oldInstance.material_id,
        style_id: oldInstance.style_id,
        slot_index: slotIndex,
        material: oldMaterial ? {
          id: oldMaterial.id,
          name: oldMaterial.name,
          rarity: oldMaterial.rarity as any,
          stat_modifiers: oldMaterial.stat_modifiers as any,
          theme: oldMaterial.theme as any,
          image_url: oldMaterial.image_url || undefined,
          description: oldMaterial.description || undefined
        } : {} as any
      },
      refunded_material: {
        id: oldInstance.user_id + ':' + oldInstance.material_id + ':' + oldInstance.style_id,
        user_id: oldInstance.user_id,
        material_id: oldInstance.material_id,
        style_id: oldInstance.style_id,
        quantity: 1,
        material: oldMaterial ? {
          id: oldMaterial.id,
          name: oldMaterial.name,
          rarity: oldMaterial.rarity as any,
          stat_modifiers: oldMaterial.stat_modifiers as any,
          theme: oldMaterial.theme as any,
          image_url: oldMaterial.image_url || undefined,
          description: oldMaterial.description || undefined
        } : {} as any
      },
      message: `Replaced material in slot ${slotIndex} (cost: ${goldCost} gold)`
    };
  }

  /**
   * Transform ItemWithDetails from repository to API Item format
   */
  private transformItemToApiFormat(itemWithDetails: any): any {
    return {
      id: itemWithDetails.id,
      user_id: itemWithDetails.user_id,
      item_type_id: itemWithDetails.item_type_id,
      level: itemWithDetails.level,
      base_stats: itemWithDetails.item_type?.base_stats_normalized || {},
      current_stats: itemWithDetails.current_stats || {},
      material_combo_hash: itemWithDetails.material_combo_hash,
      image_url: itemWithDetails.generated_image_url,
      materials: itemWithDetails.materials?.map((m: any) => ({
        id: m.material?.id || '',
        material_id: m.material?.id || '',
        style_id: m.material?.style_id || '00000000-0000-0000-0000-000000000000',
        slot_index: m.slot_index,
        material: {
          id: m.material?.id || '',
          name: m.material?.name || '',
          rarity: m.material?.rarity || 'common',
          stat_modifiers: m.material?.stat_modifiers || {},
          theme: m.material?.theme || 'balanced',
          image_url: m.material?.image_url,
          description: m.material?.description
        }
      })) || [],
      item_type: itemWithDetails.item_type ? {
        id: itemWithDetails.item_type.id,
        name: itemWithDetails.item_type.name,
        category: itemWithDetails.item_type.category,
        equipment_slot: itemWithDetails.item_type.category, // Assuming category maps to slot
        base_stats: itemWithDetails.item_type.base_stats_normalized || {},
        rarity: itemWithDetails.item_type.rarity || 'common',
        image_url: undefined,
        description: itemWithDetails.item_type.description
      } : undefined,
      created_at: itemWithDetails.created_at,
      updated_at: itemWithDetails.created_at // Fallback since updated_at might not exist
    };
  }
}

export const materialService = new MaterialService();