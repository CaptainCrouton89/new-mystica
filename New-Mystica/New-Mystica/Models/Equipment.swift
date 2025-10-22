//
//  Equipment.swift
//  New-Mystica
//
//  Equipment models with loadouts and slot management
//

import Foundation

// MARK: - Slot Name Enum
enum SlotName: String, Codable, CaseIterable {
    case weapon = "weapon"
    case offhand = "offhand"
    case head = "head"
    case armor = "armor"
    case feet = "feet"
    case accessory1 = "accessory_1"
    case accessory2 = "accessory_2"
    case pet = "pet"
}

// MARK: - Equipment Slot Model
struct EquipmentSlotState: APIModel {
    let itemId: String?
    let slot: SlotName
    let statsBonus: ItemStats?

    enum CodingKeys: String, CodingKey {
        case itemId = "item_id"
        case slot
        case statsBonus = "stats_bonus"
    }
}

// MARK: - Equipment State Model
struct EquipmentState: APIModel {
    let slots: [SlotName: EquipmentSlotState]
    let totalStats: ItemStats
    let generatedImageUrl: String?

    /// Computed property for total stats across all equipped items
    var computedTotalStats: ItemStats {
        totalStats // Use the pre-computed total from API
    }

    enum CodingKeys: String, CodingKey {
        case slots
        case totalStats = "total_stats"
        case generatedImageUrl = "generated_image_url"
    }
}

// MARK: - Loadout Model
struct Loadout: APIModel {
    let id: String
    let userId: String
    let name: String
    let slots: [SlotName: String?]
    let isActive: Bool
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case name
        case slots
        case isActive = "is_active"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Legacy Equipment Models (for backward compatibility)
struct EquipmentSlots: APIModel {
    let weapon: PlayerItem?
    let offhand: PlayerItem?
    let head: PlayerItem?
    let armor: PlayerItem?
    let feet: PlayerItem?
    let accessory1: PlayerItem?
    let accessory2: PlayerItem?
    let pet: PlayerItem?

    enum CodingKeys: String, CodingKey {
        case weapon, offhand, head, armor, feet, pet
        case accessory1 = "accessory_1"
        case accessory2 = "accessory_2"
    }
}

struct Equipment: APIModel {
    let slots: EquipmentSlots
    let totalStats: ItemStats
    let equipmentCount: Int
    let generatedImageUrl: String?

    enum CodingKeys: String, CodingKey {
        case slots
        case totalStats = "total_stats"
        case equipmentCount = "equipment_count"
        case generatedImageUrl = "generated_image_url"
    }
}