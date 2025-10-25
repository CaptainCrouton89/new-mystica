//
//  SpriteMetadataLoader.swift
//  New-Mystica
//
//  Created by AI Assistant on 1/25/25.
//

import Foundation

/**
 * SpriteMetadataLoader - Helper for loading sprite metadata from JSON files
 * 
 * ESSENTIAL FUNCTIONALITY:
 * - Load sprite metadata from JSON files in the app bundle
 * - Provide convenient methods for common sprite metadata loading patterns
 * - Handle JSON parsing errors gracefully
 * 
 * USAGE: SpriteMetadataLoader.loadMetadata(for: "SkeletonSprite")
 */
struct SpriteMetadataLoader {
    
    /**
     * Load sprite metadata from JSON file in app bundle
     * 
     * - Parameter spriteName: Name of the sprite (without extension)
     * - Returns: SpriteMetadata object if successful, nil if failed
     */
    static func loadMetadata(for spriteName: String) -> SpriteMetadata? {
        guard let url = Bundle.main.url(forResource: "\(spriteName)_metadata", withExtension: "json") else {
            print("❌ Failed to find metadata file: \(spriteName)_metadata.json")
            return nil
        }
        
        do {
            let data = try Data(contentsOf: url)
            let metadata = try JSONDecoder().decode(SpriteMetadata.self, from: data)
            print("✅ Loaded metadata for \(spriteName): \(metadata.frameCount) frames")
            return metadata
        } catch {
            print("❌ Failed to load metadata for \(spriteName): \(error)")
            return nil
        }
    }
    
    /**
     * Load sprite metadata asynchronously
     * 
     * - Parameter spriteName: Name of the sprite (without extension)
     * - Parameter completion: Completion handler with SpriteMetadata or nil
     */
    static func loadMetadataAsync(for spriteName: String, completion: @escaping (SpriteMetadata?) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            let metadata = loadMetadata(for: spriteName)
            DispatchQueue.main.async {
                completion(metadata)
            }
        }
    }
    
    /**
     * Check if metadata file exists for a sprite
     * 
     * - Parameter spriteName: Name of the sprite (without extension)
     * - Returns: True if metadata file exists, false otherwise
     */
    static func metadataExists(for spriteName: String) -> Bool {
        return Bundle.main.url(forResource: "\(spriteName)_metadata", withExtension: "json") != nil
    }
    
    /**
     * Get list of all available sprite metadata files
     * 
     * - Returns: Array of sprite names that have metadata files
     */
    static func availableSprites() -> [String] {
        guard let bundleURL = Bundle.main.resourceURL else { return [] }
        
        do {
            let files = try FileManager.default.contentsOfDirectory(at: bundleURL, includingPropertiesForKeys: nil)
            let metadataFiles = files.compactMap { url -> String? in
                let filename = url.lastPathComponent
                if filename.hasSuffix("_metadata.json") {
                    return String(filename.dropLast("_metadata.json".count))
                }
                return nil
            }
            return metadataFiles
        } catch {
            print("❌ Failed to list metadata files: \(error)")
            return []
        }
    }
}
