//
//  ProfileViewModel.swift
//  New-Mystica
//
//  Manages user profile display and progression tracking
//

import Foundation
import Observation

@Observable
final class ProfileViewModel {
    let repository: ProfileRepository
    let appState: AppState

    // MARK: - State
    var profile: Loadable<EnhancedUserProfile> = .idle
    var progression: Loadable<PlayerProgression> = .idle
    var careerStats: PlayerCareerStats?

    // MARK: - UI State
    var showingRewardClaim: Bool = false
    var rewardClaimInProgress: Bool = false

    init(repository: ProfileRepository = DefaultProfileRepository(),
         appState: AppState = AppState.shared) {
        self.repository = repository
        self.appState = appState
    }

    // MARK: - Public Methods

    func loadProfile() async {
        profile = .loading

        do {
            let userProfile = try await repository.fetchProfile()
            profile = .loaded(userProfile)

            // Update AppState with profile
            appState.setProfile(userProfile)

        } catch let error as AppError {
            profile = .error(error)
            appState.setProfileError(error)
        } catch {
            let appError = AppError.unknown(error)
            profile = .error(appError)
            appState.setProfileError(appError)
        }
    }

    func loadProgression() async {
        progression = .loading

        do {
            let playerProgression = try await repository.fetchProgression()
            progression = .loaded(playerProgression)
        } catch let error as AppError {
            progression = .error(error)
        } catch {
            progression = .error(.unknown(error))
        }
    }

    func loadCareerStats() async {
        // Career stats would be part of extended profile or progression data
        // For now, we'll leave this as a stub since it's not in the ProfileRepository protocol
        // In a full implementation, this might be part of fetchProgression() or a separate endpoint
        careerStats = nil
    }

    func loadAll() async {
        await loadProfile()
        await loadProgression()
        await loadCareerStats()
    }

    func refreshProfile() async {
        await loadAll()
    }

    func claimReward(rewardId: String) async {
        guard !rewardClaimInProgress else { return }

        rewardClaimInProgress = true
        defer { rewardClaimInProgress = false }

        do {
            try await repository.claimReward(rewardId: rewardId)

            // Refresh progression to update unclaimed rewards
            await loadProgression()

            // Also refresh profile to update currency
            await loadProfile()

        } catch let error as AppError {
            progression = .error(error)
        } catch {
            progression = .error(.unknown(error))
        }
    }

    func claimLevelReward(level: Int) async {
        await claimReward(rewardId: "level_\(level)")
    }

    func showRewardClaim() {
        showingRewardClaim = true
    }

    func hideRewardClaim() {
        showingRewardClaim = false
    }

    // MARK: - Computed Properties

    var currentLevel: Int {
        if case .loaded(let progressionData) = progression {
            return progressionData.level
        }
        return 1
    }

    var currentExperience: Int {
        if case .loaded(let progressionData) = progression {
            return progressionData.experience
        }
        return 0
    }

    var experienceToNextLevel: Int {
        if case .loaded(let progressionData) = progression {
            return progressionData.xpToNextLevel
        }
        return 100
    }

    var progressToNextLevel: Double {
        let totalXPForCurrentLevel = currentExperience + experienceToNextLevel
        guard totalXPForCurrentLevel > 0 else { return 0.0 }
        return Double(currentExperience) / Double(totalXPForCurrentLevel)
    }

    var prestigePoints: Int {
        if case .loaded(let progressionData) = progression {
            return progressionData.prestigePoints
        }
        return 0
    }

    var unclaimedRewards: [LevelReward] {
        if case .loaded(let progressionData) = progression {
            return progressionData.unclaimedRewards
        }
        return []
    }

    var hasUnclaimedRewards: Bool {
        return !unclaimedRewards.isEmpty
    }

    var totalGoldBalance: Int {
        if case .loaded(let userProfile) = profile {
            return userProfile.gold
        }
        return appState.getCurrencyBalance(for: .gold)
    }

    var vanityLevel: Int {
        if case .loaded(let userProfile) = profile {
            return userProfile.vanityLevel
        }
        return 1
    }

    var accountType: AccountType {
        if case .loaded(let userProfile) = profile {
            return userProfile.accountType
        }
        return .anonymous
    }

    var username: String? {
        if case .loaded(let userProfile) = profile {
            return userProfile.username
        }
        return nil
    }

    var totalStats: ItemStats? {
        if case .loaded(let userProfile) = profile {
            return userProfile.totalStats
        }
        return nil
    }

    // Career stats computed properties
    var totalCombatWins: Int {
        return careerStats?.totalCombatWins ?? 0
    }

    var totalCombatLosses: Int {
        return careerStats?.totalCombatLosses ?? 0
    }

    var winRate: Double {
        let totalCombats = totalCombatWins + totalCombatLosses
        guard totalCombats > 0 else { return 0.0 }
        return Double(totalCombatWins) / Double(totalCombats)
    }

    var totalCrafts: Int {
        return careerStats?.totalCrafts ?? 0
    }

    var totalItemsFound: Int {
        return careerStats?.totalItemsFound ?? 0
    }

    var longestWinStreak: Int {
        return careerStats?.longestWinStreak ?? 0
    }

    var locationsVisited: Int {
        return careerStats?.locationsVisited ?? 0
    }

    // Profile status checks
    var isProfileLoaded: Bool {
        if case .loaded = profile { return true }
        return false
    }

    var isProgressionLoaded: Bool {
        if case .loaded = progression { return true }
        return false
    }

    var isFullyLoaded: Bool {
        return isProfileLoaded && isProgressionLoaded
    }

    var isLoading: Bool {
        if case .loading = profile { return true }
        if case .loading = progression { return true }
        return false
    }

    var hasError: Bool {
        if case .error = profile { return true }
        if case .error = progression { return true }
        return false
    }
}