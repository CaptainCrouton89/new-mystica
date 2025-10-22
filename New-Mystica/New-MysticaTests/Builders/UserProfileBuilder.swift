//
//  UserProfileBuilder.swift
//  New-MysticaTests
//
//  Builder pattern for creating User and Profile test data with fluent interface
//

import Foundation
@testable import New_Mystica

class UserProfileBuilder {
    private var id = "user_123"
    private var email: String? = "test@example.com"
    private var deviceId: String? = "device_123"
    private var accountType = AccountType.email
    private var username: String? = "TestPlayer"
    private var vanityLevel = 5
    private var gold = 250
    private var totalStats = ItemStats.testData()

    init() {}

    // MARK: - Builder Methods

    func withId(_ id: String) -> UserProfileBuilder {
        self.id = id
        return self
    }

    func withEmail(_ email: String?) -> UserProfileBuilder {
        self.email = email
        return self
    }

    func withDeviceId(_ deviceId: String?) -> UserProfileBuilder {
        self.deviceId = deviceId
        return self
    }

    func withAccountType(_ accountType: AccountType) -> UserProfileBuilder {
        self.accountType = accountType
        return self
    }

    func withUsername(_ username: String?) -> UserProfileBuilder {
        self.username = username
        return self
    }

    func withVanityLevel(_ level: Int) -> UserProfileBuilder {
        self.vanityLevel = level
        return self
    }

    func withGold(_ gold: Int) -> UserProfileBuilder {
        self.gold = gold
        return self
    }

    func withTotalStats(_ stats: ItemStats) -> UserProfileBuilder {
        self.totalStats = stats
        return self
    }

    // MARK: - Convenience Methods

    func asAnonymous() -> UserProfileBuilder {
        return self
            .withAccountType(.anonymous)
            .withEmail(nil)
            .withUsername(nil)
    }

    func asEmailUser() -> UserProfileBuilder {
        return self
            .withAccountType(.email)
            .withEmail("player@example.com")
            .withUsername("Player123")
    }

    func asNewPlayer() -> UserProfileBuilder {
        return self
            .withVanityLevel(1)
            .withGold(100)
            .withTotalStats(ItemStats(atkPower: 5.0, atkAccuracy: 50.0, defPower: 5.0, defAccuracy: 50.0))
    }

    func asExperiencedPlayer() -> UserProfileBuilder {
        return self
            .withVanityLevel(10)
            .withGold(1500)
            .withTotalStats(ItemStats(atkPower: 25.0, atkAccuracy: 85.0, defPower: 20.0, defAccuracy: 80.0))
    }

    func asVeteranPlayer() -> UserProfileBuilder {
        return self
            .withVanityLevel(25)
            .withGold(5000)
            .withTotalStats(ItemStats(atkPower: 45.0, atkAccuracy: 95.0, defPower: 40.0, defAccuracy: 90.0))
    }

    func asPoorPlayer() -> UserProfileBuilder {
        return self
            .withGold(Int.random(in: 0...50))
    }

    func asRichPlayer() -> UserProfileBuilder {
        return self
            .withGold(Int.random(in: 10000...50000))
    }

    func withWeakStats() -> UserProfileBuilder {
        let weakStats = ItemStats(atkPower: 3.0, atkAccuracy: 45.0, defPower: 2.0, defAccuracy: 40.0)
        return self.withTotalStats(weakStats)
    }

    func withPowerfulStats() -> UserProfileBuilder {
        let powerfulStats = ItemStats(atkPower: 50.0, atkAccuracy: 98.0, defPower: 45.0, defAccuracy: 95.0)
        return self.withTotalStats(powerfulStats)
    }

    func withRandomUsername() -> UserProfileBuilder {
        let adjectives = ["Swift", "Brave", "Mighty", "Clever", "Silent", "Dark", "Light", "Fire", "Ice", "Storm"]
        let nouns = ["Warrior", "Mage", "Hunter", "Knight", "Rogue", "Paladin", "Archer", "Wizard", "Guardian", "Champion"]
        let randomName = "\(adjectives.randomElement()!)\(nouns.randomElement()!)\(Int.random(in: 10...99))"
        return self.withUsername(randomName)
    }

    // MARK: - Build Method

    func build() -> EnhancedUserProfile {
        return EnhancedUserProfile(
            id: id,
            email: email,
            deviceId: deviceId,
            accountType: accountType,
            username: username,
            vanityLevel: vanityLevel,
            gold: gold,
            totalStats: totalStats
        )
    }

    // MARK: - Factory Methods

    static func newPlayer() -> UserProfileBuilder {
        return UserProfileBuilder()
            .asNewPlayer()
            .asEmailUser()
            .withRandomUsername()
    }

    static func anonymousPlayer() -> UserProfileBuilder {
        return UserProfileBuilder()
            .asAnonymous()
            .asNewPlayer()
    }

    static func veteranPlayer() -> UserProfileBuilder {
        return UserProfileBuilder()
            .asVeteranPlayer()
            .asEmailUser()
            .withRandomUsername()
    }

    static func randomPlayer() -> UserProfileBuilder {
        return UserProfileBuilder()
            .withVanityLevel(Int.random(in: 1...20))
            .withGold(Int.random(in: 50...2000))
            .asEmailUser()
            .withRandomUsername()
    }
}

// MARK: - PlayerProgressionBuilder

class PlayerProgressionBuilder {
    private var userId = "user_123"
    private var level = 5
    private var experience = 450
    private var totalExperienceEarned = 450
    private var prestigePoints = 0
    private var unlockedAbilities = ["basic_attack", "defend"]
    private var xpToNextLevel = 50
    private var lastLevelUpAt: String? = "2024-01-01T10:00:00Z"
    private var unclaimedRewards: [LevelReward] = []

    init() {}

    // MARK: - Builder Methods

    func withUserId(_ userId: String) -> PlayerProgressionBuilder {
        self.userId = userId
        return self
    }

    func withLevel(_ level: Int) -> PlayerProgressionBuilder {
        self.level = level
        return self
    }

    func withExperience(_ experience: Int) -> PlayerProgressionBuilder {
        self.experience = experience
        return self
    }

    func withTotalExperienceEarned(_ totalXp: Int) -> PlayerProgressionBuilder {
        self.totalExperienceEarned = totalXp
        return self
    }

    func withPrestigePoints(_ points: Int) -> PlayerProgressionBuilder {
        self.prestigePoints = points
        return self
    }

    func withUnlockedAbilities(_ abilities: [String]) -> PlayerProgressionBuilder {
        self.unlockedAbilities = abilities
        return self
    }

    func addUnlockedAbility(_ ability: String) -> PlayerProgressionBuilder {
        self.unlockedAbilities.append(ability)
        return self
    }

    func withXpToNextLevel(_ xp: Int) -> PlayerProgressionBuilder {
        self.xpToNextLevel = xp
        return self
    }

    func withLastLevelUpAt(_ timestamp: String?) -> PlayerProgressionBuilder {
        self.lastLevelUpAt = timestamp
        return self
    }

    func withUnclaimedRewards(_ rewards: [LevelReward]) -> PlayerProgressionBuilder {
        self.unclaimedRewards = rewards
        return self
    }

    func addUnclaimedReward(_ reward: LevelReward) -> PlayerProgressionBuilder {
        self.unclaimedRewards.append(reward)
        return self
    }

    // MARK: - Convenience Methods

    func asNewPlayer() -> PlayerProgressionBuilder {
        return self
            .withLevel(1)
            .withExperience(0)
            .withTotalExperienceEarned(0)
            .withPrestigePoints(0)
            .withUnlockedAbilities([])
            .withXpToNextLevel(100)
            .withLastLevelUpAt(nil)
            .withUnclaimedRewards([])
    }

    func asBeginnerPlayer() -> PlayerProgressionBuilder {
        return self
            .withLevel(3)
            .withExperience(250)
            .withTotalExperienceEarned(250)
            .withUnlockedAbilities(["basic_attack", "defend"])
            .withXpToNextLevel(50)
    }

    func asIntermediatePlayer() -> PlayerProgressionBuilder {
        return self
            .withLevel(10)
            .withExperience(950)
            .withTotalExperienceEarned(950)
            .withUnlockedAbilities(["basic_attack", "defend", "power_strike", "shield_bash"])
            .withXpToNextLevel(50)
    }

    func asAdvancedPlayer() -> PlayerProgressionBuilder {
        return self
            .withLevel(20)
            .withExperience(1950)
            .withTotalExperienceEarned(1950)
            .withPrestigePoints(5)
            .withUnlockedAbilities(["basic_attack", "defend", "power_strike", "shield_bash", "rage", "meditation"])
            .withXpToNextLevel(50)
    }

    func withRecentLevelUp() -> PlayerProgressionBuilder {
        let recentTime = Calendar.current.date(byAdding: .hour, value: -2, to: Date()) ?? Date()
        let formatter = ISO8601DateFormatter()
        return self.withLastLevelUpAt(formatter.string(from: recentTime))
    }

    func withPendingRewards() -> PlayerProgressionBuilder {
        let rewards = [
            LevelReward(level: level + 1, rewardGold: 100),
            LevelReward(level: level + 2, rewardGold: 150)
        ]
        return self.withUnclaimedRewards(rewards)
    }

    func nearLevelUp() -> PlayerProgressionBuilder {
        return self.withXpToNextLevel(Int.random(in: 1...10))
    }

    func farFromLevelUp() -> PlayerProgressionBuilder {
        return self.withXpToNextLevel(Int.random(in: 80...95))
    }

    // MARK: - Build Method

    func build() -> PlayerProgression {
        return PlayerProgression(
            userId: userId,
            level: level,
            experience: experience,
            totalExperienceEarned: totalExperienceEarned,
            prestigePoints: prestigePoints,
            unlockedAbilities: unlockedAbilities,
            xpToNextLevel: xpToNextLevel,
            lastLevelUpAt: lastLevelUpAt,
            unclaimedRewards: unclaimedRewards
        )
    }

    // MARK: - Factory Methods

    static func forNewPlayer() -> PlayerProgressionBuilder {
        return PlayerProgressionBuilder()
            .asNewPlayer()
    }

    static func forExperiencedPlayer() -> PlayerProgressionBuilder {
        return PlayerProgressionBuilder()
            .asIntermediatePlayer()
            .withRecentLevelUp()
            .withPendingRewards()
    }

    static func forVeteranPlayer() -> PlayerProgressionBuilder {
        return PlayerProgressionBuilder()
            .asAdvancedPlayer()
            .withPendingRewards()
    }

    static func aboutToLevelUp() -> PlayerProgressionBuilder {
        return PlayerProgressionBuilder()
            .asBeginnerPlayer()
            .nearLevelUp()
    }
}

// MARK: - CurrencyBalanceBuilder

class CurrencyBalanceBuilder {
    private var currencyCode = CurrencyCode.gold
    private var balance = 250
    private var updatedAt = "2024-01-01T10:00:00Z"

    init() {}

    // MARK: - Builder Methods

    func withCurrencyCode(_ code: CurrencyCode) -> CurrencyBalanceBuilder {
        self.currencyCode = code
        return self
    }

    func withBalance(_ balance: Int) -> CurrencyBalanceBuilder {
        self.balance = balance
        return self
    }

    func withUpdatedAt(_ timestamp: String) -> CurrencyBalanceBuilder {
        self.updatedAt = timestamp
        return self
    }

    // MARK: - Convenience Methods

    func asGold() -> CurrencyBalanceBuilder {
        return self.withCurrencyCode(.gold)
    }

    func asGems() -> CurrencyBalanceBuilder {
        return self.withCurrencyCode(.gems)
    }

    func asLowBalance() -> CurrencyBalanceBuilder {
        return self.withBalance(Int.random(in: 0...50))
    }

    func asHighBalance() -> CurrencyBalanceBuilder {
        return self.withBalance(Int.random(in: 5000...20000))
    }

    func asRecentlyUpdated() -> CurrencyBalanceBuilder {
        let recentTime = Calendar.current.date(byAdding: .minute, value: -5, to: Date()) ?? Date()
        let formatter = ISO8601DateFormatter()
        return self.withUpdatedAt(formatter.string(from: recentTime))
    }

    // MARK: - Build Method

    func build() -> CurrencyBalance {
        return CurrencyBalance(
            currencyCode: currencyCode,
            balance: balance,
            updatedAt: updatedAt
        )
    }

    // MARK: - Factory Methods

    static func defaultGold() -> CurrencyBalanceBuilder {
        return CurrencyBalanceBuilder()
            .asGold()
            .withBalance(250)
    }

    static func defaultGems() -> CurrencyBalanceBuilder {
        return CurrencyBalanceBuilder()
            .asGems()
            .withBalance(0)
    }

    static func newPlayerBalances() -> [CurrencyBalance] {
        return [
            CurrencyBalanceBuilder().asGold().withBalance(100).build(),
            CurrencyBalanceBuilder().asGems().withBalance(0).build()
        ]
    }

    static func richPlayerBalances() -> [CurrencyBalance] {
        return [
            CurrencyBalanceBuilder().asGold().withBalance(10000).build(),
            CurrencyBalanceBuilder().asGems().withBalance(500).build()
        ]
    }
}