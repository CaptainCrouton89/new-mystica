//
//  ItemRow.swift
//  New-Mystica
//
//  Item row component for inventory display
//  Extracted from InventoryView.swift for better maintainability
//

import SwiftUI

struct ItemRow: View {
    let item: EnhancedPlayerItem

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header: Item Name and Level
            HStack {
                NormalText(item.name, size: 16)
                    .foregroundColor(Color.textPrimary)
                    .bold()
                    .lineLimit(1)
                    .truncationMode(.tail)

                Spacer()

                NormalText("Lv. \(item.level)")
                    .foregroundColor(Color.textSecondary)
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)

            // Main Content Row
            HStack(spacing: 12) {
                // Item Image
                Group {
                    if let imageUrl = item.generatedImageUrl, let url = URL(string: imageUrl) {
                        CachedAsyncImage(
                            url: url,
                            content: { image in
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(width: 50, height: 50)
                                    .clipped()
                            },
                            placeholder: {
                                ProgressView()
                                    .frame(width: 50, height: 50)
                            }
                        )
                    } else {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.backgroundSecondary)
                                .frame(width: 50, height: 50)

                            Image(systemName: getItemIcon())
                                .font(.system(size: 24, weight: .medium))
                                .foregroundColor(Color.textSecondary)
                        }
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(colorForRarity(item.rarity), lineWidth: 2)
                )
                .overlay(
                    // Equipped indicator overlay
                    Group {
                        if item.isEquipped {
                            VStack {
                                HStack {
                                    Spacer()
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 16, weight: .bold))
                                        .foregroundColor(Color.accent)
                                        .background(Color.backgroundPrimary)
                                        .clipShape(Circle())
                                }
                                Spacer()
                            }
                            .padding(2)
                        }
                    }
                )

                // Item Details
                VStack(alignment: .leading, spacing: 4) {
                    // Stats Preview - All 4 Stats in Single Row
                    HStack(spacing: 12) {
                        StatValueView(
                            label: "ATK PWR",
                            value: String(format: "%.0f", item.computedStats.atkPower * 100),
                            color: Color.alert,
                            iconUrl: StatIconURL.atkPower,
                            fallbackIcon: "hammer.fill"
                        )

                        StatValueView(
                            label: "ATK ACC",
                            value: String(format: "%.0f", item.computedStats.atkAccuracy * 100),
                            color: Color.warning,
                            iconUrl: StatIconURL.atkAccuracy,
                            fallbackIcon: "target"
                        )

                        StatValueView(
                            label: "DEF PWR",
                            value: String(format: "%.0f", item.computedStats.defPower * 100),
                            color: Color.accentSecondary,
                            iconUrl: StatIconURL.defPower,
                            fallbackIcon: "shield.fill"
                        )

                        StatValueView(
                            label: "DEF ACC",
                            value: String(format: "%.0f", item.computedStats.defAccuracy * 100),
                            color: Color.success,
                            iconUrl: StatIconURL.defAccuracy,
                            fallbackIcon: "checkmark.shield.fill"
                        )

                        Spacer()
                    }

                    // Styling Status
                    HStack {
                        if item.isStyled, let firstMaterial = item.appliedMaterials.first {
                            let styleName = firstMaterial.material?.styleName ?? formatStyleName(firstMaterial.styleId)
                            SmallText(styleName)
                                .foregroundColor(Color.accent)
                        } else {
                            SmallText("Normal")
                                .foregroundColor(Color.textSecondary)
                        }

                        if item.craftCount > 0 {
                            SmallText("• Crafted \(item.craftCount)x")
                                .foregroundColor(Color.textSecondary)
                        }

                        Spacer()
                    }

                    // Equipped Status Badge
                    if item.isEquipped, let equippedSlot = item.equippedSlot {
                        HStack(spacing: 4) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(Color.accent)

                            SmallText("Equipped: \(formatSlotName(equippedSlot))")
                                .foregroundColor(Color.accent)
                                .bold()

                            Spacer()
                        }
                        .padding(.top, 2)
                    }
                }

                // Chevron Indicator
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Color.borderSubtle)
            }
            .padding(.horizontal, 16)

            .padding(.bottom, 8)
        }
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(colorForRarityBackground(item.rarity))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(colorForRarity(item.rarity), lineWidth: 1)
                )
        )
    }

    // MARK: - Helper Methods

    private func getItemIcon() -> String {
        let lowercased = item.baseType.lowercased()
        if lowercased.contains("sword") || lowercased.contains("weapon") {
            return "hammer.fill"
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

    private func colorForRarity(_ rarity: String) -> Color {
        switch rarity.lowercased() {
        case "common":
            return .gray
        case "uncommon":
            return .green
        case "rare":
            return .blue
        case "epic":
            return .purple
        case "legendary":
            return .orange
        default:
            return .gray
        }
    }

    private func colorForRarityBackground(_ rarity: String) -> Color {
        switch rarity.lowercased() {
        case "common":
            return Color.rarityCommon
        case "uncommon":
            return Color.rarityUncommon
        case "rare":
            return Color.rarityRare
        case "epic":
            return Color.rarityEpic
        case "legendary":
            return Color.rarityLegendary
        default:
            return Color.rarityCommon
        }
    }

    private func formatSlotName(_ slotName: String) -> String {
        switch slotName.lowercased() {
        case "weapon":
            return "Weapon"
        case "offhand":
            return "Offhand"
        case "head":
            return "Head"
        case "armor":
            return "Armor"
        case "feet":
            return "Feet"
        case "accessory_1":
            return "Accessory 1"
        case "accessory_2":
            return "Accessory 2"
        case "pet":
            return "Pet"
        default:
            return slotName.capitalized
        }
    }

    private func formatStyleName(_ styleId: String) -> String {
        // Map style IDs to their display names
        switch styleId.lowercased() {
        case "rustic":
            return "Rustic"
        case "pixelated", "pixel_art", "pixel":
            return "Pixelated"
        case "ethereal":
            return "Ethereal"
        case "holographic":
            return "Holographic"
        case "magical":
            return "Magical"
        case "natural":
            return "Natural"
        default:
            return ""
        }
    }
}

#Preview {
    VStack(spacing: 12) {
        ItemRow(item: mockItemEquipped)
        ItemRow(item: mockItemStyled)
        ItemRow(item: mockItemBasic)
    }
    .padding()
    .background(Color.backgroundPrimary)
}

// Mock data for preview
private let mockItemEquipped = EnhancedPlayerItem(
    id: "1",
    baseType: "iron_sword",
    itemTypeId: "type-1",
    category: "weapon",
    level: 3,
    rarity: "rare",
    appliedMaterials: [],
    materials: [],
    computedStats: ItemStats(atkPower: 25, atkAccuracy: 15, defPower: 5, defAccuracy: 8),
    materialComboHash: nil,
    generatedImageUrl: nil,
    imageGenerationStatus: nil,
    craftCount: 0,
    isStyled: false,
    isEquipped: true,
    equippedSlot: "weapon"
)

private let mockItemStyled = EnhancedPlayerItem(
    id: "2",
    baseType: "steel_armor",
    itemTypeId: "type-2",
    category: "armor",
    level: 5,
    rarity: "epic",
    appliedMaterials: [
        ItemMaterialApplication(
            materialId: "wood",
            styleId: "rustic",
            slotIndex: 0,
            appliedAt: "2025-10-23T06:00:00Z",
            material: ItemMaterialApplication.MaterialDetail(
                id: "wood",
                name: "Wood",
                description: nil,
                styleId: "rustic",
                styleName: "Rustic",
                statModifiers: StatModifier(atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0),
                imageUrl: nil
            )
        )
    ],
    materials: [],
    computedStats: ItemStats(atkPower: 10, atkAccuracy: 20, defPower: 45, defAccuracy: 25),
    materialComboHash: "abc123",
    generatedImageUrl: "https://example.com/styled_armor.png",
    imageGenerationStatus: .complete,
    craftCount: 2,
    isStyled: true,
    isEquipped: false,
    equippedSlot: nil
)

private let mockItemBasic = EnhancedPlayerItem(
    id: "3",
    baseType: "leather_boots",
    itemTypeId: "type-3",
    category: "armor",
    level: 1,
    rarity: "common",
    appliedMaterials: [],
    materials: [],
    computedStats: ItemStats(atkPower: 2, atkAccuracy: 3, defPower: 8, defAccuracy: 5),
    materialComboHash: nil,
    generatedImageUrl: nil,
    imageGenerationStatus: nil,
    craftCount: 0,
    isStyled: false,
    isEquipped: false,
    equippedSlot: nil
)