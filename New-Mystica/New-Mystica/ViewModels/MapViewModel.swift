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
    var nearbyLocations: Loadable<[Location]> = .idle

    var lastUpdateTime: Date?
    var debounceRadius: Double = 100.0 // meters
    var authorizationStatus: CLAuthorizationStatus = .notDetermined

    var locationPermissionRequested: Bool = false
    var significantLocationChange: Bool = false
    var isFollowingUser: Bool = false

    init(repository: LocationRepository = DefaultLocationRepository()) {
        self.repository = repository
        super.init()
        setupLocationManager()
    }


    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = debounceRadius
        authorizationStatus = locationManager.authorizationStatus
    }


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
                radiusKm: 5.0
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