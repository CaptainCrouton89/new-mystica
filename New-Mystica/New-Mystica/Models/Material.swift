//
//  Material.swift
//  New-Mystica
//
//  Created by Claude Code
//

import Foundation

struct Material: Codable, Sendable {
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

struct AppliedMaterial: Codable, Sendable {
    let id: UUID
    let materialId: UUID
    let styleId: String
    let slotIndex: Int
    let material: Material

    enum CodingKeys: String, CodingKey {
        case id
        case materialId = "material_id"
        case styleId = "style_id"
        case slotIndex = "slot_index"
        case material
    }
}

struct MaterialStack: Codable, Sendable {
    let id: UUID
    let userId: UUID
    let materialId: UUID
    let styleId: String
    let quantity: Int
    let material: Material

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case materialId = "material_id"
        case styleId = "style_id"
        case quantity
        case material
    }
}