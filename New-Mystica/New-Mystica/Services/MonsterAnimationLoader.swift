//
//  MonsterAnimationLoader.swift
//  New-Mystica
//
//  Created by AI Assistant on 1/25/25.
//

import Foundation
import SwiftUI
import Combine

// MARK: - Animation Metadata Models

struct SpriteFrame: Codable {
    let frame: Int
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct SpriteSize: Codable {
    let w: Double
    let h: Double
    
    var cgSize: CGSize {
        CGSize(width: w, height: h)
    }
}

struct SpriteMetadata: Codable {
    let image: String
    let size: SpriteSize
    let frameSize: SpriteSize
    let frameCount: Int
    let cols: Int
    let rows: Int
}

struct AnimationData: Codable {
    let frames: [SpriteFrame]
    let meta: SpriteMetadata
    
    // MARK: - Convenience Initializers
    
    /// Decode from JSON data
    static func from(jsonData: Data) throws -> AnimationData {
        let decoder = JSONDecoder()
        return try decoder.decode(AnimationData.self, from: jsonData)
    }
    
    /// Decode from JSON string
    static func from(jsonString: String) throws -> AnimationData {
        guard let data = jsonString.data(using: .utf8) else {
            throw NSError(domain: "AnimationData", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid JSON string"])
        }
        return try from(jsonData: data)
    }
}

/// Service for loading monster animation data from R2 storage
/// Loads both PNG sprite sheets and JSON animation metadata
///
/// ## Usage
/// ```swift
/// let loader = MonsterAnimationLoader(monsterId: "skeleton", animationType: "idle")
/// await loader.loadAnimation()
/// 
/// if loader.isReady {
///     let animationData = loader.animationData!
///     let spriteImage = loader.spriteImage!
///     // Use with TestAnimationsView
/// }
/// ```
///
/// ## File Structure Expected in R2
/// ```
/// monsters/[MONSTER_ID]/sprites/[ANIMATION_TYPE]_sample1.json
/// monsters/[MONSTER_ID]/sprites/[ANIMATION_TYPE]_sample1.png
/// ```
///
/// ## Example URLs
/// - JSON: `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/monsters/skeleton/sprites/idle_sample1.json`
/// - PNG: `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/monsters/skeleton/sprites/idle_sample1.png`
@MainActor
class MonsterAnimationLoader: ObservableObject {
    
    // MARK: - Published Properties
    
    @Published var animationData: AnimationData?
    @Published var spriteImage: UIImage?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    
    // MARK: - Private Properties
    
    private let monsterId: String 
    private let animationType: String
    private let r2BaseURL = APIConfig.r2BaseURL
    
    // MARK: - Initialization
    
    /// Initialize with hardcoded monster ID and animation type
    init(monsterId: String = "07ba5f91-662d-4820-8a99-eee4c301f2ca", animationType: String = "attack") {
        self.monsterId = monsterId
        self.animationType = animationType
    }
    
    // MARK: - Public Methods
    
    /// Load both JSON animation data and PNG sprite sheet from R2
    func loadAnimation() async {
        isLoading = true
        errorMessage = nil
        
        do {
            // Load JSON animation metadata
            let jsonData = try await loadJSONData()
            animationData = try AnimationData.from(jsonData: jsonData)
            
            // Load PNG sprite sheet
            spriteImage = try await loadSpriteImage()
            
            isLoading = false
            
            if APIConfig.enableNetworkLogging {
                print("✅ [MonsterAnimationLoader] Successfully loaded animation for \(monsterId)/\(animationType)")
                print("📊 [MonsterAnimationLoader] Animation data:")
                print("   - Total frames: \(animationData?.meta.frameCount ?? 0)")
                print("   - Sprite size: \(animationData?.meta.size.w ?? 0) x \(animationData?.meta.size.h ?? 0)")
                print("   - Frame size: \(animationData?.meta.frameSize.w ?? 0) x \(animationData?.meta.frameSize.h ?? 0)")
                print("   - Grid: \(animationData?.meta.cols ?? 0) cols x \(animationData?.meta.rows ?? 0) rows")
                print("   - Image name: \(animationData?.meta.image ?? "unknown")")
                
                // Log first few frames for debugging
                if let frames = animationData?.frames.prefix(3) {
                    print("📋 [MonsterAnimationLoader] First 3 frames:")
                    for frame in frames {
                        print("   Frame \(frame.frame): x=\(frame.x), y=\(frame.y), w=\(frame.width), h=\(frame.height)")
                    }
                }
            }
            
        } catch {
            isLoading = false
            errorMessage = error.localizedDescription
            
            if APIConfig.enableNetworkLogging {
                print("❌ [MonsterAnimationLoader] Failed to load animation: \(error.localizedDescription)")
            }
        }
    }
    
    /// Clear loaded data
    func clearData() {
        animationData = nil
        spriteImage = nil
        errorMessage = nil
    }
    
    // MARK: - Private Methods
    
    /// Load JSON animation metadata from R2
    private func loadJSONData() async throws -> Data {
        let jsonPath = "monsters/\(monsterId)/sprites/\(animationType)_sample1.json"
        let urlString = "\(r2BaseURL)/\(jsonPath)"
        
        guard let url = URL(string: urlString) else {
            throw MonsterAnimationError.invalidURL(urlString)
        }
        
        if APIConfig.enableNetworkLogging {
            print("📤 [MonsterAnimationLoader] Loading JSON from: \(urlString)")
        }
        
        let (data, response) = try await URLSession.shared.data(from: url)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw MonsterAnimationError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw MonsterAnimationError.httpError(httpResponse.statusCode)
        }
        
        return data
    }
    
    /// Load PNG sprite sheet from R2
    private func loadSpriteImage() async throws -> UIImage {
        let imagePath = "monsters/\(monsterId)/sprites/\(animationType)_sample1.png"
        let urlString = "\(r2BaseURL)/\(imagePath)"
        
        guard let url = URL(string: urlString) else {
            throw MonsterAnimationError.invalidURL(urlString)
        }
        
        if APIConfig.enableNetworkLogging {
            print("📤 [MonsterAnimationLoader] Loading image from: \(urlString)")
        }
        
        let (data, response) = try await URLSession.shared.data(from: url)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw MonsterAnimationError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw MonsterAnimationError.httpError(httpResponse.statusCode)
        }
        
        guard let image = UIImage(data: data) else {
            throw MonsterAnimationError.imageDecodingFailed
        }
        
        return image
    }
}

// MARK: - Error Types

enum MonsterAnimationError: LocalizedError {
    case invalidURL(String)
    case invalidResponse
    case httpError(Int)
    case imageDecodingFailed
    
    var errorDescription: String? {
        switch self {
        case .invalidURL(let url):
            return "Invalid URL: \(url)"
        case .invalidResponse:
            return "Invalid HTTP response"
        case .httpError(let statusCode):
            return "HTTP error: \(statusCode)"
        case .imageDecodingFailed:
            return "Failed to decode image data"
        }
    }
}

// MARK: - Convenience Extensions

extension MonsterAnimationLoader {
    
    /// Check if animation data is ready for use
    var isReady: Bool {
        return animationData != nil && spriteImage != nil && !isLoading
    }
    
    /// Get the sprite image name for TestAnimationsView
    var spriteImageName: String? {
        return animationData?.meta.image
    }
}
