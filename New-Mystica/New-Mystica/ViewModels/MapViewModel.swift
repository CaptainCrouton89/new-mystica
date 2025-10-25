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
    let repository: LocationRepository
    let locationManager = CLLocationManager()

    var userLocation: CLLocationCoordinate2D?
    var nearbyLocations: Loadable<[Location]> = .idle {
        didSet {
            print("🗺️ MapViewModel: nearbyLocations state changed to: \(nearbyLocations)")
        }
    }

    var lastUpdateTime: Date?
    var debounceRadius: Double = 100.0 // meters
    var authorizationStatus: CLAuthorizationStatus = .notDetermined

    var locationPermissionRequested: Bool = false
    var significantLocationChange: Bool = false
    var isFollowingUser: Bool = false

    init(repository: LocationRepository = DefaultLocationRepository()) {
        print("🗺️ MapViewModel: Initializing with repository: \(type(of: repository))")
        self.repository = repository
        super.init()
        setupLocationManager()
        print("🗺️ MapViewModel: Initialization complete - authorizationStatus: \(authorizationStatus)")
    }


    private func setupLocationManager() {
        print("🗺️ MapViewModel: Setting up location manager")
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = debounceRadius
        authorizationStatus = locationManager.authorizationStatus
        print("🗺️ MapViewModel: Location manager setup complete - authorizationStatus: \(authorizationStatus)")
    }


    func requestLocationPermission() {
        print("🗺️ MapViewModel: Requesting location permission")
        locationPermissionRequested = true
        locationManager.requestWhenInUseAuthorization()
    }

    func startLocationUpdates() {
        print("🗺️ MapViewModel: Starting location updates - authorizationStatus: \(authorizationStatus)")
        guard authorizationStatus == .authorizedWhenInUse ||
              authorizationStatus == .authorizedAlways else {
            print("🗺️ MapViewModel: Location permission not granted, requesting permission")
            requestLocationPermission()
            return
        }

        print("🗺️ MapViewModel: Location permission granted, starting location updates")
        locationManager.startUpdatingLocation()
    }

    func stopLocationUpdates() {
        print("🗺️ MapViewModel: Stopping location updates")
        locationManager.stopUpdatingLocation()
    }

    func loadNearbyLocations() async {
        print("🗺️ MapViewModel: Loading nearby locations")
        guard let currentLocation = userLocation else { 
            print("🗺️ MapViewModel: No user location available, skipping nearby locations load")
            return 
        }

        print("🗺️ MapViewModel: User location available: \(currentLocation.latitude), \(currentLocation.longitude)")
        nearbyLocations = .loading

        do {
            print("🗺️ MapViewModel: Fetching nearby locations from repository")
            let locations = try await repository.fetchNearby(
                userLocation: (latitude: currentLocation.latitude, longitude: currentLocation.longitude),
                radiusKm: 5.0
            )
            print("🗺️ MapViewModel: Successfully loaded \(locations.count) nearby locations")
            nearbyLocations = .loaded(locations)
        } catch let error as AppError {
            print("🗺️ MapViewModel: AppError loading nearby locations: \(error)")
            nearbyLocations = .error(error)
        } catch {
            print("🗺️ MapViewModel: Unknown error loading nearby locations: \(error)")
            nearbyLocations = .error(.unknown(error))
        }
    }

    func refreshNearbyLocations() async {
        print("🗺️ MapViewModel: Refreshing nearby locations")
        await loadNearbyLocations()
    }


    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        print("🗺️ MapViewModel: Authorization status changed to: \(manager.authorizationStatus)")
        authorizationStatus = manager.authorizationStatus

        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            print("🗺️ MapViewModel: Location permission granted, starting location updates")
            startLocationUpdates()
        case .denied, .restricted:
            print("🗺️ MapViewModel: Location permission denied or restricted")
            nearbyLocations = .error(.unauthorized)
        case .notDetermined:
            print("🗺️ MapViewModel: Location permission not determined")
            break
        @unknown default:
            print("🗺️ MapViewModel: Unknown authorization status")
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        print("🗺️ MapViewModel: Received location update with \(locations.count) locations")
        guard let newLocation = locations.last else { 
            print("🗺️ MapViewModel: No valid location in update")
            return 
        }

        let coordinate = newLocation.coordinate
        print("🗺️ MapViewModel: New location: \(coordinate.latitude), \(coordinate.longitude)")
        let shouldUpdate = shouldUpdateLocation(coordinate)
        print("🗺️ MapViewModel: Should update location: \(shouldUpdate)")

        if shouldUpdate {
            print("🗺️ MapViewModel: Updating user location and loading nearby locations")
            userLocation = coordinate
            lastUpdateTime = Date()
            significantLocationChange = true

            Task {
                await loadNearbyLocations()
            }
        } else {
            print("🗺️ MapViewModel: Skipping location update (too recent or too close)")
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("🗺️ MapViewModel: Location manager failed with error: \(error)")
        if let clError = error as? CLError {
            print("🗺️ MapViewModel: CLError code: \(clError.code)")
            switch clError.code {
            case .denied:
                print("🗺️ MapViewModel: Location access denied")
                nearbyLocations = .error(.unauthorized)
            case .network:
                print("🗺️ MapViewModel: Network error")
                nearbyLocations = .error(.networkError(NSError(domain: "LocationService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Location service network error"])))
            default:
                print("🗺️ MapViewModel: Other CLError: \(clError)")
                nearbyLocations = .error(.unknown(error))
            }
        } else {
            print("🗺️ MapViewModel: Non-CLError: \(error)")
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