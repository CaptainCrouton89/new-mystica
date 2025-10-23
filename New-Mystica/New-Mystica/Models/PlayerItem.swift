//
//  PlayerItem.swift
//  New-Mystica
//
//  Created by Claude Code
//

import Foundation

struct PlayerItem: Codable {
    let id: String
    let baseType: String
    let itemTypeId: String
    let category: String
    let level: Int
    let rarity: String
    let appliedMaterials: [String]
    let isStyled: Bool
    let computedStats: ItemStats
    let isEquipped: Bool
    let generatedImageUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case baseType = "base_type"
        case itemTypeId = "item_type_id"
        case category
        case level
        case rarity
        case appliedMaterials = "applied_materials"
        case isStyled = "is_styled"
        case computedStats = "computed_stats"
        case isEquipped = "is_equipped"
        case generatedImageUrl = "generated_image_url"
    }
}

struct ItemType: Codable {
    let id: String
    let name: String
    let category: String
    let equipmentSlot: String
    let baseStats: ItemStats
    let rarity: String
    let description: String

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case category
        case equipmentSlot = "equipment_slot"
        case baseStats = "base_stats"
        case rarity
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
