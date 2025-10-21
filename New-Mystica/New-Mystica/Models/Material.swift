//
//  Material.swift
//  New-Mystica
//
//  Created by Claude Code
//

import Foundation

struct Material: Codable {
    let id: UUID
    let name: String
    let rarity: String
    let statModifiers: ItemStats
    let theme: String
    let imageUrl: String?
    let description: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case rarity
        case statModifiers = "stat_modifiers"
        case theme
        case imageUrl = "image_url"
        case description
    }
}

struct AppliedMaterial: Codable {
    let id: UUID
    let materialId: UUID
    let isShiny: Bool
    let slotIndex: Int
    let material: Material

    enum CodingKeys: String, CodingKey {
        case id
        case materialId = "material_id"
        case isShiny = "is_shiny"
        case slotIndex = "slot_index"
        case material
    }
}

struct MaterialStack: Codable {
    let id: UUID
    let userId: UUID
    let materialId: UUID
    let isShiny: Bool
    let quantity: Int
    let material: Material

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case materialId = "material_id"
        case isShiny = "is_shiny"
        case quantity
        case material
    }
}