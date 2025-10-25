//
//  TransparencyDiagnosticView.swift
//  New-Mystica
//
//  Created by AI Assistant on 1/25/25.
//

import SwiftUI
import SpriteKit

/**
 * TransparencyDiagnosticView - Focused diagnostic for black background issue
 * 
 * TESTS SPECIFIC TEXTURE CREATION METHODS:
 * 1. Direct UIImage to SKTexture
 * 2. CGImage to SKTexture with different bitmap info
 * 3. Manual alpha channel handling
 * 4. Different SpriteKit scene configurations
 */
struct TransparencyDiagnosticView: View {
    @State private var testResults: [String] = []
    @State private var selectedMethod = 0
    
    private let testMethods = [
        "Method 1: Direct UIImage",
        "Method 2: CGImage Premultiplied",
        "Method 3: CGImage Straight Alpha",
        "Method 4: Manual Alpha Fix",
        "Method 5: Replace Blend Mode"
    ]
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Transparency Diagnostic")
                .font(.headline)
                .padding()
            
            // Method selector
            Picker("Test Method", selection: $selectedMethod) {
                ForEach(0..<testMethods.count, id: \.self) { index in
                    Text(testMethods[index]).tag(index)
                }
            }
            .pickerStyle(SegmentedPickerStyle())
            .padding()
            
            // Test sprite display
            HStack(spacing: 20) {
                VStack {
                    Text("Test Sprite")
                        .font(.caption)
                    
                    DiagnosticTestSpriteView(method: selectedMethod)
                        .frame(width: 200, height: 200)
                        .background(Color.red.opacity(0.3)) // Red background to see transparency
                }
                
                VStack {
                    Text("Reference")
                        .font(.caption)
                    
                    ReferenceTransparencyView()
                        .frame(width: 200, height: 200)
                        .background(Color.blue.opacity(0.3)) // Blue background for comparison
                }
            }
            
            // Test results
            ScrollView {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(testResults, id: \.self) { result in
                        Text(result)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .frame(maxHeight: 200)
            .padding()
            .background(Color.gray.opacity(0.1))
            .cornerRadius(8)
            
            Button("Run Diagnostic") {
                runDiagnostic()
            }
            .buttonStyle(.bordered)
        }
        .onAppear {
            runDiagnostic()
        }
        .onChange(of: selectedMethod) {
            runDiagnostic()
        }
    }
    
    private func runDiagnostic() {
        testResults.removeAll()
        
        guard let image = UIImage(named: "SkeletonSprite") else {
            testResults.append("❌ Failed to load SkeletonSprite image")
            return
        }
        
        testResults.append("✅ SkeletonSprite image loaded")
        testResults.append("📊 Image size: \(image.size)")
        testResults.append("📊 Image scale: \(image.scale)")
        
        if let cgImage = image.cgImage {
            testResults.append("📊 CGImage alpha info: \(cgImage.alphaInfo.rawValue)")
            testResults.append("📊 CGImage bits per pixel: \(cgImage.bitsPerPixel)")
            
            // Test different alpha info types
            switch cgImage.alphaInfo {
            case .none, .noneSkipFirst, .noneSkipLast:
                testResults.append("❌ CRITICAL: Image has NO alpha channel!")
            case .premultipliedFirst, .premultipliedLast:
                testResults.append("⚠️ Image has premultiplied alpha - this can cause black backgrounds")
            case .first, .last:
                testResults.append("✅ Image has straight alpha - should work correctly")
            case .alphaOnly:
                testResults.append("✅ Image is alpha-only")
            @unknown default:
                testResults.append("❓ Unknown alpha format")
            }
        }
        
        testResults.append("")
        testResults.append("🔬 Testing texture creation methods...")
        
        // Test Method 1: Direct UIImage
        let texture1 = SKTexture(image: image)
        texture1.filteringMode = .nearest
        testResults.append("Method 1: Direct UIImage → SKTexture")
        testResults.append("  Texture size: \(texture1.size())")
        testResults.append("  Filtering mode: \(texture1.filteringMode.rawValue)")
        
        // Test Method 2: CGImage with premultiplied alpha
        if let cgImage = image.cgImage {
            let texture2 = SKTexture(cgImage: cgImage)
            texture2.filteringMode = .nearest
            testResults.append("Method 2: CGImage → SKTexture")
            testResults.append("  Texture size: \(texture2.size())")
        }
        
        testResults.append("")
        testResults.append("💡 Recommendations:")
        
        if let cgImage = image.cgImage {
            switch cgImage.alphaInfo {
            case .premultipliedFirst, .premultipliedLast:
                testResults.append("  • Try .replace blend mode instead of .alpha")
                testResults.append("  • Premultiplied alpha can cause black backgrounds")
                testResults.append("  • Consider re-exporting PNG with straight alpha")
            case .first, .last:
                testResults.append("  • Straight alpha should work with .alpha blend mode")
                testResults.append("  • Check SpriteKit scene backgroundColor = .clear")
            default:
                testResults.append("  • Image has no alpha channel - transparency won't work")
            }
        }
    }
}

struct DiagnosticTestSpriteView: View {
    let method: Int
    @State private var skView: SKView?
    
    var body: some View {
        GeometryReader { geometry in
            if let skView = skView, let scene = skView.scene {
                SpriteView(scene: scene)
                    .frame(width: geometry.size.width, height: geometry.size.height)
            } else {
                ProgressView()
                    .frame(width: geometry.size.width, height: geometry.size.height)
            }
        }
        .onAppear {
            createTestScene()
        }
        .onChange(of: method) {
            createTestScene()
        }
    }
    
    private func createTestScene() {
        guard let image = UIImage(named: "SkeletonSprite") else { return }
        
        let spriteNode: SKSpriteNode
        
        switch method {
        case 0:
            // Method 1: Direct UIImage
            let texture = SKTexture(image: image)
            texture.filteringMode = .nearest
            spriteNode = SKSpriteNode(texture: texture)
            spriteNode.blendMode = .alpha
            
        case 1:
            // Method 2: CGImage with premultiplied handling
            if let cgImage = image.cgImage {
                let texture = SKTexture(cgImage: cgImage)
                texture.filteringMode = .nearest
                spriteNode = SKSpriteNode(texture: texture)
                spriteNode.blendMode = .multiplyAlpha // Try premultiplied alpha blend mode
            } else {
                return
            }
            
        case 2:
            // Method 3: CGImage with straight alpha
            if let cgImage = image.cgImage {
                let texture = SKTexture(cgImage: cgImage)
                texture.filteringMode = .nearest
                spriteNode = SKSpriteNode(texture: texture)
                spriteNode.blendMode = .alpha // Straight alpha blend mode
            } else {
                return
            }
            
        case 3:
            // Method 4: Manual alpha fix
            if let cgImage = image.cgImage {
                // Create a new CGImage with proper alpha handling
                let colorSpace = CGColorSpaceCreateDeviceRGB()
                let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
                
                guard let context = CGContext(
                    data: nil,
                    width: cgImage.width,
                    height: cgImage.height,
                    bitsPerComponent: 8,
                    bytesPerRow: cgImage.width * 4,
                    space: colorSpace,
                    bitmapInfo: bitmapInfo
                ) else { return }
                
                context.draw(cgImage, in: CGRect(x: 0, y: 0, width: cgImage.width, height: cgImage.height))
                
                if let newCGImage = context.makeImage() {
                    let texture = SKTexture(cgImage: newCGImage)
                    texture.filteringMode = .nearest
                    spriteNode = SKSpriteNode(texture: texture)
                    spriteNode.blendMode = .alpha
                } else {
                    return
                }
            } else {
                return
            }
            
        case 4:
            // Method 5: Replace blend mode
            let texture = SKTexture(image: image)
            texture.filteringMode = .nearest
            spriteNode = SKSpriteNode(texture: texture)
            spriteNode.blendMode = .replace // Replace mode ignores alpha blending
            
        default:
            return
        }
        
        // Configure sprite node
        spriteNode.color = .clear
        spriteNode.colorBlendFactor = 0.0
        
        // Create scene
        let skView = SKView()
        skView.allowsTransparency = true
        skView.backgroundColor = .clear
        
        let scene = SKScene(size: CGSize(width: 200, height: 200))
        scene.backgroundColor = .clear
        scene.scaleMode = .aspectFit
        
        spriteNode.position = CGPoint(x: 100, y: 100)
        scene.addChild(spriteNode)
        
        skView.presentScene(scene)
        self.skView = skView
    }
}

struct ReferenceTransparencyView: View {
    @State private var skView: SKView?
    
    var body: some View {
        GeometryReader { geometry in
            if let skView = skView, let scene = skView.scene {
                SpriteView(scene: scene)
                    .frame(width: geometry.size.width, height: geometry.size.height)
            } else {
                ProgressView()
                    .frame(width: geometry.size.width, height: geometry.size.height)
            }
        }
        .onAppear {
            createReferenceScene()
        }
    }
    
    private func createReferenceScene() {
        // Create a reference sprite with known transparency
        let size = CGSize(width: 200, height: 200)
        let renderer = UIGraphicsImageRenderer(size: size)
        
        let referenceImage = renderer.image { context in
            // Clear background
            context.cgContext.clear(CGRect(origin: .zero, size: size))
            
            // Draw a simple shape with transparency
            context.cgContext.setFillColor(UIColor.red.cgColor)
            context.cgContext.fillEllipse(in: CGRect(x: 50, y: 50, width: 100, height: 100))
            
            context.cgContext.setFillColor(UIColor.blue.withAlphaComponent(0.5).cgColor)
            context.cgContext.fillEllipse(in: CGRect(x: 75, y: 75, width: 50, height: 50))
        }
        
        let texture = SKTexture(image: referenceImage)
        texture.filteringMode = .nearest
        
        let spriteNode = SKSpriteNode(texture: texture)
        spriteNode.color = .clear
        spriteNode.colorBlendFactor = 0.0
        spriteNode.blendMode = .alpha
        
        let skView = SKView()
        skView.allowsTransparency = true
        skView.backgroundColor = .clear
        
        let scene = SKScene(size: size)
        scene.backgroundColor = .clear
        scene.scaleMode = .aspectFit
        
        spriteNode.position = CGPoint(x: 100, y: 100)
        scene.addChild(spriteNode)
        
        skView.presentScene(scene)
        self.skView = skView
    }
}

#Preview {
    TransparencyDiagnosticView()
}
