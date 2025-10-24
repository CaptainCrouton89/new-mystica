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
 * SpriteAnimationGenerator - Swift class for creating sprite animations from remote URLs
 * Handles loading sprite frames from R2 storage and creating animated SpriteKit nodes
 */
class SpriteAnimationGenerator {
    
    // MARK: - Animation Source Types
    
    /**
     * Defines different sources for loading sprite animations
     */
    enum AnimationSource {
        case urls([URL])                           // Direct array of frame URLs
        case atlas(URL, frameCount: Int)          // Atlas directory with known frame count
        case atlasWithDetection(URL)              // Atlas directory with dynamic frame detection
    }
    
    // MARK: - Consolidated Animation Loading Method
    
    /**
     * Creates a sprite node with animation from various sources
     * 
     * - Parameters:
     *   - source: Source of the animation (URLs, atlas with count, or atlas with detection)
     *   - frameRate: Frames per second (default: 12)
     *   - targetSize: Target size for the sprite (optional, maintains original size if nil)
     *   - completion: Completion handler with the created sprite node
     */
    static func createAnimatedSprite(
        source: AnimationSource,
        frameRate: Double = 12.0,
        targetSize: CGSize? = nil,
        completion: @escaping (SKSpriteNode?) -> Void
    ) {
        switch source {
        case .urls(let frameUrls):
            loadAnimationFromURLs(frameUrls: frameUrls, frameRate: frameRate, targetSize: targetSize, completion: completion)
            
        case .atlas(let atlasURL, let frameCount):
            let frameURLs = R2AnimationLoader.shared.generateAtlasFrameURLs(atlasURL: atlasURL, frameCount: frameCount)
            guard !frameURLs.isEmpty else {
                completion(nil)
                return
            }
            loadAnimationFromURLs(frameUrls: frameURLs, frameRate: frameRate, targetSize: targetSize, completion: completion)
            
        case .atlasWithDetection(let atlasURL):
            R2AnimationLoader.shared.detectFrameCount(atlasURL: atlasURL) { frameCount in
                guard frameCount > 0 else {
                    completion(nil)
                    return
                }
                let frameURLs = R2AnimationLoader.shared.generateAtlasFrameURLs(atlasURL: atlasURL, frameCount: frameCount)
                loadAnimationFromURLs(frameUrls: frameURLs, frameRate: frameRate, targetSize: targetSize, completion: completion)
            }
        }
    }
    
    /**
     * Private helper method that handles the actual texture loading and sprite creation
     */
    private static func loadAnimationFromURLs(
        frameUrls: [URL],
        frameRate: Double,
        targetSize: CGSize?,
        completion: @escaping (SKSpriteNode?) -> Void
    ) {
        let group = DispatchGroup()
        var textures: [SKTexture] = []
        var errors: [Error] = []
        
        for (_, url) in frameUrls.enumerated() {
            group.enter()
            
            
            URLSession.shared.dataTask(with: url) { data, response, error in
                defer { group.leave() }
                
                if let error = error {
                    errors.append(error)
                    return
                }
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    return
                }
                
                
                if httpResponse.statusCode != 200 {
                    return
                }
                
                guard let data = data else {
                    return
                }
                
                
                guard let image = UIImage(data: data) else {
                    return
                }
                
                let texture = SKTexture(image: image)
                textures.append(texture)
            }.resume()
        }
        
        group.notify(queue: .main) {
            guard !textures.isEmpty else {
                completion(nil)
                return
            }
            
            
            // Create sprite node with first texture
            let spriteNode = SKSpriteNode(texture: textures[0])
            
            // Apply scaling if target size is specified
            if let targetSize = targetSize {
                let originalSize = spriteNode.size
                let uniformScale = calculateOptimalScale(
                    originalSize: originalSize,
                    targetSize: targetSize,
                    scalingMode: .fit
                )
                spriteNode.setScale(uniformScale)
                
            }
            
            // Create animation
            let frameTime = 1.0 / frameRate
            let animateAction = SKAction.animate(with: textures, timePerFrame: frameTime)
            let loopAction = SKAction.repeatForever(animateAction)
            
            spriteNode.run(loopAction)
            completion(spriteNode)
        }
    }
    
    // MARK: - Scaling Helper Methods
    
    /**
     * Calculate optimal scale for sprite to fit target size
     * 
     * - Parameters:
     *   - originalSize: Original size of the sprite
     *   - targetSize: Target size to fit into
     *   - scalingMode: How to scale the sprite
     * - Returns: Scale factor to apply to sprite
     */
    static func calculateOptimalScale(
        originalSize: CGSize,
        targetSize: CGSize,
        scalingMode: ScalingMode = .fit
    ) -> CGFloat {
        let scaleX = targetSize.width / originalSize.width
        let scaleY = targetSize.height / originalSize.height
        
        switch scalingMode {
        case .fit:
            // Maintain aspect ratio, fit entirely within target size
            return min(scaleX, scaleY)
        case .fill:
            // Maintain aspect ratio, fill entire target size (may crop)
            return max(scaleX, scaleY)
        case .stretch:
            // Stretch to exact target size (may distort)
            return scaleX // Use X scale, Y will be handled separately
        case .none:
            // No scaling
            return 1.0
        }
    }
    
    /**
     * Scaling modes for sprite fitting
     */
    enum ScalingMode {
        case fit      // Maintain aspect ratio, fit within bounds
        case fill     // Maintain aspect ratio, fill bounds (may crop)
        case stretch  // Stretch to exact size (may distort)
        case none     // No scaling
    }
    
}


// MARK: - Dynamic Frame Detection SwiftUI View

struct DynamicAtlasAnimatedSpriteView: View {
    let atlasURL: URL
    let frameRate: Double
    let size: CGSize
    @State private var skView: SKView?
    @State private var isLoading = true
    @State private var hasError = false
    @State private var detectedFrameCount = 0
    
    init(
        atlasURL: URL,
        frameRate: Double = 12.0,
        size: CGSize = CGSize(width: 100, height: 100)
    ) {
        self.atlasURL = atlasURL
        self.frameRate = frameRate
        self.size = size
    }
    
    var body: some View {
        ZStack {
            if isLoading {
                VStack(spacing: 8) {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Detecting frames...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    if detectedFrameCount > 0 {
                        Text("Found \(detectedFrameCount) frames")
                            .font(.caption2)
                            .foregroundColor(.blue)
                    }
                }
                .frame(width: size.width, height: size.height)
            } else if hasError {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.red.opacity(0.1))
                    .frame(width: size.width, height: size.height)
                    .overlay(
                        VStack(spacing: 4) {
                            Text("Failed to load animation")
                                .foregroundColor(.red)
                                .font(.caption)
                            if detectedFrameCount > 0 {
                                Text("Detected \(detectedFrameCount) frames")
                                    .foregroundColor(.orange)
                                    .font(.caption2)
                            }
                        }
                    )
            } else if let skView = skView, let scene = skView.scene {
                SpriteView(scene: scene)
                    .frame(width: size.width, height: size.height)
            }
        }
        .onAppear {
            loadAtlasAnimationWithDetection()
        }
    }
    
    private func loadAtlasAnimationWithDetection() {
        SpriteAnimationGenerator.createAnimatedSprite(
            source: .atlasWithDetection(atlasURL),
            frameRate: frameRate,
            targetSize: size
        ) { spriteNode in
            DispatchQueue.main.async {
                isLoading = false
                if let spriteNode = spriteNode {
                    let skView = SKView(frame: CGRect(origin: .zero, size: size))
                    let scene = SKScene(size: size)
                    scene.backgroundColor = .clear
                    
                    spriteNode.position = CGPoint(x: size.width / 2, y: size.height / 2)
                    scene.addChild(spriteNode)
                    
                    skView.presentScene(scene)
                    self.skView = skView
                } else {
                    hasError = true
                }
            }
        }
    }
}

