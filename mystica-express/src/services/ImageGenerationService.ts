import { NotImplementedError } from '../utils/errors';

interface MaterialReference {
  material_id: string;
  is_shiny: boolean;
  image_url: string;
}

/**
 * Handles AI image generation and R2 upload integration
 */
export class ImageGenerationService {
  /**
   * Generate item image with AI using materials as references
   * - Uses item type and materials to create prompt
   * - Calls Replicate API (Gemini/Seedream) for generation
   * - Uploads result to Cloudflare R2 bucket
   * - Returns public R2 URL for the generated image
   * - Process takes ~20 seconds (synchronous)
   */
  async generateImage(
    itemTypeId: string,
    materials: MaterialReference[]
  ): Promise<string> {
    // TODO: Implement image generation workflow
    // 1. Fetch ItemType data for base prompt
    // 2. Fetch Material data for each material reference
    // 3. Build AI prompt: "{item_type} made from {material1}, {material2}, {material3}"
    // 4. Add style instructions and reference image URLs
    // 5. Call Replicate API with prompt and references
    // 6. Wait for generation completion (~20s)
    // 7. Upload generated image to R2 bucket
    // 8. Generate deterministic filename: items/{item_type_id}_{combo_hash}.png
    // 9. Return public R2 URL
    // 10. Handle API errors and retries
    throw new NotImplementedError('ImageGenerationService.generateImage not implemented');
  }

  /**
   * Check if image exists in R2 bucket
   * - Used to avoid regenerating existing images
   * - Returns boolean indicating existence
   */
  private async checkImageExists(filename: string): Promise<boolean> {
    // TODO: Implement R2 existence check
    // 1. Use Cloudflare R2 SDK to check object existence
    // 2. Return true if file exists, false otherwise
    throw new NotImplementedError('ImageGenerationService.checkImageExists not implemented');
  }

  /**
   * Upload image buffer to R2 bucket
   * - Handles file upload with proper metadata
   * - Returns public URL for the uploaded image
   */
  private async uploadToR2(buffer: Buffer, filename: string): Promise<string> {
    // TODO: Implement R2 upload
    // 1. Configure R2 client with credentials
    // 2. Upload buffer with filename
    // 3. Set appropriate content-type and cache headers
    // 4. Return public URL: https://pub-{bucket-id}.r2.dev/{filename}
    throw new NotImplementedError('ImageGenerationService.uploadToR2 not implemented');
  }
}

export const imageGenerationService = new ImageGenerationService();