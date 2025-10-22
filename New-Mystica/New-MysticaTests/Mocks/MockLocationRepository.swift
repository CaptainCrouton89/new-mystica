//
//  MockLocationRepository.swift
//  New-MysticaTests
//
//  Mock implementation of LocationRepository for testing
//

import Foundation
@testable import New_Mystica

class MockLocationRepository: LocationRepository {

    // MARK: - Configuration Properties
    var shouldFailFetchNearby = false
    var shouldFailGetLocationDetails = false
    var shouldFailFetchZones = false
    var shouldFailGetZoneDetails = false
    var fetchNearbyDelayMs: Int = 0
    var getLocationDetailsDelayMs: Int = 0
    var fetchZonesDelayMs: Int = 0
    var getZoneDetailsDelayMs: Int = 0

    // MARK: - Mock Data
    var mockNearbyLocations: [Location] = [Location.testData()]
    var mockLocationDetails: [String: Location] = [:]
    var mockZones: [Zone] = [Zone.testData()]
    var mockZoneDetails: [String: Zone] = [:]

    // MARK: - Call Tracking
    var fetchNearbyCallCount = 0
    var getLocationDetailsCallCount = 0
    var fetchZonesCallCount = 0
    var getZoneDetailsCallCount = 0
    var lastFetchNearbyParams: (userLocation: (latitude: Double, longitude: Double), radiusKm: Double)?
    var lastLocationDetailsId: String?
    var lastZoneDetailsId: String?

    // MARK: - LocationRepository Implementation

    func fetchNearby(userLocation: (latitude: Double, longitude: Double), radiusKm: Double) async throws -> [Location] {
        fetchNearbyCallCount += 1
        lastFetchNearbyParams = (userLocation: userLocation, radiusKm: radiusKm)

        if fetchNearbyDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(fetchNearbyDelayMs * 1_000_000))
        }

        if shouldFailFetchNearby {
            throw AppError.networkError(URLError(.timedOut))
        }

        // Simulate filtering by radius and sorting by distance
        let filteredLocations = mockNearbyLocations.map { location in
            let distance = calculateDistance(
                from: userLocation,
                to: (latitude: location.lat, longitude: location.lng)
            )

            var updatedLocation = location
            // Update the distance field based on calculation
            return Location(
                id: updatedLocation.id,
                name: updatedLocation.name,
                lat: updatedLocation.lat,
                lng: updatedLocation.lng,
                locationType: updatedLocation.locationType,
                stateCode: updatedLocation.stateCode,
                countryCode: updatedLocation.countryCode,
                enemyLevel: updatedLocation.enemyLevel,
                materialDropPool: updatedLocation.materialDropPool,
                distanceMeters: Int(distance * 1000) // Convert km to meters
            )
        }.filter { location in
            Double(location.distanceMeters) / 1000.0 <= radiusKm
        }.sorted { $0.distanceMeters < $1.distanceMeters }

        return filteredLocations
    }

    func getLocationDetails(locationId: String) async throws -> Location {
        getLocationDetailsCallCount += 1
        lastLocationDetailsId = locationId

        if getLocationDetailsDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(getLocationDetailsDelayMs * 1_000_000))
        }

        if shouldFailGetLocationDetails {
            throw AppError.notFound
        }

        // Return from cache or create a default location
        if let cachedLocation = mockLocationDetails[locationId] {
            return cachedLocation
        }

        return Location.testData(id: locationId, name: "Location \(locationId)")
    }

    func fetchZones() async throws -> [Zone] {
        fetchZonesCallCount += 1

        if fetchZonesDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(fetchZonesDelayMs * 1_000_000))
        }

        if shouldFailFetchZones {
            throw AppError.networkError(URLError(.timedOut))
        }

        return mockZones
    }

    func getZoneDetails(zoneId: String) async throws -> Zone {
        getZoneDetailsCallCount += 1
        lastZoneDetailsId = zoneId

        if getZoneDetailsDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(getZoneDetailsDelayMs * 1_000_000))
        }

        if shouldFailGetZoneDetails {
            throw AppError.notFound
        }

        // Return from cache or create a default zone
        if let cachedZone = mockZoneDetails[zoneId] {
            return cachedZone
        }

        return Zone.testData(id: zoneId, name: "Zone \(zoneId)")
    }

    // MARK: - Test Helpers

    func reset() {
        shouldFailFetchNearby = false
        shouldFailGetLocationDetails = false
        shouldFailFetchZones = false
        shouldFailGetZoneDetails = false
        fetchNearbyDelayMs = 0
        getLocationDetailsDelayMs = 0
        fetchZonesDelayMs = 0
        getZoneDetailsDelayMs = 0
        fetchNearbyCallCount = 0
        getLocationDetailsCallCount = 0
        fetchZonesCallCount = 0
        getZoneDetailsCallCount = 0
        lastFetchNearbyParams = nil
        lastLocationDetailsId = nil
        lastZoneDetailsId = nil
        mockNearbyLocations = [Location.testData()]
        mockLocationDetails.removeAll()
        mockZones = [Zone.testData()]
        mockZoneDetails.removeAll()
    }

    func addMockLocation(_ location: Location) {
        mockLocationDetails[location.id] = location
        if !mockNearbyLocations.contains(where: { $0.id == location.id }) {
            mockNearbyLocations.append(location)
        }
    }

    func addMockZone(_ zone: Zone) {
        mockZoneDetails[zone.id] = zone
        if !mockZones.contains(where: { $0.id == zone.id }) {
            mockZones.append(zone)
        }
    }

    // MARK: - Private Helpers

    private func calculateDistance(
        from: (latitude: Double, longitude: Double),
        to: (latitude: Double, longitude: Double)
    ) -> Double {
        // Simplified distance calculation using Haversine formula
        let earthRadius = 6371.0 // km

        let dLat = (to.latitude - from.latitude) * .pi / 180.0
        let dLon = (to.longitude - from.longitude) * .pi / 180.0

        let a = sin(dLat/2) * sin(dLat/2) +
                cos(from.latitude * .pi / 180.0) * cos(to.latitude * .pi / 180.0) *
                sin(dLon/2) * sin(dLon/2)
        let c = 2 * atan2(sqrt(a), sqrt(1-a))

        return earthRadius * c
    }
}

// MARK: - Test Data Extensions

extension Location {
    static func testData(
        id: String = "location_123",
        name: String = "Central Park",
        lat: Double = 40.7829,
        lng: Double = -73.9654,
        locationType: String = "park",
        stateCode: String = "NY",
        countryCode: String = "US",
        enemyLevel: Int = 5,
        materialDropPool: [String] = ["wood", "leaf"],
        distanceMeters: Int = 1500
    ) -> Location {
        return Location(
            id: id,
            name: name,
            lat: lat,
            lng: lng,
            locationType: locationType,
            stateCode: stateCode,
            countryCode: countryCode,
            enemyLevel: enemyLevel,
            materialDropPool: materialDropPool,
            distanceMeters: distanceMeters
        )
    }
}

extension Zone {
    static func testData(
        id: String = "zone_123",
        name: String = "Forest Zone",
        biomeType: BiomeType = .forest,
        locations: [Location] = [Location.testData()],
        materialDropPool: [String] = ["wood", "leaf", "bark"]
    ) -> Zone {
        return Zone(
            id: id,
            name: name,
            biomeType: biomeType,
            locations: locations,
            materialDropPool: materialDropPool
        )
    }
}