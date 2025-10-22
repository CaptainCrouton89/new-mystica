//
//  Combat.swift
//  New-Mystica
//
//  Combat system models for battle sessions and rewards
//

import Foundation

// MARK: - Combat Status Enum
enum CombatStatus: String, Codable, CaseIterable {
    case active = "active"
    case playerWon = "player_won"
    case enemyWon = "enemy_won"
    case retreated = "retreated"
    case ongoing = "ongoing"
    case victory = "victory"
    case defeat = "defeat"
}

// MARK: - Combat Session Model
struct CombatSession: APIModel {
    let sessionId: String
    let playerId: String
    let enemyId: String
    let turnNumber: Int
    let currentTurnOwner: String
    let status: CombatStatus
    let enemy: Enemy
    let playerStats: ItemStats
    let playerHp: Double?
    let enemyHp: Double?
    let expiresAt: String?

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case playerId = "player_id"
        case enemyId = "enemy_id"
        case turnNumber = "turn_number"
        case currentTurnOwner = "current_turn_owner"
        case status
        case enemy
        case playerStats = "player_stats"
        case playerHp = "player_hp"
        case enemyHp = "enemy_hp"
        case expiresAt = "expires_at"
    }
}

// MARK: - Enemy Model
struct Enemy: APIModel {
    let id: String?
    let name: String?
    let level: Int
    let stats: ItemStats
    let specialAbilities: [String]
    let goldMin: Int
    let goldMax: Int
    let materialDropPool: [String]

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case level
        case stats
        case specialAbilities = "special_abilities"
        case goldMin = "gold_min"
        case goldMax = "gold_max"
        case materialDropPool = "material_drop_pool"
    }
}

// MARK: - Combat Action Model
struct CombatAction: APIModel {
    let type: CombatActionType
    let performerId: String
    let damageDealt: Double?
    let result: String?

    enum CodingKeys: String, CodingKey {
        case type
        case performerId = "performer_id"
        case damageDealt = "damage_dealt"
        case result
    }
}

// MARK: - Combat Action Type Enum
enum CombatActionType: String, Codable, CaseIterable {
    case attack = "attack"
    case defend = "defend"
    case special = "special"
}

// MARK: - Combat Rewards Model
struct CombatRewards: APIModel {
    let goldEarned: Int
    let experienceEarned: Int
    let itemsDropped: [EnhancedPlayerItem]
    let materialsDropped: [MaterialDrop]

    enum CodingKeys: String, CodingKey {
        case goldEarned = "gold_earned"
        case experienceEarned = "experience_earned"
        case itemsDropped = "items_dropped"
        case materialsDropped = "materials_dropped"
    }
}

// MARK: - Material Drop Model
struct MaterialDrop: APIModel {
    let materialId: String
    let name: String
    let styleId: String
    let quantity: Int?

    enum CodingKeys: String, CodingKey {
        case materialId = "material_id"
        case name
        case styleId = "style_id"
        case quantity
    }
}

// MARK: - Combat Action Result Models
struct AttackResult: APIModel {
    let damageDealt: Double
    let playerHpRemaining: Double
    let enemyHpRemaining: Double
    let combatStatus: CombatStatus

    enum CodingKeys: String, CodingKey {
        case damageDealt = "damage_dealt"
        case playerHpRemaining = "player_hp_remaining"
        case enemyHpRemaining = "enemy_hp_remaining"
        case combatStatus = "combat_status"
    }
}

struct DefenseResult: APIModel {
    let damageBlocked: Double
    let damageTaken: Double
    let playerHpRemaining: Double
    let combatStatus: CombatStatus

    enum CodingKeys: String, CodingKey {
        case damageBlocked = "damage_blocked"
        case damageTaken = "damage_taken"
        case playerHpRemaining = "player_hp_remaining"
        case combatStatus = "combat_status"
    }
}