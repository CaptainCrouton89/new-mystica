//
//  DefaultProfileRepository.swift
//  New-Mystica
//
//  Implementation of ProfileRepository using unified APIClient
//  Handles user profile, progression tracking, and currency management
//

import Foundation

final class DefaultProfileRepository: ProfileRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = APIClient.shared) {
        self.apiClient = apiClient
    }

    // MARK: - ProfileRepository Protocol

    func fetchProfile() async throws -> EnhancedUserProfile {
        let profile: EnhancedUserProfile = try await apiClient.get(endpoint: "/profile")
        return profile
    }

    func fetchProgression() async throws -> PlayerProgression {
        struct ProgressionResponse: Decodable {
            let userId: String
            let xp: Int
            let level: Int
            let xpToNextLevel: Int
            let lastLevelUpAt: Date?
            let unclaimedRewards: [UnclaimedReward]

            enum CodingKeys: String, CodingKey {
                case userId = "user_id"
                case xp
                case level
                case xpToNextLevel = "xp_to_next_level"
                case lastLevelUpAt = "last_level_up_at"
                case unclaimedRewards = "unclaimed_rewards"
            }
        }

        struct UnclaimedReward: Decodable {
            let level: Int
            let rewardGold: Int

            enum CodingKeys: String, CodingKey {
                case level
                case rewardGold = "reward_gold"
            }
        }

        let response: ProgressionResponse = try await apiClient.get(endpoint: "/progression")

        return PlayerProgression(
            userId: response.userId,
            level: response.level,
            experience: response.xp,
            totalExperienceEarned: response.xp,
            prestigePoints: 0,
            unlockedAbilities: [],
            xpToNextLevel: response.xpToNextLevel,
            lastLevelUpAt: nil,
            unclaimedRewards: response.unclaimedRewards.map { reward in
                LevelReward(
                    level: reward.level,
                    rewardGold: reward.rewardGold
                )
            }
        )
    }

    func claimReward(rewardId: String) async throws -> Void {
        struct ClaimRewardRequest: Encodable {
            let level: Int
        }

        struct ClaimRewardResponse: Decodable {
            let success: Bool
            let level: Int
            let rewardGold: Int
            let newGoldBalance: Int

            enum CodingKeys: String, CodingKey {
                case success
                case level
                case rewardGold = "reward_gold"
                case newGoldBalance = "new_gold_balance"
            }
        }

        // Assuming rewardId is the level number as string
        guard let level = Int(rewardId) else {
            throw AppError.invalidData("Invalid reward ID format")
        }

        let request = ClaimRewardRequest(level: level)

        let _: ClaimRewardResponse = try await apiClient.post(
            endpoint: "/progression/rewards/claim",
            body: request
        )
    }

    func updateProfile(username: String) async throws -> EnhancedUserProfile {
        struct UpdateProfileRequest: Encodable {
            let username: String
        }

        let request = UpdateProfileRequest(username: username)

        let profile: EnhancedUserProfile = try await apiClient.put(
            endpoint: "/profile",
            body: request
        )

        return profile
    }

    func fetchCurrencyBalance() async throws -> [CurrencyBalance] {
        struct CurrencyBalanceResponse: Decodable {
            let balances: [String: Int]
        }

        let response: CurrencyBalanceResponse = try await apiClient.get(endpoint: "/economy/currencies/balance")

        return response.balances.map { (key, value) in
            CurrencyBalance(
                currencyCode: CurrencyCode(rawValue: key) ?? .gold,
                balance: value,
                updatedAt: Date().formatted()
            )
        }
    }

    func initializeProfile() async throws -> EnhancedUserProfile {
        struct InitProfileResponse: Decodable {
            let profile: EnhancedUserProfile
        }

        let response: InitProfileResponse = try await apiClient.post(endpoint: "/profile/init")
        return response.profile
    }
}