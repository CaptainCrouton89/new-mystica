//
//  CraftingViewModel.swift
//  New-Mystica
//
//

import Foundation
import Observation

/// Crafting workflow state machine with 5 phases.
enum CraftingState {
    case selecting
    case previewing
    case crafting
    case results
    case error(AppError)
}

/// Manages crafting workflow with material application and progress tracking.
@Observable
final class CraftingViewModel {
    private let inventoryRepository: InventoryRepository
    private let materialsRepository: MaterialsRepository

    var selectedItem: EnhancedPlayerItem?
    var selectedMaterial: MaterialInventoryStack?
    var craftingState: CraftingState = .selecting

    var availableItems: Loadable<[EnhancedPlayerItem]> = .idle
    var availableMaterials: Loadable<[MaterialInventoryStack]> = .idle

    var baseStats: ItemStats?
    var previewStats: ItemStats?

    var craftingProgress: Double = 0.0
    var isProcessing: Bool = false
    var progressMessage: String = ""

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

    func selectItem(_ item: EnhancedPlayerItem) {
        FileLogger.shared.log("🎨 CraftingViewModel.selectItem called with: \(item.baseType) (id: \(item.id))", level: .info, category: "Crafting")
        self.selectedItem = item
        self.baseStats = item.computedStats

        FileLogger.shared.log("🎨 Selected item stored: \(self.selectedItem?.baseType ?? "nil")", level: .info, category: "Crafting")

        if selectedMaterial != nil {
            calculatePreviewStats()
        }

        updateCraftingState()
    }

    func selectMaterial(_ material: MaterialInventoryStack) {
        FileLogger.shared.log("🎨 CraftingViewModel.selectMaterial called with: \(material.name) (id: \(material.materialId))", level: .info, category: "Crafting")
        self.selectedMaterial = material

        FileLogger.shared.log("🎨 Selected material stored: \(self.selectedMaterial?.name ?? "nil")", level: .info, category: "Crafting")

        if selectedItem != nil {
            calculatePreviewStats()
        }

        updateCraftingState()
    }

    func calculatePreviewStats() {
        guard let item = selectedItem,
              let material = selectedMaterial else {
            baseStats = nil
            previewStats = nil
            return
        }

        baseStats = item.computedStats

        let baseStatDict = baseStats?.toDictionary() ?? [:]
        var previewStatDict = baseStatDict

        let modifierDict = material.statModifiers.toDictionary()
        for (statName, modifier) in modifierDict {
            let currentValue = previewStatDict[statName] ?? 0.0
            previewStatDict[statName] = currentValue + modifier
        }

        previewStats = ItemStats.fromDictionary(previewStatDict)
    }

    func applyMaterial() async {
        guard let item = selectedItem,
              let material = selectedMaterial else {
            craftingState = .error(.invalidInput("Missing item or material selection"))
            return
        }

        if item.appliedMaterials.count >= 3 {
            craftingState = .error(.businessLogic("Item already has maximum materials (3/3)"))
            return
        }

        if material.quantity <= 0 {
            craftingState = .error(.businessLogic("Material not owned (quantity: 0)"))
            return
        }

        craftingState = .crafting
        isProcessing = true
        craftingProgress = 0.0

        Task {
            await simulateCraftingProgress()
        }

        do {
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

    private func updateCraftingState() {
        switch (selectedItem, selectedMaterial) {
        case (nil, _), (_, nil):
            craftingState = .selecting
        case (_, _):
            craftingState = .previewing
        }
    }


    var canApplyMaterial: Bool {
        guard let item = selectedItem,
              selectedMaterial != nil,
              !isProcessing else {
            return false
        }
        return item.appliedMaterials.count < 3
    }

    var progressPercentage: Int {
        return Int(craftingProgress * 100)
    }
}