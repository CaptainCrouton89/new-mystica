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
    let inventoryViewModel: InventoryViewModel

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
            let itemSlot = getSlotForItemType(item.baseType)
            return itemSlot == slot && !item.isEquipped
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

    /// Map base item types to equipment slots (same logic as InventoryViewModel)
    private func getSlotForItemType(_ baseType: String) -> EquipmentSlot {
        let lowercased = baseType.lowercased()

        if lowercased.contains("sword") || lowercased.contains("staff") || lowercased.contains("bow") || lowercased.contains("wand") {
            return .weapon
        } else if lowercased.contains("shield") || lowercased.contains("tome") {
            return .offhand
        } else if lowercased.contains("helm") || lowercased.contains("crown") || lowercased.contains("hat") {
            return .head
        } else if lowercased.contains("armor") || lowercased.contains("robe") || lowercased.contains("chainmail") {
            return .armor
        } else if lowercased.contains("boots") || lowercased.contains("sandals") || lowercased.contains("shoes") {
            return .feet
        } else if lowercased.contains("ring") || lowercased.contains("amulet") || lowercased.contains("bracelet") {
            return .accessory_1
        } else if lowercased.contains("pet") {
            return .pet
        } else {
            return .weapon // Default fallback
        }
    }
}
