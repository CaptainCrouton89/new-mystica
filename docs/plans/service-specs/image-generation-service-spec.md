# Image Generation Service Specification

**Document Version**: 1.0
**Last Updated**: 2025-01-27
**Related Features**: F-04 Materials System, F-05 Material Drop System
**Target Release**: MVP0/1

## Overview

This specification defines the complete ImageGenerationService implementation for AI-powered material combo image generation in the New Mystica materials system. The service handles synchronous image generation for items with applied materials, leveraging Replicate API and Cloudflare R2 storage.

### Critical Design Constraints

**⚠️ SYNCHRONOUS GENERATION IN MVP0**: Image generation is deliberately blocking (20s) during material application to maintain system simplicity. Async generation with job queues is planned for later MVPs.

**⚠️ CACHE-FIRST STRATEGY**: Always check ItemImageCache before triggering expensive generation to avoid duplicate API calls and storage costs.

## Service Layer Architecture

### ImageGenerationService Public Methods

The ImageGenerationService implements the following public interface:

```typescript
export class ImageGenerationService {
  // Primary generation method (auth required via MaterialService caller)
  async generateComboImage(request: GenerateComboImageRequest): Promise<string>

  // Cache verification method (auth required via MaterialService caller)
  async checkR2ForExisting(itemTypeId: string, comboHash: string): Promise<string | null>

  // Utility methods
  private async buildAIPrompt(itemTypeId: string, materialIds: string[], styleIds: string[]): Promise<string>
  private async uploadToR2(imageBuffer: Buffer, filename: string): Promise<string>
  private async fetchMaterialReferenceImages(materialIds: string[], styleIds: string[]): Promise<string[]>
  private async validateEnvironmentCredentials(): Promise<void>
}
```

## Method Specifications

### 1. generateComboImage(request: GenerateComboImageRequest)

**Purpose**: Generates AI image for item with applied materials and uploads to R2 storage.

**Authentication**: Indirectly required (called only by MaterialService.applyMaterial)

**Request Schema**:
```typescript
interface GenerateComboImageRequest {
  itemTypeId: string;      // Target item type UUID
  materialIds: string[];   // Applied material template IDs (1-3 materials)
  styleIds: string[];      // Corresponding style IDs (normal, pixel_art, etc.)
  comboHash?: string;      // Optional pre-computed hash for filename
}
```

**Implementation Workflow**:

```typescript
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

  const imageBase64 = await this.generateWithReplicate({
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
```

**Response Contract**:
- Returns public R2 URL string (e.g., `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items-crafted/magic_wand/abc123.png`)
- URL is immediately accessible and cacheable via CDN
- Filename includes deterministic combo hash for cache consistency

**Error Handling**:
- 400 Bad Request: Invalid material count, mismatched array lengths
- 424 Failed Dependency: Replicate API failures, R2 upload failures
- 500 Internal Server Error: Missing environment credentials, unexpected API responses

**Performance Notes**:
- **Generation Time**: ~20 seconds (blocking operation in MVP0)
- **R2 Upload**: Additional ~2-3 seconds
- **Cache Hit**: Sub-100ms response when image exists
- **API Costs**: ~$0.002-0.01 per image (Replicate variable billing)

### 2. checkR2ForExisting(itemTypeId: string, comboHash: string)

**Purpose**: Verifies if generated image already exists in R2 cache before triggering expensive generation.

**Authentication**: Indirectly required (called only by MaterialService or ImageGenerationService)

**Implementation**:
```typescript
async checkR2ForExisting(itemTypeId: string, comboHash: string): Promise<string | null> {
  try {
    const itemTypeSlug = await this.getItemTypeSlug(itemTypeId);
    const filename = `items-crafted/${itemTypeSlug}/${comboHash}.png`;

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
```

**Response Contract**:
- Returns public URL string if image exists
- Returns `null` if image doesn't exist (cache miss)
- Throws error for network/auth failures only

**Error Handling**:
- 424 Failed Dependency: R2 connection failures, authentication errors
- Returns `null` for 404 Not Found (expected cache miss behavior)

### 3. buildAIPrompt(itemTypeId: string, materialIds: string[], styleIds: string[])

**Purpose**: Constructs detailed AI prompt combining item context with material descriptions.

**Implementation**:
```typescript
private async buildAIPrompt(
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
    styleIds.map(id => this.styleRepository.findStyleById(id))
  );

  // Step 4: Build fusion description
  const materialDescriptions = materials.map((material, index) => {
    const style = styles[index];
    const baseDesc = material!.description;

    if (style!.id === 'normal') {
      return baseDesc;
    } else {
      return `${baseDesc} (rendered in ${style!.name} style)`;
    }
  }).join(', ');

  // Step 5: Construct full prompt
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
```

**Features**:
- Combines item base description with material fusion context
- Handles style variations (normal, pixel_art, etc.)
- Uses consistent prompt template from generate-image.ts
- Generates fusion descriptions like "Magic Wand crafted from enchanted wood, crystal dust"

### 4. uploadToR2(imageBuffer: Buffer, filename: string)

**Purpose**: Uploads generated image buffer to Cloudflare R2 with proper metadata.

**Implementation**:
```typescript
private async uploadToR2(imageBuffer: Buffer, filename: string): Promise<string> {
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
```

**Features**:
- Sets long cache headers (1 year) since combo images are immutable
- Includes metadata for debugging and analytics
- Uses deterministic filename structure for cache consistency
- Proper error handling with context preservation

### 5. fetchMaterialReferenceImages(materialIds: string[], styleIds: string[])

**Purpose**: Retrieves R2 URLs for material images to provide AI generation context.

**Implementation**:
```typescript
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
  } catch {
    return null;
  }
}
```

**Features**:
- Always includes base reference set for style consistency
- Attempts to find specific material images for better context
- Handles both styled and normal material variants
- Graceful fallback if specific material images missing

## External Service Integration

### Replicate API Integration

**Supported Providers**:
- **gemini**: google/nano-banana (default, faster generation)
- **seedream-4**: bytedance/seedream-4 (alternative provider)

**Generation Parameters**:
```typescript
interface ReplicateGenerationOptions {
  prompt: string;
  referenceImages: string[];
  provider: 'gemini' | 'seedream-4';
  aspectRatio: '1:1';
  outputFormat: 'png';
}

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
```

### Cloudflare R2 Integration

**Storage Structure**:
```
mystica-assets/
├── items-crafted/
│   ├── magic_wand/
│   │   ├── abc123def456.png  # combo hash filenames
│   │   └── xyz789uvw012.png
│   ├── leather_armor/
│   │   └── def456ghi789.png
│   └── ...
├── materials/            # Reference images for AI context
│   ├── wood.png
│   ├── crystal.png
│   └── styled/
│       ├── wood_pixel_art.png
│       └── crystal_pixel_art.png
└── image-refs/          # Base reference set (10 images)
    ├── fantasy-weapon-1.png
    └── ...
```

**Configuration**:
```typescript
class ImageGenerationService {
  private readonly R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'mystica-assets';
  private readonly R2_PUBLIC_URL = 'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev';
  private readonly R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
  private readonly R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
  private readonly R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
  private readonly REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN!;
}
```

## Integration Points

### Called by MaterialService

The primary integration point is MaterialService.applyMaterial():

```typescript
// MaterialService.applyMaterial() workflow integration
const imageUrl = await this.imageGenerationService.generateComboImage({
  itemTypeId: request.itemId,
  materialIds: extractMaterialIds(appliedMaterials),
  styleIds: extractStyleIds(appliedMaterials),
  comboHash: computedComboHash
});
```

### Database Dependencies

**ItemImageCache Integration**:
- Called after successful generation to create cache entry
- Cache lookup happens in MaterialService before calling generation
- Cache hits increment craft_count without re-generation

**Required Repository Access**:
```typescript
interface ImageGenerationServiceDependencies {
  itemRepository: ItemRepository;           // Item type data
  materialRepository: MaterialRepository;   // Material templates
  styleRepository: StyleRepository;         // Style definitions
}
```

### Hash Computation Integration

Uses shared hash utility for consistent filename generation:

```typescript
import { computeComboHashWithStyles } from '../utils/hash.js';

// Consistent combo hash for cache keys
const comboHash = computeComboHashWithStyles(materialIds, styleIds);
const filename = `items-crafted/${itemTypeSlug}/${comboHash}.png`;
```

## Error Handling Patterns

### Service Layer Errors

```typescript
// Environment validation
throw new ConfigurationError('REPLICATE_API_TOKEN not configured');
throw new ConfigurationError('R2 credentials missing');

// Business logic violations
throw new ValidationError('Material count must be 1-3');
throw new ValidationError('Material IDs and Style IDs arrays must have same length');

// Resource not found
throw new NotFoundError('ItemType', itemTypeId);
throw new NotFoundError('Material', materialId);

// External service failures
throw new ExternalServiceError('Replicate generation failed', originalError);
throw new ExternalServiceError('R2 upload failed', originalError);
throw new ExternalServiceError('Failed to download generated image', originalError);
```

### HTTP Status Code Mapping

Since ImageGenerationService is called indirectly via MaterialService:

- **400 Bad Request**: ValidationError (invalid material count, array mismatch)
- **404 Not Found**: NotFoundError (missing item type, material)
- **424 Failed Dependency**: ExternalServiceError (Replicate/R2 failures)
- **500 Internal Server Error**: ConfigurationError (missing environment vars)

### Retry Strategy

```typescript
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
```

## Performance Considerations

### Optimization Strategies

1. **Cache-First Lookup**: Always check R2 existence before generation
2. **Parallel Reference Fetching**: Fetch material references concurrently
3. **Progressive Timeouts**: Use different timeouts for cache vs generation operations
4. **Image Compression**: PNG format with appropriate quality settings

### Expected Performance Metrics

- **Cache Hit Response**: 50-100ms (R2 HeadObject check)
- **Cache Miss (Full Generation)**: 20-25 seconds total
  - AI Generation: 18-22 seconds (Replicate variable)
  - R2 Upload: 2-3 seconds (depends on image size)
  - API Overhead: 0.5-1 second
- **Memory Usage**: ~10-20MB per generation (image buffer)
- **API Costs**:
  - Replicate: $0.002-0.01 per image (variable billing)
  - R2 Storage: $0.015/GB-month
  - R2 Operations: $4.50/million requests

### Monitoring Points

```typescript
// Log generation metrics for monitoring
console.log(`⏱️  Generation metrics: {
  itemType: "${itemTypeSlug}",
  materialCount: ${materialIds.length},
  generationTime: ${generationTime}ms,
  provider: "${provider}",
  cacheHit: ${!!existingUrl},
  uploadTime: ${uploadTime}ms
}`);
```

## Testing Strategy

### Unit Tests Required

1. **generateComboImage()**
   - Happy path with valid materials
   - Cache hit scenario (returns early)
   - Validation error scenarios
   - Replicate API failure handling
   - R2 upload failure handling

2. **checkR2ForExisting()**
   - File exists scenario
   - File missing scenario (404)
   - R2 connection failures

3. **buildAIPrompt()**
   - Single material prompt generation
   - Multiple materials prompt generation
   - Style variation handling
   - Missing item/material error handling

4. **uploadToR2()**
   - Successful upload with metadata
   - Upload failure scenarios
   - Filename/path validation

### Integration Tests Required

1. **End-to-End Generation**
   - Mock Replicate API with controlled responses
   - Mock R2 client with upload verification
   - Full prompt building and reference fetching

2. **External Service Mocking**
   - Replicate API response variations
   - R2 HeadObject and PutObject operations
   - Network failure simulation

3. **Cache Consistency**
   - Verify combo hash determinism
   - Verify cache hit/miss behavior
   - Verify R2 filename generation

### Test Environment Setup

```typescript
// Mock Replicate responses for testing
const mockReplicate = {
  run: jest.fn().mockResolvedValue({
    url: () => 'https://replicate.delivery/test-image.png'
  })
};

// Mock R2 client for testing
const mockR2Client = {
  send: jest.fn()
    .mockResolvedValueOnce(undefined) // HeadObject success
    .mockResolvedValueOnce(undefined) // PutObject success
};

// Test data factories
const createGenerateComboImageRequest = (overrides = {}) => ({
  itemTypeId: 'item-123',
  materialIds: ['material-1', 'material-2'],
  styleIds: ['normal', 'pixel_art'],
  ...overrides
});
```

## Implementation Priority

### Phase 1: Core Infrastructure
1. Environment validation and R2 client setup ⚠️ **CRITICAL**
2. Basic generateComboImage() method skeleton
3. checkR2ForExisting() implementation
4. Error handling framework

### Phase 2: AI Integration
1. buildAIPrompt() with material fusion logic
2. Replicate API integration with both providers
3. Reference image fetching from R2
4. Response parsing and base64 conversion

### Phase 3: Upload and Cache
1. uploadToR2() with proper metadata
2. Filename generation with combo hash
3. Cache consistency verification
4. Performance monitoring and logging

### Phase 4: Testing and Refinement
1. Comprehensive unit test suite
2. Integration test with MaterialService
3. Error handling edge cases
4. Performance optimization and monitoring

This specification provides a complete implementation guide for the ImageGenerationService with emphasis on synchronous generation, proper caching, and integration with the existing materials system.

## See Also

### Related Service Specifications
- **[MaterialService](./material-service-spec.md)** - Primary caller for combo image generation
- **[ItemService](./item-service-spec.md)** - Item type data and stat computation
- **[ProfileService](./profile-service-spec.md)** - User context and gold balance validation

### External Dependencies
- **Replicate API Documentation** - google/nano-banana and bytedance/seedream-4 providers
- **Cloudflare R2 Documentation** - S3-compatible storage API
- **AWS SDK v3** - S3Client for R2 operations

### Cross-Referenced Features
- **F-04**: Materials System (primary integration)
- **F-03**: Base Items & Equipment (item type templates)
- **F-06**: Item Upgrade System (styled material effects)