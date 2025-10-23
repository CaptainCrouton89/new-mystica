//
//  InventoryViewModel.swift
//  New-Mystica
//
//  Manages player inventory state and material application
//

import Foundation
import Observation

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

    // MARK: - Error State
    var currentError: AppError?
    var showingErrorAlert: Bool = false

    // MARK: - Success State
    var showingSuccessToast: Bool = false
    var successMessage: String = ""
    var successIcon: String = "checkmark.circle.fill"

    init(repository: InventoryRepository = DefaultInventoryRepository(), materialsRepository: MaterialsRepository = DefaultMaterialsRepository(), navigationManager: NavigationManager? = nil) {
        self.repository = repository
        self.materialsRepository = materialsRepository
        self.navigationManager = navigationManager
    }

    // MARK: - Public Methods

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

            print("✅ [INVENTORY] Loaded \(response.items.count) items from inventory API")

            // Load material inventory alongside items
            await loadMaterialInventory()

            currentPage = response.pagination.currentPage
            totalPages = response.pagination.totalPages
            totalItems = response.pagination.totalItems
            canLoadMore = currentPage < totalPages
        } catch let error as AppError {
            items = .error(error)
            materialInventory = .error(error)
            print("❌ [INVENTORY] Failed to load inventory: \(error)")
        } catch {
            let appError = AppError.unknown(error)
            items = .error(appError)
            materialInventory = .error(appError)
            print("❌ [INVENTORY] Failed to load inventory: \(appError)")
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
print("❌ Error: \(error)")
        } catch {
            let appError = AppError.unknown(error)
            items = .error(appError)
print("❌ Error: \(appError)")
        }
        isLoading = false
    }

    func refreshInventory() async {
        currentPage = 1
        await loadInventory()
    }

    func applyMaterial(itemId: String, materialId: String, styleId: String, slotIndex: Int = 0) async {
        applyingMaterial = true
        defer { applyingMaterial = false }

        do {
            let updatedItem = try await repository.applyMaterial(
                itemId: itemId,
                materialId: materialId,
                styleId: styleId,
                slotIndex: slotIndex
            )

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

    func navigateToCraftingWithMaterial(_ material: MaterialInventoryStack) async {
        isNavigatingToCraft = true
        selectedMaterial = material

        // Simulate navigation delay for loading state
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds

        // TODO: Navigate to crafting screen when F-04 integration is complete
        print("🔨 Navigate to crafting with material: \(material.name) (ID: \(material.materialId))")

        showSuccessToast(message: "Opening crafting with \(material.name)", icon: "hammer.fill")
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
            print("❌ Material Inventory Error: \(error)")
        } catch {
            let appError = AppError.unknown(error)
            materialInventory = .error(appError)
print("❌ Error: \(appError)")
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
        dismissItemDetailModal()
        await handleCraftNavigation()
    }

    func handleUpgradeAction() async {
        dismissItemDetailModal()
        await handleUpgradeNavigation()
    }

    private func handleCraftNavigation() async {
        isNavigatingToCraft = true

        // Simulate navigation delay for loading state
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds

        // Navigate to crafting screen with preselected item
        await MainActor.run {
            navigationManager?.navigateTo(.crafting(preselectedItem: selectedItemForDetail, preselectedMaterial: nil))
        }

        isNavigatingToCraft = false
    }

    private func handleUpgradeNavigation() async {
        isNavigatingToUpgrade = true

        // Simulate navigation delay for loading state
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds

        // TODO: Navigate to upgrade screen when F-06 integration is complete
        print("⬆️ Navigate to upgrade screen")

        showSuccessToast(message: "Opening upgrade screen", icon: "arrow.up.circle.fill")
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
                }

                showSuccessToast(message: "Sold for \(response.goldEarned) gold", icon: "dollarsign.circle.fill")
            }

            print("✅ Item sold successfully: \(response.itemName) for \(response.goldEarned) gold")
        } catch let error as AppError {
            handleError(error)
            print("❌ Failed to sell item: \(error)")
        } catch {
            handleError(.unknown(error))
            print("❌ Failed to sell item: \(error)")
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

            print("✅ Successfully equipped \(item.baseType) to \(slot.rawValue) slot")
        } catch let error as AppError {
            handleError(error)
            print("❌ Equipment API failed: \(error)")
        } catch {
            handleError(.unknown(error))
            print("❌ Equipment API failed: \(error)")
        }

        isEquipping = false
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
        print("❌ InventoryViewModel Error: \(error.localizedDescription)")
    }

    private func showSuccessToast(message: String, icon: String = "checkmark.circle.fill") {
        successMessage = message
        successIcon = icon
        showingSuccessToast = true

        // Auto-dismiss after 3 seconds
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            if successMessage == message { // Only dismiss if it's still the same message
                showingSuccessToast = false
            }
        }
    }

    func dismissSuccessToast() {
        showingSuccessToast = false
    }

    func dismissErrorAlert() {
        showingErrorAlert = false
        currentError = nil
    }
}