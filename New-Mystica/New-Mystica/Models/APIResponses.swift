//
//  APIResponses.swift
//  New-Mystica
//
//  Created by Claude Code
//

import Foundation

// MARK: - Equipment Operation Result
struct EquipResult: Codable {
    let success: Bool
    let unequippedItem: PlayerItem?
    let equippedItem: PlayerItem
    let updatedPlayerStats: PlayerStats
    let message: String?

    enum CodingKeys: String, CodingKey {
        case success
        case unequippedItem = "unequipped_item"
        case equippedItem = "equipped_item"
        case updatedPlayerStats = "updated_player_stats"
        case message
    }
}

// MARK: - Material Application Result
struct ApplyMaterialResult: Codable {
    let success: Bool
    let updatedItem: EnhancedPlayerItem
    let isFirstCraft: Bool
    let craftCount: Int
    let imageUrl: String
    let materialsConsumed: [MaterialStack]
    let message: String?

    enum CodingKeys: String, CodingKey {
        case success
        case updatedItem = "updated_item"
        case isFirstCraft = "is_first_craft"
        case craftCount = "craft_count"
        case imageUrl = "image_url"
        case materialsConsumed = "materials_consumed"
        case message
    }
}

// MARK: - Material Replacement Result
struct ReplaceMaterialResult: Codable {
    let success: Bool
    let updatedItem: PlayerItem
    let goldSpent: Int
    let replacedMaterial: AppliedMaterial
    let refundedMaterial: MaterialStack?
    let message: String?

    enum CodingKeys: String, CodingKey {
        case success
        case updatedItem = "updated_item"
        case goldSpent = "gold_spent"
        case replacedMaterial = "replaced_material"
        case refundedMaterial = "refunded_material"
        case message
    }
}

// MARK: - Item Upgrade Cost Info
struct UpgradeCostInfo: Codable {
    let currentLevel: Int
    let nextLevel: Int
    let goldCost: Int
    let playerGold: Int
    let canAfford: Bool

    enum CodingKeys: String, CodingKey {
        case currentLevel = "current_level"
        case nextLevel = "next_level"
        case goldCost = "gold_cost"
        case playerGold = "player_gold"
        case canAfford = "can_afford"
    }
}

// MARK: - Item Upgrade Result
struct UpgradeResult: Codable {
    let success: Bool
    let item: EnhancedPlayerItem
    let goldSpent: Int
    let newGoldBalance: Int
    let newVanityLevel: Int

    enum CodingKeys: String, CodingKey {
        case success
        case item
        case goldSpent = "gold_spent"
        case newGoldBalance = "new_gold_balance"
        case newVanityLevel = "new_vanity_level"
    }
}

// MARK: - Storage Capacity Details
struct StorageCapacity: Codable {
    let itemsUsed: Int
    let itemsMax: Int
    let materialsUsed: Int
    let materialsMax: Int

    enum CodingKeys: String, CodingKey {
        case itemsUsed = "items_used"
        case itemsMax = "items_max"
        case materialsUsed = "materials_used"
        case materialsMax = "materials_max"
    }
}

// MARK: - Inventory Response
struct InventoryResponse: Codable {
    let items: [EnhancedPlayerItem]
    let pagination: PaginationInfo

    enum CodingKeys: String, CodingKey {
        case items
        case pagination
    }
}

// MARK: - API Error Details
struct ErrorDetail: Codable {
    let code: String
    let message: String
    let details: String?
}

// MARK: - Generic API Response Wrapper
struct ApiResponse<T: Codable>: Codable {
    let success: Bool
    let data: T?
    let error: ErrorDetail?
    let timestamp: String
}