//
//  SimpleAnimationTestView.swift
//  New-Mystica
//
//  Created by AI Assistant on 1/25/25.
//

import SwiftUI
import SpriteKit

/**
 * SimpleAnimationTestView - Frame carousel viewer for animation testing
 * 
 * ESSENTIAL FUNCTIONALITY:
 * - Display animation frames in a carousel format
 * - Browse frames manually to verify loading and order
 * - Test different monster types and animation types
 * - Show frame count and current frame information
 * 
 * USAGE: Navigate to this view to browse animation frames
 */
struct SimpleAnimationTestView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
        
                CircleSpriteAnimationView()
                Spacer()
            }
            .padding()
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

/**
 * CircleSpriteAnimationView - Simple animated sprite display for local circle sprite
 */
struct CircleSpriteAnimationView: View {
    let title = "Circle Sprite Animation (Local)"
    
    @State private var metadata: SpriteMetadata?
    
    var body: some View {
        VStack(spacing: 12) {
            
            // Animated Sprite Display
            if let metadata = metadata {
                SimpleAnimatedSpriteView(
                    spriteSheetPath: "CircleSprite",
                    frameRate: 12.0,
                    loopAnimation: true
                )                
                
            } else {
                VStack(spacing: 8) {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Loading metadata...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(width: 150, height: 150)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.gray.opacity(0.1))
                        .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                )
            }
        }
        .onAppear {
            loadMetadata()
        }
    }
    
    private func loadMetadata() {
        SpriteMetadataLoader.loadMetadataAsync(for: "CircleSprite") { loadedMetadata in
            DispatchQueue.main.async {
                self.metadata = loadedMetadata
            }
        }
    }
}

#Preview {
    SimpleAnimationTestView()
        .environmentObject(NavigationManager())
}
