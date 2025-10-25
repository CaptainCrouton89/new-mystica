import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { env } from '../config/env.js';
import {
  ValidationError,
  ExternalServiceError,
  ConfigurationError
} from '../utils/errors.js';

/**
 * Request interface for generateForItem method
 */
export interface GenerateNameDescriptionRequest {
  itemType: string;
  materials: string[];
  styles?: string[];
}

/**
 * Response interface for generated name and description
 */
export interface NameDescriptionResult {
  name: string;
  description: string;
}

/**
 * Zod schema for OpenAI response validation
 */
const itemDescriptionSchema = z.object({
  name: z.string().describe('A creative, fitting name for the item that reflects both its type and the provided materials'),
  description: z.string().describe('Exactly two sentences describing the physical appearance of the item, focused solely on visual features')
});

/**
 * System prompt for AI generation - ported from scripts/generate-item-description.ts
 */
const SYSTEM_PROMPT = `You are an assistant for a crafting game. For each request, you will receive the name of an item and one to three materials. Your task is two-fold: (1) write a two-sentence description of what the item looks like, focusing only on the item's physical content, and (2) invent a creative, fitting name for the item that reflects the combination of item and materials.

Your description should:
- Focus entirely on what the item looks like (e.g., shapes, parts, materials, arrangement).
- Avoid describing artistic style, lighting, or mood.
- Use clear and minimal language; do not add details beyond what the item and materials imply.
- Ensure the description is visual and straightforward—suitable for generating a slightly cartoonish game asset using an image generation model.
- **Deeply integrate the materials into the item's form itself**—the materials should transform or become the item's structure, not just be attached or placed on/in it. For example: a cactus blender should have the blender body shaped like a cactus with spines and segments, not cacti inside a normal blender; a Pepe sword should have a blade that is green and frog-like with bulging eyes as part of its form, not just Pepe's head as a hilt decoration.

Your name should:
- Be concise, evocative, and fitting for a fantasy or crafting game item.
- Clearly relate to both the item type and the provided materials.
- Avoid generic or purely literal names—use some creativity, but keep it appropriate for the materials and object.
- Be unique and not a real-world brand or copyrighted term.

Guidelines:
1. Interpret the item and its materials.
2. Reason about how the materials can fundamentally transform or become the item itself—think of fusion and metamorphosis, not decoration or containment.
3. Formulate a concise, purely visual two-sentence description focused only on physical features, components, and arrangement, emphasizing how the material's characteristics are embodied in the item's core structure.
4. Invent a suitable, imaginative name for the item that reflects both its type and the provided materials.
5. Do not mention style, background, action, or storytelling details.
6. Make the description slightly minimalistic, omitting embellishments or details not clearly derived from the item and materials.

Output both the invented name and the two-sentence physical description.`;

/**
 * Handles AI-powered name and description generation for crafted items
 * Uses OpenAI's GPT-4.1-mini model with structured output generation
 */
export class NameDescriptionService {
  // Environment configuration
  private readonly OPENAI_API_KEY = env.OPENAI_API_KEY;

  constructor() {
    // Validate environment credentials on instantiation
    this.validateEnvironmentCredentials();
  }

  /**
   * Generate name and description for an item with materials
   * Primary generation method following the ImageGenerationService pattern
   */
  async generateForItem(
    itemType: string,
    materials: string[],
    styles?: string[]
  ): Promise<NameDescriptionResult> {
    // Step 1: Validate inputs first
    this.validateRequest(itemType, materials);

    console.log(`🤖 Generating name/description for ${itemType} with materials: ${materials.join(', ')}`);

    // Step 2: Build prompt for AI generation
    const prompt = this.buildPrompt(itemType, materials);

    // Step 3: Generate with retry logic
    const startTime = Date.now();
    const result = await this.generateWithRetry(prompt);
    const generationTime = Date.now() - startTime;

    console.log(`⏱️  Name/description generated in ${generationTime}ms`);

    if (result && result.name && result.description) {
      console.log(`✅ Generated: "${result.name}" - ${result.description}`);
    } else {
      console.warn(`⚠️ Generated incomplete result:`, result);
    }

    return result;
  }

  /**
   * Validate request parameters
   */
  private validateRequest(itemType: string, materials: string[]): void {
    if (!itemType || itemType.trim().length === 0) {
      throw new ValidationError('Item type is required and cannot be empty');
    }

    if (!materials || materials.length === 0) {
      throw new ValidationError('At least one material is required');
    }

    if (materials.length > 3) {
      throw new ValidationError('Maximum of 3 materials allowed');
    }

    // Validate each material is not empty
    for (const material of materials) {
      if (!material || material.trim().length === 0) {
        throw new ValidationError('All materials must be non-empty strings');
      }
    }
  }

  /**
   * Build prompt for OpenAI generation
   */
  private buildPrompt(itemType: string, materials: string[]): string {
    const materialsText = materials.join(', ');
    return `Item: ${itemType}; Materials: ${materialsText}`;
  }

  /**
   * Generate with OpenAI API including retry logic
   */
  private async generateWithRetry(prompt: string, maxRetries = 2): Promise<NameDescriptionResult> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await this.generateWithOpenAI(prompt);
      } catch (error) {
        lastError = error as Error;

        if (attempt <= maxRetries) {
          const delay = attempt * 1000; // Progressive backoff: 1s, 2s
          console.warn(`🔄 Generation attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    const errorMessage = lastError?.message || 'Unknown error';
    console.error(`❌ Name/description generation failed after ${maxRetries + 1} attempts:`, errorMessage);
    throw new ExternalServiceError('Name/description generation failed after retries', lastError || new Error('Unknown error'));
  }

  /**
   * Core OpenAI API integration
   */
  private async generateWithOpenAI(prompt: string): Promise<NameDescriptionResult> {
    try {
      const { object } = await generateObject({
        model: openai('gpt-4.1-mini'),
        schema: itemDescriptionSchema,
        system: SYSTEM_PROMPT,
        prompt,
      });

      return object;
    } catch (error: any) {
      // Log specific error details for debugging
      console.error('OpenAI generation error:', {
        message: error.message,
        type: error.constructor.name,
        prompt: prompt.substring(0, 100) + '...'
      });

      throw new ExternalServiceError('OpenAI generation failed', error);
    }
  }

  /**
   * Validate environment credentials
   */
  private validateEnvironmentCredentials(): void {
    if (!env.OPENAI_API_KEY) {
      throw new ConfigurationError('OPENAI_API_KEY not configured');
    }
  }
}

/**
 * Singleton instance for easy import
 */
export const nameDescriptionService = new NameDescriptionService();