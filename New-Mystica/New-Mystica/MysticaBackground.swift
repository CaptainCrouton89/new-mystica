//
//  MysticaBackground.swift
//  New-Mystica
//
//  Created by AI Assistant on 1/27/25.
//

import SwiftUI

// MARK: - Background Style Enum
enum MysticaBackgroundStyle {
    case aurora
    case floatingOrbs
    case starfield
    case image(BackgroundImageManager)
}

// MARK: - Main Background Wrapper
struct MysticaBackground<Content: View>: View {
    let style: MysticaBackgroundStyle
    let content: Content
    
    init(_ style: MysticaBackgroundStyle, @ViewBuilder content: () -> Content) {
        self.style = style
        self.content = content()
    }
    
    var body: some View {
        ZStack {
            // Background based on style
            switch style {
            case .aurora:
                AuroraBackground()
            case .floatingOrbs:
                FloatingOrbsBackground()
            case .starfield:
                StarfieldBackground()
            case .image(let imageManager):
                ImageBackground(imageManager: imageManager)
            }
            
            // Content overlay
            content
        }
    }
}

// MARK: - Aurora Background
struct AuroraBackground: View {
    @State private var animationOffset: CGFloat = 0
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Base dark background
                Color.black
                    .ignoresSafeArea()
                
                // Aurora blobs
                ForEach(0..<6, id: \.self) { index in
                    AuroraBlob(
                        index: index,
                        animationOffset: animationOffset,
                        screenSize: geometry.size
                    )
                }
                
                // Particle dust overlay
                ParticleDust(screenSize: geometry.size)
                    .allowsHitTesting(false)
            }
        }
        .onAppear {
            withAnimation(.linear(duration: 20).repeatForever(autoreverses: false)) {
                animationOffset = 1
            }
        }
    }
}

struct AuroraBlob: View {
    let index: Int
    let animationOffset: CGFloat
    let screenSize: CGSize
    
    private var colors: [Color] {
        switch index % 6 {
        case 0:
            return [Color.purple.opacity(0.6), Color.pink.opacity(0.4), Color.blue.opacity(0.3)]
        case 1:
            return [Color.pink.opacity(0.5), Color.pink.opacity(0.4), Color.purple.opacity(0.3)]
        case 2:
            return [Color.blue.opacity(0.4), Color.cyan.opacity(0.3), Color.purple.opacity(0.2)]
        case 3:
            return [Color.pink.opacity(0.5), Color.pink.opacity(0.3), Color.blue.opacity(0.2)]
        case 4:
            return [Color.purple.opacity(0.6), Color.blue.opacity(0.4), Color.cyan.opacity(0.3)]
        default:
            return [Color.pink.opacity(0.4), Color.purple.opacity(0.3), Color.pink.opacity(0.2)]
        }
    }
    
    private var basePosition: CGPoint {
        let positions = [
            CGPoint(x: 0.2, y: 0.3),
            CGPoint(x: 0.8, y: 0.2),
            CGPoint(x: 0.1, y: 0.7),
            CGPoint(x: 0.9, y: 0.6),
            CGPoint(x: 0.5, y: 0.1),
            CGPoint(x: 0.3, y: 0.9)
        ]
        return positions[index % positions.count]
    }
    
    private var size: CGFloat {
        let sizes: [CGFloat] = [200, 150, 180, 220, 160, 190]
        return sizes[index % sizes.count]
    }
    
    private var currentPosition: CGPoint {
        let baseX = basePosition.x * screenSize.width
        let baseY = basePosition.y * screenSize.height
        let offsetX = sin(animationOffset * .pi * 2 + Double(index)) * 50
        let offsetY = cos(animationOffset * .pi * 1.5 + Double(index)) * 30
        
        return CGPoint(
            x: baseX + offsetX,
            y: baseY + offsetY
        )
    }
    
    var body: some View {
        Ellipse()
            .fill(
                RadialGradient(
                    gradient: Gradient(colors: colors),
                    center: .center,
                    startRadius: 0,
                    endRadius: size / 2
                )
            )
            .frame(width: size, height: size * 0.6)
            .blur(radius: 30)
            .position(currentPosition)
            .blendMode(.screen)
    }
}

// MARK: - Floating Orbs Background
struct FloatingOrbsBackground: View {
    @State private var animationPhase: CGFloat = 0
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Base gradient background
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color.black,
                        Color.purple.opacity(0.1),
                        Color.black
                    ]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                // Floating orbs
                ForEach(0..<8, id: \.self) { index in
                    FloatingOrb(
                        index: index,
                        animationPhase: animationPhase,
                        screenSize: geometry.size
                    )
                }
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 8).repeatForever(autoreverses: true)) {
                animationPhase = 1
            }
        }
    }
}

struct FloatingOrb: View {
    let index: Int
    let animationPhase: CGFloat
    let screenSize: CGSize
    
    private var colors: [Color] {
        switch index % 8 {
        case 0:
            return [Color.purple.opacity(0.3), Color.pink.opacity(0.2)]
        case 1:
            return [Color.blue.opacity(0.25), Color.cyan.opacity(0.15)]
        case 2:
            return [Color.pink.opacity(0.2), Color.pink.opacity(0.15)]
        case 3:
            return [Color.purple.opacity(0.3), Color.blue.opacity(0.2)]
        case 4:
            return [Color.pink.opacity(0.25), Color.pink.opacity(0.15)]
        case 5:
            return [Color.cyan.opacity(0.2), Color.blue.opacity(0.15)]
        case 6:
            return [Color.pink.opacity(0.3), Color.purple.opacity(0.2)]
        default:
            return [Color.blue.opacity(0.2), Color.purple.opacity(0.15)]
        }
    }
    
    private var basePosition: CGPoint {
        let positions = [
            CGPoint(x: 0.15, y: 0.25),
            CGPoint(x: 0.85, y: 0.35),
            CGPoint(x: 0.25, y: 0.75),
            CGPoint(x: 0.75, y: 0.65),
            CGPoint(x: 0.5, y: 0.15),
            CGPoint(x: 0.1, y: 0.5),
            CGPoint(x: 0.9, y: 0.8),
            CGPoint(x: 0.6, y: 0.4)
        ]
        return positions[index % positions.count]
    }
    
    private var size: CGFloat {
        let sizes: [CGFloat] = [120, 80, 100, 140, 90, 110, 130, 95]
        return sizes[index % sizes.count]
    }
    
    private var currentPosition: CGPoint {
        let baseX = basePosition.x * screenSize.width
        let baseY = basePosition.y * screenSize.height
        let offsetX = sin(animationPhase * .pi * 2 + Double(index) * 0.5) * 30
        let offsetY = cos(animationPhase * .pi * 1.5 + Double(index) * 0.3) * 20
        
        return CGPoint(
            x: baseX + offsetX,
            y: baseY + offsetY
        )
    }
    
    private var scaleEffect: CGFloat {
        return 0.8 + 0.4 * sin(animationPhase * .pi + Double(index) * 0.7)
    }
    
    var body: some View {
        Circle()
            .fill(
                RadialGradient(
                    gradient: Gradient(colors: colors),
                    center: .center,
                    startRadius: 0,
                    endRadius: size / 2
                )
            )
            .frame(width: size, height: size)
            .blur(radius: 20)
            .position(currentPosition)
            .scaleEffect(scaleEffect)
            .blendMode(.screen)
    }
}

// MARK: - Starfield Background
struct StarfieldBackground: View {
    @State private var starOffset: CGFloat = 0
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Base space background
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color.black,
                        Color.purple.opacity(0.05),
                        Color.black
                    ]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                // Nebula background
                NebulaBackground(screenSize: geometry.size)
                
                // Moving stars
                ForEach(0..<50, id: \.self) { index in
                    Star(
                        index: index,
                        offset: starOffset,
                        screenSize: geometry.size
                    )
                }
            }
        }
        .onAppear {
            withAnimation(.linear(duration: 30).repeatForever(autoreverses: false)) {
                starOffset = 1
            }
        }
    }
}

struct NebulaBackground: View {
    let screenSize: CGSize
    
    var body: some View {
        ZStack {
            // Large nebula clouds
            ForEach(0..<3, id: \.self) { index in
                Ellipse()
                    .fill(
                        RadialGradient(
                            gradient: Gradient(colors: [
                                Color.purple.opacity(0.1),
                                Color.pink.opacity(0.05),
                                Color.clear
                            ]),
                            center: .center,
                            startRadius: 0,
                            endRadius: 200
                        )
                    )
                    .frame(width: 400, height: 200)
                    .blur(radius: 50)
                    .position(
                        x: [0.2, 0.8, 0.5][index] * screenSize.width,
                        y: [0.3, 0.7, 0.5][index] * screenSize.height
                    )
                    .blendMode(.screen)
            }
        }
    }
}

struct Star: View {
    let index: Int
    let offset: CGFloat
    let screenSize: CGSize
    
    private var basePosition: CGPoint {
        let x = CGFloat.random(in: 0...1)
        let y = CGFloat.random(in: 0...1)
        return CGPoint(x: x, y: y)
    }
    
    private var size: CGFloat {
        let sizes: [CGFloat] = [1, 2, 1.5, 3, 1, 2.5, 1.5, 2]
        return sizes[index % sizes.count]
    }
    
    private var brightness: Double {
        let brightnesses: [Double] = [0.3, 0.6, 0.4, 0.8, 0.2, 0.7, 0.5, 0.4]
        return brightnesses[index % brightnesses.count]
    }
    
    private var currentPosition: CGPoint {
        let baseX = basePosition.x * screenSize.width
        let baseY = basePosition.y * screenSize.height - offset * screenSize.height
        
        return CGPoint(x: baseX, y: baseY)
    }
    
    var body: some View {
        Circle()
            .fill(Color.white.opacity(brightness))
            .frame(width: size, height: size)
            .position(currentPosition)
            .blur(radius: size > 2 ? 1 : 0)
    }
}

// MARK: - Particle Dust Effect
struct ParticleDust: View {
    let screenSize: CGSize
    @State private var particles: [Particle] = []
    
    var body: some View {
        ZStack {
            ForEach(particles, id: \.id) { particle in
                Circle()
                    .fill(Color.white.opacity(particle.opacity))
                    .frame(width: particle.size, height: particle.size)
                    .position(particle.position)
                    .blur(radius: 1)
            }
        }
        .onAppear {
            generateParticles()
            startAnimation()
        }
    }
    
    private func generateParticles() {
        particles = (0..<20).map { _ in
            Particle(
                position: CGPoint(
                    x: CGFloat.random(in: 0...screenSize.width),
                    y: CGFloat.random(in: 0...screenSize.height)
                ),
                size: CGFloat.random(in: 0.5...2),
                opacity: Double.random(in: 0.1...0.3)
            )
        }
    }
    
    private func startAnimation() {
        withAnimation(.linear(duration: 15).repeatForever(autoreverses: false)) {
            for i in particles.indices {
                particles[i].position.y -= 100
                if particles[i].position.y < -10 {
                    particles[i].position.y = screenSize.height + 10
                    particles[i].position.x = CGFloat.random(in: 0...screenSize.width)
                }
            }
        }
    }
}

struct Particle: Identifiable {
    let id = UUID()
    var position: CGPoint
    let size: CGFloat
    let opacity: Double
}

// MARK: - Image Background
struct ImageBackground: View {
    @ObservedObject var imageManager: BackgroundImageManager
    
    var body: some View {
        ZStack {
            // Background Image
            if let loadedImage = imageManager.loadedImage {
                Image(uiImage: loadedImage)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .ignoresSafeArea()
            } else {
                Color.backgroundPrimary
                    .ignoresSafeArea()
            }
            
            // Dark overlay for readability
            Color.black.opacity(0.5)
                .ignoresSafeArea()
        }
    }
}

// MARK: - SwiftUI Preview
struct MysticaBackground_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            MysticaBackground(.aurora) {
                VStack {
                    Spacer()
                    Text("Aurora Background")
                        .foregroundColor(.white)
                        .font(.title.bold())
                    Spacer()
                }
            }
            .preferredColorScheme(.dark)
            
            MysticaBackground(.floatingOrbs) {
                VStack {
                    Spacer()
                    Text("Floating Orbs")
                        .foregroundColor(.white)
                        .font(.title.bold())
                    Spacer()
                }
            }
            .preferredColorScheme(.dark)
            
            MysticaBackground(.starfield) {
                VStack {
                    Spacer()
                    Text("Starfield")
                        .foregroundColor(.white)
                        .font(.title.bold())
                    Spacer()
                }
            }
            .preferredColorScheme(.dark)
            
            MysticaBackground(.image(BackgroundImageManager())) {
                VStack {
                    Spacer()
                    Text("Image Background")
                        .foregroundColor(.white)
                        .font(.title.bold())
                    Spacer()
                }
            }
            .preferredColorScheme(.dark)
        }
    }
}
