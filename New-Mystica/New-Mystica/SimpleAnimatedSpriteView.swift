//
//  SimpleAnimatedSpriteView.swift
//  New-Mystica
//
//  Created by AI Assistant on 1/25/25.
//

import SwiftUI
import SpriteKit

/**
 * SimpleAnimatedSpriteView - SwiftUI wrapper for animated sprites
 * 
 * ESSENTIAL FUNCTIONALITY:
 * - Display loading state while sprite loads
 * - Show error state if sprite fails to load
 * - Present animated sprite using SpriteKit
 * - Handle sprite positioning and sizing
 * - Support loop and one-time animations
 * - Load metadata from JSON files automatically
 * 
 * USAGE: 
 * - SimpleAnimatedSpriteView(spriteSheetPath: "SkeletonSprite")
 * - SimpleAnimatedSpriteView(spriteSheetPath: "CircleSprite", imageFileName: "AlphaTest")
 */
struct SimpleAnimatedSpriteView: View {
    let spriteSheetPath: String
    let frameRate: Double
    let loopAnimation: Bool
    let imageFileName: String?
    
    @State private var skView: SKView?
    @State private var isLoading = true
    @State private var hasError = false
    @State private var metadata: SpriteMetadata?
    @State private var spriteSize: CGSize = CGSize(width: 100, height: 100)
    
    init(
        spriteSheetPath: String,
        frameRate: Double = 12.0,
        loopAnimation: Bool = true,
        imageFileName: String? = nil
    ) {
        self.spriteSheetPath = spriteSheetPath
        self.frameRate = frameRate
        self.loopAnimation = loopAnimation
        self.imageFileName = imageFileName
    }
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Full screen background matching MainMenuView
                MysticaBackground(.image(BackgroundImageManager())) {
                    EmptyView()
                }
                
                if isLoading {
                    VStack(spacing: 8) {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("Loading...")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .frame(width: spriteSize.width, height: spriteSize.height)
                } else if hasError {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.red.opacity(0.1))
                        .frame(width: spriteSize.width, height: spriteSize.height)
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
                        .frame(width: spriteSize.width, height: spriteSize.height)
                        .background(Color.clear)
                }
            }
        }
        .ignoresSafeArea()
        .onAppear {
            loadAnimation()
        }
    }
    
    /**
     * Load animation and create SpriteKit scene
     * Called on view appear
     */
    private func loadAnimation() {
        // First load metadata from JSON
        SpriteMetadataLoader.loadMetadataAsync(for: spriteSheetPath) { loadedMetadata in
            guard let loadedMetadata = loadedMetadata else {
                DispatchQueue.main.async {
                    isLoading = false
                    hasError = true
                }
                return
            }
            
            DispatchQueue.main.async {
                self.metadata = loadedMetadata
                
                // Set sprite size from metadata
                self.spriteSize = CGSize(
                    width: loadedMetadata.frameWidth,
                    height: loadedMetadata.frameHeight
                )
                
                // Now load the sprite sheet with the metadata
                SimpleSpriteLoader.shared.loadSpriteSheet(
                    spriteSheetPath: spriteSheetPath,
                    metadata: loadedMetadata,
                    frameRate: frameRate,
                    loopAnimation: loopAnimation,
                    imageFileName: imageFileName
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
        }
    }
    
    /**
     * Create SpriteKit scene and present it
     */
    private func createSpriteKitScene(with spriteNode: SKSpriteNode) {
        let skView = SKView(frame: CGRect(origin: .zero, size: spriteSize))
        skView.allowsTransparency = true
        skView.backgroundColor = .clear
        
        let scene = SKScene(size: spriteSize)
        scene.backgroundColor = .clear
        scene.scaleMode = .aspectFit
        
        // Ensure sprite has no background color
        spriteNode.color = .clear
        spriteNode.colorBlendFactor = 0.0
        
        // Fix for premultiplied alpha causing black backgrounds
        spriteNode.blendMode = .replace
        
        spriteNode.position = CGPoint(x: spriteSize.width / 2, y: spriteSize.height / 2)
        scene.addChild(spriteNode)
        
        skView.presentScene(scene)
        self.skView = skView
    }
}

