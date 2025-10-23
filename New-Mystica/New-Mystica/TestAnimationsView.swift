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
    @State private var selectedAnimation = "birdman_attack"
    @State private var frameRate: Double = 12.0
    @State private var animationSize: CGFloat = 200.0
    @State private var useRemoteLoading = false
    
    // Available animations - using the existing sprite folders
    private let availableAnimations = [
        "birdman pose 1": "https://example.com/sprites/birdman/pose1",
        "birdman pose 2": "https://example.com/sprites/birdman/pose2"
    ]
    
    // R2 Animation URLs using the R2AnimationLoader
    private var sampleR2Urls: [URL] {
        return R2AnimationLoader.loadBirdmanAttackAnimation()
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                // Background
                Color.black.opacity(0.1)
                    .ignoresSafeArea()
                
                VStack(spacing: 30) {
                    // Header
                    VStack(spacing: 8) {
                        Text("Animation Test Center")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .foregroundColor(.primary)
                        
                        Text("Test sprite animations using SpriteAnimationGenerator")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                        
                        // Debug info
                        Text("Bundle Path: \(Bundle.main.resourcePath ?? "nil")")
                            .font(.caption)
                            .foregroundColor(.orange)
                    }
                    .padding(.top, 20)
                    
                    // Animation Display Area
                    VStack(spacing: 20) {
                        Text("Animation Preview")
                            .font(.headline)
                            .foregroundColor(.primary)
                        
                        // Animation Preview - Local or Remote
                        VStack {
                            if useRemoteLoading {
                                // Remote animation loading
                                RemoteAnimatedSpriteView(
                                    frameUrls: sampleR2Urls,
                                    frameRate: frameRate,
                                    size: CGSize(width: animationSize, height: animationSize)
                                )
                                .background(
                                    RoundedRectangle(cornerRadius: 16)
                                        .fill(Color.gray.opacity(0.1))
                                        .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                                )
                                .padding()
                                
                                Text("Loading from R2 bucket")
                                    .font(.caption)
                                    .foregroundColor(.blue)
                            } else {
                                // Local animation loading (fallback)
                                RoundedRectangle(cornerRadius: 16)
                                    .fill(Color.gray.opacity(0.1))
                                    .frame(width: animationSize, height: animationSize)
                                    .overlay(
                                        VStack {
                                            Text("Local Loading")
                                                .foregroundColor(.secondary)
                                            Text("(Files not in bundle)")
                                                .font(.caption)
                                                .foregroundColor(.orange)
                                        }
                                    )
                                    .padding()
                                
                                Text("Local files not available in bundle")
                                    .font(.caption)
                                    .foregroundColor(.orange)
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                    
                    // Controls
                    VStack(spacing: 20) {
                        // Loading Mode Toggle
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Loading Mode:")
                                .font(.headline)
                                .foregroundColor(.primary)
                            
                            Toggle("Use Remote Loading (R2)", isOn: $useRemoteLoading)
                                .toggleStyle(SwitchToggleStyle())
                                .padding()
                                .background(
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(useRemoteLoading ? Color.blue.opacity(0.1) : Color.gray.opacity(0.1))
                                )
                        }
                        
                        // Animation Selection
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Select Animation:")
                                .font(.headline)
                                .foregroundColor(.primary)
                            
                            Picker("Animation", selection: $selectedAnimation) {
                                ForEach(Array(availableAnimations.keys.sorted()), id: \.self) { animationName in
                                    Text(animationName.replacingOccurrences(of: "_", with: " ").capitalized)
                                        .tag(animationName)
                                }
                            }
                            .pickerStyle(MenuPickerStyle())
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(Color.gray.opacity(0.1))
                            )
                        }
                        
                        // Frame Rate Control
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Frame Rate: \(String(format: "%.1f", frameRate)) FPS")
                                .font(.headline)
                                .foregroundColor(.primary)
                            
                            Slider(value: $frameRate, in: 5...30, step: 1)
                                .accentColor(.blue)
                        }
                        
                        // Size Control
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Animation Size: \(Int(animationSize))px")
                                .font(.headline)
                                .foregroundColor(.primary)
                            
                            Slider(value: $animationSize, in: 100...400, step: 20)
                                .accentColor(.blue)
                        }
                        
                        // Animation Info
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Animation Info:")
                                .font(.headline)
                                .foregroundColor(.primary)
                            
                            if useRemoteLoading {
                                Text("Mode: Remote Loading from R2")
                                    .font(.caption)
                                    .foregroundColor(.blue)
                                
                                Text("Using SpriteAnimationGenerator.createAnimatedSpriteFromURLs()")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                
                                Text("Loading \(sampleR2Urls.count) frames from R2 bucket")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            } else {
                                Text("Mode: Local Loading")
                                    .font(.caption)
                                    .foregroundColor(.orange)
                                
                                Text("Using SpriteAnimationGenerator.createAnimatedSprite()")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                
                                Text("TypeScript script available: create-sprite-animation.ts")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(useRemoteLoading ? Color.blue.opacity(0.1) : Color.orange.opacity(0.1))
                        )
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

#Preview {
    TestAnimationsView()
        .environmentObject(NavigationManager())
}
