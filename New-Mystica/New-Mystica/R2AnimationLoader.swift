//
//  R2AnimationLoader.swift
//  New-Mystica
//
//  Created by AI Assistant on 1/25/25.
//

import Foundation

/**
 * R2AnimationLoader - Helper class for loading sprite animations from Cloudflare R2
 * Provides utilities for generating R2 URLs and loading sprite frames
 */
class R2AnimationLoader {
    
    // MARK: - Configuration
    
    static let shared = R2AnimationLoader()
    
    // Replace with your actual R2 bucket configuration
    private let bucketName = "mystica-sprites"
    private let bucketDomain = "pub-1234567890abcdef.r2.dev" // Replace with your R2 public domain
    private let basePath = "sprites"
    
    private init() {}
    
    // MARK: - URL Generation
    
    /**
     * Generate R2 URLs for a sprite animation sequence
     * 
     * - Parameters:
     *   - enemyType: Type of enemy (e.g., "birdman")
     *   - animationType: Type of animation (e.g., "attack", "idle", "walk")
     *   - frameCount: Number of frames in the animation
     * - Returns: Array of R2 URLs for the sprite frames
     */
    func generateSpriteURLs(
        enemyType: String,
        animationType: String,
        frameCount: Int
    ) -> [URL] {
        var urls: [URL] = []
        
        for frameIndex in 1...frameCount {
            let frameNumber = String(format: "%04d", frameIndex)
            let fileName = "frame_\(frameNumber).png"
            let urlString = "https://\(bucketDomain)/\(basePath)/\(enemyType)/\(animationType)/\(fileName)"
            
            if let url = URL(string: urlString) {
                urls.append(url)
            }
        }
        
        return urls
    }
    
    /**
     * Generate R2 URLs for a specific sprite animation
     * 
     * - Parameters:
     *   - animationPath: Path to the animation (e.g., "birdman/attack")
     *   - frameCount: Number of frames in the animation
     * - Returns: Array of R2 URLs for the sprite frames
     */
    func generateSpriteURLs(
        animationPath: String,
        frameCount: Int
    ) -> [URL] {
        var urls: [URL] = []
        
        for frameIndex in 1...frameCount {
            let frameNumber = String(format: "%04d", frameIndex)
            let fileName = "frame_\(frameNumber).png"
            let urlString = "https://\(bucketDomain)/\(basePath)/\(animationPath)/\(fileName)"
            
            if let url = URL(string: urlString) {
                urls.append(url)
            }
        }
        
        return urls
    }
    
    /**
     * Generate R2 URL for a single sprite frame
     * 
     * - Parameters:
     *   - enemyType: Type of enemy
     *   - animationType: Type of animation
     *   - frameIndex: Frame number (1-based)
     * - Returns: R2 URL for the sprite frame
     */
    func generateSpriteURL(
        enemyType: String,
        animationType: String,
        frameIndex: Int
    ) -> URL? {
        let frameNumber = String(format: "%04d", frameIndex)
        let fileName = "frame_\(frameNumber).png"
        let urlString = "https://\(bucketDomain)/\(basePath)/\(enemyType)/\(animationType)/\(fileName)"
        
        return URL(string: urlString)
    }
    
    // MARK: - Animation Metadata
    
    /**
     * Get animation metadata from R2
     * This could be expanded to load animation metadata from a JSON file in R2
     * 
     * - Parameters:
     *   - enemyType: Type of enemy
     *   - animationType: Type of animation
     * - Returns: Animation metadata including frame count, duration, etc.
     */
    func getAnimationMetadata(
        enemyType: String,
        animationType: String
    ) async -> AnimationMetadata? {
        // This could load from a metadata JSON file in R2
        // For now, return default values
        return AnimationMetadata(
            enemyType: enemyType,
            animationType: animationType,
            frameCount: 45, // Default frame count
            duration: 3.0,  // Default duration in seconds
            frameRate: 15.0 // Default frame rate
        )
    }
    
    // MARK: - Caching
    
    /**
     * Check if animation is cached locally
     * 
     * - Parameters:
     *   - enemyType: Type of enemy
     *   - animationType: Type of animation
     * - Returns: True if animation is cached locally
     */
    func isAnimationCached(
        enemyType: String,
        animationType: String
    ) -> Bool {
        // Implement local caching logic here
        // For now, return false (no caching)
        return false
    }
    
    /**
     * Cache animation locally for offline use
     * 
     * - Parameters:
     *   - enemyType: Type of enemy
     *   - animationType: Type of animation
     *   - urls: Array of URLs to cache
     */
    func cacheAnimation(
        enemyType: String,
        animationType: String,
        urls: [URL]
    ) async {
        // Implement local caching logic here
        print("📦 Caching animation: \(enemyType)/\(animationType)")
    }
}

// MARK: - Animation Metadata Model

struct AnimationMetadata: Codable {
    let enemyType: String
    let animationType: String
    let frameCount: Int
    let duration: Double
    let frameRate: Double
    
    var frameURLs: [URL] {
        return R2AnimationLoader.shared.generateSpriteURLs(
            enemyType: enemyType,
            animationType: animationType,
            frameCount: frameCount
        )
    }
}

// MARK: - Usage Examples

extension R2AnimationLoader {
    
    /**
     * Example usage for loading a birdman attack animation
     */
    static func loadBirdmanAttackAnimation() -> [URL] {
        return shared.generateSpriteURLs(
            enemyType: "birdman",
            animationType: "attack",
            frameCount: 45
        )
    }
    
    /**
     * Example usage for loading a specific animation
     */
    static func loadAnimation(animationPath: String, frameCount: Int) -> [URL] {
        return shared.generateSpriteURLs(
            animationPath: animationPath,
            frameCount: frameCount
        )
    }
}
