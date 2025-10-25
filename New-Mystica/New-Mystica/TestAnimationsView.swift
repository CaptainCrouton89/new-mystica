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
                        ZStack {
                            // Display the loaded sprite image as background reference
                            if let spriteImage = loader.spriteImage {
                                Image(uiImage: spriteImage)
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(width: animationData.meta.size.w, height: animationData.meta.size.h)
                                    .opacity(0.1) // Make it very faint as background reference
                            }
                            
                            // Sprite animation using frame-specific coordinates
                            if let currentFrameData = animationData.frames.first(where: { $0.frame == currentFrame }) {
                                Group {
                                    if let spriteImage = loader.spriteImage {
                                        // Use loaded UIImage
                                        Image(uiImage: spriteImage)
                                            .resizable()
                                            .aspectRatio(contentMode: .fill)
                                            .frame(width: animationData.meta.size.w, height: animationData.meta.size.h)
                                            .offset(
                                                x: -currentFrameData.x,
                                                y: -currentFrameData.y
                                            )
                                            .frame(width: currentFrameData.width, height: currentFrameData.height)
                                            .clipped()
                                    } 
                                }
                                .onAppear {
                                    startAnimation()
                                }
                                .onDisappear {
                                    stopAnimation()
                                }
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
        }
    }
    
    // MARK: - Animation Methods
    
    private func startAnimation() {
        stopAnimation()
        
        guard let animationData = loader.animationData else { return }
        
        animationTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / frameRate, repeats: true) { _ in
            DispatchQueue.main.async {
                withAnimation(.linear(duration: 1.0 / frameRate)) {
                    currentFrame = (currentFrame + 1) % animationData.meta.frameCount
                }
            }
        }
    }
    
    private func stopAnimation() {
        animationTimer?.invalidate()
        animationTimer = nil
    }
}

