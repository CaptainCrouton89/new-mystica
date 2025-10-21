//
//  Location.swift
//  New-Mystica
//
//  Created by Claude Code
//

import Foundation

struct Location: Codable, Identifiable {
    let id: UUID
    let lat: Double
    let lng: Double
    let locationType: String?
    let name: String?
    let countryCode: String?
    let stateCode: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case lat
        case lng
        case locationType = "location_type"
        case name
        case countryCode = "country_code"
        case stateCode = "state_code"
        case createdAt = "created_at"
    }
}