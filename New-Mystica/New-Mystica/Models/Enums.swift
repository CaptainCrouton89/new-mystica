//
//  Enums.swift
//  New-Mystica
//
//  Created by Claude Code
//

import Foundation

enum Rarity: String, Codable {
    case common, uncommon, rare, epic, legendary
}

enum MaterialTheme: String, Codable {
    case defensive, offensive, balanced, exotic
}

enum EquipmentSlot: String, Codable {
    case weapon, offhand, head, armor, feet
    case accessory_1 = "accessory_1"
    case accessory_2 = "accessory_2"
    case pet
}