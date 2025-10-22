//
//  MaterialsRepository.swift
//  New-Mystica
//
//  Protocol for materials-related API calls
//  Handles material templates, player material inventory, and filtering
//

import Foundation

protocol MaterialsRepository {
    /// Fetch all material templates from seed data (library/catalog)
    /// - Returns: Array of all available material templates
    func fetchAllMaterials() async throws -> [MaterialTemplate]

    /// Fetch player's material inventory with stacking
    /// - Returns: Array of material stacks with quantities per type/style
    func fetchMaterialInventory() async throws -> [MaterialInventoryStack]

    /// Get detailed information for specific material template
    /// - Parameter materialId: Material template ID to fetch
    /// - Returns: Complete material template with effects and styling info
    func getMaterialDetails(materialId: String) async throws -> MaterialTemplate

    /// Fetch materials filtered by rarity level
    /// - Parameter rarity: Rarity level to filter by (common, uncommon, rare, etc.)
    /// - Returns: Array of material templates matching rarity
    func fetchMaterialsByRarity(rarity: String) async throws -> [MaterialTemplate]

    /// Fetch materials filtered by style support
    /// - Parameter styleId: Style ID to filter by
    /// - Returns: Array of material templates that support the given style
    func fetchMaterialsByStyle(styleId: String) async throws -> [MaterialTemplate]
}