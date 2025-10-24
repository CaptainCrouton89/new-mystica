//
//  Config.swift
//  New-Mystica
//
//  Configuration values for the New-Mystica app
//

import Foundation

struct Config {

    // MARK: - Network Configuration

    /// HTTP status codes that indicate successful responses
    static let successStatusCodes: ClosedRange<Int> = 200...299

    // MARK: - Image Cache Configuration

    /// Memory cache capacity for images (in bytes)
    static let imageCacheMemoryCapacity: Int = 128 * 1024 * 1024  // 128 MB

    /// Disk cache capacity for images (in bytes)
    static let imageCacheDiskCapacity: Int = 512 * 1024 * 1024    // 512 MB

    // MARK: - Background Images Configuration

    /// Base URL for R2 background images
    static let backgroundImageBaseURL: String = "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/backgrounds"

    /// Available background image filenames
    static let backgroundImageFilenames: [String] = [
        "desert-temple.png",
        "post-apocalyptic-ruins.png",
        "enchanted-forest.png",
        "alien-planet.png",
        "tokyo-night.png",
        "haunted-mansion.png",
        "steampunk-factory.png",
        "cyberpunk-city.png",
        "floating-islands.png",
        "underwater-city.png"
    ]

    /// Complete background image URLs
    static let backgroundImageURLs: [String] = backgroundImageFilenames.map { filename in
        "\(backgroundImageBaseURL)/\(filename)"
    }
}