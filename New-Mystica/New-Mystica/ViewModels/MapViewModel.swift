//
//  MapViewModel.swift
//  New-Mystica
//
//

import Foundation
import CoreLocation
import Observation

@Observable
final class MapViewModel: NSObject, CLLocationManagerDelegate {
    #if DEBUG
    private static let isDebugLoggingEnabled = true
    #else
    private static let isDebugLoggingEnabled = false
    #endif

    let repository: LocationRepository
    let locationManager = CLLocationManager()

    var userLocation: CLLocationCoordinate2D?
    var nearbyLocations: Loadable<[Location]> = .idle {
        didSet {
            debugLog("nearbyLocations state changed to: \(nearbyLocations)")
        }
    }

    var lastUpdateTime: Date?
    var debounceRadius: Double = 100.0 // meters
    var authorizationStatus: CLAuthorizationStatus = .notDetermined

    var locationPermissionRequested: Bool = false
    var significantLocationChange: Bool = false
    var isFollowingUser: Bool = false

    init(repository: LocationRepository = DefaultLocationRepository()) {
        self.repository = repository
        super.init()
        debugLog("Initializing with repository: \(type(of: repository))")
        setupLocationManager()
        debugLog("Initialization complete - authorizationStatus: \(authorizationStatus)")
    }

    private func debugLog(_ message: String) {
        if Self.isDebugLoggingEnabled {
            print("🗺️ MapViewModel: \(message)")
        }
    }


    private func setupLocationManager() {
        debugLog("Setting up location manager")
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = debounceRadius
        authorizationStatus = locationManager.authorizationStatus
        debugLog("Location manager setup complete - authorizationStatus: \(authorizationStatus)")
    }


    func requestLocationPermission() {
        debugLog("Requesting location permission")
        locationPermissionRequested = true
        locationManager.requestWhenInUseAuthorization()
    }

    func startLocationUpdates() {
        debugLog("Starting location updates - authorizationStatus: \(authorizationStatus)")
        guard authorizationStatus == .authorizedWhenInUse ||
              authorizationStatus == .authorizedAlways else {
            debugLog("Location permission not granted, requesting permission")
            requestLocationPermission()
            return
        }

        debugLog("Location permission granted, starting location updates")
        locationManager.startUpdatingLocation()
    }

    func stopLocationUpdates() {
        debugLog("Stopping location updates")
        locationManager.stopUpdatingLocation()
    }

    func loadNearbyLocations() async {
        debugLog("Loading nearby locations")
        guard let currentLocation = userLocation else {
            debugLog("No user location available, skipping nearby locations load")
            return
        }

        debugLog("User location available: \(currentLocation.latitude), \(currentLocation.longitude)")
        nearbyLocations = .loading

        do {
            debugLog("Fetching nearby locations from repository")
            var locations = try await repository.fetchNearby(
                userLocation: (latitude: currentLocation.latitude, longitude: currentLocation.longitude),
                radiusKm: 5.0
            )
            debugLog("Successfully loaded \(locations.count) nearby locations")

            // Auto-generate if no locations exist within 100m
            if locations.isEmpty || !hasLocationWithin100m(locations: locations, userLocation: currentLocation) {
                debugLog("No locations within 100m, attempting auto-generate")
                if let newLocation = try await repository.autoGenerate(
                    userLocation: (latitude: currentLocation.latitude, longitude: currentLocation.longitude)
                ) {
                    debugLog("Successfully auto-generated location: \(newLocation.name)")
                    locations.append(newLocation)
                } else {
                    debugLog("Auto-generate returned nil (location already exists)")
                }
            }

            nearbyLocations = .loaded(locations)
        } catch let error as AppError {
            debugLog("AppError loading nearby locations: \(error)")
            nearbyLocations = .error(error)
        } catch {
            debugLog("Unknown error loading nearby locations: \(error)")
            nearbyLocations = .error(.unknown(error))
        }
    }

    private func hasLocationWithin100m(locations: [Location], userLocation: CLLocationCoordinate2D) -> Bool {
        let userCLLocation = CLLocation(latitude: userLocation.latitude, longitude: userLocation.longitude)

        return locations.contains { location in
            let locationCL = CLLocation(latitude: location.lat, longitude: location.lng)
            let distance = userCLLocation.distance(from: locationCL)
            return distance <= 100.0
        }
    }

    func refreshNearbyLocations() async {
        debugLog("Refreshing nearby locations")
        await loadNearbyLocations()
    }


    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        debugLog("Authorization status changed to: \(manager.authorizationStatus)")
        authorizationStatus = manager.authorizationStatus

        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            debugLog("Location permission granted, starting location updates")
            startLocationUpdates()
        case .denied, .restricted:
            debugLog("Location permission denied or restricted")
            nearbyLocations = .error(.unauthorized)
        case .notDetermined:
            debugLog("Location permission not determined")
            break
        @unknown default:
            debugLog("Unknown authorization status")
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        debugLog("Received location update with \(locations.count) locations")
        guard let newLocation = locations.last else {
            debugLog("No valid location in update")
            return
        }

        let coordinate = newLocation.coordinate
        debugLog("New location: \(coordinate.latitude), \(coordinate.longitude)")
        let shouldUpdate = shouldUpdateLocation(coordinate)
        debugLog("Should update location: \(shouldUpdate)")

        if shouldUpdate {
            debugLog("Updating user location and loading nearby locations")
            userLocation = coordinate
            lastUpdateTime = Date()
            significantLocationChange = true

            Task {
                await loadNearbyLocations()
            }
        } else {
            debugLog("Skipping location update (too recent or too close)")
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        debugLog("Location manager failed with error: \(error)")
        if let clError = error as? CLError {
            debugLog("CLError code: \(clError.code)")
            switch clError.code {
            case .denied:
                debugLog("Location access denied")
                nearbyLocations = .error(.unauthorized)
            case .network:
                debugLog("Network error")
                nearbyLocations = .error(.networkError(NSError(domain: "LocationService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Location service network error"])))
            case .locationUnknown:
                debugLog("Location unknown (likely simulator without location set)")
                // Don't set error state immediately - wait for valid location
                // Simulator often sends this error before getting actual location
                break
            default:
                debugLog("Other CLError: \(clError)")
                nearbyLocations = .error(.unknown(error))
            }
        } else {
            debugLog("Non-CLError: \(error)")
            nearbyLocations = .error(.unknown(error))
        }
    }


    private func shouldUpdateLocation(_ newCoordinate: CLLocationCoordinate2D) -> Bool {
        guard let currentLocation = userLocation,
              let lastUpdate = lastUpdateTime else {
            return true
        }

        let timeSinceLastUpdate = Date().timeIntervalSince(lastUpdate)
        if timeSinceLastUpdate < 30.0 {
            return false
        }

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
            return distance <= 100.0 ? location : nil
        }
    }

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

    func isWithinRange(location: Location, range: Double = 100.0) -> Bool {
        guard let distance = distance(to: location) else { return false }
        return distance <= range
    }
}