/**
 * Configuration for multi-style asset generation
 */

import * as fs from 'fs';
import * as path from 'path';

export interface StyleConfig {
  name: string;
  style_id: string; // UUID from styledefinitions table
  display_name: string;
  reference_images: string[];
  prompt_template: (assetType: string, aiDescription: string) => string;
}

export const STYLE_CONFIGS: StyleConfig[] = [
  {
    name: 'rubberhose',
    style_id: 'c0d99a3c-6708-4796-93ff-f21fa7b3441d', // Existing "Normal" style
    display_name: 'Rubberhose',
    reference_images: [
      'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/cuphead-rubberhouse/base-cuphead-rubberhouse.png',
    ],
    prompt_template: (type, aiDesc) =>
      `Using the same style as the images attached, create a new asset. The new asset is a ${type}: ${aiDesc}. The design of the asset MUST be new, but in the same universe. Background should be white. You MUST use the style of the images attached. Copy the exactly look and feel.`,
  },
  {
    name: 'chibi',
    style_id: '48465038-c30f-46dc-ad0e-9c7a138cdeeb',
    display_name: 'Chibi',
    reference_images: [
      'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/chibi/Screenshot%202025-10-19%20at%2018.16.20.png',
    ],
    prompt_template: (type, aiDesc) =>
      `Using the same style as the images attached, create a new asset. The new asset is a ${type}: ${aiDesc}. The design of the asset MUST be new, but in the same universe. Background should be white. You MUST use the style of the images attached. Copy the exactly look and feel.`,
  },
  {
    name: 'pixel',
    style_id: 'dd8217d8-e1ea-4184-8f99-cef0d03becf7', // Existing "Pixel Art" style
    display_name: 'Pixel Art',
    reference_images: [
      'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/pixel/cloud-pixel.png',
    ],
    prompt_template: (type, aiDesc) =>
      `Using the same style as the images attached, create a new asset. The new asset is a ${type}: ${aiDesc}. The design of the asset MUST be new, but in the same universe. Background should be white. You MUST use the style of the images attached. Copy the exactly look and feel.`,
  },
];

/**
 * Input file definitions for new assets
 */
export interface InputMaterial {
  name: string;
  description: string;
  style: string; // 'rubberhose', 'chibi', 'pixel'
}

export interface InputItem {
  name: string;
  description: string;
  category: string;
  base_stats_normalized?: {
    atkPower: number;
    atkAccuracy: number;
    defPower: number;
    defAccuracy: number;
  }; // Must sum to 1.0, defaults to balanced 0.25 each
  // Items always use rubberhose style - no style field needed
}

export interface InputLocation {
  name: string;
  description: string;
  style: string; // 'rubberhose', 'chibi', 'pixel'
}

export interface InputUIIcon {
  name: string;
  description: string;
  style: string; // 'rubberhose', 'chibi', 'pixel'
}

/**
 * Load input files for new asset creation
 */
export function loadInputMaterials(): InputMaterial[] {
  const filePath = path.join(__dirname, 'input', 'materials.json');
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function loadInputItems(): InputItem[] {
  const filePath = path.join(__dirname, 'input', 'items.json');
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function loadInputLocations(): InputLocation[] {
  const filePath = path.join(__dirname, 'input', 'locations.json');
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function loadInputUIIcons(): InputUIIcon[] {
  const filePath = path.join(__dirname, 'input', 'ui-icons.json');
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * UI Icon definition (LEGACY - for backward compatibility)
 */
export interface UIIcon {
  name: string;
  description: string;
}

/**
 * Load UI Icons from JSON file (LEGACY - kept for backward compatibility)
 */
export function loadUIIcons(): UIIcon[] {
  const iconPath = path.join(__dirname, 'ui-icons.json');
  const content = fs.readFileSync(iconPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Stat generation prompt for materials
 */
export const MATERIAL_STAT_GENERATION_PROMPT = (materialName: string, description: string) => `
You are a game designer. Generate balanced stat modifiers for a crafting material called "${materialName}".

Description: ${description}

Generate a JSON object with these exact keys:
- atkPower: number (attack power modifier, range -0.2 to 0.2)
- atkAccuracy: number (attack accuracy modifier, range -0.2 to 0.2)
- defPower: number (defense power modifier, range -0.2 to 0.2)
- defAccuracy: number (defense accuracy modifier, range -0.2 to 0.2)

Rules:
1. The sum of all four values MUST equal exactly 0 (zero-sum constraint)
2. Values should be balanced - if one stat is high positive, others should be lower or negative
3. Modifiers should make thematic sense (e.g., "Dragon Scale" might boost defense but reduce accuracy)
4. Use increments of 0.05 for clarity
5. Return ONLY valid JSON, no explanation

Example format:
{"atkPower":0.1,"atkAccuracy":0.05,"defPower":-0.1,"defAccuracy":-0.05}
`;

/**
 * Asset types to generate
 */
export type AssetType = 'materials' | 'items' | 'ui-icons';

export const ASSET_TYPES: AssetType[] = ['materials', 'items', 'ui-icons'];
