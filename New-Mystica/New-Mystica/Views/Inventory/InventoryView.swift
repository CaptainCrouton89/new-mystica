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
                    UnifiedItemDetailModal(
                        item: item,
                        badges: [
                            .level,
                            .primary(label: "Status", color: item.isEquipped ? Color.accent : Color.textSecondary),
                            .secondary(label: "Crafted", color: Color.warning)
                        ]
                    ) {
                        inventoryActionButtons(for: item)
                    }
                }
            }
            .sheet(isPresented: .constant(viewModel.upgradeModalState != .none)) {
                // Single persistent upgrade modal
                Group {
                    switch viewModel.upgradeModalState {
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
                                    await viewModel.performUpgrade(itemId: item.id)
                                }
                            },
                            onReturnToInventory: {
                                viewModel.upgradeModalState = .none
                            },
                            isLoadingNextCost: viewModel.isLoadingNextUpgradeCost
                        )

                    case .upgrading:
                        // Modal handles loading state internally
                        EmptyView()
                    }
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
                if case .loading = viewModel.items {
                    // Show single loading indicator while page is loading
                    VStack(spacing: 16) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: Color.accent))
                            .scaleEffect(1.2)

                        NormalText("Loading...")
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.top, 40)
                } else {
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
                        RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                            .fill(Color.success.opacity(0.1))
                            .overlay(
                                RoundedRectangle(cornerRadius: .cornerRadiusLarge)
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
                        RoundedRectangle(cornerRadius: .cornerRadiusExtraLarge)
                            .fill(Color.backgroundCard)
                            .overlay(
                                RoundedRectangle(cornerRadius: .cornerRadiusExtraLarge)
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
                TitleText("Materials", size: 20)
                    .foregroundColor(Color.textPrimary)

                Spacer()

                SmallText("\(materials.count) types")
                    .foregroundColor(Color.textSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        RoundedRectangle(cornerRadius: .cornerRadiusLarge)
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

    // MARK: - Inventory Action Buttons
    @ViewBuilder
    private func inventoryActionButtons(for item: EnhancedPlayerItem) -> some View {
        VStack(spacing: 12) {
            // Primary actions row (Upgrade & Craft)
            HStack(spacing: 12) {
                // Upgrade button
                Button {
                    audioManager.playMenuButtonClick()
                    viewModel.showingItemDetailModal = false
                    Task {
                        try? await Task.sleep(for: .milliseconds(300))
                        await viewModel.handleUpgradeAction()
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
                        await viewModel.handleCraftAction()
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

            // Equip button
            Button {
                audioManager.playMenuButtonClick()
                viewModel.showingItemDetailModal = false
                Task {
                    try? await Task.sleep(for: .milliseconds(300))
                    await viewModel.handleEquipAction()
                }
            } label: {
                HStack {
                    Image(systemName: "checkmark.shield.fill")
                    NormalText("Equip Item")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                        .fill(Color.success.opacity(0.15))
                        .overlay(
                            RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                                .stroke(Color.success, lineWidth: 2)
                        )
                )
                .foregroundColor(Color.success)
            }
            .buttonStyle(PlainButtonStyle())
            .disabled(item.isEquipped)
            .opacity(item.isEquipped ? 0.5 : 1.0)

            // Sell button
            Button {
                audioManager.playMenuButtonClick()
                viewModel.showingItemDetailModal = false
                viewModel.handleSellAction()
            } label: {
                HStack {
                    Image(systemName: "dollarsign.circle.fill")
                    NormalText("Sell Item")
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
                        name: "Wood",
                        styleId: "rustic",
                        slotIndex: 0,
                        appliedAt: "2025-10-23T06:00:00Z",
                        material: ItemMaterialApplication.MaterialDetail(
                            id: "wood",
                            name: "Wood",
                            description: nil,
                            statModifiers: StatModifier(atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0),
                            imageUrl: nil
                        )
                    ),
                    ItemMaterialApplication(
                        materialId: "crystal",
                        name: "Crystal",
                        styleId: "ethereal",
                        slotIndex: 1,
                        appliedAt: "2025-10-23T06:00:00Z",
                        material: ItemMaterialApplication.MaterialDetail(
                            id: "crystal",
                            name: "Crystal",
                            description: nil,
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