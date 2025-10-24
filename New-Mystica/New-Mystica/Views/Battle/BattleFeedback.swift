import UIKit
import SwiftUI

// MARK: - Battle Feedback Utilities

/// Trigger haptic feedback based on combat zone
func triggerHapticFeedback(for zone: String) {
    let generator: UIImpactFeedbackGenerator

    switch zone.lowercased() {
    case "crit":
        // Dark Green (Crit): Heavy impact (.heavy)
        generator = UIImpactFeedbackGenerator(style: .heavy)
    case "normal", "graze":
        // Bright Green (Normal), Yellow (Graze): Light impact (.light)
        generator = UIImpactFeedbackGenerator(style: .light)
    case "miss", "injure":
        // Orange (Miss), Red (Injure): No haptic
        return
    default:
        return
    }

    generator.prepare()
    generator.impactOccurred()
}

/// Trigger haptic feedback for defense based on effectiveness
func triggerDefenseHaptic(damageBlocked: Double, damageTaken: Double) {
    let totalDamage = damageBlocked + damageTaken
    guard totalDamage > 0 else { return }

    let blockEffectiveness = damageBlocked / totalDamage
    let generator: UIImpactFeedbackGenerator

    if blockEffectiveness > 0.8 {
        // Great defense - heavy haptic
        generator = UIImpactFeedbackGenerator(style: .heavy)
    } else if blockEffectiveness > 0.4 {
        // Okay defense - light haptic
        generator = UIImpactFeedbackGenerator(style: .light)
    } else {
        // Poor defense - no haptic or error pattern
        if #available(iOS 17.0, *) {
            let errorGenerator = UINotificationFeedbackGenerator()
            errorGenerator.notificationOccurred(.error)
        }
        return
    }

    generator.prepare()
    generator.impactOccurred()
}

/// Trigger audio feedback for a combat action
func triggerAudioFeedback(for action: CombatAction, audioManager: AudioManager) {
    switch action.type {
    case .attack:
        if let zone = action.hitZone {
            switch zone.lowercased() {
            case "crit", "normal", "graze":
                // Successful hit - play deal damage sound
                audioManager.playDealDamage()
            case "injure":
                // Player hurt themselves - play take damage sound
                audioManager.playTakeDamage()
            case "miss":
                // Miss - no sound (or could add miss sound)
                break
            default:
                break
            }
        }
    case .defend:
        if let damageTaken = action.damageDealt, damageTaken > 0 {
            // Player took damage - play take damage sound
            audioManager.playTakeDamage()
        }
        // Could add blocked sound for successful defense
    default:
        break
    }
}

/// Trigger audio feedback for combat end
func triggerCombatEndAudio(won: Bool, audioManager: AudioManager) {
    if won {
        audioManager.playVictory()
    } else {
        audioManager.playDefeat()
    }
}
