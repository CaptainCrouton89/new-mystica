/**
 * Unit Tests: NameDescriptionService
 *
 * Tests for AI-powered name and description generation service:
 * - Mock OpenAI SDK dependencies
 * - Test generation success and error scenarios
 * - Cover retry logic and validation
 * - Test environment validation
 */

import { NameDescriptionService } from '../../../src/services/NameDescriptionService.js';
import {
  ValidationError,
  ExternalServiceError,
  ConfigurationError
} from '../../../src/utils/errors.js';

// Mock the AI SDK modules BEFORE importing service
jest.mock('ai', () => ({
  generateObject: jest.fn()
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn((model: string) => ({ model }))
}));

// Mock the env config
jest.mock('../../../src/config/env.js', () => ({
  env: {
    OPENAI_API_KEY: 'test-openai-key'
  }
}));

// Get reference to mocked function after module is mocked
const { generateObject: mockGenerateObject } = jest.requireMock('ai');

// Mock setTimeout for retry logic to speed up tests
const originalSetTimeout = global.setTimeout;
const mockSetTimeout = jest.fn((fn: () => void, delay?: number) => {
  // Execute immediately for tests instead of waiting
  fn();
  return originalSetTimeout(() => {}, 0);
});
global.setTimeout = mockSetTimeout as any;

// Mock environment variables
const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    OPENAI_API_KEY: 'test-openai-key'
  };
});

afterAll(() => {
  process.env = originalEnv;
  global.setTimeout = originalSetTimeout;
});

describe('NameDescriptionService', () => {
  let nameDescriptionService: NameDescriptionService;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    mockGenerateObject.mockClear().mockReset();
    mockSetTimeout.mockClear();

    // Initialize service
    nameDescriptionService = new NameDescriptionService();
  });

  /**
   * Test Group 1: generateForItem() - Happy Path
   */
  describe('generateForItem() - Happy Path', () => {
    it('should successfully generate name and description for single material', async () => {
      // Arrange
      const mockResult = {
        name: 'Ironclad Wand',
        description: 'A sturdy magical wand forged from gleaming iron with intricate metallic patterns. The handle features geometric iron segments that pulse with arcane energy.'
      };

      mockGenerateObject.mockResolvedValue({
        object: mockResult
      });

      // Act
      const result = await nameDescriptionService.generateForItem(
        'Magic Wand',
        ['iron']
      );

      // Assert
      expect(result).toEqual(mockResult);
      expect(mockGenerateObject).toHaveBeenCalledWith({
        model: { model: 'gpt-4.1-mini' },
        schema: expect.any(Object), // Zod schema
        system: expect.stringContaining('You are an assistant for a crafting game'),
        prompt: 'Item: Magic Wand; Materials: iron'
      });
    });

    it('should successfully generate name and description for multiple materials', async () => {
      // Arrange
      const mockResult = {
        name: 'Crystal-Iron Blade',
        description: 'A magnificent sword with an iron core wrapped in crystalline formations that sparkle with magical energy. The blade seamlessly merges metallic strength with translucent crystal segments.'
      };

      mockGenerateObject.mockResolvedValue({
        object: mockResult
      });

      // Act
      const result = await nameDescriptionService.generateForItem(
        'Sword',
        ['iron', 'crystal', 'wood']
      );

      // Assert
      expect(result).toEqual(mockResult);
      expect(mockGenerateObject).toHaveBeenCalledWith({
        model: { model: 'gpt-4.1-mini' },
        schema: expect.any(Object),
        system: expect.stringContaining('You are an assistant for a crafting game'),
        prompt: 'Item: Sword; Materials: iron, crystal, wood'
      });
    });

    it('should handle styles parameter (optional)', async () => {
      // Arrange
      const mockResult = {
        name: 'Mystic Shield',
        description: 'A protective shield forged from enchanted crystal formations. The surface displays prismatic patterns that shift and shimmer with defensive magic.'
      };

      mockGenerateObject.mockResolvedValue({
        object: mockResult
      });

      // Act
      const result = await nameDescriptionService.generateForItem(
        'Shield',
        ['crystal'],
        ['mystical']
      );

      // Assert
      expect(result).toEqual(mockResult);
      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Item: Shield; Materials: crystal'
        })
      );
    });
  });

  /**
   * Test Group 2: generateForItem() - Validation Errors
   */
  describe('generateForItem() - Validation Errors', () => {
    it('should throw ValidationError when item type is empty', async () => {
      await expect(
        nameDescriptionService.generateForItem('', ['iron'])
      ).rejects.toThrow(ValidationError);

      await expect(
        nameDescriptionService.generateForItem('', ['iron'])
      ).rejects.toThrow('Item type is required and cannot be empty');
    });

    it('should throw ValidationError when item type is null/undefined', async () => {
      await expect(
        nameDescriptionService.generateForItem(null as any, ['iron'])
      ).rejects.toThrow(ValidationError);

      await expect(
        nameDescriptionService.generateForItem(undefined as any, ['iron'])
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when no materials provided', async () => {
      await expect(
        nameDescriptionService.generateForItem('Magic Wand', [])
      ).rejects.toThrow(ValidationError);

      await expect(
        nameDescriptionService.generateForItem('Magic Wand', [])
      ).rejects.toThrow('At least one material is required');
    });

    it('should throw ValidationError when materials is null/undefined', async () => {
      await expect(
        nameDescriptionService.generateForItem('Magic Wand', null as any)
      ).rejects.toThrow(ValidationError);

      await expect(
        nameDescriptionService.generateForItem('Magic Wand', undefined as any)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when more than 3 materials provided', async () => {
      await expect(
        nameDescriptionService.generateForItem('Magic Wand', ['iron', 'crystal', 'wood', 'fire'])
      ).rejects.toThrow(ValidationError);

      await expect(
        nameDescriptionService.generateForItem('Magic Wand', ['iron', 'crystal', 'wood', 'fire'])
      ).rejects.toThrow('Maximum of 3 materials allowed');
    });

    it('should throw ValidationError when material is empty string', async () => {
      await expect(
        nameDescriptionService.generateForItem('Magic Wand', ['iron', ''])
      ).rejects.toThrow(ValidationError);

      await expect(
        nameDescriptionService.generateForItem('Magic Wand', ['iron', ''])
      ).rejects.toThrow('All materials must be non-empty strings');
    });

    it('should throw ValidationError when material is only whitespace', async () => {
      await expect(
        nameDescriptionService.generateForItem('Magic Wand', ['iron', '   '])
      ).rejects.toThrow(ValidationError);

      await expect(
        nameDescriptionService.generateForItem('Magic Wand', ['iron', '   '])
      ).rejects.toThrow('All materials must be non-empty strings');
    });
  });

  /**
   * Test Group 3: generateForItem() - OpenAI API Failures & Retry Logic
   */
  describe('generateForItem() - OpenAI API Failures', () => {
    it('should throw ExternalServiceError when OpenAI API fails', async () => {
      // Arrange: Mock OpenAI failure
      mockGenerateObject.mockRejectedValue(new Error('OpenAI API unavailable'));

      // Act & Assert
      await expect(
        nameDescriptionService.generateForItem('Magic Wand', ['iron'])
      ).rejects.toThrow(ExternalServiceError);

      await expect(
        nameDescriptionService.generateForItem('Magic Wand', ['iron'])
      ).rejects.toThrow('Name/description generation failed after retries');
    });

    it('should retry on failure with progressive backoff', async () => {
      // Arrange: First two calls fail, third succeeds
      mockGenerateObject
        .mockRejectedValueOnce(new Error('API rate limit'))
        .mockRejectedValueOnce(new Error('API timeout'))
        .mockResolvedValueOnce({
          object: {
            name: 'Iron Wand',
            description: 'A metallic wand forged from iron. The surface gleams with polished metallic finish.'
          }
        });

      // Act
      const result = await nameDescriptionService.generateForItem('Magic Wand', ['iron']);

      // Assert
      expect(result.name).toBe('Iron Wand');
      expect(mockGenerateObject).toHaveBeenCalledTimes(3);

      // Verify retry delays were applied
      expect(mockSetTimeout).toHaveBeenCalledTimes(2);
      expect(mockSetTimeout).toHaveBeenNthCalledWith(1, expect.any(Function), 1000); // 1s delay
      expect(mockSetTimeout).toHaveBeenNthCalledWith(2, expect.any(Function), 2000); // 2s delay
    });

    it('should fail after maximum retries (3 attempts total)', async () => {
      // Arrange: All attempts fail
      mockGenerateObject.mockRejectedValue(new Error('Persistent API failure'));

      // Act & Assert
      await expect(
        nameDescriptionService.generateForItem('Magic Wand', ['iron'])
      ).rejects.toThrow(ExternalServiceError);

      // Verify exactly 3 attempts were made (1 + 2 retries)
      expect(mockGenerateObject).toHaveBeenCalledTimes(3);
      expect(mockSetTimeout).toHaveBeenCalledTimes(2); // 2 retry delays
    });

    it('should handle malformed OpenAI responses', async () => {
      // Arrange: Mock malformed response
      mockGenerateObject.mockResolvedValue({
        object: null // Invalid response
      });

      // Act
      const result = await nameDescriptionService.generateForItem('Magic Wand', ['iron']);

      // Assert: Should handle gracefully
      expect(result).toBeNull();
    });

    it('should handle network timeout errors specifically', async () => {
      // Arrange: Mock network timeout
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';
      mockGenerateObject.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(
        nameDescriptionService.generateForItem('Magic Wand', ['iron'])
      ).rejects.toThrow(ExternalServiceError);

      await expect(
        nameDescriptionService.generateForItem('Magic Wand', ['iron'])
      ).rejects.toThrow('Name/description generation failed after retries');
    });
  });

  /**
   * Test Group 4: Environment Validation
   */
  describe('Environment Validation', () => {
    it('should initialize successfully with valid OPENAI_API_KEY', () => {
      // Since our env is mocked to return a valid key, service should initialize
      expect(() => {
        new NameDescriptionService();
      }).not.toThrow();
    });
  });

  /**
   * Test Group 5: Prompt Building
   */
  describe('Prompt Building', () => {
    it('should build correct prompt for single material', async () => {
      // Arrange
      mockGenerateObject.mockResolvedValue({
        object: { name: 'Test', description: 'Test description.' }
      });

      // Act
      await nameDescriptionService.generateForItem('Magic Wand', ['iron']);

      // Assert
      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Item: Magic Wand; Materials: iron'
        })
      );
    });

    it('should build correct prompt for multiple materials', async () => {
      // Arrange
      mockGenerateObject.mockResolvedValue({
        object: { name: 'Test', description: 'Test description.' }
      });

      // Act
      await nameDescriptionService.generateForItem('Sword', ['iron', 'crystal', 'wood']);

      // Assert
      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Item: Sword; Materials: iron, crystal, wood'
        })
      );
    });

    it('should use correct OpenAI model', async () => {
      // Arrange
      mockGenerateObject.mockResolvedValue({
        object: { name: 'Test', description: 'Test description.' }
      });

      // Act
      await nameDescriptionService.generateForItem('Magic Wand', ['iron']);

      // Assert
      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: { model: 'gpt-4.1-mini' }
        })
      );
    });

    it('should include complete system prompt', async () => {
      // Arrange
      mockGenerateObject.mockResolvedValue({
        object: { name: 'Test', description: 'Test description.' }
      });

      // Act
      await nameDescriptionService.generateForItem('Magic Wand', ['iron']);

      // Assert
      const call = mockGenerateObject.mock.calls[0][0];
      expect(call.system).toContain('You are an assistant for a crafting game');
      expect(call.system).toContain('two-sentence description');
      expect(call.system).toContain('creative, fitting name');
      expect(call.system).toContain('**Deeply integrate the materials into the item\'s form itself**');
    });
  });

  /**
   * Test Group 6: Response Validation
   */
  describe('Response Validation', () => {
    it('should validate response has required name field', async () => {
      // Arrange
      mockGenerateObject.mockResolvedValue({
        object: {
          name: 'Iron Wand',
          description: 'A sturdy wand made of iron. The metallic surface gleams with magical power.'
        }
      });

      // Act
      const result = await nameDescriptionService.generateForItem('Magic Wand', ['iron']);

      // Assert
      expect(result).toHaveProperty('name');
      expect(typeof result.name).toBe('string');
      expect(result.name.length).toBeGreaterThan(0);
    });

    it('should validate response has required description field', async () => {
      // Arrange
      mockGenerateObject.mockResolvedValue({
        object: {
          name: 'Iron Wand',
          description: 'A sturdy wand made of iron. The metallic surface gleams with magical power.'
        }
      });

      // Act
      const result = await nameDescriptionService.generateForItem('Magic Wand', ['iron']);

      // Assert
      expect(result).toHaveProperty('description');
      expect(typeof result.description).toBe('string');
      expect(result.description.length).toBeGreaterThan(0);
    });

    it('should return exact object from OpenAI response', async () => {
      // Arrange
      const expectedResult = {
        name: 'Crystalline Staff',
        description: 'A translucent staff formed entirely from refined crystal formations that pulse with inner light. The crystalline structure creates prismatic patterns along its length.'
      };

      mockGenerateObject.mockResolvedValue({
        object: expectedResult
      });

      // Act
      const result = await nameDescriptionService.generateForItem('Staff', ['crystal']);

      // Assert
      expect(result).toEqual(expectedResult);
    });
  });

  /**
   * Test Group 7: Error Handling & Logging
   */
  describe('Error Handling & Logging', () => {
    it('should log generation attempts and timing', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockGenerateObject.mockResolvedValue({
        object: { name: 'Test', description: 'Test description.' }
      });

      // Act
      await nameDescriptionService.generateForItem('Magic Wand', ['iron']);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🤖 Generating name/description for Magic Wand with materials: iron')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/⏱️\s+Name\/description generated in \d+ms/)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Generated: "Test" - Test description.')
      );

      consoleSpy.mockRestore();
    });

    it('should log retry attempts with warnings', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockGenerateObject
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          object: { name: 'Test', description: 'Test description.' }
        });

      // Act
      await nameDescriptionService.generateForItem('Magic Wand', ['iron']);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Generation attempt 1 failed, retrying in 1000ms...')
      );

      consoleSpy.mockRestore();
    });

    it('should log detailed error information on final failure', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const apiError = new Error('Persistent API failure');
      mockGenerateObject.mockRejectedValue(apiError);

      // Act & Assert
      await expect(
        nameDescriptionService.generateForItem('Magic Wand', ['iron'])
      ).rejects.toThrow(ExternalServiceError);

      // Check that final error log was called
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Name/description generation failed after 3 attempts:'),
        expect.stringContaining('OpenAI API error: OpenAI generation failed')
      );

      consoleSpy.mockRestore();
    });
  });
});