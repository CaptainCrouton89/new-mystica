//
//  UnifiedItemDetailModal.swift
//  New-Mystica
//
//  Unified modal view for displaying detailed item information
//  Used by both EquipmentView and InventoryView
//

import SwiftUI
import SwiftData

// MARK: - Item Detail Displayable Protocol

protocol ItemDetailDisplayable {
    var id: String { get }
    var name: String { get }
    var description: String? { get }
    var baseType: String { get }
    var level: Int { get }
    var rarity: String { get }
    var computedStats: ItemStats { get }
    var generatedImageUrl: String? { get }
    var isStyled: Bool { get }
    var isEquipped: Bool { get }
    var category: String { get }

    var formattedMaterials: [MaterialDisplayInfo] { get }
    var primaryBadgeValue: String { get }
    var secondaryBadgeValue: String { get }
}

struct MaterialDisplayInfo: Hashable {
    let name: String
    let styleName: String?
}

// MARK: - Protocol Conformance

extension PlayerItem: ItemDetailDisplayable {
    var formattedMaterials: [MaterialDisplayInfo] {
        appliedMaterials.map { MaterialDisplayInfo(name: $0.capitalized, styleName: nil) }
    }

    var primaryBadgeValue: String {
        rarity.capitalized
    }

    var secondaryBadgeValue: String {
        category.capitalized
    }
}

extension EnhancedPlayerItem: ItemDetailDisplayable {
    var formattedMaterials: [MaterialDisplayInfo] {
        appliedMaterials.map {
            MaterialDisplayInfo(
                name: $0.material?.name ?? "Unknown Material",
                styleName: $0.material?.styleName
            )
        }
    }

    var primaryBadgeValue: String {
        isEquipped ? "Equipped" : "Inventory"
    }

    var secondaryBadgeValue: String {
        "\(craftCount)x"
    }
}

// MARK: - Badge Configuration

enum BadgeType {
    case level
    case primary(label: String, color: Color)
    case secondary(label: String, color: Color)
}

// MARK: - Unified Item Detail Modal

struct UnifiedItemDetailModal<Item: ItemDetailDisplayable, ActionButtons: View>: View {
    let item: Item
    let badges: [BadgeType]
    @ViewBuilder let actionButtons: () -> ActionButtons

    @Environment(\.dismiss) private var dismiss
    @Environment(\.audioManager) private var audioManager

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    // Large item image
                    itemImageView

                    // Rarity bar
                    rarityBarView

                    // Item metadata
                    if item.isStyled,
                       let firstMaterial = item.formattedMaterials.first,
                       let styleName = firstMaterial.styleName,
                       styleName.lowercased() != "normal" {
                        itemMetadataView
                    }

                    // Stats display
                    itemStatsView

                    // Materials section (if any)
                    if !item.formattedMaterials.isEmpty {
                        materialsView
                    }

                    // Description (if available)
                    if let description = item.description, !description.isEmpty {
                        descriptionView(description)
                    }

                    // Action buttons
                    actionButtons()
                        .padding(.bottom, 16)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
            .background(Color.rarityBackgroundColor(for: item.rarity))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    TitleText(item.name, size: 20)
                        .lineLimit(1)
                }
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

    // MARK: - Rarity Bar View
    private var rarityBarView: some View {
        HStack(spacing: 12) {
            SmallText("Lvl.\(item.level)", size: 12)
                .bold()

            Spacer()

            SmallText(item.rarity.uppercased(), size: 12, color: Color.rarityBorderColor(for: item.rarity))
                .bold()
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: .cornerRadiusStandard)
                .fill(Color.rarityBorderColor(for: item.rarity).opacity(0.15))
                .overlay(
                    RoundedRectangle(cornerRadius: .cornerRadiusStandard)
                        .stroke(Color.rarityBorderColor(for: item.rarity), lineWidth: 1)
                )
        )
    }

    // MARK: - Item Image View
    private var itemImageView: some View {
        ZStack(alignment: .topTrailing) {
            ZStack {
                RoundedRectangle(cornerRadius: .cornerRadiusStandard)
                    .fill(Color.backgroundCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: .cornerRadiusStandard)
                            .stroke(Color.rarityBorderColor(for: item.rarity), lineWidth: 6)
                    )

                if let imageUrl = item.generatedImageUrl, let url = URL(string: imageUrl) {
                    CachedAsyncImage(
                        url: url,
                        content: { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
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
            .clipShape(RoundedRectangle(cornerRadius: .cornerRadiusStandard))

            // Equipped badge overlay
            if item.isEquipped {
                VStack {
                    HStack {
                        Spacer()

                        SmallText("EQUIPPED", size: 11)
                            .foregroundColor(.white)
                            .bold()
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(
                                RoundedRectangle(cornerRadius: .cornerRadiusStandard)
                                    .fill(Color.accent)
                            )
                            .padding(12)
                    }
                    Spacer()
                }
            }
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(1, contentMode: .fit)
    }

    private var fallbackItemIcon: some View {
        VStack(spacing: 12) {
            Image(systemName: getItemIcon())
                .font(.system(size: 72, weight: .medium))
                .foregroundColor(Color.rarityBorderColor(for: item.rarity))

            NormalText("No Image")
                .foregroundColor(Color.textSecondary)
        }
    }

    // MARK: - Item Metadata View
    private var itemMetadataView: some View {
        VStack(spacing: 12) {
            // Styled indicator (hide if style is "normal")
            if item.isStyled,
               let firstMaterial = item.formattedMaterials.first,
               let styleName = firstMaterial.styleName,
               styleName.lowercased() != "normal" {
                HStack(spacing: 8) {
                    Image(systemName: "paintbrush.fill")
                        .font(.system(size: 14))
                    NormalText(styleName, size: 14)
                    Spacer()
                }
                .foregroundColor(Color.accent)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: .cornerRadiusStandard)
                        .fill(Color.accent.opacity(0.15))
                        .overlay(
                            RoundedRectangle(cornerRadius: .cornerRadiusStandard)
                                .stroke(Color.accent, lineWidth: 1)
                        )
                )
            }
        }
    }

    @ViewBuilder
    private func badgeView(for badge: BadgeType) -> some View {
        switch badge {
        case .level:
            Badge(label: "Level", value: "\(item.level)", color: Color.accentSecondary)
        case .primary(let label, let color):
            Badge(label: label, value: item.primaryBadgeValue, color: color)
        case .secondary(let label, let color):
            Badge(label: label, value: item.secondaryBadgeValue, color: color)
        }
    }

    // MARK: - Item Stats View
    private var itemStatsView: some View {
        VStack(spacing: 12) {
            VStack(spacing: 8) {
                // Attack stats
                HStack(spacing: 12) {
                    StatDetailRow(
                        iconUrl: StatIconURL.atkPower,
                        fallbackIcon: "hammer.fill",
                        label: "ATK Power",
                        value: String(format: "%.0f", item.computedStats.atkPower * 100),
                        color: Color.alert
                    )

                    StatDetailRow(
                        iconUrl: StatIconURL.atkAccuracy,
                        fallbackIcon: "target",
                        label: "ATK Accuracy",
                        value: String(format: "%.0f", item.computedStats.atkAccuracy * 100),
                        color: Color.warning
                    )
                }

                // Defense stats
                HStack(spacing: 12) {
                    StatDetailRow(
                        iconUrl: StatIconURL.defPower,
                        fallbackIcon: "shield.fill",
                        label: "DEF Power",
                        value: String(format: "%.0f", item.computedStats.defPower * 100),
                        color: Color.accentSecondary
                    )

                    StatDetailRow(
                        iconUrl: StatIconURL.defAccuracy,
                        fallbackIcon: "checkmark.shield.fill",
                        label: "DEF Accuracy",
                        value: String(format: "%.0f", item.computedStats.defAccuracy * 100),
                        color: Color.success
                    )
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: .cornerRadiusStandard)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: .cornerRadiusStandard)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }

    // MARK: - Materials View
    private var materialsView: some View {
        VStack(spacing: 12) {
            TitleText("Ingredients", size: 20)

            VStack(alignment: .leading, spacing: 8) {
                ForEach(item.formattedMaterials, id: \.self) { material in
                    HStack {
                        Image(systemName: "circle.fill")
                            .font(.system(size: 6))
                            .foregroundColor(Color.accent)

                        NormalText(material.name)
                            .foregroundColor(Color.textPrimary)

                        Spacer()
                    }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: .cornerRadiusStandard)
                    .fill(Color.backgroundSecondary)
            )
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: .cornerRadiusStandard)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: .cornerRadiusStandard)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }

    // MARK: - Description View
    private func descriptionView(_ description: String) -> some View {
        VStack(spacing: 12) {
            NormalText(description)
                .foregroundColor(Color.textPrimary)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: .cornerRadiusStandard)
                        .fill(Color.backgroundSecondary)
                )
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: .cornerRadiusStandard)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: .cornerRadiusStandard)
                        .stroke(Color.borderSubtle, lineWidth: 1)
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
            RoundedRectangle(cornerRadius: .cornerRadiusStandard)
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
            RoundedRectangle(cornerRadius: .cornerRadiusStandard)
                .fill(Color.backgroundSecondary)
        )
    }
}

// MARK: - Preview
#Preview("Unified Item Detail Modal - Equipment") {
    UnifiedItemDetailModal(
        item: PlayerItem(
            id: "550e8400-e29b-41d4-a716-446655440000",
            baseType: "Magic Sword",
            itemTypeId: "550e8400-e29b-41d4-a716-446655440001",
            category: "weapon",
            level: 5,
            rarity: "epic",
            appliedMaterials: ["steel", "crystal"],
            isStyled: true,
            computedStats: ItemStats(
                atkPower: 0.45,
                atkAccuracy: 0.85,
                defPower: 0.12,
                defAccuracy: 0.60
            ),
            isEquipped: true,
            generatedImageUrl: nil,
            name: "Magic Sword",
            description: "A powerful magical sword"
        ),
        badges: [
            .level,
            .primary(label: "Rarity", color: Color.accent),
            .secondary(label: "Type", color: Color.textSecondary)
        ]
    ) {
        VStack(spacing: 12) {
            TextButton("Unequip Item") { }
        }
    }
    .modelContainer(for: Item.self, inMemory: true)
    .environmentObject(NavigationManager())
    .environment(AppState.shared)
}

#Preview("Unified Item Detail Modal - Inventory") {
    UnifiedItemDetailModal(
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
                        styleName: "Rustic",
                        statModifiers: StatModifier(atkPower: 5, atkAccuracy: 0, defPower: 0, defAccuracy: 0),
                        imageUrl: nil
                    )
                )
            ],
            materials: [],
            computedStats: ItemStats(
                atkPower: 0.45,
                atkAccuracy: 0.85,
                defPower: 0.12,
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
        badges: [
            .level,
            .primary(label: "Status", color: Color.textSecondary),
            .secondary(label: "Crafted", color: Color.warning)
        ]
    ) {
        VStack(spacing: 12) {
            TextButton("Equip Item") { }
        }
    }
    .modelContainer(for: Item.self, inMemory: true)
    .environmentObject(NavigationManager())
    .environment(AppState.shared)
}
