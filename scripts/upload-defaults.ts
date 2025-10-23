import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from monorepo root
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true });

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const uploads = [
  {
    local: 'output/arbitrary/simple_generic_sword_weapon_icon-1761177970467.png',
    r2: 'items/default_weapon.png'
  },
  {
    local: 'output/arbitrary/simple_shield_icon-1761177973540.png',
    r2: 'items/default_offhand.png'
  },
  {
    local: 'output/arbitrary/simple_helmet_or_hat_icon-1761177971239.png',
    r2: 'items/default_head.png'
  },
  {
    local: 'output/arbitrary/simple_chestplate_armor_icon-1761177978684.png',
    r2: 'items/default_armor.png'
  },
  {
    local: 'output/arbitrary/simple_boots_or_shoes_icon-1761177969997.png',
    r2: 'items/default_feet.png'
  },
  {
    local: 'output/arbitrary/simple_ring_or_amulet_accessory_icon-1761177973227.png',
    r2: 'items/default_accessory.png'
  },
  {
    local: 'output/arbitrary/simple_cute_pet_or_companion_icon-1761177972851.png',
    r2: 'items/default_pet.png'
  }
];

async function uploadDefaults() {
  console.log('📤 Uploading default category images to R2...\n');

  for (const upload of uploads) {
    const localPath = path.join(__dirname, upload.local);

    if (!fs.existsSync(localPath)) {
      console.error(`❌ File not found: ${localPath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(localPath);

    try {
      await client.send(new PutObjectCommand({
        Bucket: 'mystica-assets',
        Key: upload.r2,
        Body: fileBuffer,
        ContentType: 'image/png',
      }));

      const publicUrl = `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/${upload.r2}`;
      console.log(`✓ ${upload.r2}`);
      console.log(`  ${publicUrl}`);
    } catch (error: any) {
      console.error(`❌ Failed to upload ${upload.r2}: ${error.message}`);
    }
  }

  console.log('\n✅ Upload complete!');
}

uploadDefaults().catch(console.error);
