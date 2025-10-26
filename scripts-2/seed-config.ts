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
    style_id: 'PLACEHOLDER_CHIBI_STYLE_ID', // TODO: Insert into styledefinitions and update
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
 * UI Icon definition
 */
export interface UIIcon {
  name: string;
  description: string;
}

/**
 * Load UI Icons from JSON file
 */
export function loadUIIcons(): UIIcon[] {
  const iconPath = path.join(__dirname, 'ui-icons.json');
  const content = fs.readFileSync(iconPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Asset types to generate
 */
export type AssetType = 'materials' | 'items' | 'locations' | 'ui-icons';

export const ASSET_TYPES: AssetType[] = ['materials', 'items', 'locations', 'ui-icons'];
