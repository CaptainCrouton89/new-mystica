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
    case ongoing = "ongoing"  // NEW: for enhanced combat action responses
    case victory = "victory"
    case defeat = "defeat"
    case abandoned = "abandoned"
}

// MARK: - Combat Location Model (matches backend location object in combat response)
struct CombatLocation: APIModel {
    let id: String
    let name: String?
    let locationType: String?
    let backgroundImageUrl: String?
    let imageUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case locationType = "location_type"
        case backgroundImageUrl = "background_image_url"
        case imageUrl = "image_url"
    }
}

// MARK: - Combat Session Model (matches backend startCombat response)
struct CombatSession: APIModel {
    let sessionId: String
    let playerId: String
    let enemyId: String
    let status: CombatStatus
    let location: CombatLocation?
    let enemy: CombatEnemy
    let playerStats: CombatPlayerStats
    let weaponConfig: WeaponConfig

    // Runtime state fields for ongoing combat (updated via combat actions)
    let turnNumber: Int?
    let currentTurnOwner: String?
    let playerHp: Double  // Always present - backend returns initial HP on start
    let enemyHp: Double   // Always present - backend returns initial HP on start
    let expiresAt: String?

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case playerId = "player_id"
        case enemyId = "enemy_id"
        case status
        case location
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

// MARK: - Combat Enemy Model (uses realized stats from backend)
struct CombatEnemy: APIModel {
    let id: String
    let type: String
    let name: String
    let level: Int
    let atkPower: Double      // Realized attack power (normalized × scaling formula)
    let atkAccuracy: Double   // Realized attack accuracy (normalized × scaling formula)
    let defPower: Double      // Realized defense power (normalized × scaling formula)
    let defAccuracy: Double   // Realized defense accuracy (normalized × scaling formula)
    let hp: Double            // Realized HP (base_hp × tier.difficulty_multiplier)
    let styleId: String
    let dialogueTone: String
    let personalityTraits: [String]

    enum CodingKeys: String, CodingKey {
        case id
        case type
        case name
        case level
        case atkPower = "atk_power"
        case atkAccuracy = "atk_accuracy"
        case defPower = "def_power"
        case defAccuracy = "def_accuracy"
        case hp
        case styleId = "style_id"
        case dialogueTone = "dialogue_tone"
        case personalityTraits = "personality_traits"
    }

    // Computed property to convert to legacy Enemy format for compatibility
    var stats: ItemStats {
        return ItemStats(
            atkPower: atkPower,
            atkAccuracy: atkAccuracy,
            defPower: defPower,
            defAccuracy: defAccuracy
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

    // NEW: Zone hit information for both player and enemy
    let playerDamage: ZoneHitInfo?
    let enemyDamage: ZoneHitInfo?

    // Legacy fields for backwards compatibility (deprecated)
    let damageDealt: Double?
    let result: String?
    let hitZone: String? // For tracking zone hit for haptic/audio feedback
    let damageBlocked: Double? // For defense tracking

    // Enhanced response fields for optimized combat flow
    let playerHpRemaining: Double?
    let enemyHpRemaining: Double?
    let combatStatus: CombatStatus
    let turnNumber: Int?
    let rewards: CombatRewards?

    enum CodingKeys: String, CodingKey {
        case type
        case performerId = "performer_id"
        case playerDamage = "player_damage"
        case enemyDamage = "enemy_damage"
        // Legacy
        case damageDealt = "damage_dealt"
        case result
        case hitZone = "hit_zone"
        case damageBlocked = "damage_blocked"
        // Current
        case playerHpRemaining = "player_hp_remaining"
        case enemyHpRemaining = "enemy_hp_remaining"
        case combatStatus = "combat_status"
        case turnNumber = "turn_number"
        case rewards
    }
}

// MARK: - Combat Action Type Enum
enum CombatActionType: String, Codable, CaseIterable {
    case attack = "attack"
    case defend = "defend"
    case special = "special"
}

// MARK: - Combat Rewards Model (matches enhanced backend response)
struct CombatRewards: APIModel {
    let result: String // "victory" or "defeat"
    let currencies: Currencies
    let items: [ItemDrop]?
    let materials: [MaterialDrop]?
    let experience: Int?
    let combatHistory: CombatHistory

    enum CodingKeys: String, CodingKey {
        case result
        case currencies
        case items
        case materials
        case experience
        case combatHistory = "combat_history"
    }
}

// MARK: - Currencies Model
struct Currencies: APIModel {
    let gold: Int
}

// MARK: - Item Drop Model
struct ItemDrop: APIModel {
    let id: String
    let itemTypeId: String
    let name: String
    let category: String
    let rarity: String
    let styleId: String
    let displayName: String
    let generatedImageUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case itemTypeId = "item_type_id"
        case name
        case category
        case rarity
        case styleId = "style_id"
        case displayName = "display_name"
        case generatedImageUrl = "generated_image_url"
    }
}

// MARK: - Combat History Model
struct CombatHistory: APIModel {
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

// MARK: - Legacy Combat History (keep for backward compatibility)
typealias PlayerCombatHistory = CombatHistory

// MARK: - Material Drop Model
struct MaterialDrop: APIModel {
    let materialId: String
    let name: String
    let styleId: String
    let displayName: String
    let imageUrl: String?

    enum CodingKeys: String, CodingKey {
        case materialId = "material_id"
        case name
        case styleId = "style_id"
        case displayName = "display_name"
        case imageUrl = "image_url"
    }
}

// MARK: - Zone Hit Information (matches backend ZoneHitInfo)
struct ZoneHitInfo: APIModel {
    let zone: Int  // 1-5
    let zoneMultiplier: Double
    let critOccurred: Bool  // Frontend uses this for "CRITICAL HIT!" animations
    let critMultiplier: Double?  // null when no crit, otherwise 1.0-2.0x
    let finalDamage: Double

    enum CodingKeys: String, CodingKey {
        case zone
        case zoneMultiplier = "zone_multiplier"
        case critOccurred = "crit_occurred"
        case critMultiplier = "crit_multiplier"
        case finalDamage = "final_damage"
    }
}

// MARK: - Combat Action Result Models
struct AttackResult: APIModel {
    let playerDamage: ZoneHitInfo  // NEW: Detailed zone and crit info for player attack
    let enemyDamage: ZoneHitInfo   // NEW: Detailed zone and crit info for enemy attack
    let playerHpRemaining: Double
    let enemyHpRemaining: Double
    let combatStatus: String
    let turnNumber: Int?
    let rewards: CombatRewards?  // Included when combat ends

    // Legacy fields for backwards compatibility (deprecated)
    let hitZone: String?
    let critBonusMultiplier: Double?
    let damageDealt: Double?

    enum CodingKeys: String, CodingKey {
        case playerDamage = "player_damage"
        case enemyDamage = "enemy_damage"
        case playerHpRemaining = "player_hp_remaining"
        case enemyHpRemaining = "enemy_hp_remaining"
        case combatStatus = "combat_status"
        case turnNumber = "turn_number"
        case rewards
        // Legacy
        case hitZone = "hit_zone"
        case critBonusMultiplier = "crit_bonus_multiplier"
        case damageDealt = "damage_dealt"
    }
}

struct DefenseResult: APIModel {
    let playerDamage: ZoneHitInfo  // NEW: Detailed zone and crit info for player defense
    let enemyDamage: ZoneHitInfo   // NEW: Detailed zone and crit info for enemy attack
    let playerHpRemaining: Double
    let enemyHpRemaining: Double
    let combatStatus: String
    let turnNumber: Int?
    let rewards: CombatRewards?  // Included when combat ends

    // Legacy fields for backwards compatibility (deprecated)
    let damageBlocked: Double?
    let damageTaken: Double?
    let hitZone: String?

    enum CodingKeys: String, CodingKey {
        case playerDamage = "player_damage"
        case enemyDamage = "enemy_damage"
        case playerHpRemaining = "player_hp_remaining"
        case enemyHpRemaining = "enemy_hp_remaining"
        case combatStatus = "combat_status"
        case turnNumber = "turn_number"
        case rewards
        // Legacy
        case damageBlocked = "damage_blocked"
        case damageTaken = "damage_taken"
        case hitZone = "hit_zone"
    }
}