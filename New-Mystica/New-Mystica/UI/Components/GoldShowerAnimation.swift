//
//  GoldShowerAnimation.swift
//  New-Mystica
//
//  Animated gold coin shower effect that falls from top of screen with fade-out
//

import SwiftUI

// MARK: - Gold Coin Model
struct GoldCoin: Identifiable {
    let id = UUID()
    let xOffset: CGFloat
    let delay: Double
    let duration: Double
    let rotation: Double
}

// MARK: - Single Coin Animation View
struct AnimatedGoldCoin: View {
    let coin: GoldCoin
    @State private var yOffset: CGFloat = -100
    @State private var opacity: Double = 1.0
    @State private var rotation: Double = 0

    private let fallDistance: CGFloat = 800
    private let fadeStartPercent: Double = 0.6

    var body: some View {
        Image(systemName: "dollarsign.circle.fill")
            .font(.system(size: 24, weight: .bold))
            .foregroundColor(Color.warning)
            .rotationEffect(.degrees(rotation))
            .offset(x: coin.xOffset, y: yOffset)
            .opacity(opacity)
            .onAppear {
                startAnimation()
            }
    }

    private func startAnimation() {
        // Delay the start of this coin's animation
        DispatchQueue.main.asyncAfter(deadline: .now() + coin.delay) {
            // Animate the fall (linear motion down)
            withAnimation(.linear(duration: coin.duration)) {
                yOffset = fallDistance
            }

            // Animate the spin separately (rotation in place)
            withAnimation(.linear(duration: coin.duration)) {
                rotation = coin.rotation
            }

            // Animate the fade-out starting at fadeStartPercent
            let fadeStartTime = coin.duration * fadeStartPercent
            DispatchQueue.main.asyncAfter(deadline: .now() + fadeStartTime) {
                withAnimation(.easeOut(duration: coin.duration * (1.0 - fadeStartPercent))) {
                    opacity = 0
                }
            }
        }
    }
}

// MARK: - Gold Shower Animation View
struct GoldShowerAnimation: View {
    let goldAmount: Int
    let onComplete: () -> Void

    @State private var coins: [GoldCoin] = []

    // Animation constants
    private let totalCoins = 20
    private let animationDuration: Double = 1.5

    var body: some View {
        ZStack {
            ForEach(coins) { coin in
                AnimatedGoldCoin(coin: coin)
            }
        }
        .onAppear {
            setupCoins()
            scheduleCompletion()
        }
    }

    // MARK: - Setup & Animation

    private func setupCoins() {
        // Use a reasonable default width for coin spread (works for most devices)
        let screenWidth: CGFloat = 400

        coins = (0..<totalCoins).map { index in
            GoldCoin(
                xOffset: CGFloat.random(in: -screenWidth/2...screenWidth/2),
                delay: Double(index) * 0.05, // Stagger coin drops
                duration: animationDuration + Double.random(in: -0.2...0.2),
                rotation: Double.random(in: -360...360)
            )
        }
    }

    private func scheduleCompletion() {
        // Notify completion after animation finishes (longest duration + longest delay)
        let maxDelay = Double(totalCoins - 1) * 0.05
        let totalTime = animationDuration + 0.2 + maxDelay // Add buffer
        DispatchQueue.main.asyncAfter(deadline: .now() + totalTime) {
            onComplete()
        }
    }
}

// MARK: - Gold Shower Overlay Modifier
struct GoldShowerOverlay: ViewModifier {
    @Binding var isActive: Bool
    let goldAmount: Int

    func body(content: Content) -> some View {
        content
            .overlay(
                Group {
                    if isActive {
                        GoldShowerAnimation(goldAmount: goldAmount) {
                            isActive = false
                        }
                        .transition(.opacity)
                        .zIndex(999)
                    }
                }
            )
    }
}

// MARK: - View Extension
extension View {
    func goldShower(isActive: Binding<Bool>, goldAmount: Int) -> some View {
        self.modifier(GoldShowerOverlay(isActive: isActive, goldAmount: goldAmount))
    }
}

// MARK: - Preview
#Preview {
    ZStack {
        Color.backgroundPrimary.ignoresSafeArea()

        VStack {
            Text("Gold Shower Animation")
                .font(FontManager.title)
                .foregroundColor(Color.textPrimary)

            Spacer()
        }
        .padding()

        GoldShowerAnimation(goldAmount: 150) {
            print("Animation complete")
        }
    }
}
