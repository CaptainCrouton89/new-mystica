//
//  DefaultEquipmentRepository.swift
//  New-Mystica
//
//  Implementation of EquipmentRepository using unified APIClient
//  Handles 8-slot equipment system with equip/unequip operations
//

import Foundation

final class DefaultEquipmentRepository: EquipmentRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = APIClient.shared) {
        self.apiClient = apiClient
    }

    // MARK: - EquipmentRepository Protocol

    func fetchEquipment() async throws -> [Equipment] {
        let response: Equipment = try await apiClient.get(endpoint: "/equipment")

        // Convert Equipment model to array format expected by the protocol
        var equipmentArray: [Equipment] = []

        // For now, return the single Equipment object as an array
        // This maintains compatibility with the existing protocol
        equipmentArray.append(response)

        return equipmentArray
    }

    func equipItem(slotName: String, itemId: String) async throws {
        struct EquipRequest: Encodable {
            let itemId: String

            enum CodingKeys: String, CodingKey {
                case itemId = "item_id"
            }
        }

        struct EquipResponse: Decodable {
            let success: Bool
            let slot: String
        }

        let request = EquipRequest(itemId: itemId)

        let _: EquipResponse = try await apiClient.post(
            endpoint: "/equipment/equip",
            body: request
        )
    }

    func unequipItem(slotName: String) async throws {
        struct UnequipRequest: Encodable {
            let slot: String
        }

        struct UnequipResponse: Decodable {
            let success: Bool
        }

        let request = UnequipRequest(slot: slotName)

        let _: UnequipResponse = try await apiClient.post(
            endpoint: "/equipment/unequip",
            body: request
        )
    }
}