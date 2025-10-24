//
//  AnimatedSpriteView.swift
//  New-Mystica
//
//  Created by AI Assistant on 1/25/25.
//

import SwiftUI
import SpriteKit

/**
 * AnimatedSpriteView - Reusable SwiftUI view for displaying remote sprite animations
 * Uses the existing SpriteAnimationGenerator and R2AnimationLoader system
 */
struct AnimatedSpriteView: View {
    let folderPath: String
    let frameRate: Double
    let size: CGSize
    
    @State private var skView: SKView?
    @State private var isLoading = true
    @State private var hasError = false
    
    init(
        folderPath: String,
        frameRate: Double = 12.0,
        size: CGSize = CGSize(width: 100, height: 100)
    ) {
        self.folderPath = folderPath
        self.frameRate = frameRate
        self.size = size
    }
    
    var body: some View {
        ZStack {
            if isLoading {
                VStack(spacing: 8) {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Loading animation...")
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
                            Text("Failed to load animation")
                                .foregroundColor(.red)
                                .font(.caption)
                        }
                    )
            } else if let skView = skView, let scene = skView.scene {
                SpriteView(scene: scene)
                    .frame(width: size.width, height: size.height)
            }
        }
        .onAppear {
            loadAnimation()
        }
    }
    
    private func loadAnimation() {
        // Convert folder path to remote URLs using R2AnimationLoader
        // Expected format: "sprites/enemies/bird man/attack"
        let pathComponents = folderPath.components(separatedBy: "/")
        guard pathComponents.count >= 4 else {
            hasError = true
            isLoading = false
            return
        }
        
        let monsterType = pathComponents[2] // "bird man"
        let animationType = pathComponents[3] // "attack"
        
        // Generate URLs for remote sprites using R2AnimationLoader
        // For now, we'll use a default frame count of 45 (can be made configurable later)
        let frameCount = 45
        let urls = R2AnimationLoader.shared.generateSpriteURLs(
            monsterType: monsterType,
            animationType: animationType,
            frameCount: frameCount
        )
        
        guard !urls.isEmpty else {
            hasError = true
            isLoading = false
            return
        }
        
        
        // Use SpriteAnimationGenerator to create the animated sprite
        SpriteAnimationGenerator.createAnimatedSprite(
            source: .urls(urls),
            frameRate: frameRate,
            targetSize: size
        ) { spriteNode in
            DispatchQueue.main.async {
                isLoading = false
                if let spriteNode = spriteNode {
                    let skView = SKView(frame: CGRect(origin: .zero, size: size))
                    let scene = SKScene(size: size)
                    scene.backgroundColor = .clear
                    
                    spriteNode.position = CGPoint(x: size.width / 2, y: size.height / 2)
                    scene.addChild(spriteNode)
                    
                    skView.presentScene(scene)
                    self.skView = skView
                    hasError = false
                    
                } else {
                    hasError = true
                }
            }
        }
    }
}

#Preview {
    AnimatedSpriteView(
        folderPath: "sprites/enemies/bird man/attack",
        frameRate: 12.0,
        size: CGSize(width: 100, height: 100)
    )
}
