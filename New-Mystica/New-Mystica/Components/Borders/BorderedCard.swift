//
//  BorderedCard.swift
//  New-Mystica
//
//  Reusable border component for items and materials
//

import SwiftUI

// MARK: - BorderedCard ViewModifier
/// A view modifier that applies dynamic borders based on rarity or style
struct BorderedCard: ViewModifier {
    let borderType: BorderType
    let cornerRadius: CGFloat
    @State private var animationOffset: CGFloat = 0

    init(borderType: BorderType, cornerRadius: CGFloat = 12) {
        self.borderType = borderType
        self.cornerRadius = cornerRadius
    }

    func body(content: Content) -> some View {
        content
            .overlay(
                borderOverlay
            )
            .onAppear {
                if borderType.isAnimated {
                    startHolographicAnimation()
                }
            }
    }

    /// Dynamic border overlay that handles both static colors and animated effects
    @ViewBuilder
    private var borderOverlay: some View {
        if borderType.isAnimated {
            RoundedRectangle(cornerRadius: cornerRadius)
                .strokeBorder(holographicGradient, lineWidth: borderType.borderWidth)
        } else {
            RoundedRectangle(cornerRadius: cornerRadius)
                .stroke(borderType.borderColor, lineWidth: borderType.borderWidth)
        }
    }

    /// Animated holographic gradient for border
    private var holographicGradient: AngularGradient {
        AngularGradient(
            gradient: Gradient(colors: [
                Color(hex: "FF0080"), // Magenta
                Color(hex: "FF8000"), // Orange
                Color(hex: "FFFF00"), // Yellow
                Color(hex: "80FF00"), // Green
                Color(hex: "00FFFF"), // Cyan
                Color(hex: "8000FF"), // Purple
                Color(hex: "FF0080")  // Back to magenta
            ]),
            center: .center,
            startAngle: .degrees(animationOffset)
        )
    }

    /// Start the holographic animation effect
    private func startHolographicAnimation() {
        withAnimation(
            .linear(duration: 3.0)
            .repeatForever(autoreverses: false)
        ) {
            animationOffset = 360
        }
    }
}

// MARK: - Convenience View Extensions
extension View {
    /// Apply a rarity-based border to any view
    func rarityBorder(_ rarity: RarityBorder, cornerRadius: CGFloat = 12) -> some View {
        self.modifier(BorderedCard(borderType: .rarity(rarity), cornerRadius: cornerRadius))
    }

    /// Apply a style-based border to any view
    func styleBorder(_ style: StyleBorder, cornerRadius: CGFloat = 12) -> some View {
        self.modifier(BorderedCard(borderType: .style(style), cornerRadius: cornerRadius))
    }

    /// Apply a border based on item level (temporary until rarity system implemented)
    func itemBorder(level: Int, cornerRadius: CGFloat = 12) -> some View {
        let rarity = RarityBorder.fromLevel(level)
        return self.modifier(BorderedCard(borderType: .rarity(rarity), cornerRadius: cornerRadius))
    }

    /// Apply a border based on material style ID
    func materialBorder(styleId: String, cornerRadius: CGFloat = 12) -> some View {
        let style = StyleBorder.fromStyleId(styleId)
        return self.modifier(BorderedCard(borderType: .style(style), cornerRadius: cornerRadius))
    }
}

// MARK: - Preview Support
#Preview("Border Examples") {
    ScrollView {
        VStack(spacing: 20) {
            // Header
            Text("Border System Preview")
                .font(.title)
                .foregroundColor(.textPrimary)
                .padding()

            // Rarity Borders Section
            VStack(alignment: .leading, spacing: 12) {
                Text("Rarity Borders")
                    .font(.headline)
                    .foregroundColor(.textPrimary)

                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                    ForEach(RarityBorder.allCases, id: \.self) { rarity in
                        SampleCard(title: rarity.rawValue.capitalized)
                            .rarityBorder(rarity)
                    }
                }
            }
            .padding(.horizontal)

            // Style Borders Section
            VStack(alignment: .leading, spacing: 12) {
                Text("Style Borders")
                    .font(.headline)
                    .foregroundColor(.textPrimary)

                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                    ForEach(StyleBorder.allCases, id: \.self) { style in
                        SampleCard(title: style.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)
                            .styleBorder(style)
                    }
                }
            }
            .padding(.horizontal)

            // Level-based examples
            VStack(alignment: .leading, spacing: 12) {
                Text("Level-based Examples")
                    .font(.headline)
                    .foregroundColor(.textPrimary)

                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                    SampleCard(title: "Level 5")
                        .itemBorder(level: 5)

                    SampleCard(title: "Level 15")
                        .itemBorder(level: 15)

                    SampleCard(title: "Level 30")
                        .itemBorder(level: 30)

                    SampleCard(title: "Level 50")
                        .itemBorder(level: 50)
                }
            }
            .padding(.horizontal)
        }
        .padding(.bottom, 40)
    }
    .background(Color.backgroundPrimary)
}

// MARK: - Sample Card for Preview
private struct SampleCard: View {
    let title: String

    var body: some View {
        VStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.backgroundSecondary)
                .frame(height: 60)
                .overlay(
                    Image(systemName: "star.fill")
                        .foregroundColor(.accent)
                        .font(.title2)
                )

            Text(title)
                .font(.caption)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(height: 100)
        .padding(12)
        .background(Color.backgroundCard)
    }
}