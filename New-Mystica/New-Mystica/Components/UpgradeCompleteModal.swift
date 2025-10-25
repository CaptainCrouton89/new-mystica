//
//  UpgradeModal.swift
//  New-Mystica
//
//  Modal view for displaying item upgrade screen with stat progression and upgrade button
//

import SwiftUI
import SwiftData

struct UpgradeModal: View {
    let item: EnhancedPlayerItem
    let goldCost: Int
    let newGoldBalance: Int
    let currentStats: ItemStats
    let projectedStats: ItemStats
    let onUpgrade: () -> Void
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
            RoundedRectangle(cornerRadius: .cornerRadiusExtraLarge)
                .fill(Color.backgroundCard)
                .frame(width: 160, height: 160)
                .overlay(
                    RoundedRectangle(cornerRadius: .cornerRadiusExtraLarge)
                        .stroke(Color.rarityBorderColor(for: item.rarity), lineWidth: 3)
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
        .clipShape(RoundedRectangle(cornerRadius: .cornerRadiusExtraLarge))
        .padding(.top, 16)
    }

    private var fallbackItemIcon: some View {
        VStack(spacing: 8) {
            Image(systemName: getItemIcon())
                .font(.system(size: 48, weight: .medium))
                .foregroundColor(Color.rarityBorderColor(for: item.rarity))

            SmallText("No Image")
                .foregroundColor(Color.textSecondary)
        }
    }

    // MARK: - Level Progression View
    private var levelProgressionView: some View {
        VStack(spacing: 8) {
            TitleText(item.baseType.capitalized, size: 20)

            // Level progression badge - shows current → next level
            HStack(spacing: 8) {
                Text("Level \(item.level)")
                    .font(FontManager.impact(size: 16))
                    .foregroundColor(Color.textSecondary)

                Image(systemName: "arrow.right")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(Color.accent)

                Text("Level \(item.level + 1)")
                    .font(FontManager.impact(size: 16))
                    .foregroundColor(Color.accent)
                    .bold()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                    .fill(Color.accent.opacity(0.15))
                    .overlay(
                        RoundedRectangle(cornerRadius: .cornerRadiusLarge)
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
                    iconUrl: StatIconURL.atkPower,
                    fallbackIcon: "hammer.fill",
                    oldValue: String(format: "%.0f", currentStats.atkPower * 100),
                    newValue: String(format: "%.0f", projectedStats.atkPower * 100),
                    color: Color.alert
                )

                StatComparisonRow(
                    iconUrl: StatIconURL.atkAccuracy,
                    fallbackIcon: "target",
                    oldValue: String(format: "%.0f", currentStats.atkAccuracy * 100),
                    newValue: String(format: "%.0f", projectedStats.atkAccuracy * 100),
                    color: Color.warning
                )

                StatComparisonRow(
                    iconUrl: StatIconURL.defPower,
                    fallbackIcon: "shield.fill",
                    oldValue: String(format: "%.0f", currentStats.defPower * 100),
                    newValue: String(format: "%.0f", projectedStats.defPower * 100),
                    color: Color.accentSecondary
                )

                StatComparisonRow(
                    iconUrl: StatIconURL.defAccuracy,
                    fallbackIcon: "checkmark.shield.fill",
                    oldValue: String(format: "%.0f", currentStats.defAccuracy * 100),
                    newValue: String(format: "%.0f", projectedStats.defAccuracy * 100),
                    color: Color.success
                )
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
        .padding(.horizontal, 20)
        .padding(.top, 24)
    }

    // MARK: - Gold Cost View
    private var goldSpentView: some View {
        HStack {
            Image(systemName: "minus.circle.fill")
                .foregroundColor(Color.warning)

            Text("\(goldCost) Gold")
                .font(FontManager.impact(size: 16))
                .foregroundColor(Color.warning)

            Spacer()

            Text("Balance After: \(newGoldBalance)")
                .font(FontManager.body)
                .foregroundColor(Color.textSecondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: .cornerRadiusSmall)
                .fill(Color.warning.opacity(0.15))
                .overlay(
                    RoundedRectangle(cornerRadius: .cornerRadiusSmall)
                        .stroke(Color.warning, lineWidth: 1)
                )
        )
        .padding(.horizontal, 20)
        .padding(.top, 16)
    }

    // MARK: - Action Buttons View
    private var actionButtonsView: some View {
        VStack(spacing: 12) {
            // Upgrade button - clicking triggers upgrade immediately without dismissing modal
            Button {
                audioManager.playMenuButtonClick()
                onUpgrade()
            } label: {
                HStack {
                    Image(systemName: "arrow.up.circle.fill")
                    Text("Upgrade")
                        .font(FontManager.impact(size: 16))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                        .fill(Color.accent.opacity(0.15))
                        .overlay(
                            RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                                .stroke(Color.accent, lineWidth: 2)
                        )
                )
                .foregroundColor(Color.accent)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .padding(.bottom, 24)
    }

    // MARK: - Helper Methods

    private func dismissModal() {
        dismiss()
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
            RoundedRectangle(cornerRadius: .cornerRadiusSmall)
                .fill(Color.backgroundSecondary)
        )
    }
}

// MARK: - Preview
#Preview("Upgrade Modal") {
    UpgradeModal(
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
        goldCost: 506,
        newGoldBalance: 694,
        currentStats: ItemStats(
            atkPower: 0.25,
            atkAccuracy: 0.15,
            defPower: 0.10,
            defAccuracy: 0.05
        ),
        projectedStats: ItemStats(
            atkPower: 0.30,
            atkAccuracy: 0.18,
            defPower: 0.12,
            defAccuracy: 0.06
        ),
        onUpgrade: {
            print("Upgrade tapped")
        },
        onReturnToInventory: {
            print("Return to Inventory tapped")
        }
    )
    .modelContainer(for: Item.self, inMemory: true)
    .environmentObject(NavigationManager())
}