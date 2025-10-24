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
    let username: String?
    let vanityLevel: Int?
    let avgItemLevel: Float?
    let gold: Int?
    let gems: Int?
    let totalStats: Stats?
    let level: Int?
    let xp: Int?
    let createdAt: Date
    let lastLogin: Date?

    // Proper CodingKeys enum for snake_case JSON mapping
    enum CodingKeys: String, CodingKey {
        case id
        case deviceId = "device_id"
        case accountType = "account_type"
        case email
        case username
        case vanityLevel = "vanity_level"
        case avgItemLevel = "avg_item_level"
        case gold
        case gems
        case totalStats = "total_stats"
        case level
        case xp
        case createdAt = "created_at"
        case lastLogin = "last_login"
    }

    struct Stats: Codable {
        let atkPower: Int
        let atkAccuracy: Int
        let defPower: Int
        let defAccuracy: Int
    }

    // Custom decoding to handle backend's snake_case JSON and date formatting
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Required fields - throw if missing
        id = try container.decode(UUID.self, forKey: .id)
        accountType = try container.decode(String.self, forKey: .accountType)

        // Optional fields (backend may not include these for anonymous users)
        deviceId = try container.decodeIfPresent(String.self, forKey: .deviceId)
        email = try container.decodeIfPresent(String.self, forKey: .email)
        username = try container.decodeIfPresent(String.self, forKey: .username)
        vanityLevel = try container.decodeIfPresent(Int.self, forKey: .vanityLevel)
        avgItemLevel = try container.decodeIfPresent(Float.self, forKey: .avgItemLevel)
        gold = try container.decodeIfPresent(Int.self, forKey: .gold)
        gems = try container.decodeIfPresent(Int.self, forKey: .gems)
        totalStats = try container.decodeIfPresent(Stats.self, forKey: .totalStats)
        level = try container.decodeIfPresent(Int.self, forKey: .level)
        xp = try container.decodeIfPresent(Int.self, forKey: .xp)

        // Dates - required field, throw if missing or invalid format
        let createdAtString = try container.decode(String.self, forKey: .createdAt)
        let formatter = ISO8601DateFormatter()

        // Try multiple formats to handle backend variations
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: createdAtString) {
            createdAt = date
        } else if let date = formatter.date(from: createdAtString + "Z") {
            // Try adding Z if missing (backend sends without Z)
            createdAt = date
        } else {
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: createdAtString) {
                createdAt = date
            } else if let date = formatter.date(from: createdAtString + "Z") {
                createdAt = date
            } else {
                throw DecodingError.dataCorruptedError(
                    forKey: .createdAt,
                    in: container,
                    debugDescription: "Invalid ISO8601 date format: '\(createdAtString)'"
                )
            }
        }

        // Last login is optional
        if let lastLoginString = try container.decodeIfPresent(String.self, forKey: .lastLogin) {
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: lastLoginString) {
                lastLogin = date
            } else if let date = formatter.date(from: lastLoginString + "Z") {
                // Try adding Z if missing (backend sends without Z)
                lastLogin = date
            } else {
                // Try without fractional seconds
                formatter.formatOptions = [.withInternetDateTime]
                if let date = formatter.date(from: lastLoginString) {
                    lastLogin = date
                } else if let date = formatter.date(from: lastLoginString + "Z") {
                    lastLogin = date
                } else {
                    throw DecodingError.dataCorruptedError(
                        forKey: .lastLogin,
                        in: container,
                        debugDescription: "Invalid ISO8601 date format: '\(lastLoginString)'"
                    )
                }
            }
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
        try container.encodeIfPresent(username, forKey: .username)
        try container.encodeIfPresent(vanityLevel, forKey: .vanityLevel)
        try container.encodeIfPresent(avgItemLevel, forKey: .avgItemLevel)
        try container.encodeIfPresent(gold, forKey: .gold)
        try container.encodeIfPresent(gems, forKey: .gems)
        try container.encodeIfPresent(totalStats, forKey: .totalStats)
        try container.encodeIfPresent(level, forKey: .level)
        try container.encodeIfPresent(xp, forKey: .xp)

        // Encode dates as ISO8601 strings
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        try container.encode(formatter.string(from: createdAt), forKey: .createdAt)
        if let lastLogin = lastLogin {
            try container.encode(formatter.string(from: lastLogin), forKey: .lastLogin)
        }
    }
}