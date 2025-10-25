//
//  TestAnimationsView.swift
//  New-Mystica
//
//  Created by AI Assistant on 1/25/25.
//

import SwiftUI

// MARK: - Animation Metadata Models

struct SpriteFrame: Codable {
    let frame: Int
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct SpriteSize: Codable {
    let w: Double
    let h: Double
    
    var cgSize: CGSize {
        CGSize(width: w, height: h)
    }
}

struct SpriteMetadata: Codable {
    let image: String
    let size: SpriteSize
    let frameSize: SpriteSize
    let frameCount: Int
    let cols: Int
    let rows: Int
}

struct AnimationData: Codable {
    let frames: [SpriteFrame]
    let meta: SpriteMetadata
    
    // MARK: - Convenience Initializers
    
    /// Decode from JSON data
    static func from(jsonData: Data) throws -> AnimationData {
        let decoder = JSONDecoder()
        return try decoder.decode(AnimationData.self, from: jsonData)
    }
    
    /// Decode from JSON string
    static func from(jsonString: String) throws -> AnimationData {
        guard let data = jsonString.data(using: .utf8) else {
            throw NSError(domain: "AnimationData", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid JSON string"])
        }
        return try from(jsonData: data)
    }
}

struct TestAnimationsView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    
    // Animation settings
    let frameRate: Double
    let monsterId: String
    
    // Animation type management
    @State private var selectedAnimationType: String = "idle"
    private let animationTypes = ["idle", "attack", "damage", "death"]
    
    // Multiple loaders for each animation type
    @State private var idleLoader: MonsterAnimationLoader?
    @State private var attackLoader: MonsterAnimationLoader?
    @State private var damageLoader: MonsterAnimationLoader?
    @State private var deathLoader: MonsterAnimationLoader?
    
    // Sprite animation settings
    @State private var currentFrame: Int = 0
    @State private var animationTimer: Timer?
    @State private var isPlaying: Bool = false
    
    // Required initializer
    init(monsterId: String, frameRate: Double = 12.0) {
        self.monsterId = monsterId
        self.frameRate = frameRate
    }
    
    // MARK: - Computed Properties
    
    /// Get the current loader based on selected animation type
    private var currentLoader: MonsterAnimationLoader? {
        switch selectedAnimationType {
        case "idle": return idleLoader
        case "attack": return attackLoader
        case "damage": return damageLoader
        case "death": return deathLoader
        default: return idleLoader
        }
    }
    
    /// Get loader for specific animation type
    private func getLoader(for animationType: String) -> MonsterAnimationLoader? {
        switch animationType {
        case "idle": return idleLoader
        case "attack": return attackLoader
        case "damage": return damageLoader
        case "death": return deathLoader
        default: return nil
        }
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                // Red to yellow gradient background
                LinearGradient(
                    gradient: Gradient(colors: [Color.red, Color.yellow]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                VStack(spacing: 30) {
                    
                    // Monster ID and Animation Type Selector
                    VStack(spacing: 12) {
                        Text("Monster ID: \(monsterId)")
                            .font(.headline)
                            .foregroundColor(.white)
                        
                        Text("Animation Type: \(selectedAnimationType.capitalized)")
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.8))
                        
                        // Animation type picker
                        Picker("Animation Type", selection: $selectedAnimationType) {
                            ForEach(animationTypes, id: \.self) { animationType in
                                Text(animationType.capitalized)
                                    .tag(animationType)
                            }
                        }
                        .pickerStyle(SegmentedPickerStyle())
                        .background(Color.white.opacity(0.2))
                        .cornerRadius(8)
                        .onChange(of: selectedAnimationType) { _, newType in
                            // Reset animation when switching types
                            stopAnimation()
                            currentFrame = 0
                            
                            // Get the loader for the new animation type
                            let newLoader = getLoader(for: newType)
                            
                            // Load the new animation type if not already loaded
                            if let loader = newLoader, !loader.isReady && !loader.isLoading {
                                Task {
                                    await loader.loadAnimation()
                                }
                            } else if let loader = newLoader, loader.isReady {
                                // If animation is already loaded, start playing it immediately
                                DispatchQueue.main.async {
                                    self.startAnimation()
                                }
                            }
                        }
                    }
                    .padding()
                    .background(Color.black.opacity(0.3))
                    .cornerRadius(12)
                    
                    if let loader = currentLoader, loader.isLoading {
                        // Loading state
                        VStack(spacing: 16) {
                            ProgressView()
                                .scaleEffect(1.5)
                            
                            Text("Loading \(selectedAnimationType) animation...")
                                .font(.headline)
                                .foregroundColor(.white)
                            
                            // Show loading progress for all animations
                            VStack(spacing: 8) {
                                Text("Loading all animations...")
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.8))
                                
                                HStack(spacing: 4) {
                                    ForEach(animationTypes, id: \.self) { animationType in
                                        let loader = getLoader(for: animationType)
                                        Circle()
                                            .fill(loader?.isReady == true ? Color.green : 
                                                  loader?.isLoading == true ? Color.yellow : Color.gray)
                                            .frame(width: 8, height: 8)
                                    }
                                }
                            }
                        }
                        .padding()
                        .background(Color.black.opacity(0.3))
                        .cornerRadius(12)
                        
                    } else if let loader = currentLoader, let errorMessage = loader.errorMessage {
                        // Error state
                        VStack(spacing: 16) {
                            Image(systemName: "exclamationmark.triangle")
                                .font(.system(size: 48))
                                .foregroundColor(.red)
                            
                            Text("Failed to load animation")
                                .font(.headline)
                                .foregroundColor(.white)
                            
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.8))
                                .multilineTextAlignment(.center)
                            
                            Button("Retry") {
                                Task {
                                    await loader.loadAnimation()
                                }
                            }
                            .buttonStyle(.borderedProminent)
                        }
                        .padding()
                        .background(Color.black.opacity(0.3))
                        .cornerRadius(12)
                        
                    } else if let loader = currentLoader, loader.isReady, let animationData = loader.animationData {
                        // Success state - show animation
                        VStack(spacing: 20) {                                
                            // Sprite animation using frame-specific coordinates
                            if currentFrame < animationData.frames.count {
                                let currentFrameData = animationData.frames[currentFrame]
                                Group {
                                    if let spriteImage = loader.spriteImage {
                                        // Use loaded UIImage
                                        Image(uiImage: spriteImage)
                                            .resizable()
                                            .aspectRatio(contentMode: .fill)
                                            .frame(
                                                width: animationData.meta.size.w / 5,
                                                height: animationData.meta.size.h / 5
                                            )
                                            .offset(
                                                x: -(currentFrameData.x - (2 * animationData.meta.frameSize.w)) / 5,
                                                y: -(currentFrameData.y - (2 * animationData.meta.frameSize.h)) / 5
                                            )
                                            .frame(
                                                width: currentFrameData.width / 5,
                                                height: currentFrameData.height / 5
                                            )
                                            .clipped()
                                    } 
                                }
                            }
                            
                            // Full sprite sheet image for debugging
                            VStack(spacing: 8) {
                                Text("Full Sprite Sheet")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                
                                if let spriteImage = loader.spriteImage {
                                    Image(uiImage: spriteImage)
                                        .resizable()
                                        .aspectRatio(contentMode: .fit)
                                        .frame(maxWidth: 300, maxHeight: 200)
                                        .border(Color.white, width: 2)
                                        .cornerRadius(8)
                                }
                                
                                Text("Grid: \(animationData.meta.cols) × \(animationData.meta.rows)")
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.8))
                                
                                Text("Size: \(Int(animationData.meta.size.w)) × \(Int(animationData.meta.size.h))")
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.8))
                            }
                            .padding()
                            .background(Color.black.opacity(0.3))
                            .cornerRadius(12)

                            
                            // Frame controls
                            VStack(spacing: 12) {
                                // Frame info
                                Text("Frame \(currentFrame + 1) of \(animationData.frames.count)")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                
                                // Frame stepping controls
                                HStack(spacing: 20) {
                                    Button(action: previousFrame) {
                                        Image(systemName: "chevron.left")
                                            .font(.title2)
                                            .foregroundColor(.white)
                                    }
                                    .disabled(currentFrame <= 0)
                                    
                                    Button(action: togglePlayPause) {
                                        Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                                            .font(.title2)
                                            .foregroundColor(.white)
                                    }
                                    
                                    Button(action: nextFrame) {
                                        Image(systemName: "chevron.right")
                                            .font(.title2)
                                            .foregroundColor(.white)
                                    }
                                    .disabled(currentFrame >= animationData.frames.count - 1)
                                }
                                .padding()
                                .background(Color.black.opacity(0.3))
                                .cornerRadius(12)
                                
                                // Frame slider
                                VStack(spacing: 8) {
                                    Text("Frame Position")
                                        .font(.caption)
                                        .foregroundColor(.white.opacity(0.8))
                                    
                                    Slider(
                                        value: Binding(
                                            get: { Double(currentFrame) },
                                            set: { newValue in
                                                currentFrame = Int(newValue)
                                            }
                                        ),
                                        in: 0...Double(animationData.frames.count - 1),
                                        step: 1
                                    )
                                    .accentColor(.white)
                                }
                                .padding(.horizontal)
                            }
                        }
                        
                    } else {
                        // All animations loaded successfully
                        VStack(spacing: 16) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 48))
                                .foregroundColor(.green)
                            
                            Text("All animations loaded successfully!")
                                .font(.headline)
                                .foregroundColor(.white)
                            
                            Text("Currently playing: \(selectedAnimationType.capitalized)")
                                .font(.subheadline)
                                .foregroundColor(.white.opacity(0.8))
                        }
                        .padding()
                        .background(Color.black.opacity(0.3))
                        .cornerRadius(12)
                    }
                    
                    Spacer()
                }
                .padding()
            }
            .navigationTitle("Test Animations")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Back") {
                        navigationManager.navigateBack()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Reload") {
                        if let loader = currentLoader {
                            loader.clearData()
                            Task {
                                await loader.loadAnimation()
                            }
                        }
                    }
                    .disabled(currentLoader?.isLoading ?? false)
                }
            }
            .onAppear {
                // Initialize loaders and auto-load all animations when view appears
                initializeLoaders()
                
                // Load all animation types automatically
                Task {
                    await loadAllAnimations()
                }
            }
            .onDisappear {
                // Stop animation when leaving the view
                stopAnimation()
            }
        }
    }
    
    // MARK: - Animation Methods
    
    /// Initialize all animation loaders with the current monster ID
    private func initializeLoaders() {
        idleLoader = MonsterAnimationLoader(monsterId: monsterId, animationType: "idle")
        attackLoader = MonsterAnimationLoader(monsterId: monsterId, animationType: "attack")
        damageLoader = MonsterAnimationLoader(monsterId: monsterId, animationType: "damage")
        deathLoader = MonsterAnimationLoader(monsterId: monsterId, animationType: "death")
    }
    
    /// Load all animation types automatically
    private func loadAllAnimations() async {
        // Load all animations concurrently
        await withTaskGroup(of: Void.self) { group in
            if let idleLoader = idleLoader {
                group.addTask { await idleLoader.loadAnimation() }
            }
            if let attackLoader = attackLoader {
                group.addTask { await attackLoader.loadAnimation() }
            }
            if let damageLoader = damageLoader {
                group.addTask { await damageLoader.loadAnimation() }
            }
            if let deathLoader = deathLoader {
                group.addTask { await deathLoader.loadAnimation() }
            }
        }
        
        // Start playing idle animation automatically once it's loaded
        DispatchQueue.main.async {
            if let idleLoader = self.idleLoader, idleLoader.isReady {
                self.startAnimation()
            }
        }
    }
    
    private func startAnimation() {
        stopAnimation()
        
        guard let loader = currentLoader, let animationData = loader.animationData else { return }
        
        isPlaying = true
        animationTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / frameRate, repeats: true) { _ in
            DispatchQueue.main.async {
                // Remove withAnimation to prevent smooth transitions between frames
                // Sprite animation should snap instantly to each frame
                currentFrame = (currentFrame + 1) % animationData.frames.count
            }
        }
    }
    
    private func stopAnimation() {
        animationTimer?.invalidate()
        animationTimer = nil
        isPlaying = false
    }
    
    private func togglePlayPause() {
        if isPlaying {
            stopAnimation()
        } else {
            startAnimation()
        }
    }
    
    private func nextFrame() {
        guard let loader = currentLoader, let animationData = loader.animationData else { return }
        if currentFrame < animationData.frames.count - 1 {
            currentFrame += 1
        }
    }
    
    private func previousFrame() {
        if currentFrame > 0 {
            currentFrame -= 1
        }
    }
}

