#!/usr/bin/env tsx

/**
 * Atlas Converter Script
 * 
 * Converts PNG animation frames to SpriteKit atlas files and uploads to R2
 * 
 * Usage:
 *   tsx convert-to-atlas.ts --monster doctor --animation idle
 *   tsx convert-to-atlas.ts --monster doctor --animation attack
 *   tsx convert-to-atlas.ts --path monsters/animations/doctor/idle/idle_sample1.atlas
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { pipeline } from 'stream/promises';
import { createReadStream } from 'fs';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

// Load environment variables from parent directory
dotenv.config({ path: path.join('..', '.env.local'), override: true });

// R2 Configuration
const R2_CONFIG = {
    bucketName: 'mystica-assets',
    bucketDomain: 'pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev',
    basePath: 'monsters/animations',
    region: 'auto',
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || ''
};

// Initialize S3 client for R2
const s3Client = new S3Client({
    region: R2_CONFIG.region,
    endpoint: `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
    }
});

interface AtlasConversionOptions {
    monsterType: string;
    animationType: string;
    atlasFolderName?: string;
    frameCount?: number;
}

interface AnimationMetadata {
    monsterType: string;
    animationType: string;
    frameCount: number;
    duration: number;
    frameRate: number;
    atlasFileName: string;
    createdAt: string;
}

class AtlasConverter {
    private tempDir: string;
    
    constructor() {
        this.tempDir = join(tmpdir(), 'atlas-conversion', randomUUID());
        mkdirSync(this.tempDir, { recursive: true });
    }
    
    /**
     * Convert animation frames to atlas file
     */
    async convertToAtlas(options: AtlasConversionOptions): Promise<void> {
        const { monsterType, animationType, atlasFolderName, frameCount } = options;
        
        console.log(`🔄 Converting ${monsterType}/${animationType} to atlas...`);
        
        // Determine the source path
        const atlasFolder = atlasFolderName || `${animationType}_sample1.atlas`;
        const sourcePath = `${R2_CONFIG.basePath}/${monsterType}/${animationType}/${atlasFolder}`;
        
        console.log(`📁 Source path: ${sourcePath}`);
        
        // Download all PNG frames
        const frameUrls = await this.downloadFrames(sourcePath, frameCount);
        
        if (frameUrls.length === 0) {
            throw new Error(`No frames found in ${sourcePath}`);
        }
        
        console.log(`📥 Downloaded ${frameUrls.length} frames`);
        
        // Create atlas using SpriteKit's textureatlas tool
        const atlasPath = await this.createAtlasFile(frameUrls, monsterType, animationType);
        
        // Generate metadata
        const metadata = this.generateMetadata(monsterType, animationType, frameUrls.length);
        
        // Upload atlas and metadata to R2
        await this.uploadToR2(atlasPath, metadata, monsterType, animationType);
        
        console.log(`✅ Successfully converted and uploaded ${monsterType}/${animationType} atlas`);
    }
    
    /**
     * Download PNG frames from R2
     */
    private async downloadFrames(sourcePath: string, maxFrames?: number): Promise<string[]> {
        const framesDir = join(this.tempDir, 'frames');
        mkdirSync(framesDir, { recursive: true });
        
        const frameUrls: string[] = [];
        const maxTestFrames = maxFrames || 100;
        
        // Test frames to find actual count
        for (let i = 0; i < maxTestFrames; i++) {
            const frameNumber = String(i).padStart(4, '0');
            const fileName = `frame_${frameNumber}.png`;
            const objectKey = `${sourcePath}/${fileName}`;
            
            try {
                // Check if frame exists by trying to get object metadata
                const command = new ListObjectsV2Command({
                    Bucket: R2_CONFIG.bucketName,
                    Prefix: objectKey,
                    MaxKeys: 1
                });
                
                const response = await s3Client.send(command);
                
                if (response.Contents && response.Contents.length > 0) {
                    // Frame exists, download it
                    const downloadCommand = new PutObjectCommand({
                        Bucket: R2_CONFIG.bucketName,
                        Key: objectKey
                    });
                    
                    // For now, we'll construct the URL and download via HTTP
                    const frameUrl = `https://${R2_CONFIG.bucketDomain}/${objectKey}`;
                    const localPath = join(framesDir, fileName);
                    
                    await this.downloadFile(frameUrl, localPath);
                    frameUrls.push(localPath);
                    
                    console.log(`📥 Downloaded frame ${i + 1}`);
                } else {
                    // No more frames found
                    break;
                }
            } catch (error) {
                console.log(`⚠️  Frame ${i} not found, stopping detection`);
                break;
            }
        }
        
        return frameUrls;
    }
    
    /**
     * Download file from URL to local path
     */
    private async downloadFile(url: string, localPath: string): Promise<void> {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to download ${url}: ${response.statusText}`);
        }
        
        const fileStream = createWriteStream(localPath);
        await pipeline(response.body!, fileStream);
    }
    
    /**
     * Create SpriteKit atlas file from PNG frames
     */
    private async createAtlasFile(framePaths: string[], monsterType: string, animationType: string): Promise<string> {
        const atlasDir = join(this.tempDir, 'atlas');
        mkdirSync(atlasDir, { recursive: true });
        
        // Copy frames to atlas directory with proper naming
        for (let i = 0; i < framePaths.length; i++) {
            const sourcePath = framePaths[i];
            const frameNumber = String(i).padStart(4, '0');
            const destPath = join(atlasDir, `${animationType}_${frameNumber}.png`);
            
            // Copy file
            const sourceStream = createReadStream(sourcePath);
            const destStream = createWriteStream(destPath);
            await pipeline(sourceStream, destStream);
        }
        
        // Create atlas using SpriteKit's textureatlas tool
        const atlasName = `${monsterType}_${animationType}.atlas`;
        const atlasPath = join(this.tempDir, atlasName);
        
        try {
            // Try SpriteKit's textureatlas command line tool first
            const command = `textureatlas "${atlasDir}" "${atlasPath}"`;
            execSync(command, { stdio: 'inherit' });
            
            console.log(`🎨 Created atlas: ${atlasName}`);
            return atlasPath;
        } catch (error) {
            console.log('⚠️  textureatlas tool not available, trying alternative method...');
            
            // Alternative: Create a simple atlas by combining frames into a sprite sheet
            return await this.createSimpleAtlas(framePaths, monsterType, animationType);
        }
    }
    
    /**
     * Create a simple atlas by combining frames into a sprite sheet
     * This is a fallback when textureatlas tool is not available
     */
    private async createSimpleAtlas(framePaths: string[], monsterType: string, animationType: string): Promise<string> {
        console.log('🔄 Creating simple sprite sheet atlas...');
        
        // For now, we'll create a zip file containing all the frames
        // This can be used as a simple atlas format
        const atlasName = `${monsterType}_${animationType}.atlas`;
        const atlasPath = join(this.tempDir, atlasName);
        
        try {
            // Create a zip file containing all frames
            const zipCommand = `cd "${this.tempDir}" && zip -r "${atlasName}" atlas/`;
            execSync(zipCommand, { stdio: 'inherit' });
            
            console.log(`🎨 Created simple atlas: ${atlasName}`);
            return atlasPath;
        } catch (error) {
            console.error('❌ Failed to create simple atlas');
            throw error;
        }
    }
    
    /**
     * Generate metadata JSON for the animation
     */
    private generateMetadata(monsterType: string, animationType: string, frameCount: number): AnimationMetadata {
        return {
            monsterType,
            animationType,
            frameCount,
            duration: frameCount / 12.0, // Assuming 12 FPS
            frameRate: 12.0,
            atlasFileName: `${monsterType}_${animationType}.atlas`,
            createdAt: new Date().toISOString()
        };
    }
    
    /**
     * Upload atlas file and metadata to R2
     */
    private async uploadToR2(atlasPath: string, metadata: AnimationMetadata, monsterType: string, animationType: string): Promise<void> {
        const atlasKey = `${R2_CONFIG.basePath}/${monsterType}/${animationType}/${metadata.atlasFileName}`;
        const metadataKey = `${R2_CONFIG.basePath}/${monsterType}/${animationType}/${monsterType}_${animationType}_metadata.json`;
        
        // Upload atlas file
        const atlasContent = createReadStream(atlasPath);
        const atlasCommand = new PutObjectCommand({
            Bucket: R2_CONFIG.bucketName,
            Key: atlasKey,
            Body: atlasContent,
            ContentType: 'application/octet-stream'
        });
        
        await s3Client.send(atlasCommand);
        console.log(`☁️  Uploaded atlas: ${atlasKey}`);
        
        // Upload metadata
        const metadataCommand = new PutObjectCommand({
            Bucket: R2_CONFIG.bucketName,
            Key: metadataKey,
            Body: JSON.stringify(metadata, null, 2),
            ContentType: 'application/json'
        });
        
        await s3Client.send(metadataCommand);
        console.log(`📋 Uploaded metadata: ${metadataKey}`);
    }
    
    /**
     * Clean up temporary files
     */
    cleanup(): void {
        try {
            execSync(`rm -rf "${this.tempDir}"`);
            console.log(`🧹 Cleaned up temporary files`);
        } catch (error) {
            console.warn('⚠️  Failed to clean up temporary files');
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Atlas Converter Script

Usage:
  tsx convert-to-atlas.ts --monster <type> --animation <type> [--frames <count>]
  tsx convert-to-atlas.ts --path <r2-path> [--frames <count>]

Examples:
  tsx convert-to-atlas.ts --monster doctor --animation idle
  tsx convert-to-atlas.ts --monster doctor --animation attack --frames 45
  tsx convert-to-atlas.ts --path monsters/animations/doctor/idle/idle_sample1.atlas

Options:
  --monster <type>     Monster type (e.g., doctor, birdman)
  --animation <type>   Animation type (e.g., idle, attack)
  --path <path>        Full R2 path to atlas folder
  --frames <count>     Expected frame count (optional, will auto-detect)
  --help              Show this help message

Environment Variables:
  R2_ACCESS_KEY_ID     R2 access key
  R2_SECRET_ACCESS_KEY R2 secret key
        `);
        return;
    }
    
    // Parse arguments
    let monsterType: string | undefined;
    let animationType: string | undefined;
    let atlasPath: string | undefined;
    let frameCount: number | undefined;
    
    for (let i = 0; i < args.length; i += 2) {
        const flag = args[i];
        const value = args[i + 1];
        
        switch (flag) {
            case '--monster':
                monsterType = value;
                break;
            case '--animation':
                animationType = value;
                break;
            case '--path':
                atlasPath = value;
                break;
            case '--frames':
                frameCount = parseInt(value);
                break;
        }
    }
    
    // Validate arguments
    if (!atlasPath && (!monsterType || !animationType)) {
        console.error('❌ Error: Must specify either --path or both --monster and --animation');
        process.exit(1);
    }
    
    // Check environment variables
    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
        console.error('❌ Error: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables must be set');
        process.exit(1);
    }
    
    const converter = new AtlasConverter();
    
    try {
        if (atlasPath) {
            // Extract monster and animation from path
            const pathParts = atlasPath.split('/');
            if (pathParts.length < 4) {
                throw new Error('Invalid path format. Expected: monsters/animations/monster/animation/atlas_folder');
            }
            
            monsterType = pathParts[2];
            animationType = pathParts[3];
            const atlasFolderName = pathParts[4];
            
            await converter.convertToAtlas({
                monsterType,
                animationType,
                atlasFolderName,
                frameCount
            });
        } else {
            await converter.convertToAtlas({
                monsterType: monsterType!,
                animationType: animationType!,
                frameCount
            });
        }
        
        console.log('🎉 Atlas conversion completed successfully!');
        
    } catch (error) {
        console.error('❌ Atlas conversion failed:', error);
        process.exit(1);
    } finally {
        converter.cleanup();
    }
}

// Run the script
if (require.main === module) {
    main().catch(console.error);
}

export { AtlasConverter, type AtlasConversionOptions, type AnimationMetadata };
