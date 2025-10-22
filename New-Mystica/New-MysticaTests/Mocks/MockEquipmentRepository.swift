//
//  MockEquipmentRepository.swift
//  New-MysticaTests
//
//  Mock implementation of EquipmentRepository for testing
//

import Foundation
@testable import New_Mystica

class MockEquipmentRepository: EquipmentRepository {

    // MARK: - Configuration Properties
    var shouldFailFetch = false
    var shouldFailEquip = false
    var shouldFailUnequip = false
    var fetchDelayMs: Int = 0
    var equipDelayMs: Int = 0
    var unequipDelayMs: Int = 0

    // MARK: - Mock Data
    var mockEquipment: [Equipment] = [Equipment.testData()]

    // MARK: - Call Tracking
    var fetchEquipmentCallCount = 0
    var equipItemCallCount = 0
    var unequipItemCallCount = 0
    var lastEquippedSlot: String?
    var lastEquippedItemId: String?
    var lastUnequippedSlot: String?

    // MARK: - EquipmentRepository Implementation

    func fetchEquipment() async throws -> [Equipment] {
        fetchEquipmentCallCount += 1

        if fetchDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(fetchDelayMs * 1_000_000))
        }

        if shouldFailFetch {
            throw AppError.networkError(URLError(.timedOut))
        }

        return mockEquipment
    }

    func equipItem(slotName: String, itemId: String) async throws {
        equipItemCallCount += 1
        lastEquippedSlot = slotName
        lastEquippedItemId = itemId

        if equipDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(equipDelayMs * 1_000_000))
        }

        if shouldFailEquip {
            throw AppError.serverError(400, "Cannot equip item to slot \(slotName)")
        }
    }

    func unequipItem(slotName: String) async throws {
        unequipItemCallCount += 1
        lastUnequippedSlot = slotName

        if unequipDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(unequipDelayMs * 1_000_000))
        }

        if shouldFailUnequip {
            throw AppError.serverError(400, "Cannot unequip item from slot \(slotName)")
        }
    }

    // MARK: - Test Helpers

    func reset() {
        shouldFailFetch = false
        shouldFailEquip = false
        shouldFailUnequip = false
        fetchDelayMs = 0
        equipDelayMs = 0
        unequipDelayMs = 0
        fetchEquipmentCallCount = 0
        equipItemCallCount = 0
        unequipItemCallCount = 0
        lastEquippedSlot = nil
        lastEquippedItemId = nil
        lastUnequippedSlot = nil
        mockEquipment = [Equipment.testData()]
    }
}

// MARK: - Test Data Extensions

extension Equipment {
    static func testData(
        slots: EquipmentSlots = EquipmentSlots.testData(),
        totalStats: ItemStats = ItemStats.testData(),
        equipmentCount: Int = 3,
        generatedImageUrl: String? = "https://example.com/equipment_image.png"
    ) -> Equipment {
        return Equipment(
            slots: slots,
            totalStats: totalStats,
            equipmentCount: equipmentCount,
            generatedImageUrl: generatedImageUrl
        )
    }
}

extension EquipmentSlots {
    static func testData(
        weapon: PlayerItem? = PlayerItem.testData(equipmentSlot: "weapon"),
        offhand: PlayerItem? = nil,
        head: PlayerItem? = PlayerItem.testData(equipmentSlot: "head"),
        armor: PlayerItem? = PlayerItem.testData(equipmentSlot: "armor"),
        feet: PlayerItem? = nil,
        accessory1: PlayerItem? = nil,
        accessory2: PlayerItem? = nil,
        pet: PlayerItem? = nil
    ) -> EquipmentSlots {
        return EquipmentSlots(
            weapon: weapon,
            offhand: offhand,
            head: head,
            armor: armor,
            feet: feet,
            accessory1: accessory1,
            accessory2: accessory2,
            pet: pet
        )
    }
}

extension ItemStats {
    static func testData(
        atkPower: Double = 15.0,
        atkAccuracy: Double = 85.0,
        defPower: Double = 12.0,
        defAccuracy: Double = 80.0
    ) -> ItemStats {
        return ItemStats(
            atkPower: atkPower,
            atkAccuracy: atkAccuracy,
            defPower: defPower,
            defAccuracy: defAccuracy
        )
    }
}

extension PlayerItem {
    static func testData(
        id: UUID = UUID(),
        userId: UUID = UUID(),
        itemTypeId: UUID = UUID(),
        level: Int = 5,
        baseStats: ItemStats = ItemStats.testData(),
        currentStats: ItemStats = ItemStats.testData(),
        materialComboHash: String? = "hash123",
        imageUrl: String? = "https://example.com/item.png",
        equipmentSlot: String = "weapon",
        itemType: ItemType? = nil,
        createdAt: String = "2024-01-01T00:00:00Z",
        updatedAt: String = "2024-01-01T00:00:00Z"
    ) -> PlayerItem {
        let testItemType = itemType ?? ItemType.testData(equipmentSlot: equipmentSlot)
        return PlayerItem(
            id: id,
            userId: userId,
            itemTypeId: itemTypeId,
            level: level,
            baseStats: baseStats,
            currentStats: currentStats,
            materialComboHash: materialComboHash,
            imageUrl: imageUrl,
            itemType: testItemType,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
}

extension ItemType {
    static func testData(
        id: UUID = UUID(),
        name: String = "Iron Sword",
        category: String = "Weapon",
        equipmentSlot: String = "weapon",
        baseStats: ItemStats = ItemStats.testData(),
        rarity: String = "common",
        imageUrl: String? = "https://example.com/iron_sword.png",
        description: String? = "A sturdy iron sword"
    ) -> ItemType {
        return ItemType(
            id: id,
            name: name,
            category: category,
            equipmentSlot: equipmentSlot,
            baseStats: baseStats,
            rarity: rarity,
            imageUrl: imageUrl,
            description: description
        )
    }
}