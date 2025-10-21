//
//  KeychainService.swift
//  New-Mystica
//
//  Secure token storage using iOS Keychain Services
//  Stores JWT access tokens and device ID for Mystica authentication
//

import Security
import Foundation

/// Errors that can occur during Keychain operations
enum KeychainError: Error {
    case saveFailed(OSStatus)
    case getFailed(OSStatus)
    case deleteFailed(OSStatus)

    var localizedDescription: String {
        switch self {
        case .saveFailed(let status):
            return "Failed to save to keychain: \(status)"
        case .getFailed(let status):
            return "Failed to get from keychain: \(status)"
        case .deleteFailed(let status):
            return "Failed to delete from keychain: \(status)"
        }
    }
}

/// Lightweight Keychain wrapper for secure storage of authentication tokens
enum KeychainService {

    // MARK: - Constants

    /// Service identifier for Mystica app keychain items
    private static let service = "com.mystica.app"

    // MARK: - Key Constants

    /// Keychain key for JWT access token storage
    static let accessTokenKey = "mystica_access_token"

    /// Keychain key for device ID storage
    static let deviceIdKey = "mystica_device_id"

    // MARK: - Public Methods

    /// Save a string value to the keychain
    /// - Parameters:
    ///   - key: The key to store the value under
    ///   - value: The string value to store
    /// - Throws: KeychainError.saveFailed if the operation fails
    static func save(key: String, value: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw KeychainError.saveFailed(errSecParam)
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]

        // Delete existing item first to avoid duplicates
        SecItemDelete(query as CFDictionary)

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status)
        }
    }

    /// Retrieve a string value from the keychain
    /// - Parameter key: The key to retrieve the value for
    /// - Returns: The stored string value, or nil if not found
    static func get(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }

        return value
    }

    /// Delete a value from the keychain
    /// - Parameter key: The key to delete
    /// - Throws: KeychainError.deleteFailed if the operation fails
    static func delete(key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed(status)
        }
    }

    /// Clear all Mystica-related items from the keychain
    /// This removes all stored tokens and device information
    static func clearAll() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service
        ]

        // Ignore the return status - clearing may fail if no items exist
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - Convenience Methods

extension KeychainService {

    /// Save the JWT access token to keychain
    /// - Parameter token: The JWT token to store
    /// - Throws: KeychainError.saveFailed if the operation fails
    static func saveAccessToken(_ token: String) throws {
        try save(key: accessTokenKey, value: token)
    }

    /// Retrieve the stored JWT access token
    /// - Returns: The stored JWT token, or nil if not found
    static func getAccessToken() -> String? {
        return get(key: accessTokenKey)
    }

    /// Delete the stored JWT access token
    /// - Throws: KeychainError.deleteFailed if the operation fails
    static func deleteAccessToken() throws {
        try delete(key: accessTokenKey)
    }

    /// Save the device ID to keychain
    /// - Parameter deviceId: The device UUID to store
    /// - Throws: KeychainError.saveFailed if the operation fails
    static func saveDeviceId(_ deviceId: String) throws {
        try save(key: deviceIdKey, value: deviceId)
    }

    /// Retrieve the stored device ID
    /// - Returns: The stored device ID, or nil if not found
    static func getDeviceId() -> String? {
        return get(key: deviceIdKey)
    }

    /// Delete the stored device ID
    /// - Throws: KeychainError.deleteFailed if the operation fails
    static func deleteDeviceId() throws {
        try delete(key: deviceIdKey)
    }
}