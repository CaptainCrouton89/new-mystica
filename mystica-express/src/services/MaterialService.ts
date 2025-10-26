import { ImageCacheRepository } from '../repositories/ImageCacheRepository.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { StyleRepository } from '../repositories/StyleRepository.js';
import { AppliedMaterial, ApplyMaterialResult, Material, MaterialStackDetailed, PlayerItem, EquipmentSlot } from '../types/api.types.js';
import { ItemWithDetails } from '../types/repository.types.js';
import { BusinessLogicError, NotFoundError, ValidationError } from '../utils/errors.js';
import { computeComboHash } from '../utils/hash.js';
import { getMaterialImageUrl } from '../utils/image-url.js';
import { ImageGenerationService } from './ImageGenerationService.js';
import { NameDescriptionService } from './NameDescriptionService.js';
import { statsService } from './StatsService.js';

export class MaterialService {
  private materialRepository: MaterialRepository;
  private imageCacheRepository: ImageCacheRepository;
  private itemRepository: ItemRepository;
  private styleRepository: StyleRepository;
  private imageGenerationService: ImageGenerationService;
  private nameDescriptionService: NameDescriptionService;

  constructor(
    materialRepository?: MaterialRepository,
    imageCacheRepository?: ImageCacheRepository,
    itemRepository?: ItemRepository,
    styleRepository?: StyleRepository,
    imageGenerationService?: ImageGenerationService,
    nameDescriptionService?: NameDescriptionService
  ) {
    this.materialRepository = materialRepository || new MaterialRepository();
    this.imageCacheRepository = imageCacheRepository || new ImageCacheRepository();
    this.itemRepository = itemRepository || new ItemRepository();
    this.styleRepository = styleRepository || new StyleRepository();
    this.imageGenerationService = imageGenerationService || new ImageGenerationService();
    this.nameDescriptionService = nameDescriptionService || new NameDescriptionService();
  }

  async getAllMaterials(): Promise<Material[]> {
    const materials = await this.materialRepository.findAllMaterials();
    return materials.map(m => ({
      ...m,
      image_url: getMaterialImageUrl(m.name)
    }));
  }

  async getMaterialInventory(userId: string): Promise<MaterialStackDetailed[]> {
    const stacksWithDetails = await this.materialRepository.findStacksByUserWithDetails(userId);

    const stacksWithMaterials: MaterialStackDetailed[] = [];

    for (const stack of stacksWithDetails) {
      const material = await this.materialRepository.findMaterialById(stack.material_id);
      if (!material) {
        continue; 
      }

      stacksWithMaterials.push({
        id: stack.material_id + ':' + stack.style_id,
        user_id: userId,
        material_id: stack.material_id,
        style_id: stack.style_id,
        style_name: stack.styledefinitions?.display_name,
        quantity: stack.quantity,
        material: {
          id: material.id,
          name: material.name,
          stat_modifiers: material.stat_modifiers,
          description: material.description || undefined,
          base_drop_weight: material.base_drop_weight,
          image_url: getMaterialImageUrl(material.name)
        }
      });
    }

    return stacksWithMaterials;
  }

  async applyMaterial(request: {
    userId: string;
    itemId: string;
    materialId: string;
    styleId: string;
    slotIndex: number;
  }): Promise<ApplyMaterialResult> {
    const { userId, itemId, materialId, styleId, slotIndex } = request;
    const item = await this.itemRepository.findById(itemId, userId);
    if (!item) {
      throw new NotFoundError('Item', itemId);
    }

    const occupiedSlots = await this.materialRepository.getSlotOccupancy(itemId);
    if (occupiedSlots.length >= 3) {
      throw new BusinessLogicError('Item already has maximum 3 materials applied');
    }

    if (slotIndex < 0 || slotIndex > 2) {
      throw new ValidationError('Slot index must be between 0 and 2');
    }
    if (occupiedSlots.includes(slotIndex)) {
      throw new BusinessLogicError(`Slot ${slotIndex} is already occupied`);
    }

    const materialStack = await this.materialRepository.findStackByUser(userId, materialId, styleId);
    if (!materialStack || materialStack.quantity < 1) {
      throw new BusinessLogicError('Insufficient materials in inventory');
    }

    await this.materialRepository.applyMaterialToItemAtomic(
      userId,
      itemId,
      materialId,
      styleId,
      slotIndex
    );

    const allMaterials = await this.materialRepository.findMaterialsByItem(itemId);

    const materialMappings: { materialId: string; styleId: string }[] = [];
    for (const m of allMaterials) {
        if (!m.material_id) {
        throw new ValidationError('Material missing ID');
      }
      if (!m.style_id) {
        throw new ValidationError(`Missing style_id for material ${m.material_id}`);
      }

        const style = await this.styleRepository.findById(m.style_id);
      if (!style?.display_name) {
        throw new NotFoundError('Style', m.style_id);
      }

      materialMappings.push({
        materialId: m.material_id,
        styleId: m.style_id
      });
    }

    materialMappings.sort((a, b) => a.materialId.localeCompare(b.materialId));

    const comboHash = computeComboHash(
      materialMappings.map(m => m.materialId),
      materialMappings.map(m => m.styleId)
    );

    let cacheEntry = await this.imageCacheRepository.findByComboHash(item.item_type_id, comboHash);
    let isFirstCraft = false;
    let craftCount = 1;
    let imageUrl = '';

    if (cacheEntry) {
        craftCount = await this.imageCacheRepository.incrementCraftCount(cacheEntry.id);
      imageUrl = cacheEntry.image_url;
    } else {
      
      isFirstCraft = true;
      const materialReferences = allMaterials.map(m => ({
        material_id: m.material_id,
        style_id: m.style_id || '00000000-0000-0000-0000-000000000000',
        image_url: '' 
      }));

      const itemTypeForGeneration = await this.itemRepository.findWithMaterials(itemId, userId);
      if (!itemTypeForGeneration?.item_type?.name) {
        throw new ValidationError('Item type name is missing for image generation');
      }
      const itemTypeName = itemTypeForGeneration.item_type.name;
      const materialNames = allMaterials
        .map(m => m.material?.name)
        .filter(Boolean) as string[];

      const [generatedImageUrl, nameDescResult] = await Promise.all([
        this.imageGenerationService.generateImage(item.item_type_id, materialReferences),
        this.nameDescriptionService.generateForItem(itemTypeName, materialNames)
          .catch(error => {
            console.error('Name/description generation failed:', error);
            return null; 
          })
      ]);

      imageUrl = generatedImageUrl;

      if (nameDescResult) {
        try {
          await this.itemRepository.updateItemNameDescription(
            itemId,
            userId,
            nameDescResult.name,
            nameDescResult.description
          );
        } catch (error) {
          console.warn('Failed to update item name/description:', error);
        }
      }

      cacheEntry = await this.imageCacheRepository.createCacheEntry({
        item_type_id: item.item_type_id,
        combo_hash: comboHash,
        image_url: imageUrl,
        provider: 'gemini' 
      });
      craftCount = cacheEntry.craft_count;
    }

    await this.itemRepository.updateImageData(itemId, userId, comboHash, imageUrl, 'complete');

    const itemWithType = await this.itemRepository.findWithMaterials(itemId, userId);
    if (itemWithType && itemWithType.item_type) {
      
      const baseStats = itemWithType.item_type.base_stats_normalized;
      const rarity = itemWithType.item_type.rarity;

      const validMaterials = allMaterials.filter(m => m.material && m.material.stat_modifiers);

      const itemWithRarity = {
        item_type: {
          base_stats_normalized: baseStats,
          rarity: rarity
        }
      };

      const finalStats = statsService.computeItemStatsForLevel(itemWithRarity, itemWithType.level);

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

      const isStyled = allMaterials.some(m => m.style_id !== 'normal');

      await this.itemRepository.updateStats(itemId, userId, finalStatsWithMaterials);

      if (isStyled) {
        await this.itemRepository.update(itemId, { is_styled: true });
      }
    }

    const updatedItem = await this.itemRepository.findWithMaterials(itemId, userId);
    if (!updatedItem) {
      throw new NotFoundError('Item', itemId);
    }

    const consumedMaterial = await this.materialRepository.findMaterialById(materialStack.material_id);
    if (!consumedMaterial) {
      throw new NotFoundError('Material', materialStack.material_id);
    }

    return {
      success: true,
      updated_item: await this.transformItemToApiFormat(updatedItem, craftCount),
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

  private async transformItemToApiFormat(itemWithDetails: ItemWithDetails, craftCount: number = 1): Promise<PlayerItem> {
    if (!itemWithDetails) {
      throw new ValidationError('Item details are undefined');
    }

    const baseType = (() => {
      if (itemWithDetails.name) return itemWithDetails.name;
      if (itemWithDetails.item_type?.name) return itemWithDetails.item_type.name;
      throw new ValidationError('No valid base type name found for item');
    })();

    const description = (() => {
      if (itemWithDetails.description) return itemWithDetails.description;
      if (itemWithDetails.item_type?.description) return itemWithDetails.item_type.description;
      return null;
    })();

    const category = (() => {
      const providedCategory = itemWithDetails.item_type?.category;
      if (providedCategory) {
        return this.mapCategoryToEquipmentSlot(providedCategory);
      }
      return 'weapon';
    })();

    const rarity = (() => {
      const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
      const providedRarity = itemWithDetails.item_type?.rarity;
      if (providedRarity && validRarities.includes(providedRarity)) {
        return providedRarity;
      }
      return 'common'; 
    })();

    const applied_materials = await Promise.all(
      (itemWithDetails.materials || []).map(async (m: AppliedMaterial) => {
        const styleId = m.style_id;

        const style = await this.styleRepository.findById(styleId);
        const styleName = style?.display_name;

        return {
          id: m.id,
          material_id: m.material_id,
          style_id: styleId,
          style_name: styleName,
          slot_index: m.slot_index,
          material: {
            id: m.material.id,
            name: m.material.name,
            description: m.material.description,
            stat_modifiers: m.material.stat_modifiers,
            base_drop_weight: m.material.base_drop_weight,
            image_url: m.material.image_url
          }
        };
      })
    );

    if (!itemWithDetails.generated_image_url) {
      throw new ValidationError('Item must have a generated image URL');
    }

    const validStatuses = ['pending', 'generating', 'complete', 'failed'];
    const imageGenerationStatus = itemWithDetails.image_generation_status;
    const finalImageGenerationStatus = imageGenerationStatus !== null && validStatuses.includes(imageGenerationStatus)
      ? imageGenerationStatus
      : 'complete';

    const computedStats = (itemWithDetails.current_stats && Object.keys(itemWithDetails.current_stats).length > 0)
      ? itemWithDetails.current_stats
      : { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 };

    return {
      id: itemWithDetails.id,
      base_type: baseType,
      description: description,
      name: itemWithDetails.name !== null ? itemWithDetails.name : null,
      item_type_id: itemWithDetails.item_type_id,
      category: category,
      level: itemWithDetails.level,
      rarity: rarity,
      applied_materials,
      materials: applied_materials,
      computed_stats: computedStats,
      material_combo_hash: itemWithDetails.material_combo_hash,
      generated_image_url: itemWithDetails.generated_image_url,
      image_generation_status: finalImageGenerationStatus,
      craft_count: craftCount,
      is_styled: itemWithDetails.is_styled,
      is_equipped: false,
      equipped_slot: null
    };
  }

  private mapCategoryToEquipmentSlot(category: string): EquipmentSlot {
    switch (category) {
      case 'weapon':
      case 'sword':
      case 'axe':
      case 'staff':
      case 'bow':
        return 'weapon';
      case 'offhand':
      case 'shield':
        return 'offhand';
      case 'head':
      case 'helmet':
        return 'head';
      case 'armor':
      case 'chestplate':
        return 'armor';
      case 'feet':
      case 'boots':
        return 'feet';
      case 'accessory':
      case 'ring':
      case 'necklace':
        return 'accessory_1';
      case 'pet':
        return 'pet';
      default:
        throw new Error(`Unknown item category: ${category}`);
    }
  }
}

export const materialService = new MaterialService();