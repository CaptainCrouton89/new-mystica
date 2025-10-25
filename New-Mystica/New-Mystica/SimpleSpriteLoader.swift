//
//  SimpleSpriteLoader.swift
//  New-Mystica
//
//  Created by AI Assistant on 1/25/25.
//

import Foundation
import SpriteKit

/**
 * SimpleSpriteLoader - Core sprite sheet loading functionality
 * 
 * ESSENTIAL FUNCTIONALITY:
 * - Load sprite sheet metadata from R2 storage
 * - Download sprite sheet images from R2 storage  
 * - Extract individual frames from sprite sheet
 * - Create SKAction animations from frame textures
 * - Return animated SKSpriteNode for display
 * 
 * USAGE: SimpleSpriteLoader.shared.loadAnimatedSprite(monsterName: "doctor", animationType: "idle")
 */
class SimpleSpriteLoader {
    
    // MARK: - Configuration
    
    private let bucketDomain = "pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev"
    private let basePath = "monsters/animations"
    
    static let shared = SimpleSpriteLoader()
    private init() {}
    
    // MARK: - Sprite Sheet Loading
    
    /**
     * Load sprite sheet and create animated sprite (unified interface)
     * Handles both local and remote sprite sheets based on spriteSheetPath
     * - If spriteSheetPath contains "http" or starts with "monsters/", treats as remote
     * - Otherwise treats as local bundle resource
     */
    func loadSpriteSheet(
        spriteSheetPath: String,
        metadata: SpriteMetadata,
        frameRate: Double = 12.0,
        loopAnimation: Bool = true,
        completion: @escaping (SKSpriteNode?) -> Void
    ) {
        print("🎬 Loading sprite sheet: \(spriteSheetPath)")
        
        // Determine if this is a remote or local sprite sheet
        if spriteSheetPath.contains("http") || spriteSheetPath.hasPrefix("monsters/") {
            // Remote sprite sheet - extract monster name and animation type from metadata
            loadRemoteSpriteSheet(
                monsterName: metadata.monsterType,
                animationType: metadata.animationType,
                frameRate: frameRate,
                loopAnimation: loopAnimation,
                completion: completion
            )
        } else {
            // Local sprite sheet
            loadLocalSpriteSheet(
                spriteSheetPath: spriteSheetPath,
                metadata: metadata,
                frameRate: frameRate,
                loopAnimation: loopAnimation,
                completion: completion
            )
        }
    }
    
    /**
     * Load sprite sheet and create animated sprite (legacy remote interface)
     * Downloads metadata → downloads sprite sheet → extracts frames → creates animation
     */
    func loadAnimatedSprite(
        monsterName: String,
        animationType: String,
        frameRate: Double = 12.0,
        completion: @escaping (SKSpriteNode?) -> Void
    ) {
        print("🎬 Loading sprite sheet for \(monsterName) \(animationType)")
        
        // Load metadata first
        loadMetadata(monsterName: monsterName, animationType: animationType) { metadata in
            guard let metadata = metadata else {
                print("❌ Failed to load metadata")
                completion(nil)
                return
            }
            
            // Load sprite sheet
            self.loadSpriteSheet(metadata: metadata) { spriteSheetData in
                guard let spriteSheetData = spriteSheetData else {
                    print("❌ Failed to load sprite sheet")
                    completion(nil)
                    return
                }
                
                // Create animated sprite from sprite sheet
                self.createAnimatedSprite(
                    spriteSheetData: spriteSheetData,
                    metadata: metadata,
                    frameRate: frameRate,
                    loopAnimation: true,
                    completion: completion
                )
            }
        }
    }
    
    /**
     * Load local sprite sheet from bundle
     */
    private func loadLocalSpriteSheet(
        spriteSheetPath: String,
        metadata: SpriteMetadata,
        frameRate: Double,
        loopAnimation: Bool,
        completion: @escaping (SKSpriteNode?) -> Void
    ) {
        guard let image = loadLocalImage(named: spriteSheetPath) else {
            print("❌ Failed to load local image: \(spriteSheetPath)")
            completion(nil)
            return
        }
        
        let spriteSheetTexture = createTexture(from: image)
        let frameTextures = extractFrames(from: spriteSheetTexture, metadata: metadata)
        
        guard !frameTextures.isEmpty else {
            print("❌ Failed to extract frames from local sprite sheet")
            completion(nil)
            return
        }
        
        // Create animated sprite
        let spriteNode = SKSpriteNode(texture: frameTextures[0])
        spriteNode.colorBlendFactor = 0.0  // Ensure no color blending affects transparency
        spriteNode.blendMode = .alpha       // Ensure proper transparency handling
        let frameTime = 1.0 / frameRate
        let animateAction = SKAction.animate(with: frameTextures, timePerFrame: frameTime)
        
        if loopAnimation {
            let loopAction = SKAction.repeatForever(animateAction)
            spriteNode.run(loopAction)
        } else {
            spriteNode.run(animateAction)
        }
        
        print("✅ Created local animated sprite with \(frameTextures.count) frames (loop: \(loopAnimation))")
        completion(spriteNode)
    }
    
    /**
     * Load remote sprite sheet from R2 storage
     */
    private func loadRemoteSpriteSheet(
        monsterName: String,
        animationType: String,
        frameRate: Double,
        loopAnimation: Bool,
        completion: @escaping (SKSpriteNode?) -> Void
    ) {
        print("🎬 Loading remote sprite sheet for \(monsterName) \(animationType)")
        
        // Load metadata first
        loadMetadata(monsterName: monsterName, animationType: animationType) { metadata in
            guard let metadata = metadata else {
                print("❌ Failed to load metadata")
                completion(nil)
                return
            }
            
            // Load sprite sheet
            self.loadSpriteSheet(metadata: metadata) { spriteSheetData in
                guard let spriteSheetData = spriteSheetData else {
                    print("❌ Failed to load sprite sheet")
                    completion(nil)
                    return
                }
                
                // Create animated sprite from sprite sheet
                self.createAnimatedSprite(
                    spriteSheetData: spriteSheetData,
                    metadata: metadata,
                    frameRate: frameRate,
                    loopAnimation: loopAnimation,
                    completion: completion
                )
            }
        }
    }
    
    /**
     * Load sprite sheet and return individual frame textures for step-through mode
     * Downloads metadata → downloads sprite sheet → extracts frames → returns textures
     */
    func loadFrameTextures(
        monsterName: String,
        animationType: String,
        completion: @escaping ([SKTexture]?) -> Void
    ) {
        print("🎬 Loading frame textures for \(monsterName) \(animationType)")
        
        // Load metadata first
        loadMetadata(monsterName: monsterName, animationType: animationType) { metadata in
            guard let metadata = metadata else {
                print("❌ Failed to load metadata")
                completion(nil)
                return
            }
            
            // Load sprite sheet
            self.loadSpriteSheet(metadata: metadata) { spriteSheetData in
                guard let spriteSheetData = spriteSheetData else {
                    print("❌ Failed to load sprite sheet")
                    completion(nil)
                    return
                }
                
                // Extract frame textures
                self.extractFrameTexturesOnly(
                    spriteSheetData: spriteSheetData,
                    metadata: metadata,
                    completion: completion
                )
            }
        }
    }
    
    // MARK: - Private Methods
    
    private func loadMetadata(
        monsterName: String,
        animationType: String,
        completion: @escaping (SpriteMetadata?) -> Void
    ) {
        let metadataURL = generateMetadataURL(monsterName: monsterName, animationType: animationType)
        
        URLSession.shared.dataTask(with: metadataURL) { data, response, error in
            guard let data = data,
                  let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                print("❌ Failed to load metadata from \(metadataURL.absoluteString)")
                completion(nil)
                return
            }
            
            do {
                let metadata = try JSONDecoder().decode(SpriteMetadata.self, from: data)
                print("✅ Loaded metadata: \(metadata.frameCount) frames")
                completion(metadata)
            } catch {
                print("❌ Failed to decode metadata: \(error)")
                completion(nil)
            }
        }.resume()
    }
    
    private func loadSpriteSheet(
        metadata: SpriteMetadata,
        completion: @escaping (Data?) -> Void
    ) {
        let spriteSheetURL = generateSpriteSheetURL(metadata: metadata)
        
        URLSession.shared.dataTask(with: spriteSheetURL) { data, response, error in
            guard let data = data,
                  let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                print("❌ Failed to load sprite sheet from \(spriteSheetURL.absoluteString)")
                completion(nil)
                return
            }
            
            print("✅ Loaded sprite sheet: \(data.count) bytes")
            completion(data)
        }.resume()
    }
    
    private func createAnimatedSprite(
        spriteSheetData: Data,
        metadata: SpriteMetadata,
        frameRate: Double,
        loopAnimation: Bool,
        completion: @escaping (SKSpriteNode?) -> Void
    ) {
        guard let image = createImage(from: spriteSheetData) else {
            print("❌ Failed to create image from sprite sheet data")
            completion(nil)
            return
        }
        
        let spriteSheetTexture = createTexture(from: image)
        let frameTextures = extractFrames(from: spriteSheetTexture, metadata: metadata)
        
        guard !frameTextures.isEmpty else {
            print("❌ Failed to extract frames")
            completion(nil)
            return
        }
        
        // Create animated sprite
        let spriteNode = SKSpriteNode(texture: frameTextures[0])
        spriteNode.colorBlendFactor = 0.0  // Ensure no color blending affects transparency
        spriteNode.blendMode = .alpha       // Ensure proper transparency handling
        let frameTime = 1.0 / frameRate
        let animateAction = SKAction.animate(with: frameTextures, timePerFrame: frameTime)
        
        if loopAnimation {
            let loopAction = SKAction.repeatForever(animateAction)
            spriteNode.run(loopAction)
        } else {
            spriteNode.run(animateAction)
        }
        
        print("✅ Created animated sprite with \(frameTextures.count) frames (loop: \(loopAnimation))")
        completion(spriteNode)
    }
    
    /**
     * Extract individual frame textures from sprite sheet
     * Uses exact frame positions from metadata for perfect accuracy
     */
    private func extractFrames(from spriteSheetTexture: SKTexture, metadata: SpriteMetadata) -> [SKTexture] {
        let sheetWidth = spriteSheetTexture.size().width
        let sheetHeight = spriteSheetTexture.size().height
        
        var frameTextures: [SKTexture] = []
        
        print("🎬 Extracting frames for \(metadata.monsterType) \(metadata.animationType)")
        print("📊 Total frames in metadata: \(metadata.frames.count)")
        print("📊 Frame extraction order:")
        
        // Use the exact frame positions from metadata
        for (arrayIndex, frameData) in metadata.frames.enumerated() {
            print("  Array[\(arrayIndex)] -> Index[\(frameData.index)] at (\(frameData.x), \(frameData.y))")
            
            let normalizedX = CGFloat(frameData.x) / sheetWidth
            let normalizedY = CGFloat(frameData.y) / sheetHeight
            let normalizedWidth = CGFloat(frameData.width) / sheetWidth
            let normalizedHeight = CGFloat(frameData.height) / sheetHeight
            
            let textureRect = CGRect(
                x: normalizedX,
                y: normalizedY,
                width: normalizedWidth,
                height: normalizedHeight
            )
            
            let frameTexture = SKTexture(rect: textureRect, in: spriteSheetTexture)
            frameTextures.append(frameTexture)
            
            // Debug: Check if frames are actually different
            if arrayIndex < 5 { // Only check first 5 frames to avoid spam
                print("    Frame \(arrayIndex) texture rect: \(textureRect)")
                print("    Frame \(arrayIndex) texture size: \(frameTexture.size())")
                print("    Frame \(arrayIndex) normalized coords: (\(normalizedX), \(normalizedY)) size: (\(normalizedWidth), \(normalizedHeight))")
                
                // Check if this frame's rect is different from previous frames
                if arrayIndex > 0 {
                    let prevFrameData = metadata.frames[arrayIndex - 1]
                    let prevNormalizedX = CGFloat(prevFrameData.x) / sheetWidth
                    let prevNormalizedY = CGFloat(prevFrameData.y) / sheetHeight
                    
                    if normalizedX == prevNormalizedX && normalizedY == prevNormalizedY {
                        print("    🚨 Frame \(arrayIndex) has SAME COORDINATES as frame \(arrayIndex - 1)")
                    }
                }
            }
        }
        
        print("🎬 Animation sequence will play frames in this order:")
        for (textureIndex, _) in frameTextures.enumerated() {
            let frameData = metadata.frames[textureIndex]
            print("  Animation[\(textureIndex)] -> Frame[\(frameData.index)]")
        }
        
        return frameTextures
    }
    
    private func extractFrameTexturesOnly(
        spriteSheetData: Data,
        metadata: SpriteMetadata,
        completion: @escaping ([SKTexture]?) -> Void
    ) {
        guard let image = createImage(from: spriteSheetData) else {
            print("❌ Failed to create image from sprite sheet data")
            completion(nil)
            return
        }
        
        let spriteSheetTexture = createTexture(from: image)
        let frameTextures = extractFrames(from: spriteSheetTexture, metadata: metadata)
        
        guard !frameTextures.isEmpty else {
            print("❌ Failed to extract frames")
            completion(nil)
            return
        }
        
        print("✅ Extracted \(frameTextures.count) frame textures")
        completion(frameTextures)
    }
    
    private func createImage(from data: Data) -> Any? {
        #if canImport(UIKit)
        return UIImage(data: data)
        #elseif canImport(AppKit)
        return NSImage(data: data)
        #else
        return nil
        #endif
    }
    
    private func createTexture(from image: Any) -> SKTexture {
        #if canImport(UIKit)
        guard let uiImage = image as? UIImage else {
            fatalError("Expected UIImage but got \(type(of: image))")
        }
        
        // Create texture with explicit transparency handling
        let texture = SKTexture(image: uiImage)
        texture.filteringMode = .nearest  // Prevents blurring that can affect transparency
        
        return texture
        #elseif canImport(AppKit)
        guard let nsImage = image as? NSImage else {
            fatalError("Expected NSImage but got \(type(of: image))")
        }
        
        let texture = SKTexture(image: nsImage)
        texture.filteringMode = .nearest
        
        return texture
        #else
        fatalError("Unsupported platform")
        #endif
    }
    
    private func generateSpriteSheetURL(metadata: SpriteMetadata) -> URL {
        let fileName = "\(metadata.monsterType)_\(metadata.animationType)_spritesheet.png"
        let urlString = "https://\(bucketDomain)/\(basePath)/\(metadata.monsterType)/\(metadata.animationType)/\(fileName)"
        return URL(string: urlString)!
    }
    
    private func generateMetadataURL(monsterName: String, animationType: String) -> URL {
        let fileName = "\(monsterName)_\(animationType)_spritesheet_metadata.json"
        let urlString = "https://\(bucketDomain)/\(basePath)/\(monsterName)/\(animationType)/\(fileName)"
        return URL(string: urlString)!
    }
    
    /**
     * Load local image from bundle
     */
    private func loadLocalImage(named name: String) -> Any? {
        #if canImport(UIKit)
        return UIImage(named: name)
        #elseif canImport(AppKit)
        return NSImage(named: name)
        #else
        return nil
        #endif
    }
}

// MARK: - Sprite Metadata Model

struct SpriteMetadata: Codable {
    let monsterType: String
    let animationType: String
    let frameCount: Int
    let frameWidth: Int
    let frameHeight: Int
    let sheetWidth: Int
    let sheetHeight: Int
    let frameRate: Double
    let createdAt: String
    let frames: [FrameData]
}

struct FrameData: Codable {
    let index: Int
    let name: String
    let x: Int
    let y: Int
    let width: Int
    let height: Int
    let duration: Double
}
