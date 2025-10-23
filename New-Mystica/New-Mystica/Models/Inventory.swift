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
struct EnhancedPlayerItem: APIModel, Hashable {
    let id: String
    let baseType: String
    let itemTypeId: String
    let category: String
    let level: Int
    let rarity: String
    let appliedMaterials: [ItemMaterialApplication]
    let materials: [ItemMaterialApplication]
    let computedStats: ItemStats
    let materialComboHash: String?
    let generatedImageUrl: String?
    let imageGenerationStatus: ImageGenerationStatus?
    let craftCount: Int
    let isStyled: Bool
    let isEquipped: Bool
    let equippedSlot: String?

    enum CodingKeys: String, CodingKey {
        case id
        case baseType = "base_type"
        case itemTypeId = "item_type_id"
        case category
        case level
        case rarity
        case appliedMaterials = "applied_materials"
        case materials
        case computedStats = "computed_stats"
        case materialComboHash = "material_combo_hash"
        case generatedImageUrl = "generated_image_url"
        case imageGenerationStatus = "image_generation_status"
        case craftCount = "craft_count"
        case isStyled = "is_styled"
        case isEquipped = "is_equipped"
        case equippedSlot = "equipped_slot"
    }

    // MARK: - Hashable Conformance
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: EnhancedPlayerItem, rhs: EnhancedPlayerItem) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Applied Material Model
/// Material applied to a specific item slot
struct ItemMaterialApplication: APIModel, Hashable {
    struct MaterialDetail: Codable, Hashable {
        let id: String
        let name: String
        let description: String?
        let styleId: String
        let statModifiers: StatModifier?
        let imageUrl: String?

        enum CodingKeys: String, CodingKey {
            case id
            case name
            case description
            case styleId = "style_id"
            case statModifiers = "stat_modifiers"
            case imageUrl = "image_url"
        }
    }

    let materialId: String
    let styleId: String
    let slotIndex: Int
    let appliedAt: String?
    let material: MaterialDetail?

    enum CodingKeys: String, CodingKey {
        case materialId = "material_id"
        case styleId = "style_id"
        case slotIndex = "slot_index"
        case appliedAt = "applied_at"
        case material
    }

    init(
        materialId: String,
        styleId: String,
        slotIndex: Int,
        appliedAt: String? = nil,
        material: MaterialDetail? = nil
    ) {
        self.materialId = materialId
        self.styleId = styleId
        self.slotIndex = slotIndex
        self.appliedAt = appliedAt
        self.material = material
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        slotIndex = try container.decode(Int.self, forKey: .slotIndex)
        appliedAt = try container.decodeIfPresent(String.self, forKey: .appliedAt)
        material = try container.decodeIfPresent(MaterialDetail.self, forKey: .material)

        if let explicitMaterialId = try container.decodeIfPresent(String.self, forKey: .materialId) {
            materialId = explicitMaterialId
        } else if let material {
            materialId = material.id
        } else {
            throw DecodingError.keyNotFound(
                CodingKeys.materialId,
                DecodingError.Context(
                    codingPath: container.codingPath,
                    debugDescription: "Missing material identifier in ItemMaterialApplication payload"
                )
            )
        }

        if let explicitStyleId = try container.decodeIfPresent(String.self, forKey: .styleId) {
            styleId = explicitStyleId
        } else if let material {
            styleId = material.styleId
        } else {
            throw DecodingError.keyNotFound(
                CodingKeys.styleId,
                DecodingError.Context(
                    codingPath: container.codingPath,
                    debugDescription: "Missing style identifier in ItemMaterialApplication payload"
                )
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(materialId, forKey: .materialId)
        try container.encode(styleId, forKey: .styleId)
        try container.encode(slotIndex, forKey: .slotIndex)
        try container.encodeIfPresent(appliedAt, forKey: .appliedAt)
        try container.encodeIfPresent(material, forKey: .material)
    }
}

// MARK: - Material Template Model
/// Material template from seed data
struct MaterialTemplate: APIModel {
    let id: String
    let name: String
    let description: String?
    let statModifiers: StatModifier
    let baseDropWeight: Int
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case statModifiers = "stat_modifiers"
        case baseDropWeight = "base_drop_weight"
        case createdAt = "created_at"
    }
}

// MARK: - Material Stack Model
/// Player's material inventory with stacking
struct MaterialInventoryStack: APIModel, Hashable {
    let materialId: String
    let name: String
    let styleId: String
    let quantity: Int
    let theme: String
    let statModifiers: StatModifier
    let imageUrl: String?

    // Nested material object from backend API
    struct MaterialDetail: Codable, Hashable {
        let id: String
        let name: String
        let statModifiers: StatModifier
        let description: String?
        let baseDropWeight: Int
        let imageUrl: String?

        enum CodingKeys: String, CodingKey {
            case id, name, description
            case statModifiers = "stat_modifiers"
            case baseDropWeight = "base_drop_weight"
            case imageUrl = "image_url"
        }
    }

    let material: MaterialDetail

    // Custom init for decoding from API
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        materialId = try container.decode(String.self, forKey: .materialId)
        styleId = try container.decode(String.self, forKey: .styleId)
        quantity = try container.decode(Int.self, forKey: .quantity)

        // Decode nested material object
        material = try container.decode(MaterialDetail.self, forKey: .material)

        // Extract fields from nested material for convenience
        name = material.name
        imageUrl = material.imageUrl
        statModifiers = material.statModifiers

        // Theme is not in the API response, use empty string as default
        theme = ""
    }

    // Manual init for testing/previews
    init(materialId: String, name: String, styleId: String, quantity: Int, theme: String, statModifiers: StatModifier, imageUrl: String?, material: MaterialDetail) {
        self.materialId = materialId
        self.name = name
        self.styleId = styleId
        self.quantity = quantity
        self.theme = theme
        self.statModifiers = statModifiers
        self.imageUrl = imageUrl
        self.material = material
    }

    enum CodingKeys: String, CodingKey {
        case materialId = "material_id"
        case name
        case styleId = "style_id"
        case quantity
        case theme
        case statModifiers = "stat_modifiers"
        case imageUrl = "image_url"
        case material
    }

    // MARK: - Hashable Conformance
    func hash(into hasher: inout Hasher) {
        hasher.combine(materialId)
        hasher.combine(styleId)
    }

    static func == (lhs: MaterialInventoryStack, rhs: MaterialInventoryStack) -> Bool {
        lhs.materialId == rhs.materialId && lhs.styleId == rhs.styleId
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

// MARK: - Filtering and Sorting Enums

/// Filter options for inventory items
enum InventoryFilter: String, CaseIterable {
    case all = "all"
    case styled = "styled"
    case unstyled = "unstyled"
    case weapons = "weapon"
    case armor = "armor"
    case head = "head"
    case feet = "feet"
    case offhand = "offhand"
    case accessories = "accessory"
    case pets = "pet"

    var displayName: String {
        switch self {
        case .all: return "All"
        case .styled: return "Styled"
        case .unstyled: return "Unstyled"
        case .weapons: return "Weapons"
        case .armor: return "Armor"
        case .head: return "Head"
        case .feet: return "Feet"
        case .offhand: return "Offhand"
        case .accessories: return "Accessories"
        case .pets: return "Pets"
        }
    }

    var isSlotFilter: Bool {
        switch self {
        case .all, .styled, .unstyled:
            return false
        default:
            return true
        }
    }
}

/// Sort options for inventory items
enum InventorySortOption: String, CaseIterable {
    case levelDesc = "level_desc"
    case levelAsc = "level_asc"
    case nameAsc = "name_asc"
    case nameDesc = "name_desc"
    case rarityDesc = "rarity_desc"
    case rarityAsc = "rarity_asc"
    case dateDesc = "date_desc"
    case dateAsc = "date_asc"

    var displayName: String {
        switch self {
        case .levelDesc: return "Level (High-Low)"
        case .levelAsc: return "Level (Low-High)"
        case .nameAsc: return "Name (A-Z)"
        case .nameDesc: return "Name (Z-A)"
        case .rarityDesc: return "Rarity (Best-Worst)"
        case .rarityAsc: return "Rarity (Worst-Best)"
        case .dateDesc: return "Newest First"
        case .dateAsc: return "Oldest First"
        }
    }
}
