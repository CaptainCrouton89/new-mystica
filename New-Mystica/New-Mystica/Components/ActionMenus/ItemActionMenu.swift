//
//  ItemActionMenu.swift
//  New-Mystica
//
//  Four-action item menu component for inventory items
//  Provides Equip, Craft, Upgrade, and Sell actions with proper navigation
//

import SwiftUI

// MARK: - Item Action Menu Component
struct ItemActionMenu: View {
    let item: EnhancedPlayerItem
    let onEquip: () -> Void
    let onCraft: () -> Void
    let onUpgrade: () -> Void
    let onSell: () -> Void
    let onDismiss: () -> Void
    let isNavigatingToCraft: Bool
    let isNavigatingToUpgrade: Bool

    @Environment(\.audioManager) private var audioManager

    init(
        item: EnhancedPlayerItem,
        onEquip: @escaping () -> Void,
        onCraft: @escaping () -> Void,
        onUpgrade: @escaping () -> Void,
        onSell: @escaping () -> Void,
        onDismiss: @escaping () -> Void,
        isNavigatingToCraft: Bool = false,
        isNavigatingToUpgrade: Bool = false
    ) {
        self.item = item
        self.onEquip = onEquip
        self.onCraft = onCraft
        self.onUpgrade = onUpgrade
        self.onSell = onSell
        self.onDismiss = onDismiss
        self.isNavigatingToCraft = isNavigatingToCraft
        self.isNavigatingToUpgrade = isNavigatingToUpgrade
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView

            // Action buttons
            VStack(spacing: 0) {
                actionButton(
                    icon: "shield.fill",
                    title: "Equip",
                    subtitle: getEquipSubtitle(),
                    color: Color.accent,
                    isEnabled: !item.isEquipped,
                    action: {
                        audioManager.playMenuButtonClick()
                        onEquip()
                    }
                )

                Divider()
                    .background(Color.borderSubtle)

                actionButton(
                    icon: "hammer.fill",
                    title: "Craft",
                    subtitle: isNavigatingToCraft ? "Opening..." : "Apply materials to upgrade",
                    color: Color.warning,
                    isEnabled: item.appliedMaterials.count < 3 && !isNavigatingToCraft,
                    isLoading: isNavigatingToCraft,
                    action: {
                        audioManager.playMenuButtonClick()
                        onCraft()
                    }
                )

                Divider()
                    .background(Color.borderSubtle)

                actionButton(
                    icon: "arrow.up.circle.fill",
                    title: "Upgrade",
                    subtitle: isNavigatingToUpgrade ? "Opening..." : "Increase item level",
                    color: Color.accentSecondary,
                    isEnabled: !isNavigatingToUpgrade,
                    isLoading: isNavigatingToUpgrade,
                    action: {
                        audioManager.playMenuButtonClick()
                        onUpgrade()
                    }
                )

                Divider()
                    .background(Color.borderSubtle)

                actionButton(
                    icon: "dollarsign.circle.fill",
                    title: "Sell",
                    subtitle: "Sell for \(calculateSellValue()) gold",
                    color: Color.alert,
                    isEnabled: !item.isEquipped,
                    action: {
                        audioManager.playMenuButtonClick()
                        onSell()
                    }
                )
            }

            // Cancel button
            Button(action: {
                audioManager.playCancelClick()
                onDismiss()
            }) {
                Text("Cancel")
                    .font(FontManager.body)
                    .foregroundColor(Color.textSecondary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.backgroundSecondary)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
        .shadow(color: Color.black.opacity(0.3), radius: 20, x: 0, y: 10)
    }

    // MARK: - Header View

    private var headerView: some View {
        VStack(spacing: 8) {
            // Item icon
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(getRarityColor())
                    .frame(width: 60, height: 60)

                Image(systemName: getItemIcon())
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(Color.textPrimary)
            }

            // Item details
            VStack(spacing: 4) {
                Text(item.baseType.capitalized)
                    .font(FontManager.body)
                    .foregroundColor(Color.textPrimary)

                HStack(spacing: 8) {
                    Text("Level \(item.level)")
                        .font(FontManager.caption)
                        .foregroundColor(Color.textSecondary)

                    if item.isStyled {
                        Text("• Styled")
                            .font(FontManager.caption)
                            .foregroundColor(Color.accent)
                    }

                    if item.isEquipped {
                        Text("• Equipped")
                            .font(FontManager.caption)
                            .foregroundColor(Color.accent)
                    }
                }
            }
        }
        .padding(.vertical, 16)
        .padding(.horizontal, 20)
        .background(Color.backgroundCard)
    }

    // MARK: - Action Button

    private func actionButton(
        icon: String,
        title: String,
        subtitle: String,
        color: Color,
        isEnabled: Bool,
        isLoading: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                // Icon or Loading Spinner
                if isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                        .tint(color)
                        .frame(width: 24, height: 24)
                } else {
                    Image(systemName: icon)
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(isEnabled ? color : Color.textSecondary)
                        .frame(width: 24, height: 24)
                }

                // Text content
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(FontManager.body)
                        .foregroundColor(isEnabled ? Color.textPrimary : Color.textSecondary)

                    Text(subtitle)
                        .font(FontManager.caption)
                        .foregroundColor(Color.textSecondary)
                }

                Spacer()

                // Chevron
                if isEnabled {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(Color.borderSubtle)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .background(isEnabled ? Color.backgroundCard : Color.backgroundCard.opacity(0.5))
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(!isEnabled)
    }

    // MARK: - Helper Methods

    private func getEquipSubtitle() -> String {
        if item.isEquipped {
            return "Already equipped"
        } else {
            let slot = getSlotForItemType(item.baseType)
            return "Equip to \(slot.displayName.lowercased()) slot"
        }
    }

    private func calculateSellValue() -> Int {
        // Basic sell value calculation based on level and styling
        let baseValue = item.level * 10
        let styledBonus = item.isStyled ? (item.appliedMaterials.count * 15) : 0
        return baseValue + styledBonus
    }

    private func getRarityColor() -> Color {
        // Match the rarity color system from ItemRow
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

    private func getSlotForItemType(_ baseType: String) -> EquipmentSlot {
        // Map base item types to equipment slots
        switch baseType.lowercased() {
        case let type where type.contains("sword") || type.contains("staff") || type.contains("bow") || type.contains("wand"):
            return .weapon
        case let type where type.contains("shield") || type.contains("tome"):
            return .offhand
        case let type where type.contains("helm") || type.contains("crown") || type.contains("hat"):
            return .head
        case let type where type.contains("armor") || type.contains("robe") || type.contains("chainmail"):
            return .armor
        case let type where type.contains("boots") || type.contains("sandals") || type.contains("shoes"):
            return .feet
        case let type where type.contains("ring") || type.contains("amulet") || type.contains("bracelet"):
            return .accessory_1
        case let type where type.contains("pet"):
            return .pet
        default:
            return .weapon // Default fallback
        }
    }
}

// MARK: - Sell Confirmation Modal
struct SellConfirmationModal: View {
    let item: EnhancedPlayerItem
    let sellValue: Int
    let isLoading: Bool
    let onConfirm: () -> Void
    let onCancel: () -> Void

    @Environment(\.audioManager) private var audioManager

    init(
        item: EnhancedPlayerItem,
        sellValue: Int,
        isLoading: Bool = false,
        onConfirm: @escaping () -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.item = item
        self.sellValue = sellValue
        self.isLoading = isLoading
        self.onConfirm = onConfirm
        self.onCancel = onCancel
    }

    var body: some View {
        ZStack {
            // Background overlay
            Color.black.opacity(0.6)
                .edgesIgnoringSafeArea(.all)
                .onTapGesture {
                    audioManager.playCancelClick()
                    onCancel()
                }

            // Modal content
            VStack(spacing: 24) {
                // Header
                VStack(spacing: 8) {
                    Image(systemName: "dollarsign.circle.fill")
                        .font(.system(size: 48, weight: .medium))
                        .foregroundColor(Color.warning)

                    TitleText("Sell Item", size: 24)
                        .foregroundColor(Color.textPrimary)
                }

                // Item details
                VStack(spacing: 12) {
                    Text("Are you sure you want to sell this item?")
                        .font(FontManager.body)
                        .foregroundColor(Color.textSecondary)
                        .multilineTextAlignment(.center)

                    // Item info
                    HStack(spacing: 12) {
                        // Item icon
                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.backgroundSecondary)
                                .frame(width: 40, height: 40)

                            Image(systemName: getItemIcon())
                                .font(.system(size: 20, weight: .medium))
                                .foregroundColor(Color.textPrimary)
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.baseType.capitalized)
                                .font(FontManager.body)
                                .foregroundColor(Color.textPrimary)

                            Text("Level \(item.level)")
                                .font(FontManager.caption)
                                .foregroundColor(Color.textSecondary)
                        }

                        Spacer()
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.backgroundSecondary)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.borderSubtle, lineWidth: 1)
                            )
                    )
                }

                // Sell value
                VStack(spacing: 8) {
                    Text("You will receive:")
                        .font(FontManager.body)
                        .foregroundColor(Color.textSecondary)

                    HStack(spacing: 8) {
                        Image(systemName: "dollarsign.circle.fill")
                            .font(.system(size: 20, weight: .medium))
                            .foregroundColor(Color.warning)

                        Text("\(sellValue)")
                            .font(FontManager.body)
                            .foregroundColor(Color.warning)

                        Text("Gold")
                            .font(FontManager.body)
                            .foregroundColor(Color.textSecondary)
                    }
                }

                // Warning
                if item.isStyled || item.level >= 5 {
                    Text("⚠️ This item cannot be recovered once sold")
                        .font(FontManager.caption)
                        .foregroundColor(Color.alert)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 8)
                }

                // Action buttons
                HStack(spacing: 12) {
                    TextButton("Cancel", height: 44) {
                        if !isLoading {
                            audioManager.playCancelClick()
                            onCancel()
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .disabled(isLoading)

                    // Sell button with loading state
                    if isLoading {
                        HStack(spacing: 8) {
                            ProgressView()
                                .scaleEffect(0.8)
                                .tint(Color.textPrimary)

                            Text("Selling...")
                                .font(FontManager.body)
                                .foregroundColor(Color.textPrimary)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.accent.opacity(0.6))
                        )
                    } else {
                        TextButton("Sell Item", height: 44) {
                            audioManager.playMenuButtonClick()
                            onConfirm()
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
            .padding(24)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.backgroundCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.borderSubtle, lineWidth: 1)
                    )
            )
            .shadow(color: Color.black.opacity(0.3), radius: 20, x: 0, y: 10)
            .padding(.horizontal, 40)
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

// MARK: - Preview
#Preview {
    ZStack {
        Color.backgroundPrimary.ignoresSafeArea()

        VStack {
            ItemActionMenu(
                item: mockEnhancedPlayerItem,
                onEquip: { print("Equip tapped") },
                onCraft: { print("Craft tapped") },
                onUpgrade: { print("Upgrade tapped") },
                onSell: { print("Sell tapped") },
                onDismiss: { print("Dismiss tapped") }
            )
            .padding(.horizontal, 20)
        }
    }
    .environmentObject(AudioManager.shared)
}

// MARK: - Mock Data for Preview
private let mockEnhancedPlayerItem = EnhancedPlayerItem(
    id: "mock-item-1",
    baseType: "iron_sword",
    level: 5,
    appliedMaterials: [
        ItemMaterialApplication(materialId: "wood", styleId: "rustic", slotIndex: 0)
    ],
    computedStats: ItemStats(atkPower: 25, atkAccuracy: 15, defPower: 5, defAccuracy: 8),
    materialComboHash: "abc123",
    generatedImageUrl: nil,
    imageGenerationStatus: .complete,
    craftCount: 1,
    isStyled: true,
    isEquipped: false,
    equippedSlot: nil
)