//
//  PlayerItem.swift
//  New-Mystica
//
//  Created by Claude Code
//

import Foundation

struct PlayerItem: Codable {
    let id: UUID
    let baseType: String
    let level: Int
    let appliedMaterials: [AppliedMaterial]
    let computedStats: ItemStats
    let materialComboHash: String?
    let generatedImageUrl: String?
    let imageGenerationStatus: String?

    enum CodingKeys: String, CodingKey {
        case id
        case baseType = "base_type"
        case level
        case appliedMaterials = "applied_materials"
        case computedStats = "computed_stats"
        case materialComboHash = "material_combo_hash"
        case generatedImageUrl = "generated_image_url"
        case imageGenerationStatus = "image_generation_status"
    }
}

struct AppliedMaterial: Codable {
    let materialId: String
    let styleId: String
    let slotIndex: Int

    enum CodingKeys: String, CodingKey {
        case materialId = "material_id"
        case styleId = "style_id"
        case slotIndex = "slot_index"
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
