//
//  InventoryItemDetailModal.swift
//  New-Mystica
//
//  Modal view for displaying detailed inventory item information
//  Adapted from ItemDetailModal to work with EnhancedPlayerItem
//

import SwiftUI
import SwiftData

struct InventoryItemDetailModal: View {
    let item: EnhancedPlayerItem
    let onEquip: () async -> Void
    let onCraft: () -> Void
    let onUpgrade: () -> Void
    let onSell: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.audioManager) private var audioManager

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
            .navigationTitle("Item Details")
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
                fallbackItemIcon
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var fallbackItemIcon: some View {
        VStack(spacing: 12) {
            Image(systemName: getItemIcon())
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

                // Rarity badge (placeholder - not available on EnhancedPlayerItem)
                Badge(label: "Status", value: item.isEquipped ? "Equipped" : "Inventory", color: item.isEquipped ? Color.accent : Color.textSecondary)

                // Craft count badge
                Badge(label: "Crafted", value: "\(item.craftCount)x", color: Color.warning)
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

                        NormalText(material.material?.name ?? "Unknown Material")
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
                    Task {
                        try? await Task.sleep(for: .milliseconds(300))
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
                    Task {
                        try? await Task.sleep(for: .milliseconds(300))
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

            // Equip button
            Button {
                audioManager.playMenuButtonClick()
                dismiss()
                Task {
                    try? await Task.sleep(for: .milliseconds(300))
                    await onEquip()
                }
            } label: {
                HStack {
                    Image(systemName: "checkmark.shield.fill")
                    NormalText("Equip Item")
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
            .disabled(item.isEquipped)
            .opacity(item.isEquipped ? 0.5 : 1.0)

            // Sell button
            Button {
                audioManager.playMenuButtonClick()
                dismiss()
                onSell()
            } label: {
                HStack {
                    Image(systemName: "dollarsign.circle.fill")
                    NormalText("Sell Item")
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
        // Based on level and styling status since rarity isn't available
        if item.isEquipped {
            return Color.accent
        } else if item.isStyled {
            return Color.accentSecondary
        } else if item.level >= 10 {
            return Color.orange
        } else if item.level >= 5 {
            return Color.blue
        } else {
            return Color.borderSubtle
        }
    }

    private func getItemIcon() -> String {
        let lowercased = item.baseType.lowercased()
        if lowercased.contains("sword") || lowercased.contains("weapon") {
            return "sword.fill"
        } else if lowercased.contains("shield") {
            return "shield.fill"
        } else if lowercased.contains("armor") || lowercased.contains("chest") {
            return "tshirt.fill"
        } else if lowercased.contains("head") || lowercased.contains("helmet") {
            return "crown.fill"
        } else if lowercased.contains("feet") || lowercased.contains("boot") {
            return "shoe.2.fill"
        } else if lowercased.contains("ring") || lowercased.contains("accessory") {
            return "ring.circle.fill"
        } else if lowercased.contains("pet") {
            return "pawprint.fill"
        } else {
            return "cube.fill"
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
#Preview("Inventory Item Detail Modal") {
    InventoryItemDetailModal(
        item: EnhancedPlayerItem(
            id: "550e8400-e29b-41d4-a716-446655440000",
            baseType: "Magic Sword",
            itemTypeId: "550e8400-e29b-41d4-a716-446655440001",
            category: "weapon",
            level: 5,
            rarity: "rare",
            appliedMaterials: [
                ItemMaterialApplication(
                    materialId: "steel",
                    styleId: "rustic",
                    slotIndex: 0,
                    appliedAt: "2025-10-23T06:00:00Z",
                    material: ItemMaterialApplication.MaterialDetail(
                        id: "steel",
                        name: "Steel",
                        description: nil,
                        styleId: "rustic",
                        statModifiers: StatModifier(atkPower: 5, atkAccuracy: 0, defPower: 0, defAccuracy: 0),
                        imageUrl: nil
                    )
                ),
                ItemMaterialApplication(
                    materialId: "crystal",
                    styleId: "ethereal",
                    slotIndex: 1,
                    appliedAt: "2025-10-23T06:00:00Z",
                    material: ItemMaterialApplication.MaterialDetail(
                        id: "crystal",
                        name: "Crystal",
                        description: nil,
                        styleId: "ethereal",
                        statModifiers: StatModifier(atkPower: 10, atkAccuracy: 0, defPower: 0, defAccuracy: 0),
                        imageUrl: nil
                    )
                )
            ],
            materials: [],
            computedStats: ItemStats(
                atkPower: 45.0,
                atkAccuracy: 0.85,
                defPower: 12.0,
                defAccuracy: 0.60
            ),
            materialComboHash: "abc123",
            generatedImageUrl: nil,
            imageGenerationStatus: .complete,
            craftCount: 2,
            isStyled: true,
            isEquipped: false,
            equippedSlot: nil
        ),
        onEquip: {
            print("Equip tapped")
        },
        onCraft: {
            print("Craft tapped")
        },
        onUpgrade: {
            print("Upgrade tapped")
        },
        onSell: {
            print("Sell tapped")
        }
    )
    .modelContainer(for: Item.self, inMemory: true)
    .environmentObject(NavigationManager())
    .environment(AppState.shared)
}
