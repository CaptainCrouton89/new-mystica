//
//  User.swift
//  New-Mystica
//
//  Created by Claude Code
//

import Foundation

struct User: Codable {
    let id: UUID
    let deviceId: String?
    let accountType: String
    let email: String?
    let vanityLevel: Int?
    let avgItemLevel: Float?
    let createdAt: Date
    let lastLogin: Date?

    // Custom decoding to handle backend's snake_case JSON
    init(from decoder: Decoder) throws {
        // Use a dynamic container that looks for snake_case keys directly
        let container = try decoder.container(keyedBy: DynamicCodingKeys.self)

        // Required fields
        id = try container.decode(UUID.self, forKey: DynamicCodingKeys(stringValue: "id")!)
        accountType = try container.decode(String.self, forKey: DynamicCodingKeys(stringValue: "account_type")!)

        // Optional fields (backend may not include these for anonymous users)
        deviceId = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "device_id")!)
        email = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "email")!)
        vanityLevel = try container.decodeIfPresent(Int.self, forKey: DynamicCodingKeys(stringValue: "vanity_level")!)
        avgItemLevel = try container.decodeIfPresent(Float.self, forKey: DynamicCodingKeys(stringValue: "avg_item_level")!)

        // Dates - handle ISO8601 strings
        if let createdAtString = try? container.decode(String.self, forKey: DynamicCodingKeys(stringValue: "created_at")!) {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: createdAtString) {
                createdAt = date
            } else {
                // Try without fractional seconds
                formatter.formatOptions = [.withInternetDateTime]
                createdAt = formatter.date(from: createdAtString) ?? Date()
            }
        } else {
            createdAt = Date() // Fallback
        }

        if let lastLoginString = try? container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "last_login")!) {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            lastLogin = formatter.date(from: lastLoginString ?? "")
        } else {
            lastLogin = nil
        }
    }

    // Encoding (if needed)
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: DynamicCodingKeys.self)
        try container.encode(id, forKey: DynamicCodingKeys(stringValue: "id")!)
        try container.encode(accountType, forKey: DynamicCodingKeys(stringValue: "account_type")!)
        try container.encodeIfPresent(deviceId, forKey: DynamicCodingKeys(stringValue: "device_id")!)
        try container.encodeIfPresent(email, forKey: DynamicCodingKeys(stringValue: "email")!)
        try container.encodeIfPresent(vanityLevel, forKey: DynamicCodingKeys(stringValue: "vanity_level")!)
        try container.encodeIfPresent(avgItemLevel, forKey: DynamicCodingKeys(stringValue: "avg_item_level")!)
        // Dates would need custom formatting here if encoding is needed
    }
}

// Dynamic coding keys for runtime key lookup
struct DynamicCodingKeys: CodingKey {
    var stringValue: String
    var intValue: Int?

    init?(stringValue: String) {
        self.stringValue = stringValue
        self.intValue = nil
    }

    init?(intValue: Int) {
        self.stringValue = "\(intValue)"
        self.intValue = intValue
    }
}