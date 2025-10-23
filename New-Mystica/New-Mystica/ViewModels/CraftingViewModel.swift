//
//  CraftingViewModel.swift
//  New-Mystica
//
//  Manages item crafting workflow with material application and progress tracking
//  Implements T1: CraftingViewModel with State Management for US-401 Crafting Materials onto Items
//

import Foundation
import Observation

/// State machine for the crafting workflow with 5 distinct phases.
///
/// The crafting state drives UI presentation and determines which operations are available:
/// - **selecting**: Initial state where item or material slots may be empty
/// - **previewing**: Both item and material selected, preview stats calculated
/// - **crafting**: 20-second material application process in progress
/// - **results**: Successfully crafted item with before/after comparison
/// - **error**: Error state with specific AppError for retry handling
enum CraftingState {
    case selecting           // Empty or partial slots
    case previewing          // Both slots filled, showing preview
    case crafting            // 20s generation in progress
    case results             // Success screen
    case error(AppError)     // Error with retry
}

/// Manages the item crafting workflow with material application and 20-second generation process.
///
/// This ViewModel implements a state machine-driven crafting system that guides users through:
/// 1. **Selection Phase**: Choose item and material from loaded inventories
/// 2. **Preview Phase**: Calculate and display stat modifications before crafting
/// 3. **Crafting Phase**: 20-second progress simulation with backend material application
/// 4. **Results Phase**: Display crafted item with before/after stat comparison
///
/// ## State Machine Architecture
/// The `CraftingState` enum drives all UI transitions and determines available operations.
/// State transitions are automatic based on selection status and API responses.
///
/// ## Data Management
/// Uses `Loadable<T>` pattern for async operations:
/// - `availableItems`: Paginated inventory items from InventoryRepository
/// - `availableMaterials`: Material stacks from MaterialsRepository
/// - Preview calculations are computed locally using stat modifiers
///
/// ## Business Logic
/// - Validates material slot availability (max 3 materials per item)
/// - Checks material ownership before crafting
/// - Handles concurrent progress simulation and API calls during crafting
/// - Maintains crafting statistics (count, first-time crafting flags)
///
/// - Important: The 20-second progress simulation runs independently of the API call
///   to provide immediate user feedback while the backend processes the request.
/// - Note: Preview stats are calculated client-side but final results come from backend
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

    /// Loads available items from InventoryRepository for crafting selection.
    ///
    /// Fetches the first page of inventory items for material application.
    /// Only items that can accept materials (< 3 materials applied) should be shown in UI.
    ///
    /// - Note: Currently loads page 1 only. Future enhancement could add pagination
    ///   support for large inventories or filtering for craftable items only.
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

    /// Selects an item for crafting and triggers state machine update.
    ///
    /// Updates the crafting workflow by:
    /// 1. Setting the selected item and caching its base stats
    /// 2. Auto-calculating preview stats if material is already selected
    /// 3. Triggering state machine transition (selecting → previewing if both slots filled)
    ///
    /// - Parameter item: The item to select for material application
    ///
    /// - Important: Automatically recalculates preview stats when both item and material
    ///   are selected. Base stats are cached for before/after comparisons.
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

    /// Executes the material application workflow with progress tracking and validation.
    ///
    /// Implements the core crafting operation by:
    /// 1. **Validation**: Checks item/material selection, slot availability, and ownership
    /// 2. **Progress Simulation**: Starts 20-second visual progress for user feedback
    /// 3. **API Call**: Applies material via repository with automatic slot assignment
    /// 4. **Results Processing**: Updates crafting statistics and transitions to results state
    ///
    /// ## State Transitions
    /// - Success: `previewing` → `crafting` → `results`
    /// - Failure: `previewing` → `crafting` → `error(AppError)`
    ///
    /// ## Validation Rules
    /// - Item must have < 3 materials applied (enforced twice: here and backend)
    /// - Material quantity must be > 0 (player ownership check)
    /// - Both item and material must be selected
    ///
    /// - Important: Progress simulation runs concurrently with API call to provide
    ///   immediate user feedback. The backend determines final slot assignment.
    /// - Throws: Business logic errors are captured and converted to error state
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
            // Find first available slot (0-2)
            let occupiedSlots = Set(item.materials.map { $0.slotIndex })
            let availableSlot = (0...2).first { !occupiedSlots.contains($0) }

            guard let slotIndex = availableSlot else {
                throw AppError.businessLogic("Item already has maximum 3 materials applied")
            }

            let response = try await inventoryRepository.applyMaterial(
                itemId: item.id,
                materialId: material.materialId,
                styleId: material.styleId,
                slotIndex: slotIndex
            )

            // Update results state
            craftedItem = response
            craftCount = response.appliedMaterials.count  // Use materials count as proxy
            isFirstCraft = response.appliedMaterials.contains { $0.material?.id == material.materialId && $0.material?.styleId == material.styleId }

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
                self.progressMessage = "Crafting item... \(step * 5)%"
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