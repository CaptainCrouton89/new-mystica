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
    let animationLoader: MonsterAnimationLoader?
    let currentFrame: Int

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

            // Enemy Animation (animated sprite or fallback to static image)
            enemyAnimationView
                .frame(width: 80, height: 80)
        }
        .scaleEffect(scale)
    }

    private var enemyAnimationView: some View {
        // Try to show animated sprite first
        if let loader = animationLoader,
           let animationData = loader.animationData,
           let spriteImage = loader.spriteImage,
           currentFrame < animationData.frames.count {
            
            let frameData = animationData.frames[currentFrame]
            
            return AnyView(
                Image(uiImage: spriteImage)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(
                        width: animationData.meta.size.w / 5,
                        height: animationData.meta.size.h / 5
                    )
                    .offset(
                        x: -(frameData.x - (2 * animationData.meta.frameSize.w)) / 5,
                        y: -(frameData.y - (2 * animationData.meta.frameSize.h)) / 5
                    )
                    .frame(
                        width: frameData.width / 5,
                        height: frameData.height / 5
                    )
                    .clipped()
            )
        } else {
            // Fallback to static image
            let imageName = getEnemyImageName(enemy)
            return AnyView(
                Image(imageName)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 80, height: 80)
            )
        }
    }

    private func getEnemyImageName(_ enemy: Enemy) -> String {
        guard let name = enemy.name?.lowercased() else {
            return "bird_man"
        }

        switch name {
        case let n where n.contains("bird") || n.contains("birdman"):
            return "bird_man"
        case let n where n.contains("wolf"):
            return "wolf"
        case let n where n.contains("golem"):
            return "golem"
        case let n where n.contains("dragon"):
            return "dragon"
        case let n where n.contains("warrior"):
            return "warrior"
        case let n where n.contains("spirit"):
            return "spirit"
        default:
            return "bird_man"
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        EnemyAvatarView(
            enemy: mockEnemy,
            scale: 1.0,
            animationLoader: nil,
            currentFrame: 0
        )

        EnemyAvatarView(
            enemy: mockEnemy,
            scale: 1.1,
            animationLoader: nil,
            currentFrame: 0
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