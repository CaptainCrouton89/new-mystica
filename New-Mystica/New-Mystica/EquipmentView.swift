import SwiftUI
import SwiftData

// MARK: - Equipment Slot View Component
struct EquipmentSlotView: View {
    let slot: String
    let item: PlayerItem?
    let onTap: (PlayerItem?) -> Void

    var body: some View {
        Button {
            onTap(item)
        } label: {
            ZStack {
                // Slot background
                RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                    .fill(item != nil ? Color.backgroundCard : Color.backgroundSecondary)
                    .frame(width: 80, height: 80)
                    .overlay(
                        RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                            .stroke(item != nil ? Color.accentSecondary : Color.borderSubtle, lineWidth: 2)
                    )

                if let item = item, let imageUrl = item.generatedImageUrl, !imageUrl.isEmpty {
                    // Equipped item with valid image URL
                    CachedAsyncImage(
                        url: URL(string: imageUrl),
                        content: { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 80, height: 80)
                                .clipShape(RoundedRectangle(cornerRadius: .cornerRadiusLarge))
                        },
                        placeholder: {
                            ProgressView()
                                .frame(width: 80, height: 80)
                        }
                    )
                } else {
                    // Empty slot placeholder
                    VStack(spacing: 4) {
                        Image(systemName: getSlotIcon())
                            .font(.system(size: 24, weight: .medium))
                            .foregroundColor(Color.borderSubtle)
                        SmallText(getSlotDisplayName(), size: 11)
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
            return "hammer.fill"
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

}

// MARK: - Stats Display Component
struct StatsDisplayView: View {
    let totalStats: ItemStats

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
                        value: String(format: "%.0f", totalStats.atkPower * 100),
                        color: Color.accent
                    )

                    StatItemView(
                        label: "ATK Accuracy",
                        value: String(format: "%.0f", totalStats.atkAccuracy * 100),
                        color: Color.accent
                    )
                }

                // Defense Stats Row
                HStack(spacing: 20) {
                    StatItemView(
                        label: "DEF Power",
                        value: String(format: "%.0f", totalStats.defPower * 100),
                        color: Color.accentSecondary
                    )

                    StatItemView(
                        label: "DEF Accuracy",
                        value: String(format: "%.0f", totalStats.defAccuracy * 100),
                        color: Color.accentSecondary
                    )
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: .cornerRadiusLarge)
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
    @Environment(\.navigationManager) private var navigationManager
    @Environment(\.audioManager) private var audioManager
    @Environment(AppState.self) private var appState
    @State private var viewModel: EquipmentViewModel

    init() {
        let inventoryVM = InventoryViewModel()
        _viewModel = State(initialValue: EquipmentViewModel(inventoryViewModel: inventoryVM))
    }

    var body: some View {
        BaseView(title: "Equipment") {
            LoadableView(viewModel.equipment) { equipment in
                ScrollView {
                    VStack(spacing: 24) {
                        equipmentContentView(equipment: equipment)
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 16)
                }
            } retry: {
                Task {
                    await viewModel.fetchEquipment()
                }
            }
        }
        .bottomDrawer(
            title: "Select Equipment",
            isPresented: $viewModel.showingItemSelectionDrawer
        ) {
            drawerContent
        }
        .sheet(isPresented: $viewModel.showingItemDetailModal) {
            if let item = viewModel.selectedItemForDetail,
               let slot = viewModel.selectedSlotForDetail {
                UnifiedItemDetailModal(
                    item: item,
                    badges: [
                        .level,
                        .primary(label: "Rarity", color: Color.rarityBorderColor(for: item.rarity)),
                        .secondary(label: "Type", color: Color.textSecondary)
                    ]
                ) {
                    equipmentActionButtons(for: item, slot: slot)
                }
            }
        }
        .sheet(isPresented: .constant(viewModel.inventoryViewModel.upgradeModalState != .none)) {
            // Single persistent upgrade modal
            Group {
                switch viewModel.inventoryViewModel.upgradeModalState {
                case .none:
                    EmptyView()

                case .loading:
                    VStack {
                        ProgressView()
                        Text("Loading upgrade details...")
                            .font(FontManager.body)
                            .foregroundColor(Color.textSecondary)
                            .padding(.top, 8)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.backgroundPrimary)

                case .ready(_, let costInfo, let item):
                    let projectedStats = calculateProjectedStats(from: item.computedStats)

                    UpgradeModal(
                        item: item,
                        goldCost: costInfo.goldCost,
                        newGoldBalance: costInfo.playerGold - costInfo.goldCost,
                        currentStats: item.computedStats,
                        projectedStats: projectedStats,
                        onUpgrade: {
                            Task {
                                await viewModel.inventoryViewModel.performUpgrade(itemId: item.id)
                            }
                        },
                        onReturnToInventory: {
                            viewModel.inventoryViewModel.upgradeModalState = .none
                            viewModel.showingItemDetailModal = false
                        }
                    )

                case .upgrading:
                    // Modal handles loading state internally
                    EmptyView()
                }
            }
        }
        .task {
            // Load both equipment and inventory data when view appears
            print("📱 [EQUIPMENT VIEW] Starting to load equipment and inventory...")
            await viewModel.fetchEquipment()
            await viewModel.inventoryViewModel.loadInventory()
            print("📱 [EQUIPMENT VIEW] Loading complete. Inventory state: \(viewModel.inventoryViewModel.items)")
        }
        .onAppear {
            // Set navigation manager on inventory view model for craft/upgrade navigation
            viewModel.inventoryViewModel.navigationManager = navigationManager
        }
    }

    // MARK: - Drawer Content
    @ViewBuilder
    private var drawerContent: some View {
        if let slot = viewModel.selectedSlotForEquipping {
            ItemSelectionDrawerContent(
                targetSlot: slot,
                availableItems: viewModel.getAvailableItemsForSlot(slot),
                onItemSelected: { selectedItem in
                    Task {
                        await viewModel.equipItemFromInventory(selectedItem)
                    }
                }
            )
        }
    }

    // MARK: - Equipment Content View
    private func equipmentContentView(equipment: [Equipment]) -> some View {
        VStack(spacing: 24) {
            // Character-Centered Equipment Layout
            equipmentSlotsLayout(equipment: equipment.first)

            // Stats Panel
            if let equipmentData = equipment.first {
                StatsDisplayView(
                    totalStats: equipmentData.totalStats
                )
            }
        }
    }

    // MARK: - Equipment Slots Layout
    private func equipmentSlotsLayout(equipment: Equipment?) -> some View {
        VStack(spacing: 20) {
            // Head slot (top)
            EquipmentSlotView(slot: "head", item: equipment?.slots.head) { item in
                audioManager.playMenuButtonClick()
                handleSlotTap(item: item, slot: .head)
            }

            // Middle row: weapon, character silhouette, offhand
            HStack(spacing: 40) {
                // Left side slots
                VStack(spacing: 16) {
                    EquipmentSlotView(slot: "weapon", item: equipment?.slots.weapon) { item in
                        audioManager.playMenuButtonClick()
                        handleSlotTap(item: item, slot: .weapon)
                    }

                    EquipmentSlotView(slot: "accessory_1", item: equipment?.slots.accessory1) { item in
                        audioManager.playMenuButtonClick()
                        handleSlotTap(item: item, slot: .accessory_1)
                    }
                }

                // Center character silhouette
                characterSilhouetteView

                // Right side slots
                VStack(spacing: 16) {
                    EquipmentSlotView(slot: "offhand", item: equipment?.slots.offhand) { item in
                        audioManager.playMenuButtonClick()
                        handleSlotTap(item: item, slot: .offhand)
                    }

                    EquipmentSlotView(slot: "accessory_2", item: equipment?.slots.accessory2) { item in
                        audioManager.playMenuButtonClick()
                        handleSlotTap(item: item, slot: .accessory_2)
                    }
                }
            }

            // Bottom row: armor, feet
            HStack(spacing: 40) {
                EquipmentSlotView(slot: "armor", item: equipment?.slots.armor) { item in
                    audioManager.playMenuButtonClick()
                    handleSlotTap(item: item, slot: .armor)
                }

                EquipmentSlotView(slot: "feet", item: equipment?.slots.feet) { item in
                    audioManager.playMenuButtonClick()
                    handleSlotTap(item: item, slot: .feet)
                }
            }

            // Pet slot (bottom)
            HStack {
                EquipmentSlotView(slot: "pet", item: equipment?.slots.pet) { item in
                    audioManager.playMenuButtonClick()
                    handleSlotTap(item: item, slot: .pet)
                }
                Spacer()
            }
        }
    }

    // MARK: - Slot Tap Handler
    private func handleSlotTap(item: PlayerItem?, slot: EquipmentSlot) {
        if let item = item {
            // Item is equipped: show detail modal
            viewModel.showItemDetail(for: item, slot: slot)
        } else {
            // Slot is empty: show item selection drawer
            viewModel.showItemSelection(for: slot)
        }
    }

    // MARK: - Character Silhouette View
    private var characterSilhouetteView: some View {
        ZStack {
            RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                .fill(Color.backgroundSecondary)
                .frame(width: 100, height: 140)
                .overlay(
                    RoundedRectangle(cornerRadius: .cornerRadiusLarge)
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

    private func calculateProjectedStats(from currentStats: ItemStats) -> ItemStats {
        // Estimate a ~20% increase in stats per level upgrade
        // This is a rough approximation - ideally the backend would provide exact projected stats
        let statIncrease: Double = 1.20

        return ItemStats(
            atkPower: currentStats.atkPower * statIncrease,
            atkAccuracy: currentStats.atkAccuracy * statIncrease,
            defPower: currentStats.defPower * statIncrease,
            defAccuracy: currentStats.defAccuracy * statIncrease
        )
    }

    // MARK: - Equipment Action Buttons
    @ViewBuilder
    private func equipmentActionButtons(for item: PlayerItem, slot: EquipmentSlot) -> some View {
        VStack(spacing: 12) {
            // Primary actions row (Upgrade & Craft)
            HStack(spacing: 12) {
                // Upgrade button
                Button {
                    audioManager.playMenuButtonClick()
                    viewModel.showingItemDetailModal = false
                    Task {
                        try? await Task.sleep(for: .milliseconds(300))
                        viewModel.prepareItemForInventoryAction()
                        await viewModel.inventoryViewModel.handleUpgradeAction()
                    }
                } label: {
                    HStack {
                        Image(systemName: "arrow.up.circle.fill")
                        NormalText("Upgrade")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                            .fill(Color.accent.opacity(0.15))
                            .overlay(
                                RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                                    .stroke(Color.accent, lineWidth: 2)
                            )
                    )
                    .foregroundColor(Color.accent)
                }
                .buttonStyle(PlainButtonStyle())

                // Craft button
                Button {
                    audioManager.playMenuButtonClick()
                    viewModel.showingItemDetailModal = false
                    Task {
                        try? await Task.sleep(for: .milliseconds(300))
                        viewModel.prepareItemForInventoryAction()
                        await viewModel.inventoryViewModel.handleCraftAction()
                    }
                } label: {
                    HStack {
                        Image(systemName: "hammer.fill")
                        NormalText("Craft")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                            .fill(Color.accentSecondary.opacity(0.15))
                            .overlay(
                                RoundedRectangle(cornerRadius: .cornerRadiusLarge)
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
                viewModel.showingItemDetailModal = false
                Task {
                    try? await Task.sleep(for: .milliseconds(300))
                    viewModel.showItemSelection(for: slot)
                }
            }

            // Unequip button
            Button {
                audioManager.playMenuButtonClick()
                Task {
                    await viewModel.unequipCurrentItem()
                }
            } label: {
                HStack {
                    Image(systemName: "minus.circle")
                    NormalText("Unequip Item")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                        .fill(Color.alert.opacity(0.15))
                        .overlay(
                            RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                                .stroke(Color.alert, lineWidth: 2)
                        )
                )
                .foregroundColor(Color.alert)
            }
            .buttonStyle(PlainButtonStyle())
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
        EquipmentSlotView(slot: "weapon", item: nil) { item in
            print("Tapped empty weapon slot")
        }

        // Equipped item example (mock data)
        EquipmentSlotView(slot: "weapon", item: mockPlayerItem) { item in
            print("Tapped equipped weapon: \(item?.baseType ?? "nil")")
        }

        // Stats display example
        StatsDisplayView(
            totalStats: ItemStats(
                atkPower: 45.0,
                atkAccuracy: 85.5,
                defPower: 32.0,
                defAccuracy: 78.2
            )
        )
    }
    .padding()
    .background(Color.backgroundPrimary)
    .modelContainer(for: Item.self, inMemory: true)
    .environmentObject(NavigationManager())
}

// MARK: - Mock Data for Preview
private let mockPlayerItem = PlayerItem(
    id: "550e8400-e29b-41d4-a716-446655440000",
    baseType: "Magic Sword",
    itemTypeId: "550e8400-e29b-41d4-a716-446655440001",
    category: "weapon",
    level: 5,
    rarity: "epic",
    appliedMaterials: [],
    isStyled: false,
    computedStats: ItemStats(atkPower: 0.4, atkAccuracy: 0.25, defPower: 0.25, defAccuracy: 0.1),
    isEquipped: true,
    generatedImageUrl: nil,
    name: "Magic Sword",
    description: "A powerful magical sword"
)