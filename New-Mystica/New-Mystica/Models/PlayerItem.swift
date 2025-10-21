//
//  PlayerItem.swift
//  New-Mystica
//
//  Created by Claude Code
//

import Foundation

struct PlayerItem: Codable {
    let id: UUID
    let userId: UUID
    let itemTypeId: UUID
    let level: Int
    let baseStats: ItemStats
    let currentStats: ItemStats
    let materialComboHash: String?
    let imageUrl: String?
    let itemType: ItemType?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case itemTypeId = "item_type_id"
        case level
        case baseStats = "base_stats"
        case currentStats = "current_stats"
        case materialComboHash = "material_combo_hash"
        case imageUrl = "image_url"
        case itemType = "item_type"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct ItemType: Codable {
    let id: UUID
    let name: String
    let category: String
    let equipmentSlot: String
    let baseStats: ItemStats
    let rarity: String
    let imageUrl: String?
    let description: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case category
        case equipmentSlot = "equipment_slot"
        case baseStats = "base_stats"
        case rarity
        case imageUrl = "image_url"
        case description
    }
}

struct ItemStats: Codable {
    let atkPower: Double
    let atkAccuracy: Double
    let defPower: Double
    let defAccuracy: Double

    enum CodingKeys: String, CodingKey {
        case atkPower, atkAccuracy, defPower, defAccuracy
    }
}
