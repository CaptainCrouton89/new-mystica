//
//  PlayerItemBuilder.swift
//  New-MysticaTests
//
//  Builder pattern for creating PlayerItem test data with fluent interface
//

import Foundation
@testable import New_Mystica

class PlayerItemBuilder {
    private var id = "550e8400-e29b-41d4-a716-446655440000"
    private var itemType: ItemType? = nil
    private var level = 1
    private var rarity = "common"
    private var appliedMaterials: [String] = []
    private var isStyled = false
    private var computedStats = ItemStats.testData()
    private var isEquipped = false
    private var generatedImageUrl: String? = nil

    init() {}

    // MARK: - Builder Methods

    func withId(_ id: String) -> PlayerItemBuilder {
        self.id = id
        return self
    }

    func withLevel(_ level: Int) -> PlayerItemBuilder {
        self.level = level
        return self
    }

    func withRarity(_ rarity: String) -> PlayerItemBuilder {
        self.rarity = rarity
        return self
    }

    func withAppliedMaterials(_ materials: [String]) -> PlayerItemBuilder {
        self.appliedMaterials = materials
        return self
    }

    func withComputedStats(_ stats: ItemStats) -> PlayerItemBuilder {
        self.computedStats = stats
        return self
    }

    func withIsStyled(_ styled: Bool) -> PlayerItemBuilder {
        self.isStyled = styled
        return self
    }

    func withIsEquipped(_ equipped: Bool) -> PlayerItemBuilder {
        self.isEquipped = equipped
        return self
    }

    func withGeneratedImageUrl(_ url: String?) -> PlayerItemBuilder {
        self.generatedImageUrl = url
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
        self.computedStats = ItemStats(atkPower: 0.4, atkAccuracy: 0.95, defPower: 0.25, defAccuracy: 0.90)
        return self
    }

    func withWeakStats() -> PlayerItemBuilder {
        self.computedStats = ItemStats(atkPower: 0.1, atkAccuracy: 0.60, defPower: 0.05, defAccuracy: 0.55)
        return self
    }

    func withMaterials() -> PlayerItemBuilder {
        self.appliedMaterials = ["material_1"]
        self.isStyled = true
        return self
    }

    // MARK: - Build Method

    func build() -> PlayerItem {
        let finalItemType = itemType ?? ItemTypeBuilder().build()

        return PlayerItem(
            id: id,
            baseType: finalItemType.name.lowercased(),
            itemTypeId: finalItemType.id,
            category: finalItemType.category,
            level: level,
            rarity: rarity,
            appliedMaterials: appliedMaterials,
            isStyled: isStyled,
            computedStats: computedStats,
            isEquipped: isEquipped,
            generatedImageUrl: generatedImageUrl,
            name: finalItemType.name,
            description: finalItemType.description
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
    private var id = "550e8400-e29b-41d4-a716-446655440001"
    private var name = "Test Item"
    private var category = "Weapon"
    private var equipmentSlot = "weapon"
    private var baseStats = ItemStats.testData()
    private var rarity = "common"
    private var description = "A test item"

    init() {}

    func withId(_ id: String) -> ItemTypeBuilder {
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

    func withDescription(_ description: String) -> ItemTypeBuilder {
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