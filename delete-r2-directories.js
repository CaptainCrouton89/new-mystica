#!/usr/bin/env node

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// R2 Configuration
const R2_CONFIG = {
  bucketName: process.env.R2_BUCKET_NAME || 'mystica-assets',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
};

// Initialize S3 client for R2
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
  forcePathStyle: true,
});

async function deleteDirectory(prefix) {
  console.log(`🗑️  Deleting directory: ${prefix}`);
  
  try {
    // List all objects with the prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_CONFIG.bucketName,
      Prefix: prefix,
    });
    
    const listResult = await r2Client.send(listCommand);
    
    if (!listResult.Contents || listResult.Contents.length === 0) {
      console.log(`✅ Directory ${prefix} is already empty or doesn't exist`);
      return;
    }
    
    console.log(`📋 Found ${listResult.Contents.length} objects to delete`);
    
    // Delete all objects
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: R2_CONFIG.bucketName,
      Delete: {
        Objects: listResult.Contents.map(obj => ({ Key: obj.Key })),
      },
    });
    
    const deleteResult = await r2Client.send(deleteCommand);
    
    console.log(`✅ Successfully deleted ${deleteResult.Deleted.length} objects from ${prefix}`);
    
    if (deleteResult.Errors && deleteResult.Errors.length > 0) {
      console.log(`⚠️  Some errors occurred:`, deleteResult.Errors);
    }
    
  } catch (error) {
    console.error(`❌ Error deleting directory ${prefix}:`, error.message);
    throw error;
  }
}

async function main() {
  const directories = [
    'monsters/animations/doctor/idle/idle_sample1.atlas/',
    'monsters/animations/doctor/idle/idle_sample2.atlas/',
  ];
  
  console.log('🚀 Starting R2 directory deletion...');
  console.log(`📦 Bucket: ${R2_CONFIG.bucketName}`);
  
  for (const directory of directories) {
    await deleteDirectory(directory);
  }
  
  console.log('🎉 All directories processed!');
}

main().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
