/**
 * Style System Type Definitions
 *
 * This file defines the interfaces and types for the modular style system.
 * Each style (chibi, pixel-8bit, etc.) implements these interfaces.
 */

export type StyleName = 'rubberhose' | 'chibi' | 'pixel-8bit' | string;

/**
 * Style configuration containing metadata and settings
 */
export interface StyleConfig {
  /** Internal style identifier (kebab-case) */
  name: StyleName;

  /** Human-readable display name */
  displayName: string;

  /** Brief description of the style */
  description: string;

  /** Reference image URLs for this style */
  referenceImages: string[];

  /** Replicate model to use (can be style-specific) */
  model?: string;

  /** Style-specific parameters */
  params?: {
    aspectRatio?: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
    outputFormat?: 'jpg' | 'png';
    [key: string]: any;
  };
}

/**
 * Prompt builder interface for different asset types
 * Each style must implement all prompt builders
 */
export interface StylePromptBuilder {
  /**
   * Build prompt for item generation
   * @param name - Item name
   * @param description - Item description
   * @returns Complete prompt for image generation
   */
  buildItemPrompt(name: string, description: string): string;

  /**
   * Build prompt for material generation
   * @param name - Material name
   * @param description - Material description
   * @returns Complete prompt for image generation
   */
  buildMaterialPrompt(name: string, description: string): string;

  /**
   * Build prompt for landscape/background generation
   * @param description - Landscape description
   * @param aspectRatio - Aspect ratio for the landscape
   * @returns Complete prompt for image generation
   */
  buildLandscapePrompt(description: string, aspectRatio: string): string;

  /**
   * Build prompt for arbitrary asset generation
   * @param description - Asset description
   * @returns Complete prompt for image generation
   */
  buildArbitraryPrompt(description: string): string;
}

/**
 * Complete style definition
 */
export interface Style {
  config: StyleConfig;
  prompts: StylePromptBuilder;
}
