//
//  TestAnimationsView.swift
//  New-Mystica
//
//  Created by AI Assistant on 1/25/25.
//

import SwiftUI
import SpriteKit

struct TestAnimationsView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    @StateObject private var animationManager = AnimationStateManager()
    
    // Fixed animation settings
    private let frameRate: Double = 12.0
    private let animationSize: CGFloat = 150.0
    
    var body: some View {
        NavigationView {
            ZStack {
                // Background
                Color.black.opacity(0.1)
                    .ignoresSafeArea()
                
                VStack(spacing: 30) {
                    
                    // Animation Display Area - Side by Side
                    VStack(spacing: 20) {
                        Text("Doctor Animation Test")
                            .font(.headline)
                            .foregroundColor(.primary)
                        
                        HStack(spacing: 20) {
                            // Idle Animation
                            VStack(spacing: 8) {
                                Text("Idle")
                                    .font(.subheadline)
                                    .foregroundColor(.primary)
                                
                                if let idleAtlasURL = R2AnimationLoader.loadDoctorIdleAtlas() {
                                    SideBySideAnimationView(
                                        atlasURL: idleAtlasURL,
                                        animationType: "idle",
                                        animationManager: animationManager,
                                        size: CGSize(width: animationSize, height: animationSize)
                                    )
                                    .background(
                                        RoundedRectangle(cornerRadius: 16)
                                            .fill(Color.gray.opacity(0.1))
                                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                                    )
                                } else {
                                    RoundedRectangle(cornerRadius: 16)
                                        .fill(Color.red.opacity(0.1))
                                        .frame(width: animationSize, height: animationSize)
                                        .overlay(
                                            Text("Failed to load idle")
                                                .foregroundColor(.red)
                                                .font(.caption)
                                        )
                                }
                            }
                            
                            // Attack Animation
                            VStack(spacing: 8) {
                                Text("Attack")
                                    .font(.subheadline)
                                    .foregroundColor(.primary)
                                
                                if let attackAtlasURL = R2AnimationLoader.loadDoctorAttackAtlas() {
                                    SideBySideAnimationView(
                                        atlasURL: attackAtlasURL,
                                        animationType: "attack",
                                        animationManager: animationManager,
                                        size: CGSize(width: animationSize, height: animationSize)
                                    )
                                    .background(
                                        RoundedRectangle(cornerRadius: 16)
                                            .fill(Color.gray.opacity(0.1))
                                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                                    )
                                } else {
                                    RoundedRectangle(cornerRadius: 16)
                                        .fill(Color.red.opacity(0.1))
                                        .frame(width: animationSize, height: animationSize)
                                        .overlay(
                                            Text("Failed to load attack")
                                                .foregroundColor(.red)
                                                .font(.caption)
                                        )
                                }
                            }
                        }
                        
                        // Animation status
                        HStack(spacing: 8) {
                            Text("Idle: \(animationManager.isIdlePaused ? "Paused" : "Playing")")
                                .font(.caption2)
                                .foregroundColor(animationManager.isIdlePaused ? .orange : .green)
                            
                            if animationManager.isAttackPlaying {
                                Text("• Attack: Playing")
                                    .font(.caption2)
                                    .foregroundColor(.red)
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                    
                    // Controls
                    VStack(spacing: 20) {
                        // Attack Button
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Test Attack:")
                                .font(.headline)
                                .foregroundColor(.primary)
                            
                            Button("Attack") {
                                animationManager.triggerAttack()
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(animationManager.isAttackPlaying)
                        }
                        
                        Text("Idle animation loops continuously. Click Attack to pause idle and play attack animation.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                    .padding(.horizontal, 20)
                    
                    Spacer()
                }
            }
            .navigationTitle("Test Animations")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Back") {
                        navigationManager.navigateBack()
                    }
                }
            }
        }
    }
}

// MARK: - Side by Side Animation View

struct SideBySideAnimationView: View {
    let atlasURL: URL
    let animationType: String
    @ObservedObject var animationManager: AnimationStateManager
    let size: CGSize
    @State private var skView: SKView?
    @State private var isLoading = true
    @State private var hasError = false
    @State private var spriteNode: SKSpriteNode?
    @State private var preloadedTextures: [SKTexture] = []
    
    var body: some View {
        ZStack {
            if isLoading {
                VStack(spacing: 8) {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Loading \(animationType)...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(width: size.width, height: size.height)
            } else if hasError {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.red.opacity(0.1))
                    .frame(width: size.width, height: size.height)
                    .overlay(
                        Text("Failed to load \(animationType)")
                            .foregroundColor(.red)
                            .font(.caption)
                    )
            } else if let skView = skView, let scene = skView.scene {
                SpriteView(scene: scene)
                    .frame(width: size.width, height: size.height)
            }
        }
        .onAppear {
            loadAnimation()
        }
        .onChange(of: animationManager.isIdlePaused) { _, isPaused in
            if animationType == "idle" {
                handleIdlePauseState(isPaused)
            }
        }
        .onChange(of: animationManager.isAttackPlaying) { _, isPlaying in
            if animationType == "attack" {
                handleAttackPlayState(isPlaying)
            }
        }
    }
    
    private func loadAnimation() {
        // Preload textures for both idle and attack animations
        preloadAllAnimations {
            SpriteAnimationGenerator.createAnimatedSprite(
                source: .atlasWithDetection(atlasURL),
                frameRate: 12.0,
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
                        self.spriteNode = spriteNode
                        
                        // Register with animation manager
                        if animationType == "idle" {
                            animationManager.setIdleSpriteNode(spriteNode)
                        } else if animationType == "attack" {
                            animationManager.setAttackSpriteNode(spriteNode)
                        }
                        
                        // Start appropriate animation
                        if animationType == "idle" {
                            startIdleAnimation()
                        } else if animationType == "attack" {
                            // Attack animation starts paused
                            pauseAttackAnimation()
                        }
                    } else {
                        hasError = true
                    }
                }
            }
        }
    }
    
    private func startIdleAnimation() {
        guard spriteNode != nil else { return }
        
        // Generate frame URLs for idle animation
        let frameURLs = R2AnimationLoader.shared.generateDoctorFrameURLs(
            animationType: "idle",
            frameCount: 45
        )
        
        guard !frameURLs.isEmpty else { return }
        
        // Load textures and create looping animation
        loadTexturesAndCreateAnimation(frameURLs: frameURLs, shouldLoop: true)
    }
    
    private func startAttackAnimation() {
        guard spriteNode != nil else { return }
        
        // Use preloaded attack textures for instant animation start
        if !preloadedTextures.isEmpty {
            createAnimationWithTextures(preloadedTextures, shouldLoop: false) {
                animationManager.onAttackCompleted()
            }
        } else {
            // Fallback: load textures if not preloaded
            let frameURLs = R2AnimationLoader.shared.generateDoctorFrameURLs(
                animationType: "attack",
                frameCount: 45
            )
            
            guard !frameURLs.isEmpty else { return }
            
            loadTexturesAndCreateAnimation(frameURLs: frameURLs, shouldLoop: false) {
                animationManager.onAttackCompleted()
            }
        }
    }
    
    private func pauseAttackAnimation() {
        spriteNode?.removeAllActions()
    }
    
    private func handleIdlePauseState(_ isPaused: Bool) {
        if isPaused {
            spriteNode?.isPaused = true
        } else {
            spriteNode?.isPaused = false
        }
    }
    
    private func handleAttackPlayState(_ isPlaying: Bool) {
        if isPlaying {
            startAttackAnimation()
        } else {
            pauseAttackAnimation()
        }
    }
    
    private func preloadAllAnimations(completion: @escaping () -> Void) {
        // Preload attack animation textures since they're the ones causing delay
        let attackFrameURLs = R2AnimationLoader.shared.generateDoctorFrameURLs(
            animationType: "attack",
            frameCount: 45
        )
        
        guard !attackFrameURLs.isEmpty else {
            completion()
            return
        }
        
        let group = DispatchGroup()
        var textures: [SKTexture] = []
        
        for (_, url) in attackFrameURLs.enumerated() {
            group.enter()
            
            URLSession.shared.dataTask(with: url) { data, response, error in
                defer { group.leave() }
                
                guard let httpResponse = response as? HTTPURLResponse,
                      httpResponse.statusCode == 200,
                      let data = data,
                      let image = UIImage(data: data) else {
                    return
                }
                
                let texture = SKTexture(image: image)
                textures.append(texture)
            }.resume()
        }
        
        group.notify(queue: .main) {
            self.preloadedTextures = textures
            completion()
        }
    }
    
    private func createAnimationWithTextures(_ textures: [SKTexture], shouldLoop: Bool, completion: (() -> Void)? = nil) {
        guard let spriteNode = self.spriteNode, !textures.isEmpty else { return }
        
        // Update sprite texture
        spriteNode.texture = textures[0]
        
        // Create animation
        let frameTime = 1.0 / 12.0
        let animateAction = SKAction.animate(with: textures, timePerFrame: frameTime)
        
        // Stop any existing animation
        spriteNode.removeAllActions()
        
        if shouldLoop {
            // For idle animation, loop forever
            let loopAction = SKAction.repeatForever(animateAction)
            spriteNode.run(loopAction)
        } else {
            // For attack animation, run once with completion
            if let completion = completion {
                let sequenceAction = SKAction.sequence([animateAction, SKAction.run(completion)])
                spriteNode.run(sequenceAction)
            } else {
                spriteNode.run(animateAction)
            }
        }
    }
    
    private func loadTexturesAndCreateAnimation(frameURLs: [URL], shouldLoop: Bool, completion: (() -> Void)? = nil) {
        let group = DispatchGroup()
        var textures: [SKTexture] = []
        
        for (_, url) in frameURLs.enumerated() {
            group.enter()
            
            URLSession.shared.dataTask(with: url) { data, response, error in
                defer { group.leave() }
                
                guard let httpResponse = response as? HTTPURLResponse,
                      httpResponse.statusCode == 200,
                      let data = data,
                      let image = UIImage(data: data) else {
                    return
                }
                
                let texture = SKTexture(image: image)
                textures.append(texture)
            }.resume()
        }
        
        group.notify(queue: .main) {
            self.createAnimationWithTextures(textures, shouldLoop: shouldLoop, completion: completion)
        }
    }
}

#Preview {
    TestAnimationsView()
        .environmentObject(NavigationManager())
}
