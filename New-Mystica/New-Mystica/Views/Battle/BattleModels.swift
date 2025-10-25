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
    case playerDefense     // Tap dial with defense zones, enemy glows red
}

// MARK: - Enemy Animation State
enum EnemyAnimationState {
    case idle      // Looping forever
    case hit       // Plays once, returns to idle
    case attack    // Plays once, returns to idle
    case death     // Plays once, stays on last frame
}
