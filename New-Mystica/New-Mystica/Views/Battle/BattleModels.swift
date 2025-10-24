import Foundation
import CoreGraphics

// MARK: - Visual Feedback Models
struct DamageInfo {
    let amount: Double
    let zone: String // "crit", "normal", "graze", "miss", "injure"
    let isBlocked: Bool
    let position: CGPoint
}

// MARK: - Combat Phase State Machine
enum CombatPhase {
    case playerAttack      // Dial visible with attack accuracy zones
    case attackTransition  // 1s pause
    case defensePrompt     // "DEFEND NOW!" prompt slides in
    case playerDefense     // Tap dial with defense zones, enemy glows red
}
