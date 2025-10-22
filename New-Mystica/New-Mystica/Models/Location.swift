//
//  Location.swift
//  New-Mystica
//
//  Location and world models for exploration and mapping
//

import Foundation

// MARK: - Location Model
struct Location: APIModel, Identifiable {
    let id: String
    let name: String
    let lat: Double
    let lng: Double
    let locationType: String
    let stateCode: String
    let countryCode: String
    let enemyLevel: Int
    let materialDropPool: [String]
    let distanceMeters: Int

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case lat
        case lng
        case locationType = "location_type"
        case stateCode = "state_code"
        case countryCode = "country_code"
        case enemyLevel = "enemy_level"
        case materialDropPool = "material_drop_pool"
        case distanceMeters = "distance_meters"
    }
}

// MARK: - Zone Model
struct Zone: APIModel {
    let id: String
    let name: String
    let biomeType: BiomeType
    let locations: [Location]
    let materialDropPool: [String]

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case biomeType = "biome_type"
        case locations
        case materialDropPool = "material_drop_pool"
    }
}

// MARK: - Biome Type Enum
enum BiomeType: String, Codable, CaseIterable {
    case urban = "urban"
    case forest = "forest"
    case desert = "desert"
    case coastal = "coastal"
    case mountain = "mountain"
    case plains = "plains"
    case swamp = "swamp"
    case arctic = "arctic"
}

// MARK: - Nearby Locations Response
struct NearbyLocationsResponse: APIModel {
    let locations: [Location]

    enum CodingKeys: String, CodingKey {
        case locations
    }
}