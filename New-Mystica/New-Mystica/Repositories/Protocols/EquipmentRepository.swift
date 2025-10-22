//
//  EquipmentRepository.swift
//  New-Mystica
//
//  Protocol for equipment-related API calls
//  Implementations handle equipping, unequipping items and fetching equipment state
//

import Foundation

protocol EquipmentRepository {
    func fetchEquipment() async throws -> [Equipment]
    func equipItem(slotName: String, itemId: String) async throws
    func unequipItem(slotName: String) async throws
}
