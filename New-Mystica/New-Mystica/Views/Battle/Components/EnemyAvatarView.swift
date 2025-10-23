//
//  EnemyAvatarView.swift
//  New-Mystica
//
//  Enemy avatar component for battle interface
//  Extracted from BattleView.swift for better maintainability
//

import SwiftUI

struct EnemyAvatarView: View {
    let enemy: Enemy
    let scale: CGFloat

    var body: some View {
        ZStack {
            // Avatar Background
            Circle()
                .fill(Color.backgroundCard)
                .frame(width: 120, height: 120)
                .overlay(
                    Circle()
                        .stroke(Color.accent, lineWidth: 3)
                )
                .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)

            // Enemy Animation (based on name or type)
            enemyAnimationView
                .frame(width: 80, height: 80)
        }
        .scaleEffect(scale)
    }

    private var enemyAnimationView: some View {
        let animationPath = getEnemyAnimationPath(enemy)

        return AnimatedSpriteView(
            folderPath: animationPath,
            frameRate: 12.0,
            size: CGSize(width: 80, height: 80)
        )
    }

    private func getEnemyAnimationPath(_ enemy: Enemy) -> String {
        guard let name = enemy.name?.lowercased() else {
            return "sprites/enemies/bird man/attack"
        }

        switch name {
        case let n where n.contains("bird") || n.contains("birdman"):
            return "sprites/enemies/bird man/attack"
        case let n where n.contains("wolf"):
            return "sprites/enemies/bird man/attack" // Fallback for now
        case let n where n.contains("golem"):
            return "sprites/enemies/bird man/attack" // Fallback for now
        case let n where n.contains("dragon"):
            return "sprites/enemies/bird man/attack" // Fallback for now
        case let n where n.contains("warrior"):
            return "sprites/enemies/bird man/attack" // Fallback for now
        case let n where n.contains("spirit"):
            return "sprites/enemies/bird man/attack" // Fallback for now
        default:
            return "sprites/enemies/bird man/attack"
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        EnemyAvatarView(
            enemy: mockEnemy,
            scale: 1.0
        )

        EnemyAvatarView(
            enemy: mockEnemy,
            scale: 1.1
        )
    }
    .padding()
    .background(Color.backgroundPrimary)
}

// Mock data for preview
private let mockEnemy = Enemy(
    id: "mock-enemy",
    name: "Bird Man",
    level: 5,
    stats: ItemStats(
        atkPower: 20,
        atkAccuracy: 15,
        defPower: 18,
        defAccuracy: 12
    ),
    specialAbilities: [],
    goldMin: 10,
    goldMax: 50,
    materialDropPool: []
)