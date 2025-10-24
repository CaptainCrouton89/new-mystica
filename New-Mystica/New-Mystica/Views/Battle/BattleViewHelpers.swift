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
