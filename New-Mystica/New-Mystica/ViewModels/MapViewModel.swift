//
//  MapViewModel.swift
//  New-Mystica
//
//  Manages location services and nearby location discovery
//

import Foundation
import CoreLocation
import Observation

@Observable
final class MapViewModel: NSObject, CLLocationManagerDelegate {
    let repository: LocationRepository
    let locationManager = CLLocationManager()

    // MARK: - State
    var userLocation: CLLocationCoordinate2D?
    var nearbyLocations: Loadable<[Location]> = .idle

    // MARK: - Location Management
    var lastUpdateTime: Date?
    var debounceRadius: Double = 100.0 // meters
    var authorizationStatus: CLAuthorizationStatus = .notDetermined

    // MARK: - UI State
    var locationPermissionRequested: Bool = false
    var significantLocationChange: Bool = false

    init(repository: LocationRepository = DefaultLocationRepository()) {
        self.repository = repository
        super.init()
        setupLocationManager()
    }

    // MARK: - Location Manager Setup

    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = debounceRadius // Only update when moved >100m
        authorizationStatus = locationManager.authorizationStatus
    }

    // MARK: - Public Methods

    func requestLocationPermission() {
        locationPermissionRequested = true
        locationManager.requestWhenInUseAuthorization()
    }

    func startLocationUpdates() {
        guard authorizationStatus == .authorizedWhenInUse ||
              authorizationStatus == .authorizedAlways else {
            requestLocationPermission()
            return
        }

        locationManager.startUpdatingLocation()
    }

    func stopLocationUpdates() {
        locationManager.stopUpdatingLocation()
    }

    func loadNearbyLocations() async {
        guard let currentLocation = userLocation else { return }

        nearbyLocations = .loading

        do {
            let locations = try await repository.fetchNearby(
                userLocation: (latitude: currentLocation.latitude, longitude: currentLocation.longitude),
                radiusKm: 5.0 // 5km radius
            )
            nearbyLocations = .loaded(locations)
        } catch let error as AppError {
            nearbyLocations = .error(error)
        } catch {
            nearbyLocations = .error(.unknown(error))
        }
    }

    func refreshNearbyLocations() async {
        await loadNearbyLocations()
    }

    // MARK: - CLLocationManagerDelegate

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus

        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            startLocationUpdates()
        case .denied, .restricted:
            nearbyLocations = .error(.unauthorized)
        case .notDetermined:
            break
        @unknown default:
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let newLocation = locations.last else { return }

        let coordinate = newLocation.coordinate
        let shouldUpdate = shouldUpdateLocation(coordinate)

        if shouldUpdate {
            userLocation = coordinate
            lastUpdateTime = Date()
            significantLocationChange = true

            // Automatically load nearby locations when location updates
            Task {
                await loadNearbyLocations()
            }
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let clError = error as? CLError {
            switch clError.code {
            case .denied:
                nearbyLocations = .error(.unauthorized)
            case .network:
                nearbyLocations = .error(.networkError(NSError(domain: "LocationService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Location service network error"])))
            default:
                nearbyLocations = .error(.unknown(error))
            }
        } else {
            nearbyLocations = .error(.unknown(error))
        }
    }

    // MARK: - Private Methods

    private func shouldUpdateLocation(_ newCoordinate: CLLocationCoordinate2D) -> Bool {
        // Always update if this is the first location
        guard let currentLocation = userLocation,
              let lastUpdate = lastUpdateTime else {
            return true
        }

        // Check time-based debounce (minimum 30 seconds)
        let timeSinceLastUpdate = Date().timeIntervalSince(lastUpdate)
        if timeSinceLastUpdate < 30.0 {
            return false
        }

        // Check distance-based debounce (minimum 100 meters)
        let lastLocation = CLLocation(
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude
        )
        let newLocation = CLLocation(
            latitude: newCoordinate.latitude,
            longitude: newCoordinate.longitude
        )

        let distance = lastLocation.distance(from: newLocation)
        return distance >= debounceRadius
    }

    // MARK: - Computed Properties

    var hasLocationPermission: Bool {
        return authorizationStatus == .authorizedWhenInUse ||
               authorizationStatus == .authorizedAlways
    }

    var locationPermissionDenied: Bool {
        return authorizationStatus == .denied || authorizationStatus == .restricted
    }

    var isLocationUpdateActive: Bool {
        return hasLocationPermission && userLocation != nil
    }

    var nearbyLocationCount: Int {
        if case .loaded(let locations) = nearbyLocations {
            return locations.count
        }
        return 0
    }

    var locationsWithinReach: [Location] {
        guard let currentUserLocation = userLocation,
              case .loaded(let locations) = nearbyLocations else {
            return []
        }

        let userCLLocation = CLLocation(
            latitude: currentUserLocation.latitude,
            longitude: currentUserLocation.longitude
        )

        return locations.compactMap { location in
            let locationCL = CLLocation(
                latitude: location.lat,
                longitude: location.lng
            )
            let distance = userCLLocation.distance(from: locationCL)
            return distance <= 50.0 ? location : nil // Within 50 meters for interaction
        }
    }

    // Get distance to a specific location
    func distance(to location: Location) -> Double? {
        guard let currentLocation = userLocation else { return nil }

        let userCLLocation = CLLocation(
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude
        )
        let targetCLLocation = CLLocation(
            latitude: location.lat,
            longitude: location.lng
        )

        return userCLLocation.distance(from: targetCLLocation)
    }

    // Check if a location is within interaction range
    func isWithinRange(location: Location, range: Double = 50.0) -> Bool {
        guard let distance = distance(to: location) else { return false }
        return distance <= range
    }
}