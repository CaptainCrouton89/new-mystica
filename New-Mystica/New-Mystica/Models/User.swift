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

    // Proper CodingKeys enum for snake_case JSON mapping
    enum CodingKeys: String, CodingKey {
        case id
        case deviceId = "device_id"
        case accountType = "account_type"
        case email
        case vanityLevel = "vanity_level"
        case avgItemLevel = "avg_item_level"
        case createdAt = "created_at"
        case lastLogin = "last_login"
    }

    // Custom decoding to handle backend's snake_case JSON and date formatting
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Required fields
        id = try container.decode(UUID.self, forKey: .id)
        accountType = try container.decode(String.self, forKey: .accountType)

        // Optional fields (backend may not include these for anonymous users)
        deviceId = try container.decodeIfPresent(String.self, forKey: .deviceId)
        email = try container.decodeIfPresent(String.self, forKey: .email)
        vanityLevel = try container.decodeIfPresent(Int.self, forKey: .vanityLevel)
        avgItemLevel = try container.decodeIfPresent(Float.self, forKey: .avgItemLevel)

        // Dates - handle ISO8601 strings
        if let createdAtString = try? container.decode(String.self, forKey: .createdAt) {
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

        if let lastLoginString = try? container.decodeIfPresent(String.self, forKey: .lastLogin) {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            lastLogin = formatter.date(from: lastLoginString ?? "")
        } else {
            lastLogin = nil
        }
    }

    // Encoding using proper CodingKeys
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(accountType, forKey: .accountType)
        try container.encodeIfPresent(deviceId, forKey: .deviceId)
        try container.encodeIfPresent(email, forKey: .email)
        try container.encodeIfPresent(vanityLevel, forKey: .vanityLevel)
        try container.encodeIfPresent(avgItemLevel, forKey: .avgItemLevel)

        // Encode dates as ISO8601 strings
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        try container.encode(formatter.string(from: createdAt), forKey: .createdAt)
        if let lastLogin = lastLogin {
            try container.encode(formatter.string(from: lastLogin), forKey: .lastLogin)
        }
    }
}