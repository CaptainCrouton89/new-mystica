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

    // MARK: - State
    var items: Loadable<[EnhancedPlayerItem]> = .idle
    var stacks: [ItemStack] = []
    var materials: Loadable<[MaterialTemplate]> = .idle

    // MARK: - Pagination State
    var currentPage: Int = 1
    var totalPages: Int = 1
    var totalItems: Int = 0
    var isLoading: Bool = false
    var canLoadMore: Bool = false

    // MARK: - UI State
    var selectedItem: EnhancedPlayerItem?
    var applyingMaterial: Bool = false

    init(repository: InventoryRepository = DefaultInventoryRepository()) {
        self.repository = repository
    }

    // MARK: - Public Methods

    func loadInventory() async {
        items = .loading
        currentPage = 1
        isLoading = true

        do {
            let response = try await repository.fetchInventory(page: currentPage)
            items = .loaded(response.items)
            stacks = response.stacks

            currentPage = response.pagination.currentPage
            totalPages = response.pagination.totalPages
            totalItems = response.pagination.totalItems
            canLoadMore = currentPage < totalPages
        } catch let error as AppError {
            items = .error(error)
        } catch {
            items = .error(.unknown(error))
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
            let response = try await repository.fetchInventory(page: currentPage + 1)

            // Accumulate items for infinite scroll
            if case .loaded(var currentItems) = items {
                currentItems.append(contentsOf: response.items)
                items = .loaded(currentItems)
            } else {
                items = .loaded(response.items)
            }

            // Replace stacks (they're not paginated)
            stacks = response.stacks

            currentPage = response.pagination.currentPage
            totalPages = response.pagination.totalPages
            canLoadMore = currentPage < totalPages
        } catch let error as AppError {
            items = .error(error)
        } catch {
            items = .error(.unknown(error))
        }
        isLoading = false
    }

    func refreshInventory() async {
        currentPage = 1
        stacks = []
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
}