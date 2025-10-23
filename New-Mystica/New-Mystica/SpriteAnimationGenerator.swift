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
import Combine

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
        
        print("🎬 Creating animated sprite from: \(folderPath)")
        
        // Get first frame for initial texture
        guard let imageFiles = getImageFiles(from: folderPath) else {
            print("❌ Failed to load first frame from: \(folderPath)")
            return nil
        }
        
        guard let firstImage = loadImage(from: imageFiles[0]) else {
            print("❌ Failed to load first frame from: \(folderPath)")
            return nil
        }
        
        let spriteNode = SKSpriteNode(texture: createTexture(from: firstImage))
        
        // Add looping animation
        guard let animation = createLoopingAnimation(from: folderPath, frameRate: frameRate) else {
            print("❌ Failed to create animation")
            return nil
        }
        
        spriteNode.run(animation)
        print("✅ Successfully created animated sprite")
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
    
    // MARK: - Remote Animation Loading Methods
    
    /**
     * Creates a sprite node with animation loaded from remote URLs
     * 
     * - Parameters:
     *   - frameUrls: Array of URLs to sprite frame images
     *   - frameRate: Frames per second (default: 12)
     *   - completion: Completion handler with the created sprite node
     */
    static func createAnimatedSpriteFromURLs(
        frameUrls: [URL],
        frameRate: Double = 12.0,
        completion: @escaping (SKSpriteNode?) -> Void
    ) {
        print("🌐 Loading animation from \(frameUrls.count) remote URLs")
        
        let group = DispatchGroup()
        var textures: [SKTexture] = []
        var errors: [Error] = []
        
        for (index, url) in frameUrls.enumerated() {
            group.enter()
            
            URLSession.shared.dataTask(with: url) { data, response, error in
                defer { group.leave() }
                
                if let error = error {
                    print("❌ Failed to load frame \(index) from \(url): \(error)")
                    errors.append(error)
                    return
                }
                
                guard let data = data,
                      let image = UIImage(data: data) else {
                    print("❌ Failed to create image from data for frame \(index)")
                    return
                }
                
                let texture = SKTexture(image: image)
                textures.append(texture)
            }.resume()
        }
        
        group.notify(queue: .main) {
            guard !textures.isEmpty else {
                print("❌ No textures loaded successfully")
                completion(nil)
                return
            }
            
            print("✅ Successfully loaded \(textures.count) textures")
            
            // Create sprite node with first texture
            let spriteNode = SKSpriteNode(texture: textures[0])
            
            // Create animation
            let frameTime = 1.0 / frameRate
            let animateAction = SKAction.animate(with: textures, timePerFrame: frameTime)
            let loopAction = SKAction.repeatForever(animateAction)
            
            spriteNode.run(loopAction)
            completion(spriteNode)
        }
    }
    
    /**
     * Creates a SwiftUI-compatible animated view from remote URLs
     * 
     * - Parameters:
     *   - frameUrls: Array of URLs to sprite frame images
     *   - frameRate: Frames per second (default: 12)
     *   - size: Size of the animated view
     *   - completion: Completion handler with the created SKView
     */
    static func createAnimatedViewFromURLs(
        frameUrls: [URL],
        frameRate: Double = 12.0,
        size: CGSize = CGSize(width: 100, height: 100),
        completion: @escaping (SKView?) -> Void
    ) {
        createAnimatedSpriteFromURLs(frameUrls: frameUrls, frameRate: frameRate) { spriteNode in
            guard let spriteNode = spriteNode else {
                completion(nil)
                return
            }
            
            let skView = SKView(frame: CGRect(origin: .zero, size: size))
            let scene = SKScene(size: size)
            scene.backgroundColor = .clear
            
            spriteNode.position = CGPoint(x: size.width / 2, y: size.height / 2)
            scene.addChild(spriteNode)
            
            skView.presentScene(scene)
            completion(skView)
        }
    }
    
    // MARK: - Private Helper Methods
    
    private static func getImageFiles(from folderPath: String) -> [String]? {
        print("🔍 Looking for images in: \(folderPath)")
        let fileManager = FileManager.default
        let url = URL(fileURLWithPath: folderPath)
        
        do {
            let files = try fileManager.contentsOfDirectory(at: url, includingPropertiesForKeys: nil)
            print("📁 Found \(files.count) files in directory")
            
            // Filter for image files and sort by name
            let imageFiles = files
                .filter { file in
                    let pathExtension = file.pathExtension.lowercased()
                    return ["png", "jpg", "jpeg"].contains(pathExtension)
                }
                .sorted { $0.lastPathComponent < $1.lastPathComponent }
                .map { $0.path }
            
            print("🖼️ Found \(imageFiles.count) image files")
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
        return SKTexture(image: image as! UIImage)
        #elseif canImport(AppKit)
        return SKTexture(image: image as! NSImage)
        #else
        fatalError("Unsupported platform")
        #endif
    }
}

// MARK: - SwiftUI Integration

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

// MARK: - Remote Animation SwiftUI View

struct RemoteAnimatedSpriteView: View {
    let frameUrls: [URL]
    let frameRate: Double
    let size: CGSize
    @State private var skView: SKView?
    @State private var isLoading = true
    @State private var hasError = false
    
    init(
        frameUrls: [URL],
        frameRate: Double = 12.0,
        size: CGSize = CGSize(width: 100, height: 100)
    ) {
        self.frameUrls = frameUrls
        self.frameRate = frameRate
        self.size = size
    }
    
    var body: some View {
        ZStack {
            if isLoading {
                ProgressView("Loading animation...")
                    .frame(width: size.width, height: size.height)
            } else if hasError {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.red.opacity(0.1))
                    .frame(width: size.width, height: size.height)
                    .overlay(
                        Text("Failed to load animation")
                            .foregroundColor(.red)
                            .font(.caption)
                    )
            } else if let skView = skView {
                SpriteView(scene: skView.scene)
                    .frame(width: size.width, height: size.height)
            }
        }
        .onAppear {
            loadAnimation()
        }
    }
    
    private func loadAnimation() {
        SpriteAnimationGenerator.createAnimatedViewFromURLs(
            frameUrls: frameUrls,
            frameRate: frameRate,
            size: size
        ) { loadedSkView in
            DispatchQueue.main.async {
                isLoading = false
                if let loadedSkView = loadedSkView {
                    self.skView = loadedSkView
                } else {
                    hasError = true
                }
            }
        }
    }
}
#endif