//
//  Inventory.swift
//  New-Mystica
//
//  Inventory models for items, materials, and stacking
//

import Foundation

// MARK: - Image Generation Status
enum ImageGenerationStatus: String, Codable, CaseIterable {
    case pending = "pending"
    case generating = "generating"
    case complete = "complete"
    case failed = "failed"
}

// MARK: - Enhanced Player Item Model
/// Enhanced player item model with materials and computed stats
struct EnhancedPlayerItem: APIModel {
    let id: String
    let baseType: String
    let level: Int
    let appliedMaterials: [ItemMaterialApplication]
    let computedStats: ItemStats
    let materialComboHash: String?
    let generatedImageUrl: String?
    let imageGenerationStatus: ImageGenerationStatus?
    let craftCount: Int
    let isStyled: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case baseType = "base_type"
        case level
        case appliedMaterials = "applied_materials"
        case computedStats = "computed_stats"
        case materialComboHash = "material_combo_hash"
        case generatedImageUrl = "generated_image_url"
        case imageGenerationStatus = "image_generation_status"
        case craftCount = "craft_count"
        case isStyled = "is_styled"
    }
}

// MARK: - Applied Material Model
/// Material applied to a specific item slot
struct ItemMaterialApplication: APIModel {
    let materialId: String
    let styleId: String
    let slotIndex: Int

    enum CodingKeys: String, CodingKey {
        case materialId = "material_id"
        case styleId = "style_id"
        case slotIndex = "slot_index"
    }
}

// MARK: - Material Template Model
/// Material template from seed data
struct MaterialTemplate: APIModel {
    let id: String
    let name: String
    let description: String?
    let statModifiers: StatModifier
    let styleId: String
    let theme: String
    let imageUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case statModifiers = "stat_modifiers"
        case styleId = "style_id"
        case theme
        case imageUrl = "image_url"
    }
}

// MARK: - Material Stack Model
/// Player's material inventory with stacking
struct MaterialInventoryStack: APIModel {
    let materialId: String
    let name: String
    let styleId: String
    let quantity: Int
    let theme: String
    let statModifiers: StatModifier

    enum CodingKeys: String, CodingKey {
        case materialId = "material_id"
        case name
        case styleId = "style_id"
        case quantity
        case theme
        case statModifiers = "stat_modifiers"
    }
}

// MARK: - Base Item Type Model
/// Template for item types (not per-player)
struct BaseItem: APIModel {
    let type: String
    let slot: String
    let baseStats: ItemStats
    let description: String?
    let iconUrl: String?

    enum CodingKeys: String, CodingKey {
        case type
        case slot
        case baseStats = "base_stats"
        case description
        case iconUrl = "icon_url"
    }
}