//
//  TransparencyTestView.swift
//  New-Mystica
//
//  Created by AI Assistant on 1/25/25.
//

import SwiftUI
import SpriteKit

/**
 * TransparencyTestView - Comprehensive test environment for sprite transparency issues
 * 
 * TESTS THE FOLLOWING POTENTIAL CAUSES:
 * 1. Image alpha channel import/handling
 * 2. SpriteKit scene/view transparency compositing
 * 3. Blend mode and premultiplied alpha issues
 * 
 * USAGE: Add to NavigationManager for testing
 */
struct TransparencyTestView: View {
    @State private var selectedTest = 0
    @State private var testResults: [String] = []
    
    private let testCases = [
        "Basic Transparency Test",
        "Alpha Channel Analysis", 
        "Blend Mode Comparison",
        "Scene Configuration Test",
        "Reference Image Test",
        "Black Background Diagnostic"
    ]
    
    var body: some View {
        VStack(spacing: 20) {
            // Test selector
            Picker("Test Case", selection: $selectedTest) {
                ForEach(0..<testCases.count, id: \.self) { index in
                    Text(testCases[index]).tag(index)
                }
            }
            .pickerStyle(SegmentedPickerStyle())
            .padding()
            
            // Test content
            Group {
                switch selectedTest {
                case 0:
                    BasicTransparencyTest()
                case 1:
                    AlphaChannelAnalysisTest()
                case 2:
                    BlendModeComparisonTest()
                case 3:
                    SceneConfigurationTest()
                case 4:
                    ReferenceImageTest()
                case 5:
                    TransparencyDiagnosticView()
                default:
                    BasicTransparencyTest()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            
            // Test results
            if !testResults.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Test Results:")
                        .font(.headline)
                        .foregroundColor(.primary)
                    
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 2) {
                            ForEach(testResults, id: \.self) { result in
                                Text(result)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .frame(maxHeight: 150)
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(8)
            }
        }
        .navigationTitle("Transparency Tests")
        .onAppear {
            runSelectedTest()
        }
        .onChange(of: selectedTest) {
            runSelectedTest()
        }
    }
    
    private func runSelectedTest() {
        testResults.removeAll()
        
        switch selectedTest {
        case 0:
            runBasicTransparencyTest()
        case 1:
            runAlphaChannelAnalysis()
        case 2:
            runBlendModeComparison()
        case 3:
            runSceneConfigurationTest()
        case 4:
            runReferenceImageTest()
        case 5:
            runBlackBackgroundDiagnostic()
        default:
            break
        }
    }
    
    // MARK: - Test 1: Basic Transparency Test
    private func runBasicTransparencyTest() {
        testResults.append("🔍 Running comprehensive transparency analysis...")
        
        let report = ImageAnalysisTool.analyzeImage(named: "SkeletonSprite")
        let reportText = report.generateReport()
        
        // Split report into lines and add to test results
        let lines = reportText.components(separatedBy: "\n")
        testResults.append(contentsOf: lines)
        
        // Add specific recommendations
        testResults.append("\n💡 Recommendations:")
        
        if report.criticalIssues.contains(where: { $0.type == .noAlphaChannel }) {
            testResults.append("  • Image has no alpha channel - transparency will not work")
            testResults.append("  • Consider re-exporting the image with alpha channel enabled")
        }
        
        if report.criticalIssues.contains(where: { $0.type == .premultipliedAlpha }) {
            testResults.append("  • Image has premultiplied alpha - may cause blending issues")
            testResults.append("  • Try using .replace blend mode instead of .alpha")
        }
        
        if report.warnings.contains(where: { $0.type == .lowBitDepth }) {
            testResults.append("  • Low bit depth detected - consider using 32-bit images")
        }
        
        testResults.append("  • Ensure SpriteKit scene has backgroundColor = .clear")
        testResults.append("  • Ensure SKView has allowsTransparency = true")
        testResults.append("  • Try different blend modes: .alpha, .replace, .multiplyAlpha")
    }
    
    // MARK: - Test 2: Alpha Channel Analysis
    private func runAlphaChannelAnalysis() {
        testResults.append("🔍 Analyzing alpha channel...")
        
        guard let image = UIImage(named: "SkeletonSprite"),
              let cgImage = image.cgImage else {
            testResults.append("❌ Failed to load image for analysis")
            return
        }
        
        // Create a test texture and analyze it
        let texture = SKTexture(image: image)
        testResults.append("✅ Created SKTexture from image")
        testResults.append("📊 Texture size: \(texture.size())")
        testResults.append("📊 Texture filtering mode: \(texture.filteringMode.rawValue)")
        
        // Test different texture creation methods
        testResults.append("🔬 Testing texture creation methods...")
        
        // Method 1: Direct from image
        let texture1 = SKTexture(image: image)
        texture1.filteringMode = .nearest
        testResults.append("✅ Method 1: Direct image → texture (nearest)")
        
        // Method 2: With linear filtering
        let texture2 = SKTexture(image: image)
        texture2.filteringMode = .linear
        testResults.append("✅ Method 2: Direct image → texture (linear)")
        
        // Method 3: From CGImage
        let texture3 = SKTexture(cgImage: cgImage)
        texture3.filteringMode = .nearest
        testResults.append("✅ Method 3: CGImage → texture (nearest)")
    }
    
    // MARK: - Test 3: Blend Mode Comparison
    private func runBlendModeComparison() {
        testResults.append("🔍 Testing blend modes...")
        
        let blendModes: [SKBlendMode] = [.alpha, .add, .subtract, .multiply, .multiplyAlpha, .replace]
        
        for mode in blendModes {
            testResults.append("🎨 Testing blend mode: \(mode.rawValue)")
        }
        
        testResults.append("📝 Blend mode recommendations:")
        testResults.append("  • .alpha: Standard transparency blending")
        testResults.append("  • .replace: Replace pixels completely")
        testResults.append("  • .multiplyAlpha: Premultiplied alpha blending")
    }
    
    // MARK: - Test 4: Scene Configuration Test
    private func runSceneConfigurationTest() {
        testResults.append("🔍 Testing scene configurations...")
        
        testResults.append("📝 Scene transparency settings:")
        testResults.append("  • scene.backgroundColor = .clear")
        testResults.append("  • scene.scaleMode = .aspectFit")
        testResults.append("  • skView.allowsTransparency = true")
        testResults.append("  • skView.backgroundColor = .clear")
        
        testResults.append("📝 Sprite node settings:")
        testResults.append("  • spriteNode.color = .clear")
        testResults.append("  • spriteNode.colorBlendFactor = 0.0")
        testResults.append("  • spriteNode.blendMode = .alpha")
    }
    
    // MARK: - Test 5: Reference Image Test
    private func runReferenceImageTest() {
        testResults.append("🔍 Testing with reference images...")
        
        // Create a simple test image with known transparency
        testResults.append("🎨 Creating reference test image...")
        
        let size = CGSize(width: 100, height: 100)
        let renderer = UIGraphicsImageRenderer(size: size)
        
        let testImage = renderer.image { context in
            // Draw a red circle with transparency
            context.cgContext.setFillColor(UIColor.red.cgColor)
            context.cgContext.fillEllipse(in: CGRect(x: 25, y: 25, width: 50, height: 50))
            
            // Draw a blue square with transparency
            context.cgContext.setFillColor(UIColor.blue.withAlphaComponent(0.5).cgColor)
            context.cgContext.fill(CGRect(x: 30, y: 30, width: 40, height: 40))
        }
        
        testResults.append("✅ Created reference test image")
        testResults.append("📊 Reference image size: \(testImage.size)")
        
        if let cgImage = testImage.cgImage {
            let alphaInfo = cgImage.alphaInfo
            testResults.append("📊 Reference alpha info: \(alphaInfo.rawValue)")
        }
    }
    
    // MARK: - Test 6: Black Background Diagnostic
    private func runBlackBackgroundDiagnostic() {
        testResults.append("🔍 Diagnosing black background issue...")
        
        guard let image = UIImage(named: "SkeletonSprite") else {
            testResults.append("❌ Failed to load SkeletonSprite image")
            return
        }
        
        testResults.append("✅ SkeletonSprite image loaded")
        
        if let cgImage = image.cgImage {
            testResults.append("📊 CGImage alpha info: \(cgImage.alphaInfo.rawValue)")
            
            switch cgImage.alphaInfo {
            case .premultipliedFirst, .premultipliedLast:
                testResults.append("⚠️ FOUND THE ISSUE: Premultiplied alpha!")
                testResults.append("💡 SOLUTION: Use .replace blend mode instead of .alpha")
                testResults.append("💡 ALTERNATIVE: Re-export PNG with straight alpha")
            case .first, .last:
                testResults.append("✅ Image has straight alpha - issue is elsewhere")
                testResults.append("💡 Check SpriteKit scene configuration")
            case .none, .noneSkipFirst, .noneSkipLast:
                testResults.append("❌ CRITICAL: No alpha channel - transparency impossible")
            default:
                testResults.append("❓ Unknown alpha format")
            }
        }
        
        testResults.append("")
        testResults.append("🔧 Quick Fixes to Try:")
        testResults.append("  1. Change blendMode to .replace")
        testResults.append("  2. Ensure scene.backgroundColor = .clear")
        testResults.append("  3. Ensure skView.allowsTransparency = true")
        testResults.append("  4. Try .multiplyAlpha blend mode")
    }
}

// MARK: - Test View Components

struct BasicTransparencyTest: View {
    var body: some View {
        VStack(spacing: 20) {

            VStack {
                Text("Original SkeletonSprite")
                    .font(.caption)
                
                SimpleAnimatedSpriteView(spriteSheetPath: "SkeletonSprite")
                    .frame(width: 200, height: 200)
                    .background(Color.yellow.opacity(0.3)) // Yellow background to see transparency
            }
            
            // Test 2: With different background
            VStack {
                Text("With Red Background")
                    .font(.caption)
                
                SimpleAnimatedSpriteView(spriteSheetPath: "SkeletonSprite")
                    .frame(width: 200, height: 200)
                    .background(Color.red.opacity(0.5))
            }
        }
    }
}

struct AlphaChannelAnalysisTest: View {
    @State private var analysisResults: [String] = []
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Alpha Channel Analysis")
                .font(.headline)
            
            // Show different texture filtering modes
            HStack(spacing: 20) {
                VStack {
                    Text("Nearest Filtering")
                        .font(.caption)
                    TestSpriteView(filteringMode: .nearest, blendMode: nil)
                        .frame(width: 100, height: 100)
                        .background(Color.green.opacity(0.3))
                }
                
                VStack {
                    Text("Linear Filtering")
                        .font(.caption)
                    TestSpriteView(filteringMode: .linear, blendMode: nil)
                        .frame(width: 100, height: 100)
                        .background(Color.green.opacity(0.3))
                }
            }
            
            // Analysis results
            if !analysisResults.isEmpty {
                VStack(alignment: .leading) {
                    Text("Analysis Results:")
                        .font(.subheadline)
                    ForEach(analysisResults, id: \.self) { result in
                        Text(result)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(8)
            }
        }
        .onAppear {
            performAlphaAnalysis()
        }
    }
    
    private func performAlphaAnalysis() {
        guard let image = UIImage(named: "SkeletonSprite") else {
            analysisResults.append("❌ Failed to load image")
            return
        }
        
        analysisResults.append("✅ Image loaded successfully")
        analysisResults.append("📊 Size: \(image.size)")
        
        if let cgImage = image.cgImage {
            analysisResults.append("📊 Alpha info: \(cgImage.alphaInfo.rawValue)")
            analysisResults.append("📊 Color space: \((cgImage.colorSpace?.name as String?) ?? "Unknown")")
            analysisResults.append("📊 Bits per component: \(cgImage.bitsPerComponent)")
            analysisResults.append("📊 Bits per pixel: \(cgImage.bitsPerPixel)")
        }
    }
}

struct BlendModeComparisonTest: View {
    private let blendModes: [(SKBlendMode, String)] = [
        (.alpha, "Alpha"),
        (.replace, "Replace"),
        (.multiplyAlpha, "Multiply Alpha"),
        (.add, "Add"),
        (.subtract, "Subtract")
    ]
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Blend Mode Comparison")
                .font(.headline)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 10) {
                ForEach(blendModes, id: \.0.rawValue) { mode, name in
                    VStack {
                        Text(name)
                            .font(.caption)
                        
                        TestSpriteView(filteringMode: nil, blendMode: mode)
                            .frame(width: 80, height: 80)
                            .background(Color.blue.opacity(0.3))
                    }
                }
            }
        }
    }
}

struct SceneConfigurationTest: View {
    var body: some View {
        VStack(spacing: 20) {
            Text("Scene Configuration Test")
                .font(.headline)
            
            // Test different scene configurations
            HStack(spacing: 20) {
                VStack {
                    Text("Standard Config")
                        .font(.caption)
                    TestSpriteView(filteringMode: nil, blendMode: nil)
                        .frame(width: 100, height: 100)
                        .background(Color.purple.opacity(0.3))
                }
                
                VStack {
                    Text("Custom Config")
                        .font(.caption)
                    CustomConfigSpriteView()
                        .frame(width: 100, height: 100)
                        .background(Color.purple.opacity(0.3))
                }
            }
        }
    }
}

struct ReferenceImageTest: View {
    @State private var referenceImage: UIImage?
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Reference Image Test")
                .font(.headline)
            
            if let referenceImage = referenceImage {
                VStack {
                    Text("Reference Image")
                        .font(.caption)
                    
                    Image(uiImage: referenceImage)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 100, height: 100)
                        .background(Color.orange.opacity(0.3))
                }
            }
            
            Button("Generate Reference Image") {
                generateReferenceImage()
            }
            .buttonStyle(.bordered)
        }
        .onAppear {
            generateReferenceImage()
        }
    }
    
    private func generateReferenceImage() {
        let size = CGSize(width: 100, height: 100)
        let renderer = UIGraphicsImageRenderer(size: size)
        
        referenceImage = renderer.image { context in
            // Clear background
            context.cgContext.clear(CGRect(origin: .zero, size: size))
            
            // Draw shapes with transparency
            context.cgContext.setFillColor(UIColor.red.cgColor)
            context.cgContext.fillEllipse(in: CGRect(x: 20, y: 20, width: 60, height: 60))
            
            context.cgContext.setFillColor(UIColor.blue.withAlphaComponent(0.5).cgColor)
            context.cgContext.fill(CGRect(x: 30, y: 30, width: 40, height: 40))
            
            context.cgContext.setFillColor(UIColor.green.withAlphaComponent(0.3).cgColor)
            context.cgContext.fill(CGRect(x: 40, y: 40, width: 20, height: 20))
        }
    }
}

// MARK: - Test Helper Views

struct TestSpriteView: View {
    let filteringMode: SKTextureFilteringMode?
    let blendMode: SKBlendMode?
    
    @State private var skView: SKView?
    
    init(filteringMode: SKTextureFilteringMode? = nil, blendMode: SKBlendMode? = nil) {
        self.filteringMode = filteringMode
        self.blendMode = blendMode
    }
    
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
    }
    
    private func createTestScene() {
        guard let image = UIImage(named: "SkeletonSprite") else { return }
        
        let texture = SKTexture(image: image)
        if let filteringMode = filteringMode {
            texture.filteringMode = filteringMode
        }
        
        let spriteNode = SKSpriteNode(texture: texture)
        spriteNode.color = .clear
        spriteNode.colorBlendFactor = 0.0
        
        if let blendMode = blendMode {
            spriteNode.blendMode = blendMode
        }
        
        let skView = SKView()
        skView.allowsTransparency = true
        skView.backgroundColor = .clear
        
        let scene = SKScene(size: CGSize(width: 100, height: 100))
        scene.backgroundColor = .clear
        scene.scaleMode = .aspectFit
        
        spriteNode.position = CGPoint(x: 50, y: 50)
        scene.addChild(spriteNode)
        
        skView.presentScene(scene)
        self.skView = skView
    }
}

struct CustomConfigSpriteView: View {
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
            createCustomScene()
        }
    }
    
    private func createCustomScene() {
        guard let image = UIImage(named: "SkeletonSprite") else { return }
        
        let texture = SKTexture(image: image)
        texture.filteringMode = .nearest
        
        let spriteNode = SKSpriteNode(texture: texture)
        spriteNode.color = .clear
        spriteNode.colorBlendFactor = 0.0
        spriteNode.blendMode = .replace  // Try replace mode
        
        let skView = SKView()
        skView.allowsTransparency = true
        skView.backgroundColor = .clear
        skView.ignoresSiblingOrder = true  // Custom setting
        
        let scene = SKScene(size: CGSize(width: 100, height: 100))
        scene.backgroundColor = .clear
        scene.scaleMode = .aspectFit
        scene.anchorPoint = CGPoint(x: 0.5, y: 0.5)  // Custom anchor
        
        spriteNode.position = CGPoint(x: 50, y: 50)
        scene.addChild(spriteNode)
        
        skView.presentScene(scene)
        self.skView = skView
    }
}

#Preview {
    TransparencyTestView()
}
