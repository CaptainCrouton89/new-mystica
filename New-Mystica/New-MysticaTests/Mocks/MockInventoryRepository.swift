//
//  MockInventoryRepository.swift
//  New-MysticaTests
//
//  Mock implementation of InventoryRepository for testing
//

import Foundation
@testable import New_Mystica

class MockInventoryRepository: InventoryRepository {

    // MARK: - Configuration Properties
    var shouldFailFetchInventory = false
    var shouldFailFetchMaterials = false
    var shouldFailApplyMaterial = false
    var shouldFailRemoveMaterial = false
    var shouldFailReplaceMaterial = false
    var shouldFailSellItem = false
    var fetchInventoryDelayMs: Int = 0
    var fetchMaterialsDelayMs: Int = 0
    var applyMaterialDelayMs: Int = 0
    var removeMaterialDelayMs: Int = 0
    var replaceMaterialDelayMs: Int = 0
    var sellItemDelayMs: Int = 0

    // MARK: - Mock Data
    var mockInventory: [EnhancedPlayerItem] = [EnhancedPlayerItem.testData()]
    var mockMaterials: [MaterialTemplate] = [MaterialTemplate.testData()]
    var mockGoldEarned: Int = 50
    var mockNewGoldBalance: Int = 500
    var mockPagination: PaginationInfo = PaginationInfo.testData()

    // MARK: - Call Tracking
    var fetchInventoryCallCount = 0
    var fetchMaterialsCallCount = 0
    var applyMaterialCallCount = 0
    var removeMaterialCallCount = 0
    var replaceMaterialCallCount = 0
    var sellItemCallCount = 0
    var fetchUpgradeCostCallCount = 0
    var upgradeItemCallCount = 0
    var lastAppliedMaterialParams: (itemId: String, materialId: String, styleId: String, slotIndex: Int)?
    var lastRemovedMaterialParams: (itemId: String, slotIndex: Int)?
    var lastReplacedMaterialParams: (itemId: String, slotIndex: Int, newMaterialId: String)?
    var lastSoldItemId: String?
    var lastUpgradeCostItemId: String?
    var lastUpgradeItemId: String?

    // MARK: - InventoryRepository Implementation

    func fetchInventory(page: Int = 1, filter: InventoryFilter? = nil, sortOption: InventorySortOption? = nil) async throws -> InventoryResponse {
        fetchInventoryCallCount += 1

        if fetchInventoryDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(fetchInventoryDelayMs * 1_000_000))
        }

        if shouldFailFetchInventory {
            throw AppError.networkError(URLError(.timedOut))
        }

        return InventoryResponse(items: mockInventory, pagination: mockPagination)
    }

    func fetchMaterials() async throws -> [MaterialTemplate] {
        fetchMaterialsCallCount += 1

        if fetchMaterialsDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(fetchMaterialsDelayMs * 1_000_000))
        }

        if shouldFailFetchMaterials {
            throw AppError.networkError(URLError(.timedOut))
        }

        return mockMaterials
    }

    func applyMaterial(itemId: String, materialId: String, styleId: String, slotIndex: Int) async throws -> ApplyMaterialResult {
        applyMaterialCallCount += 1
        lastAppliedMaterialParams = (itemId: itemId, materialId: materialId, styleId: styleId, slotIndex: slotIndex)

        if applyMaterialDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(applyMaterialDelayMs * 1_000_000))
        }

        if shouldFailApplyMaterial {
            throw AppError.serverError(400, "Cannot apply material to item")
        }

        // Return a modified item with the applied material
        var updatedItem = mockInventory.first ?? EnhancedPlayerItem.testData()
        let newMaterial = ItemMaterialApplication(materialId: materialId, styleId: styleId, slotIndex: slotIndex)
        var appliedMaterials = updatedItem.appliedMaterials

        // Add or replace material at slot
        if slotIndex < appliedMaterials.count {
            appliedMaterials[slotIndex] = newMaterial
        } else {
            appliedMaterials.append(newMaterial)
        }

        updatedItem = EnhancedPlayerItem(
            id: updatedItem.id,
            baseType: updatedItem.baseType,
            itemTypeId: updatedItem.itemTypeId,
            category: updatedItem.category,
            level: updatedItem.level,
            rarity: updatedItem.rarity,
            appliedMaterials: appliedMaterials,
            materials: appliedMaterials,
            computedStats: updatedItem.computedStats,
            materialComboHash: "new_hash_\(materialId)",
            generatedImageUrl: updatedItem.generatedImageUrl,
            imageGenerationStatus: .complete,
            craftCount: updatedItem.craftCount + 1,
            isStyled: true,
            isEquipped: updatedItem.isEquipped,
            equippedSlot: updatedItem.equippedSlot
        )

        return ApplyMaterialResult(
            success: true,
            updatedItem: updatedItem,
            isFirstCraft: updatedItem.craftCount == 1,
            craftCount: updatedItem.craftCount,
            imageUrl: updatedItem.generatedImageUrl ?? "https://example.com/test.png",
            materialsConsumed: [],
            message: "Material applied successfully"
        )
    }

    func removeMaterial(itemId: String, slotIndex: Int) async throws -> EnhancedPlayerItem {
        removeMaterialCallCount += 1
        lastRemovedMaterialParams = (itemId: itemId, slotIndex: slotIndex)

        if removeMaterialDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(removeMaterialDelayMs * 1_000_000))
        }

        if shouldFailRemoveMaterial {
            throw AppError.serverError(400, "Cannot remove material from item")
        }

        // Return a modified item with material removed
        var updatedItem = mockInventory.first ?? EnhancedPlayerItem.testData()
        var appliedMaterials = updatedItem.appliedMaterials

        if slotIndex < appliedMaterials.count {
            appliedMaterials.remove(at: slotIndex)
        }

        updatedItem = EnhancedPlayerItem(
            id: updatedItem.id,
            baseType: updatedItem.baseType,
            itemTypeId: updatedItem.itemTypeId,
            category: updatedItem.category,
            level: updatedItem.level,
            rarity: updatedItem.rarity,
            appliedMaterials: appliedMaterials,
            materials: appliedMaterials,
            computedStats: updatedItem.computedStats,
            materialComboHash: appliedMaterials.isEmpty ? nil : "updated_hash",
            generatedImageUrl: updatedItem.generatedImageUrl,
            imageGenerationStatus: .complete,
            craftCount: updatedItem.craftCount,
            isStyled: !appliedMaterials.isEmpty,
            isEquipped: updatedItem.isEquipped,
            equippedSlot: updatedItem.equippedSlot
        )

        return updatedItem
    }

    func replaceMaterial(itemId: String, slotIndex: Int, newMaterialId: String) async throws -> EnhancedPlayerItem {
        replaceMaterialCallCount += 1
        lastReplacedMaterialParams = (itemId: itemId, slotIndex: slotIndex, newMaterialId: newMaterialId)

        if replaceMaterialDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(replaceMaterialDelayMs * 1_000_000))
        }

        if shouldFailReplaceMaterial {
            throw AppError.serverError(400, "Cannot replace material in item")
        }

        // Return a modified item with material replaced
        var updatedItem = mockInventory.first ?? EnhancedPlayerItem.testData()
        var appliedMaterials = updatedItem.appliedMaterials

        if slotIndex < appliedMaterials.count {
            appliedMaterials[slotIndex] = ItemMaterialApplication(
                materialId: newMaterialId,
                styleId: appliedMaterials[slotIndex].styleId,
                slotIndex: slotIndex
            )
        }

        updatedItem = EnhancedPlayerItem(
            id: updatedItem.id,
            baseType: updatedItem.baseType,
            itemTypeId: updatedItem.itemTypeId,
            category: updatedItem.category,
            level: updatedItem.level,
            rarity: updatedItem.rarity,
            appliedMaterials: appliedMaterials,
            materials: appliedMaterials,
            computedStats: updatedItem.computedStats,
            materialComboHash: "replaced_hash_\(newMaterialId)",
            generatedImageUrl: updatedItem.generatedImageUrl,
            imageGenerationStatus: .complete,
            craftCount: updatedItem.craftCount,
            isStyled: true,
            isEquipped: updatedItem.isEquipped,
            equippedSlot: updatedItem.equippedSlot
        )

        return updatedItem
    }

    func sellItem(itemId: String) async throws -> SellItemResponse {
        sellItemCallCount += 1
        lastSoldItemId = itemId

        if sellItemDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(sellItemDelayMs * 1_000_000))
        }

        if shouldFailSellItem {
            throw AppError.serverError(400, "Cannot sell item")
        }

        return SellItemResponse(
            success: true,
            goldEarned: mockGoldEarned,
            newGoldBalance: mockNewGoldBalance,
            itemName: "Test Item"
        )
    }

    func fetchUpgradeCost(itemId: String) async throws -> UpgradeCostInfo {
        fetchUpgradeCostCallCount += 1
        lastUpgradeCostItemId = itemId

        if shouldFailFetchInventory {
            throw AppError.networkError(URLError(.timedOut))
        }

        return UpgradeCostInfo(
            currentLevel: 5,
            nextLevel: 6,
            goldCost: 100,
            playerGold: 500,
            canAfford: true
        )
    }

    func upgradeItem(itemId: String) async throws -> UpgradeResult {
        upgradeItemCallCount += 1
        lastUpgradeItemId = itemId

        if shouldFailFetchInventory {
            throw AppError.networkError(URLError(.timedOut))
        }

        let item = mockInventory.first ?? EnhancedPlayerItem.testData()
        let upgradedItem = EnhancedPlayerItem(
            id: item.id,
            baseType: item.baseType,
            itemTypeId: item.itemTypeId,
            category: item.category,
            level: item.level + 1,
            rarity: item.rarity,
            appliedMaterials: item.appliedMaterials,
            materials: item.materials,
            computedStats: item.computedStats,
            materialComboHash: item.materialComboHash,
            generatedImageUrl: item.generatedImageUrl,
            imageGenerationStatus: item.imageGenerationStatus,
            craftCount: item.craftCount,
            isStyled: item.isStyled,
            isEquipped: item.isEquipped,
            equippedSlot: item.equippedSlot
        )

        return UpgradeResult(
            success: true,
            item: upgradedItem,
            goldSpent: 100,
            newGoldBalance: 400,
            newVanityLevel: 6
        )
    }

    // MARK: - Test Helpers

    func reset() {
        shouldFailFetchInventory = false
        shouldFailFetchMaterials = false
        shouldFailApplyMaterial = false
        shouldFailRemoveMaterial = false
        shouldFailReplaceMaterial = false
        shouldFailSellItem = false
        fetchInventoryDelayMs = 0
        fetchMaterialsDelayMs = 0
        applyMaterialDelayMs = 0
        removeMaterialDelayMs = 0
        replaceMaterialDelayMs = 0
        sellItemDelayMs = 0
        fetchInventoryCallCount = 0
        fetchMaterialsCallCount = 0
        applyMaterialCallCount = 0
        removeMaterialCallCount = 0
        replaceMaterialCallCount = 0
        sellItemCallCount = 0
        lastAppliedMaterialParams = nil
        lastRemovedMaterialParams = nil
        lastReplacedMaterialParams = nil
        lastSoldItemId = nil
        mockInventory = [EnhancedPlayerItem.testData()]
        mockMaterials = [MaterialTemplate.testData()]
        mockGoldEarned = 50
        mockNewGoldBalance = 500
    }
}

// MARK: - Test Data Extensions

extension EnhancedPlayerItem {
    static func testData(
        id: String = "test_item_123",
        name: String = "Test Sword",
        description: String? = "A test sword for testing",
        baseType: String = "sword",
        itemTypeId: String = "sword_001",
        category: String = "weapon",
        level: Int = 5,
        rarity: String = "common",
        appliedMaterials: [ItemMaterialApplication] = [],
        materials: [ItemMaterialApplication] = [],
        computedStats: ItemStats = ItemStats.testData(),
        materialComboHash: String? = nil,
        generatedImageUrl: String? = "https://example.com/item.png",
        imageGenerationStatus: ImageGenerationStatus? = .complete,
        craftCount: Int = 0,
        isStyled: Bool = false,
        isEquipped: Bool = false,
        equippedSlot: String? = nil
    ) -> EnhancedPlayerItem {
        return EnhancedPlayerItem(
            id: id,
            baseType: baseType,
            itemTypeId: itemTypeId,
            category: category,
            level: level,
            rarity: rarity,
            appliedMaterials: appliedMaterials,
            materials: materials.isEmpty ? appliedMaterials : materials,
            computedStats: computedStats,
            materialComboHash: materialComboHash,
            generatedImageUrl: generatedImageUrl,
            imageGenerationStatus: imageGenerationStatus,
            craftCount: craftCount,
            isStyled: isStyled,
            isEquipped: isEquipped,
            equippedSlot: equippedSlot,
            name: name,
            description: description
        )
    }
}

extension ItemMaterialApplication {
    static func testData(
        materialId: String = "material_123",
        styleId: String = "style_1",
        slotIndex: Int = 0
    ) -> ItemMaterialApplication {
        return ItemMaterialApplication(
            materialId: materialId,
            styleId: styleId,
            slotIndex: slotIndex
        )
    }
}

extension MaterialTemplate {
    static func testData(
        id: String = "material_123",
        name: String = "Iron Ore",
        description: String? = "A common metal ore",
        statModifiers: StatModifier = StatModifier.testData(),
        baseDropWeight: Int = 10,
        createdAt: String = "2023-01-01T00:00:00Z"
    ) -> MaterialTemplate {
        return MaterialTemplate(
            id: id,
            name: name,
            description: description,
            statModifiers: statModifiers,
            baseDropWeight: baseDropWeight,
            createdAt: createdAt
        )
    }
}

extension StatModifier {
    static func testData(
        atkPower: Double = 2.0,
        atkAccuracy: Double = 5.0,
        defPower: Double = 1.0,
        defAccuracy: Double = 3.0
    ) -> StatModifier {
        return StatModifier(
            atkPower: atkPower,
            atkAccuracy: atkAccuracy,
            defPower: defPower,
            defAccuracy: defAccuracy
        )
    }
}

extension ItemStats {
    static func testData(
        atkPower: Double = 10.0,
        atkAccuracy: Double = 15.0,
        defPower: Double = 8.0,
        defAccuracy: Double = 12.0
    ) -> ItemStats {
        return ItemStats(
            atkPower: atkPower,
            atkAccuracy: atkAccuracy,
            defPower: defPower,
            defAccuracy: defAccuracy
        )
    }
}

extension PaginationInfo {
    static func testData(
        page: Int = 1,
        limit: Int = 20,
        total: Int = 1,
        hasNext: Bool = false,
        hasPrev: Bool = false
    ) -> PaginationInfo {
        return PaginationInfo(
            page: page,
            limit: limit,
            total: total,
            hasNext: hasNext,
            hasPrev: hasPrev
        )
    }
}

extension InventoryResponse {
    static func testData(
        items: [EnhancedPlayerItem] = [EnhancedPlayerItem.testData()],
        pagination: PaginationInfo = PaginationInfo.testData()
    ) -> InventoryResponse {
        return InventoryResponse(
            items: items,
            pagination: pagination
        )
    }
}