//
//  EquipmentViewModel.swift
//  New-Mystica
//
//

import Foundation
import Observation

@Observable
final class EquipmentViewModel {
    let repository: EquipmentRepository
    var inventoryViewModel: InventoryViewModel

    var equipment: Loadable<[Equipment]> = .idle

    var showingItemSelectionDrawer: Bool = false
    var selectedSlotForEquipping: EquipmentSlot?

    var showingItemDetailModal: Bool = false
    var selectedItemForDetail: PlayerItem?
    var selectedSlotForDetail: EquipmentSlot?

    init(
        repository: EquipmentRepository = DefaultEquipmentRepository(),
        inventoryViewModel: InventoryViewModel
    ) {
        self.repository = repository
        self.inventoryViewModel = inventoryViewModel
    }

    func fetchEquipment() async {
        equipment = .loading

        do {
            let items = try await repository.fetchEquipment()
            equipment = .loaded(items)
        } catch let error as AppError {
            equipment = .error(error)
        } catch {
            equipment = .error(.unknown(error))
        }
    }

    func equipItem(slotName: String, itemId: String) async {
        do {
            try await repository.equipItem(slotName: slotName, itemId: itemId)
            await fetchEquipment()
        } catch let error as AppError {
            equipment = .error(error)
        } catch {
            equipment = .error(.unknown(error))
        }
    }

    func unequipItem(slotName: String) async {
        do {
            try await repository.unequipItem(slotName: slotName)
            await fetchEquipment()
        } catch let error as AppError {
            equipment = .error(error)
        } catch {
            equipment = .error(.unknown(error))
        }
    }


    func showItemDetail(for item: PlayerItem, slot: EquipmentSlot) {
        selectedItemForDetail = item
        selectedSlotForDetail = slot
        showingItemDetailModal = true
    }

    func dismissItemDetail() {
        showingItemDetailModal = false
        selectedItemForDetail = nil
        selectedSlotForDetail = nil
    }

    /// Converts the currently selected PlayerItem to EnhancedPlayerItem and sets it in InventoryViewModel
    /// This enables craft/upgrade handlers to work correctly from equipment screen
    func prepareItemForInventoryAction() {
        guard let playerItem = selectedItemForDetail else {
            FileLogger.shared.log("⚠️ No selectedItemForDetail to prepare for inventory action", level: .warning, category: "Equipment")
            return
        }

        // Find the matching EnhancedPlayerItem from inventory
        guard case .loaded(let items) = inventoryViewModel.items else {
            FileLogger.shared.log("⚠️ Inventory not loaded, cannot prepare item for action", level: .warning, category: "Equipment")
            return
        }

        if let enhancedItem = items.first(where: { $0.id == playerItem.id }) {
            inventoryViewModel.selectedItemForDetail = enhancedItem
            FileLogger.shared.log("✅ Prepared item for inventory action: \(enhancedItem.baseType) (id: \(enhancedItem.id))", level: .info, category: "Equipment")
        } else {
            FileLogger.shared.log("❌ Could not find matching EnhancedPlayerItem for id: \(playerItem.id)", level: .error, category: "Equipment")
        }
    }

    func unequipCurrentItem() async {
        guard let slot = selectedSlotForDetail else { return }

        await unequipItem(slotName: slot.rawValue)
        dismissItemDetail()
    }


    func showItemSelection(for slot: EquipmentSlot) {
        selectedSlotForEquipping = slot
        showingItemSelectionDrawer = true
    }

    func dismissItemSelection() {
        showingItemSelectionDrawer = false
        selectedSlotForEquipping = nil
    }

    func getAvailableItemsForSlot(_ slot: EquipmentSlot) -> [EnhancedPlayerItem] {
        guard case .loaded(let items) = inventoryViewModel.items else {
            FileLogger.shared.log("⚠️ Inventory not loaded for equipment slot filtering. State: \(inventoryViewModel.items)", level: .warning, category: "Equipment")
            return []
        }

        let available = items.filter { item in
            let matchesSlot = categoryMatchesSlot(category: item.category, slot: slot)
            return matchesSlot && !item.isEquipped
        }

        FileLogger.shared.log("✅ Available items for \(slot.rawValue) slot: \(available.count) of \(items.count) total items", level: .debug, category: "Equipment")
        return available
    }

    func equipItemFromInventory(_ item: EnhancedPlayerItem) async {
        guard let slot = selectedSlotForEquipping else { return }

        do {
            try await repository.equipItem(slotName: slot.rawValue, itemId: item.id)

            await fetchEquipment()
            await inventoryViewModel.refreshInventory()

            dismissItemSelection()

            FileLogger.shared.log("✅ Successfully equipped \(item.baseType) to \(slot.rawValue) slot", level: .info, category: "Equipment")
        } catch let error as AppError {
            equipment = .error(error)
            FileLogger.shared.log("❌ Failed to equip item: \(error)", level: .error, category: "Equipment")
        } catch {
            equipment = .error(.unknown(error))
            FileLogger.shared.log("❌ Failed to equip item: \(error)", level: .error, category: "Equipment")
        }
    }


    private func categoryMatchesSlot(category: String, slot: EquipmentSlot) -> Bool {
        let categoryLower = category.lowercased()

        switch slot {
        case .weapon:
            return categoryLower == "weapon"
        case .offhand:
            return categoryLower == "offhand"
        case .head:
            return categoryLower == "head"
        case .armor:
            return categoryLower == "armor"
        case .feet:
            return categoryLower == "feet"
        case .accessory_1, .accessory_2:
            return categoryLower == "accessory"
        case .pet:
            return categoryLower == "pet"
        }
    }
}
