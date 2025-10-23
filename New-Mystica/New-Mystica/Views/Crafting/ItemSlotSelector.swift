//
//  ItemSlotSelector.swift
//  New-Mystica
//
//  ItemSlotSelector component for US-401 Crafting Materials onto Items
//  Displays either empty state or selected item with rarity-colored borders
//

import SwiftUI
import SwiftData

struct ItemSlotSelector: View {
    let selectedItem: EnhancedPlayerItem?
    let onTap: () -> Void

    var body: some View {
        SelectionSlotButton(isFilled: selectedItem != nil, onTap: onTap) {
            if let item = selectedItem {
                filledStateContent(item: item)
            } else {
                emptyStateContent
            }
        }
    }

    // MARK: - Empty State

    private var emptyStateContent: some View {
        VStack(spacing: 12) {
            // Plus icon placeholder
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.backgroundSecondary)
                    .frame(width: 80, height: 80)

                Image(systemName: "plus")
                    .font(.system(size: 32, weight: .medium))
                    .foregroundColor(Color.textSecondary)
            }
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.borderSubtle, lineWidth: 2)
                    .opacity(0.6)
            )

            // Select text
            VStack(spacing: 4) {
                NormalText("+ Select Item")
                    .foregroundColor(Color.textSecondary)
                    .font(FontManager.body)

                SmallText("Tap to choose")
                    .foregroundColor(Color.textSecondary.opacity(0.7))
            }
        }
    }

    // MARK: - Filled State

    private func filledStateContent(item: EnhancedPlayerItem) -> some View {
        VStack(spacing: 8) {
            // Item Image
            Group {
                if let imageUrl = item.generatedImageUrl, let url = URL(string: imageUrl) {
                    CachedAsyncImage(
                        url: url,
                        content: { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(width: 80, height: 80)
                        },
                        placeholder: {
                            ProgressView()
                                .frame(width: 80, height: 80)
                        }
                    )
                } else {
                    fallbackIcon(for: item)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(rarityBorderColor(for: item), lineWidth: 3)
            )

            // Item Details
            VStack(spacing: 2) {
                // Item Name
                NormalText(item.baseType.capitalized)
                    .font(FontManager.body)
                    .foregroundColor(Color.textPrimary)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.8)

                // Item Level
                SmallText("Lv. \(item.level)")
                    .font(FontManager.caption)
                    .foregroundColor(Color.textSecondary)
            }
        }
    }

    // MARK: - Helper Views

    private func fallbackIcon(for item: EnhancedPlayerItem) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundSecondary)
                .frame(width: 80, height: 80)

            Image(systemName: getItemIcon(for: item))
                .font(.system(size: 32, weight: .medium))
                .foregroundColor(Color.textSecondary)
        }
    }

    // MARK: - Helper Methods

    private func getItemIcon(for item: EnhancedPlayerItem) -> String {
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

    private func rarityBorderColor(for item: EnhancedPlayerItem) -> Color {
        // Rarity mapping based on agent_292442:18-27 design system
        // Since EnhancedPlayerItem doesn't have rarity property, derive from level and styling
        if item.isEquipped {
            return Color.accent // epic/pink for equipped items
        } else if item.isStyled {
            return Color.accentSecondary // legendary/cyan for styled items
        } else if item.level >= 10 {
            return Color.orange // rare/orange for high level
        } else if item.level >= 5 {
            return Color.blue // uncommon/blue for mid level
        } else {
            return Color.borderSubtle // common/grey for low level
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 24) {
        // Empty state
        ItemSlotSelector(selectedItem: nil, onTap: {})

        // Filled state with mock item
        ItemSlotSelector(
            selectedItem: EnhancedPlayerItem(
                id: "preview",
                baseType: "iron_sword",
                itemTypeId: "type-1",
                category: "weapon",
                level: 7,
                rarity: "rare",
                appliedMaterials: [],
                materials: [],
                computedStats: ItemStats(atkPower: 25, atkAccuracy: 15, defPower: 5, defAccuracy: 8),
                materialComboHash: nil,
                generatedImageUrl: nil,
                imageGenerationStatus: nil,
                craftCount: 0,
                isStyled: false,
                isEquipped: false,
                equippedSlot: nil
            ),
            onTap: {}
        )

        // Filled state with epic item (equipped)
        ItemSlotSelector(
            selectedItem: EnhancedPlayerItem(
                id: "preview_epic",
                baseType: "legendary_armor",
                itemTypeId: "type-2",
                category: "armor",
                level: 15,
                rarity: "legendary",
                appliedMaterials: [],
                materials: [],
                computedStats: ItemStats(atkPower: 10, atkAccuracy: 20, defPower: 55, defAccuracy: 35),
                materialComboHash: nil,
                generatedImageUrl: nil,
                imageGenerationStatus: nil,
                craftCount: 5,
                isStyled: true,
                isEquipped: true,
                equippedSlot: "armor"
            ),
            onTap: {}
        )
    }
    .padding()
    .background(Color.backgroundPrimary)
    .modelContainer(for: Item.self, inMemory: true)
    .environmentObject(NavigationManager())
}