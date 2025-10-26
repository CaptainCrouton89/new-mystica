/**
 * Chibi Style
 *
 * Polished, high-detail "chibi"/super-deformed aesthetic typical of
 * mobile RPGs and CCGs. Features vivid colors, bold outlines, and
 * strong silhouettes.
 */

import { Style, StyleConfig, StylePromptBuilder } from './types';

const config: StyleConfig = {
  name: 'chibi',
  displayName: 'Chibi/Super-Deformed',
  description: 'Polished, high-detail mobile RPG/CCG aesthetic with vivid colors and bold outlines',

  // Reference images for chibi style
  referenceImages: [
    'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/chibi/Screenshot%202025-10-19%20at%2018.16.20.png'
  ],

  model: 'google/nano-banana',

  params: {
    aspectRatio: '1:1',
    outputFormat: 'png'
  }
};

const prompts: StylePromptBuilder = {
  buildItemPrompt(name: string, description: string): string {
    return `Create a single, center-framed 1:1 game item:

"${name}: ${description}"

This illustration in a polished, high-detail "chibi"/super-deformed aesthetic typical of mobile RPGs and CCGs.

Core Look
    •    Color: Vivid, high-saturation palette; punchy local colors with clean hue separation. Keep values readable; avoid muddy midtones.
    •    Lighting: Clear, consistent key light with crisp fill; controlled shadows for depth. Add a strong rim light to separate from the background.
    •    Glow & Highlights: MINIMAL outer glow/halo (very subtle and sparse). Use tight, glossy specular highlights on hard materials; soft bloom on emissive parts only where essential.
    •    Border: Bold black outline ONLY around the object itself—NOT around the image edge. This outline defines the subject's silhouette for strong separation.

Line & Form
    •    Outlines: Bold, uniform black border carving a strong silhouette around the SUBJECT ONLY; no sketchy linework. No frame or border around the image edge.
    •    Proportions: Chunky, simplified, and slightly exaggerated shapes for instant readability and strong silhouette.
    •    Texture: Suggestive, not photoreal—hint at materials (wood grain, brushed metal, facets) with tidy, deliberate marks. Avoid excessive texture detail.
    •    Simplicity: Keep the object itself straightforward—no unnecessary gems, ornaments, extra decorative elements, or overly complex details. Stylized over realistic.

Shading & Depth
    •    Render Style: Hybrid cel + soft gradients; sharp edge transitions only where they improve clarity.
    •    Volume: Strong sense of 3D mass via light, occlusion, and controlled contrast; default to a subtle 3/4 view for maximum silhouette clarity.

Composition & Background (ITEM)
    •    Framing: Single hero weapon/tool/equipment, perfectly centered and clearly visible at optimal scale; crop to emphasize strong silhouette.
    •    Background: SIMPLE solid color OR clean radial/linear gradient ONLY. Choose complementary colors that make the item pop. NO patterns, NO scenes, NO textures, NO environmental elements.
    •    Sparkles/Particles: MINIMAL and SPARSE—if used at all, keep to 3-5 small white sparkles maximum. Avoid heavy particle effects.
    •    Shadow: Soft contact shadow directly beneath item only (no complex shadow effects).
    •    Border: Bold black outline around SUBJECT ONLY—absolutely NO border or frame around the image edge itself.
    •    Restrictions: NO environmental backgrounds, NO busy backgrounds, NO props, NO decorative frames, NO black borders around image edge, NO text, NO watermarks, NO logos, NO excessive glow effects.`;
  },

  buildMaterialPrompt(name: string, description: string): string {
    return `Create a single, center-framed 1:1 material:

"${name}: ${description}"

This illustration in a polished, high-detail "chibi"/super-deformed aesthetic typical of mobile RPGs and CCGs.

Core Look
    •    Color: Vivid, high-saturation palette; punchy local colors with clean hue separation. Keep values readable; avoid muddy midtones.
    •    Lighting: Clear, consistent key light with crisp fill; controlled shadows for depth. Add a strong rim light to separate from the background.
    •    Glow & Highlights: MINIMAL outer glow/halo (very subtle and sparse). Use tight, glossy specular highlights on hard materials; soft bloom on emissive parts only where essential.
    •    Border: Bold black outline ONLY around the object itself—NOT around the image edge. This outline defines the subject's silhouette for strong separation.

Line & Form
    •    Outlines: Bold, uniform black border carving a strong silhouette around the SUBJECT ONLY; no sketchy linework. No frame or border around the image edge.
    •    Proportions: Chunky, simplified, and slightly exaggerated shapes for instant readability and strong silhouette.
    •    Texture: Suggestive, not photoreal—hint at materials (wood grain, brushed metal, facets) with tidy, deliberate marks. Avoid excessive texture detail.
    •    Simplicity: Keep the object itself straightforward—no unnecessary gems, ornaments, extra decorative elements, or overly complex details. Stylized over realistic.

Shading & Depth
    •    Render Style: Hybrid cel + soft gradients; sharp edge transitions only where they improve clarity.
    •    Volume: Strong sense of 3D mass via light, occlusion, and controlled contrast; default to a subtle 3/4 view for maximum silhouette clarity.

Composition & Background (MATERIAL)
    •    Framing: Single material/resource, perfectly centered at optimal scale—present as appropriate for the material type:
         - Physical substances: loose pile, collection, or in simple container (jar/pouch/bag)
         - Solid objects: single centered object (button, coin, shell, etc.)
         - Energy/abstract: manifestation/representation of the phenomenon (flame, lightning, star, etc.)
         - Conceptual: iconic visual representation maintaining recognizable form
    •    Background: SIMPLE solid color OR clean radial/linear gradient ONLY. Choose complementary colors that enhance the material. NO patterns, NO scenes, NO textures, NO environmental elements.
    •    Sparkles/Particles: MINIMAL and SPARSE—if used at all, keep to 3-5 small white sparkles maximum. Avoid heavy particle effects.
    •    Shadow: Soft contact shadow directly beneath material only where applicable (no complex shadow effects).
    •    Border: Bold black outline around SUBJECT ONLY—absolutely NO border or frame around the image edge itself.
    •    Restrictions: NO environmental backgrounds, NO busy backgrounds, NO props, NO decorative frames, NO black borders around image edge, NO text, NO watermarks, NO logos, NO excessive glow effects.`;
  },

  buildLandscapePrompt(description: string, aspectRatio: string): string {
    return `Create a game background scene:

"${description}"

This illustration in a polished, high-detail "chibi"/super-deformed aesthetic typical of mobile RPGs and CCGs.

Core Look
    •    Color: Vivid, high-saturation palette; punchy local colors with clean hue separation. Keep values readable; avoid muddy midtones.
    •    Lighting: Clear atmospheric lighting with natural sky gradients. Warm or cool color temperature appropriate to the scene.
    •    Glow & Highlights: Atmospheric depth with subtle haze, fog, or distance fading. Controlled bloom on light sources (sun, magical effects).
    •    Depth: Clear foreground, midground, and background layers. Use atmospheric perspective for distance.

Line & Form
    •    Outlines: Bold, uniform black borders around major elements and structures for strong silhouette separation.
    •    Proportions: Slightly stylized, chunky architecture and terrain features for instant readability.
    •    Texture: Suggestive environmental textures (stone, sand, wood, water) with tidy, deliberate marks. Avoid excessive detail.
    •    Simplicity: Clear, readable landscape elements. Avoid clutter or overly complex details.

Shading & Depth
    •    Render Style: Hybrid cel + soft gradients; atmospheric blending for distance.
    •    Volume: Strong sense of depth via layering, atmospheric perspective, and controlled contrast.
    •    Environment: Natural or magical lighting appropriate to setting (daylight, dusk, moonlight, magical glow).

Composition & Background
    •    Framing: Full bleed edge-to-edge composition, clear horizon line or depth recession.
    •    Background: Fully rendered environment scene - sky, terrain, structures, vegetation as appropriate.
    •    Atmosphere: Use atmospheric effects (haze, fog, dust, particles) to enhance depth and mood.
    •    Scale: Include environmental elements at varying scales to establish depth and grandeur.

CRITICAL BORDER RULES:
    •    Bold black outlines around MAJOR STRUCTURES AND OBJECTS ONLY (buildings, rocks, trees, etc.)
    •    ABSOLUTELY NO BORDER, FRAME, OR BLACK LINE AROUND THE OUTER EDGE OF THE IMAGE
    •    The image must extend fully to all edges without any surrounding border
    •    Do NOT add any decorative frame or picture border
    •    Full bleed composition only - content goes edge-to-edge

Restrictions: NO text, NO watermarks, NO logos, NO UI elements, NO outer image border/frame, NO characters unless part of distant scenery.

Style: Mobile RPG/CCG background art - vibrant, stylized, optimized for gameplay visibility with clear depth layers.`;
  },

  buildArbitraryPrompt(description: string): string {
    return `Create a single, center-framed 1:1 game asset:

"${description}"

This illustration in a polished, high-detail "chibi"/super-deformed aesthetic typical of mobile RPGs and CCGs.

Core Look
    •    Color: Vivid, high-saturation palette; punchy local colors with clean hue separation. Keep values readable; avoid muddy midtones.
    •    Lighting: Clear, consistent key light with crisp fill; controlled shadows for depth. Add a strong rim light to separate from the background.
    •    Glow & Highlights: MINIMAL outer glow/halo (very subtle and sparse). Use tight, glossy specular highlights on hard materials; soft bloom on emissive parts only where essential.
    •    Border: Bold black outline ONLY around the object itself—NOT around the image edge. This outline defines the subject's silhouette for strong separation.

Line & Form
    •    Outlines: Bold, uniform black border carving a strong silhouette around the SUBJECT ONLY; no sketchy linework. No frame or border around the image edge.
    •    Proportions: Chunky, simplified, and slightly exaggerated shapes for instant readability and strong silhouette.
    •    Texture: Suggestive, not photoreal—hint at materials (wood grain, brushed metal, facets) with tidy, deliberate marks. Avoid excessive texture detail.
    •    Simplicity: Keep the object itself straightforward—no unnecessary gems, ornaments, extra decorative elements, or overly complex details. Stylized over realistic.

Shading & Depth
    •    Render Style: Hybrid cel + soft gradients; sharp edge transitions only where they improve clarity.
    •    Volume: Strong sense of 3D mass via light, occlusion, and controlled contrast; default to a subtle 3/4 view for maximum silhouette clarity.

Composition & Background
    •    Framing: Single hero object, perfectly centered and clearly visible at optimal scale; crop to emphasize strong silhouette.
    •    Background: SIMPLE solid color OR clean radial/linear gradient ONLY. Choose complementary colors that make the object pop. NO patterns, NO scenes, NO textures, NO environmental elements.
    •    Sparkles/Particles: MINIMAL and SPARSE—if used at all, keep to 3-5 small white sparkles maximum. Avoid heavy particle effects.
    •    Shadow: Soft contact shadow directly beneath object only (no complex shadow effects).
    •    Border: Bold black outline around SUBJECT ONLY—absolutely NO border or frame around the image edge itself.
    •    Restrictions: NO environmental backgrounds, NO busy backgrounds, NO props, NO decorative frames, NO black borders around image edge, NO text, NO watermarks, NO logos, NO excessive glow effects.`;
  }
};

export const chibiStyle: Style = {
  config,
  prompts
};
