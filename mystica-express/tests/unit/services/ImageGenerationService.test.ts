/**
 * Unit Tests: ImageGenerationService (TDD Example)
 *
 * This test suite demonstrates comprehensive testing for the ImageGenerationService:
 * - Mock external dependencies (Replicate API, R2 S3Client)
 * - Test all public methods with various scenarios
 * - Cover error handling with proper error types
 * - Use factory patterns for test data generation
 *
 * Following TDD principles: WRITE THESE TESTS FIRST, THEN IMPLEMENT ImageGenerationService
 */

import { ImageGenerationService } from '../../../src/services/ImageGenerationService.js';
import {
  ValidationError,
  NotFoundError,
  ExternalServiceError,
  ConfigurationError,
  BusinessLogicError
} from '../../../src/utils/errors.js';

// Import test infrastructure
import {
  ANONYMOUS_USER,
  IRON_MATERIAL,
  CRYSTAL_MATERIAL,
  BASE_SWORD
} from '../../fixtures/index.js';

import {
  UserFactory,
  ItemFactory,
  MaterialFactory
} from '../../factories/index.js';

import {
  expectValidUUID,
  expectValidTimestamp
} from '../../helpers/assertions.js';

// Mock external dependencies BEFORE importing service
jest.mock('replicate');
jest.mock('@aws-sdk/client-s3');

const MockReplicate = require('replicate');
const mockReplicateRun = MockReplicate.mockRun;

// Mock AWS S3 Client
const mockSend = jest.fn();
const { S3Client, HeadObjectCommand, PutObjectCommand } = jest.requireMock('@aws-sdk/client-s3');

S3Client.mockImplementation(() => ({ send: mockSend }));
HeadObjectCommand.mockImplementation((input: any) => ({ input }));
PutObjectCommand.mockImplementation((input: any) => ({ input }));

// Mock node-fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock repository dependencies
const mockItemRepository = {
  findItemTypeById: jest.fn(),
  findItemTypeBySlug: jest.fn()
};

const mockMaterialRepository = {
  findMaterialById: jest.fn()
};

const mockStyleRepository = {
  findById: jest.fn()
};

// Mock environment variables
const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    REPLICATE_API_TOKEN: 'test-replicate-token',
    CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
    R2_ACCESS_KEY_ID: 'test-access-key',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
    R2_BUCKET_NAME: 'test-bucket'
  };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('ImageGenerationService (TDD)', () => {
  let imageGenerationService: ImageGenerationService;
  const userId = ANONYMOUS_USER.id;

  beforeEach(() => {
    // Clear all mocks first
    jest.clearAllMocks();

    // Initialize service with mocked dependencies
    imageGenerationService = new ImageGenerationService(
      mockItemRepository as any,
      mockMaterialRepository as any,
      mockStyleRepository as any
    );

    // Clear mock implementations
    mockSend.mockClear();
    mockReplicateRun.mockClear();
    mockFetch.mockClear();

    // Setup default mock responses
    mockItemRepository.findItemTypeById.mockResolvedValue({
      id: 'item-type-123',
      name: 'Magic Wand',
      slug: 'magic_wand',
      description: 'A mystical wand imbued with arcane power'
    });

    mockMaterialRepository.findMaterialById.mockResolvedValue(IRON_MATERIAL);
    mockStyleRepository.findById.mockResolvedValue({
      id: 'normal',
      style_name: 'Normal',
      description: 'Standard material appearance'
    });
  });

  /**
   * Test Group 1: generateComboImage() - Happy Path
   */
  describe('generateComboImage() - Happy Path', () => {
    it('should successfully generate new combo image and upload to R2', async () => {
      // Arrange: Mock cache miss (no existing image)
      mockSend
        .mockRejectedValueOnce({ name: 'NotFound' }) // HeadObject fails (cache miss)
        .mockResolvedValueOnce({}); // PutObject succeeds

      // Mock Replicate API response
      mockReplicateRun.mockResolvedValue({
        url: () => 'https://replicate.delivery/generated-image.png'
      });

      // Mock fetch for image download
      const mockImageBuffer = Buffer.from('fake-image-data');
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockImageBuffer)
      });

      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron', 'crystal'],
        styleIds: ['normal', 'normal'],
        comboHash: 'abc123def456'
      };

      // Act
      const result = await imageGenerationService.generateComboImage(request);

      // Assert: Should return R2 public URL
      expect(result).toBe('https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items-crafted/magic_wand/abc123def456.png');

      // Verify R2 cache check was attempted
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'items-crafted/magic_wand/abc123def456.png'
          })
        })
      );

      // Verify Replicate API was called with correct prompt
      expect(mockReplicateRun).toHaveBeenCalledWith(
        'google/nano-banana',
        expect.objectContaining({
          input: expect.objectContaining({
            prompt: expect.stringContaining('Magic Wand crafted from'),
            aspect_ratio: '1:1',
            output_format: 'png'
          })
        })
      );

      // Verify R2 upload was attempted
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'items-crafted/magic_wand/abc123def456.png',
            Body: mockImageBuffer,
            ContentType: 'image/png'
          })
        })
      );
    });

    it('should return cached image URL when cache hit occurs', async () => {
      // Arrange: Mock cache hit (HeadObject succeeds)
      mockSend.mockResolvedValueOnce({}); // HeadObject succeeds

      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron'],
        styleIds: ['normal'],
        comboHash: 'cached123'
      };

      // Act
      const result = await imageGenerationService.generateComboImage(request);

      // Assert: Should return cached URL immediately
      expect(result).toBe('https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items-crafted/magic_wand/cached123.png');

      // Verify no Replicate call was made
      expect(mockReplicateRun).not.toHaveBeenCalled();

      // Verify no upload was attempted
      expect(mockSend).toHaveBeenCalledTimes(1); // Only HeadObject call
    });

    it('should generate combo hash when not provided', async () => {
      // Arrange: No comboHash in request
      mockSend
        .mockRejectedValueOnce({ name: 'NotFound' })
        .mockResolvedValueOnce({});

      mockReplicateRun.mockResolvedValue({
        url: () => 'https://replicate.delivery/generated.png'
      });

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from('test'))
      });

      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron', 'crystal'],
        styleIds: ['normal', 'pixel_art']
        // comboHash omitted - should be generated
      };

      // Act
      const result = await imageGenerationService.generateComboImage(request);

      // Assert: Should generate deterministic filename
      expect(result).toMatch(/items-crafted\/magic_wand\/[a-f0-9]+\.png$/);

      // Verify upload used generated hash
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Key: expect.stringMatching(/items-crafted\/magic_wand\/[a-f0-9]+\.png/)
          })
        })
      );
    });
  });

  /**
   * Test Group 2: generateComboImage() - Validation Errors
   */
  describe('generateComboImage() - Validation Errors', () => {
    it('should throw ValidationError when no materials provided', async () => {
      const request = {
        itemTypeId: 'item-type-123',
        materialIds: [],
        styleIds: []
      };

      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow(ValidationError);

      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow('Material count must be 1-3');
    });

    it('should throw ValidationError when more than 3 materials provided', async () => {
      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron', 'crystal', 'wood', 'coffee'],
        styleIds: ['normal', 'normal', 'normal', 'normal']
      };

      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow(ValidationError);

      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow('Material count must be 1-3');
    });

    it('should throw ValidationError when material and style arrays have different lengths', async () => {
      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron', 'crystal'],
        styleIds: ['normal'] // Mismatched length
      };

      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow(ValidationError);

      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow('Material IDs and Style IDs arrays must have same length');
    });

    it('should throw NotFoundError when item type does not exist', async () => {
      mockItemRepository.findItemTypeById.mockResolvedValue(null);

      const request = {
        itemTypeId: 'nonexistent-item',
        materialIds: ['iron'],
        styleIds: ['normal']
      };

      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow(NotFoundError);

      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow('ItemType');
    });

    it('should throw NotFoundError when material does not exist', async () => {
      // Mock item type exists but material doesn't
      mockItemRepository.findItemTypeById.mockResolvedValue({
        id: 'item-type-123',
        name: 'Magic Wand',
        slug: 'magic_wand'
      });
      mockMaterialRepository.findMaterialById.mockResolvedValue(null);
      mockStyleRepository.findById.mockResolvedValue({
        id: 'normal',
        style_name: 'Normal'
      });

      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['nonexistent-material'],
        styleIds: ['normal']
      };

      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow(NotFoundError);

      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow('Material');
    });
  });

  /**
   * Test Group 3: generateComboImage() - External Service Failures
   */
  describe('generateComboImage() - External Service Failures', () => {
    it('should throw ExternalAPIError when Replicate API fails', async () => {
      // Arrange: Cache miss, then Replicate failure
      mockSend.mockRejectedValueOnce({ name: 'NotFound' });
      mockReplicateRun.mockReset().mockRejectedValue(new Error('Replicate API unavailable'));

      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron'],
        styleIds: ['normal']
      };

      // Act & Assert
      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow(ExternalServiceError);

      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow('generation failed');
    });

    it('should throw ExternalServiceError when image download fails', async () => {
      // Arrange: Successful generation, failed download
      mockSend.mockRejectedValueOnce({ name: 'NotFound' });
      mockReplicateRun.mockReset().mockResolvedValue({
        url: () => 'https://replicate.delivery/test.png'
      });
      mockFetch.mockReset().mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error'
      });

      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron'],
        styleIds: ['normal']
      };

      // Act & Assert
      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow(ExternalServiceError);

      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow('Failed to download generated image');
    });

    it('should throw ExternalServiceError when R2 upload fails', async () => {
      // Arrange: Successful generation and download, failed upload
      mockSend
        .mockRejectedValueOnce({ name: 'NotFound' }) // Cache miss
        .mockRejectedValueOnce(new Error('R2 upload failed')); // Upload fails

      mockReplicateRun.mockReset().mockResolvedValue({
        url: () => 'https://replicate.delivery/test.png'
      });

      mockFetch.mockReset().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from('test'))
      });

      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron'],
        styleIds: ['normal']
      };

      // Act & Assert
      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow(ExternalServiceError);

      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow('R2 upload failed');
    });
  });

  /**
   * Test Group 4: checkR2ForExisting()
   */
  describe('checkR2ForExisting()', () => {
    it('should return public URL when image exists in R2', async () => {
      // Arrange: HeadObject succeeds
      mockSend.mockResolvedValueOnce({});

      // Act
      const result = await imageGenerationService.checkR2ForExisting('item-type-123', 'test-hash');

      // Assert
      expect(result).toBe('https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items-crafted/magic_wand/test-hash.png');

      // Verify correct HeadObject call
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'items-crafted/magic_wand/test-hash.png'
          })
        })
      );
    });

    it('should return null when image does not exist (404)', async () => {
      // Arrange: HeadObject returns 404
      mockSend.mockRejectedValueOnce({
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 }
      });

      // Act
      const result = await imageGenerationService.checkR2ForExisting('item-type-123', 'missing-hash');

      // Assert
      expect(result).toBeNull();
    });

    it('should throw ExternalAPIError for non-404 R2 errors', async () => {
      // Arrange: R2 connection error
      mockItemRepository.findItemTypeById.mockResolvedValue({
        id: 'item-type-123',
        name: 'Magic Wand',
        slug: 'magic_wand'
      });
      mockSend.mockReset().mockRejectedValueOnce({
        name: 'NetworkError',
        message: 'Connection timeout'
      });

      // Act & Assert
      await expect(
        imageGenerationService.checkR2ForExisting('item-type-123', 'test-hash')
      ).rejects.toThrow(ExternalServiceError);

      await expect(
        imageGenerationService.checkR2ForExisting('item-type-123', 'test-hash')
      ).rejects.toThrow('R2 cache check failed');
    });
  });

  /**
   * Test Group 5: buildAIPrompt()
   */
  describe('buildAIPrompt()', () => {
    it('should build prompt with single material (normal style)', async () => {
      // Arrange: Single material with normal style
      mockMaterialRepository.findMaterialById.mockResolvedValue({
        id: 'iron',
        name: 'Iron',
        description: 'Durable metallic material with defensive properties'
      });

      mockStyleRepository.findById.mockResolvedValue({
        id: 'normal',
        style_name: 'Normal'
      });

      // Act
      const prompt = await imageGenerationService.buildAIPrompt(
        'item-type-123',
        ['iron'],
        ['normal']
      );

      // Assert
      expect(prompt).toContain('Magic Wand crafted from Durable metallic material with defensive properties');
      expect(prompt).toContain('Create a single, center-framed 1:1 item');
      expect(prompt).toContain('chibi"/super-deformed aesthetic');
    });

    it('should build prompt with multiple materials and styles', async () => {
      // Arrange: Multiple materials with different styles
      mockMaterialRepository.findMaterialById
        .mockResolvedValueOnce({
          id: 'iron',
          name: 'Iron',
          description: 'Durable metallic material'
        })
        .mockResolvedValueOnce({
          id: 'crystal',
          name: 'Crystal',
          description: 'Sparkling magical crystal'
        });

      mockStyleRepository.findById
        .mockResolvedValueOnce({
          id: 'normal',
          style_name: 'Normal'
        })
        .mockResolvedValueOnce({
          id: 'pixel_art',
          style_name: 'Pixel Art'
        });

      // Act
      const prompt = await imageGenerationService.buildAIPrompt(
        'item-type-123',
        ['iron', 'crystal'],
        ['normal', 'pixel_art']
      );

      // Assert
      expect(prompt).toContain('Magic Wand crafted from Durable metallic material, Sparkling magical crystal (rendered in Pixel Art style)');
      expect(prompt).toContain('Create a single, center-framed 1:1 item');
    });

    it('should handle missing materials gracefully', async () => {
      mockMaterialRepository.findMaterialById.mockResolvedValue(null);

      await expect(
        imageGenerationService.buildAIPrompt('item-type-123', ['missing'], ['normal'])
      ).rejects.toThrow(NotFoundError);
    });

    it('should handle missing styles gracefully', async () => {
      mockMaterialRepository.findMaterialById.mockResolvedValue(IRON_MATERIAL);
      mockStyleRepository.findById.mockResolvedValue(null);

      await expect(
        imageGenerationService.buildAIPrompt('item-type-123', ['iron'], ['missing-style'])
      ).rejects.toThrow(NotFoundError);
    });
  });

  /**
   * Test Group 6: uploadToR2()
   */
  describe('uploadToR2()', () => {
    it('should successfully upload image with correct metadata', async () => {
      // Arrange
      mockSend.mockResolvedValueOnce({});
      const imageBuffer = Buffer.from('test-image-data');
      const filename = 'items-crafted/magic_wand/test123.png';

      // Act
      const result = await imageGenerationService.uploadToR2(imageBuffer, filename);

      // Assert
      expect(result).toBe('https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items-crafted/magic_wand/test123.png');

      // Verify PutObject call with correct parameters
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: filename,
            Body: imageBuffer,
            ContentType: 'image/png',
            CacheControl: 'public, max-age=31536000',
            Metadata: expect.objectContaining({
              'generated-at': expect.any(String),
              'service': 'mystica-image-generation',
              'version': '1.0'
            })
          })
        })
      );
    });

    it('should throw ExternalServiceError when upload fails', async () => {
      // Arrange
      mockSend.mockRejectedValueOnce(new Error('S3 Permission Denied'));
      const imageBuffer = Buffer.from('test');
      const filename = 'test.png';

      // Act & Assert
      await expect(
        imageGenerationService.uploadToR2(imageBuffer, filename)
      ).rejects.toThrow(ExternalServiceError);
    });
  });

  /**
   * Test Group 7: Environment Validation
   */
  describe('Environment Validation', () => {
    it('should throw error when REPLICATE_API_TOKEN is missing', async () => {
      // Arrange: Remove required env var
      delete process.env.REPLICATE_API_TOKEN;

      // Recreate service (to trigger validation)
      const serviceWithMissingEnv = new ImageGenerationService(
        mockItemRepository as any,
        mockMaterialRepository as any,
        mockStyleRepository as any
      );

      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron'],
        styleIds: ['normal']
      };

      // Act & Assert
      await expect(
        serviceWithMissingEnv.generateComboImage(request)
      ).rejects.toThrow('REPLICATE_API_TOKEN not configured');

      // Restore env var
      process.env.REPLICATE_API_TOKEN = 'test-replicate-token';
    });

    it('should throw error when R2 credentials are missing', async () => {
      // Arrange: Remove R2 credentials
      delete process.env.R2_ACCESS_KEY_ID;

      const serviceWithMissingCreds = new ImageGenerationService(
        mockItemRepository as any,
        mockMaterialRepository as any,
        mockStyleRepository as any
      );

      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron'],
        styleIds: ['normal']
      };

      // Act & Assert
      await expect(
        serviceWithMissingCreds.generateComboImage(request)
      ).rejects.toThrow('R2 credentials missing');

      // Restore env var
      process.env.R2_ACCESS_KEY_ID = 'test-access-key';
    });
  });

  /**
   * Test Group 8: Reference Image Fetching
   */
  describe('Reference Image Fetching', () => {
    it('should include base reference images in Replicate call', async () => {
      // Arrange: Cache miss scenario
      mockSend
        .mockRejectedValueOnce({ name: 'NotFound' })
        .mockResolvedValueOnce({});

      mockReplicateRun.mockResolvedValue({
        url: () => 'https://replicate.delivery/test.png'
      });

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from('test'))
      });

      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron'],
        styleIds: ['normal']
      };

      // Act
      await imageGenerationService.generateComboImage(request);

      // Assert: Verify Replicate called with reference images
      expect(mockReplicateRun).toHaveBeenCalledWith(
        'google/nano-banana',
        expect.objectContaining({
          input: expect.objectContaining({
            image_input: expect.arrayContaining([
              expect.stringContaining('image-refs/fantasy-weapon-1.png')
            ])
          })
        })
      );

      // Should have at least 10 base reference images
      const replicateCall = mockReplicateRun.mock.calls[0];
      const imageInput = replicateCall[1].input.image_input;
      expect(imageInput.length).toBeGreaterThanOrEqual(10);
    });

    it('should attempt to find specific material reference images', async () => {
      // This test verifies the service tries to fetch material-specific images
      // but gracefully continues if they don't exist

      // Arrange: Cache miss, material reference miss
      mockSend
        .mockRejectedValueOnce({ name: 'NotFound' }) // Cache miss
        .mockRejectedValueOnce({ name: 'NotFound' }) // Material ref miss
        .mockResolvedValueOnce({}); // Upload success

      mockReplicateRun.mockResolvedValue({
        url: () => 'https://replicate.delivery/test.png'
      });

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from('test'))
      });

      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron'],
        styleIds: ['normal']
      };

      // Act
      await imageGenerationService.generateComboImage(request);

      // Assert: Should still proceed despite missing material references
      expect(mockReplicateRun).toHaveBeenCalled();

      // Should have attempted to check for material reference
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Key: 'materials/iron.png'
          })
        })
      );
    });
  });

  /**
   * Test Group 9: Provider Selection
   */
  describe('Provider Selection', () => {
    it('should use gemini provider by default', async () => {
      // Arrange
      mockSend
        .mockRejectedValueOnce({ name: 'NotFound' })
        .mockResolvedValueOnce({});

      mockReplicateRun.mockResolvedValue({
        url: () => 'https://replicate.delivery/test.png'
      });

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from('test'))
      });

      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron'],
        styleIds: ['normal']
      };

      // Act
      await imageGenerationService.generateComboImage(request);

      // Assert: Should use google/nano-banana model
      expect(mockReplicateRun).toHaveBeenCalledWith(
        'google/nano-banana',
        expect.any(Object)
      );
    });

    it('should handle different response formats from providers', async () => {
      // Arrange: Test array response format
      mockSend
        .mockRejectedValueOnce({ name: 'NotFound' })
        .mockResolvedValueOnce({});

      mockReplicateRun.mockResolvedValue([
        { url: () => 'https://replicate.delivery/test.png' }
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from('test'))
      });

      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron'],
        styleIds: ['normal']
      };

      // Act
      const result = await imageGenerationService.generateComboImage(request);

      // Assert: Should handle array format correctly
      expect(result).toContain('.png');
      expect(mockFetch).toHaveBeenCalledWith('https://replicate.delivery/test.png');
    });
  });

  /**
   * Test Group 10: Edge Cases and Error Recovery
   */
  describe('Edge Cases and Error Recovery', () => {
    it('should handle malformed Replicate responses', async () => {
      // Arrange
      mockSend.mockRejectedValueOnce({ name: 'NotFound' });
      mockReplicateRun.mockReset().mockResolvedValue(null); // Malformed response

      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron'],
        styleIds: ['normal']
      };

      // Act & Assert
      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow(ExternalServiceError);

      await expect(
        imageGenerationService.generateComboImage(request)
      ).rejects.toThrow('No image returned from Replicate API');
    }, 5000);

    it('should normalize item type slug for filename generation', async () => {
      // Arrange: Item type with spaces and special characters
      mockItemRepository.findItemTypeById.mockResolvedValue({
        id: 'item-type-123',
        name: 'Magic Wand of Power!!!',
        slug: 'magic_wand_of_power',
        description: 'A powerful wand'
      });

      mockSend.mockResolvedValueOnce({}); // Cache hit

      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron'],
        styleIds: ['normal'],
        comboHash: 'test123'
      };

      // Act
      const result = await imageGenerationService.generateComboImage(request);

      // Assert: Should use normalized slug in path
      expect(result).toBe('https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items-crafted/magic_wand_of_power/test123.png');
    });

    it('should handle very large image buffers', async () => {
      // Arrange: Large image buffer (>10MB)
      const largeBuffer = Buffer.alloc(12 * 1024 * 1024, 'a'); // 12MB
      mockSend
        .mockRejectedValueOnce({ name: 'NotFound' })
        .mockResolvedValueOnce({});

      mockReplicateRun.mockResolvedValue({
        url: () => 'https://replicate.delivery/large.png'
      });

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(largeBuffer)
      });

      const request = {
        itemTypeId: 'item-type-123',
        materialIds: ['iron'],
        styleIds: ['normal']
      };

      // Act & Assert: Should not throw, but handle large buffer
      const result = await imageGenerationService.generateComboImage(request);
      expect(result).toContain('.png');

      // Verify large buffer was uploaded
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Body: largeBuffer
          })
        })
      );
    });
  });
});