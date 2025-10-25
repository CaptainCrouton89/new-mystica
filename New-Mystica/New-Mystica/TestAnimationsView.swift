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
    @StateObject private var loader = MonsterAnimationLoader()
    
    // Animation settings
    let frameRate: Double
    
    // Sprite animation settings
    @State private var currentFrame: Int = 0
    @State private var animationTimer: Timer?
    @State private var isPlaying: Bool = false
    
    // Required initializer - no defaults
    init(frameRate: Double = 12.0) {
        self.frameRate = frameRate
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
                    
                    if loader.isLoading {
                        // Loading state
                        VStack(spacing: 16) {
                            ProgressView()
                                .scaleEffect(1.5)
                            
                            Text("Loading animation...")
                                .font(.headline)
                                .foregroundColor(.white)
                        }
                        .padding()
                        .background(Color.black.opacity(0.3))
                        .cornerRadius(12)
                        
                    } else if let errorMessage = loader.errorMessage {
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
                        
                    } else if loader.isReady, let animationData = loader.animationData {
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
                        // Initial state - start loading
                        VStack(spacing: 16) {
                            Image(systemName: "play.circle")
                                .font(.system(size: 48))
                                .foregroundColor(.white)
                            
                            Text("Ready to load animation")
                                .font(.headline)
                                .foregroundColor(.white)
                            
                            Button("Load Animation") {
                                Task {
                                    await loader.loadAnimation()
                                }
                            }
                            .buttonStyle(.borderedProminent)
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
                        loader.clearData()
                        Task {
                            await loader.loadAnimation()
                        }
                    }
                    .disabled(loader.isLoading)
                }
            }
            .onAppear {
                // Auto-load animation when view appears
                if !loader.isLoading && !loader.isReady {
                    Task {
                        await loader.loadAnimation()
                    }
                }
            }
            .onDisappear {
                // Stop animation when leaving the view
                stopAnimation()
            }
        }
    }
    
    // MARK: - Animation Methods
    
    private func startAnimation() {
        stopAnimation()
        
        guard let animationData = loader.animationData else { return }
        
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
        guard let animationData = loader.animationData else { return }
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

