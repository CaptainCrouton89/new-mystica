//
//  PlayerItemBuilder.swift
//  New-MysticaTests
//
//  Builder pattern for creating PlayerItem test data with fluent interface
//

import Foundation
@testable import New_Mystica

class PlayerItemBuilder {
    private var id = UUID()
    private var userId = UUID()
    private var itemTypeId = UUID()
    private var level = 1
    private var baseStats = ItemStats.testData()
    private var currentStats = ItemStats.testData()
    private var materialComboHash: String? = nil
    private var imageUrl: String? = nil
    private var itemType: ItemType? = nil
    private var createdAt = "2024-01-01T00:00:00Z"
    private var updatedAt = "2024-01-01T00:00:00Z"

    init() {}

    // MARK: - Builder Methods

    func withId(_ id: UUID) -> PlayerItemBuilder {
        self.id = id
        return self
    }

    func withUserId(_ userId: UUID) -> PlayerItemBuilder {
        self.userId = userId
        return self
    }

    func withLevel(_ level: Int) -> PlayerItemBuilder {
        self.level = level
        return self
    }

    func withBaseStats(_ stats: ItemStats) -> PlayerItemBuilder {
        self.baseStats = stats
        return self
    }

    func withCurrentStats(_ stats: ItemStats) -> PlayerItemBuilder {
        self.currentStats = stats
        return self
    }

    func withMaterialComboHash(_ hash: String?) -> PlayerItemBuilder {
        self.materialComboHash = hash
        return self
    }

    func withImageUrl(_ url: String?) -> PlayerItemBuilder {
        self.imageUrl = url
        return self
    }

    func withItemType(_ itemType: ItemType) -> PlayerItemBuilder {
        self.itemType = itemType
        return self
    }

    func withWeaponType() -> PlayerItemBuilder {
        self.itemType = ItemTypeBuilder()
            .withCategory("Weapon")
            .withEquipmentSlot("weapon")
            .withName("Test Sword")
            .build()
        return self
    }

    func withArmorType() -> PlayerItemBuilder {
        self.itemType = ItemTypeBuilder()
            .withCategory("Armor")
            .withEquipmentSlot("armor")
            .withName("Test Chestplate")
            .build()
        return self
    }

    func withAccessoryType() -> PlayerItemBuilder {
        self.itemType = ItemTypeBuilder()
            .withCategory("Accessory")
            .withEquipmentSlot("accessory_1")
            .withName("Test Ring")
            .build()
        return self
    }

    func withHighLevel() -> PlayerItemBuilder {
        self.level = 15
        return self
    }

    func withLowLevel() -> PlayerItemBuilder {
        self.level = 1
        return self
    }

    func withPowerfulStats() -> PlayerItemBuilder {
        self.baseStats = ItemStats(atkPower: 25.0, atkAccuracy: 90.0, defPower: 20.0, defAccuracy: 85.0)
        self.currentStats = ItemStats(atkPower: 30.0, atkAccuracy: 95.0, defPower: 25.0, defAccuracy: 90.0)
        return self
    }

    func withWeakStats() -> PlayerItemBuilder {
        self.baseStats = ItemStats(atkPower: 5.0, atkAccuracy: 60.0, defPower: 3.0, defAccuracy: 55.0)
        self.currentStats = ItemStats(atkPower: 6.0, atkAccuracy: 65.0, defPower: 4.0, defAccuracy: 60.0)
        return self
    }

    func withMaterials() -> PlayerItemBuilder {
        self.materialComboHash = "enhanced_weapon_123"
        self.imageUrl = "https://example.com/enhanced_weapon.png"
        return self
    }

    func withCreatedAt(_ timestamp: String) -> PlayerItemBuilder {
        self.createdAt = timestamp
        return self
    }

    func withUpdatedAt(_ timestamp: String) -> PlayerItemBuilder {
        self.updatedAt = timestamp
        return self
    }

    // MARK: - Build Method

    func build() -> PlayerItem {
        let finalItemType = itemType ?? ItemTypeBuilder().build()

        return PlayerItem(
            id: id,
            userId: userId,
            itemTypeId: itemTypeId,
            level: level,
            baseStats: baseStats,
            currentStats: currentStats,
            materialComboHash: materialComboHash,
            imageUrl: imageUrl,
            itemType: finalItemType,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }

    // MARK: - Convenience Factory Methods

    static func weapon() -> PlayerItemBuilder {
        return PlayerItemBuilder()
            .withWeaponType()
            .withLevel(5)
    }

    static func armor() -> PlayerItemBuilder {
        return PlayerItemBuilder()
            .withArmorType()
            .withLevel(5)
    }

    static func accessory() -> PlayerItemBuilder {
        return PlayerItemBuilder()
            .withAccessoryType()
            .withLevel(3)
    }

    static func powerfulWeapon() -> PlayerItemBuilder {
        return PlayerItemBuilder()
            .withWeaponType()
            .withHighLevel()
            .withPowerfulStats()
            .withMaterials()
    }

    static func starterItem() -> PlayerItemBuilder {
        return PlayerItemBuilder()
            .withWeaponType()
            .withLowLevel()
            .withWeakStats()
    }
}

// MARK: - ItemTypeBuilder

class ItemTypeBuilder {
    private var id = UUID()
    private var name = "Test Item"
    private var category = "Weapon"
    private var equipmentSlot = "weapon"
    private var baseStats = ItemStats.testData()
    private var rarity = "common"
    private var imageUrl: String? = "https://example.com/item.png"
    private var description: String? = "A test item"

    init() {}

    func withId(_ id: UUID) -> ItemTypeBuilder {
        self.id = id
        return self
    }

    func withName(_ name: String) -> ItemTypeBuilder {
        self.name = name
        return self
    }

    func withCategory(_ category: String) -> ItemTypeBuilder {
        self.category = category
        return self
    }

    func withEquipmentSlot(_ slot: String) -> ItemTypeBuilder {
        self.equipmentSlot = slot
        return self
    }

    func withBaseStats(_ stats: ItemStats) -> ItemTypeBuilder {
        self.baseStats = stats
        return self
    }

    func withRarity(_ rarity: String) -> ItemTypeBuilder {
        self.rarity = rarity
        return self
    }

    func withImageUrl(_ url: String?) -> ItemTypeBuilder {
        self.imageUrl = url
        return self
    }

    func withDescription(_ description: String?) -> ItemTypeBuilder {
        self.description = description
        return self
    }

    func build() -> ItemType {
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

    static func commonWeapon() -> ItemTypeBuilder {
        return ItemTypeBuilder()
            .withName("Iron Sword")
            .withCategory("Weapon")
            .withEquipmentSlot("weapon")
            .withRarity("common")
    }

    static func rareArmor() -> ItemTypeBuilder {
        return ItemTypeBuilder()
            .withName("Enchanted Plate")
            .withCategory("Armor")
            .withEquipmentSlot("armor")
            .withRarity("rare")
            .withBaseStats(ItemStats(atkPower: 0, atkAccuracy: 0, defPower: 15.0, defAccuracy: 80.0))
    }

    static func legendaryAccessory() -> ItemTypeBuilder {
        return ItemTypeBuilder()
            .withName("Ring of Power")
            .withCategory("Accessory")
            .withEquipmentSlot("accessory_1")
            .withRarity("legendary")
            .withBaseStats(ItemStats(atkPower: 10.0, atkAccuracy: 10.0, defPower: 10.0, defAccuracy: 10.0))
    }
}