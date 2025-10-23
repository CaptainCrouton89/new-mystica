//
//  ItemSelectionDrawer.swift
//  New-Mystica
//
//  Specialized bottom drawer for equipment item selection
//  Filters items by target slot type and handles equipment actions
//

import SwiftUI
import SwiftData

// MARK: - Item Selection Drawer Content (for use inside bottomDrawer)
struct ItemSelectionDrawerContent: View {
    let targetSlot: EquipmentSlot
    let availableItems: [EnhancedPlayerItem]
    let onItemSelected: (EnhancedPlayerItem) -> Void

    @State private var selectedItem: EnhancedPlayerItem?
    @State private var showConfirmation = false
    @Environment(\.audioManager) private var audioManager

    // Filter items that can be equipped in the target slot
    private var filteredItems: [EnhancedPlayerItem] {
        availableItems.filter { item in
            // Convert baseType to equipment slot comparison
            let itemSlot = getSlotForItemType(item.baseType)
            return itemSlot == targetSlot && !item.isEquipped
        }
    }

    var body: some View {
        VStack(spacing: 16) {
            if filteredItems.isEmpty {
                // Empty state
                VStack(spacing: 16) {
                    Image(systemName: "tray")
                        .font(.system(size: 48, weight: .light))
                        .foregroundColor(Color.textSecondary)

                    NormalText("No available \(targetSlot.displayName.lowercased()) items to equip.")
                        .multilineTextAlignment(.center)
                }
                .frame(maxHeight: .infinity)
            } else {
                // Items list
                ScrollView {
                    LazyVGrid(
                        columns: [
                            GridItem(.adaptive(minimum: 280), spacing: 12)
                        ],
                        spacing: 12
                    ) {
                        ForEach(filteredItems, id: \.id) { item in
                            ItemSelectionCard(
                                item: item,
                                isSelected: selectedItem?.id == item.id
                            ) {
                                selectItem(item)
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                }
            }

            // Action buttons (only show if item is selected)
            if selectedItem != nil {
                HStack(spacing: 12) {
                    TextButton("Cancel") {
                        audioManager.playCancelClick()
                        selectedItem = nil
                    }

                    TextButton("Equip Item") {
                        audioManager.playBattleClick()
                        showConfirmation = true
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 16)
            }
        }
        .confirmationDialog(
            "Equip Item",
            isPresented: $showConfirmation,
            titleVisibility: .visible
        ) {
            Button("Equip") {
                if let item = selectedItem {
                    onItemSelected(item)
                    selectedItem = nil
                }
            }

            Button("Cancel", role: .cancel) {
                // Do nothing, just dismiss
            }
        } message: {
            if let item = selectedItem {
                Text("Equip \(getDisplayName(for: item))?")
            }
        }
    }

    private func selectItem(_ item: EnhancedPlayerItem) {
        audioManager.playMenuButtonClick()
        withAnimation(.easeInOut(duration: 0.2)) {
            selectedItem = selectedItem?.id == item.id ? nil : item
        }
    }

    // Helper functions
    private func getSlotForItemType(_ baseType: String) -> EquipmentSlot {
        // Map base item types to equipment slots
        // This mapping should match your backend logic
        switch baseType.lowercased() {
        case "sword", "staff", "bow", "wand":
            return .weapon
        case "shield", "tome":
            return .offhand
        case "helm", "crown", "hat":
            return .head
        case "armor", "robe", "chainmail":
            return .armor
        case "boots", "sandals", "shoes":
            return .feet
        case "ring", "amulet", "bracelet":
            return .accessory_1 // Could be accessory_1 or accessory_2
        case "pet":
            return .pet
        default:
            return .weapon // Default fallback
        }
    }

    private func getDisplayName(for item: EnhancedPlayerItem) -> String {
        // Format: "Level X BaseType" or just "BaseType" if level 1
        if item.level > 1 {
            return "Level \(item.level) \(item.baseType.capitalized)"
        } else {
            return item.baseType.capitalized
        }
    }
}

// MARK: - Item Selection Drawer (legacy - wraps content in BottomDrawerSheet)
struct ItemSelectionDrawer: View {
    let title: String
    let targetSlot: EquipmentSlot
    let availableItems: [EnhancedPlayerItem]
    let isPresented: Binding<Bool>
    let onItemSelected: (EnhancedPlayerItem) -> Void
    let onDismiss: (() -> Void)?

    init(
        title: String = "Select Equipment",
        targetSlot: EquipmentSlot,
        availableItems: [EnhancedPlayerItem],
        isPresented: Binding<Bool>,
        onItemSelected: @escaping (EnhancedPlayerItem) -> Void,
        onDismiss: (() -> Void)? = nil
    ) {
        self.title = title
        self.targetSlot = targetSlot
        self.availableItems = availableItems
        self.isPresented = isPresented
        self.onItemSelected = onItemSelected
        self.onDismiss = onDismiss
    }

    var body: some View {
        BottomDrawerSheet(
            title: "\(title) - \(targetSlot.displayName)",
            isPresented: isPresented,
            onDismiss: onDismiss
        ) {
            ItemSelectionDrawerContent(
                targetSlot: targetSlot,
                availableItems: availableItems,
                onItemSelected: onItemSelected
            )
        }
    }
}

// MARK: - Item Selection Card
private struct ItemSelectionCard: View {
    let item: EnhancedPlayerItem
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Item image
                Group {
                    if let imageUrl = item.generatedImageUrl, let url = URL(string: imageUrl) {
                        AsyncImage(url: url) { phase in
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
                                ZStack {
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(getRarityColor())
                                        .frame(width: 48, height: 48)

                                    Image(systemName: getIconForItemType(item.baseType))
                                        .font(.system(size: 20, weight: .medium))
                                        .foregroundColor(Color.textPrimary)
                                }
                            @unknown default:
                                EmptyView()
                            }
                        }
                    } else {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(getRarityColor())
                                .frame(width: 48, height: 48)

                            Image(systemName: getIconForItemType(item.baseType))
                                .font(.system(size: 20, weight: .medium))
                                .foregroundColor(Color.textPrimary)
                        }
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 8))

                // Item details
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(getDisplayName())
                            .font(FontManager.body)
                            .foregroundColor(Color.textPrimary)

                        Spacer()

                        if item.isStyled {
                            Text("Styled")
                                .font(FontManager.caption)
                                .foregroundColor(Color.accentSecondary)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(Color.accentSecondary.opacity(0.2))
                                )
                        }
                    }

                    // Stats summary
                    HStack(spacing: 8) {
                        if item.computedStats.atkPower > 0 {
                            StatBadge(
                                icon: "sword.fill",
                                value: String(format: "%.1f", item.computedStats.atkPower),
                                color: Color.alert
                            )
                        }
                        if item.computedStats.defPower > 0 {
                            StatBadge(
                                icon: "shield.fill",
                                value: String(format: "%.1f", item.computedStats.defPower),
                                color: Color.accentSecondary
                            )
                        }
                        if item.computedStats.atkAccuracy > 0 {
                            StatBadge(
                                icon: "target",
                                value: String(format: "%.0f%%", item.computedStats.atkAccuracy * 100),
                                color: Color.warning
                            )
                        }

                        Spacer()
                    }
                }

                // Selection indicator
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundColor(Color.success)
                }
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isSelected ? Color.accentSecondary.opacity(0.1) : Color.backgroundCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(
                                isSelected ? Color.accentSecondary : Color.borderSubtle,
                                lineWidth: isSelected ? 2 : 1
                            )
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
    }

    private func getDisplayName() -> String {
        if item.level > 1 {
            return "Level \(item.level) \(item.baseType.capitalized)"
        } else {
            return item.baseType.capitalized
        }
    }

    private func getRarityColor() -> Color {
        // Based on level for now, could be enhanced with actual rarity
        switch item.level {
        case 1...5:
            return Color.borderSubtle
        case 6...10:
            return Color.accentSecondary
        case 11...20:
            return Color.accent
        default:
            return Color.warning
        }
    }

    private func getIconForItemType(_ baseType: String) -> String {
        switch baseType.lowercased() {
        case "sword":
            return "sword.fill"
        case "staff", "wand":
            return "wand.and.stars"
        case "bow":
            return "arrow.up.right"
        case "shield":
            return "shield.fill"
        case "tome":
            return "book.fill"
        case "helm", "crown", "hat":
            return "crown.fill"
        case "armor", "robe", "chainmail":
            return "tshirt.fill"
        case "boots", "sandals", "shoes":
            return "shoe.fill"
        case "ring", "amulet", "bracelet":
            return "circle.fill"
        case "pet":
            return "pawprint.fill"
        default:
            return "questionmark.circle"
        }
    }
}

// MARK: - Stat Badge Helper
private struct StatBadge: View {
    let icon: String
    let value: String
    let color: Color

    var body: some View {
        HStack(spacing: 2) {
            Image(systemName: icon)
                .font(.system(size: 10))
            Text(value)
                .font(FontManager.caption)
        }
        .foregroundColor(color)
    }
}

// MARK: - Equipment Slot Display Name Extension
extension EquipmentSlot {
    var displayName: String {
        switch self {
        case .weapon:
            return "Weapon"
        case .offhand:
            return "Offhand"
        case .head:
            return "Head"
        case .armor:
            return "Armor"
        case .feet:
            return "Feet"
        case .accessory_1:
            return "Accessory"
        case .accessory_2:
            return "Accessory"
        case .pet:
            return "Pet"
        }
    }
}

#Preview {
    ZStack {
        Color.backgroundPrimary.ignoresSafeArea()

        VStack {
            TextButton("Show Item Selection") {
                // Preview will show static drawer
            }
        }
    }
    .bottomDrawer(
        title: "Item Selection Preview",
        isPresented: .constant(true)
    ) {
        ItemSelectionDrawer(
            targetSlot: .weapon,
            availableItems: [
                // Mock items for preview
                EnhancedPlayerItem(
                    id: "1",
                    baseType: "sword",
                    level: 5,
                    appliedMaterials: [],
                    computedStats: ItemStats(atkPower: 25.0, atkAccuracy: 0.85, defPower: 0.0, defAccuracy: 0.0),
                    materialComboHash: nil,
                    generatedImageUrl: nil,
                    imageGenerationStatus: .complete,
                    craftCount: 1,
                    isStyled: true,
                    isEquipped: false,
                    equippedSlot: nil
                ),
                EnhancedPlayerItem(
                    id: "2",
                    baseType: "staff",
                    level: 3,
                    appliedMaterials: [],
                    computedStats: ItemStats(atkPower: 15.0, atkAccuracy: 0.90, defPower: 5.0, defAccuracy: 0.75),
                    materialComboHash: nil,
                    generatedImageUrl: nil,
                    imageGenerationStatus: .complete,
                    craftCount: 1,
                    isStyled: false,
                    isEquipped: false,
                    equippedSlot: nil
                )
            ],
            isPresented: .constant(true),
            onItemSelected: { item in
                print("Selected item: \(item.baseType)")
            }
        )
    }
    .modelContainer(for: Item.self, inMemory: true)
    .environmentObject(NavigationManager())
    .environment(AppState.shared)
}