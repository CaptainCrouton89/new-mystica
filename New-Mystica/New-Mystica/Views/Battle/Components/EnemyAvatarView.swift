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

    // Scale factor for 50% bigger (dividing by 3.33 instead of 5)
    private static let animationScaleFactor: CGFloat = 3.33

    var body: some View {
        // Enemy Animation (animated sprite or fallback to static image)
        // Keep consistent size regardless of sprite loading state
        enemyAnimationView
            .frame(width: 150, height: 150)
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
                        width: animationData.meta.size.w / Self.animationScaleFactor,
                        height: animationData.meta.size.h / Self.animationScaleFactor
                    )
                    .offset(
                        x: -(frameData.x - (2 * animationData.meta.frameSize.w)) / Self.animationScaleFactor,
                        y: -(frameData.y - (2 * animationData.meta.frameSize.h)) / Self.animationScaleFactor
                    )
                    .frame(
                        width: frameData.width / Self.animationScaleFactor,
                        height: frameData.height / Self.animationScaleFactor
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
                    .frame(width: 150, height: 150)
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