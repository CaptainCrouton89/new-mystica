import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import Replicate from 'replicate';
import { env } from '../config/env.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { StyleRepository } from '../repositories/StyleRepository.js';
import {
  ConfigurationError,
  ExternalServiceError,
  NotFoundError,
  ValidationError
} from '../utils/errors.js';
import { computeComboHashWithStyles } from '../utils/hash.js';

export interface GenerateComboImageRequest {
  itemTypeId: string;
  materialIds: string[];
  styleIds: string[];
  comboHash?: string;
}

interface ReplicateGenerationOptions {
  prompt: string;
  referenceImages: string[];
  provider: 'gemini';
  aspectRatio: '1:1';
  outputFormat: 'png';
}

export class ImageGenerationService {
  private readonly R2_BUCKET_NAME = env.R2_BUCKET_NAME;
  private readonly R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;
  private readonly R2_ACCOUNT_ID = env.CLOUDFLARE_ACCOUNT_ID;
  private readonly R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID;
  private readonly R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY;
  private readonly REPLICATE_API_TOKEN = env.REPLICATE_API_TOKEN;

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

  async generateComboImage(request: GenerateComboImageRequest): Promise<string> {
    await this.validateEnvironmentCredentials();

    if (request.materialIds.length === 0 || request.materialIds.length > 3) {
      throw new ValidationError('Material count must be 1-3');
    }

    if (request.materialIds.length !== request.styleIds.length) {
      throw new ValidationError('Material IDs and Style IDs arrays must have same length');
    }

    const comboHash = request.comboHash ||
      computeComboHashWithStyles(request.materialIds, request.styleIds);

    const itemTypeSlug = await this.getItemTypeSlug(request.itemTypeId);
    const filename = `items-crafted/${itemTypeSlug}/${comboHash}.png`;

    const existingUrl = await this.checkR2ForExisting(request.itemTypeId, comboHash);
    if (existingUrl) {
      return existingUrl;
    }

    const prompt = await this.buildAIPrompt(
      request.itemTypeId,
      request.materialIds,
      request.styleIds
    );

    const referenceImages = await this.fetchMaterialReferenceImages(
      request.materialIds,
      request.styleIds
    );

    const startTime = Date.now();

    const imageBase64 = await this.generateWithRetry({
      prompt,
      referenceImages,
      provider: 'gemini', 
      aspectRatio: '1:1',
      outputFormat: 'png'
    });

    const buffer = Buffer.from(imageBase64, 'base64');
    const publicUrl = await this.uploadToR2(buffer, filename);

    return publicUrl;
  }

  async checkR2ForExisting(itemTypeId: string, comboHash: string): Promise<string | null> {
    const itemTypeSlug = await this.getItemTypeSlug(itemTypeId);
    const filename = `items-crafted/${itemTypeSlug}/${comboHash}.png`;

    try {
      const client = this.createR2Client();

      await client.send(new HeadObjectCommand({
        Bucket: this.R2_BUCKET_NAME,
        Key: filename,
      }));

      const publicUrl = `${this.R2_PUBLIC_URL}/${filename}`;
      return publicUrl;

    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return null; 
      }

      throw new ExternalServiceError('R2 cache check failed', error);
    }
  }

  public async buildAIPrompt(
    itemTypeId: string,
    materialIds: string[],
    styleIds: string[]
  ): Promise<string> {
    const itemType = await this.itemRepository.findItemTypeById(itemTypeId);
    if (!itemType) {
      throw new NotFoundError('ItemType', itemTypeId);
    }

    const materials = await Promise.all(
      materialIds.map(id => this.materialRepository.findMaterialById(id))
    );

    const styles = await Promise.all(
      styleIds.map(id => this.styleRepository.findById(id))
    );

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
        return `${baseDesc} (rendered in ${style.display_name} style)`;
      }
    }).join(', ');

    const fusionDescription = `${itemType.name} crafted from ${materialDescriptions}`;

    return this.buildReplicatePrompt(itemType.name, fusionDescription);
  }

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

  public async uploadToR2(imageBuffer: Buffer, filename: string): Promise<string> {
    const client = this.createR2Client();

    try {
      await client.send(new PutObjectCommand({
        Bucket: this.R2_BUCKET_NAME,
        Key: filename,
        Body: imageBuffer,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000', 
        Metadata: {
          'generated-at': new Date().toISOString(),
          'service': 'mystica-image-generation',
          'version': '1.0'
        }
      }));

      const publicUrl = `${this.R2_PUBLIC_URL}/${filename}`;

      return publicUrl;

    } catch (error: any) {
      throw new ExternalServiceError('R2 upload failed', error);
    }
  }

  private async fetchMaterialReferenceImages(
    materialIds: string[],
    styleIds: string[]
  ): Promise<string[]> {
    const referenceUrls: string[] = [];

    const baseReferences = [
      `${process.env.R2_PUBLIC_URL}/image-refs/fantasy-weapon-1.png`,
      `${process.env.R2_PUBLIC_URL}/image-refs/magic-crystal-2.png`,
      `${process.env.R2_PUBLIC_URL}/image-refs/wooden-staff-3.png`,
      `${process.env.R2_PUBLIC_URL}/image-refs/metal-armor-4.png`,
      `${process.env.R2_PUBLIC_URL}/image-refs/gem-accessory-5.png`,
      `${process.env.R2_PUBLIC_URL}/image-refs/leather-boots-6.png`,
      `${process.env.R2_PUBLIC_URL}/image-refs/cloth-robes-7.png`,
      `${process.env.R2_PUBLIC_URL}/image-refs/potion-bottle-8.png`,
      `${process.env.R2_PUBLIC_URL}/image-refs/scroll-paper-9.png`,
      `${process.env.R2_PUBLIC_URL}/image-refs/monster-claw-10.png`
    ];

    referenceUrls.push(...baseReferences);

    for (let i = 0; i < materialIds.length; i++) {
      const materialId = materialIds[i];
      const styleId = styleIds[i];

      try {
        const material = await this.materialRepository.findMaterialById(materialId);
        if (material) {
          const materialName = material.name;
          const normalizedName = this.normalizeNameForR2(materialName);

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
        // Ignore error - base references are sufficient
      }
    }

    return referenceUrls;
  }

  private async generateWithRetry(options: ReplicateGenerationOptions, maxRetries = 2): Promise<string> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await this.generateWithReplicate(options);
      } catch (error) {
        lastError = error as Error;

        if (attempt <= maxRetries) {
          const delay = attempt * 2000; 
            await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new ExternalServiceError('Generation failed after retries', lastError!);
  }

  private async generateWithReplicate(options: ReplicateGenerationOptions): Promise<string> {
    const replicate = new Replicate({ auth: this.REPLICATE_API_TOKEN });

    const modelName = 'google/nano-banana';
    const input = {
      prompt: options.prompt,
      aspect_ratio: options.aspectRatio,
      output_format: options.outputFormat
    };

    const output = await replicate.run(modelName as `${string}/${string}`, { input }) as any;

    let imageUrl: string;
    if (typeof output?.url === 'function') {
      imageUrl = output.url();
    } else if (Array.isArray(output) && output.length > 0) {
      imageUrl = typeof output[0].url === 'function' ? output[0].url() : output[0];
    } else {
      throw new ExternalServiceError('No image returned from Replicate API');
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new ExternalServiceError(`Failed to download generated image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return buffer.toString('base64');
  }

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

  private async validateEnvironmentCredentials(): Promise<void> {
    if (!this.REPLICATE_API_TOKEN) {
      throw new ConfigurationError('REPLICATE_API_TOKEN not configured');
    }
    if (!this.R2_ACCESS_KEY_ID || !this.R2_SECRET_ACCESS_KEY || !this.R2_ACCOUNT_ID) {
      throw new ConfigurationError('R2 credentials missing');
    }
  }

  private async getItemTypeSlug(itemTypeId: string): Promise<string> {
    const itemType = await this.itemRepository.findItemTypeById(itemTypeId);
    if (!itemType) {
      throw new NotFoundError('ItemType', itemTypeId);
    }
    return this.normalizeNameForR2(itemType.name);
  }

  private normalizeNameForR2(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  private async checkR2AssetExists(key: string): Promise<string | null> {
    try {
      const client = this.createR2Client();
      await client.send(new HeadObjectCommand({
        Bucket: this.R2_BUCKET_NAME,
        Key: key,
      }));

      return `${this.R2_PUBLIC_URL}/${key}`;
    } catch (error) {
      throw new Error(`Failed to upload image to R2: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

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