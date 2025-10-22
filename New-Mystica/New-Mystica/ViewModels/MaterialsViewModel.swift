//
//  MaterialsViewModel.swift
//  New-Mystica
//
//  Manages material catalog and player material inventory
//

import Foundation
import Observation

@Observable
final class MaterialsViewModel {
    let repository: MaterialsRepository

    // MARK: - State
    var allMaterials: Loadable<[MaterialTemplate]> = .idle
    var userInventory: Loadable<[MaterialInventoryStack]> = .idle

    // MARK: - UI State
    var selectedRarity: String?
    var selectedTheme: String?

    init(repository: MaterialsRepository = DefaultMaterialsRepository()) {
        self.repository = repository
    }

    // MARK: - Public Methods

    func loadMaterials() async {
        allMaterials = .loading

        do {
            let materials = try await repository.fetchAllMaterials()
            allMaterials = .loaded(materials)
        } catch let error as AppError {
            allMaterials = .error(error)
        } catch {
            allMaterials = .error(.unknown(error))
        }
    }

    func loadInventory() async {
        userInventory = .loading

        do {
            let inventory = try await repository.fetchMaterialInventory()
            userInventory = .loaded(inventory)
        } catch let error as AppError {
            userInventory = .error(error)
        } catch {
            userInventory = .error(.unknown(error))
        }
    }

    func refreshAll() async {
        await loadMaterials()
        await loadInventory()
    }

    // MARK: - Filtering

    func setRarityFilter(_ rarity: String?) {
        selectedRarity = rarity
    }

    func setThemeFilter(_ theme: String?) {
        selectedTheme = theme
    }

    func clearFilters() {
        selectedRarity = nil
        selectedTheme = nil
    }

    // MARK: - Computed Properties

    var filteredMaterials: [MaterialTemplate] {
        guard case .loaded(let materials) = allMaterials else { return [] }

        var filtered = materials

        if let theme = selectedTheme {
            filtered = filtered.filter { $0.theme == theme }
        }

        // Note: Rarity filtering would require a rarity field in MaterialTemplate
        // For now, we'll filter by theme only

        return filtered
    }

    var availableThemes: [String] {
        guard case .loaded(let materials) = allMaterials else { return [] }
        return Array(Set(materials.map { $0.theme })).sorted()
    }

    var ownedMaterialIds: Set<String> {
        guard case .loaded(let inventory) = userInventory else { return Set() }
        return Set(inventory.map { $0.materialId })
    }

    // Get inventory stack for a specific material
    func getInventoryStack(for materialId: String) -> MaterialInventoryStack? {
        guard case .loaded(let inventory) = userInventory else { return nil }
        return inventory.first { $0.materialId == materialId }
    }

    // Check if player owns a material
    func hasQuantity(for materialId: String, minimum: Int = 1) -> Bool {
        guard let stack = getInventoryStack(for: materialId) else { return false }
        return stack.quantity >= minimum
    }

    // Get total quantity of a material
    func getQuantity(for materialId: String) -> Int {
        return getInventoryStack(for: materialId)?.quantity ?? 0
    }
}