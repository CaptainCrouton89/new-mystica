//
//  EnemyAvatarView.swift
//  New-Mystica
//
//  Enemy avatar component for battle interface
//  Extracted from BattleView.swift for better maintainability
//

import SwiftUI
import SpriteKit

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
        let (monsterName, animationType) = getEnemyAnimationInfo(enemy)

        return RemoteSpriteView(
            monsterName: monsterName,
            animationType: animationType,
            frameRate: 12.0,
            size: CGSize(width: 80, height: 80)
        )
    }

    private func getEnemyAnimationInfo(_ enemy: Enemy) -> (monsterName: String, animationType: String) {
        guard let name = enemy.name?.lowercased() else {
            return ("birdman", "idle")
        }

        switch name {
        case let n where n.contains("bird") || n.contains("birdman"):
            return ("birdman", "idle")
        case let n where n.contains("wolf"):
            return ("birdman", "idle") // Fallback for now
        case let n where n.contains("golem"):
            return ("birdman", "idle") // Fallback for now
        case let n where n.contains("dragon"):
            return ("birdman", "idle") // Fallback for now
        case let n where n.contains("warrior"):
            return ("birdman", "idle") // Fallback for now
        case let n where n.contains("spirit"):
            return ("birdman", "idle") // Fallback for now
        default:
            return ("birdman", "idle")
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

/**
 * RemoteSpriteView - SwiftUI wrapper for remote sprite animations
 * 
 * Handles loading remote sprites from R2 storage using SimpleSpriteLoader
 */
struct RemoteSpriteView: View {
    let monsterName: String
    let animationType: String
    let frameRate: Double
    let size: CGSize
    
    @State private var skView: SKView?
    @State private var isLoading = true
    @State private var hasError = false
    
    var body: some View {
        ZStack {
            if isLoading {
                VStack(spacing: 8) {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Loading...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(width: size.width, height: size.height)
            } else if hasError {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.red.opacity(0.1))
                    .frame(width: size.width, height: size.height)
                    .overlay(
                        VStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle")
                                .foregroundColor(.red)
                            Text("Failed to load")
                                .foregroundColor(.red)
                                .font(.caption)
                        }
                    )
            } else if let skView = skView, let scene = skView.scene {
                SpriteView(scene: scene)
                    .frame(width: size.width, height: size.height)
                    .background(Color.clear)
            }
        }
        .onAppear {
            loadAnimation()
        }
    }
    
    private func loadAnimation() {
        SimpleSpriteLoader.shared.loadAnimatedSprite(
            monsterName: monsterName,
            animationType: animationType,
            frameRate: frameRate
        ) { spriteNode in
            DispatchQueue.main.async {
                isLoading = false
                if let spriteNode = spriteNode {
                    createSpriteKitScene(with: spriteNode)
                    hasError = false
                } else {
                    hasError = true
                }
            }
        }
    }
    
    private func createSpriteKitScene(with spriteNode: SKSpriteNode) {
        let skView = SKView(frame: CGRect(origin: .zero, size: size))
        skView.allowsTransparency = true
        
        let scene = SKScene(size: size)
        scene.backgroundColor = .clear
        scene.scaleMode = .aspectFit
        
        spriteNode.position = CGPoint(x: size.width / 2, y: size.height / 2)
        scene.addChild(spriteNode)
        
        skView.presentScene(scene)
        self.skView = skView
    }
}