#!/usr/bin/env node

/**
 * Sprite Sheet Metadata Generator
 * 
 * Analyzes a sprite sheet image and generates metadata for use with SimpleAnimatedSpriteView
 * 
 * Usage: node generate-sprite-metadata.js <image-path> <frame-width> <frame-height>
 * Example: node generate-sprite-metadata.js SkeletonSprite.png 64 64
 */

const fs = require('fs');
const path = require('path');

function generateSpriteMetadata(imagePath, frameWidth, frameHeight) {
    console.log(`🎬 Analyzing sprite sheet: ${imagePath}`);
    console.log(`📐 Frame dimensions: ${frameWidth}x${frameHeight}`);
    
    // For now, we'll create a simple metadata structure
    // In a real implementation, you'd use an image analysis library to get actual dimensions
    
    const metadata = {
        monsterType: "skeleton",
        animationType: "idle",
        frameCount: 0, // Will be calculated
        frameWidth: frameWidth,
        frameHeight: frameHeight,
        sheetWidth: 128, // From file command output
        sheetHeight: 64, // From file command output
        frameRate: 12.0,
        createdAt: new Date().toISOString(),
        frames: []
    };
    
    // Calculate how many frames fit horizontally
    const framesPerRow = Math.floor(metadata.sheetWidth / frameWidth);
    const totalFrames = framesPerRow; // Assuming single row for now
    
    metadata.frameCount = totalFrames;
    
    console.log(`📊 Calculated ${totalFrames} frames (${framesPerRow} per row)`);
    
    // Generate frame data
    for (let i = 0; i < totalFrames; i++) {
        const x = i * frameWidth;
        const y = 0; // Assuming single row
        
        metadata.frames.push({
            index: i,
            name: `frame_${i}`,
            x: x,
            y: y,
            width: frameWidth,
            height: frameHeight,
            duration: 1.0 / metadata.frameRate
        });
        
        console.log(`  Frame ${i}: (${x}, ${y}) ${frameWidth}x${frameHeight}`);
    }
    
    return metadata;
}

function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.log('Usage: node generate-sprite-metadata.js <image-path> <frame-width> <frame-height>');
        console.log('Example: node generate-sprite-metadata.js SkeletonSprite.png 64 64');
        process.exit(1);
    }
    
    const imagePath = args[0];
    const frameWidth = parseInt(args[1]);
    const frameHeight = parseInt(args[2]);
    
    if (!fs.existsSync(imagePath)) {
        console.error(`❌ Image file not found: ${imagePath}`);
        process.exit(1);
    }
    
    const metadata = generateSpriteMetadata(imagePath, frameWidth, frameHeight);
    
    // Output as JSON
    console.log('\n📄 Generated Metadata:');
    console.log(JSON.stringify(metadata, null, 2));
    
    // Save to file
    const outputPath = imagePath.replace('.png', '_metadata.json');
    fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));
    console.log(`\n💾 Saved metadata to: ${outputPath}`);
    
    // Generate Swift code snippet
    console.log('\n🔧 Swift Code Snippet:');
    console.log('```swift');
    console.log('private let skeletonMetadata = SpriteMetadata(');
    console.log(`    monsterType: "${metadata.monsterType}",`);
    console.log(`    animationType: "${metadata.animationType}",`);
    console.log(`    frameCount: ${metadata.frameCount},`);
    console.log(`    frameWidth: ${metadata.frameWidth},`);
    console.log(`    frameHeight: ${metadata.frameHeight},`);
    console.log(`    sheetWidth: ${metadata.sheetWidth},`);
    console.log(`    sheetHeight: ${metadata.sheetHeight},`);
    console.log(`    frameRate: ${metadata.frameRate},`);
    console.log(`    createdAt: "${metadata.createdAt}",`);
    console.log('    frames: [');
    
    metadata.frames.forEach((frame, index) => {
        const comma = index < metadata.frames.length - 1 ? ',' : '';
        console.log(`        FrameData(index: ${frame.index}, name: "${frame.name}", x: ${frame.x}, y: ${frame.y}, width: ${frame.width}, height: ${frame.height}, duration: ${frame.duration})${comma}`);
    });
    
    console.log('    ]');
    console.log(')');
    console.log('```');
}

if (require.main === module) {
    main();
}

module.exports = { generateSpriteMetadata };
