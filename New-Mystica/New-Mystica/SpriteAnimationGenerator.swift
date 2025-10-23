import SpriteKit
import Foundation
import AppKit

/**
 * SpriteAnimationGenerator - Swift class for creating simple forward-looping sprite animations
 * Can be called dynamically from other Swift code to generate UI-ready animations
 */
class SpriteAnimationGenerator {
    
    /**
     * Creates a simple forward-looping SKAction animation from sprite frames
     * 
     * - Parameters:
     *   - folderPath: Path to folder containing sprite frames
     *   - frameRate: Frames per second (default: 12)
     * - Returns: SKAction that can be run on SKSpriteNode
     */
    static func createLoopingAnimation(
        from folderPath: String,
        frameRate: Double = 12.0
    ) -> SKAction? {
        
        // Get all image files from the folder
        guard let imageFiles = getImageFiles(from: folderPath) else {
            print("❌ Failed to load images from: \(folderPath)")
            return nil
        }
        
        guard !imageFiles.isEmpty else {
            print("❌ No image files found in: \(folderPath)")
            return nil
        }
        
        print("🎬 Found \(imageFiles.count) frames in \(folderPath)")
        
        // Create texture array
        var textures: [SKTexture] = []
        
        for imageFile in imageFiles {
            guard let image = NSImage(contentsOfFile: imageFile) else {
                print("⚠️ Failed to load image: \(imageFile)")
                continue
            }
            
            let texture = SKTexture(image: image)
            textures.append(texture)
        }
        
        guard !textures.isEmpty else {
            print("❌ No valid textures created")
            return nil
        }
        
        // Create animation action
        let frameTime = 1.0 / frameRate
        let animateAction = SKAction.animate(with: textures, timePerFrame: frameTime)
        
        // Create looping action
        let loopAction = SKAction.repeatForever(animateAction)
        
        print("✅ Created forward looping animation with \(textures.count) frames")
        return loopAction
    }
    
    /**
     * Creates a sprite node with looping animation
     * 
     * - Parameters:
     *   - folderPath: Path to folder containing sprite frames
     *   - frameRate: Frames per second (default: 12)
     * - Returns: SKSpriteNode with animation, or nil if failed
     */
    static func createAnimatedSprite(
        from folderPath: String,
        frameRate: Double = 12.0
    ) -> SKSpriteNode? {
        
        // Get first frame for initial texture
        guard let imageFiles = getImageFiles(from: folderPath),
              let firstImage = NSImage(contentsOfFile: imageFiles[0]) else {
            print("❌ Failed to load first frame from: \(folderPath)")
            return nil
        }
        
        let spriteNode = SKSpriteNode(texture: SKTexture(image: firstImage))
        
        // Add looping animation
        guard let animation = createLoopingAnimation(from: folderPath, frameRate: frameRate) else {
            return nil
        }
        
        spriteNode.run(animation)
        return spriteNode
    }
    
    /**
     * Creates a SwiftUI-compatible animated view using SpriteKit
     * 
     * - Parameters:
     *   - folderPath: Path to folder containing sprite frames
     *   - frameRate: Frames per second (default: 12)
     *   - size: Size of the animated view
     * - Returns: SKView with animated sprite, or nil if failed
     */
    static func createAnimatedView(
        from folderPath: String,
        frameRate: Double = 12.0,
        size: CGSize = CGSize(width: 100, height: 100)
    ) -> SKView? {
        
        let skView = SKView(frame: CGRect(origin: .zero, size: size))
        let scene = SKScene(size: size)
        scene.backgroundColor = .clear
        
        guard let animatedSprite = createAnimatedSprite(from: folderPath, frameRate: frameRate) else {
            return nil
        }
        
        // Center the sprite
        animatedSprite.position = CGPoint(x: size.width / 2, y: size.height / 2)
        scene.addChild(animatedSprite)
        
        skView.presentScene(scene)
        return skView
    }
    
    // MARK: - Private Helper Methods
    
    private static func getImageFiles(from folderPath: String) -> [String]? {
        let fileManager = FileManager.default
        let url = URL(fileURLWithPath: folderPath)
        
        do {
            let files = try fileManager.contentsOfDirectory(at: url, includingPropertiesForKeys: nil)
            
            // Filter for image files and sort by name
            let imageFiles = files
                .filter { file in
                    let pathExtension = file.pathExtension.lowercased()
                    return ["png", "jpg", "jpeg"].contains(pathExtension)
                }
                .sorted { $0.lastPathComponent < $1.lastPathComponent }
                .map { $0.path }
            
            return imageFiles
        } catch {
            print("❌ Error reading directory: \(error)")
            return nil
        }
    }
    

// MARK: - SwiftUI Integration

#if canImport(SwiftUI)
import SwiftUI

struct AnimatedSpriteView: View {
    let folderPath: String
    let frameRate: Double
    let size: CGSize
    
    init(
        folderPath: String,
        frameRate: Double = 12.0,
        size: CGSize = CGSize(width: 100, height: 100)
    ) {
        self.folderPath = folderPath
        self.frameRate = frameRate
        self.size = size
    }
    
    var body: some View {
        SpriteView(scene: createScene())
            .frame(width: size.width, height: size.height)
    }
    
    private func createScene() -> SKScene {
        let scene = SKScene(size: size)
        scene.backgroundColor = .clear
        
        if let animatedSprite = SpriteAnimationGenerator.createAnimatedSprite(
            from: folderPath,
            frameRate: frameRate
        ) {
            animatedSprite.position = CGPoint(x: size.width / 2, y: size.height / 2)
            scene.addChild(animatedSprite)
        }
        
        return scene
    }
}
#endif
