//
//  CraftingViewModel.swift
//  New-Mystica
//
//  Manages item crafting workflow with material application and progress tracking
//  Implements T1: CraftingViewModel with State Management for US-401 Crafting Materials onto Items
//

import Foundation
import Observation

/// State enum for the crafting workflow with 5 distinct phases
enum CraftingState {
    case selecting           // Empty or partial slots
    case previewing          // Both slots filled, showing preview
    case crafting            // 20s generation in progress
    case results             // Success screen
    case error(AppError)     // Error with retry
}

@Observable
final class CraftingViewModel {
    private let inventoryRepository: InventoryRepository
    private let materialsRepository: MaterialsRepository

    // MARK: - Selection State
    var selectedItem: EnhancedPlayerItem?
    var selectedMaterial: MaterialInventoryStack?
    var craftingState: CraftingState = .selecting

    // MARK: - Data Loading (using Loadable state pattern)
    var availableItems: Loadable<[EnhancedPlayerItem]> = .idle
    var availableMaterials: Loadable<[MaterialInventoryStack]> = .idle

    // MARK: - Preview Calculations
    var baseStats: ItemStats?
    var previewStats: ItemStats?

    // MARK: - Crafting Progress (20s generation)
    var craftingProgress: Double = 0.0
    var isProcessing: Bool = false
    var progressMessage: String = ""

    // MARK: - Results
    var craftedItem: EnhancedPlayerItem?
    var craftCount: Int = 0
    var isFirstCraft: Bool = false

    init(
        inventoryRepository: InventoryRepository = DefaultInventoryRepository(),
        materialsRepository: MaterialsRepository = DefaultMaterialsRepository()
    ) {
        self.inventoryRepository = inventoryRepository
        self.materialsRepository = materialsRepository
    }

    // MARK: - Public Methods

    /// Load available items from InventoryRepository with pagination support
    func loadItems() async {
        availableItems = .loading

        do {
            let response = try await inventoryRepository.fetchInventory(
                page: 1,
                filter: nil,
                sortOption: nil
            )
            availableItems = .loaded(response.items)
        } catch let error as AppError {
            availableItems = .error(error)
        } catch {
            availableItems = .error(.unknown(error))
        }
    }

    /// Load material inventory from MaterialsRepository
    func loadMaterials() async {
        availableMaterials = .loading

        do {
            let materials = try await materialsRepository.fetchMaterialInventory()
            availableMaterials = .loaded(materials)
        } catch let error as AppError {
            availableMaterials = .error(error)
        } catch {
            availableMaterials = .error(.unknown(error))
        }
    }

    /// Update selectedItem and calculate preview if material also selected
    func selectItem(_ item: EnhancedPlayerItem) {
        self.selectedItem = item
        self.baseStats = item.computedStats

        // Auto-calculate preview if material also selected
        if selectedMaterial != nil {
            calculatePreviewStats()
        }

        updateCraftingState()
    }

    /// Update selectedMaterial and calculate preview if item also selected
    func selectMaterial(_ material: MaterialInventoryStack) {
        self.selectedMaterial = material

        // Auto-calculate preview if item also selected
        if selectedItem != nil {
            calculatePreviewStats()
        }

        updateCraftingState()
    }

    /// Compute stat differences for preview display
    func calculatePreviewStats() {
        guard let item = selectedItem,
              let material = selectedMaterial else {
            baseStats = nil
            previewStats = nil
            return
        }

        // Set base stats from selected item
        baseStats = item.computedStats

        // Apply material stat modifiers to calculate preview
        let baseStatDict = baseStats?.toDictionary() ?? [:]
        var previewStatDict = baseStatDict

        // Apply each stat modifier from the material
        let modifierDict = material.statModifiers.toDictionary()
        for (statName, modifier) in modifierDict {
            let currentValue = previewStatDict[statName] ?? 0.0
            previewStatDict[statName] = currentValue + modifier
        }

        // Convert back to ItemStats
        previewStats = ItemStats.fromDictionary(previewStatDict)
    }

    /// Apply material to item via API - called from CraftButton
    func applyMaterial() async {
        guard let item = selectedItem,
              let material = selectedMaterial else {
            craftingState = .error(.invalidInput("Missing item or material selection"))
            return
        }

        // Validate constraints
        if item.appliedMaterials.count >= 3 {
            craftingState = .error(.businessLogic("Item already has maximum materials (3/3)"))
            return
        }

        if material.quantity <= 0 {
            craftingState = .error(.businessLogic("Material not owned (quantity: 0)"))
            return
        }

        // Start crafting process
        craftingState = .crafting
        isProcessing = true
        craftingProgress = 0.0

        // Start 20s progress simulation
        Task {
            await simulateCraftingProgress()
        }

        do {
            let response = try await inventoryRepository.applyMaterial(
                itemId: item.id,
                materialId: material.materialId,
                styleId: material.styleId,
                slotIndex: 0 // Always use first available slot
            )

            // Update results state
            craftedItem = response
            craftCount = response.appliedMaterials.count  // Use materials count as proxy
            isFirstCraft = response.appliedMaterials.contains { $0.materialId == material.materialId && $0.styleId == material.styleId }

            craftingState = .results

        } catch let error as AppError {
            craftingState = .error(error)
        } catch {
            craftingState = .error(.unknown(error))
        }

        isProcessing = false
    }

    /// Reset state for "Return to Crafting" functionality
    func reset() {
        selectedItem = nil
        selectedMaterial = nil
        baseStats = nil
        previewStats = nil
        craftingState = .selecting
        craftingProgress = 0.0
        isProcessing = false
        progressMessage = ""
        craftedItem = nil
        craftCount = 0
        isFirstCraft = false
    }

    // MARK: - Private Methods

    /// Simulate 20s image generation with progress updates
    private func simulateCraftingProgress() async {
        let progressSteps = 20 // 20 steps over 20 seconds
        let stepDuration: Double = 1.0 // 1 second per step

        for step in 1...progressSteps {
            try? await Task.sleep(nanoseconds: UInt64(stepDuration * 1_000_000_000))
            await MainActor.run {
                self.craftingProgress = Double(step) / Double(progressSteps)
                self.progressMessage = "Generating image... \(step * 5)%"
            }
        }
    }

    /// Update crafting state based on current selections
    private func updateCraftingState() {
        switch (selectedItem, selectedMaterial) {
        case (nil, _), (_, nil):
            craftingState = .selecting
        case (_, _):
            craftingState = .previewing
        }
    }

    // MARK: - Computed Properties

    /// Whether material can be applied (both slots filled, not processing, item has < 3 materials)
    var canApplyMaterial: Bool {
        guard let item = selectedItem,
              selectedMaterial != nil,
              !isProcessing else {
            return false
        }
        return item.appliedMaterials.count < 3
    }

    /// Progress percentage for UI display
    var progressPercentage: Int {
        return Int(craftingProgress * 100)
    }
}