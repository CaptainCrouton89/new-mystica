//
//  ImageCacheManager.swift
//  New-Mystica
//
//  Manages aggressive image caching for R2 assets
//  Configures URLCache with large limits for fast image loading
//

import Foundation

@MainActor
class ImageCacheManager {
    static let shared = ImageCacheManager()

    private(set) var urlSession: URLSession!

    private init() {
        configure()
    }

    func configure() {
        // Create large URLCache for image caching
        // 128MB memory cache, 512MB disk cache
        let memoryCapacity = 128 * 1024 * 1024  // 128 MB
        let diskCapacity = 512 * 1024 * 1024    // 512 MB

        let cache = URLCache(
            memoryCapacity: memoryCapacity,
            diskCapacity: diskCapacity
        )

        // Configure URLSession with aggressive caching
        let configuration = URLSessionConfiguration.default
        configuration.urlCache = cache
        configuration.requestCachePolicy = .returnCacheDataElseLoad

        // Set reasonable timeouts
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 60

        urlSession = URLSession(configuration: configuration)

        if APIConfig.enableNetworkLogging {
            print("🖼️ ImageCacheManager configured with \(memoryCapacity / 1024 / 1024)MB memory, \(diskCapacity / 1024 / 1024)MB disk cache")
        }
    }

    /// Clear all cached images
    func clearCache() {
        urlSession.configuration.urlCache?.removeAllCachedResponses()
        if APIConfig.enableNetworkLogging {
            print("🖼️ ImageCacheManager: Cache cleared")
        }
    }

    /// Get current cache usage statistics
    func getCacheUsage() -> (memoryUsage: Int, diskUsage: Int) {
        guard let cache = urlSession.configuration.urlCache else {
            return (0, 0)
        }
        return (cache.currentMemoryUsage, cache.currentDiskUsage)
    }
}
