//
//  InventoryViewModel.swift
//  New-Mystica
//
//

import Foundation
import Observation

// MARK: - Upgrade Modal State Machine
enum UpgradeModalState: Equatable {
    case none
    case loading(itemId: String)
    case ready(itemId: String, costInfo: UpgradeCostInfo, item: EnhancedPlayerItem)
    case upgrading(itemId: String)

    static func == (lhs: UpgradeModalState, rhs: UpgradeModalState) -> Bool {
        switch (lhs, rhs) {
        case (.none, .none):
            return true
        case (.loading(let id1), .loading(let id2)):
            return id1 == id2
        case (.ready(let id1, _, _), .ready(let id2, _, _)):
            return id1 == id2
        case (.upgrading(let id1), .upgrading(let id2)):
            return id1 == id2
        default:
            return false
        }
    }
}

/// Manages inventory state with paginated loading and item operations.
@Observable
final class InventoryViewModel {
    let repository: InventoryRepository
    let materialsRepository: MaterialsRepository
    weak var navigationManager: NavigationManager?

    // MARK: - State
    var items: Loadable<[EnhancedPlayerItem]> = .idle
    var materials: Loadable<[MaterialTemplate]> = .idle
    var materialInventory: Loadable<[MaterialInventoryStack]> = .idle

    // MARK: - Pagination State
    var currentPage: Int = 1
    var totalPages: Int = 1
    var totalItems: Int = 0
    var isLoading: Bool = false
    var canLoadMore: Bool = false

    // MARK: - UI State
    var selectedItem: EnhancedPlayerItem?
    var selectedMaterial: MaterialInventoryStack?
    var applyingMaterial: Bool = false


    // MARK: - Item Detail Modal State
    var showingItemDetailModal: Bool = false
    var selectedItemForDetail: EnhancedPlayerItem?

    // MARK: - Sell Confirmation State
    var showingSellConfirmation: Bool = false

    // MARK: - Loading States
    var isEquipping: Bool = false
    var isSelling: Bool = false
    var isNavigatingToCraft: Bool = false
    var isNavigatingToUpgrade: Bool = false

    // MARK: - Upgrade State (using state machine)
    var upgradeModalState: UpgradeModalState = .none
    var upgradeCostData: Loadable<UpgradeCostInfo> = .idle
    var upgradeInProgress: Bool = false

    // MARK: - Error State
    var currentError: AppError?
    var showingErrorAlert: Bool = false

    // MARK: - Success State
    var showingSuccessToast: Bool = false
    var successMessage: String = ""
    var successIcon: String = "checkmark.circle.fill"
    var currentToastId: UUID?

    // MARK: - Gold Shower Animation State
    var showingGoldShower: Bool = false
    var goldShowerAmount: Int = 0

    /// Initializes the InventoryViewModel with required dependencies.
    ///
    /// - Parameters:
    ///   - repository: Repository for inventory operations (default: DefaultInventoryRepository)
    ///   - materialsRepository: Repository for material operations (default: DefaultMaterialsRepository)
    ///   - navigationManager: Optional navigation coordinator for screen transitions
    init(repository: InventoryRepository = DefaultInventoryRepository(), materialsRepository: MaterialsRepository = DefaultMaterialsRepository(), navigationManager: NavigationManager? = nil) {
        self.repository = repository
        self.materialsRepository = materialsRepository
        self.navigationManager = navigationManager
    }

    // MARK: - Public Methods

    /// Loads the initial inventory page and material inventory.
    ///
    /// Performs a complete inventory refresh by:
    /// 1. Resetting to page 1 and setting loading states
    /// 2. Fetching paginated items from the repository
    /// 3. Loading material inventory in parallel
    /// 4. Updating pagination metadata for infinite scroll
    ///
    /// - Important: This method sets both `items` and `materialInventory` to loading state.
    ///   Any errors during loading will set both to the same error state.
    /// - Note: Automatically updates pagination state (`currentPage`, `totalPages`, `canLoadMore`)
    func loadInventory() async {
        items = .loading
        materialInventory = .loading
        currentPage = 1
        isLoading = true

        do {
            let response = try await repository.fetchInventory(
                page: currentPage,
                filter: nil,
                sortOption: nil
            )
            items = .loaded(response.items)

            FileLogger.shared.log("✅ Loaded \(response.items.count) items from inventory API", level: .info, category: "Inventory")

            // Load material inventory alongside items
            await loadMaterialInventory()

            currentPage = response.pagination.currentPage
            totalPages = response.pagination.totalPages
            totalItems = response.pagination.totalItems
            canLoadMore = currentPage < totalPages
        } catch let error as AppError {
            items = .error(error)
            materialInventory = .error(error)
            FileLogger.shared.log("❌ Failed to load inventory: \(error)", level: .error, category: "Inventory")
        } catch {
            let appError = AppError.unknown(error)
            items = .error(appError)
            materialInventory = .error(appError)
            FileLogger.shared.log("❌ Failed to load inventory: \(appError)", level: .error, category: "Inventory")
        }

        isLoading = false
    }

    func loadMaterials() async {
        materials = .loading

        do {
            let materialList = try await repository.fetchMaterials()
            materials = .loaded(materialList)
        } catch let error as AppError {
            materials = .error(error)
        } catch {
            materials = .error(.unknown(error))
        }
    }

    /// Loads the next page of items for infinite scroll functionality.
    ///
    /// Implements pagination by:
    /// 1. Checking if more items are available and not currently loading
    /// 2. Fetching the next page from the repository
    /// 3. Appending new items to existing loaded items
    /// 4. Updating pagination state for continued scrolling
    ///
    /// - Important: Items are accumulated (appended) rather than replaced for infinite scroll.
    ///   If items are not in loaded state, replaces with new items instead.
    /// - Note: Method is safe to call multiple times - guards against concurrent loading
    func loadMoreItems() async {
        guard canLoadMore && !isLoading else { return }

        isLoading = true
        do {
            let response = try await repository.fetchInventory(
                page: currentPage + 1,
                filter: nil,
                sortOption: nil
            )

            // Accumulate items for infinite scroll
            if case .loaded(var currentItems) = items {
                currentItems.append(contentsOf: response.items)
                items = .loaded(currentItems)
            } else {
                items = .loaded(response.items)
            }

            currentPage = response.pagination.currentPage
            totalPages = response.pagination.totalPages
            canLoadMore = currentPage < totalPages
        } catch let error as AppError {
            items = .error(error)
            FileLogger.shared.log("❌ Failed to load more items: \(error)", level: .error, category: "Inventory")
        } catch {
            let appError = AppError.unknown(error)
            items = .error(appError)
            FileLogger.shared.log("❌ Failed to load more items: \(appError)", level: .error, category: "Inventory")
        }
        isLoading = false
    }

    func refreshInventory() async {
        currentPage = 1
        await loadInventory()
    }

    /// Applies a material to an item at the specified slot index.
    ///
    /// Performs material application by:
    /// 1. Setting loading state (`applyingMaterial = true`)
    /// 2. Making API call to repository with material and slot details
    /// 3. Updating local item state with the enhanced item from backend
    /// 4. Synchronizing selection state if the modified item is currently selected
    ///
    /// - Parameters:
    ///   - itemId: The unique identifier of the item to enhance
    ///   - materialId: The identifier of the material to apply
    ///   - styleId: The specific style variant of the material
    ///   - slotIndex: The material slot index (0-2, default: 0)
    ///
    /// - Important: This method maintains local state synchronization by updating the item
    ///   in the loaded items array and updating `selectedItem` if it matches.
    /// - Note: Sets `applyingMaterial` loading flag for UI feedback during API call
    func applyMaterial(itemId: String, materialId: String, styleId: String, slotIndex: Int = 0) async {
        applyingMaterial = true
        defer { applyingMaterial = false }

        do {
            let result = try await repository.applyMaterial(
                itemId: itemId,
                materialId: materialId,
                styleId: styleId,
                slotIndex: slotIndex
            )

            // Update the item in our local state
            if case .loaded(var currentItems) = items {
                if let index = currentItems.firstIndex(where: { $0.id == itemId }) {
                    currentItems[index] = result.updatedItem
                    items = .loaded(currentItems)
                    selectedItem = result.updatedItem
                }
            }

        } catch let error as AppError {
            items = .error(error)
        } catch {
            items = .error(.unknown(error))
        }
    }

    func removeMaterial(itemId: String, slotIndex: Int) async {
        do {
            let updatedItem = try await repository.removeMaterial(itemId: itemId, slotIndex: slotIndex)

            // Update the item in our local state
            if case .loaded(var currentItems) = items {
                if let index = currentItems.firstIndex(where: { $0.id == itemId }) {
                    currentItems[index] = updatedItem
                    items = .loaded(currentItems)
                    selectedItem = updatedItem
                }
            }

        } catch let error as AppError {
            items = .error(error)
        } catch {
            items = .error(.unknown(error))
        }
    }

    func selectItem(_ item: EnhancedPlayerItem) {
        selectedItem = item
    }

    func clearSelection() {
        selectedItem = nil
        selectedMaterial = nil
    }

    func selectMaterial(_ material: MaterialInventoryStack) {
        selectedMaterial = material
    }

    /// Navigates to the crafting screen with a preselected material.
    ///
    /// Initiates navigation workflow by:
    /// 1. Setting navigation loading state for UI feedback
    /// 2. Storing the selected material for crafting context
    /// 3. Adding artificial delay to show loading state
    /// 4. Triggering navigation through NavigationManager
    ///
    /// - Parameter material: The material stack to preselect in crafting view
    ///
    /// - Important: Uses `@MainActor` for navigation call to ensure UI updates
    ///   happen on the main thread. Sets `isNavigatingToCraft` for loading state.
    /// - Note: 0.5 second delay provides user feedback during navigation transition
    func navigateToCraftingWithMaterial(_ material: MaterialInventoryStack) async {
        isNavigatingToCraft = true
        selectedMaterial = material

        // Simulate navigation delay for loading state
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds

        // Navigate to crafting screen with preselected material
        await MainActor.run {
            navigationManager?.navigateTo(.crafting(preselectedItem: nil, preselectedMaterial: material))
        }

        isNavigatingToCraft = false
    }

    // MARK: - Computed Properties

    var styledItems: [EnhancedPlayerItem] {
        if case .loaded(let currentItems) = items {
            return currentItems.filter { $0.isStyled }
        }
        return []
    }

    var unstyledItems: [EnhancedPlayerItem] {
        if case .loaded(let currentItems) = items {
            return currentItems.filter { !$0.isStyled }
        }
        return []
    }

    // MARK: - Material Inventory Methods

    private func loadMaterialInventory() async {
        // Now using real material inventory endpoint from backend
        do {
            let materialStacks = try await materialsRepository.fetchMaterialInventory()
            materialInventory = .loaded(materialStacks)
        } catch let error as AppError {
            materialInventory = .error(error)
            FileLogger.shared.log("❌ Material inventory error: \(error)", level: .error, category: "Inventory")
        } catch {
            let appError = AppError.unknown(error)
            materialInventory = .error(appError)
            FileLogger.shared.log("❌ Material inventory error: \(appError)", level: .error, category: "Inventory")
        }
    }

    // MARK: - Item Detail Modal Methods

    func showItemDetail(for item: EnhancedPlayerItem) {
        selectedItemForDetail = item
        showingItemDetailModal = true
    }

    func dismissItemDetailModal() {
        showingItemDetailModal = false
        selectedItemForDetail = nil
    }

    func handleEquipAction() async {
        guard let item = selectedItemForDetail else { return }
        dismissItemDetailModal()

        // Directly equip the item
        await equipItem(item)
    }

    func handleCraftAction() async {
        guard let item = selectedItemForDetail else {
            FileLogger.shared.log("⚠️ handleCraftAction called but selectedItemForDetail is nil", level: .warning, category: "Inventory")
            return
        }
        FileLogger.shared.log("✅ handleCraftAction starting with item: \(item.baseType) (id: \(item.id))", level: .info, category: "Inventory")
        dismissItemDetailModal()
        await handleCraftNavigation(with: item)
    }

    func handleUpgradeAction() async {
        guard let item = selectedItemForDetail else {
            FileLogger.shared.log("⚠️ handleUpgradeAction called but selectedItemForDetail is nil", level: .warning, category: "Inventory")
            return
        }
        FileLogger.shared.log("✅ handleUpgradeAction starting with item: \(item.baseType) (id: \(item.id))", level: .info, category: "Inventory")

        // Transition to loading state and fetch upgrade cost
        await fetchUpgradeCostAndShowUpgradeScreen(itemId: item.id, item: item)
    }

    private func handleCraftNavigation(with item: EnhancedPlayerItem) async {
        isNavigatingToCraft = true

        // Simulate navigation delay for loading state
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds

        // Navigate to crafting screen with preselected item
        await MainActor.run {
            navigationManager?.navigateTo(.crafting(preselectedItem: item, preselectedMaterial: nil))
        }

        isNavigatingToCraft = false
    }

    private func handleUpgradeNavigation() async {
        guard let item = selectedItemForDetail else { return }

        isNavigatingToUpgrade = true

        // Simulate navigation delay for loading state
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds

        // Navigate to upgrade preview screen
        await MainActor.run {
            navigationManager?.navigateTo(.upgradePreview)
        }

        isNavigatingToUpgrade = false
    }

    func handleSellAction() {
        showingItemDetailModal = false  // Dismiss the detail modal without clearing the selected item
        showingSellConfirmation = true
    }

    func confirmSellItem() async {
        guard let item = selectedItemForDetail else { return }

        isSelling = true

        do {
            // Call sell API
            let response = try await repository.sellItem(itemId: item.id)

            // Remove from local state
            if case .loaded(var currentItems) = items {
                currentItems.removeAll { $0.id == item.id }
                items = .loaded(currentItems)
            }

            // Update app state with new gold balance from backend
            await MainActor.run {
                // Update currency balance for gold
                if case .loaded(let balances) = AppState.shared.currencies {
                    let updatedBalances = balances.map { balance in
                        if balance.currencyCode == .gold {
                            return CurrencyBalance(
                                currencyCode: balance.currencyCode,
                                balance: response.newGoldBalance,
                                updatedAt: balance.updatedAt
                            )
                        }
                        return balance
                    }
                    AppState.shared.setCurrencies(updatedBalances)
                } else {
                        AppState.shared.setCurrencies([
                        CurrencyBalance(
                            currencyCode: .gold,
                            balance: response.newGoldBalance,
                            updatedAt: ISO8601DateFormatter().string(from: Date())
                        )
                    ])
                }

                // Trigger gold shower animation
                goldShowerAmount = response.goldEarned
                showingGoldShower = true
            }

            FileLogger.shared.log("✅ Item sold successfully: \(response.itemName) for \(response.goldEarned) gold", level: .info, category: "Inventory")
        } catch let error as AppError {
            handleError(error)
            FileLogger.shared.log("❌ Failed to sell item: \(error)", level: .error, category: "Inventory")
        } catch {
            handleError(.unknown(error))
            FileLogger.shared.log("❌ Failed to sell item: \(error)", level: .error, category: "Inventory")
        }

        showingSellConfirmation = false
        selectedItemForDetail = nil  // Clear after selling
        isSelling = false
    }

    func cancelSell() {
        showingSellConfirmation = false
        selectedItemForDetail = nil  // Clear when canceling
    }

    // MARK: - Equipment Methods

    func getSlotForItem(_ item: EnhancedPlayerItem) -> EquipmentSlot {
        // Map base item types to equipment slots
        let baseType = item.baseType.lowercased()

        if baseType.contains("sword") || baseType.contains("staff") || baseType.contains("bow") || baseType.contains("wand") {
            return .weapon
        } else if baseType.contains("shield") || baseType.contains("tome") {
            return .offhand
        } else if baseType.contains("helm") || baseType.contains("crown") || baseType.contains("hat") {
            return .head
        } else if baseType.contains("armor") || baseType.contains("robe") || baseType.contains("chainmail") {
            return .armor
        } else if baseType.contains("boots") || baseType.contains("sandals") || baseType.contains("shoes") {
            return .feet
        } else if baseType.contains("ring") || baseType.contains("amulet") || baseType.contains("bracelet") {
            return .accessory_1
        } else if baseType.contains("pet") {
            return .pet
        } else {
            return .weapon // Default fallback
        }
    }

    func getAvailableItemsForSlot(_ slot: EquipmentSlot) -> [EnhancedPlayerItem] {
        guard case .loaded(let currentItems) = items else { return [] }

        return currentItems.filter { item in
            let itemSlot = getSlotForItem(item)
            return itemSlot == slot && !item.isEquipped
        }
    }

    private func equipItem(_ item: EnhancedPlayerItem) async {
        isEquipping = true
        let slot = getSlotForItem(item)
        let equipmentRepo = DefaultEquipmentRepository()

        do {
            // Call equipment API
            try await equipmentRepo.equipItem(slotName: slot.rawValue, itemId: item.id)

            // Refresh inventory to get authoritative state from backend
            await refreshInventory()

            // Show success feedback
            showSuccessToast(message: "\(item.baseType.capitalized) equipped", icon: "checkmark.shield.fill")

            FileLogger.shared.log("✅ Successfully equipped \(item.baseType) to \(slot.rawValue) slot", level: .info, category: "Inventory")
        } catch let error as AppError {
            handleError(error)
            FileLogger.shared.log("❌ Equipment API failed: \(error)", level: .error, category: "Inventory")
        } catch {
            handleError(.unknown(error))
            FileLogger.shared.log("❌ Equipment API failed: \(error)", level: .error, category: "Inventory")
        }

        isEquipping = false
    }

    // MARK: - Upgrade Methods

    func fetchUpgradeCost(itemId: String) async {
        upgradeCostData = .loading

        do {
            let costInfo = try await repository.fetchUpgradeCost(itemId: itemId)
            upgradeCostData = .loaded(costInfo)
        } catch let error as AppError {
            upgradeCostData = .error(error)
        } catch {
            upgradeCostData = .error(.unknown(error))
        }
    }

    private func fetchUpgradeCostAndShowUpgradeScreen(itemId: String, item: EnhancedPlayerItem) async {
        // Set loading state
        await MainActor.run {
            upgradeModalState = .loading(itemId: itemId)
        }

        do {
            let costInfo = try await repository.fetchUpgradeCost(itemId: itemId)
            upgradeCostData = .loaded(costInfo)

            // Transition to ready state to show upgrade screen
            await MainActor.run {
                upgradeModalState = .ready(
                    itemId: itemId,
                    costInfo: costInfo,
                    item: item
                )
            }

            FileLogger.shared.log("✅ Fetched upgrade cost: \(costInfo.goldCost) gold for level \(costInfo.currentLevel) -> \(costInfo.nextLevel)", level: .info, category: "Inventory")
        } catch let error as AppError {
            upgradeCostData = .error(error)
            handleError(error)
            upgradeModalState = .none
            FileLogger.shared.log("❌ Failed to fetch upgrade cost: \(error)", level: .error, category: "Inventory")
        } catch {
            let appError = AppError.unknown(error)
            upgradeCostData = .error(appError)
            handleError(appError)
            upgradeModalState = .none
            FileLogger.shared.log("❌ Failed to fetch upgrade cost: \(appError)", level: .error, category: "Inventory")
        }
    }

    func performUpgrade(itemId: String) async {
        upgradeInProgress = true
        defer { upgradeInProgress = false }

        // Transition to upgrading state
        await MainActor.run {
            upgradeModalState = .upgrading(itemId: itemId)
        }

        do {
            let upgradeResult = try await repository.upgradeItem(itemId: itemId)

            // Refresh inventory to get authoritative state
            await refreshInventory()

            // Update gold balance in AppState
            await MainActor.run {
                if case .loaded(let balances) = AppState.shared.currencies {
                    let updatedBalances = balances.map { balance in
                        if balance.currencyCode == .gold {
                            return CurrencyBalance(
                                currencyCode: balance.currencyCode,
                                balance: upgradeResult.newGoldBalance,
                                updatedAt: balance.updatedAt
                            )
                        }
                        return balance
                    }
                    AppState.shared.setCurrencies(updatedBalances)
                } else {
                    AppState.shared.setCurrencies([
                        CurrencyBalance(
                            currencyCode: .gold,
                            balance: upgradeResult.newGoldBalance,
                            updatedAt: ISO8601DateFormatter().string(from: Date())
                        )
                    ])
                }

                // Update selectedItemForDetail with the upgraded item
                if let upgradedItem = (items.value?.first { $0.id == itemId }) {
                    selectedItemForDetail = upgradedItem
                }
            }

            FileLogger.shared.log("✅ Item upgraded successfully to level \(upgradeResult.item.level)", level: .info, category: "Inventory")

            // Fetch new cost for next upgrade and transition back to ready state
            if let upgradedItem = items.value?.first(where: { $0.id == itemId }) {
                await fetchUpgradeCostAndShowUpgradeScreen(itemId: itemId, item: upgradedItem)
            }

        } catch let error as AppError {
            upgradeModalState = .none
            handleError(error)
        } catch {
            upgradeModalState = .none
            handleError(.unknown(error))
        }
    }

    // MARK: - Helper Methods

    private func calculateSellValue(for item: EnhancedPlayerItem) -> Int {
        // Basic sell value calculation based on level and styling
        let baseValue = item.level * 10
        let styledBonus = item.isStyled ? (item.appliedMaterials.count * 15) : 0
        return baseValue + styledBonus
    }

    private func handleError(_ error: AppError) {
        currentError = error
        showingErrorAlert = true
        FileLogger.shared.log("❌ InventoryViewModel error: \(error.localizedDescription)", level: .error, category: "Inventory")
    }

    private func showSuccessToast(message: String, icon: String = "checkmark.circle.fill") {
        let toastId = UUID()
        currentToastId = toastId
        successMessage = message
        successIcon = icon
        showingSuccessToast = true

        // Auto-dismiss after 3 seconds
        Task { @MainActor in
            try await Task.sleep(for: .seconds(3))
            if currentToastId == toastId {
                showingSuccessToast = false
            }
        }
    }

    func dismissSuccessToast() {
        showingSuccessToast = false
        currentToastId = nil
    }

    func dismissErrorAlert() {
        showingErrorAlert = false
        currentError = nil
    }
}