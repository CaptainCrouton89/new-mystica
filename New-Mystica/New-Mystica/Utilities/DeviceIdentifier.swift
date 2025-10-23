//
//  DeviceIdentifier.swift
//  New-Mystica
//
//  Provides a persistent device identifier that survives app reinstalls
//  and simulator resets by storing in UserDefaults.
//

import Foundation
import UIKit

/// Manages persistent device identification for anonymous authentication
enum DeviceIdentifier {
    private static let deviceIdKey = "com.mystica.persistentDeviceId"

    /// Get or create a persistent device identifier
    /// - Returns: UUID string that persists across app launches
    static func getDeviceId() -> String {
        // Check if we already have a persisted device ID
        if let existingId = UserDefaults.standard.string(forKey: deviceIdKey) {
            print("📱 [DEVICE_ID] Using existing persisted device ID: \(existingId)")
            return existingId
        }

        // Try to use identifierForVendor as the initial seed
        // (This is consistent per app installation on real devices)
        let newDeviceId: String
        if let vendorId = UIDevice.current.identifierForVendor?.uuidString {
            print("📱 [DEVICE_ID] Initializing with identifierForVendor: \(vendorId)")
            newDeviceId = vendorId
        } else {
            // Fallback: generate a new UUID if identifierForVendor is unavailable
            // (Can happen on simulator or in rare edge cases)
            newDeviceId = UUID().uuidString
            print("📱 [DEVICE_ID] Generated new fallback UUID: \(newDeviceId)")
        }

        // Persist the device ID
        UserDefaults.standard.set(newDeviceId, forKey: deviceIdKey)
        UserDefaults.standard.synchronize()

        print("✅ [DEVICE_ID] Persisted new device ID to UserDefaults")
        return newDeviceId
    }

    /// Reset the persisted device ID (for testing or logout scenarios)
    /// - Warning: This will create a new anonymous user on next registration
    static func resetDeviceId() {
        UserDefaults.standard.removeObject(forKey: deviceIdKey)
        UserDefaults.standard.synchronize()
        print("🗑️ [DEVICE_ID] Device ID reset - next registration will create new user")
    }

    /// Check if a device ID has been persisted
    static func hasPersistedDeviceId() -> Bool {
        return UserDefaults.standard.string(forKey: deviceIdKey) != nil
    }
}
