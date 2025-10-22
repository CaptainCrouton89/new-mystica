//
//  APIConfig.swift
//  New-Mystica
//
//  Configuration management for API endpoints and environment settings
//  Supports both DEBUG and RELEASE builds, with environment variable overrides
//

import Foundation

struct APIConfig {
    /// API base URL - can be overridden via environment variable API_BASE_URL
    static let baseURL: String = {
        // Check for environment variable override first
        if let envURL = ProcessInfo.processInfo.environment["API_BASE_URL"] {
            return envURL
        }

        // Use build configuration defaults
        #if DEBUG
        // Development: local server
        return "http://localhost:3000/api/v1"
        #else
        // Production: live API
        return "https://api.mystica.cloud/api/v1"
        #endif
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
