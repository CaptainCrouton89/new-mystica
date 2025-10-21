//
//  EquipmentView.swift
//  New-Mystica
//
//  Created by Claude Code
//

import SwiftUI
import SwiftData

// MARK: - Equipment Slot View Component
struct EquipmentSlotView: View {
    let slot: String
    let item: PlayerItem?
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            ZStack {
                // Slot background
                RoundedRectangle(cornerRadius: 12)
                    .fill(item != nil ? Color.backgroundCard : Color.backgroundSecondary)
                    .frame(width: 80, height: 80)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(item != nil ? getRarityColor() : Color.borderSubtle, lineWidth: 2)
                    )

                if let item = item {
                    // Equipped item
                    VStack(spacing: 4) {
                        AsyncImage(url: URL(string: item.imageUrl ?? "")) { phase in
                            switch phase {
                            case .empty:
                                ProgressView()
                                    .frame(width: 48, height: 48)
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fit)
                                    .frame(width: 48, height: 48)
                            case .failure:
                                Image(systemName: getSlotIcon())
                                    .font(.system(size: 24, weight: .medium))
                                    .foregroundColor(Color.textSecondary)
                                    .frame(width: 48, height: 48)
                            @unknown default:
                                EmptyView()
                            }
                        }
                    }
                } else {
                    // Empty slot placeholder
                    VStack(spacing: 4) {
                        Image(systemName: getSlotIcon())
                            .font(.system(size: 24, weight: .medium))
                            .foregroundColor(Color.borderSubtle)

                        SmallText(getSlotDisplayName())
                            .foregroundColor(Color.borderSubtle)
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                    }
                    .padding(.horizontal, 4)
                }
            }
        }
        .buttonStyle(PlainButtonStyle())
    }

    // MARK: - Helper Methods

    /// Get SF Symbol icon for the equipment slot
    private func getSlotIcon() -> String {
        switch slot {
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
        case "accessory_1", "accessory_2":
            return "ring.circle.fill"
        case "pet":
            return "pawprint.fill"
        default:
            return "questionmark.circle.fill"
        }
    }

    /// Get display name for the equipment slot
    private func getSlotDisplayName() -> String {
        switch slot {
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
            return "Accessory"
        case "accessory_2":
            return "Accessory"
        case "pet":
            return "Pet"
        default:
            return "Unknown"
        }
    }

    /// Get rarity color for equipped items
    private func getRarityColor() -> Color {
        guard let item = item,
              let itemType = item.itemType else {
            return Color.borderSubtle
        }

        switch itemType.rarity.lowercased() {
        case "common":
            return Color.borderSubtle
        case "rare", "legendary":
            return Color.accentSecondary // Neon blue
        case "epic":
            return Color.accent // Neon pink
        default:
            return Color.borderSubtle
        }
    }
}

// MARK: - Stats Display Component
struct StatsDisplayView: View {
    let totalStats: ItemStats
    let equipmentCount: Int

    var body: some View {
        VStack(spacing: 12) {
            // Title
            TitleText("Total Stats", size: 20)

            // Stats Grid - 2x2 layout
            VStack(spacing: 8) {
                // Attack Stats Row
                HStack(spacing: 20) {
                    StatItemView(
                        label: "ATK Power",
                        value: String(format: "%.0f", totalStats.atkPower),
                        color: Color.accent
                    )

                    StatItemView(
                        label: "ATK Accuracy",
                        value: String(format: "%.1f", totalStats.atkAccuracy),
                        color: Color.accent
                    )
                }

                // Defense Stats Row
                HStack(spacing: 20) {
                    StatItemView(
                        label: "DEF Power",
                        value: String(format: "%.0f", totalStats.defPower),
                        color: Color.accentSecondary
                    )

                    StatItemView(
                        label: "DEF Accuracy",
                        value: String(format: "%.1f", totalStats.defAccuracy),
                        color: Color.accentSecondary
                    )
                }
            }

            // Equipment Count
            NormalText("\(equipmentCount)/8 Equipped")
                .foregroundColor(Color.textPrimary)
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
}

// MARK: - Individual Stat Item Component
struct StatItemView: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            NormalText(label, size: 14)
                .foregroundColor(Color.textSecondary)

            NormalText(value, size: 18)
                .foregroundColor(color)
                .bold()
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Main Equipment View
struct EquipmentView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    @EnvironmentObject private var audioManager: AudioManager
    @StateObject private var equipmentService = EquipmentService.shared
    @State private var selectedItem: PlayerItem?

    var body: some View {
        BaseView(title: "Equipment") {
            ZStack {
                // Main content
                ScrollView {
                    VStack(spacing: 24) {
                        if equipmentService.isLoading {
                            // Loading State
                            loadingView
                        } else if let errorMessage = equipmentService.errorMessage {
                            // Error State
                            errorView(errorMessage)
                        } else {
                            // Content State
                            equipmentContentView
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 16)
                }

                // Item Detail Popup Overlay
                if let item = selectedItem {
                    itemDetailPopup(item: item)
                }
            }
        }
        .task {
            // Load equipment data when view appears
            try? await equipmentService.loadEquipment()
        }
    }

    // MARK: - Loading View
    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
                .progressViewStyle(CircularProgressViewStyle(tint: Color.accent))

            NormalText("Loading Equipment...")
                .foregroundColor(Color.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.top, 100)
    }

    // MARK: - Error View
    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
                .foregroundColor(Color.accentInteractive)

            TitleText("Error Loading Equipment")

            NormalText(message)
                .foregroundColor(Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 20)

            TextButton("Retry") {
                audioManager.playMenuButtonClick()
                Task {
                    try? await equipmentService.loadEquipment()
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.top, 60)
    }

    // MARK: - Equipment Content View
    private var equipmentContentView: some View {
        VStack(spacing: 24) {
            // Character-Centered Equipment Layout
            equipmentSlotsLayout

            // Stats Panel
            if let equipment = equipmentService.equipment {
                StatsDisplayView(
                    totalStats: equipment.totalStats,
                    equipmentCount: equipment.equipmentCount
                )
            }
        }
    }

    // MARK: - Equipment Slots Layout
    private var equipmentSlotsLayout: some View {
        let equipment = equipmentService.equipment

        return VStack(spacing: 20) {
            // Head slot (top)
            EquipmentSlotView(slot: "head", item: equipment?.slots.head) {
                audioManager.playMenuButtonClick()
                selectedItem = equipment?.slots.head
            }

            // Middle row: weapon, character silhouette, offhand
            HStack(spacing: 40) {
                // Left side slots
                VStack(spacing: 16) {
                    EquipmentSlotView(slot: "weapon", item: equipment?.slots.weapon) {
                        audioManager.playMenuButtonClick()
                        selectedItem = equipment?.slots.weapon
                    }

                    EquipmentSlotView(slot: "accessory_1", item: equipment?.slots.accessory1) {
                        audioManager.playMenuButtonClick()
                        selectedItem = equipment?.slots.accessory1
                    }
                }

                // Center character silhouette
                characterSilhouetteView

                // Right side slots
                VStack(spacing: 16) {
                    EquipmentSlotView(slot: "offhand", item: equipment?.slots.offhand) {
                        audioManager.playMenuButtonClick()
                        selectedItem = equipment?.slots.offhand
                    }

                    EquipmentSlotView(slot: "accessory_2", item: equipment?.slots.accessory2) {
                        audioManager.playMenuButtonClick()
                        selectedItem = equipment?.slots.accessory2
                    }
                }
            }

            // Bottom row: armor, feet
            HStack(spacing: 40) {
                EquipmentSlotView(slot: "armor", item: equipment?.slots.armor) {
                    audioManager.playMenuButtonClick()
                    selectedItem = equipment?.slots.armor
                }

                EquipmentSlotView(slot: "feet", item: equipment?.slots.feet) {
                    audioManager.playMenuButtonClick()
                    selectedItem = equipment?.slots.feet
                }
            }

            // Pet slot (bottom)
            HStack {
                EquipmentSlotView(slot: "pet", item: equipment?.slots.pet) {
                    audioManager.playMenuButtonClick()
                    selectedItem = equipment?.slots.pet
                }
                Spacer()
            }
        }
    }

    // MARK: - Character Silhouette View
    private var characterSilhouetteView: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundSecondary)
                .frame(width: 100, height: 140)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.borderSubtle, lineWidth: 2)
                )

            VStack(spacing: 8) {
                Image(systemName: "person.fill")
                    .font(.system(size: 48, weight: .light))
                    .foregroundColor(Color.borderSubtle)

                SmallText("Character")
                    .foregroundColor(Color.borderSubtle)
            }
        }
    }

    // MARK: - Item Detail Popup
    private func itemDetailPopup(item: PlayerItem) -> some View {
        ZStack {
            // Background overlay
            Color.black.opacity(0.6)
                .edgesIgnoringSafeArea(.all)
                .onTapGesture {
                    audioManager.playMenuButtonClick()
                    selectedItem = nil
                }

            // Popup content
            VStack(spacing: 16) {
                // Item name and level
                VStack(spacing: 4) {
                    TitleText(item.itemType?.name ?? "Unknown Item")
                        .foregroundColor(Color.textPrimary)

                    NormalText("Level \(item.level)")
                        .foregroundColor(Color.textSecondary)
                }

                // Item image (if available)
                AsyncImage(url: URL(string: item.imageUrl ?? "")) { phase in
                    switch phase {
                    case .empty:
                        ProgressView()
                            .frame(width: 80, height: 80)
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: 80, height: 80)
                    case .failure:
                        Image(systemName: "photo.fill")
                            .font(.system(size: 40))
                            .foregroundColor(Color.textSecondary)
                            .frame(width: 80, height: 80)
                    @unknown default:
                        EmptyView()
                    }
                }

                // Item stats
                VStack(spacing: 8) {
                    TitleText("Stats", size: 18)
                        .foregroundColor(Color.textPrimary)

                    VStack(spacing: 4) {
                        HStack {
                            NormalText("ATK Power:")
                                .foregroundColor(Color.textSecondary)
                            Spacer()
                            NormalText(String(format: "%.0f", item.currentStats.atkPower))
                                .foregroundColor(Color.accent)
                                .bold()
                        }

                        HStack {
                            NormalText("ATK Accuracy:")
                                .foregroundColor(Color.textSecondary)
                            Spacer()
                            NormalText(String(format: "%.1f", item.currentStats.atkAccuracy))
                                    .foregroundColor(Color.accent)
                                    .bold()
                            }

                        HStack {
                            NormalText("DEF Power:")
                                .foregroundColor(Color.textSecondary)
                            Spacer()
                            NormalText(String(format: "%.0f", item.currentStats.defPower))
                                .foregroundColor(Color.accentSecondary)
                                .bold()
                        }

                        HStack {
                            NormalText("DEF Accuracy:")
                                .foregroundColor(Color.textSecondary)
                            Spacer()
                            NormalText(String(format: "%.1f", item.currentStats.defAccuracy))
                                .foregroundColor(Color.accentSecondary)
                                .bold()
                        }
                    }
                    .padding(.horizontal, 16)
                }

                // Item description (if available)
                if let description = item.itemType?.description, !description.isEmpty {
                    VStack(spacing: 4) {
                        TitleText("Description", size: 18)
                            .foregroundColor(Color.textPrimary)

                        NormalText(description)
                            .foregroundColor(Color.textSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 16)
                    }
                }

                // Close button
                TextButton("Close") {
                    audioManager.playMenuButtonClick()
                    selectedItem = nil
                }
                .padding(.top, 8)
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
}

// MARK: - Preview
#Preview("Equipment View") {
    EquipmentView()
        .modelContainer(for: Item.self, inMemory: true)
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
}

#Preview("Individual Components") {
    VStack(spacing: 20) {
        // Empty slot example
        EquipmentSlotView(slot: "weapon", item: nil) {
            print("Tapped empty weapon slot")
        }

        // Equipped item example (mock data)
        EquipmentSlotView(slot: "weapon", item: mockPlayerItem) {
            print("Tapped equipped weapon")
        }

        // Stats display example
        StatsDisplayView(
            totalStats: ItemStats(
                atkPower: 45.0,
                atkAccuracy: 85.5,
                defPower: 32.0,
                defAccuracy: 78.2
            ),
            equipmentCount: 5
        )
    }
    .padding()
    .background(Color.backgroundPrimary)
    .modelContainer(for: Item.self, inMemory: true)
    .environmentObject(NavigationManager())
}

// MARK: - Mock Data for Preview
private let mockPlayerItem = PlayerItem(
    id: UUID(),
    userId: UUID(),
    itemTypeId: UUID(),
    level: 5,
    baseStats: ItemStats(atkPower: 10, atkAccuracy: 8, defPower: 5, defAccuracy: 6),
    currentStats: ItemStats(atkPower: 50, atkAccuracy: 40, defPower: 25, defAccuracy: 30),
    materialComboHash: "abc123",
    imageUrl: "https://example.com/sword.png",
    itemType: ItemType(
        id: UUID(),
        name: "Magic Sword",
        category: "weapon",
        equipmentSlot: "weapon",
        baseStats: ItemStats(atkPower: 10, atkAccuracy: 8, defPower: 5, defAccuracy: 6),
        rarity: "epic",
        imageUrl: "https://example.com/sword.png",
        description: "A magical sword that glows with power"
    ),
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z"
)