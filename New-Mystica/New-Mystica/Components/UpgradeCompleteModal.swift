//
//  UpgradeCompleteModal.swift
//  New-Mystica
//
//  Modal view for displaying item upgrade completion with stat comparison
//

import SwiftUI
import SwiftData

struct UpgradeCompleteModal: View {
    let item: PlayerItem
    let goldSpent: Int
    let newGoldBalance: Int
    let newVanityLevel: Int?
    let statsBefore: ItemStats
    let statsAfter: ItemStats
    let onUpgradeAgain: () -> Void
    let onReturnToInventory: () -> Void

    @Binding var isPresented: Bool
    @State private var isAnimating = false
    @Environment(\.audioManager) private var audioManager

    var body: some View {
        ZStack {
            // Background overlay with blur effect
            Color.black.opacity(0.7)
                .ignoresSafeArea()
                .background(
                    .ultraThinMaterial,
                    in: Rectangle()
                )
                .onTapGesture {
                    dismissModal()
                }

            // Modal content
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

                // Vanity level update (if applicable)
                if let newVanityLevel = newVanityLevel {
                    vanityLevelView(newVanityLevel)
                }

                // Action buttons
                actionButtonsView
            }
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color.backgroundPrimary)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(Color.accent, lineWidth: 2)
                    )
            )
            .padding(.horizontal, 32)
            .offset(y: isAnimating ? 0 : 100)
            .opacity(isAnimating ? 1.0 : 0.0)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.3)) {
                isAnimating = true
            }
        }
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
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        ProgressView()
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 160, height: 160)
                            .clipped()
                    case .failure:
                        fallbackItemIcon
                    @unknown default:
                        EmptyView()
                    }
                }
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
                Text("Level \(item.level - 1)")
                    .font(FontManager.impact(size: 16))
                    .foregroundColor(Color.textSecondary)

                Image(systemName: "arrow.right")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(Color.accent)

                Text("Level \(item.level)")
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
            TitleText("Stat Improvements", size: 18)

            VStack(spacing: 8) {
                StatComparisonRow(
                    iconUrl: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/ui/stats/attack-power-crossed-swords.png",
                    fallbackIcon: "sword.fill",
                    label: "ATK Power",
                    oldValue: String(format: "%.0f", statsBefore.atkPower * 100),
                    newValue: String(format: "%.0f", statsAfter.atkPower * 100),
                    color: Color.alert
                )

                StatComparisonRow(
                    iconUrl: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/ui/stats/attack-accuracy-crosshair.png",
                    fallbackIcon: "target",
                    label: "ATK Accuracy",
                    oldValue: String(format: "%.1f%%", statsBefore.atkAccuracy * 100),
                    newValue: String(format: "%.1f%%", statsAfter.atkAccuracy * 100),
                    color: Color.warning
                )

                StatComparisonRow(
                    iconUrl: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/ui/stats/defense-power-round-shield.png",
                    fallbackIcon: "shield.fill",
                    label: "DEF Power",
                    oldValue: String(format: "%.0f", statsBefore.defPower * 100),
                    newValue: String(format: "%.0f", statsAfter.defPower * 100),
                    color: Color.accentSecondary
                )

                StatComparisonRow(
                    iconUrl: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/ui/stats/defense-accuracy-force-field.png",
                    fallbackIcon: "checkmark.shield.fill",
                    label: "DEF Accuracy",
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

            Text("New Balance: \(newGoldBalance)")
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

    // MARK: - Vanity Level View
    private func vanityLevelView(_ newVanityLevel: Int) -> some View {
        HStack {
            Image(systemName: "star.fill")
                .foregroundColor(Color.accent)

            Text("Vanity Level: \(newVanityLevel)")
                .font(FontManager.impact(size: 16))
                .foregroundColor(Color.accent)

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.accent.opacity(0.15))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.accent, lineWidth: 1)
                )
        )
        .padding(.horizontal, 20)
        .padding(.top, 8)
    }

    // MARK: - Action Buttons View
    private var actionButtonsView: some View {
        VStack(spacing: 12) {
            // Upgrade Again button
            Button {
                audioManager.playMenuButtonClick()
                dismissModal()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    onUpgradeAgain()
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

            // Return to Inventory button
            Button {
                audioManager.playMenuButtonClick()
                dismissModal()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    onReturnToInventory()
                }
            } label: {
                HStack {
                    Image(systemName: "backpack.fill")
                    Text("Return to Inventory")
                        .font(FontManager.impact(size: 16))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.accentSecondary.opacity(0.15))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.accentSecondary, lineWidth: 2)
                        )
                )
                .foregroundColor(Color.accentSecondary)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .padding(.bottom, 24)
    }

    // MARK: - Helper Methods

    private func dismissModal() {
        withAnimation(.easeOut(duration: 0.3)) {
            isAnimating = false
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            isPresented = false
        }
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
            return "sword.fill"
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
    let label: String
    let oldValue: String
    let newValue: String
    let color: Color

    var body: some View {
        HStack(spacing: 12) {
            // Stat icon
            AsyncImage(url: URL(string: iconUrl)) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 32, height: 32)
            } placeholder: {
                Image(systemName: fallbackIcon)
                    .font(.system(size: 32, weight: .medium))
            }
            .foregroundColor(color)
            .frame(width: 40)

            // Stat label
            VStack(alignment: .leading, spacing: 2) {
                SmallText(label)
                    .foregroundColor(Color.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Old value (grayed out)
            Text(oldValue)
                .font(FontManager.body)
                .foregroundColor(Color.textSecondary)
                .frame(width: 60, alignment: .trailing)

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
            .frame(width: 80, alignment: .trailing)
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
#Preview("Upgrade Complete Modal") {
    UpgradeCompleteModal(
        item: PlayerItem(
            id: "550e8400-e29b-41d4-a716-446655440000",
            baseType: "Magic Sword",
            itemTypeId: "550e8400-e29b-41d4-a716-446655440001",
            category: "weapon",
            level: 6,
            rarity: "epic",
            appliedMaterials: ["steel", "crystal"],
            isStyled: true,
            computedStats: ItemStats(
                atkPower: 0.30,
                atkAccuracy: 0.18,
                defPower: 0.12,
                defAccuracy: 0.06
            ),
            isEquipped: true,
            generatedImageUrl: nil
        ),
        goldSpent: 506,
        newGoldBalance: 694,
        newVanityLevel: 42,
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
        onUpgradeAgain: {
            print("Upgrade Again tapped")
        },
        onReturnToInventory: {
            print("Return to Inventory tapped")
        },
        isPresented: .constant(true)
    )
    .modelContainer(for: Item.self, inMemory: true)
    .environmentObject(NavigationManager())
}