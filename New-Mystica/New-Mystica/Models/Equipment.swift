//
//  Equipment.swift
//  New-Mystica
//
//  Created by Claude Code
//

import Foundation

// MARK: - Player Stats Model (for equipment totals)
struct PlayerStats: Codable {
    let atkPower: Double
    let atkAccuracy: Double
    let defPower: Double
    let defAccuracy: Double

    enum CodingKeys: String, CodingKey {
        case atkPower, atkAccuracy, defPower, defAccuracy
    }
}

// MARK: - Equipment Slots Model
struct EquipmentSlots: Codable {
    let weapon: PlayerItem?
    let offhand: PlayerItem?
    let head: PlayerItem?
    let armor: PlayerItem?
    let feet: PlayerItem?
    let accessory1: PlayerItem?
    let accessory2: PlayerItem?
    let pet: PlayerItem?

    enum CodingKeys: String, CodingKey {
        case weapon, offhand, head, armor, feet, pet
        case accessory1 = "accessory_1"
        case accessory2 = "accessory_2"
    }
}

// MARK: - Equipment Model (Top-level Response)
struct Equipment: Codable {
    let slots: EquipmentSlots
    let totalStats: PlayerStats
    let equipmentCount: Int

    enum CodingKeys: String, CodingKey {
        case slots
        case totalStats = "total_stats"
        case equipmentCount = "equipment_count"
    }
}