//
//  Stats.swift
//  New-Mystica
//
//  Core stat models for player and enemy statistics
//

import Foundation

// MARK: - Core Stats Structure
/// Combat stats used across all entities (players, enemies, items)
/// Note: This extends the existing ItemStats model from PlayerItem.swift
typealias BaseStats = ItemStats

// MARK: - Player Stats Models
/// Player base stats including level and experience
struct PlayerStats: APIModel, Sendable {
    let baseHealth: Int
    let baseAttack: Int
    let baseDefense: Int
    let level: Int
    let experience: Int

    enum CodingKeys: String, CodingKey {
        case baseHealth = "base_health"
        case baseAttack = "base_attack"
        case baseDefense = "base_defense"
        case level
        case experience
    }
}

/// Enemy stats for combat encounters
struct EnemyStats: APIModel, Sendable {
    let level: Int
    let stats: ItemStats
    let goldMin: Int
    let goldMax: Int
    let materialDropPool: [String]

    enum CodingKeys: String, CodingKey {
        case level
        case stats
        case goldMin = "gold_min"
        case goldMax = "gold_max"
        case materialDropPool = "material_drop_pool"
    }
}

/// Material-applied stat bonuses/penalties
struct StatModifier: APIModel, Hashable, Sendable {
    let atkPower: Double
    let atkAccuracy: Double
    let defPower: Double
    let defAccuracy: Double

    enum CodingKeys: String, CodingKey {
        case atkPower, atkAccuracy, defPower, defAccuracy
    }
}

/// Equipment aggregate stats (all equipped items combined)
struct EquipmentStats: APIModel, Sendable {
    let totalStats: ItemStats
    let itemContributions: [String: ItemStats]
    let equippedItemsCount: Int
    let totalItemLevel: Int

    enum CodingKeys: String, CodingKey {
        case totalStats = "total_stats"
        case itemContributions = "item_contributions"
        case equippedItemsCount = "equipped_items_count"
        case totalItemLevel = "total_item_level"
    }
}

// MARK: - StatModifier Helper Methods for CraftingViewModel

extension StatModifier {
    /// Convert StatModifier to dictionary for easy iteration
    func toDictionary() -> [String: Double] {
        return [
            "atkPower": atkPower,
            "atkAccuracy": atkAccuracy,
            "defPower": defPower,
            "defAccuracy": defAccuracy
        ]
    }
}