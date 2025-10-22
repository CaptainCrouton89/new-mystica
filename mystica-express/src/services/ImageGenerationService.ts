import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import Replicate from 'replicate';
import { env } from '../config/env.js';
import {
  NotImplementedError,
  ValidationError,
  NotFoundError,
  ExternalServiceError,
  ConfigurationError
} from '../utils/errors.js';
import { computeComboHashWithStyles } from '../utils/hash.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { StyleRepository } from '../repositories/StyleRepository.js';

/**
 * Request interface for generateComboImage method
 */
export interface GenerateComboImageRequest {
  itemTypeId: string;
  materialIds: string[];
  styleIds: string[];
  comboHash?: string;
}

/**
 * Replicate generation options
 */
interface ReplicateGenerationOptions {
  prompt: string;
  referenceImages: string[];
  provider: 'gemini' | 'seedream-4';
  aspectRatio: '1:1';
  outputFormat: 'png';
}

/**
 * Handles AI image generation and R2 upload integration
 */
export class ImageGenerationService {
  // Environment configuration
  private readonly R2_BUCKET_NAME = env.R2_BUCKET_NAME;
  private readonly R2_PUBLIC_URL = 'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev';
  private readonly R2_ACCOUNT_ID = env.CLOUDFLARE_ACCOUNT_ID;
  private readonly R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID;
  private readonly R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY;
  private readonly REPLICATE_API_TOKEN = env.REPLICATE_API_TOKEN;

  // Repository dependencies
  private readonly itemRepository: ItemRepository;
  private readonly materialRepository: MaterialRepository;
  private readonly styleRepository: StyleRepository;

  constructor(
    itemRepository?: ItemRepository,
    materialRepository?: MaterialRepository,
    styleRepository?: StyleRepository
  ) {
    this.itemRepository = itemRepository || new ItemRepository();
    this.materialRepository = materialRepository || new MaterialRepository();
    this.styleRepository = styleRepository || new StyleRepository();
  }

  /**
   * Generate item image with AI using materials as references
   * Primary generation method following the specification workflow
   */
  async generateComboImage(request: GenerateComboImageRequest): Promise<string> {
    // Step 1: Validate environment and request
    await this.validateEnvironmentCredentials();

    if (request.materialIds.length === 0 || request.materialIds.length > 3) {
      throw new ValidationError('Material count must be 1-3');
    }

    if (request.materialIds.length !== request.styleIds.length) {
      throw new ValidationError('Material IDs and Style IDs arrays must have same length');
    }

    // Step 2: Generate filename using combo hash
    const comboHash = request.comboHash ||
      computeComboHashWithStyles(request.materialIds, request.styleIds);

    const itemTypeSlug = await this.getItemTypeSlug(request.itemTypeId);
    const filename = `items-crafted/${itemTypeSlug}/${comboHash}.png`;

    // Step 3: Check if image already exists in R2 (cache verification)
    const existingUrl = await this.checkR2ForExisting(request.itemTypeId, comboHash);
    if (existingUrl) {
      console.log(`♻️  Using cached image: ${existingUrl}`);
      return existingUrl;
    }

    // Step 4: Build AI prompt with item and material context
    const prompt = await this.buildAIPrompt(
      request.itemTypeId,
      request.materialIds,
      request.styleIds
    );

    // Step 5: Fetch material reference images for AI context
    const referenceImages = await this.fetchMaterialReferenceImages(
      request.materialIds,
      request.styleIds
    );

    // Step 6: Generate image via Replicate API
    console.log(`🎨 Generating image for ${itemTypeSlug} (combo: ${comboHash})`);
    const startTime = Date.now();

    const imageBase64 = await this.generateWithRetry({
      prompt,
      referenceImages,
      provider: 'gemini', // Default to google/nano-banana
      aspectRatio: '1:1',
      outputFormat: 'png'
    });

    const generationTime = Date.now() - startTime;
    console.log(`⏱️  Generation completed in ${generationTime}ms`);

    // Step 7: Upload to R2 and return public URL
    const buffer = Buffer.from(imageBase64, 'base64');
    const publicUrl = await this.uploadToR2(buffer, filename);

    console.log(`✅ Image generated and uploaded: ${publicUrl}`);
    return publicUrl;
  }

  /**
   * Check if image exists in R2 cache before triggering expensive generation
   */
  async checkR2ForExisting(itemTypeId: string, comboHash: string): Promise<string | null> {
    // Get item type slug first - let NotFoundError bubble up
    const itemTypeSlug = await this.getItemTypeSlug(itemTypeId);
    const filename = `items-crafted/${itemTypeSlug}/${comboHash}.png`;

    try {
      const client = this.createR2Client();

      // Use HeadObject to check existence without downloading
      await client.send(new HeadObjectCommand({
        Bucket: this.R2_BUCKET_NAME,
        Key: filename,
      }));

      // If no exception thrown, file exists
      const publicUrl = `${this.R2_PUBLIC_URL}/${filename}`;
      return publicUrl;

    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return null; // File doesn't exist
      }

      // Re-throw other errors (network, auth, etc.)
      throw new ExternalServiceError('R2 cache check failed', error);
    }
  }

  /**
   * Build AI prompt combining item context with material descriptions
   */
  public async buildAIPrompt(
    itemTypeId: string,
    materialIds: string[],
    styleIds: string[]
  ): Promise<string> {
    // Step 1: Fetch item type data
    const itemType = await this.itemRepository.findItemTypeById(itemTypeId);
    if (!itemType) {
      throw new NotFoundError('ItemType', itemTypeId);
    }

    // Step 2: Fetch material templates with descriptions
    const materials = await Promise.all(
      materialIds.map(id => this.materialRepository.findMaterialById(id))
    );

    // Step 3: Fetch style definitions
    const styles = await Promise.all(
      styleIds.map(id => this.styleRepository.findById(id))
    );

    // Step 4: Build fusion description
    const materialDescriptions = materials.map((material: any, index: number) => {
      if (!material) {
        throw new NotFoundError('Material', materialIds[index]);
      }

      const style = styles[index];
      if (!style) {
        throw new NotFoundError('Style', styleIds[index]);
      }

      const baseDesc = material.description;

      if (style.id === 'normal') {
        return baseDesc;
      } else {
        return `${baseDesc} (rendered in ${style.style_name} style)`;
      }
    }).join(', ');

    // Step 4: Construct full prompt
    const fusionDescription = `${itemType.name} crafted from ${materialDescriptions}`;

    return this.buildReplicatePrompt(itemType.name, fusionDescription);
  }

  /**
   * Build detailed Replicate prompt with style instructions
   */
  private buildReplicatePrompt(itemName: string, itemDescription: string): string {
    return `Create a single, center-framed 1:1 item:

"${itemName}: ${itemDescription}"

This illustration in a polished, high-detail "chibi"/super-deformed aesthetic typical of mobile RPGs and CCGs.

Core Look
    •    Color: Vivid, high-saturation palette; punchy local colors with clean hue separation. Keep values readable; avoid muddy midtones.
    •    Lighting: Clear, soft key light with gentle fill; minimal deep shadow. Add a crisp rim light to separate from the background.
    •    Glow & Highlights: Tasteful outer glow/halo to signal rarity or power. Use tight, glossy specular highlights on hard materials; soft bloom on emissive parts.

Line & Form
    •    Outlines: Bold, uniform, and clean to carve a strong silhouette; no sketchy linework.
    •    Proportions: Chunky, simplified, and slightly exaggerated shapes for instant readability.
    •    Texture: Suggestive, not photoreal—hint at materials (wood grain, brushed metal, facets) with tidy, deliberate marks.

Shading & Depth
    •    Render Style: Hybrid cel + soft gradients; sharp edge transitions only where they improve clarity.
    •    Volume: Strong sense of 3D mass via light, occlusion, and controlled contrast; default to a subtle 3/4 view.

Composition & Background
    •    Framing: Single hero object, centered; crop to emphasize silhouette.
    •    Background: Simple radial gradient or soft vignette; optional light particle specks. No props or scene unless specified.
    •    Polish: Soft contact shadow beneath item; no text, watermarks, borders, or logos.`;
  }

  /**
   * Upload generated image buffer to Cloudflare R2 with proper metadata
   */
  public async uploadToR2(imageBuffer: Buffer, filename: string): Promise<string> {
    const client = this.createR2Client();

    try {
      await client.send(new PutObjectCommand({
        Bucket: this.R2_BUCKET_NAME,
        Key: filename,
        Body: imageBuffer,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000', // 1 year cache (images are immutable)
        Metadata: {
          'generated-at': new Date().toISOString(),
          'service': 'mystica-image-generation',
          'version': '1.0'
        }
      }));

      const publicUrl = `${this.R2_PUBLIC_URL}/${filename}`;
      console.log(`📤 Uploaded to R2: ${publicUrl}`);

      return publicUrl;

    } catch (error: any) {
      throw new ExternalServiceError('R2 upload failed', error);
    }
  }

  /**
   * Fetch material reference images for AI generation context
   */
  private async fetchMaterialReferenceImages(
    materialIds: string[],
    styleIds: string[]
  ): Promise<string[]> {
    const referenceUrls: string[] = [];

    // Add base reference image set (10 hardcoded style references)
    const baseReferences = [
      'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/fantasy-weapon-1.png',
      'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/magic-crystal-2.png',
      'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/wooden-staff-3.png',
      'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/metal-armor-4.png',
      'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/gem-accessory-5.png',
      'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/leather-boots-6.png',
      'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/cloth-robes-7.png',
      'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/potion-bottle-8.png',
      'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/scroll-paper-9.png',
      'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/monster-claw-10.png'
    ];

    referenceUrls.push(...baseReferences);

    // Add specific material images if they exist in R2
    for (let i = 0; i < materialIds.length; i++) {
      const materialId = materialIds[i];
      const styleId = styleIds[i];

      try {
        const material = await this.materialRepository.findMaterialById(materialId);
        if (material) {
          const materialName = material.name;
          const normalizedName = this.normalizeNameForR2(materialName);

          // Check for styled version first, then normal
          let materialUrl: string | null = null;

          if (styleId !== 'normal') {
            materialUrl = await this.checkR2AssetExists(
              `materials/styled/${normalizedName}_${styleId}.png`
            );
          }

          if (!materialUrl) {
            materialUrl = await this.checkR2AssetExists(
              `materials/${normalizedName}.png`
            );
          }

          if (materialUrl) {
            referenceUrls.push(materialUrl);
          }
        }
      } catch (error) {
        // Continue if material image not found - base references are sufficient
        console.warn(`Material reference not found: ${materialId}`);
      }
    }

    return referenceUrls;
  }

  /**
   * Generate image via Replicate API with retry logic
   */
  private async generateWithRetry(options: ReplicateGenerationOptions, maxRetries = 2): Promise<string> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await this.generateWithReplicate(options);
      } catch (error) {
        lastError = error as Error;

        if (attempt <= maxRetries) {
          const delay = attempt * 2000; // Progressive backoff: 2s, 4s
          console.warn(`🔄 Generation attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new ExternalServiceError('Generation failed after retries', lastError!);
  }

  /**
   * Core Replicate API integration
   */
  private async generateWithReplicate(options: ReplicateGenerationOptions): Promise<string> {
    const replicate = new Replicate({ auth: this.REPLICATE_API_TOKEN });

    let modelName: string;
    let input: Record<string, unknown>;

    if (options.provider === 'gemini') {
      modelName = 'google/nano-banana';
      input = {
        prompt: options.prompt,
        aspect_ratio: options.aspectRatio,
        output_format: options.outputFormat,
        image_input: options.referenceImages
      };
    } else {
      modelName = 'bytedance/seedream-4';
      input = {
        prompt: options.prompt,
        width: 1024,
        height: 1024,
        max_images: 1,
        sequential_image_generation: 'disabled',
        image_input: options.referenceImages
      };
    }

    const output = await replicate.run(modelName as `${string}/${string}`, { input }) as any;

    // Handle provider-specific response formats
    let imageUrl: string;
    if (typeof output?.url === 'function') {
      imageUrl = output.url();
    } else if (Array.isArray(output) && output.length > 0) {
      imageUrl = typeof output[0].url === 'function' ? output[0].url() : output[0];
    } else {
      throw new ExternalServiceError('No image returned from Replicate API');
    }

    // Download and convert to base64
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new ExternalServiceError(`Failed to download generated image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return buffer.toString('base64');
  }

  /**
   * Create configured R2 client
   */
  private createR2Client(): S3Client {
    return new S3Client({
      region: 'auto',
      endpoint: `https://${this.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.R2_ACCESS_KEY_ID,
        secretAccessKey: this.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  /**
   * Validate environment credentials
   */
  private async validateEnvironmentCredentials(): Promise<void> {
    if (!this.REPLICATE_API_TOKEN) {
      throw new ConfigurationError('REPLICATE_API_TOKEN not configured');
    }
    if (!this.R2_ACCESS_KEY_ID || !this.R2_SECRET_ACCESS_KEY || !this.R2_ACCOUNT_ID) {
      throw new ConfigurationError('R2 credentials missing');
    }
  }

  /**
   * Get item type slug for filename generation
   */
  private async getItemTypeSlug(itemTypeId: string): Promise<string> {
    const itemType = await this.itemRepository.findItemTypeById(itemTypeId);
    if (!itemType) {
      throw new NotFoundError('ItemType', itemTypeId);
    }
    return this.normalizeNameForR2(itemType.name);
  }

  /**
   * Normalize name for R2 key generation
   */
  private normalizeNameForR2(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  /**
   * Check if R2 asset exists
   */
  private async checkR2AssetExists(key: string): Promise<string | null> {
    try {
      const client = this.createR2Client();
      await client.send(new HeadObjectCommand({
        Bucket: this.R2_BUCKET_NAME,
        Key: key,
      }));

      return `${this.R2_PUBLIC_URL}/${key}`;
    } catch {
      return null;
    }
  }

  // Legacy method for backward compatibility
  async generateImage(
    itemTypeId: string,
    materials: Array<{ material_id: string; style_id: string; image_url: string }>
  ): Promise<string> {
    const materialIds = materials.map(m => m.material_id);
    const styleIds = materials.map(m => m.style_id);

    return this.generateComboImage({
      itemTypeId,
      materialIds,
      styleIds
    });
  }
}

export const imageGenerationService = new ImageGenerationService();