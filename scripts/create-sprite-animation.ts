#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface AnimationConfig {
  inputDir: string;
  outputDir: string;
  name: string;
  frameRate: number;
}

class SpriteAnimationCreator {
  private config: AnimationConfig;

  constructor(config: AnimationConfig) {
    this.config = config;
  }

  /**
   * Create a simple forward-looping GIF animation from sprite frames
   */
  async createAnimation(): Promise<string> {
    const { inputDir, outputDir, name, frameRate } = this.config;
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get all frame files and sort them
    const frameFiles = this.getFrameFiles(inputDir);
    if (frameFiles.length === 0) {
      throw new Error(`No frame files found in ${inputDir}`);
    }

    console.log(`Found ${frameFiles.length} frames in ${inputDir}`);

    // Generate output filename
    const outputFile = path.join(outputDir, `${name}_${frameRate}fps.gif`);
    
    // Create GIF animation
    await this.createGifAnimation(frameFiles, outputFile, frameRate);

    console.log(`Animation created: ${outputFile}`);
    return outputFile;
  }

  private getFrameFiles(inputDir: string): string[] {
    const files = fs.readdirSync(inputDir)
      .filter(file => /\.(png|jpg|jpeg)$/i.test(file))
      .sort((a, b) => {
        // Extract frame numbers for proper sorting
        const aNum = parseInt(a.match(/\d+/)?.[0] || '0');
        const bNum = parseInt(b.match(/\d+/)?.[0] || '0');
        return aNum - bNum;
      })
      .map(file => path.join(inputDir, file));
    
    return files;
  }


  private async createGifAnimation(
    frameFiles: string[], 
    outputFile: string, 
    frameRate: number
  ): Promise<void> {
    const delay = Math.round(100 / frameRate); // Convert fps to delay in centiseconds
    
    // Create GIF using ImageMagick
    const frameList = frameFiles.map(f => `"${f}"`).join(' ');
    const command = `convert -delay ${delay} -loop 0 ${frameList} -quality 80 "${outputFile}"`;
    
    console.log('Creating GIF animation...');
    execSync(command, { stdio: 'pipe' });
  }

}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
Usage: tsx create-sprite-animation.ts <input-dir> <output-dir> [options]

Options:
  --name <name>           Animation name (default: "animation")
  --fps <fps>            Frame rate (default: 12)

Examples:
  tsx create-sprite-animation.ts "sprites/enemies/bird man/attack" sprites/animations --name birdman_attack --fps 15
    `);
    process.exit(1);
  }

  const inputDir = args[0];
  const outputDir = args[1];
  
  // Parse options
  const options: Partial<AnimationConfig> = {
    name: 'animation',
    frameRate: 12
  };

  for (let i = 2; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case '--name':
        options.name = value;
        break;
      case '--fps':
        options.frameRate = parseInt(value);
        break;
    }
  }

  try {
    const creator = new SpriteAnimationCreator({
      inputDir,
      outputDir,
      ...options
    } as AnimationConfig);

    const outputFile = await creator.createAnimation();
    console.log(`✅ Animation created successfully: ${outputFile}`);
    
  } catch (error) {
    console.error('❌ Error creating animation:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { SpriteAnimationCreator, AnimationConfig };
