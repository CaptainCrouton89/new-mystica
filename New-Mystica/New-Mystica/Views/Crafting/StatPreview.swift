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
        .clipShape(RoundedRectangle(cornerRadius: .cornerRadiusLarge))
        .overlay(
            RoundedRectangle(cornerRadius: .cornerRadiusLarge)
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

    private var statIconData: (iconUrl: String, fallbackIcon: String, color: Color) {
        switch name {
        case "ATK Power":
            return (
                StatIconURL.atkPower,
                "hammer.fill",
                Color.alert
            )
        case "ATK Accuracy":
            return (
                StatIconURL.atkAccuracy,
                "target",
                Color.warning
            )
        case "DEF Power":
            return (
                StatIconURL.defPower,
                "shield.fill",
                Color.accentSecondary
            )
        case "DEF Accuracy":
            return (
                StatIconURL.defAccuracy,
                "checkmark.shield.fill",
                Color.success
            )
        default:
            return ("", "questionmark.circle", Color.textSecondary)
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            // Stat Icon
            CachedAsyncImage(
                url: URL(string: statIconData.iconUrl),
                content: { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 32, height: 32)
                },
                placeholder: {
                    Image(systemName: statIconData.fallbackIcon)
                        .font(.system(size: 20, weight: .medium))
                }
            )
            .foregroundColor(statIconData.color)
            .frame(width: 32)

            VStack(spacing: 4) {
                // Stat Name
                Text(name)
                    .font(FontManager.caption)
                    .foregroundColor(.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                HStack {
                    // Current Value
                    Text(String(format: "%.1f", currentValue * 100))
                        .font(FontManager.body)
                        .foregroundColor(.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    // Arrow
                    Image(systemName: "arrow.right")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.textSecondary)

                    // Preview Value
                    HStack(spacing: 4) {
                        Text(String(format: "%.1f", previewValue * 100))
                            .font(FontManager.body)
                            .foregroundColor(showComparison ? colorForDifference : .textPrimary)
                            .bold()

                        if showComparison && abs(difference) >= 0.001 {
                            Text("(\(difference >= 0 ? "+" : "")\(String(format: "%.1f", difference * 100)))")
                                .font(FontManager.caption)
                                .foregroundColor(colorForDifference)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
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