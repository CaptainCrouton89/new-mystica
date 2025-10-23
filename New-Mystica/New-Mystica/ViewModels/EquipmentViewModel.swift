//
//  EquipmentViewModel.swift
//  New-Mystica
//
//  Manages equipment state and interactions
//

import Foundation
import Observation

@Observable
final class EquipmentViewModel {
    let repository: EquipmentRepository
    var inventoryViewModel: InventoryViewModel

    var equipment: Loadable<[Equipment]> = .idle

    // MARK: - Drawer State
    var showingItemSelectionDrawer: Bool = false
    var selectedSlotForEquipping: EquipmentSlot?

    // MARK: - Modal State
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
            // Refresh equipment list
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
            // Refresh equipment list
            await fetchEquipment()
        } catch let error as AppError {
            equipment = .error(error)
        } catch {
            equipment = .error(.unknown(error))
        }
    }

    // MARK: - Modal Methods

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

    func unequipCurrentItem() async {
        guard let slot = selectedSlotForDetail else { return }

        await unequipItem(slotName: slot.rawValue)
        dismissItemDetail()
    }

    // MARK: - Drawer Methods

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
            print("⚠️ [EQUIPMENT] Inventory not loaded. State: \(inventoryViewModel.items)")
            return []
        }

        let available = items.filter { item in
            let matchesSlot = categoryMatchesSlot(category: item.category, slot: slot)
            return matchesSlot && !item.isEquipped
        }

        print("✅ [EQUIPMENT] Available items for \(slot.rawValue) slot: \(available.count) of \(items.count) total items")
        return available
    }

    func equipItemFromInventory(_ item: EnhancedPlayerItem) async {
        guard let slot = selectedSlotForEquipping else { return }

        do {
            // Call the equipment API
            try await repository.equipItem(slotName: slot.rawValue, itemId: item.id)

            // Refresh both equipment and inventory
            await fetchEquipment()
            await inventoryViewModel.refreshInventory()

            // Close the drawer
            dismissItemSelection()

            print("✅ Successfully equipped \(item.baseType) to \(slot.rawValue) slot")
        } catch let error as AppError {
            equipment = .error(error)
            print("❌ Failed to equip item: \(error)")
        } catch {
            equipment = .error(.unknown(error))
            print("❌ Failed to equip item: \(error)")
        }
    }

    // MARK: - Helper Methods

    /// Map backend category to equipment slot
    /// Backend categories: 'weapon', 'offhand', 'head', 'armor', 'feet', 'accessory', 'pet'
    /// Frontend slots: weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet
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
            // Both accessory slots can accept items with category "accessory"
            return categoryLower == "accessory"
        case .pet:
            return categoryLower == "pet"
        }
    }
}
