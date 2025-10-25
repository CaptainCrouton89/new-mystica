//
//  DefaultLocationRepository.swift
//  New-Mystica
//
//  Implementation of LocationRepository using unified APIClient
//  Handles nearby locations, zones, and location details for location-based gameplay
//

import Foundation

final class DefaultLocationRepository: LocationRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = APIClient.shared) {
        self.apiClient = apiClient
    }

    // MARK: - LocationRepository Protocol

    func fetchNearby(userLocation: (latitude: Double, longitude: Double), radiusKm: Double) async throws -> [Location] {
        print("🗺️ DefaultLocationRepository: Fetching nearby locations for lat: \(userLocation.latitude), lng: \(userLocation.longitude), radius: \(radiusKm)km")
        
        // Convert radius from km to meters for API (API expects meters)
        let radiusMeters = Int(radiusKm * 1000)
        print("🗺️ DefaultLocationRepository: Converted radius to \(radiusMeters) meters")

        let endpoint = "/locations/nearby?lat=\(userLocation.latitude)&lng=\(userLocation.longitude)&radius=\(radiusMeters)"
        print("🗺️ DefaultLocationRepository: Making API call to endpoint: \(endpoint)")

        do {
            // Backend returns {locations: [...]} directly without ApiResponseWrapper
            let response: NearbyLocationsResponse = try await apiClient.get(endpoint: endpoint)
            print("🗺️ DefaultLocationRepository: Successfully received \(response.locations.count) locations from API")
            return response.locations
        } catch {
            print("🗺️ DefaultLocationRepository: API call failed with error: \(error)")
            throw error
        }
    }

    func getLocationDetails(locationId: String) async throws -> Location {
        let location: Location = try await apiClient.get(endpoint: "/locations/\(locationId)")
        return location
    }

    func fetchZones() async throws -> [Zone] {
        struct ZonesResponse: Decodable {
            let zones: [Zone]
        }

        let response: ZonesResponse = try await apiClient.get(endpoint: "/zones")
        return response.zones
    }

    func getZoneDetails(zoneId: String) async throws -> Zone {
        let zone: Zone = try await apiClient.get(endpoint: "/zones/\(zoneId)")
        return zone
    }
}