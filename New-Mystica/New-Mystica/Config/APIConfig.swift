//
//  APIConfig.swift
//  New-Mystica
//
//  Configuration management for API endpoints and environment settings
//  Supports both DEBUG and RELEASE builds, with environment variable overrides
//

import Foundation

struct APIConfig {
    /// API base URL - loaded from build configuration via Info.plist
    /// Can be overridden via environment variable API_BASE_URL for testing
    static let baseURL: String = {
        // Log build configuration
        #if DEBUG
        print("🏗️ [APIConfig] Build Configuration: DEBUG")
        #else
        print("🏗️ [APIConfig] Build Configuration: RELEASE")
        #endif

        // Check for environment variable override first (for testing/debugging)
        if let envURL = ProcessInfo.processInfo.environment["API_BASE_URL"] {
            print("🔧 [APIConfig] Using API_BASE_URL from environment: \(envURL)")
            return envURL
        }

        // Read from Info.plist (set by xcconfig build configuration)
        if let bundleURL = Bundle.main.infoDictionary?["APIBaseURL"] as? String {
            print("🔧 [APIConfig] Using API_BASE_URL from build configuration: \(bundleURL)")
            return bundleURL
        }

        // No fallback - crash if configuration is missing
        fatalError("❌ [APIConfig] CRITICAL: API_BASE_URL not configured. Check Info.plist and build configuration.")
    }()

    /// R2 Asset CDN base URL
    static let r2BaseURL: String = "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev"

    /// Request timeout in seconds
    static let requestTimeout: TimeInterval = 30.0

    /// Enable network request logging
    static let enableNetworkLogging: Bool = {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }()
}
