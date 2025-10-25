#!/usr/bin/env tsx

/**
 * Simple Sprite Sheet Generator
 * 
 * ESSENTIAL FUNCTIONALITY:
 * - Download individual frame images from R2 storage
 * - Combine frames into horizontal sprite sheet using ImageMagick
 * - Generate metadata JSON with frame dimensions and timing
 * - Upload sprite sheet and metadata to R2 storage
 * 
 * USAGE: tsx simple-sprite-sheet.ts --monster doctor --animation idle --frames 10
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// R2 Configuration
const R2_CLIENT = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'mystica-assets';

interface SpriteSheetMetadata {
  monsterType: string;
  animationType: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  sheetWidth: number;
  sheetHeight: number;
  frameRate: number;
  createdAt: string;
}

/**
 * Generate sprite sheet from individual frames
 * Downloads frames → creates sprite sheet → uploads to R2
 */
async function generateSpriteSheet(
  monsterType: string,
  animationType: string,
  frameCount: number = 10,
  frameWidth: number = 100,
  frameHeight: number = 100
): Promise<void> {
  console.log(`🎬 Generating sprite sheet for ${monsterType} ${animationType}`);
  
  const sourcePath = `monsters/animations/${monsterType}/${animationType}`;
  const tempDir = path.join(__dirname, 'temp');
  
  // Create temp directory
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  try {
    // Download frames
    console.log(`📥 Downloading ${frameCount} frames...`);
    const frameFiles: string[] = [];
    
    for (let i = 0; i < frameCount; i++) {
      const frameNumber = i.toString().padStart(4, '0');
      const frameKey = `${sourcePath}/frame_${frameNumber}.png`;
      const localPath = path.join(tempDir, `frame_${frameNumber}.png`);
      
      console.log(`🔍 Looking for frame: ${frameKey}`);
      
      try {
        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: frameKey,
        });
        
        const response = await R2_CLIENT.send(command);
        const data = await response.Body!.transformToByteArray();
        fs.writeFileSync(localPath, Buffer.from(data));
        frameFiles.push(localPath);
        
        console.log(`✅ Downloaded frame ${i + 1}/${frameCount}: frame_${frameNumber}.png`);
      } catch (error) {
        console.log(`⚠️ Skipped frame ${i + 1} (not found): frame_${frameNumber}.png`);
      }
    }
    
    if (frameFiles.length === 0) {
      throw new Error('No frames downloaded');
    }
    
    // Create sprite sheet using ImageMagick
    const spriteSheetPath = path.join(tempDir, `${monsterType}_${animationType}_spritesheet.png`);
    const actualFrameCount = frameFiles.length;
    
    console.log(`🖼️ Creating sprite sheet with ${actualFrameCount} frames...`);
    console.log(`📋 Frame order in sprite sheet:`);
    frameFiles.forEach((frameFile, index) => {
      const fileName = path.basename(frameFile);
      console.log(`  Position[${index}] -> ${fileName}`);
    });
    
    // Calculate sprite sheet dimensions (horizontal layout)
    const sheetWidth = frameWidth * actualFrameCount;
    const sheetHeight = frameHeight;
    
    // Use ImageMagick to create sprite sheet
    const magickCommand = `magick montage ${frameFiles.join(' ')} -tile ${actualFrameCount}x1 -geometry ${frameWidth}x${frameHeight}+0+0 -background transparent "${spriteSheetPath}"`;
    
    try {
      execSync(magickCommand, { stdio: 'inherit' });
      console.log('✅ Sprite sheet created');
    } catch (error) {
      throw new Error(`ImageMagick failed: ${error}`);
    }
    
    // Create metadata
    const metadata: SpriteSheetMetadata = {
      monsterType,
      animationType,
      frameCount: actualFrameCount,
      frameWidth,
      frameHeight,
      sheetWidth,
      sheetHeight,
      frameRate: 12.0,
      createdAt: new Date().toISOString(),
    };
    
    const metadataPath = path.join(tempDir, `${monsterType}_${animationType}_metadata.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    // Upload sprite sheet
    console.log('📤 Uploading sprite sheet...');
    const spriteSheetKey = `${sourcePath}/${monsterType}_${animationType}_spritesheet.png`;
    const spriteSheetData = fs.readFileSync(spriteSheetPath);
    
    await R2_CLIENT.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: spriteSheetKey,
      Body: spriteSheetData,
      ContentType: 'image/png',
    }));
    
    // Upload metadata
    console.log('📤 Uploading metadata...');
    const metadataKey = `${sourcePath}/${monsterType}_${animationType}_metadata.json`;
    const metadataData = fs.readFileSync(metadataPath);
    
    await R2_CLIENT.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: metadataKey,
      Body: metadataData,
      ContentType: 'application/json',
    }));
    
    console.log('✅ Upload complete!');
    console.log(`📊 Sprite sheet: ${spriteSheetKey}`);
    console.log(`📊 Metadata: ${metadataKey}`);
    
  } finally {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.length === 0) {
    console.log(`
Simple Sprite Sheet Generator

Usage:
  tsx simple-sprite-sheet.ts --monster <type> --animation <type> [options]

Options:
  --monster <type>     Monster type (e.g., "doctor")
  --animation <type>   Animation type (e.g., "idle", "attack")
  --frames <count>     Expected frame count (default: 10)
  --width <pixels>    Frame width (default: 100)
  --height <pixels>   Frame height (default: 100)

Examples:
  tsx simple-sprite-sheet.ts --monster doctor --animation idle
  tsx simple-sprite-sheet.ts --monster doctor --animation attack --frames 20
    `);
    return;
  }
  
  const monsterType = args[args.indexOf('--monster') + 1];
  const animationType = args[args.indexOf('--animation') + 1];
  const frameCount = parseInt(args[args.indexOf('--frames') + 1]) || 10;
  const frameWidth = parseInt(args[args.indexOf('--width') + 1]) || 100;
  const frameHeight = parseInt(args[args.indexOf('--height') + 1]) || 100;
  
  if (!monsterType || !animationType) {
    console.error('❌ Missing required arguments: --monster and --animation');
    process.exit(1);
  }
  
  try {
    await generateSpriteSheet(monsterType, animationType, frameCount, frameWidth, frameHeight);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
