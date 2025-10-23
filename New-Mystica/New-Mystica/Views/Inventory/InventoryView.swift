//
//  InventoryView.swift
//  New-Mystica
//
//  Displays player inventory using InventoryViewModel with LoadableView pattern
//  Replaces the dummy CollectionView with real inventory functionality
//

import SwiftUI

// MARK: - Item Row Component
struct ItemRow: View {
    let item: EnhancedPlayerItem

    var body: some View {
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
                    .stroke(Color.accentSecondary, lineWidth: 2)
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
                // Item Name and Level
                HStack {
                    NormalText(item.baseType.capitalized, size: 16)
                        .foregroundColor(Color.textPrimary)
                        .bold()

                    Spacer()

                    NormalText("Lv. \(item.level)")
                        .foregroundColor(Color.textSecondary)
                }

                // Stats Preview
                HStack(spacing: 16) {
                    StatValueView(
                        label: "ATK",
                        value: String(format: "%.0f", item.computedStats.atkPower),
                        color: Color.accent
                    )

                    StatValueView(
                        label: "DEF",
                        value: String(format: "%.0f", item.computedStats.defPower),
                        color: Color.accentSecondary
                    )

                    Spacer()
                }

                // Styling Status
                HStack {
                    if item.isStyled {
                        SmallText("Styled (\(item.appliedMaterials.count)/3)")
                            .foregroundColor(Color.accent)
                    } else {
                        SmallText("Unstyled")
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
        .padding(.vertical, 8)
        .padding(.horizontal, 16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }

    // MARK: - Helper Methods

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

    private func getRarityColor() -> Color {
        // Enhanced rarity border system based on level and styling
        if item.isEquipped {
            // Equipped items get accent color border
            return Color.accent
        } else if item.isStyled {
            // Styled items get secondary accent color
            return Color.accentSecondary
        } else if item.level >= 10 {
            // High level items get orange/legendary color
            return Color.orange
        } else if item.level >= 5 {
            // Mid level items get blue/rare color
            return Color.blue
        } else {
            // Low level items get subtle border
            return Color.borderSubtle
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
}


// MARK: - Stat Value Component
struct StatValueView: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack(spacing: 4) {
            SmallText(label)
                .foregroundColor(Color.textSecondary)

            SmallText(value)
                .foregroundColor(color)
                .bold()
        }
    }
}

// MARK: - Main Inventory View
struct InventoryView: View {
    @Environment(\.navigationManager) private var navigationManager
    @Environment(\.audioManager) private var audioManager
    @Environment(AppState.self) private var appState
    @State private var viewModel: InventoryViewModel

    init() {
        // Create viewModel with navigationManager from environment is not possible in init
        // So we create with nil and set it in onAppear
        _viewModel = State(initialValue: InventoryViewModel())
    }

    var body: some View {
        mainContentView
            .refreshable {
                await viewModel.refreshInventory()
            }
            .task {
                await viewModel.loadInventory()
            }
            .sheet(isPresented: $viewModel.showingItemDetailModal) {
                if let item = viewModel.selectedItemForDetail {
                    InventoryItemDetailModal(
                        item: item,
                        onEquip: {
                            await viewModel.handleEquipAction()
                        },
                        onCraft: {
                            Task {
                                await viewModel.handleCraftAction()
                            }
                        },
                        onUpgrade: {
                            Task {
                                await viewModel.performUpgrade(itemId: item.id)
                            }
                        },
                        onSell: {
                            viewModel.handleSellAction()
                        }
                    )
                }
            }
            .sheet(isPresented: $viewModel.showingUpgradeCompleteModal) {
                if let upgradeResult = viewModel.lastUpgradeResult {
                    UpgradeCompleteModal(
                        item: upgradeResult.item,
                        goldSpent: upgradeResult.goldSpent,
                        newGoldBalance: upgradeResult.newGoldBalance,
                        newVanityLevel: upgradeResult.newVanityLevel,
                        statsBefore: viewModel.lastUpgradeStatsBefore ?? ItemStats(atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0),
                        statsAfter: upgradeResult.item.computedStats,
                        onUpgradeAgain: {
                            if let itemId = viewModel.selectedItemForDetail?.id {
                                Task {
                                    await viewModel.performUpgrade(itemId: itemId)
                                }
                            }
                        },
                        onReturnToInventory: {
                            viewModel.showingUpgradeCompleteModal = false
                        }
                    )
                }
            }
            .overlay(sellConfirmationOverlay)
            .goldShower(isActive: $viewModel.showingGoldShower, goldAmount: viewModel.goldShowerAmount)
            .overlay(successToastOverlay)
            .alert("Error", isPresented: $viewModel.showingErrorAlert) {
                Button("OK") {
                    viewModel.dismissErrorAlert()
                }
            } message: {
                Text("An error occurred. Please try again.")
            }
            .overlay(loadingOverlay)
            .onAppear {
                // Set navigationManager after initialization
                viewModel.navigationManager = navigationManager
            }
    }

    // MARK: - Main Content

    private var mainContentView: some View {
        BaseView(title: "Inventory") {
            VStack(spacing: 0) {
                // Gold Balance Header
                HStack {
                    Spacer()
                    GoldBalanceView(amount: appState.getCurrencyBalance(for: .gold))
                        .padding(.trailing, 16)
                        .padding(.top, 8)
                }
                .padding(.bottom, 8)

                // Main Content
                ScrollView {
                    VStack(spacing: 20) {
                        // Items Section (styled items with materials)
                        LoadableView(viewModel.items) { items in
                            itemsSection(items: items)
                        } retry: {
                            Task { await viewModel.loadInventory() }
                        }


                        // Materials Section
                        LoadableView(viewModel.materialInventory) { materials in
                            materialsSection(materials: materials)
                        } retry: {
                            Task { await viewModel.loadInventory() }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                }
            }
        }
    }

    // MARK: - Overlay Views

    @ViewBuilder
    private var sellConfirmationOverlay: some View {
        Group {
            if viewModel.showingSellConfirmation, let item = viewModel.selectedItemForDetail {
                SellConfirmationModal(
                    item: item,
                    sellValue: calculateSellValue(for: item),
                    isLoading: viewModel.isSelling,
                    onConfirm: {
                        Task {
                            await viewModel.confirmSellItem()
                        }
                    },
                    onCancel: {
                        viewModel.cancelSell()
                    }
                )
                .transition(.opacity.combined(with: .scale(scale: 0.9)))
                .animation(.easeInOut(duration: 0.3), value: viewModel.showingSellConfirmation)
            }
        }
    }

    @ViewBuilder
    private var successToastOverlay: some View {
        Group {
            if viewModel.showingSuccessToast {
                VStack {
                    HStack(spacing: 12) {
                        Image(systemName: viewModel.successIcon)
                            .font(.system(size: 20, weight: .medium))
                            .foregroundColor(Color.success)

                        Text(viewModel.successMessage)
                            .font(FontManager.body)
                            .foregroundColor(Color.textPrimary)

                        Spacer()

                        Button(action: {
                            viewModel.dismissSuccessToast()
                        }) {
                            Image(systemName: "xmark")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(Color.textSecondary)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.success.opacity(0.1))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.success, lineWidth: 1)
                            )
                    )
                    .padding(.horizontal, 20)
                    .padding(.top, 8)

                    Spacer()
                }
                .transition(.move(edge: .top).combined(with: .opacity))
                .animation(.easeInOut(duration: 0.3), value: viewModel.showingSuccessToast)
            }
        }
    }

    @ViewBuilder
    private var loadingOverlay: some View {
        Group {
            if viewModel.isEquipping {
                ZStack {
                    Color.black.opacity(0.3)
                        .edgesIgnoringSafeArea(.all)

                    VStack(spacing: 16) {
                        ProgressView()
                            .scaleEffect(1.2)
                            .tint(Color.accent)

                        Text("Equipping item...")
                            .font(FontManager.body)
                            .foregroundColor(Color.textPrimary)
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
                }
                .transition(.opacity)
                .animation(.easeInOut(duration: 0.2), value: viewModel.isEquipping)
            }
        }
    }

    // MARK: - Content Sections

    private func itemsSection(items: [EnhancedPlayerItem]) -> some View {
        Group {
            // Show empty state if no items
            if items.isEmpty {
                emptyStateView
            } else {
                itemListView(items: items)
            }
        }
    }

    private var emptyStateView: some View {
        VStack(spacing: 20) {
            Image(systemName: "cube.transparent")
                .font(.system(size: 48, weight: .medium))
                .foregroundColor(Color.borderSubtle)

            VStack(spacing: 8) {
                TitleText("No Items Found", size: 24)

                NormalText("Your inventory is empty in this category")
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            TextButton("Refresh") {
                Task { await viewModel.loadInventory() }
            }
            .frame(maxWidth: 200)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.backgroundPrimary)
    }

    private func itemListView(items: [EnhancedPlayerItem]) -> some View {
        LazyVStack(spacing: 12) {
            ForEach(items, id: \.id) { item in
                ItemRow(item: item)
                    .onTapGesture {
                        audioManager.playMenuButtonClick()
                        viewModel.showItemDetail(for: item)
                    }
            }

            // Load More button
            if viewModel.canLoadMore {
                HStack {
                    Spacer()
                    if viewModel.isLoading {
                        ProgressView()
                            .scaleEffect(0.8)
                            .padding()
                    } else {
                        TextButton("Load More") {
                            audioManager.playMenuButtonClick()
                            Task {
                                await viewModel.loadMoreItems()
                            }
                        }
                        .frame(maxWidth: 200)
                    }
                    Spacer()
                }
                .padding(.top, 16)
            }
        }
    }


    // MARK: - Materials Section

    private func materialsSection(materials: [MaterialInventoryStack]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // Section Header
            HStack {
                TitleText("All Materials", size: 20)
                    .foregroundColor(Color.textPrimary)

                Spacer()

                // Material count
                SmallText("\(materials.count) types")
                    .foregroundColor(Color.textSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.backgroundSecondary)
                    )
            }

            if materials.isEmpty {
                materialEmptyStateView
            } else {
                materialGridView(materials: materials)
            }
        }
    }

    private var materialEmptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "cube.transparent")
                .font(.system(size: 32, weight: .medium))
                .foregroundColor(Color.borderSubtle)

            VStack(spacing: 4) {
                NormalText("No Materials")
                    .foregroundColor(Color.textPrimary)
                    .bold()

                SmallText("Collect materials to craft styled items")
                    .foregroundColor(Color.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }

    private func materialGridView(materials: [MaterialInventoryStack]) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 3), spacing: 12) {
            ForEach(materials, id: \.materialId) { material in
                TappableMaterialCard(material: material) {
                    audioManager.playMenuButtonClick()
                    viewModel.selectMaterial(material)
                    // Navigate to crafting with material pre-selected
                    Task {
                        await viewModel.navigateToCraftingWithMaterial(material)
                    }
                }
            }
        }
    }

    // MARK: - Helper Methods

    private func calculateSellValue(for item: EnhancedPlayerItem) -> Int {
        // Basic sell value calculation based on level and styling
        let baseValue = item.level * 10
        let styledBonus = item.isStyled ? (item.appliedMaterials.count * 15) : 0
        return baseValue + styledBonus
    }
}


// MARK: - Preview
#Preview {
    let appState = AppState.shared
    appState.setCurrencies([CurrencyBalance(currencyCode: .gold, balance: 1234, updatedAt: "")])

    return InventoryView()
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
        .environment(appState)
}

// MARK: - Mock Data for Preview
#if DEBUG
extension InventoryView {
    static var mockItems: [EnhancedPlayerItem] {
        [
            EnhancedPlayerItem(
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
            ),
            EnhancedPlayerItem(
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
                            statModifiers: StatModifier(atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0),
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
        ]
    }
}
#endif