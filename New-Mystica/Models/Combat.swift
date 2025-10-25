import Foundation

/// Represents a piece of dialogue with its associated tone
struct DialogueData: Codable {
    let text: String
    let tone: String
}

/// Represents a response from an enemy during combat dialogue
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
}