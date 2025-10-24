//
//  Combat.swift
//  New-Mystica
//
//  Combat system models for battle sessions and rewards
//

import Foundation

// MARK: - Combat Status Enum (matches backend CombatStatus type)
enum CombatStatus: String, Codable, CaseIterable {
    case active = "active"
    case victory = "victory"
    case defeat = "defeat"
    case abandoned = "abandoned"
}

// MARK: - Combat Session Model (matches backend startCombat response)
struct CombatSession: APIModel {
    let sessionId: String
    let playerId: String
    let enemyId: String
    let status: CombatStatus
    let enemy: CombatEnemy
    let playerStats: CombatPlayerStats
    let weaponConfig: WeaponConfig

    // Runtime state fields for ongoing combat (updated via combat actions)
    let turnNumber: Int?
    let currentTurnOwner: String?
    let playerHp: Double?
    let enemyHp: Double?
    let expiresAt: String?

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case playerId = "player_id"
        case enemyId = "enemy_id"
        case status
        case enemy
        case playerStats = "player_stats"
        case weaponConfig = "weapon_config"
        case turnNumber = "turn_number"
        case currentTurnOwner = "current_turn_owner"
        case playerHp = "player_hp"
        case enemyHp = "enemy_hp"
        case expiresAt = "expires_at"
    }
}

// MARK: - Combat Start Response (deprecated - use CombatSession directly)
// This type is no longer needed as CombatSession now matches the backend response
typealias CombatStartResponse = CombatSession

// MARK: - Combat Enemy Model
struct CombatEnemy: APIModel {
    let id: String
    let type: String
    let name: String
    let level: Int
    let atk: Int
    let def: Int
    let hp: Int
    let styleId: String
    let dialogueTone: String
    let personalityTraits: [String]

    enum CodingKeys: String, CodingKey {
        case id
        case type
        case name
        case level
        case atk
        case def
        case hp
        case styleId = "style_id"
        case dialogueTone = "dialogue_tone"
        case personalityTraits = "personality_traits"
    }

    // Computed property to convert to legacy Enemy format for compatibility
    var stats: ItemStats {
        return ItemStats(
            atkPower: Double(atk),
            atkAccuracy: 0, // Not provided in combat enemy response
            defPower: Double(def),
            defAccuracy: 0  // Not provided in combat enemy response
        )
    }
}

// MARK: - Combat Player Stats (matches backend player_stats format)
struct CombatPlayerStats: APIModel {
    let atkPower: Double
    let atkAccuracy: Double
    let defPower: Double
    let defAccuracy: Double
    let hp: Double

    enum CodingKeys: String, CodingKey {
        case atkPower
        case atkAccuracy
        case defPower
        case defAccuracy
        case hp
    }
}

// MARK: - Weapon Config
struct WeaponConfig: APIModel {
    let pattern: String
    let spinDegPerS: Int
    let adjustedBands: AdjustedBands

    enum CodingKeys: String, CodingKey {
        case pattern
        case spinDegPerS = "spin_deg_per_s"
        case adjustedBands = "adjusted_bands"
    }
}

// MARK: - Adjusted Bands (matches backend adjusted_bands format)
struct AdjustedBands: APIModel {
    let degInjure: Double
    let degMiss: Double
    let degGraze: Double
    let degNormal: Double
    let degCrit: Double

    enum CodingKeys: String, CodingKey {
        case degInjure = "deg_injure"
        case degMiss = "deg_miss"
        case degGraze = "deg_graze"
        case degNormal = "deg_normal"
        case degCrit = "deg_crit"
    }
}

// MARK: - Enemy Model (Legacy - used for loot/other endpoints)
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

// MARK: - Combat Rewards Model (matches backend completeCombat response)
struct CombatRewards: APIModel {
    let result: String
    let rewards: CombatRewardDetails?
    let playerCombatHistory: PlayerCombatHistory

    enum CodingKeys: String, CodingKey {
        case result
        case rewards
        case playerCombatHistory = "player_combat_history"
    }
}

struct CombatRewardDetails: APIModel {
    let materials: [MaterialDrop]
    let gold: Int
    let experience: Int
}

struct PlayerCombatHistory: APIModel {
    let locationId: String
    let totalAttempts: Int
    let victories: Int
    let defeats: Int
    let currentStreak: Int
    let longestStreak: Int

    enum CodingKeys: String, CodingKey {
        case locationId = "location_id"
        case totalAttempts = "total_attempts"
        case victories
        case defeats
        case currentStreak = "current_streak"
        case longestStreak = "longest_streak"
    }
}

// MARK: - Material Drop Model
struct MaterialDrop: APIModel {
    let materialId: String
    let name: String
    let styleId: String
    let styleName: String

    enum CodingKeys: String, CodingKey {
        case materialId = "material_id"
        case name
        case styleId = "style_id"
        case styleName = "style_name"
    }
}

// MARK: - Combat Action Result Models
struct AttackResult: APIModel {
    let hitZone: String
    let baseMultiplier: Double
    let critBonusMultiplier: Double?
    let damageDealt: Double
    let playerHpRemaining: Double
    let enemyHpRemaining: Double
    let enemyDamage: Double
    let combatStatus: String
    let turnNumber: Int

    enum CodingKeys: String, CodingKey {
        case hitZone = "hit_zone"
        case baseMultiplier = "base_multiplier"
        case critBonusMultiplier = "crit_bonus_multiplier"
        case damageDealt = "damage_dealt"
        case playerHpRemaining = "player_hp_remaining"
        case enemyHpRemaining = "enemy_hp_remaining"
        case enemyDamage = "enemy_damage"
        case combatStatus = "combat_status"
        case turnNumber = "turn_number"
    }
}

struct DefenseResult: APIModel {
    let damageBlocked: Double
    let damageTaken: Double
    let playerHpRemaining: Double
    let combatStatus: String

    enum CodingKeys: String, CodingKey {
        case damageBlocked = "damage_blocked"
        case damageTaken = "damage_taken"
        case playerHpRemaining = "player_hp_remaining"
        case combatStatus = "combat_status"
    }
}