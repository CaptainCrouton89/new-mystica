/**
 * Pixel 8bit Style
 *
 * Retro pixel art aesthetic inspired by 8-bit and 16-bit era games.
 * Features limited color palettes, visible pixels, and no anti-aliasing.
 */

import { Style, StyleConfig, StylePromptBuilder } from './types';

const config: StyleConfig = {
  name: 'pixel-8bit',
  displayName: '8bit/Pixel Art',
  description: 'Retro pixel art aesthetic inspired by 8-bit and 16-bit era games (SNES, Genesis, NES)',

  // Reference images for pixel art style
  referenceImages: [
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/pixel/cloud-pixel.png'
  ],

  model: 'google/nano-banana',

  params: {
    aspectRatio: '1:1',
    outputFormat: 'png'
  }
};

const prompts: StylePromptBuilder = {
  buildItemPrompt(name: string, description: string): string {
    return `Create a single, center-framed 1:1 pixel art game item:

"${name}: ${description}"

This illustration in authentic 8-bit/16-bit pixel art style from classic retro games.

Pixel Art Fundamentals
    •    Resolution: Low-resolution pixel grid, clearly visible individual pixels (16x16 to 64x64 effective detail)
    •    Color Palette: Limited color palette (16-32 colors max), inspired by NES/SNES/Game Boy era
    •    Anti-aliasing: NO anti-aliasing - clean, hard pixel edges only
    •    Dithering: Use dithering patterns for gradients and texture (checkerboard, ordered patterns)
    •    Pixel Precision: Every pixel placed deliberately, no smooth gradients or blurs

Pixel Technique
    •    Outlines: 1-2 pixel dark outline around object for strong silhouette
    •    Shading: Cel-shaded with 2-4 shade levels per color maximum (base, shadow, highlight)
    •    Highlights: Single-pixel or small cluster highlights on reflective surfaces
    •    Proportions: Simplified iconic shapes, clear readability even at small size
    •    Texture: Suggest materials with minimal pixel clusters and dithering patterns
    •    Curves: Use pixel stairstepping for curves, no smooth anti-aliased edges

Color & Light
    •    Palette: Vibrant but limited colors - pick 8-16 colors total for entire image
    •    Contrast: High contrast between light/shadow for readability
    •    Background: Solid color or simple 2-3 color gradient using palette colors
    •    Glow: NO modern glow effects - use lighter pixel halos (1-2 pixels wide) if needed
    •    Saturation: Bright, punchy colors typical of retro games

Composition (ITEM)
    •    Framing: Single centered object with clear pixel-perfect silhouette
    •    Scale: Medium detail level - 32x32 to 64x64 apparent size, readable but not overly complex
    •    Shadow: Simple 2-3 shade shadow beneath object using dithering
    •    Background: Solid color OR 2-tone gradient, NO patterns or textures
    •    Restrictions: NO smooth gradients, NO anti-aliasing, NO modern effects, NO blur, NO text, NO watermarks

Style Reference: Think The Legend of Zelda (SNES), Final Fantasy VI, Chrono Trigger, Super Metroid, Castlevania, Stardew Valley item sprites.

CRITICAL: This must look like it came from a 1990s 16-bit console game. Every pixel must be intentional and visible.`;
  },

  buildMaterialPrompt(name: string, description: string): string {
    return `Create a single, center-framed 1:1 pixel art material:

"${name}: ${description}"

This illustration in authentic 8-bit/16-bit pixel art style from classic retro games.

Pixel Art Fundamentals
    •    Resolution: Low-resolution pixel grid, clearly visible individual pixels (16x16 to 64x64 effective detail)
    •    Color Palette: Limited color palette (16-32 colors max), inspired by NES/SNES/Game Boy era
    •    Anti-aliasing: NO anti-aliasing - clean, hard pixel edges only
    •    Dithering: Use dithering patterns for texture and gradients (checkerboard, ordered patterns)
    •    Pixel Precision: Every pixel placed deliberately

Pixel Technique
    •    Outlines: 1-2 pixel dark outline around material
    •    Shading: Cel-shaded with 2-4 shade levels per color
    •    Texture: Suggest material properties with dithering and pixel patterns
    •    Proportions: Simplified shapes for instant recognition
    •    Presentation: Pile/jar/collection appropriate to material type

Composition (MATERIAL)
    •    Framing: Single centered material with pixel-perfect edges—present as appropriate for the material type:
         - Physical substances: loose pile, collection, or in simple pixel art container (jar/pouch)
         - Solid objects: single centered object with clear pixel outline
         - Energy/abstract: manifestation using simple pixel shapes (flame pixels, lightning pixels)
         - Conceptual: iconic pixel representation
    •    Scale: 32x32 to 64x64 apparent size
    •    Container: If in jar/pouch, use simple pixel art container with 1-2 pixel outlines
    •    Shadow: Simple dithered shadow beneath
    •    Background: Solid color or 2-tone gradient
    •    Restrictions: NO smooth gradients, NO anti-aliasing, NO modern effects

Style Reference: Retro RPG resource sprites (Earthbound, Dragon Quest, early Final Fantasy).

CRITICAL: Must look like classic 16-bit game resource sprite. Every pixel intentional and visible.`;
  },

  buildLandscapePrompt(description: string, aspectRatio: string): string {
    return `Create a pixel art background scene:

"${description}"

This illustration in authentic 8-bit/16-bit pixel art style from classic retro games.

Pixel Art Fundamentals
    •    Resolution: Low-res pixel grid with visible pixels
    •    Color Palette: Limited palette (32-64 colors max for complex scene)
    •    Anti-aliasing: NO anti-aliasing
    •    Dithering: Use for sky gradients, atmospheric effects
    •    Tile-Friendly: Design with repeatable patterns where appropriate

Environment Pixel Technique
    •    Layers: Clear foreground, midground, background separation using pixel layers
    •    Parallax-Ready: Design elements suitable for parallax scrolling
    •    Tiles: Use tile-like pixel patterns for ground, walls, repeated elements (8x8 or 16x16 tiles)
    •    Depth: Use color darkening for distance (atmospheric perspective with limited palette)
    •    Details: Simplified but recognizable landmarks using pixel clusters
    •    Outlines: 1-2 pixel dark lines for major structures

Composition (LANDSCAPE)
    •    Framing: Full scene, edge-to-edge pixel art
    •    Sky: Simple gradient using dithering patterns OR solid color with pixel clouds
    •    Horizon: Clear pixel-aligned horizon line
    •    Scale: Mix of detailed foreground pixels, simplified background
    •    Vegetation: Simple pixel trees, grass, rocks using minimal colors
    •    Architecture: Buildings/structures with clean pixel lines and tile-like patterns
    •    Restrictions: NO smooth gradients, NO anti-aliasing, NO modern lighting, NO blur

Style Reference: Chrono Trigger backgrounds, Final Fantasy VI scenes, Castlevania environments, Super Metroid areas, Secret of Mana landscapes.

CRITICAL: Must look like classic 16-bit game background. Tile-friendly design, every pixel visible and intentional.`;
  },

  buildArbitraryPrompt(description: string): string {
    return `Create a single, center-framed 1:1 pixel art asset:

"${description}"

Authentic 8-bit/16-bit pixel art style from classic retro games.

Pixel Art Rules:
    •    Visible individual pixels (no anti-aliasing)
    •    Limited color palette (16-32 colors)
    •    Cel shading (2-4 shade levels)
    •    1-2 pixel outlines
    •    Dithering for gradients
    •    32x32 to 64x64 apparent detail
    •    Solid or simple gradient background
    •    High contrast for readability

Composition:
    •    Single centered object
    •    Clear pixel-perfect silhouette
    •    Simple pixel shadow beneath
    •    Solid color or 2-tone gradient background

Restrictions: NO smooth gradients, NO anti-aliasing, NO modern effects, NO blur, NO text.

Style: SNES/Genesis era sprite art. Think Final Fantasy VI, Chrono Trigger, Castlevania item sprites.`;
  }
};

export const pixel8bitStyle: Style = {
  config,
  prompts
};
