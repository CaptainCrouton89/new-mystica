//
//  UserProfile.swift
//  New-Mystica
//
//  Extended user profile information
//

import Foundation

struct UserProfile: Codable {
    let userId: UUID
    let username: String
    let currencyBalance: Int
    let vanityLevel: Int
    let avgItemLevel: Float
    let createdAt: Date
    let lastLogin: Date?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case username
        case currencyBalance = "currency_balance"
        case vanityLevel = "vanity_level"
        case avgItemLevel = "avg_item_level"
        case createdAt = "created_at"
        case lastLogin = "last_login"
    }
}
