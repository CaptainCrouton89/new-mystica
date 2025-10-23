//
//  ItemDetailModal.swift
//  New-Mystica
//
//  Modal view for displaying detailed item information with unequip/equip actions
//

import SwiftUI
import SwiftData

struct ItemDetailModal: View {
    let item: PlayerItem
    let slot: EquipmentSlot
    let onUnequip: () async -> Void
    let onEquipDifferent: () -> Void
    let onUpgrade: () -> Void
    let onCraft: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.audioManager) private var audioManager
    @Environment(\.navigationManager) private var navigationManager
    @State private var showUnequipConfirmation = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Large item image
                    itemImageView

                    // Item metadata
                    itemMetadataView

                    // Stats display
                    itemStatsView

                    // Materials section (if any)
                    if !item.appliedMaterials.isEmpty {
                        materialsView
                    }

                    // Action buttons
                    actionButtonsView
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
            .background(Color.backgroundPrimary)
            .navigationTitle(slot.displayName)
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
        .confirmationDialog(
            "Unequip Item",
            isPresented: $showUnequipConfirmation,
            titleVisibility: .visible
        ) {
            Button("Unequip", role: .destructive) {
                Task {
                    await onUnequip()
                    dismiss()
                }
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Remove \(item.baseType) from \(slot.displayName) slot?")
        }
    }

    // MARK: - Item Image View
    private var itemImageView: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.backgroundCard)
                .frame(height: 280)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.accentSecondary, lineWidth: 3)
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
                            .frame(height: 280)
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
    }

    private var fallbackItemIcon: some View {
        VStack(spacing: 12) {
            Image(systemName: getSlotIcon())
                .font(.system(size: 72, weight: .medium))
                .foregroundColor(getRarityColor())

            NormalText("No Image")
                .foregroundColor(Color.textSecondary)
        }
    }

    // MARK: - Item Metadata View
    private var itemMetadataView: some View {
        VStack(spacing: 12) {
            TitleText(item.baseType.capitalized, size: 24)

            HStack(spacing: 16) {
                // Level badge
                Badge(label: "Level", value: "\(item.level)", color: Color.accentSecondary)

                // Rarity badge
                Badge(label: "Rarity", value: item.rarity.capitalized, color: getRarityColor())

                // Category badge
                Badge(label: "Type", value: item.category.capitalized, color: Color.textSecondary)
            }

            // Styled indicator
            if item.isStyled {
                HStack {
                    Image(systemName: "paintbrush.fill")
                        .font(.system(size: 14))
                    NormalText("Styled Item", size: 14)
                }
                .foregroundColor(Color.accent)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.accent.opacity(0.15))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.accent, lineWidth: 1)
                        )
                )
            }
        }
    }

    // MARK: - Item Stats View
    private var itemStatsView: some View {
        VStack(spacing: 12) {
            TitleText("Stats", size: 20)

            VStack(spacing: 8) {
                // Attack stats
                HStack(spacing: 12) {
                    StatDetailRow(
                        iconUrl: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/ui/stats/attack-power-crossed-swords.png",
                        fallbackIcon: "sword.fill",
                        label: "ATK Power",
                        value: String(format: "%.0f", item.computedStats.atkPower * 100),
                        color: Color.alert
                    )

                    StatDetailRow(
                        iconUrl: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/ui/stats/attack-accuracy-crosshair.png",
                        fallbackIcon: "target",
                        label: "ATK Accuracy",
                        value: String(format: "%.1f%%", item.computedStats.atkAccuracy * 100),
                        color: Color.warning
                    )
                }

                // Defense stats
                HStack(spacing: 12) {
                    StatDetailRow(
                        iconUrl: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/ui/stats/defense-power-round-shield.png",
                        fallbackIcon: "shield.fill",
                        label: "DEF Power",
                        value: String(format: "%.0f", item.computedStats.defPower * 100),
                        color: Color.accentSecondary
                    )

                    StatDetailRow(
                        iconUrl: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/ui/stats/defense-accuracy-force-field.png",
                        fallbackIcon: "checkmark.shield.fill",
                        label: "DEF Accuracy",
                        value: String(format: "%.1f%%", item.computedStats.defAccuracy * 100),
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

    // MARK: - Materials View
    private var materialsView: some View {
        VStack(spacing: 12) {
            TitleText("Ingredients", size: 20)

            VStack(alignment: .leading, spacing: 8) {
                ForEach(item.appliedMaterials, id: \.self) { material in
                    HStack {
                        Image(systemName: "circle.fill")
                            .font(.system(size: 6))
                            .foregroundColor(Color.accent)

                        NormalText(material.capitalized)
                            .foregroundColor(Color.textPrimary)

                        Spacer()
                    }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
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

    // MARK: - Action Buttons View
    private var actionButtonsView: some View {
        VStack(spacing: 12) {
            // Primary actions row (Upgrade & Craft)
            HStack(spacing: 12) {
                // Upgrade button
                Button {
                    audioManager.playMenuButtonClick()
                    dismiss()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        onUpgrade()
                    }
                } label: {
                    HStack {
                        Image(systemName: "arrow.up.circle.fill")
                        NormalText("Upgrade")
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

                // Craft button
                Button {
                    audioManager.playMenuButtonClick()
                    dismiss()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        onCraft()
                    }
                } label: {
                    HStack {
                        Image(systemName: "hammer.fill")
                        NormalText("Craft")
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

            // Equip Different button
            TextButton("Equip Different Item") {
                audioManager.playMenuButtonClick()
                dismiss()
                // Delay to let modal dismiss before opening drawer
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    onEquipDifferent()
                }
            }

            // Unequip button
            Button {
                audioManager.playMenuButtonClick()
                showUnequipConfirmation = true
            } label: {
                HStack {
                    Image(systemName: "minus.circle")
                    NormalText("Unequip Item")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.alert.opacity(0.15))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.alert, lineWidth: 2)
                        )
                )
                .foregroundColor(Color.alert)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.bottom, 16)
    }

    // MARK: - Helper Methods

    private func getRarityColor() -> Color {
        switch item.rarity.lowercased() {
        case "common":
            return Color.borderSubtle
        case "rare":
            return Color.success
        case "epic":
            return Color.accent
        case "legendary":
            return Color.warning
        default:
            return Color.borderSubtle
        }
    }

    private func getSlotIcon() -> String {
        switch slot {
        case .weapon:
            return "sword.fill"
        case .offhand:
            return "shield.fill"
        case .head:
            return "crown.fill"
        case .armor:
            return "tshirt.fill"
        case .feet:
            return "shoe.2.fill"
        case .accessory_1, .accessory_2:
            return "ring.circle.fill"
        case .pet:
            return "pawprint.fill"
        }
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

// MARK: - Stat Detail Row Component
private struct StatDetailRow: View {
    let iconUrl: String
    let fallbackIcon: String
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack(spacing: 8) {
            AsyncImage(url: URL(string: iconUrl)) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 48, height: 48)
            } placeholder: {
                Image(systemName: fallbackIcon)
                    .font(.system(size: 48, weight: .medium))
            }
            .foregroundColor(color)
            .frame(width: 56)

            VStack(alignment: .leading, spacing: 2) {
                SmallText(label)
                    .foregroundColor(Color.textSecondary)

                NormalText(value, size: 16)
                    .foregroundColor(color)
                    .bold()
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
}

// MARK: - Preview
#Preview("Item Detail Modal") {
    ItemDetailModal(
        item: PlayerItem(
            id: "550e8400-e29b-41d4-a716-446655440000",
            baseType: "Magic Sword",
            itemTypeId: "550e8400-e29b-41d4-a716-446655440001",
            category: "weapon",
            level: 5,
            rarity: "epic",
            appliedMaterials: ["steel", "crystal", "moonstone"],
            isStyled: true,
            computedStats: ItemStats(
                atkPower: 45.0,
                atkAccuracy: 0.85,
                defPower: 12.0,
                defAccuracy: 0.60
            ),
            isEquipped: true,
            generatedImageUrl: nil
        ),
        slot: .weapon,
        onUnequip: {
            print("Unequip tapped")
        },
        onEquipDifferent: {
            print("Equip different tapped")
        },
        onUpgrade: {
            print("Upgrade tapped")
        },
        onCraft: {
            print("Craft tapped")
        }
    )
    .modelContainer(for: Item.self, inMemory: true)
    .environmentObject(NavigationManager())
    .environment(AppState.shared)
}
