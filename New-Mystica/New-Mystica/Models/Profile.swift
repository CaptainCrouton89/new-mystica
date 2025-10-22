//
//  Profile.swift
//  New-Mystica
//
//  Profile and progression models for player advancement
//

import Foundation

// MARK: - Enhanced User Profile Model
struct EnhancedUserProfile: APIModel {
    let id: String
    let email: String?
    let deviceId: String?
    let accountType: AccountType
    let username: String?
    let vanityLevel: Int
    let gold: Int
    let totalStats: ItemStats

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case deviceId = "device_id"
        case accountType = "account_type"
        case username
        case vanityLevel = "vanity_level"
        case gold
        case totalStats = "total_stats"
    }
}

// MARK: - Account Type Enum
enum AccountType: String, Codable, CaseIterable {
    case anonymous = "anonymous"
    case email = "email"
}

// MARK: - Player Progression Model
struct PlayerProgression: APIModel {
    let userId: String
    let level: Int
    let experience: Int
    let totalExperienceEarned: Int
    let prestigePoints: Int
    let unlockedAbilities: [String]
    let xpToNextLevel: Int
    let lastLevelUpAt: String?
    let unclaimedRewards: [LevelReward]

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case level
        case experience
        case totalExperienceEarned = "total_experience_earned"
        case prestigePoints = "prestige_points"
        case unlockedAbilities = "unlocked_abilities"
        case xpToNextLevel = "xp_to_next_level"
        case lastLevelUpAt = "last_level_up_at"
        case unclaimedRewards = "unclaimed_rewards"
    }
}

// MARK: - Level Reward Model
struct LevelReward: APIModel {
    let level: Int
    let rewardGold: Int

    enum CodingKeys: String, CodingKey {
        case level
        case rewardGold = "reward_gold"
    }
}

// MARK: - Currency Balance Model
struct CurrencyBalance: APIModel {
    let currencyCode: CurrencyCode
    let balance: Int
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case currencyCode = "currency_code"
        case balance
        case updatedAt = "updated_at"
    }
}

// MARK: - Currency Code Enum
enum CurrencyCode: String, Codable, CaseIterable {
    case gold = "GOLD"
    case gems = "GEMS"
}

// MARK: - Currency Balances Response
struct CurrencyBalancesResponse: APIModel {
    let balances: [CurrencyBalance]

    enum CodingKeys: String, CodingKey {
        case balances
    }
}

// MARK: - Player Career Stats
struct PlayerCareerStats: APIModel {
    let totalCombatWins: Int
    let totalCombatLosses: Int
    let totalCrafts: Int
    let totalItemsFound: Int
    let totalGoldEarned: Int
    let totalExperienceEarned: Int
    let longestWinStreak: Int
    let locationsVisited: Int

    enum CodingKeys: String, CodingKey {
        case totalCombatWins = "total_combat_wins"
        case totalCombatLosses = "total_combat_losses"
        case totalCrafts = "total_crafts"
        case totalItemsFound = "total_items_found"
        case totalGoldEarned = "total_gold_earned"
        case totalExperienceEarned = "total_experience_earned"
        case longestWinStreak = "longest_win_streak"
        case locationsVisited = "locations_visited"
    }
}

// MARK: - Extended Profile Model
struct ExtendedUserProfile: APIModel {
    let profile: EnhancedUserProfile
    let progression: PlayerProgression
    let careerStats: PlayerCareerStats
    let currencyBalances: [CurrencyBalance]

    enum CodingKeys: String, CodingKey {
        case profile
        case progression
        case careerStats = "career_stats"
        case currencyBalances = "currency_balances"
    }
}