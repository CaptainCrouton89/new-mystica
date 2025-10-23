//
//  StatPreview.swift
//  New-Mystica
//
//  StatPreview component for T5: US-401 Crafting Materials onto Items
//  Shows side-by-side stat comparison with color coding for increases/decreases
//

import SwiftUI

struct StatPreview: View {
    let baseStats: ItemStats
    let previewStats: ItemStats
    let showComparison: Bool

    var body: some View {
        VStack(spacing: 16) {
            // Header
            HStack {
                Text("Current")
                    .font(FontManager.subtitle)
                    .foregroundColor(.textPrimary)
                    .frame(maxWidth: .infinity)

                Text("After Crafting")
                    .font(FontManager.subtitle)
                    .foregroundColor(.textPrimary)
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 24)

            Divider()
                .background(Color.borderSubtle)

            // Stat Rows
            VStack(spacing: 12) {
                StatRow(
                    name: "ATK Power",
                    currentValue: baseStats.atkPower,
                    previewValue: previewStats.atkPower,
                    showComparison: showComparison
                )

                StatRow(
                    name: "ATK Accuracy",
                    currentValue: baseStats.atkAccuracy,
                    previewValue: previewStats.atkAccuracy,
                    showComparison: showComparison
                )

                StatRow(
                    name: "DEF Power",
                    currentValue: baseStats.defPower,
                    previewValue: previewStats.defPower,
                    showComparison: showComparison
                )

                StatRow(
                    name: "DEF Accuracy",
                    currentValue: baseStats.defAccuracy,
                    previewValue: previewStats.defAccuracy,
                    showComparison: showComparison
                )
            }
        }
        .padding(16)
        .background(Color.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.borderSubtle, lineWidth: 1)
        )
    }
}

// MARK: - StatRow Component
private struct StatRow: View {
    let name: String
    let currentValue: Double
    let previewValue: Double
    let showComparison: Bool

    private var difference: Double {
        previewValue - currentValue
    }

    private var colorForDifference: Color {
        if difference >= 0.01 {
            return Color.green  // Increase
        } else if difference <= -0.01 {
            return Color.red    // Decrease
        } else {
            return Color.textPrimary  // Unchanged
        }
    }

    var body: some View {
        VStack(spacing: 4) {
            // Stat Name
            Text(name)
                .font(FontManager.body)
                .foregroundColor(.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack {
                // Current Value
                Text(String(format: "%.2f", currentValue))
                    .font(FontManager.body)
                    .foregroundColor(.textPrimary)
                    .frame(maxWidth: .infinity)

                // Vertical Divider
                Rectangle()
                    .fill(Color.borderSubtle)
                    .frame(width: 1, height: 20)

                // Preview Value
                HStack(spacing: 8) {
                    Text(String(format: "%.2f", previewValue))
                        .font(FontManager.body)
                        .foregroundColor(showComparison ? colorForDifference : .textPrimary)

                    if showComparison && abs(difference) >= 0.01 {
                        Text("(\(difference >= 0 ? "+" : "")\(String(format: "%.2f", difference)))")
                            .font(FontManager.caption)
                            .foregroundColor(colorForDifference)
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 16)
    }
}

// MARK: - SwiftUI Previews
#Preview {
    VStack(spacing: 24) {
        // Example 1: Stats increase
        StatPreview(
            baseStats: ItemStats(
                atkPower: 42.5,
                atkAccuracy: 0.85,
                defPower: 55.0,
                defAccuracy: 0.72
            ),
            previewStats: ItemStats(
                atkPower: 48.3,
                atkAccuracy: 0.82,
                defPower: 55.0,
                defAccuracy: 0.75
            ),
            showComparison: true
        )

        // Example 2: Mixed changes
        StatPreview(
            baseStats: ItemStats(
                atkPower: 50.0,
                atkAccuracy: 0.80,
                defPower: 40.0,
                defAccuracy: 0.90
            ),
            previewStats: ItemStats(
                atkPower: 65.0,
                atkAccuracy: 0.75,
                defPower: 25.0,
                defAccuracy: 0.90
            ),
            showComparison: true
        )

        // Example 3: No comparison mode
        StatPreview(
            baseStats: ItemStats(
                atkPower: 30.0,
                atkAccuracy: 0.70,
                defPower: 35.0,
                defAccuracy: 0.85
            ),
            previewStats: ItemStats(
                atkPower: 30.0,
                atkAccuracy: 0.70,
                defPower: 35.0,
                defAccuracy: 0.85
            ),
            showComparison: false
        )
    }
    .padding()
    .background(Color.backgroundPrimary)
}