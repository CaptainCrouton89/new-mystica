import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  S3ServiceException
} from '@aws-sdk/client-s3';
import { SdkError } from '@aws-sdk/types';
import * as fs from 'fs';

interface R2Error extends Error {
  name: string;
  message: string;
  $metadata?: {
    httpStatusCode?: number;
  };
}

// Load environment variables from parent directory
dotenv.config({ path: path.join('..', '.env.local'), override: true });

// Runtime validation for required env vars
function validateR2EnvVars(): void {
  const required = [
    'CLOUDFLARE_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_URL'
  ];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required R2 environment variables: ${missing.join(', ')}`);
  }
}

// Lazy config - validates only when accessed
function getR2Config() {
  validateR2EnvVars();

  return {
    bucket: process.env.R2_BUCKET_NAME!,
    publicUrl: process.env.R2_PUBLIC_URL!,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  };
}

// For backwards compatibility
const R2_CONFIG = {
  get bucket() { return getR2Config().bucket; },
  get publicUrl() { return getR2Config().publicUrl; },
  get accountId() { return getR2Config().accountId; },
  get accessKeyId() { return getR2Config().accessKeyId; },
  get secretAccessKey() { return getR2Config().secretAccessKey; }
};

interface R2ClientConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function createR2Client(): S3Client {
  const { accountId, accessKeyId, secretAccessKey } = R2_CONFIG;

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
    directory = 'monsters/cuphead';
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
  } catch (error) {
    const r2Error = error as R2Error | S3ServiceException;

    if (r2Error.name === 'NotFound') {
      return false;
    }

    const s3Error = r2Error as S3ServiceException;
    if (s3Error.$metadata?.httpStatusCode === 404) {
      return false;
    }

    throw new Error(`Failed to check R2 asset ${key}: ${r2Error.message}`);
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
  } catch (error) {
    const r2Error = error as R2Error | S3ServiceException;
    throw new Error(`Failed to upload to R2 ${key}: ${r2Error.message}`);
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

/**
 * Monster sprite asset paths structure
 */
export interface MonsterAssetPaths {
  base_url: string;
  sprites: {
    [key: string]: {
      image_url: string;
      atlas_url: string;
    };
  };
}

/**
 * Upload all monster assets (base + sprites) to R2
 *
 * Expected directory structure:
 * {spritePath}/
 *   ├── base.png
 *   ├── idle_sample1.png
 *   ├── idle_sample1.json
 *   ├── attack_sample1.png
 *   ├── attack_sample1.json
 *   └── ...
 *
 * R2 structure:
 * monsters/{uuid}/base.png
 * monsters/{uuid}/sprites/idle_sample1.png
 * monsters/{uuid}/sprites/idle_sample1.json
 *
 * @param monsterId - Monster UUID from database
 * @param spritePath - Local path to sprite directory
 * @returns Object with all uploaded asset URLs
 */
export async function uploadMonsterAssets(
  monsterId: string,
  spritePath: string
): Promise<MonsterAssetPaths> {
  const client = createR2Client();

  // Upload base image
  const basePath = path.join(spritePath, 'base.png');
  if (!fs.existsSync(basePath)) {
    throw new Error(`Base image not found: ${basePath}`);
  }

  const baseKey = `monsters/${monsterId}/base.png`;
  const baseBuffer = fs.readFileSync(basePath);

  await client.send(new PutObjectCommand({
    Bucket: R2_CONFIG.bucket,
    Key: baseKey,
    Body: baseBuffer,
    ContentType: 'image/png',
  }));

  const base_url = buildPublicUrl(baseKey);
  console.log(`  ✓ Uploaded base: ${baseKey}`);

  // Find and upload all sprite files
  const files = fs.readdirSync(spritePath);
  const spriteFiles = files.filter(f =>
    f !== 'base.png' && (f.endsWith('.png') || f.endsWith('.json'))
  );

  const sprites: MonsterAssetPaths['sprites'] = {};
  const uploadPromises: Promise<void>[] = [];

  // Group sprites by base name (e.g., "idle_sample1")
  const spriteGroups = new Map<string, { png?: string; json?: string }>();

  for (const file of spriteFiles) {
    const baseName = file.replace(/\.(png|json)$/, '');
    const ext = path.extname(file).slice(1);

    if (!spriteGroups.has(baseName)) {
      spriteGroups.set(baseName, {});
    }

    const group = spriteGroups.get(baseName)!;
    if (ext === 'png') {
      group.png = file;
    } else if (ext === 'json') {
      group.json = file;
    }
  }

  // Upload each sprite group in parallel
  for (const [baseName, { png, json }] of spriteGroups) {
    if (!png) {
      console.warn(`  ⚠️  Skipping ${baseName}: no PNG file found`);
      continue;
    }

    const uploadSprite = async () => {
      // Upload PNG
      const pngPath = path.join(spritePath, png);
      const pngKey = `monsters/${monsterId}/sprites/${png}`;
      const pngBuffer = fs.readFileSync(pngPath);

      await client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucket,
        Key: pngKey,
        Body: pngBuffer,
        ContentType: 'image/png',
      }));

      const image_url = buildPublicUrl(pngKey);

      // Upload JSON atlas if exists
      let atlas_url = '';
      if (json) {
        const jsonPath = path.join(spritePath, json);
        const jsonKey = `monsters/${monsterId}/sprites/${json}`;
        const jsonBuffer = fs.readFileSync(jsonPath);

        await client.send(new PutObjectCommand({
          Bucket: R2_CONFIG.bucket,
          Key: jsonKey,
          Body: jsonBuffer,
          ContentType: 'application/json',
        }));

        atlas_url = buildPublicUrl(jsonKey);
      }

      sprites[baseName] = { image_url, atlas_url };
      console.log(`  ✓ Uploaded sprite: ${baseName}`);
    };

    uploadPromises.push(uploadSprite());
  }

  // Wait for all sprite uploads to complete
  await Promise.all(uploadPromises);

  console.log(`  ✅ Uploaded ${Object.keys(sprites).length} sprite pairs`);

  return {
    base_url,
    sprites
  };
}

export { normalizeNameForR2, buildR2Key, buildPublicUrl };
