//
//  LocationRepository.swift
//  New-Mystica
//
//  Protocol for location and world-related API calls
//  Handles nearby locations, zones, and location details
//

import Foundation

protocol LocationRepository {
    /// Fetch nearby locations within radius
    /// - Parameters:
    ///   - userLocation: User's current coordinates (latitude, longitude)
    ///   - radiusKm: Search radius in kilometers
    /// - Returns: Array of locations within range, sorted by distance
    func fetchNearby(userLocation: (latitude: Double, longitude: Double), radiusKm: Double) async throws -> [Location]

    /// Get detailed information for specific location
    /// - Parameter locationId: Location ID to fetch details for
    /// - Returns: Complete location data with enemy levels and materials
    func getLocationDetails(locationId: String) async throws -> Location

    /// Fetch all available zones/biomes
    /// - Returns: Array of zones with their location lists
    func fetchZones() async throws -> [Zone]

    /// Get detailed information for specific zone
    /// - Parameter zoneId: Zone ID to fetch details for
    /// - Returns: Complete zone data with locations and material pools
    func getZoneDetails(zoneId: String) async throws -> Zone

    /// Auto-generate a "Goblin Den" location at user's position if no locations exist within 100m
    /// - Parameter userLocation: User's current coordinates (latitude, longitude)
    /// - Returns: Newly created location, or nil if location already exists within 100m
    func autoGenerate(userLocation: (latitude: Double, longitude: Double)) async throws -> Location?
}