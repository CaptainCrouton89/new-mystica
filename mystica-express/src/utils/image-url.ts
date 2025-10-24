/**
 * Image URL generation utilities for R2 storage
 */

const R2_PUBLIC_URL = 'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev';

/**
 * Generate R2 URL for material image using snake_case naming convention
 * Materials are stored at: materials/{lowercase_name_with_underscores}.png
 */
export function getMaterialImageUrl(materialName: string): string {
  const normalizedName = materialName.toLowerCase().replace(/\s+/g, '_');
  return `${R2_PUBLIC_URL}/materials/${normalizedName}.png`;
}

/**
 * Generate R2 URL for item type image using snake_case naming convention
 * Items are stored at: items/{lowercase_name_with_underscores}.png
 */
export function getItemTypeImageUrl(itemTypeName: string): string {
  const normalizedName = itemTypeName.toLowerCase().replace(/\s+/g, '_');
  return `${R2_PUBLIC_URL}/items/${normalizedName}.png`;
}
