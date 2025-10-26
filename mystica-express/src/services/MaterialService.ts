import { ImageCacheRepository } from '../repositories/ImageCacheRepository.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { StyleRepository } from '../repositories/StyleRepository.js';
import { ApplyMaterialResult, MaterialStackDetailed } from '../types/api.types.js';
import { MaterialInstanceWithTemplate } from '../types/repository.types.js';
import { BusinessLogicError, NotFoundError, ValidationError } from '../utils/errors.js';
import { computeComboHash } from '../utils/hash.js';
import { getMaterialImageUrl } from '../utils/image-url.js';
import { ImageGenerationService } from './ImageGenerationService.js';
import { NameDescriptionService } from './NameDescriptionService.js';

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

  async getAllMaterials(): Promise<MaterialInstanceWithTemplate[]> {
    return await this.materialRepository.findAllMaterials() as unknown as MaterialInstanceWithTemplate[];
  }

  async getMaterialInventory(userId: string): Promise<MaterialStackDetailed[]> {
    const stacksWithDetails = await this.materialRepository.findStacksByUserWithDetails(userId);

    const stacksWithMaterials: MaterialStackDetailed[] = [];

    for (const stack of stacksWithDetails) {
      const material = await this.materialRepository.findMaterialById(stack.material_id);
      if (!material) {
        continue;
      }

      if (!material.style_id) {
        throw new ValidationError(`Material ${material.id} missing style_id`);
      }

      const styleId = material.style_id;
      const styleDisplayName = stack.materials?.styledefinitions?.display_name || 'Normal';

      stacksWithMaterials.push({
        id: stack.material_id + ':' + styleId,
        user_id: userId,
        material_id: stack.material_id,
        style_id: styleId,
        display_name: styleDisplayName,
        quantity: stack.quantity,
        material: {
          id: material.id,
          name: material.name,
          stat_modifiers: material.stat_modifiers,
          description: material.description || null,
          base_drop_weight: material.base_drop_weight,
          image_url: getMaterialImageUrl(material.name),
          created_at: material.created_at,
          lat: material.lat,
          lng: material.lng,
          style_id: material.style_id
        }
      });
    }

    return stacksWithMaterials;
  }

  async applyMaterial(request: {
    userId: string;
    itemId: string;
    materialId: string;
    slotIndex: number;
  }): Promise<ApplyMaterialResult> {
    const { userId, itemId, materialId, slotIndex } = request;
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

    // Get material template to find styleId
    const materialTemplate = await this.materialRepository.findMaterialById(materialId);
    if (!materialTemplate) {
      throw new NotFoundError('Material', materialId);
    }

    const styleId = materialTemplate.style_id;
    if (!styleId) {
      throw new ValidationError(`Material ${materialId} missing style_id`);
    }

    const materialStack = await this.materialRepository.findStackByUser(userId, materialId);
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

      const materialTemplate = await this.materialRepository.findMaterialById(m.material_id);
      if (!materialTemplate) {
        throw new NotFoundError('Material', m.material_id);
      }

      if (!materialTemplate.style_id) {
        throw new ValidationError(`Material ${m.material_id} missing style_id`);
      }

      const styleId = materialTemplate.style_id;
      const style = await this.styleRepository.findById(styleId);
      if (!style?.display_name) {
        throw new NotFoundError('Style', styleId);
      }

      materialMappings.push({
        materialId: m.material_id,
        styleId: styleId
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
      const materialReferences = await Promise.all(
        allMaterials.map(async (m) => {
          const materialTemplate = await this.materialRepository.findMaterialById(m.material_id);
          if (!materialTemplate) {
            throw new NotFoundError('Material', m.material_id);
          }
          if (!materialTemplate.style_id) {
            throw new ValidationError(`Material ${m.material_id} missing style_id`);
          }
          return {
            material_id: m.material_id,
            style_id: materialTemplate.style_id,
            image_url: ''
          };
        })
      );

      const itemTypeForGeneration = await this.itemRepository.findWithMaterials(itemId);
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

    // Stats are computed on-the-fly by StatsService when needed, not stored in DB

    const updatedItem = await this.itemRepository.findWithMaterials(itemId);
    if (!updatedItem) {
      throw new NotFoundError('Item', itemId);
    }

    const consumedMaterial = await this.materialRepository.findMaterialById(materialStack.material_id);
    if (!consumedMaterial) {
      throw new NotFoundError('Material', materialStack.material_id);
    }

    if (!consumedMaterial.style_id) {
      throw new ValidationError(`Material ${consumedMaterial.id} missing style_id`);
    }

    const consumedStyleId = consumedMaterial.style_id;

    return {
      success: true,
      updated_item: updatedItem,
      is_first_craft: isFirstCraft,
      craft_count: craftCount,
      image_url: imageUrl,
      materials_consumed: [{
        id: materialStack.user_id + ':' + materialStack.material_id + ':' + consumedStyleId,
        user_id: materialStack.user_id,
        material_id: materialStack.material_id,
        style_id: consumedStyleId,
        display_name: undefined,
        quantity: 1,
        material: consumedMaterial
      }],
      message: `Applied material to slot ${slotIndex}`
    };
  }
}

export const materialService = new MaterialService();