import * as dotenv from 'dotenv';
import * as path from 'path';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';

// Load environment variables from parent directory
dotenv.config({ path: path.join('..', '.env.local'), override: true });

const R2_CONFIG = {
  bucket: 'mystica-assets',
  publicUrl: 'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
};

interface R2ClientConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function createR2Client(): S3Client {
  const { accountId, accessKeyId, secretAccessKey } = R2_CONFIG;

  if (!accountId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID not found in .env.local');
  }

  if (!accessKeyId) {
    throw new Error('R2_ACCESS_KEY_ID not found in .env.local');
  }

  if (!secretAccessKey) {
    throw new Error('R2_SECRET_ACCESS_KEY not found in .env.local');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Normalize name to snake_case for R2 storage
 */
function normalizeNameForR2(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/**
 * Build R2 key for item, material, or monster
 */
function buildR2Key(name: string, type: 'item' | 'material' | 'monster', noBackground?: boolean): string {
  const normalized = normalizeNameForR2(name);
  let directory: string;

  if (type === 'item') {
    directory = 'items';
  } else if (type === 'material') {
    directory = 'materials';
  } else {
    directory = 'monsters';
  }

  if (noBackground) {
    directory = `${directory}/no-background`;
  }

  return `${directory}/${normalized}.png`;
}

/**
 * Build public URL for R2 object
 */
function buildPublicUrl(key: string): string {
  return `${R2_CONFIG.publicUrl}/${key}`;
}

/**
 * Check if an item, material, or monster exists in R2
 */
export async function checkR2AssetExists(name: string, type: 'item' | 'material' | 'monster', noBackground?: boolean): Promise<boolean> {
  const client = createR2Client();
  const key = buildR2Key(name, type, noBackground);

  try {
    await client.send(new HeadObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: key,
    }));

    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw new Error(`Failed to check R2 asset ${key}: ${error.message}`);
  }
}

/**
 * Get public URL for item, material, or monster if it exists in R2
 * Throws error if asset does not exist
 */
export async function getR2AssetUrl(name: string, type: 'item' | 'material' | 'monster', noBackground?: boolean): Promise<string> {
  const exists = await checkR2AssetExists(name, type, noBackground);

  if (!exists) {
    throw new Error(`Asset not found in R2: ${type} "${name}"`);
  }

  const key = buildR2Key(name, type, noBackground);
  return buildPublicUrl(key);
}

/**
 * Upload a local file to R2
 */
export async function uploadToR2(
  localFilePath: string,
  name: string,
  type: 'item' | 'material' | 'monster',
  noBackground?: boolean
): Promise<string> {
  if (!fs.existsSync(localFilePath)) {
    throw new Error(`Local file not found: ${localFilePath}`);
  }

  const client = createR2Client();
  const key = buildR2Key(name, type, noBackground);
  const fileBuffer = fs.readFileSync(localFilePath);

  try {
    await client.send(new PutObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: 'image/png',
    }));

    const publicUrl = buildPublicUrl(key);
    console.log(`✅ Uploaded to R2: ${publicUrl}`);

    return publicUrl;
  } catch (error: any) {
    throw new Error(`Failed to upload to R2 ${key}: ${error.message}`);
  }
}

/**
 * Check multiple assets in parallel
 * Returns map of name -> exists boolean
 */
export async function checkMultipleAssets(
  names: string[],
  type: 'item' | 'material' | 'monster',
  noBackground?: boolean
): Promise<Map<string, boolean>> {
  const results = await Promise.all(
    names.map(async (name) => {
      const exists = await checkR2AssetExists(name, type, noBackground);
      return { name, exists };
    })
  );

  return new Map(results.map(r => [r.name, r.exists]));
}

/**
 * Get URLs for multiple assets that exist in R2
 * Returns map of name -> URL (only for assets that exist)
 */
export async function getMultipleAssetUrls(
  names: string[],
  type: 'item' | 'material' | 'monster',
  noBackground?: boolean
): Promise<Map<string, string>> {
  const existenceMap = await checkMultipleAssets(names, type, noBackground);
  const urls = new Map<string, string>();

  for (const [name, exists] of existenceMap.entries()) {
    if (exists) {
      const key = buildR2Key(name, type, noBackground);
      urls.set(name, buildPublicUrl(key));
    }
  }

  return urls;
}

export { normalizeNameForR2, buildR2Key, buildPublicUrl };
