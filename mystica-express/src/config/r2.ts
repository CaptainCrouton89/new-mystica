import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { env } from './env.js';

/**
 * Cloudflare R2 client configuration
 * Compatible with AWS S3 SDK using R2 endpoint
 */
const r2Config = {
  region: 'auto', // R2 uses 'auto' region
  endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  // R2-specific configuration
  forcePathStyle: true, // Required for R2 compatibility
  signatureVersion: 'v4',
};

/**
 * R2 client instance for Cloudflare R2 storage operations
 *
 * Used for:
 * - AI-generated image storage (items/, materials/ directories)
 * - Image reference storage (image-refs/ directory)
 * - Asset management for game content
 *
 * @example
 * ```typescript
 * import { r2Client } from '@/config/r2';
 * import { PutObjectCommand } from '@aws-sdk/client-s3';
 *
 * const command = new PutObjectCommand({
 *   Bucket: env.R2_BUCKET_NAME,
 *   Key: 'items/magic_wand_crystal_wood.png',
 *   Body: imageBuffer,
 *   ContentType: 'image/png'
 * });
 *
 * await r2Client.send(command);
 * ```
 */
export const r2Client = new S3Client(r2Config);

/**
 * R2 bucket configuration
 */
export const R2_CONFIG = {
  BUCKET_NAME: env.R2_BUCKET_NAME,
  PUBLIC_URL: `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev`,
  DIRECTORIES: {
    ITEMS: 'items',
    MATERIALS: 'materials',
    IMAGE_REFS: 'image-refs',
    MONSTERS: 'monsters',
  } as const,
} as const;

/**
 * Generate public URL for R2 object
 * @param key - Object key in R2 bucket
 * @returns Public HTTPS URL
 */
export const getR2PublicUrl = (key: string): string => {
  return `${R2_CONFIG.PUBLIC_URL}/${key}`;
};

/**
 * Test R2 bucket connection
 * Verifies bucket access and permissions
 */
export const testR2Connection = async (): Promise<boolean> => {
  try {
    const command = new HeadBucketCommand({
      Bucket: env.R2_BUCKET_NAME,
    });

    await r2Client.send(command);

    if (env.NODE_ENV === 'development') {
      console.log(`✅ R2 bucket connection successful: ${env.R2_BUCKET_NAME}`);
    }
    return true;
  } catch (error) {
    console.error('❌ R2 bucket connection failed:', error);
    return false;
  }
};

/**
 * Helper function to construct R2 object keys
 */
export const buildR2Key = {
  item: (itemName: string): string =>
    `${R2_CONFIG.DIRECTORIES.ITEMS}/${itemName.toLowerCase().replace(/\s+/g, '_')}.png`,

  material: (materialName: string): string =>
    `${R2_CONFIG.DIRECTORIES.MATERIALS}/${materialName.toLowerCase().replace(/\s+/g, '_')}.png`,

  monster: (monsterName: string): string =>
    `${R2_CONFIG.DIRECTORIES.MONSTERS}/${monsterName.toLowerCase().replace(/\s+/g, '_')}.png`,

  imageRef: (filename: string): string =>
    `${R2_CONFIG.DIRECTORIES.IMAGE_REFS}/${filename}`,
} as const;

// Test connection on module load in development
if (env.NODE_ENV === 'development') {
  testR2Connection().catch(error => {
    console.warn('R2 connection test failed during startup:', error.message);
  });
}