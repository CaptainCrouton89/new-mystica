//
//  CraftingViewModel.swift
//  New-Mystica
//
//  Manages item crafting workflow with material application and progress tracking
//

import Foundation
import Observation

@Observable
final class CraftingViewModel {
    let repository: InventoryRepository

    // MARK: - State
    var item: EnhancedPlayerItem?
    var appliedMaterials: [ItemMaterialApplication] = []
    var previewStats: ItemStats?
    var craftingProgress: Loadable<EnhancedPlayerItem> = .idle
    var progress: Double = 0.0

    // MARK: - UI State
    var selectedMaterialSlot: Int = 0
    var availableMaterials: [MaterialTemplate] = []


    init(repository: InventoryRepository = DefaultInventoryRepository()) {
        self.repository = repository
    }

    // MARK: - Public Methods

    func selectItem(_ selectedItem: EnhancedPlayerItem) {
        self.item = selectedItem
        self.appliedMaterials = selectedItem.appliedMaterials
        self.previewStats = selectedItem.computedStats
        self.craftingProgress = .idle
        self.progress = 0.0
    }

    func applyMaterial(materialId: String, styleId: String) async {
        guard let currentItem = item else { return }

        craftingProgress = .loading
        progress = 0.0

        // Simulate 20-second blocking progress
        await simulateCraftingProgress()

        do {
            let updatedItem = try await repository.applyMaterial(
                itemId: currentItem.id,
                materialId: materialId,
                styleId: styleId,
                slotIndex: selectedMaterialSlot
            )

            self.item = updatedItem
            self.appliedMaterials = updatedItem.appliedMaterials
            self.previewStats = updatedItem.computedStats
            self.craftingProgress = .loaded(updatedItem)

        } catch let error as AppError {
            craftingProgress = .error(error)
        } catch {
            craftingProgress = .error(.unknown(error))
        }
    }

    func removeMaterial(at slotIndex: Int) async {
        guard let currentItem = item else { return }

        craftingProgress = .loading
        progress = 0.0

        do {
            let updatedItem = try await repository.removeMaterial(
                itemId: currentItem.id,
                slotIndex: slotIndex
            )

            self.item = updatedItem
            self.appliedMaterials = updatedItem.appliedMaterials
            self.previewStats = updatedItem.computedStats
            self.craftingProgress = .loaded(updatedItem)

        } catch let error as AppError {
            craftingProgress = .error(error)
        } catch {
            craftingProgress = .error(.unknown(error))
        }
    }

    func replaceMaterial(at slotIndex: Int, with newMaterialId: String) async {
        guard let currentItem = item else { return }

        craftingProgress = .loading
        progress = 0.0

        // Simulate 20-second blocking progress
        await simulateCraftingProgress()

        do {
            let updatedItem = try await repository.replaceMaterial(
                itemId: currentItem.id,
                slotIndex: slotIndex,
                newMaterialId: newMaterialId
            )

            self.item = updatedItem
            self.appliedMaterials = updatedItem.appliedMaterials
            self.previewStats = updatedItem.computedStats
            self.craftingProgress = .loaded(updatedItem)

        } catch let error as AppError {
            craftingProgress = .error(error)
        } catch {
            craftingProgress = .error(.unknown(error))
        }
    }

    func selectMaterialSlot(_ slot: Int) {
        selectedMaterialSlot = slot
    }

    func previewResult() {
        // Calculate preview stats based on base item + applied materials
        // For now, this just uses the current computed stats
        // In a full implementation, this would calculate potential stats changes
        guard let currentItem = item else { return }
        previewStats = currentItem.computedStats
    }

    func resetCrafting() {
        item = nil
        appliedMaterials = []
        previewStats = nil
        craftingProgress = .idle
        progress = 0.0
        selectedMaterialSlot = 0
    }

    // MARK: - Private Methods

    private func simulateCraftingProgress() async {
        let progressSteps = 20 // 20 steps over 20 seconds
        let stepDuration: Double = 1.0 // 1 second per step

        for step in 1...progressSteps {
            try? await Task.sleep(nanoseconds: UInt64(stepDuration * 1_000_000_000))
            await MainActor.run {
                self.progress = Double(step) / Double(progressSteps)
            }
        }
    }

    // MARK: - Computed Properties

    var canApplyMaterial: Bool {
        guard item != nil else { return false }
        return !craftingProgress.isLoading
    }

    var hasAppliedMaterials: Bool {
        return !appliedMaterials.isEmpty
    }

    var maxMaterialSlots: Int {
        // This could be based on item level or type
        // For now, using a simple calculation
        guard let currentItem = item else { return 0 }
        return min(3, max(1, currentItem.level / 10)) // 1-3 slots based on level
    }

    var isProcessing: Bool {
        return craftingProgress.isLoading
    }

    var progressPercentage: Int {
        return Int(progress * 100)
    }
}