//
//  CombatRepository.swift
//  New-Mystica
//
//  Protocol for combat-related API calls
//  Handles combat sessions, actions, and rewards
//

import Foundation

protocol CombatRepository {
    /// Initiate combat encounter at location
    /// - Parameters:
    ///   - locationId: Location ID where combat occurs
    ///   - selectedLevel: Player-chosen combat level (1-20 for MVP0)
    /// - Returns: New combat session with enemy and player stats
    func initiateCombat(locationId: String, selectedLevel: Int) async throws -> CombatSession

    /// Perform attack action during combat
    /// - Parameters:
    ///   - sessionId: Active combat session ID
    ///   - timingScore: Player timing dial score (0.0-1.0)
    /// - Returns: Combat action result with damage and updated HP
    func performAttack(sessionId: String, timingScore: Double) async throws -> CombatAction

    /// Perform defense action during combat
    /// - Parameters:
    ///   - sessionId: Active combat session ID
    ///   - timingScore: Player timing dial score (0.0-1.0)
    /// - Returns: Combat action result with damage reduced and updated HP
    func performDefense(sessionId: String, timingScore: Double) async throws -> CombatAction

    /// Complete combat and claim rewards
    /// - Parameters:
    ///   - sessionId: Combat session ID to complete
    ///   - won: Whether player won the combat
    /// - Returns: Combat rewards (gold, XP, materials, items)
    func completeCombat(sessionId: String, won: Bool) async throws -> CombatRewards

    /// Fetch current combat session state for recovery
    /// - Parameter sessionId: Combat session ID to retrieve
    /// - Returns: Current combat session with all state
    func fetchCombatSession(sessionId: String) async throws -> CombatSession

    /// Retreat from combat (forfeit with partial rewards)
    /// - Parameter sessionId: Combat session ID to retreat from
    /// - Returns: Partial rewards and retreat message
    func retreatCombat(sessionId: String) async throws -> (rewards: CombatRewards?, message: String)

    /// Get user's active combat session if one exists
    /// - Returns: Active combat session or nil if none exists
    func getUserActiveSession() async throws -> CombatSession?

    /// Abandon combat session without rewards
    /// - Parameter sessionId: Combat session ID to abandon
    func abandonCombat(sessionId: String) async throws
}