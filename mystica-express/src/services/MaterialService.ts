import { Material, MaterialStackDetailed, ApplyMaterialResult, ReplaceMaterialResult } from '../types/api.types.js';
import { NotImplementedError, NotFoundError, ValidationError, BusinessLogicError } from '../utils/errors.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { ImageCacheRepository } from '../repositories/ImageCacheRepository.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { ImageGenerationService } from './ImageGenerationService.js';
import { MaterialInstance, CreateImageCacheData } from '../types/repository.types.js';
import { computeComboHash } from '../utils/hash.js';
import { economyService } from './EconomyService.js';
import { statsService } from './StatsService.js';

/**
 * Handles material application to items with image generation
 */
export class MaterialService {
  private materialRepository: MaterialRepository;
  private imageCacheRepository: ImageCacheRepository;
  private itemRepository: ItemRepository;
  private imageGenerationService: ImageGenerationService;

  constructor(
    materialRepository?: MaterialRepository,
    imageCacheRepository?: ImageCacheRepository,
    itemRepository?: ItemRepository,
    imageGenerationService?: ImageGenerationService
  ) {
    this.materialRepository = materialRepository || new MaterialRepository();
    this.imageCacheRepository = imageCacheRepository || new ImageCacheRepository();
    this.itemRepository = itemRepository || new ItemRepository();
    this.imageGenerationService = imageGenerationService || new ImageGenerationService();
  }

  /**
   * Get all material templates (no auth required)
   * - Returns complete material library for client display
   * - Includes: id, name, description, stat_modifiers, theme, image_url
   * - Ordered by name alphabetically
   */
  async getAllMaterials(): Promise<Material[]> {
    const materials = await this.materialRepository.findAllMaterials();
    // Add computed R2 image URLs
    return materials.map(m => ({
      ...m,
      image_url: this.getMaterialImageUrl(m.name)
    }));
  }
  /**
   * Get user's material inventory
   * - Fetches all material stacks owned by user
   * - Groups by material type and style
   * - Returns stackable inventory data
   */
  async getMaterialInventory(userId: string): Promise<MaterialStackDetailed[]> {
    // TODO: Implement material inventory retrieval
    // 1. Query MaterialStacks table for user_id
    // 2. Join with Materials for base data
    // 3. Return grouped stacks with quantities

    // Get all material stacks for the user
    const stacks = await this.materialRepository.findAllStacksByUser(userId);

    // For each stack, fetch the material template data
    const stacksWithMaterials: MaterialStackDetailed[] = [];

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
          stat_modifiers: material.stat_modifiers,
          description: material.description || undefined,
          base_drop_weight: material.base_drop_weight,
          image_url: this.getMaterialImageUrl(material.name)
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

    // 11.5. Calculate and update item stats with applied materials
    // Note: We need to fetch the item with type data for base stats and rarity
    const itemWithType = await this.itemRepository.findWithMaterials(itemId, userId);
    if (itemWithType && itemWithType.item_type) {
      // Get base stats and rarity from item type
      // NOTE: Pass un-adjusted base stats to computeItemStats - it handles rarity internally
      const baseStats = itemWithType.item_type.base_stats_normalized;
      const rarity = itemWithType.item_type.rarity;

      // Calculate final stats with materials applied
      // Note: Filter out any materials that don't have proper stat_modifiers (for tests)
      const validMaterials = allMaterials.filter(m => m.material && m.material.stat_modifiers);

      // Create a wrapper with rarity info for the stats calculation
      const itemWithRarity = {
        item_type: {
          base_stats_normalized: baseStats,
          rarity: rarity
        }
      };

      // Use computeItemStatsForLevel which properly handles rarity multiplier
      const finalStats = statsService.computeItemStatsForLevel(itemWithRarity, itemWithType.level);

      // Apply material modifiers separately
      const materialMods = validMaterials.reduce((acc, material) => ({
        atkPower: acc.atkPower + material.material.stat_modifiers.atkPower,
        atkAccuracy: acc.atkAccuracy + material.material.stat_modifiers.atkAccuracy,
        defPower: acc.defPower + material.material.stat_modifiers.defPower,
        defAccuracy: acc.defAccuracy + material.material.stat_modifiers.defAccuracy
      }), { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 });

      const finalStatsWithMaterials = {
        atkPower: Math.round((finalStats.atkPower + materialMods.atkPower) * 100) / 100,
        atkAccuracy: Math.round((finalStats.atkAccuracy + materialMods.atkAccuracy) * 100) / 100,
        defPower: Math.round((finalStats.defPower + materialMods.defPower) * 100) / 100,
        defAccuracy: Math.round((finalStats.defAccuracy + materialMods.defAccuracy) * 100) / 100
      };

      // Update the item's current_stats in the database
      await this.itemRepository.updateStats(itemId, userId, finalStatsWithMaterials);
    }

    // 12. Return result with cache status and craft count
    const updatedItem = await this.itemRepository.findWithMaterials(itemId, userId);
    if (!updatedItem) {
      throw new NotFoundError('Item', itemId);
    }

    // Fetch full material data for materials_consumed response
    const consumedMaterial = await this.materialRepository.findMaterialById(materialStack.material_id);
    if (!consumedMaterial) {
      throw new NotFoundError('Material', materialStack.material_id);
    }

    return {
      success: true,
      updated_item: this.transformItemToApiFormat(updatedItem, craftCount),
      is_first_craft: isFirstCraft,
      craft_count: craftCount,
      image_url: imageUrl,
      materials_consumed: [{
        id: materialStack.user_id + ':' + materialStack.material_id + ':' + materialStack.style_id,
        user_id: materialStack.user_id,
        material_id: materialStack.material_id,
        style_id: styleId,
        quantity: 1,
        material: consumedMaterial
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

    // 11.5. Calculate and update item stats with new materials
    const itemWithTypeUpdated = await this.itemRepository.findWithMaterials(itemId, userId);
    if (itemWithTypeUpdated && itemWithTypeUpdated.item_type) {
      // Get base stats and rarity from item type
      // NOTE: Pass un-adjusted base stats - computeItemStatsForLevel handles rarity internally
      const baseStatsUpdated = itemWithTypeUpdated.item_type.base_stats_normalized;
      const rarityUpdated = itemWithTypeUpdated.item_type.rarity;

      // Get updated materials after replacement
      const updatedMaterials = await this.materialRepository.findMaterialsByItem(itemId);

      // Calculate final stats with replaced materials
      // Note: Filter out any materials that don't have proper stat_modifiers (for tests)
      const validMaterialsUpdated = updatedMaterials.filter(m => m.material && m.material.stat_modifiers);

      // Create a wrapper with rarity info for the stats calculation
      const itemWithRarityUpdated = {
        item_type: {
          base_stats_normalized: baseStatsUpdated,
          rarity: rarityUpdated
        }
      };

      // Use computeItemStatsForLevel which properly handles rarity multiplier
      const finalStatsBase = statsService.computeItemStatsForLevel(itemWithRarityUpdated, itemWithTypeUpdated.level);

      // Apply material modifiers separately
      const materialModsUpdated = validMaterialsUpdated.reduce((acc, material) => ({
        atkPower: acc.atkPower + material.material.stat_modifiers.atkPower,
        atkAccuracy: acc.atkAccuracy + material.material.stat_modifiers.atkAccuracy,
        defPower: acc.defPower + material.material.stat_modifiers.defPower,
        defAccuracy: acc.defAccuracy + material.material.stat_modifiers.defAccuracy
      }), { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 });

      const finalStatsUpdated = {
        atkPower: Math.round((finalStatsBase.atkPower + materialModsUpdated.atkPower) * 100) / 100,
        atkAccuracy: Math.round((finalStatsBase.atkAccuracy + materialModsUpdated.atkAccuracy) * 100) / 100,
        defPower: Math.round((finalStatsBase.defPower + materialModsUpdated.defPower) * 100) / 100,
        defAccuracy: Math.round((finalStatsBase.defAccuracy + materialModsUpdated.defAccuracy) * 100) / 100
      };

      // Update the item's current_stats in the database
      await this.itemRepository.updateStats(itemId, userId, finalStatsUpdated);
    }

    // 12. Return result with gold spent and replaced material
    const updatedItem = await this.itemRepository.findWithMaterials(itemId, userId);
    if (!updatedItem) {
      throw new NotFoundError('Item', itemId);
    }

    // Get the old material details for the response
    const oldMaterial = await this.materialRepository.findMaterialById(oldInstance.material_id);

    return {
      success: true,
      updated_item: this.transformItemToApiFormat(updatedItem, craftCount),
      gold_spent: goldCost,
      replaced_material: {
        id: oldInstance.id,
        material_id: oldInstance.material_id,
        style_id: oldInstance.style_id,
        slot_index: slotIndex,
        material: oldMaterial ? {
          id: oldMaterial.id,
          name: oldMaterial.name,
          stat_modifiers: oldMaterial.stat_modifiers,
          description: oldMaterial.description || undefined,
          base_drop_weight: oldMaterial.base_drop_weight
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
          stat_modifiers: oldMaterial.stat_modifiers,
          description: oldMaterial.description || undefined,
          base_drop_weight: oldMaterial.base_drop_weight
        } : {} as any
      },
      message: `Replaced material in slot ${slotIndex} (cost: ${goldCost} gold)`
    };
  }

  /**
   * Compute R2 image URL for a material based on its name
   * Materials are stored at: materials/{lowercase_name_with_underscores}.png
   */
  private getMaterialImageUrl(materialName: string): string {
    const R2_PUBLIC_URL = 'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev';
    const normalizedName = materialName.toLowerCase().replace(/\s+/g, '_');
    return `${R2_PUBLIC_URL}/materials/${normalizedName}.png`;
  }

  /**
   * Get rarity multiplier for stat calculations
   * Copied from StatsService to avoid service dependency
   */
  private getRarityMultiplier(rarity: string): number {
    const multipliers: Record<string, number> = {
      'common': 1.0,
      'uncommon': 1.25,
      'rare': 1.5,
      'epic': 1.75,
      'legendary': 2.0
    };

    const multiplier = multipliers[rarity];
    if (multiplier === undefined) {
      throw new ValidationError(`Invalid rarity: ${rarity}`);
    }

    return multiplier;
  }

  /**
   * Transform ItemWithDetails from repository to API Item format
   * Maps to iOS EnhancedPlayerItem structure
   */
  private transformItemToApiFormat(itemWithDetails: any, craftCount: number = 1): any {
    // Extract the item type name as base_type
    const baseType = itemWithDetails.item_type?.name || 'Unknown';
    const category = itemWithDetails.item_type?.category || 'weapon';
    const rarity = itemWithDetails.item_type?.rarity || 'common';

    return {
      id: itemWithDetails.id,
      base_type: baseType,
      item_type_id: itemWithDetails.item_type_id,
      category: category,
      level: itemWithDetails.level,
      rarity: rarity,
      applied_materials: itemWithDetails.materials?.map((m: any) => ({
        material_id: m.material?.id || '',
        style_id: m.material?.style_id || '00000000-0000-0000-0000-000000000000',
        slot_index: m.slot_index,
        material: {
          id: m.material?.id || '',
          name: m.material?.name || '',
          description: m.material?.description,
          style_id: m.material?.style_id || '00000000-0000-0000-0000-000000000000',
          stat_modifiers: m.material?.stat_modifiers || {},
          image_url: undefined
        }
      })) || [],
      materials: itemWithDetails.materials?.map((m: any) => ({
        material_id: m.material?.id || '',
        style_id: m.material?.style_id || '00000000-0000-0000-0000-000000000000',
        slot_index: m.slot_index,
        material: {
          id: m.material?.id || '',
          name: m.material?.name || '',
          description: m.material?.description,
          style_id: m.material?.style_id || '00000000-0000-0000-0000-000000000000',
          stat_modifiers: m.material?.stat_modifiers || {},
          image_url: undefined
        }
      })) || [],
      computed_stats: itemWithDetails.current_stats || {},
      material_combo_hash: itemWithDetails.material_combo_hash || null,
      generated_image_url: itemWithDetails.generated_image_url || null,
      image_generation_status: itemWithDetails.image_generation_status || 'complete',
      craft_count: craftCount,
      is_styled: itemWithDetails.is_styled || false,
      is_equipped: false, // TODO: Check UserEquipment table
      equipped_slot: null // TODO: Get from UserEquipment if equipped
    };
  }
}

export const materialService = new MaterialService();