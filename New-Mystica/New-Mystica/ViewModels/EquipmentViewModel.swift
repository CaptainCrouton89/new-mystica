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
    var equipment: Loadable<[Equipment]> = .idle

    init(repository: EquipmentRepository = EquipmentRepositoryImpl()) {
        self.repository = repository
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
}
