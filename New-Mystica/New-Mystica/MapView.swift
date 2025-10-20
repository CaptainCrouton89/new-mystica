//
//  MapView.swift
//  New-Mystica
//
//  Created by Silas Rhyneer on 10/19/25.
//

import SwiftUI
import MapKit
import CoreLocation

struct MapView: View, NavigableView {
    @EnvironmentObject private var navigationManager: NavigationManager
    @EnvironmentObject private var audioManager: AudioManager
    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194), // San Francisco
        span: MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
    )
    @State private var showBattlePopup = false
    @State private var selectedBattleLocation: BattleLocation?
    @State private var battleLocations: [BattleLocation] = []
    @State private var locationManager = CLLocationManager()
    @State private var playerLocation: CLLocation?
    
    // Battle location templates for random generation
    private let battleTemplates = [
        (name: "Dark Forest", enemyType: "Shadow Wolves", difficulty: "Easy", rewards: "Gold, XP, Common Items"),
        (name: "Crystal Caverns", enemyType: "Ice Golems", difficulty: "Medium", rewards: "Gold, XP, Rare Items"),
        (name: "Volcanic Peak", enemyType: "Fire Dragons", difficulty: "Hard", rewards: "Gold, XP, Epic Items"),
        (name: "Ancient Ruins", enemyType: "Undead Warriors", difficulty: "Extreme", rewards: "Gold, XP, Legendary Items"),
        (name: "Mystic Grove", enemyType: "Forest Spirits", difficulty: "Medium", rewards: "Gold, XP, Rare Items"),
        (name: "Shadow Realm", enemyType: "Dark Spirits", difficulty: "Hard", rewards: "Gold, XP, Epic Items"),
        (name: "Frozen Tundra", enemyType: "Ice Elementals", difficulty: "Medium", rewards: "Gold, XP, Rare Items"),
        (name: "Desert Oasis", enemyType: "Sand Wraiths", difficulty: "Easy", rewards: "Gold, XP, Common Items"),
        (name: "Mountain Peak", enemyType: "Storm Giants", difficulty: "Extreme", rewards: "Gold, XP, Legendary Items"),
        (name: "Enchanted Garden", enemyType: "Nature Guardians", difficulty: "Medium", rewards: "Gold, XP, Rare Items")
    ]
    
    var navigationTitle: String { "Map" }
    
    // MARK: - Location and Battle Generation Methods
    
    private func setupLocationManager() {
        locationManager.delegate = LocationDelegate { location in
            DispatchQueue.main.async {
                self.playerLocation = location
                self.updateRegionToPlayerLocation()
                self.generateRandomBattleLocations()
            }
        }
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        
        // Check authorization status before requesting
        let authStatus = locationManager.authorizationStatus
        switch authStatus {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            locationManager.startUpdatingLocation()
        case .denied, .restricted:
            print("Location access denied - using fallback mode")
            // Generate battles around current map center
            generateRandomBattleLocations()
        @unknown default:
            break
        }
    }
    
    private func updateRegionToPlayerLocation() {
        guard let location = playerLocation else { return }
        region = MKCoordinateRegion(
            center: location.coordinate,
            span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01) // Closer zoom for better battle visibility
        )
    }
    
    private func generateRandomBattleLocations() {
        let numberOfBattles = Int.random(in: 3...8) // Random number of battles nearby
        var newBattleLocations: [BattleLocation] = []
        
        // Use player location if available, otherwise use the current map center
        let baseLocation = playerLocation ?? CLLocation(latitude: region.center.latitude, longitude: region.center.longitude)
        
        for _ in 0..<numberOfBattles {
            let template = battleTemplates.randomElement()!
            let randomOffset = generateRandomOffset()
            let battleCoordinate = CLLocationCoordinate2D(
                latitude: baseLocation.coordinate.latitude + randomOffset.latitude,
                longitude: baseLocation.coordinate.longitude + randomOffset.longitude
            )
            
            let battleLocation = BattleLocation(
                coordinate: battleCoordinate,
                name: template.name,
                enemyType: template.enemyType,
                difficulty: template.difficulty,
                rewards: template.rewards
            )
            
            newBattleLocations.append(battleLocation)
        }
        
        battleLocations = newBattleLocations
    }
    
    private func generateRandomOffset() -> (latitude: Double, longitude: Double) {
        // Generate random offsets within a reasonable walking distance
        // Approximately 0.001 degrees = ~100 meters
        let maxDistance = 0.005 // ~500 meters radius
        let latitudeOffset = Double.random(in: -maxDistance...maxDistance)
        let longitudeOffset = Double.random(in: -maxDistance...maxDistance)
        
        return (latitudeOffset, longitudeOffset)
    }
    
    var body: some View {
        BaseView(title: navigationTitle) {
            ZStack {
                Map(coordinateRegion: $region, annotationItems: battleLocations) { location in
                    MapAnnotation(coordinate: location.coordinate) {
                        MapBattleIcon(
                            location: location,
                            onTap: {
                                audioManager.playMapIconClick()
                                selectedBattleLocation = location
                                showBattlePopup = true
                            }
                        )
                    }
                }
                .ignoresSafeArea()
                
                // Refresh button
                VStack {
                    HStack {
                        Spacer()
                        Button(action: {
                            generateRandomBattleLocations()
                        }) {
                            Image(systemName: "arrow.clockwise")
                                .font(.system(size: 20, weight: .medium))
                                .foregroundColor(.white)
                                .frame(width: 44, height: 44)
                                .background(Color.accentSecondary)
                                .clipShape(Circle())
                                .shadow(color: .black.opacity(0.3), radius: 4, x: 0, y: 2)
                        }
                        .padding(.trailing, 20)
                        .padding(.top, 20)
                    }
                    Spacer()
                }
            }
        }
        .onAppear {
            setupLocationManager()
            // Generate initial battle locations as fallback
            generateRandomBattleLocations()
        }
        .overlay(
            // Battle Popup
            Group {
                if showBattlePopup, let location = selectedBattleLocation {
                    BattlePopup(
                        locationName: location.name,
                        enemyType: location.enemyType,
                        difficulty: location.difficulty,
                        rewards: location.rewards,
                        isPresented: $showBattlePopup,
                        onBattleAction: {
                            // Navigate to battle view with enemy type
                            navigationManager.navigateToBattle(with: location.enemyType)
                        }
                    )
                }
            }
        )
    }
}

// MARK: - Battle Location Data Model
struct BattleLocation: Identifiable {
    let id = UUID()
    let coordinate: CLLocationCoordinate2D
    let name: String
    let enemyType: String
    let difficulty: String
    let rewards: String
}

// MARK: - Map Battle Icon Component
struct MapBattleIcon: View {
    let location: BattleLocation
    let onTap: () -> Void
    @EnvironmentObject private var audioManager: AudioManager
    
    var body: some View {
        Button(action: onTap) {
            ZStack {
                // Icon background
                Circle()
                    .fill(Color.accentSecondary)
                    .frame(width: 50, height: 50)
                    .shadow(color: .black.opacity(0.3), radius: 4, x: 0, y: 2)
                
                // Battle icon
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(.white)
            }
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Location Delegate
class LocationDelegate: NSObject, CLLocationManagerDelegate {
    private let onLocationUpdate: (CLLocation) -> Void
    
    init(onLocationUpdate: @escaping (CLLocation) -> Void) {
        self.onLocationUpdate = onLocationUpdate
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        onLocationUpdate(location)
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location manager failed with error: \(error.localizedDescription)")
    }
    
    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        switch status {
        case .authorizedWhenInUse, .authorizedAlways:
            manager.startUpdatingLocation()
        case .denied, .restricted:
            print("Location access denied - app will work in fallback mode")
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        @unknown default:
            break
        }
    }
}

#Preview {
    MapView()
        .environmentObject(NavigationManager())
}
