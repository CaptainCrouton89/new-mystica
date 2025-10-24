//
//  PlayerItem.swift
//  New-Mystica
//
//  Created by Claude Code
//

import Foundation

struct PlayerItem: Codable, Sendable {
    let id: String
    let name: String
    let description: String?
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
        case name = "name"
        case description = "description"
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

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        id = try container.decode(String.self, forKey: .id)
        baseType = try container.decode(String.self, forKey: .baseType)
        itemTypeId = try container.decode(String.self, forKey: .itemTypeId)
        category = try container.decode(String.self, forKey: .category)
        level = try container.decode(Int.self, forKey: .level)
        rarity = try container.decode(String.self, forKey: .rarity)
        appliedMaterials = try container.decode([String].self, forKey: .appliedMaterials)
        isStyled = try container.decode(Bool.self, forKey: .isStyled)
        computedStats = try container.decode(ItemStats.self, forKey: .computedStats)
        isEquipped = try container.decode(Bool.self, forKey: .isEquipped)
        generatedImageUrl = try container.decodeIfPresent(String.self, forKey: .generatedImageUrl)

        // Name is now required
        name = try container.decode(String.self, forKey: .name)
        description = try container.decodeIfPresent(String.self, forKey: .description)
    }

    // Convenience initializer for backward compatibility with existing code
    init(
        id: String,
        baseType: String,
        itemTypeId: String,
        category: String,
        level: Int,
        rarity: String,
        appliedMaterials: [String],
        isStyled: Bool,
        computedStats: ItemStats,
        isEquipped: Bool,
        generatedImageUrl: String?,
        name: String,
        description: String? = nil
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.baseType = baseType
        self.itemTypeId = itemTypeId
        self.category = category
        self.level = level
        self.rarity = rarity
        self.appliedMaterials = appliedMaterials
        self.isStyled = isStyled
        self.computedStats = computedStats
        self.isEquipped = isEquipped
        self.generatedImageUrl = generatedImageUrl
    }
}

struct ItemType: Codable, Sendable {
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

struct ItemStats: Codable, Hashable, Sendable {
    let atkPower: Double
    let atkAccuracy: Double
    let defPower: Double
    let defAccuracy: Double

    enum CodingKeys: String, CodingKey {
        case atkPower, atkAccuracy, defPower, defAccuracy
    }
}

// MARK: - ItemStats Helper Methods for CraftingViewModel

extension ItemStats {
    /// Convert ItemStats to dictionary for stat modification calculations
    func toDictionary() -> [String: Double] {
        return [
            "atkPower": atkPower,
            "atkAccuracy": atkAccuracy,
            "defPower": defPower,
            "defAccuracy": defAccuracy
        ]
    }

    /// Create ItemStats from dictionary after applying material modifiers
    static func fromDictionary(_ dict: [String: Double]) throws -> ItemStats {
        guard let atkPower = dict["atkPower"] else {
            throw DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "Missing atkPower"))
        }
        guard let atkAccuracy = dict["atkAccuracy"] else {
            throw DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "Missing atkAccuracy"))
        }
        guard let defPower = dict["defPower"] else {
            throw DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "Missing defPower"))
        }
        guard let defAccuracy = dict["defAccuracy"] else {
            throw DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "Missing defAccuracy"))
        }

        return ItemStats(
            atkPower: atkPower,
            atkAccuracy: atkAccuracy,
            defPower: defPower,
            defAccuracy: defAccuracy
        )
    }
}
