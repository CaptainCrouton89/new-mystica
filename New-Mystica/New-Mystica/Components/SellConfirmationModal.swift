//
//  SellConfirmationModal.swift
//  New-Mystica
//
//  Confirmation modal for selling inventory items
//

import SwiftUI

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
                            RoundedRectangle(cornerRadius: .cornerRadiusSmall)
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
                        RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                            .fill(Color.backgroundSecondary)
                            .overlay(
                                RoundedRectangle(cornerRadius: .cornerRadiusLarge)
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
                            RoundedRectangle(cornerRadius: .cornerRadiusSmall)
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
                RoundedRectangle(cornerRadius: .cornerRadiusExtraLarge)
                    .fill(Color.backgroundCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: .cornerRadiusExtraLarge)
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

// MARK: - Preview
#Preview {
    ZStack {
        Color.backgroundPrimary.ignoresSafeArea()

        SellConfirmationModal(
            item: EnhancedPlayerItem(
                id: "550e8400-e29b-41d4-a716-446655440000",
                baseType: "Magic Sword",
                itemTypeId: "550e8400-e29b-41d4-a716-446655440001",
                category: "weapon",
                level: 5,
                rarity: "rare",
                appliedMaterials: [],
                materials: [],
                computedStats: ItemStats(
                    atkPower: 45.0,
                    atkAccuracy: 0.85,
                    defPower: 12.0,
                    defAccuracy: 0.60
                ),
                materialComboHash: nil,
                generatedImageUrl: nil,
                imageGenerationStatus: .complete,
                craftCount: 0,
                isStyled: false,
                isEquipped: false,
                equippedSlot: nil
            ),
            sellValue: 50,
            isLoading: false,
            onConfirm: { print("Sell confirmed") },
            onCancel: { print("Sell cancelled") }
        )
    }
    .environmentObject(AudioManager.shared)
}
