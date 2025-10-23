//
//  ItemStack.swift
//  New-Mystica
//
//  Item stack models for inventory pagination
//

import Foundation

/// Item stack model for paginated inventory responses
/// Represents stacked items (like materials) returned from the backend
struct ItemStack: Codable {
    let itemTypeId: String
    let level: Int
    let quantity: Int
    let baseStats: ItemStats
    let iconUrl: String

    enum CodingKeys: String, CodingKey {
        case itemTypeId = "item_type_id"
        case level
        case quantity
        case baseStats = "base_stats"
        case iconUrl = "icon_url"
    }
}