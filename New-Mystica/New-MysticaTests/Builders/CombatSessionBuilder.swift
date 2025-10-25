//
//  CombatSessionBuilder.swift
//  New-MysticaTests
//
//  Builder pattern for creating CombatSession test data with fluent interface
//

import Foundation
@testable import New_Mystica

class CombatSessionBuilder {
    private var sessionId = "session_123"
    private var playerId = "player_123"
    private var enemyId = "enemy_456"
    private var turnNumber = 1
    private var currentTurnOwner = "player"
    private var status = CombatStatus.active
    private var enemy = CombatEnemy.testData()
    private var playerStats = CombatPlayerStats.testData()
    private var weaponConfig = WeaponConfig.testData()
    private var playerHp: Double = 100.0
    private var enemyHp: Double = 80.0
    private var expiresAt: String? = nil

    init() {}

    // MARK: - Builder Methods

    func withSessionId(_ id: String) -> CombatSessionBuilder {
        self.sessionId = id
        return self
    }

    func withPlayerId(_ id: String) -> CombatSessionBuilder {
        self.playerId = id
        return self
    }

    func withEnemyId(_ id: String) -> CombatSessionBuilder {
        self.enemyId = id
        return self
    }

    func withTurnNumber(_ turn: Int) -> CombatSessionBuilder {
        self.turnNumber = turn
        return self
    }

    func withCurrentTurnOwner(_ owner: String) -> CombatSessionBuilder {
        self.currentTurnOwner = owner
        return self
    }

    func withStatus(_ status: CombatStatus) -> CombatSessionBuilder {
        self.status = status
        return self
    }

    func withEnemy(_ enemy: CombatEnemy) -> CombatSessionBuilder {
        self.enemy = enemy
        return self
    }

    func withPlayerStats(_ stats: CombatPlayerStats) -> CombatSessionBuilder {
        self.playerStats = stats
        return self
    }

    func withWeaponConfig(_ config: WeaponConfig) -> CombatSessionBuilder {
        self.weaponConfig = config
        return self
    }

    func withPlayerHp(_ hp: Double) -> CombatSessionBuilder {
        self.playerHp = hp
        return self
    }

    func withEnemyHp(_ hp: Double) -> CombatSessionBuilder {
        self.enemyHp = hp
        return self
    }

    func withExpiresAt(_ timestamp: String?) -> CombatSessionBuilder {
        self.expiresAt = timestamp
        return self
    }

    // MARK: - Convenience Methods

    func asPlayerTurn() -> CombatSessionBuilder {
        return self.withCurrentTurnOwner("player")
    }

    func asEnemyTurn() -> CombatSessionBuilder {
        return self.withCurrentTurnOwner("enemy")
    }

    func asNewCombat() -> CombatSessionBuilder {
        return self
            .withTurnNumber(1)
            .withStatus(.active)
            .withPlayerHp(100.0)
            .asPlayerTurn()
    }

    func asOngoingCombat() -> CombatSessionBuilder {
        return self
            .withTurnNumber(Int.random(in: 5...15))
            .withStatus(.ongoing)
            .withPlayerHp(Double.random(in: 30...80))
            .withEnemyHp(Double.random(in: 20...70))
    }

    func asPlayerVictory() -> CombatSessionBuilder {
        return self
            .withStatus(.victory)
            .withEnemyHp(0.0)
            .withPlayerHp(Double.random(in: 10...60))
    }

    func asPlayerDefeat() -> CombatSessionBuilder {
        return self
            .withStatus(.defeat)
            .withPlayerHp(0.0)
            .withEnemyHp(Double.random(in: 10...60))
    }

    func asRetreated() -> CombatSessionBuilder {
        return self
            .withStatus(.abandoned)
            .withPlayerHp(Double.random(in: 5...40))
            .withEnemyHp(Double.random(in: 20...80))
    }

    func nearlyDefeated() -> CombatSessionBuilder {
        return self
            .withPlayerHp(Double.random(in: 1...10))
            .withEnemyHp(Double.random(in: 1...10))
            .withTurnNumber(Int.random(in: 15...25))
    }

    func withWeakEnemy() -> CombatSessionBuilder {
        let weakEnemy = EnemyBuilder()
            .withLevel(1)
            .withWeakStats()
            .withLowRewards()
            .build()
        return self.withEnemy(weakEnemy)
    }

    func withStrongEnemy() -> CombatSessionBuilder {
        let strongEnemy = EnemyBuilder()
            .withLevel(15)
            .withPowerfulStats()
            .withHighRewards()
            .build()
        return self.withEnemy(strongEnemy)
    }

    func withBossEnemy() -> CombatSessionBuilder {
        let bossEnemy = EnemyBuilder()
            .withName("Dragon Lord")
            .withLevel(20)
            .withBossStats()
            .withSpecialAbilities(["fire_breath", "wing_slam", "roar"])
            .withExcellentRewards()
            .build()
        return self.withEnemy(bossEnemy)
    }

    func withPowerfulPlayer() -> CombatSessionBuilder {
        let powerfulStats = ItemStats(
            atkPower: 35.0,
            atkAccuracy: 95.0,
            defPower: 30.0,
            defAccuracy: 90.0
        )
        return self.withPlayerStats(powerfulStats)
    }

    func withWeakPlayer() -> CombatSessionBuilder {
        let weakStats = ItemStats(
            atkPower: 8.0,
            atkAccuracy: 65.0,
            defPower: 5.0,
            defAccuracy: 60.0
        )
        return self.withPlayerStats(weakStats)
    }

    func withExpiration() -> CombatSessionBuilder {
        let futureTime = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
        let formatter = ISO8601DateFormatter()
        return self.withExpiresAt(formatter.string(from: futureTime))
    }

    func asExpired() -> CombatSessionBuilder {
        let pastTime = Calendar.current.date(byAdding: .minute, value: -10, to: Date()) ?? Date()
        let formatter = ISO8601DateFormatter()
        return self.withExpiresAt(formatter.string(from: pastTime))
    }

    // MARK: - Build Method

    func build() -> CombatSession {
        return CombatSession(
            sessionId: sessionId,
            playerId: playerId,
            enemyId: enemyId,
            status: status,
            enemy: enemy,
            playerStats: playerStats,
            weaponConfig: weaponConfig,
            turnNumber: turnNumber,
            currentTurnOwner: currentTurnOwner,
            playerHp: playerHp,
            enemyHp: enemyHp,
            expiresAt: expiresAt
        )
    }

    // MARK: - Factory Methods

    static func tutorial() -> CombatSessionBuilder {
        return CombatSessionBuilder()
            .withSessionId("tutorial_session")
            .asNewCombat()
            .withWeakEnemy()
            .withWeakPlayer()
    }

    static func balanced() -> CombatSessionBuilder {
        return CombatSessionBuilder()
            .asNewCombat()
            .withExpiration()
    }

    static func challenging() -> CombatSessionBuilder {
        return CombatSessionBuilder()
            .asOngoingCombat()
            .withStrongEnemy()
            .withExpiration()
    }

    static func bossFight() -> CombatSessionBuilder {
        return CombatSessionBuilder()
            .withSessionId("boss_fight")
            .asOngoingCombat()
            .withBossEnemy()
            .withPowerfulPlayer()
            .withExpiration()
    }

    static func nearDeath() -> CombatSessionBuilder {
        return CombatSessionBuilder()
            .nearlyDefeated()
            .withExpiration()
    }
}

// MARK: - EnemyBuilder

class EnemyBuilder {
    private var id: String? = "enemy_123"
    private var name: String? = "Forest Goblin"
    private var level = 5
    private var stats = ItemStats.testData()
    private var specialAbilities: [String] = []
    private var goldMin = 20
    private var goldMax = 50
    private var materialDropPool = ["wood", "bone"]

    init() {}

    // MARK: - Builder Methods

    func withId(_ id: String?) -> EnemyBuilder {
        self.id = id
        return self
    }

    func withName(_ name: String?) -> EnemyBuilder {
        self.name = name
        return self
    }

    func withLevel(_ level: Int) -> EnemyBuilder {
        self.level = level
        return self
    }

    func withStats(_ stats: ItemStats) -> EnemyBuilder {
        self.stats = stats
        return self
    }

    func withSpecialAbilities(_ abilities: [String]) -> EnemyBuilder {
        self.specialAbilities = abilities
        return self
    }

    func addSpecialAbility(_ ability: String) -> EnemyBuilder {
        self.specialAbilities.append(ability)
        return self
    }

    func withGoldRewards(min: Int, max: Int) -> EnemyBuilder {
        self.goldMin = min
        self.goldMax = max
        return self
    }

    func withMaterialDropPool(_ materials: [String]) -> EnemyBuilder {
        self.materialDropPool = materials
        return self
    }

    // MARK: - Convenience Methods

    func withWeakStats() -> EnemyBuilder {
        let weakStats = ItemStats(
            atkPower: 8.0,
            atkAccuracy: 60.0,
            defPower: 5.0,
            defAccuracy: 55.0
        )
        return self.withStats(weakStats)
    }

    func withPowerfulStats() -> EnemyBuilder {
        let strongStats = ItemStats(
            atkPower: 25.0,
            atkAccuracy: 85.0,
            defPower: 20.0,
            defAccuracy: 80.0
        )
        return self.withStats(strongStats)
    }

    func withBossStats() -> EnemyBuilder {
        let bossStats = ItemStats(
            atkPower: 40.0,
            atkAccuracy: 95.0,
            defPower: 35.0,
            defAccuracy: 90.0
        )
        return self.withStats(bossStats)
    }

    func withLowRewards() -> EnemyBuilder {
        return self.withGoldRewards(min: 5, max: 15)
    }

    func withHighRewards() -> EnemyBuilder {
        return self.withGoldRewards(min: 100, max: 200)
    }

    func withExcellentRewards() -> EnemyBuilder {
        return self.withGoldRewards(min: 500, max: 1000)
    }

    func asGoblin() -> EnemyBuilder {
        return self
            .withName("Goblin")
            .withLevel(3)
            .withWeakStats()
            .withSpecialAbilities(["quick_strike"])
            .withMaterialDropPool(["bone", "leather", "cloth"])
            .withLowRewards()
    }

    func asOrc() -> EnemyBuilder {
        return self
            .withName("Orc Warrior")
            .withLevel(8)
            .withStats(ItemStats(atkPower: 18.0, atkAccuracy: 75.0, defPower: 15.0, defAccuracy: 70.0))
            .withSpecialAbilities(["heavy_swing", "intimidate"])
            .withMaterialDropPool(["iron", "leather", "bone"])
            .withGoldRewards(min: 40, max: 80)
    }

    func asDragon() -> EnemyBuilder {
        return self
            .withName("Ancient Dragon")
            .withLevel(20)
            .withBossStats()
            .withSpecialAbilities(["fire_breath", "wing_slam", "roar", "fly"])
            .withMaterialDropPool(["dragon_scale", "dragon_bone", "crystal", "gold"])
            .withExcellentRewards()
    }

    func asUndead() -> EnemyBuilder {
        return self
            .withName("Skeleton Warrior")
            .withLevel(6)
            .withStats(ItemStats(atkPower: 12.0, atkAccuracy: 70.0, defPower: 8.0, defAccuracy: 65.0))
            .withSpecialAbilities(["bone_throw", "undead_resilience"])
            .withMaterialDropPool(["bone", "cloth", "dust"])
            .withGoldRewards(min: 20, max: 40)
    }

    func asElemental() -> EnemyBuilder {
        return self
            .withName("Fire Elemental")
            .withLevel(12)
            .withStats(ItemStats(atkPower: 22.0, atkAccuracy: 80.0, defPower: 18.0, defAccuracy: 75.0))
            .withSpecialAbilities(["fire_bolt", "burn", "heat_aura"])
            .withMaterialDropPool(["fire_crystal", "ash", "ember"])
            .withGoldRewards(min: 60, max: 120)
    }

    // MARK: - Build Method

    func build() -> Enemy {
        return Enemy(
            id: id,
            name: name,
            level: level,
            stats: stats,
            specialAbilities: specialAbilities,
            goldMin: goldMin,
            goldMax: goldMax,
            materialDropPool: materialDropPool
        )
    }

    // MARK: - Factory Methods

    static func random() -> EnemyBuilder {
        let enemies = [
            EnemyBuilder().asGoblin(),
            EnemyBuilder().asOrc(),
            EnemyBuilder().asUndead(),
            EnemyBuilder().asElemental()
        ]
        return enemies.randomElement() ?? EnemyBuilder().asGoblin()
    }

    static func collection() -> [Enemy] {
        return [
            EnemyBuilder().asGoblin().build(),
            EnemyBuilder().asOrc().build(),
            EnemyBuilder().asDragon().build(),
            EnemyBuilder().asUndead().build(),
            EnemyBuilder().asElemental().build()
        ]
    }
}

// MARK: - Test Data Extensions

extension CombatEnemy {
    static func testData(
        id: String = "enemy_123",
        type: String = "goblin",
        name: String = "Forest Goblin",
        level: Int = 5,
        atk: Int = 15,
        def: Int = 10,
        hp: Int = 100,
        styleId: String = "style_001",
        dialogueTone: String = "aggressive",
        personalityTraits: [String] = ["cunning", "quick"]
    ) -> CombatEnemy {
        return CombatEnemy(
            id: id,
            type: type,
            name: name,
            level: level,
            atk: atk,
            def: def,
            hp: hp,
            styleId: styleId,
            dialogueTone: dialogueTone,
            personalityTraits: personalityTraits
        )
    }
}

extension CombatPlayerStats {
    static func testData(
        atkPower: Double = 20.0,
        atkAccuracy: Double = 75.0,
        defPower: Double = 15.0,
        defAccuracy: Double = 70.0,
        hp: Double = 100.0
    ) -> CombatPlayerStats {
        return CombatPlayerStats(
            atkPower: atkPower,
            atkAccuracy: atkAccuracy,
            defPower: defPower,
            defAccuracy: defAccuracy,
            hp: hp
        )
    }
}

extension WeaponConfig {
    static func testData(
        pattern: String = "single_arc",
        spinDegPerS: Int = 180,
        adjustedBands: AdjustedBands = AdjustedBands.testData()
    ) -> WeaponConfig {
        return WeaponConfig(
            pattern: pattern,
            spinDegPerS: spinDegPerS,
            adjustedBands: adjustedBands
        )
    }
}

extension AdjustedBands {
    static func testData(
        degInjure: Double = 30.0,
        degMiss: Double = 60.0,
        degGraze: Double = 90.0,
        degNormal: Double = 270.0,
        degCrit: Double = 300.0
    ) -> AdjustedBands {
        return AdjustedBands(
            degInjure: degInjure,
            degMiss: degMiss,
            degGraze: degGraze,
            degNormal: degNormal,
            degCrit: degCrit
        )
    }
}

extension Enemy {
    static func testData(
        id: String? = "legacy_enemy_123",
        name: String? = "Legacy Forest Goblin",
        level: Int = 5,
        stats: ItemStats = ItemStats.testData(),
        specialAbilities: [String] = ["quick_strike"],
        goldMin: Int = 20,
        goldMax: Int = 50,
        materialDropPool: [String] = ["wood", "bone"]
    ) -> Enemy {
        return Enemy(
            id: id,
            name: name,
            level: level,
            stats: stats,
            specialAbilities: specialAbilities,
            goldMin: goldMin,
            goldMax: goldMax,
            materialDropPool: materialDropPool
        )
    }
}