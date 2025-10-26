//
//  CombatRepository.swift
//  New-Mystica
//
//  Protocol for combat-related API calls
//  Handles combat sessions, actions, and rewards
//

import Foundation

/// Represents a piece of dialogue with its associated tone
struct DialogueData: Codable, Equatable {
    let text: String
    let tone: String
}

struct EnemyDialogueResponse: Codable {
    let dialogue: String
    let dialogueTone: String
    let enemyType: String
    let generationTimeMs: Int
    let wasAiGenerated: Bool

    enum CodingKeys: String, CodingKey {
        case dialogue
        case dialogueTone = "dialogue_tone"
        case enemyType = "enemy_type"
        case generationTimeMs = "generation_time_ms"
        case wasAiGenerated = "was_ai_generated"
    }
}

/// Represents different types of events that can occur during combat
enum CombatEventType: String, Codable {
    case combatStart = "combat_start"
    case playerHit = "player_hit"
    case playerMiss = "player_miss"
    case enemyHit = "enemy_hit"
    case lowPlayerHP = "low_player_hp"
    case nearVictory = "near_victory"
    case victory
    case defeat
}

/// Detailed information about a specific combat event
struct CombatEventDetails: Codable {
    let turnNumber: Int
    let playerHpPct: Double
    let enemyHpPct: Double
    let damage: Int?
    let isCritical: Bool?
    let playerZone: Int?
    let enemyZone: Int?
    let playerAction: String?

    enum CodingKeys: String, CodingKey {
        case turnNumber = "turn_number"
        case playerHpPct = "player_hp_pct"
        case enemyHpPct = "enemy_hp_pct"
        case damage
        case isCritical = "is_critical"
        case playerZone = "player_zone"
        case enemyZone = "enemy_zone"
        case playerAction = "player_action"
    }
}

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
    ///   - tapPositionDegrees: Player tap position on dial (0-360 degrees)
    /// - Returns: Combat action result with damage and updated HP
    func performAttack(sessionId: String, tapPositionDegrees: Float) async throws -> CombatAction

    /// Perform defense action during combat
    /// - Parameters:
    ///   - sessionId: Active combat session ID
    ///   - tapPositionDegrees: Player tap position on dial (0-360 degrees)
    /// - Returns: Combat action result with damage reduced and updated HP
    func performDefense(sessionId: String, tapPositionDegrees: Float) async throws -> CombatAction

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

    /// Fetch enemy chatter for a specific combat event
    /// - Parameters:
    ///   - sessionId: Active combat session ID
    ///   - eventType: Type of combat event triggering chatter
    ///   - eventDetails: Detailed information about the combat event
    /// - Returns: Enemy dialogue response for the given event
    func fetchEnemyChatter(sessionId: String, eventType: String, eventDetails: CombatEventDetails) async throws -> EnemyDialogueResponse
}