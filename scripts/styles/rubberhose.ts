/**
 * Rubberhose Style (Default)
 *
 * 1930s rubber hose animation style inspired by Cuphead, early Disney,
 * and Fleischer Studios. Characterized by thick black outlines, vintage
 * color palettes, and cel-shaded simplicity.
 */

import { Style, StyleConfig, StylePromptBuilder } from './types';

const config: StyleConfig = {
  name: 'rubberhose',
  displayName: '1930s Rubber Hose',
  description: 'Vintage cartoon style inspired by Cuphead, Fleischer Studios, and 1930s animation',

  // Reference images for rubberhose style
  referenceImages: [
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/cuphead-rubberhouse/base-cuphead-rubberhouse.png'
  ],

  model: 'google/nano-banana',

  params: {
    aspectRatio: '1:1',
    outputFormat: 'png'
  }
};

const prompts: StylePromptBuilder = {
  buildItemPrompt(name: string, description: string): string {
    return `Create a single, center-framed 1:1 game item in the distinctive 1930s rubber hose animation style:

"${name}: ${description}"

This illustration must capture the authentic Cuphead aesthetic with vintage Disney cartoon characteristics.

Core Look (1930s Rubber Hose Style)
    •    Color: Vintage color palette with muted, sepia-tinted tones; warm yellows, oranges, and browns. Avoid modern neon colors.
    •    Lighting: Soft, diffused lighting with gentle shadows. No harsh contrasts or modern lighting effects.
    •    Glow & Highlights: NO outer glow or modern effects. Use subtle highlights only where natural light would hit.
    •    Border: Thick, bold black outlines around ALL elements—this is the defining characteristic of rubber hose animation.

Line & Form (Rubber Hose Animation)
    •    Outlines: Thick, uniform black lines (3-5px thick) around EVERY element. No thin lines or sketchy linework.
    •    Proportions: Classic cartoon proportions with exaggerated features for maximum charm and readability.
    •    Texture: Minimal texture detail. Focus on clean, simple shapes with smooth surfaces.
    •    Simplicity: Keep designs simple and iconic. Avoid complex details or modern elements.

Shading & Depth (Cel Animation Style)
    •    Render Style: Pure cel shading with flat colors and sharp shadow transitions. NO gradients or soft shading.
    •    Volume: Simple 2D appearance with minimal depth. Use basic shadow shapes for volume indication.
    •    Shadows: Simple, geometric shadow shapes in darker versions of base colors.

Composition & Background (ITEM)
    •    Framing: Single hero weapon/tool/equipment, perfectly centered and clearly visible at optimal scale.
    •    Background: Simple solid color background in vintage tones (cream, light yellow, or soft brown). NO patterns or textures.
    •    Sparkles/Particles: NO modern particle effects. If sparkles are needed, use simple star shapes in vintage colors.
    •    Shadow: Simple geometric shadow beneath object in darker tone of background color.
    •    Border: Thick black outline around SUBJECT ONLY—absolutely NO border or frame around the image edge itself.
    •    Restrictions: NO modern elements, NO gradients, NO complex lighting, NO realistic textures, NO environmental backgrounds, NO text, NO watermarks, NO logos.

Style References: Think Cuphead, early Disney cartoons (1920s-1930s), Fleischer Studios, rubber hose animation era.`;
  },

  buildMaterialPrompt(name: string, description: string): string {
    return `Create a single, center-framed 1:1 material in the distinctive 1930s rubber hose animation style:

"${name}: ${description}"

This illustration must capture the authentic Cuphead aesthetic with vintage Disney cartoon characteristics.

Core Look (1930s Rubber Hose Style)
    •    Color: Vintage color palette with muted, sepia-tinted tones; warm yellows, oranges, and browns. Avoid modern neon colors.
    •    Lighting: Soft, diffused lighting with gentle shadows. No harsh contrasts or modern lighting effects.
    •    Glow & Highlights: NO outer glow or modern effects. Use subtle highlights only where natural light would hit.
    •    Border: Thick, bold black outlines around ALL elements—this is the defining characteristic of rubber hose animation.

Line & Form (Rubber Hose Animation)
    •    Outlines: Thick, uniform black lines (3-5px thick) around EVERY element. No thin lines or sketchy linework.
    •    Proportions: Classic cartoon proportions with simple, chunky shapes.
    •    Texture: Minimal texture detail. Focus on clean, simple shapes with smooth surfaces.
    •    Simplicity: Keep designs simple and iconic. Avoid complex details or modern elements.

Shading & Depth (Cel Animation Style)
    •    Render Style: Pure cel shading with flat colors and sharp shadow transitions. NO gradients or soft shading.
    •    Volume: Simple 2D appearance with minimal depth. Use basic shadow shapes for volume indication.
    •    Shadows: Simple, geometric shadow shapes in darker versions of base colors.

Composition & Background (MATERIAL)
    •    Framing: Single material/resource, perfectly centered—present as appropriate for the material type:
         - Physical substances: loose pile, collection, or in simple vintage container (jar/pouch/bag with thick black outlines)
         - Solid objects: single centered object (button, coin, shell, etc. with thick black outlines)
         - Energy/abstract: manifestation using simple geometric shapes (flame, lightning, star)
         - Conceptual: iconic visual representation with vintage cartoon simplicity
    •    Background: Simple solid color background in vintage tones (cream, light yellow, or soft brown). NO patterns or textures.
    •    Sparkles/Particles: NO modern particle effects. If sparkles are needed, use simple star shapes in vintage colors.
    •    Shadow: Simple geometric shadow beneath material in darker tone of background color.
    •    Border: Thick black outline around SUBJECT ONLY—absolutely NO border or frame around the image edge itself.
    •    Restrictions: NO modern elements, NO gradients, NO complex lighting, NO realistic textures, NO environmental backgrounds, NO text, NO watermarks, NO logos.

Style References: Think Cuphead, early Disney cartoons (1920s-1930s), Fleischer Studios, rubber hose animation era.`;
  },

  buildLandscapePrompt(description: string, aspectRatio: string): string {
    return `Create a game background scene in the distinctive 1930s rubber hose animation style:

"${description}"

This illustration must capture the authentic Cuphead level aesthetic with vintage Disney cartoon characteristics.

Core Look (1930s Rubber Hose Style)
    •    Color: Vintage color palette with muted, sepia-tinted tones; warm yellows, oranges, browns, soft blues. Avoid modern neon colors.
    •    Lighting: Soft, diffused lighting with gentle atmospheric gradients using vintage colors only.
    •    Glow & Highlights: NO modern effects. Use subtle tone shifts for atmospheric depth.
    •    Outlines: Thick, bold black outlines around major environmental elements and structures.

Environmental Design (Vintage Cartoon)
    •    Outlines: Thick, uniform black lines (3-5px thick) around buildings, trees, rocks, and major elements.
    •    Proportions: Classic cartoon proportions—exaggerated, whimsical, and simplified shapes.
    •    Texture: Minimal texture detail. Focus on clean, simple shapes with smooth surfaces.
    •    Depth: Clear foreground, midground, background layers using simple overlapping shapes.

Shading & Depth (Cel Animation Style)
    •    Render Style: Pure cel shading with flat colors and sharp transitions. Minimal gradients (only in sky if needed).
    •    Volume: Simple 2D layered appearance. Use darker tones for distant elements (atmospheric perspective).
    •    Shadows: Simple, geometric shadow shapes in darker versions of base colors.

Composition & Background (LANDSCAPE)
    •    Framing: Full bleed edge-to-edge composition with clear depth layers.
    •    Sky: Simple gradient from lighter to darker vintage tones OR solid vintage color.
    •    Environment: Buildings, terrain, vegetation rendered with thick black outlines and flat vintage colors.
    •    Scale: Vary element sizes to establish depth—larger in foreground, smaller in background.
    •    Atmosphere: Use tone darkening for distance, NO modern blur or fog effects.

CRITICAL BORDER RULES:
    •    Thick black outlines around MAJOR STRUCTURES AND OBJECTS ONLY (buildings, rocks, trees, etc.)
    •    ABSOLUTELY NO BORDER, FRAME, OR BLACK LINE AROUND THE OUTER EDGE OF THE IMAGE
    •    The image must extend fully to all edges without any surrounding border
    •    Full bleed composition only - content goes edge-to-edge

Restrictions: NO modern elements, NO complex gradients, NO realistic textures, NO modern lighting effects, NO text, NO watermarks, NO logos, NO outer image border/frame.

Style References: Think Cuphead levels, early Disney backgrounds, Fleischer Studios environments, 1930s animation backdrops.`;
  },

  buildArbitraryPrompt(description: string): string {
    return `Create a single, center-framed 1:1 game asset in the distinctive 1930s rubber hose animation style:

"${description}"

This illustration must capture the authentic Cuphead aesthetic with vintage Disney cartoon characteristics.

Core Look (1930s Rubber Hose Style)
    •    Color: Vintage color palette with muted, sepia-tinted tones; warm yellows, oranges, and browns. Avoid modern neon colors.
    •    Lighting: Soft, diffused lighting with gentle shadows. No harsh contrasts or modern lighting effects.
    •    Glow & Highlights: NO outer glow or modern effects. Use subtle highlights only where natural light would hit.
    •    Border: Thick, bold black outlines around ALL elements—this is the defining characteristic of rubber hose animation.

Line & Form (Rubber Hose Animation)
    •    Outlines: Thick, uniform black lines (3-5px thick) around EVERY element. No thin lines or sketchy linework.
    •    Proportions: Classic cartoon proportions with exaggerated features for maximum charm and readability.
    •    Texture: Minimal texture detail. Focus on clean, simple shapes with smooth surfaces.
    •    Simplicity: Keep designs simple and iconic. Avoid complex details or modern elements.

Shading & Depth (Cel Animation Style)
    •    Render Style: Pure cel shading with flat colors and sharp shadow transitions. NO gradients or soft shading.
    •    Volume: Simple 2D appearance with minimal depth. Use basic shadow shapes for volume indication.
    •    Shadows: Simple, geometric shadow shapes in darker versions of base colors.

Composition & Background
    •    Framing: Single hero object, perfectly centered and clearly visible at optimal scale.
    •    Background: Simple solid color background in vintage tones (cream, light yellow, or soft brown). NO patterns or textures.
    •    Sparkles/Particles: NO modern particle effects. If sparkles are needed, use simple star shapes in vintage colors.
    •    Shadow: Simple geometric shadow beneath object in darker tone of background color.
    •    Border: Thick black outline around SUBJECT ONLY—absolutely NO border or frame around the image edge itself.
    •    Restrictions: NO modern elements, NO gradients, NO complex lighting, NO realistic textures, NO environmental backgrounds, NO text, NO watermarks, NO logos.

Style References: Think Cuphead, early Disney cartoons (1920s-1930s), Fleischer Studios, rubber hose animation era.`;
  }
};

export const rubberhoseStyle: Style = {
  config,
  prompts
};
