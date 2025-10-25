import SwiftUI

// MARK: - Battle View Helper Functions

/// Get color for a combat zone
func colorForZone(_ zone: String) -> Color {
    switch zone.lowercased() {
    case "crit":
        return Color(red: 0.2, green: 0.8, blue: 0.3) // Dark green
    case "normal":
        return Color(red: 0.27, green: 1.0, blue: 0.27) // Bright green #44FF44
    case "graze":
        return Color(red: 1.0, green: 0.67, blue: 0.27) // Yellow #FFAA44
    case "miss":
        return Color.orange
    case "injure":
        return Color(red: 1.0, green: 0.27, blue: 0.27) // Red #FF4444
    default:
        return Color.gray
    }
}

/// Get display text for a combat zone and damage amount
func textForZone(_ zone: String, damage: Double) -> String {
    switch zone.lowercased() {
    case "miss":
        return "MISS!"
    case "injure":
        return "-\(Int(damage))"
    default:
        return "\(Int(damage))"
    }
}

/// Calculate defense effectiveness from damage blocked and damage taken
func getDefenseEffectiveness(blocked: Double, taken: Double) -> Double {
    let totalDamage = blocked + taken
    return totalDamage > 0 ? blocked / totalDamage : 0.0
}

/// Convert CombatEnemy to Enemy for compatibility with reusable components
func convertCombatEnemyToEnemy(_ combatEnemy: CombatEnemy) -> Enemy {
    return Enemy(
        id: combatEnemy.id,
        name: combatEnemy.name,
        level: combatEnemy.level,
        stats: combatEnemy.stats,
        specialAbilities: combatEnemy.personalityTraits,
        goldMin: 0,
        goldMax: 0,
        materialDropPool: []
    )
}

// MARK: - Zone-Based Combat Helpers

/// Get color for a numbered zone (1-5)
func colorForZoneNumber(_ zone: Int) -> Color {
    switch zone {
    case 1:
        return Color(red: 0.2, green: 0.8, blue: 0.3) // Dark green - best zone
    case 2:
        return Color(red: 0.27, green: 1.0, blue: 0.27) // Bright green
    case 3:
        return Color(red: 1.0, green: 0.67, blue: 0.27) // Yellow - normal
    case 4:
        return Color.orange // Orange - weak
    case 5:
        return Color(red: 1.0, green: 0.27, blue: 0.27) // Red - weakest
    default:
        return Color.gray
    }
}

/// Get display text for zone hit with damage and crit information
func textForZoneHit(_ zoneInfo: ZoneHitInfo) -> String {
    let damage = Int(zoneInfo.finalDamage)

    if zoneInfo.critOccurred {
        if let critMult = zoneInfo.critMultiplier {
            let critPercent = Int((critMult - 1.0) * 100)
            return "CRIT! +\(critPercent)%\n\(damage)"
        }
        return "CRIT!\n\(damage)"
    }

    return "\(damage)"
}

/// Get zone name for display (Zone 1 = Best, Zone 5 = Worst)
func displayNameForZone(_ zone: Int) -> String {
    switch zone {
    case 1: return "Perfect!"
    case 2: return "Great"
    case 3: return "Good"
    case 4: return "Weak"
    case 5: return "Miss"
    default: return "Unknown"
    }
}
