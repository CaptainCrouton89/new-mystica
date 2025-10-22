//
//  MockMaterialsRepository.swift
//  New-MysticaTests
//
//  Mock implementation of MaterialsRepository for testing
//

import Foundation
@testable import New_Mystica

class MockMaterialsRepository: MaterialsRepository {

    // MARK: - Configuration Properties
    var shouldFailFetchAllMaterials = false
    var shouldFailFetchMaterialInventory = false
    var shouldFailGetMaterialDetails = false
    var shouldFailFetchMaterialsByRarity = false
    var shouldFailFetchMaterialsByStyle = false
    var fetchAllMaterialsDelayMs: Int = 0
    var fetchMaterialInventoryDelayMs: Int = 0
    var getMaterialDetailsDelayMs: Int = 0
    var fetchMaterialsByRarityDelayMs: Int = 0
    var fetchMaterialsByStyleDelayMs: Int = 0

    // MARK: - Mock Data
    var mockAllMaterials: [MaterialTemplate] = MaterialTemplate.sampleMaterials()
    var mockMaterialInventory: [MaterialInventoryStack] = [MaterialInventoryStack.testData()]
    var mockMaterialDetails: [String: MaterialTemplate] = [:]

    // MARK: - Call Tracking
    var fetchAllMaterialsCallCount = 0
    var fetchMaterialInventoryCallCount = 0
    var getMaterialDetailsCallCount = 0
    var fetchMaterialsByRarityCallCount = 0
    var fetchMaterialsByStyleCallCount = 0
    var lastMaterialDetailsId: String?
    var lastRarityFilter: String?
    var lastStyleFilter: String?

    // MARK: - MaterialsRepository Implementation

    func fetchAllMaterials() async throws -> [MaterialTemplate] {
        fetchAllMaterialsCallCount += 1

        if fetchAllMaterialsDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(fetchAllMaterialsDelayMs * 1_000_000))
        }

        if shouldFailFetchAllMaterials {
            throw AppError.networkError(URLError(.timedOut))
        }

        return mockAllMaterials
    }

    func fetchMaterialInventory() async throws -> [MaterialInventoryStack] {
        fetchMaterialInventoryCallCount += 1

        if fetchMaterialInventoryDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(fetchMaterialInventoryDelayMs * 1_000_000))
        }

        if shouldFailFetchMaterialInventory {
            throw AppError.networkError(URLError(.timedOut))
        }

        return mockMaterialInventory
    }

    func getMaterialDetails(materialId: String) async throws -> MaterialTemplate {
        getMaterialDetailsCallCount += 1
        lastMaterialDetailsId = materialId

        if getMaterialDetailsDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(getMaterialDetailsDelayMs * 1_000_000))
        }

        if shouldFailGetMaterialDetails {
            throw AppError.notFound
        }

        // Return from cache or find in all materials
        if let cachedMaterial = mockMaterialDetails[materialId] {
            return cachedMaterial
        }

        if let material = mockAllMaterials.first(where: { $0.id == materialId }) {
            return material
        }

        // Create a default material if not found
        return MaterialTemplate.testData(id: materialId, name: "Material \(materialId)")
    }

    func fetchMaterialsByRarity(rarity: String) async throws -> [MaterialTemplate] {
        fetchMaterialsByRarityCallCount += 1
        lastRarityFilter = rarity

        if fetchMaterialsByRarityDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(fetchMaterialsByRarityDelayMs * 1_000_000))
        }

        if shouldFailFetchMaterialsByRarity {
            throw AppError.networkError(URLError(.timedOut))
        }

        // Filter materials by rarity
        return mockAllMaterials.filter { material in
            // Assuming materials have a rarity field in theme or description
            material.theme.lowercased().contains(rarity.lowercased()) ||
            material.description?.lowercased().contains(rarity.lowercased()) == true
        }
    }

    func fetchMaterialsByStyle(styleId: String) async throws -> [MaterialTemplate] {
        fetchMaterialsByStyleCallCount += 1
        lastStyleFilter = styleId

        if fetchMaterialsByStyleDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(fetchMaterialsByStyleDelayMs * 1_000_000))
        }

        if shouldFailFetchMaterialsByStyle {
            throw AppError.networkError(URLError(.timedOut))
        }

        // Filter materials by style ID
        return mockAllMaterials.filter { material in
            material.styleId == styleId
        }
    }

    // MARK: - Test Helpers

    func reset() {
        shouldFailFetchAllMaterials = false
        shouldFailFetchMaterialInventory = false
        shouldFailGetMaterialDetails = false
        shouldFailFetchMaterialsByRarity = false
        shouldFailFetchMaterialsByStyle = false
        fetchAllMaterialsDelayMs = 0
        fetchMaterialInventoryDelayMs = 0
        getMaterialDetailsDelayMs = 0
        fetchMaterialsByRarityDelayMs = 0
        fetchMaterialsByStyleDelayMs = 0
        fetchAllMaterialsCallCount = 0
        fetchMaterialInventoryCallCount = 0
        getMaterialDetailsCallCount = 0
        fetchMaterialsByRarityCallCount = 0
        fetchMaterialsByStyleCallCount = 0
        lastMaterialDetailsId = nil
        lastRarityFilter = nil
        lastStyleFilter = nil
        mockAllMaterials = MaterialTemplate.sampleMaterials()
        mockMaterialInventory = [MaterialInventoryStack.testData()]
        mockMaterialDetails.removeAll()
    }

    func addMaterialToInventory(_ material: MaterialInventoryStack) {
        if let existingIndex = mockMaterialInventory.firstIndex(where: {
            $0.materialId == material.materialId && $0.styleId == material.styleId
        }) {
            // Update existing stack
            let existing = mockMaterialInventory[existingIndex]
            mockMaterialInventory[existingIndex] = MaterialInventoryStack(
                materialId: existing.materialId,
                name: existing.name,
                styleId: existing.styleId,
                quantity: existing.quantity + material.quantity,
                theme: existing.theme,
                statModifiers: existing.statModifiers
            )
        } else {
            // Add new stack
            mockMaterialInventory.append(material)
        }
    }

    func consumeMaterial(materialId: String, styleId: String, quantity: Int = 1) {
        if let existingIndex = mockMaterialInventory.firstIndex(where: {
            $0.materialId == materialId && $0.styleId == styleId
        }) {
            let existing = mockMaterialInventory[existingIndex]
            let newQuantity = max(0, existing.quantity - quantity)

            if newQuantity > 0 {
                mockMaterialInventory[existingIndex] = MaterialInventoryStack(
                    materialId: existing.materialId,
                    name: existing.name,
                    styleId: existing.styleId,
                    quantity: newQuantity,
                    theme: existing.theme,
                    statModifiers: existing.statModifiers
                )
            } else {
                mockMaterialInventory.remove(at: existingIndex)
            }
        }
    }
}

// MARK: - Test Data Extensions

extension MaterialInventoryStack {
    static func testData(
        materialId: String = "material_123",
        name: String = "Iron Ore",
        styleId: String = "style_1",
        quantity: Int = 5,
        theme: String = "metal",
        statModifiers: StatModifier = StatModifier.testData()
    ) -> MaterialInventoryStack {
        return MaterialInventoryStack(
            materialId: materialId,
            name: name,
            styleId: styleId,
            quantity: quantity,
            theme: theme,
            statModifiers: statModifiers
        )
    }
}

extension MaterialTemplate {
    static func sampleMaterials() -> [MaterialTemplate] {
        return [
            MaterialTemplate.testData(
                id: "iron_ore",
                name: "Iron Ore",
                description: "Common metal ore with basic stat bonuses",
                statModifiers: StatModifier.testData(atkPower: 2.0, defPower: 1.0),
                styleId: "style_1",
                theme: "metal_common"
            ),
            MaterialTemplate.testData(
                id: "oak_wood",
                name: "Oak Wood",
                description: "Sturdy wood from ancient oak trees",
                statModifiers: StatModifier.testData(atkAccuracy: 3.0, defAccuracy: 2.0),
                styleId: "style_2",
                theme: "wood_common"
            ),
            MaterialTemplate.testData(
                id: "crystal_shard",
                name: "Crystal Shard",
                description: "Rare crystalline material with powerful effects",
                statModifiers: StatModifier.testData(atkPower: 5.0, atkAccuracy: 5.0),
                styleId: "style_3",
                theme: "crystal_rare"
            ),
            MaterialTemplate.testData(
                id: "dragon_scale",
                name: "Dragon Scale",
                description: "Legendary scale with incredible defensive properties",
                statModifiers: StatModifier.testData(defPower: 8.0, defAccuracy: 6.0),
                styleId: "style_4",
                theme: "dragon_legendary"
            ),
            MaterialTemplate.testData(
                id: "leather_hide",
                name: "Leather Hide",
                description: "Flexible leather for lightweight equipment",
                statModifiers: StatModifier.testData(atkAccuracy: 2.0, defAccuracy: 3.0),
                styleId: "style_1",
                theme: "leather_common"
            )
        ]
    }
}