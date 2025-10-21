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
    let vanityLevel: Int
    let avgItemLevel: Float
    let createdAt: Date
    let lastLogin: Date?

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
}