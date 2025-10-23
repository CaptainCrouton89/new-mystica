//
//  AnimationDemo.swift
//  New-Mystica
//
//  Created by AI Assistant on 1/25/25.
//

import SwiftUI
import SpriteKit

/**
 * AnimationDemo - Demonstrates how to use both the TypeScript script and Swift SpriteAnimationGenerator
 * This shows the integration between the two systems
 */
struct AnimationDemo: View {
    @State private var showTypeScriptInfo = false
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Animation System Demo")
                .font(.title)
                .fontWeight(.bold)
            
            // Swift SpriteAnimationGenerator Demo
            VStack(spacing: 10) {
                Text("Swift SpriteAnimationGenerator")
                    .font(.headline)
                    .foregroundColor(.blue)
                
                Text("Creates real-time animations using SpriteKit")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                if let animationPath = Bundle.main.path(forResource: "sprites/enemies/bird man/attack", ofType: nil) {
                    AnimatedSpriteView(
                        folderPath: animationPath,
                        frameRate: 12.0,
                        size: CGSize(width: 150, height: 150)
                    )
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.gray.opacity(0.1))
                    )
                } else {
                    Text("Animation files not found in bundle")
                        .foregroundColor(.red)
                }
            }
            
            // TypeScript Script Info
            VStack(spacing: 10) {
                Text("TypeScript create-sprite-animation.ts")
                    .font(.headline)
                    .foregroundColor(.green)
                
                Text("Creates GIF animations using ImageMagick")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Button("Show Script Usage") {
                    showTypeScriptInfo.toggle()
                }
                .buttonStyle(.bordered)
                
                if showTypeScriptInfo {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Usage:")
                            .fontWeight(.semibold)
                        
                        Text("pnpm tsx create-sprite-animation.ts \\")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.secondary)
                        
                        Text("  \"sprites/enemies/bird man/attack\" \\")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.secondary)
                        
                        Text("  \"sprites/animations/birdman\" \\")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.secondary)
                        
                        Text("  --name birdman_attack --fps 15")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.secondary)
                        
                        Text("Output: birdman_attack_15fps.gif")
                            .font(.caption)
                            .foregroundColor(.blue)
                            .padding(.top, 4)
                    }
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.gray.opacity(0.1))
                    )
                }
            }
            
            // Integration Info
            VStack(spacing: 8) {
                Text("Integration")
                    .font(.headline)
                    .foregroundColor(.purple)
                
                Text("• TypeScript script creates GIF files for sharing/exports")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text("• Swift SpriteAnimationGenerator creates real-time UI animations")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text("• Both use the same sprite frame folders")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.purple.opacity(0.1))
            )
        }
        .padding()
    }
}

#Preview {
    AnimationDemo()
}
