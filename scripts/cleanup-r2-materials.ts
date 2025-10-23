import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true });

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function cleanupMaterials() {
  console.log('🔍 Scanning materials directory for misplaced files...\n');

  // List all objects in materials/output/raw/materials/
  const response = await client.send(new ListObjectsV2Command({
    Bucket: 'mystica-assets',
    Prefix: 'materials/output/raw/materials/'
  }));

  if (!response.Contents || response.Contents.length === 0) {
    console.log('✅ No files to clean up');
    return;
  }

  console.log(`Found ${response.Contents.length} files to move\n`);

  for (const obj of response.Contents) {
    const oldKey = obj.Key!;
    const filename = oldKey.split('/').pop()!;
    const newKey = `materials/${filename}`;

    console.log(`Moving: ${oldKey} → ${newKey}`);

    // Copy to new location
    await client.send(new CopyObjectCommand({
      Bucket: 'mystica-assets',
      CopySource: `mystica-assets/${oldKey}`,
      Key: newKey,
      ContentType: 'image/png'
    }));

    // Delete old file
    await client.send(new DeleteObjectCommand({
      Bucket: 'mystica-assets',
      Key: oldKey
    }));

    console.log(`✓ Moved ${filename}`);
  }

  console.log(`\n✅ Cleanup complete! Moved ${response.Contents.length} files`);
}

cleanupMaterials().catch(console.error);
