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
    private let bucketName = "mystica-assets"
    private let bucketDomain = "pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev"
    private let basePath = "monsters/animations"
    
    private init() {}
    
    // MARK: - URL Generation
    
    /**
     * Generate R2 URLs for a sprite animation sequence
     * 
     * - Parameters:
     *   - monsterType: Type of monster (e.g., "doctor")
     *   - animationType: Type of animation (e.g., "attack", "idle", "walk")
     *   - frameCount: Number of frames in the animation
     * - Returns: Array of R2 URLs for the sprite frames
     */
    func generateSpriteURLs(
        monsterType: String,
        animationType: String,
        frameCount: Int
    ) -> [URL] {
        var urls: [URL] = []
        
        for frameIndex in 0..<frameCount {
            let frameNumber = String(format: "%04d", frameIndex)
            let fileName = "frame_\(frameNumber).png"
            let urlString = "https://\(bucketDomain)/\(basePath)/\(monsterType)/\(animationType)/\(fileName)"
            
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
        
        for frameIndex in 0..<frameCount {
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
     * Generate R2 URL for a sprite atlas file
     * 
     * - Parameters:
     *   - monsterType: Type of monster
     *   - animationType: Type of animation
     *   - atlasName: Name of the atlas file (e.g., "idle_samples1.atlas")
     * - Returns: R2 URL for the atlas file
     */
    func generateAtlasURL(
        monsterType: String,
        animationType: String,
        atlasName: String
    ) -> URL? {
        let urlString = "https://\(bucketDomain)/\(basePath)/\(monsterType)/\(animationType)/\(atlasName)"
        return URL(string: urlString)
    }
    
    /**
     * Generate R2 URLs for doctor animations using atlas files
     * 
     * - Parameters:
     *   - animationType: Type of animation ("idle" or "attack")
     * - Returns: R2 URL for the atlas file
     */
    func generateDoctorAtlasURL(animationType: String) -> URL? {
        let atlasName = animationType == "idle" ? "idle_sample1.atlas" : "attack_sample2.atlas"
        let url = generateAtlasURL(
            monsterType: "doctor",
            animationType: animationType,
            atlasName: atlasName
        )
        return url
    }
    
    /**
     * Generate R2 URLs for individual frame images in an atlas directory
     * 
     * - Parameters:
     *   - atlasURL: Base URL of the atlas directory
     *   - frameCount: Number of frames in the animation
     * - Returns: Array of R2 URLs for individual frame images
     */
    func generateAtlasFrameURLs(atlasURL: URL, frameCount: Int) -> [URL] {
        var urls: [URL] = []
        
        for frameIndex in 0..<frameCount {
            let frameNumber = String(format: "%04d", frameIndex)
            let fileName = "frame_\(frameNumber).png"
            let frameURLString = atlasURL.absoluteString + "/" + fileName
            
            if let frameURL = URL(string: frameURLString) {
                urls.append(frameURL)
            }
        }
        
        return urls
    }
    
    /**
     * Generate R2 URLs for doctor animation frames using atlas directory structure
     * 
     * - Parameters:
     *   - animationType: Type of animation ("idle" or "attack")
     *   - frameCount: Number of frames in the animation
     * - Returns: Array of R2 URLs for individual frame images
     */
    func generateDoctorFrameURLs(animationType: String, frameCount: Int) -> [URL] {
        guard let baseAtlasURL = generateDoctorAtlasURL(animationType: animationType) else {
            return []
        }
        
        return generateAtlasFrameURLs(atlasURL: baseAtlasURL, frameCount: frameCount)
    }
    
    /**
     * Dynamically detect the number of available frames by testing URLs
     * 
     * - Parameters:
     *   - atlasURL: Base URL of the atlas directory
     *   - maxFrames: Maximum number of frames to test (default: 100)
     *   - completion: Completion handler with the detected frame count
     */
    func detectFrameCount(
        atlasURL: URL,
        maxFrames: Int = 100,
        completion: @escaping (Int) -> Void
    ) {
        
        let group = DispatchGroup()
        var detectedCount = 0
        var isSearching = true
        
        // Test frames in batches to find the actual count
        for batchStart in stride(from: 0, to: maxFrames, by: 10) {
            guard isSearching else { break }
            
            let batchEnd = min(batchStart + 10, maxFrames)
            var batchFoundAny = false
            
            for frameIndex in batchStart..<batchEnd {
                guard isSearching else { break }
                group.enter()
                
                let frameNumber = String(format: "%04d", frameIndex)
                let fileName = "frame_\(frameNumber).png"
                let frameURLString = atlasURL.absoluteString + "/" + fileName
                
                guard let frameURL = URL(string: frameURLString) else {
                    group.leave()
                    continue
                }
                
                URLSession.shared.dataTask(with: frameURL) { _, response, _ in
                    defer { group.leave() }
                    
                    guard let httpResponse = response as? HTTPURLResponse else { return }
                    
                    if httpResponse.statusCode == 200 {
                        DispatchQueue.main.async {
                            if frameIndex >= detectedCount {
                                detectedCount = frameIndex + 1
                                batchFoundAny = true
                            }
                        }
                    } else {
                        // If we get a 404, this frame doesn't exist
                        DispatchQueue.main.async {
                            if frameIndex == detectedCount {
                                isSearching = false
                            }
                        }
                    }
                }.resume()
            }
            
            // Wait for this batch to complete
            group.wait()
            
            // If no frames found in this batch, we've likely reached the end
            if !batchFoundAny && batchStart > 0 {
                isSearching = false
            }
        }
        
        group.notify(queue: .main) {
            completion(detectedCount)
        }
    }
    
    /**
     * Generate doctor frame URLs with dynamic frame count detection
     * 
     * - Parameters:
     *   - animationType: Type of animation ("idle" or "attack")
     *   - completion: Completion handler with array of frame URLs
     */
    func generateDoctorFrameURLsWithDetection(
        animationType: String,
        completion: @escaping ([URL]) -> Void
    ) {
        guard let baseAtlasURL = generateDoctorAtlasURL(animationType: animationType) else {
            completion([])
            return
        }
        
        detectFrameCount(atlasURL: baseAtlasURL) { frameCount in
            let frameURLs = self.generateAtlasFrameURLs(atlasURL: baseAtlasURL, frameCount: frameCount)
            completion(frameURLs)
        }
    }
    
    // MARK: - Animation Metadata
    
    /**
     * Get animation metadata from R2
     * This could be expanded to load animation metadata from a JSON file in R2
     * 
     * - Parameters:
     *   - monsterType: Type of monster
     *   - animationType: Type of animation
     * - Returns: Animation metadata including frame count, duration, etc.
     */
    func getAnimationMetadata(
        monsterType: String,
        animationType: String
    ) async -> AnimationMetadata? {
        // This could load from a metadata JSON file in R2
        // For now, return default values
        return AnimationMetadata(
            monsterType: monsterType,
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
     *   - monsterType: Type of monster
     *   - animationType: Type of animation
     * - Returns: True if animation is cached locally
     */
    func isAnimationCached(
        monsterType: String,
        animationType: String
    ) -> Bool {
        // Implement local caching logic here
        // For now, return false (no caching)
        return false
    }
    
}

// MARK: - Animation Metadata Model

struct AnimationMetadata: Codable {
    let monsterType: String
    let animationType: String
    let frameCount: Int
    let duration: Double
    let frameRate: Double
    
    var frameURLs: [URL] {
        return R2AnimationLoader.shared.generateSpriteURLs(
            monsterType: monsterType,
            animationType: animationType,
            frameCount: frameCount
        )
    }
}

// MARK: - Usage Examples

extension R2AnimationLoader {
    
    /**
     * Example usage for loading a doctor idle animation atlas
     */
    static func loadDoctorIdleAtlas() -> URL? {
        return shared.generateDoctorAtlasURL(animationType: "idle")
    }
    
    /**
     * Example usage for loading a doctor attack animation atlas
     */
    static func loadDoctorAttackAtlas() -> URL? {
        return shared.generateDoctorAtlasURL(animationType: "attack")
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
    
    /**
     * Example usage for loading doctor animation frames from atlas directory
     */
    static func loadDoctorAnimationFrames(animationType: String, frameCount: Int) -> [URL] {
        return shared.generateDoctorFrameURLs(animationType: animationType, frameCount: frameCount)
    }
}
