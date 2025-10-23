import SpriteKit
import Foundation
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif
#if canImport(SwiftUI)
import SwiftUI
#endif

class SpriteAnimationGenerator {
    
    static func createLoopingAnimation(
        from folderPath: String,
        frameRate: Double = 12.0
    ) -> SKAction? {
        
        guard let imageFiles = getImageFiles(from: folderPath) else {
            print("❌ Failed to load images from: \(folderPath)")
            return nil
        }
        
        guard !imageFiles.isEmpty else {
            print("❌ No image files found in: \(folderPath)")
            return nil
        }
        
        print("🎬 Found \(imageFiles.count) frames in \(folderPath)")
        
        var textures: [SKTexture] = []
        
        for imageFile in imageFiles {
            guard let image = loadImage(from: imageFile) else {
                print("⚠️ Failed to load image: \(imageFile)")
                continue
            }
            
            let texture = createTexture(from: image)
            textures.append(texture)
        }
        
        guard !textures.isEmpty else {
            print("❌ No valid textures created")
            return nil
        }
        
        let frameTime = 1.0 / frameRate
        let animateAction = SKAction.animate(with: textures, timePerFrame: frameTime)
        
        let loopAction = SKAction.repeatForever(animateAction)
        
        print("✅ Created forward looping animation with \(textures.count) frames")
        return loopAction
    }
    
    static func createAnimatedSprite(
        from folderPath: String,
        frameRate: Double = 12.0
    ) -> SKSpriteNode? {
        
        guard let imageFiles = getImageFiles(from: folderPath) else {
            print("❌ Failed to load first frame from: \(folderPath)")
            return nil
        }
        
        guard let firstImage = loadImage(from: imageFiles[0]) else {
            print("❌ Failed to load first frame from: \(folderPath)")
            return nil
        }
        
        let spriteNode = SKSpriteNode(texture: createTexture(from: firstImage))
        
        guard let animation = createLoopingAnimation(from: folderPath, frameRate: frameRate) else {
            return nil
        }
        
        spriteNode.run(animation)
        return spriteNode
    }
    
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
        
        animatedSprite.position = CGPoint(x: size.width / 2, y: size.height / 2)
        scene.addChild(animatedSprite)
        
        skView.presentScene(scene)
        return skView
    }
    
    
    private static func getImageFiles(from folderPath: String) -> [String]? {
        let fileManager = FileManager.default
        let url = URL(fileURLWithPath: folderPath)
        
        do {
            let files = try fileManager.contentsOfDirectory(at: url, includingPropertiesForKeys: nil)
            
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
    
    private static func loadImage(from path: String) -> Any? {
        #if canImport(UIKit)
        return UIImage(contentsOfFile: path)
        #elseif canImport(AppKit)
        return NSImage(contentsOfFile: path)
        #else
        return nil
        #endif
    }
    
    private static func createTexture(from image: Any) -> SKTexture {
        #if canImport(UIKit)
        guard let uiImage = image as? UIImage else {
            fatalError("Expected UIImage but got \(type(of: image))")
        }
        return SKTexture(image: uiImage)
        #elseif canImport(AppKit)
        guard let nsImage = image as? NSImage else {
            fatalError("Expected NSImage but got \(type(of: image))")
        }
        return SKTexture(image: nsImage)
        #else
        fatalError("Unsupported platform")
        #endif
    }
}


#if canImport(SwiftUI)
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