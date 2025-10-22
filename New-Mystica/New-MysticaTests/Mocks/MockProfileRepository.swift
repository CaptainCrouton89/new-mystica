//
//  MockProfileRepository.swift
//  New-MysticaTests
//
//  Mock implementation of ProfileRepository for testing
//

import Foundation
@testable import New_Mystica

class MockProfileRepository: ProfileRepository {

    // MARK: - Configuration Properties
    var shouldFailFetchProfile = false
    var shouldFailFetchProgression = false
    var shouldFailClaimReward = false
    var shouldFailUpdateProfile = false
    var shouldFailFetchCurrencyBalance = false
    var shouldFailInitializeProfile = false
    var fetchProfileDelayMs: Int = 0
    var fetchProgressionDelayMs: Int = 0
    var claimRewardDelayMs: Int = 0
    var updateProfileDelayMs: Int = 0
    var fetchCurrencyBalanceDelayMs: Int = 0
    var initializeProfileDelayMs: Int = 0

    // MARK: - Mock Data
    var mockProfile: EnhancedUserProfile = EnhancedUserProfile.testData()
    var mockProgression: PlayerProgression = PlayerProgression.testData()
    var mockCurrencyBalances: [CurrencyBalance] = [CurrencyBalance.testData()]

    // MARK: - Call Tracking
    var fetchProfileCallCount = 0
    var fetchProgressionCallCount = 0
    var claimRewardCallCount = 0
    var updateProfileCallCount = 0
    var fetchCurrencyBalanceCallCount = 0
    var initializeProfileCallCount = 0
    var lastClaimedRewardId: String?
    var lastUpdatedUsername: String?

    // MARK: - ProfileRepository Implementation

    func fetchProfile() async throws -> EnhancedUserProfile {
        fetchProfileCallCount += 1

        if fetchProfileDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(fetchProfileDelayMs * 1_000_000))
        }

        if shouldFailFetchProfile {
            throw AppError.networkError(URLError(.timedOut))
        }

        return mockProfile
    }

    func fetchProgression() async throws -> PlayerProgression {
        fetchProgressionCallCount += 1

        if fetchProgressionDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(fetchProgressionDelayMs * 1_000_000))
        }

        if shouldFailFetchProgression {
            throw AppError.networkError(URLError(.timedOut))
        }

        return mockProgression
    }

    func claimReward(rewardId: String) async throws -> Void {
        claimRewardCallCount += 1
        lastClaimedRewardId = rewardId

        if claimRewardDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(claimRewardDelayMs * 1_000_000))
        }

        if shouldFailClaimReward {
            throw AppError.serverError(400, "Cannot claim reward")
        }

        // Remove the claimed reward from unclaimed rewards
        var unclaimedRewards = mockProgression.unclaimedRewards
        unclaimedRewards.removeAll { reward in
            String(reward.level) == rewardId
        }

        // Update progression with removed reward
        mockProgression = PlayerProgression(
            userId: mockProgression.userId,
            level: mockProgression.level,
            experience: mockProgression.experience,
            totalExperienceEarned: mockProgression.totalExperienceEarned,
            prestigePoints: mockProgression.prestigePoints,
            unlockedAbilities: mockProgression.unlockedAbilities,
            xpToNextLevel: mockProgression.xpToNextLevel,
            lastLevelUpAt: mockProgression.lastLevelUpAt,
            unclaimedRewards: unclaimedRewards
        )

        // Update currency balance (assume reward is gold)
        if let rewardLevel = Int(rewardId),
           let reward = mockProgression.unclaimedRewards.first(where: { $0.level == rewardLevel }) {
            updateGoldBalance(by: reward.rewardGold)
        }
    }

    func updateProfile(username: String) async throws -> EnhancedUserProfile {
        updateProfileCallCount += 1
        lastUpdatedUsername = username

        if updateProfileDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(updateProfileDelayMs * 1_000_000))
        }

        if shouldFailUpdateProfile {
            throw AppError.serverError(400, "Cannot update profile")
        }

        // Update the mock profile with new username
        mockProfile = EnhancedUserProfile(
            id: mockProfile.id,
            email: mockProfile.email,
            deviceId: mockProfile.deviceId,
            accountType: mockProfile.accountType,
            username: username,
            vanityLevel: mockProfile.vanityLevel,
            gold: mockProfile.gold,
            totalStats: mockProfile.totalStats
        )

        return mockProfile
    }

    func fetchCurrencyBalance() async throws -> [CurrencyBalance] {
        fetchCurrencyBalanceCallCount += 1

        if fetchCurrencyBalanceDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(fetchCurrencyBalanceDelayMs * 1_000_000))
        }

        if shouldFailFetchCurrencyBalance {
            throw AppError.networkError(URLError(.timedOut))
        }

        return mockCurrencyBalances
    }

    func initializeProfile() async throws -> EnhancedUserProfile {
        initializeProfileCallCount += 1

        if initializeProfileDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(initializeProfileDelayMs * 1_000_000))
        }

        if shouldFailInitializeProfile {
            throw AppError.serverError(500, "Cannot initialize profile")
        }

        // Create a new profile with starter values
        mockProfile = EnhancedUserProfile.testData(
            username: "NewPlayer",
            vanityLevel: 1,
            gold: 100,
            totalStats: ItemStats.testData(
                atkPower: 5.0,
                atkAccuracy: 50.0,
                defPower: 5.0,
                defAccuracy: 50.0
            )
        )

        // Reset progression to level 1
        mockProgression = PlayerProgression.testData(
            level: 1,
            experience: 0,
            totalExperienceEarned: 0,
            xpToNextLevel: 100
        )

        // Reset currency balances
        mockCurrencyBalances = [
            CurrencyBalance.testData(currencyCode: .gold, balance: 100),
            CurrencyBalance.testData(currencyCode: .gems, balance: 0)
        ]

        return mockProfile
    }

    // MARK: - Test Helpers

    func reset() {
        shouldFailFetchProfile = false
        shouldFailFetchProgression = false
        shouldFailClaimReward = false
        shouldFailUpdateProfile = false
        shouldFailFetchCurrencyBalance = false
        shouldFailInitializeProfile = false
        fetchProfileDelayMs = 0
        fetchProgressionDelayMs = 0
        claimRewardDelayMs = 0
        updateProfileDelayMs = 0
        fetchCurrencyBalanceDelayMs = 0
        initializeProfileDelayMs = 0
        fetchProfileCallCount = 0
        fetchProgressionCallCount = 0
        claimRewardCallCount = 0
        updateProfileCallCount = 0
        fetchCurrencyBalanceCallCount = 0
        initializeProfileCallCount = 0
        lastClaimedRewardId = nil
        lastUpdatedUsername = nil
        mockProfile = EnhancedUserProfile.testData()
        mockProgression = PlayerProgression.testData()
        mockCurrencyBalances = [CurrencyBalance.testData()]
    }

    func updateGoldBalance(by amount: Int) {
        // Update gold in profile
        mockProfile = EnhancedUserProfile(
            id: mockProfile.id,
            email: mockProfile.email,
            deviceId: mockProfile.deviceId,
            accountType: mockProfile.accountType,
            username: mockProfile.username,
            vanityLevel: mockProfile.vanityLevel,
            gold: mockProfile.gold + amount,
            totalStats: mockProfile.totalStats
        )

        // Update gold in currency balances
        if let goldIndex = mockCurrencyBalances.firstIndex(where: { $0.currencyCode == .gold }) {
            let currentBalance = mockCurrencyBalances[goldIndex]
            mockCurrencyBalances[goldIndex] = CurrencyBalance(
                currencyCode: .gold,
                balance: currentBalance.balance + amount,
                updatedAt: currentBalance.updatedAt
            )
        }
    }

    func addExperience(_ xp: Int) {
        let currentXp = mockProgression.experience + xp
        let newLevel = calculateLevel(totalXp: currentXp)
        let xpForCurrentLevel = xpRequiredForLevel(newLevel)
        let xpForNextLevel = xpRequiredForLevel(newLevel + 1)
        let xpToNext = xpForNextLevel - currentXp

        mockProgression = PlayerProgression(
            userId: mockProgression.userId,
            level: newLevel,
            experience: currentXp,
            totalExperienceEarned: mockProgression.totalExperienceEarned + xp,
            prestigePoints: mockProgression.prestigePoints,
            unlockedAbilities: mockProgression.unlockedAbilities,
            xpToNextLevel: xpToNext,
            lastLevelUpAt: newLevel > mockProgression.level ? ISO8601DateFormatter().string(from: Date()) : mockProgression.lastLevelUpAt,
            unclaimedRewards: mockProgression.unclaimedRewards
        )
    }

    // MARK: - Private Helpers

    private func calculateLevel(totalXp: Int) -> Int {
        // Simple level calculation: every 100 XP = 1 level
        return max(1, totalXp / 100 + 1)
    }

    private func xpRequiredForLevel(_ level: Int) -> Int {
        // Simple XP curve: level 1 = 0 XP, level 2 = 100 XP, level 3 = 200 XP, etc.
        return max(0, (level - 1) * 100)
    }
}

// MARK: - Test Data Extensions

extension EnhancedUserProfile {
    static func testData(
        id: String = "user_123",
        email: String? = "test@example.com",
        deviceId: String? = "device_123",
        accountType: AccountType = .email,
        username: String? = "TestPlayer",
        vanityLevel: Int = 5,
        gold: Int = 250,
        totalStats: ItemStats = ItemStats.testData()
    ) -> EnhancedUserProfile {
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
}

extension PlayerProgression {
    static func testData(
        userId: String = "user_123",
        level: Int = 5,
        experience: Int = 450,
        totalExperienceEarned: Int = 450,
        prestigePoints: Int = 0,
        unlockedAbilities: [String] = ["basic_attack", "defend"],
        xpToNextLevel: Int = 50,
        lastLevelUpAt: String? = "2024-01-01T10:00:00Z",
        unclaimedRewards: [LevelReward] = []
    ) -> PlayerProgression {
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
}

extension LevelReward {
    static func testData(
        level: Int = 3,
        rewardGold: Int = 50
    ) -> LevelReward {
        return LevelReward(
            level: level,
            rewardGold: rewardGold
        )
    }
}

extension CurrencyBalance {
    static func testData(
        currencyCode: CurrencyCode = .gold,
        balance: Int = 250,
        updatedAt: String = "2024-01-01T10:00:00Z"
    ) -> CurrencyBalance {
        return CurrencyBalance(
            currencyCode: currencyCode,
            balance: balance,
            updatedAt: updatedAt
        )
    }
}