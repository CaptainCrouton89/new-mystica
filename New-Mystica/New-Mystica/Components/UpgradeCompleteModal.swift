//
//  UpgradeCompleteModal.swift
//  New-Mystica
//
//  Modal view for displaying item upgrade (confirmation or completion) with stat comparison
//

import SwiftUI
import SwiftData

struct UpgradeCompleteModal: View {
    let item: EnhancedPlayerItem
    let goldSpent: Int  // In confirmation mode, this is the cost; in completion mode, this is the amount spent
    let newGoldBalance: Int
    let statsBefore: ItemStats
    let statsAfter: ItemStats
    let isConfirmation: Bool  // true = show confirm/cancel, false = show upgrade again/return
    let onConfirm: (() -> Void)?  // Only used in confirmation mode
    let onUpgradeAgain: (() -> Void)?  // Only used in completion mode
    let onReturnToInventory: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.audioManager) private var audioManager

    var body: some View {
        VStack(spacing: 0) {
            // Header with close button
            headerView

            // Item image section
            itemImageView

            // Level progression badge
            levelProgressionView

            // Stat comparison table
            statComparisonView

            // Gold spent confirmation
            goldSpentView

            // Action buttons
            actionButtonsView
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.backgroundPrimary)
    }

    // MARK: - Header View
    private var headerView: some View {
        HStack {
            Spacer()

            Button {
                audioManager.playCancelClick()
                dismissModal()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(Color.textSecondary)
                    .frame(width: 32, height: 32)
                    .background(
                        Circle()
                            .fill(Color.backgroundPrimary)
                            .overlay(
                                Circle()
                                    .stroke(Color.accent, lineWidth: 1)
                            )
                    )
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
    }

    // MARK: - Item Image View
    private var itemImageView: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.backgroundCard)
                .frame(width: 160, height: 160)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(getRarityColor(), lineWidth: 3)
                )

            if let imageUrl = item.generatedImageUrl, let url = URL(string: imageUrl) {
                CachedAsyncImage(
                    url: url,
                    content: { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 160, height: 160)
                            .clipped()
                    },
                    placeholder: {
                        ProgressView()
                    }
                )
            } else {
                fallbackItemIcon
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.top, 16)
    }

    private var fallbackItemIcon: some View {
        VStack(spacing: 8) {
            Image(systemName: getItemIcon())
                .font(.system(size: 48, weight: .medium))
                .foregroundColor(getRarityColor())

            SmallText("No Image")
                .foregroundColor(Color.textSecondary)
        }
    }

    // MARK: - Level Progression View
    private var levelProgressionView: some View {
        VStack(spacing: 8) {
            TitleText(item.baseType.capitalized, size: 20)

            // Level progression badge
            HStack(spacing: 8) {
                Text("Level \(isConfirmation ? item.level : item.level - 1)")
                    .font(FontManager.impact(size: 16))
                    .foregroundColor(Color.textSecondary)

                Image(systemName: "arrow.right")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(Color.accent)

                Text("Level \(isConfirmation ? item.level + 1 : item.level)")
                    .font(FontManager.impact(size: 16))
                    .foregroundColor(Color.accent)
                    .bold()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.accent.opacity(0.15))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.accent, lineWidth: 2)
                    )
            )
        }
        .padding(.top, 16)
    }

    // MARK: - Stat Comparison View
    private var statComparisonView: some View {
        VStack(spacing: 12) {
            VStack(spacing: 8) {
                StatComparisonRow(
                    iconUrl: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/ui/stats/attack-power-crossed-swords.png",
                    fallbackIcon: "hammer.fill",
                    oldValue: String(format: "%.0f", statsBefore.atkPower * 100),
                    newValue: String(format: "%.0f", statsAfter.atkPower * 100),
                    color: Color.alert
                )

                StatComparisonRow(
                    iconUrl: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/ui/stats/attack-accuracy-crosshair.png",
                    fallbackIcon: "target",
                    oldValue: String(format: "%.1f%%", statsBefore.atkAccuracy * 100),
                    newValue: String(format: "%.1f%%", statsAfter.atkAccuracy * 100),
                    color: Color.warning
                )

                StatComparisonRow(
                    iconUrl: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/ui/stats/defense-power-round-shield.png",
                    fallbackIcon: "shield.fill",
                    oldValue: String(format: "%.0f", statsBefore.defPower * 100),
                    newValue: String(format: "%.0f", statsAfter.defPower * 100),
                    color: Color.accentSecondary
                )

                StatComparisonRow(
                    iconUrl: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/ui/stats/defense-accuracy-force-field.png",
                    fallbackIcon: "checkmark.shield.fill",
                    oldValue: String(format: "%.1f%%", statsBefore.defAccuracy * 100),
                    newValue: String(format: "%.1f%%", statsAfter.defAccuracy * 100),
                    color: Color.success
                )
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
        .padding(.horizontal, 20)
        .padding(.top, 24)
    }

    // MARK: - Gold Spent View
    private var goldSpentView: some View {
        HStack {
            Image(systemName: "minus.circle.fill")
                .foregroundColor(Color.warning)

            Text("\(goldSpent) Gold")
                .font(FontManager.impact(size: 16))
                .foregroundColor(Color.warning)

            Spacer()

            Text("\(isConfirmation ? "Balance After:" : "New Balance:") \(newGoldBalance)")
                .font(FontManager.body)
                .foregroundColor(Color.textSecondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.warning.opacity(0.15))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.warning, lineWidth: 1)
                )
        )
        .padding(.horizontal, 20)
        .padding(.top, 16)
    }

    // MARK: - Action Buttons View
    private var actionButtonsView: some View {
        VStack(spacing: 12) {
            if isConfirmation {
                // Confirmation mode: Show only "Confirm Upgrade"
                Button {
                    audioManager.playMenuButtonClick()
                    dismissModal()
                    Task {
                        try? await Task.sleep(for: .milliseconds(300))
                        onConfirm?()
                    }
                } label: {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                        Text("Confirm Upgrade")
                            .font(FontManager.impact(size: 16))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.success.opacity(0.15))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.success, lineWidth: 2)
                            )
                    )
                    .foregroundColor(Color.success)
                }
                .buttonStyle(PlainButtonStyle())
            } else {
                // Completion mode: Show only "Upgrade Again"
                Button {
                    audioManager.playMenuButtonClick()
                    dismissModal()
                    Task {
                        try? await Task.sleep(for: .milliseconds(300))
                        onUpgradeAgain?()
                    }
                } label: {
                    HStack {
                        Image(systemName: "arrow.up.circle.fill")
                        Text("Upgrade Again")
                            .font(FontManager.impact(size: 16))
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
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .padding(.bottom, 24)
    }

    // MARK: - Helper Methods

    private func dismissModal() {
        dismiss()
    }

    private func getRarityColor() -> Color {
        switch item.rarity.lowercased() {
        case "common":
            return Color.borderSubtle
        case "uncommon":
            return Color.success
        case "rare":
            return Color.accentSecondary
        case "epic":
            return Color.accent
        case "legendary":
            return Color.warning
        default:
            return Color.borderSubtle
        }
    }

    private func getItemIcon() -> String {
        switch item.category.lowercased() {
        case "weapon":
            return "hammer.fill"
        case "offhand":
            return "shield.fill"
        case "head":
            return "crown.fill"
        case "armor":
            return "tshirt.fill"
        case "feet":
            return "shoe.2.fill"
        case "accessory":
            return "ring.circle.fill"
        case "pet":
            return "pawprint.fill"
        default:
            return "questionmark.circle.fill"
        }
    }
}

// MARK: - Stat Comparison Row Component
private struct StatComparisonRow: View {
    let iconUrl: String
    let fallbackIcon: String
    let oldValue: String
    let newValue: String
    let color: Color

    var body: some View {
        HStack(spacing: 12) {
            // Stat icon
            CachedAsyncImage(
                url: URL(string: iconUrl),
                content: { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 32, height: 32)
                },
                placeholder: {
                    Image(systemName: fallbackIcon)
                        .font(.system(size: 32, weight: .medium))
                }
            )
            .foregroundColor(color)
            .frame(width: 40)

            Spacer()

            // Old value (grayed out)
            Text(oldValue)
                .font(FontManager.body)
                .foregroundColor(Color.textSecondary)
                .frame(alignment: .trailing)

            // Arrow
            Image(systemName: "arrow.right")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(Color.success)

            // New value (green with up arrow)
            HStack(spacing: 4) {
                Text(newValue)
                    .font(FontManager.body)
                    .foregroundColor(Color.success)
                    .bold()

                Image(systemName: "arrow.up")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(Color.success)
            }
            .frame(alignment: .trailing)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.backgroundSecondary)
        )
    }
}

// MARK: - Preview
#Preview("Upgrade Confirmation Modal") {
    UpgradeCompleteModal(
        item: EnhancedPlayerItem(
            id: "550e8400-e29b-41d4-a716-446655440000",
            baseType: "Magic Sword",
            itemTypeId: "550e8400-e29b-41d4-a716-446655440001",
            category: "weapon",
            level: 5,
            rarity: "epic",
            appliedMaterials: [],
            materials: [],
            computedStats: ItemStats(
                atkPower: 0.25,
                atkAccuracy: 0.15,
                defPower: 0.10,
                defAccuracy: 0.05
            ),
            materialComboHash: nil,
            generatedImageUrl: nil,
            imageGenerationStatus: nil,
            craftCount: 0,
            isStyled: true,
            isEquipped: true,
            equippedSlot: "weapon"
        ),
        goldSpent: 506,
        newGoldBalance: 694,
        statsBefore: ItemStats(
            atkPower: 0.25,
            atkAccuracy: 0.15,
            defPower: 0.10,
            defAccuracy: 0.05
        ),
        statsAfter: ItemStats(
            atkPower: 0.30,
            atkAccuracy: 0.18,
            defPower: 0.12,
            defAccuracy: 0.06
        ),
        isConfirmation: true,
        onConfirm: {
            print("Confirm Upgrade tapped")
        },
        onUpgradeAgain: nil,
        onReturnToInventory: {
            print("Cancel tapped")
        }
    )
    .modelContainer(for: Item.self, inMemory: true)
    .environmentObject(NavigationManager())
}

#Preview("Upgrade Complete Modal") {
    UpgradeCompleteModal(
        item: EnhancedPlayerItem(
            id: "550e8400-e29b-41d4-a716-446655440000",
            baseType: "Magic Sword",
            itemTypeId: "550e8400-e29b-41d4-a716-446655440001",
            category: "weapon",
            level: 6,
            rarity: "epic",
            appliedMaterials: [],
            materials: [],
            computedStats: ItemStats(
                atkPower: 0.30,
                atkAccuracy: 0.18,
                defPower: 0.12,
                defAccuracy: 0.06
            ),
            materialComboHash: nil,
            generatedImageUrl: nil,
            imageGenerationStatus: nil,
            craftCount: 0,
            isStyled: true,
            isEquipped: true,
            equippedSlot: "weapon"
        ),
        goldSpent: 506,
        newGoldBalance: 694,
        statsBefore: ItemStats(
            atkPower: 0.25,
            atkAccuracy: 0.15,
            defPower: 0.10,
            defAccuracy: 0.05
        ),
        statsAfter: ItemStats(
            atkPower: 0.30,
            atkAccuracy: 0.18,
            defPower: 0.12,
            defAccuracy: 0.06
        ),
        isConfirmation: false,
        onConfirm: nil,
        onUpgradeAgain: {
            print("Upgrade Again tapped")
        },
        onReturnToInventory: {
            print("Return to Inventory tapped")
        }
    )
    .modelContainer(for: Item.self, inMemory: true)
    .environmentObject(NavigationManager())
}