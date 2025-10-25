//
//  DefaultLocationRepository.swift
//  New-Mystica
//
//  Implementation of LocationRepository using unified APIClient
//  Handles nearby locations, zones, and location details for location-based gameplay
//

import Foundation
import CoreLocation

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

    func autoGenerate(userLocation: (latitude: Double, longitude: Double)) async throws -> Location? {
        print("🗺️ DefaultLocationRepository: Auto-generating location at lat: \(userLocation.latitude), lng: \(userLocation.longitude)")

        // Reverse geocode to get state and country codes
        let (stateCode, countryCode) = await reverseGeocode(latitude: userLocation.latitude, longitude: userLocation.longitude)
        print("🗺️ DefaultLocationRepository: Reverse geocode result - state: \(stateCode ?? "nil"), country: \(countryCode ?? "nil")")

        struct AutoGenerateRequest: Encodable {
            let lat: Double
            let lng: Double
            let state_code: String?
            let country_code: String?
        }

        struct AutoGenerateResponse: Decodable {
            let success: Bool
            let location: Location?
            let message: String?
        }

        let request = AutoGenerateRequest(
            lat: userLocation.latitude,
            lng: userLocation.longitude,
            state_code: stateCode,
            country_code: countryCode
        )
        let response: AutoGenerateResponse = try await apiClient.post(endpoint: "/locations/auto-generate", body: request)

        print("🗺️ DefaultLocationRepository: Auto-generate response - success: \(response.success), location: \(response.location != nil)")
        return response.location
    }

    /// Reverse geocode coordinates to extract state and country codes
    private func reverseGeocode(latitude: Double, longitude: Double) async -> (stateCode: String?, countryCode: String?) {
        let geocoder = CLGeocoder()
        let location = CLLocation(latitude: latitude, longitude: longitude)

        do {
            let placemarks = try await geocoder.reverseGeocodeLocation(location)
            guard let placemark = placemarks.first else {
                print("🗺️ DefaultLocationRepository: No placemark found for coordinates")
                return (nil, nil)
            }

            // Extract state code (administrativeArea is like "CA", "NY", "Maharashtra")
            let stateCode = placemark.administrativeArea

            // Extract country code (isoCountryCode is like "US", "IN", "GB")
            let countryCode = placemark.isoCountryCode

            print("🗺️ DefaultLocationRepository: Geocoded - state: \(stateCode ?? "nil"), country: \(countryCode ?? "nil")")
            return (stateCode, countryCode)
        } catch {
            print("🗺️ DefaultLocationRepository: Reverse geocoding failed: \(error.localizedDescription)")
            return (nil, nil)
        }
    }
}