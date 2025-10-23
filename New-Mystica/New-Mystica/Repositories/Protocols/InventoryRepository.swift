//
//  InventoryRepository.swift
//  New-Mystica
//
//  Protocol for inventory-related API calls
//  Handles player items, material stacks, and material application/removal
//

import Foundation

protocol InventoryRepository {
    /// Fetch all player items (all items are now individual, no stacking)
    /// - Parameters:
    ///   - page: Page number for pagination (default: 1)
    ///   - filter: Filter option for items (default: .all)
    ///   - sortOption: Sort option for items (default: .levelDesc)
    /// - Returns: Complete inventory response with items and pagination info
    func fetchInventory(page: Int, filter: InventoryFilter?, sortOption: InventorySortOption?) async throws -> InventoryResponse

    /// Fetch all material templates (library/catalog)
    func fetchMaterials() async throws -> [MaterialTemplate]

    /// Apply material to item slot - creates crafted item with image generation
    /// - Parameters:
    ///   - itemId: Player item ID to modify
    ///   - materialId: Material template ID from seed data
    ///   - styleId: Style ID from StyleDefinitions table
    ///   - slotIndex: Material slot (0-2) to fill
    /// - Returns: Updated player item with applied material
    func applyMaterial(itemId: String, materialId: String, styleId: String, slotIndex: Int) async throws -> EnhancedPlayerItem

    /// Remove material from item slot - returns material to inventory
    /// - Parameters:
    ///   - itemId: Player item ID to modify
    ///   - slotIndex: Material slot (0-2) to clear
    /// - Returns: Updated player item with material removed
    func removeMaterial(itemId: String, slotIndex: Int) async throws -> EnhancedPlayerItem

    /// Replace existing material in slot - costs gold, returns old material
    /// - Parameters:
    ///   - itemId: Player item ID to modify
    ///   - slotIndex: Material slot (0-2) to replace
    ///   - newMaterialId: New material template ID
    /// - Returns: Updated player item with material replaced
    func replaceMaterial(itemId: String, slotIndex: Int, newMaterialId: String) async throws -> EnhancedPlayerItem
}