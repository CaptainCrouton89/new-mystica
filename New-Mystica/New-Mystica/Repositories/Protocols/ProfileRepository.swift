//
//  ProfileRepository.swift
//  New-Mystica
//
//  Protocol for profile and progression-related API calls
//  Handles user profile, progression tracking, and currency management
//

import Foundation

protocol ProfileRepository {
    /// Fetch complete user profile with stats and metadata
    /// - Returns: Enhanced user profile with total stats and career info
    func fetchProfile() async throws -> EnhancedUserProfile

    /// Fetch player progression (XP, level, rewards)
    /// - Returns: Player progression with XP tracking and unlocked content
    func fetchProgression() async throws -> PlayerProgression

    /// Claim reward from progression system
    /// - Parameter rewardId: Reward ID to claim
    func claimReward(rewardId: String) async throws -> Void

    /// Update user profile information
    /// - Parameter username: New username to set
    /// - Returns: Updated user profile
    func updateProfile(username: String) async throws -> EnhancedUserProfile

    /// Fetch current currency balances
    /// - Returns: Array of currency balances (gold, gems, etc.)
    func fetchCurrencyBalance() async throws -> [CurrencyBalance]

    /// Initialize new player profile after registration
    /// - Returns: Created profile with starter inventory
    func initializeProfile() async throws -> EnhancedUserProfile
}