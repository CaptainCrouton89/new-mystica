//
//  MaterialDetailModal.swift
//  New-Mystica
//
//  Modal view for displaying detailed material information
//  Similar to InventoryItemDetailModal but adapted for materials
//

import SwiftUI

struct MaterialDetailModal: View {
    let material: MaterialInventoryStack
    let onCraft: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.audioManager) private var audioManager

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Large material image
                    materialImageView

                    // Material metadata
                    materialMetadataView

                    // Stats display
                    materialStatsView

                    // Description section (if available)
                    if let description = material.material.description, !description.isEmpty {
                        descriptionView(description)
                    }

                    // Action button
                    craftActionButton
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
            .background(Color.backgroundPrimary)
            .navigationTitle("Material Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        audioManager.playCancelClick()
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(Color.textSecondary)
                    }
                }
            }
        }
    }

    // MARK: - Material Image View

    private var materialImageView: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.backgroundCard)
                .frame(height: 280)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(getStyleBorderColor(), lineWidth: 3)
                )

            if let imageUrl = material.imageUrl, let url = URL(string: imageUrl) {
                CachedAsyncImage(
                    url: url,
                    content: { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(height: 280)
                            .clipped()
                    },
                    placeholder: {
                        ProgressView()
                    }
                )
            } else {
                fallbackMaterialIcon
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var fallbackMaterialIcon: some View {
        VStack(spacing: 12) {
            Image(systemName: getMaterialIcon())
                .font(.system(size: 72, weight: .medium))
                .foregroundColor(getStyleBorderColor())

            NormalText("No Image")
                .foregroundColor(Color.textSecondary)
        }
    }

    // MARK: - Material Metadata View

    private var materialMetadataView: some View {
        VStack(spacing: 12) {
            TitleText(material.name.capitalized, size: 24)

            HStack(spacing: 16) {
                // Quantity badge
                Badge(
                    label: "Quantity",
                    value: "\(material.quantity)",
                    color: Color.accent
                )

                // Style badge
                Badge(
                    label: "Style",
                    value: formatStyleName(material.styleId),
                    color: getStyleBorderColor()
                )

                // Theme badge (if available)
                if !material.theme.isEmpty {
                    Badge(
                        label: "Theme",
                        value: material.theme.capitalized,
                        color: Color.textSecondary
                    )
                }
            }

            // Drop weight indicator
            HStack {
                Image(systemName: "cube.fill")
                    .font(.system(size: 14))
                SmallText("Drop Weight: \(material.material.baseDropWeight)")
            }
            .foregroundColor(Color.textSecondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.backgroundSecondary)
            )
        }
    }

    // MARK: - Material Stats View

    private var materialStatsView: some View {
        VStack(spacing: 12) {
            TitleText("Stat Modifiers", size: 20)

            VStack(spacing: 8) {
                // Attack modifier stats
                HStack(spacing: 12) {
                    StatModifierRow(
                        iconUrl: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/ui/stats/attack-power-crossed-swords.png",
                        fallbackIcon: "sword.fill",
                        label: "ATK Power",
                        multiplier: material.statModifiers.atkPower,
                        color: Color.alert
                    )

                    StatModifierRow(
                        iconUrl: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/ui/stats/attack-accuracy-crosshair.png",
                        fallbackIcon: "target",
                        label: "ATK Accuracy",
                        multiplier: material.statModifiers.atkAccuracy,
                        color: Color.warning
                    )
                }

                // Defense modifier stats
                HStack(spacing: 12) {
                    StatModifierRow(
                        iconUrl: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/ui/stats/defense-power-round-shield.png",
                        fallbackIcon: "shield.fill",
                        label: "DEF Power",
                        multiplier: material.statModifiers.defPower,
                        color: Color.accentSecondary
                    )

                    StatModifierRow(
                        iconUrl: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/ui/stats/defense-accuracy-force-field.png",
                        fallbackIcon: "checkmark.shield.fill",
                        label: "DEF Accuracy",
                        multiplier: material.statModifiers.defAccuracy,
                        color: Color.success
                    )
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }

    // MARK: - Description View

    private func descriptionView(_ description: String) -> some View {
        VStack(spacing: 12) {
            TitleText("Description", size: 20)

            NormalText(description)
                .foregroundColor(Color.textPrimary)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.backgroundSecondary)
                )
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }

    // MARK: - Craft Action Button

    private var craftActionButton: some View {
        Button {
            audioManager.playMenuButtonClick()
            dismiss()
            Task {
                try? await Task.sleep(for: .milliseconds(300))
                onCraft()
            }
        } label: {
            HStack {
                Image(systemName: "hammer.fill")
                NormalText("Craft with Material")
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.accent.opacity(0.15))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.accent, lineWidth: 2)
                    )
            )
            .foregroundColor(Color.accent)
        }
        .buttonStyle(PlainButtonStyle())
        .padding(.bottom, 16)
    }

    // MARK: - Helper Methods

    private func getMaterialIcon() -> String {
        let theme = material.theme.lowercased()
        let name = material.name.lowercased()

        // Icon based on material theme and name
        if theme.contains("nature") || name.contains("wood") || name.contains("leaf") {
            return "leaf.fill"
        } else if theme.contains("mystical") || name.contains("crystal") || name.contains("gem") {
            return "diamond.fill"
        } else if theme.contains("metal") || name.contains("iron") || name.contains("steel") {
            return "wrench.fill"
        } else if theme.contains("magical") || name.contains("mana") || name.contains("essence") {
            return "sparkles"
        } else if theme.contains("elemental") || name.contains("fire") || name.contains("ice") {
            return "flame.fill"
        } else if name.contains("stone") || name.contains("rock") {
            return "mountain.fill"
        } else if name.contains("fabric") || name.contains("cloth") {
            return "scissors"
        } else {
            return "cube.fill"
        }
    }

    private func getStyleBorderColor() -> Color {
        let styleId = material.styleId.lowercased()

        // Style-based border colors
        switch styleId {
        case let id where id.contains("pixel"):
            return Color(hex: "FF69B4") // Pink for pixel art style
        case let id where id.contains("holographic"):
            return Color.accent // Rainbow-like (using accent as placeholder)
        case let id where id.contains("ethereal") || id.contains("magical"):
            return Color.accentSecondary // Blue for magical styles
        case let id where id.contains("rustic") || id.contains("natural"):
            return Color(hex: "8B4513") // Brown for natural styles
        default:
            return Color.borderSubtle // White/gray for normal style
        }
    }

    private func formatStyleName(_ styleId: String) -> String {
        // Convert style_id to readable name
        let cleaned = styleId.replacingOccurrences(of: "_", with: " ")
        return cleaned.split(separator: " ")
            .map { $0.prefix(1).uppercased() + $0.dropFirst().lowercased() }
            .joined(separator: " ")
    }
}

// MARK: - Badge Component

private struct Badge: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            SmallText(label)
                .foregroundColor(Color.textSecondary)

            NormalText(value, size: 16)
                .foregroundColor(color)
                .bold()
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.backgroundSecondary)
        )
    }
}

// MARK: - Stat Modifier Row Component

private struct StatModifierRow: View {
    let iconUrl: String
    let fallbackIcon: String
    let label: String
    let multiplier: Double
    let color: Color

    var body: some View {
        HStack(spacing: 8) {
            CachedAsyncImage(
                url: URL(string: iconUrl),
                content: { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 48, height: 48)
                },
                placeholder: {
                    Image(systemName: fallbackIcon)
                        .font(.system(size: 48, weight: .medium))
                }
            )
            .foregroundColor(color)
            .frame(width: 56)

            VStack(alignment: .leading, spacing: 2) {
                SmallText(label)
                    .foregroundColor(Color.textSecondary)

                HStack(spacing: 4) {
                    NormalText(formatMultiplier(multiplier), size: 16)
                        .foregroundColor(color)
                        .bold()

                    // Show indicator if modifier is beneficial or detrimental
                    if multiplier > 1.0 {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(Color.success)
                    } else if multiplier < 1.0 {
                        Image(systemName: "arrow.down")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(Color.alert)
                    }
                }
            }

            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.backgroundSecondary)
        )
    }

    private func formatMultiplier(_ value: Double) -> String {
        if value == 1.0 {
            return "×1.0"
        } else {
            return String(format: "×%.2f", value)
        }
    }
}

// MARK: - Preview

#Preview("Material Detail Modal") {
    let mockMaterialDetail = MaterialInventoryStack.MaterialDetail(
        id: "crystal_002",
        name: "Mystical Crystal",
        statModifiers: StatModifier(atkPower: 1.2, atkAccuracy: 1.1, defPower: 1.0, defAccuracy: 1.05),
        description: "A shimmering crystal infused with pure magical energy. When applied to equipment, it enhances offensive capabilities while maintaining balance.",
        baseDropWeight: 50,
        imageUrl: "https://pub-34824eb66e5f4c31b6b58f4188ae2391.r2.dev/materials/mystical_crystal.png"
    )

    let mockMaterial = MaterialInventoryStack(
        materialId: "crystal_002",
        name: "Mystical Crystal",
        styleId: "holographic_style",
        quantity: 5,
        theme: "mystical",
        statModifiers: StatModifier(atkPower: 1.2, atkAccuracy: 1.1, defPower: 1.0, defAccuracy: 1.05),
        imageUrl: mockMaterialDetail.imageUrl,
        material: mockMaterialDetail
    )

    return MaterialDetailModal(
        material: mockMaterial,
        onCraft: {
            print("Craft action for material: \(mockMaterial.name)")
        }
    )
    .environmentObject(NavigationManager())
    .environmentObject(AudioManager.shared)
    .environment(AppState.shared)
}
