import SwiftUI


struct InventoryView: View {
    @Environment(\.navigationManager) private var navigationManager
    @Environment(\.audioManager) private var audioManager
    @Environment(AppState.self) private var appState
    @State private var viewModel: InventoryViewModel

    init() {
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
                                await viewModel.handleUpgradeAction()
                            }
                        },
                        onSell: {
                            viewModel.handleSellAction()
                        }
                    )
                }
            }
            .sheet(isPresented: $viewModel.showingUpgradeConfirmationModal) {
                Group {
                    if let item = viewModel.selectedItemForDetail,
                       let costInfo = viewModel.pendingUpgradeCostInfo,
                       let statsBefore = viewModel.lastUpgradeStatsBefore {

                        // Calculate projected stats for confirmation modal
                        // For now, we'll estimate based on typical stat increases
                        // In a real implementation, the backend should provide projected stats
                        let projectedStats = calculateProjectedStats(from: statsBefore)

                        UpgradeCompleteModal(
                            item: item,
                            goldSpent: costInfo.goldCost,
                            newGoldBalance: costInfo.playerGold - costInfo.goldCost,
                            statsBefore: statsBefore,
                            statsAfter: projectedStats,
                            isConfirmation: true,
                            onConfirm: {
                                Task {
                                    await viewModel.performUpgrade(itemId: item.id)
                                }
                            },
                            onUpgradeAgain: nil,
                            onReturnToInventory: {
                                viewModel.showingUpgradeConfirmationModal = false
                                viewModel.selectedItemForDetail = nil
                            }
                        )
                    } else {
                        VStack {
                            ProgressView()
                            Text("Loading upgrade details...")
                                .font(FontManager.body)
                                .foregroundColor(Color.textSecondary)
                                .padding(.top, 8)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.backgroundPrimary)
                    }
                }
            }
            .sheet(isPresented: $viewModel.showingUpgradeCompleteModal) {
                if let upgradeResult = viewModel.lastUpgradeResult {
                    UpgradeCompleteModal(
                        item: upgradeResult.item,
                        goldSpent: upgradeResult.goldSpent,
                        newGoldBalance: upgradeResult.newGoldBalance,
                        statsBefore: viewModel.lastUpgradeStatsBefore ?? ItemStats(atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0),
                        statsAfter: upgradeResult.item.computedStats,
                        isConfirmation: false,
                        onConfirm: nil,
                        onUpgradeAgain: {
                            Task {
                                await viewModel.handleUpgradeAction()
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
                viewModel.navigationManager = navigationManager
            }
    }


    private var mainContentView: some View {
        BaseView(title: "Inventory") {
            ScrollView {
                VStack(spacing: 20) {
                    LoadableView(viewModel.items) { items in
                        itemsSection(items: items)
                    } retry: {
                        Task { await viewModel.loadInventory() }
                    }


                    LoadableView(viewModel.materialInventory) { materials in
                        materialsSection(materials: materials)
                    } retry: {
                        Task { await viewModel.loadInventory() }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
        } trailingView: {
            if let goldBalance = appState.getCurrencyBalance(for: .gold) {
                GoldBalanceView(amount: goldBalance)
            } else {
                // Currencies not loaded - show loading state
                Text("Loading...")
                    .foregroundColor(.secondary)
                    .font(FontManager.caption)
            }
        }
    }


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


    private func itemsSection(items: [EnhancedPlayerItem]) -> some View {
        Group {
            if items.isEmpty {
                emptyStateView
            } else {
                itemListView(items: items)
            }
        }
    }

    private var emptyStateView: some View {
        InventoryEmptyState(type: .items) {
            Task { await viewModel.loadInventory() }
        }
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



    private func materialsSection(materials: [MaterialInventoryStack]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                TitleText("All Materials", size: 20)
                    .foregroundColor(Color.textPrimary)

                Spacer()

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
        InventoryEmptyState(type: .materials) {
            Task { await viewModel.loadInventory() }
        }
    }

    private func materialGridView(materials: [MaterialInventoryStack]) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 3), spacing: 12) {
            ForEach(materials, id: \.materialId) { material in
                TappableMaterialCard(material: material) {
                    audioManager.playMenuButtonClick()
                    viewModel.selectMaterial(material)
                    Task {
                        await viewModel.navigateToCraftingWithMaterial(material)
                    }
                }
            }
        }
    }


    private func calculateSellValue(for item: EnhancedPlayerItem) -> Int {
        let baseValue = item.level * 10
        let styledBonus = item.isStyled ? (item.appliedMaterials.count * 15) : 0
        return baseValue + styledBonus
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
}


#Preview {
    let appState = AppState.shared
    appState.setCurrencies([CurrencyBalance(currencyCode: .gold, balance: 1234, updatedAt: "")])

    return InventoryView()
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
        .environment(appState)
}

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