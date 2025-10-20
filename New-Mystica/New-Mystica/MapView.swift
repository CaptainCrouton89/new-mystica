//
//  MapView.swift
//  New-Mystica
//
//  Created by Silas Rhyneer on 10/19/25.
//

import SwiftUI
import MapKit

struct MapView: View, NavigableView {
    @EnvironmentObject private var navigationManager: NavigationManager
    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194), // San Francisco
        span: MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
    )
    @State private var showBattlePopup = false
    @State private var selectedBattleLocation: BattleLocation?
    
    // TEMPORARY PLACEHOLDER: Sample battle locations around the map
    // TODO: Replace with dynamic data from backend/API
    // These are hardcoded locations for development and testing purposes
    private let battleLocations: [BattleLocation] = [
        BattleLocation(
            coordinate: CLLocationCoordinate2D(latitude: 37.7849, longitude: -122.4094),
            name: "Dark Forest",
            enemyType: "Shadow Wolves",
            difficulty: "Easy",
            rewards: "Gold, XP, Common Items"
        ),
        BattleLocation(
            coordinate: CLLocationCoordinate2D(latitude: 37.7649, longitude: -122.4294),
            name: "Crystal Caverns",
            enemyType: "Ice Golems",
            difficulty: "Medium",
            rewards: "Gold, XP, Rare Items"
        ),
        BattleLocation(
            coordinate: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4094),
            name: "Volcanic Peak",
            enemyType: "Fire Dragons",
            difficulty: "Hard",
            rewards: "Gold, XP, Epic Items"
        ),
        BattleLocation(
            coordinate: CLLocationCoordinate2D(latitude: 37.7849, longitude: -122.4294),
            name: "Ancient Ruins",
            enemyType: "Undead Warriors",
            difficulty: "Extreme",
            rewards: "Gold, XP, Legendary Items"
        ),
        BattleLocation(
            coordinate: CLLocationCoordinate2D(latitude: 37.7549, longitude: -122.4194),
            name: "Mystic Grove",
            enemyType: "Forest Spirits",
            difficulty: "Medium",
            rewards: "Gold, XP, Rare Items"
        )
    ]
    
    var navigationTitle: String { "Map" }
    
    var body: some View {
        BaseView(title: navigationTitle) {
            Map(coordinateRegion: $region, annotationItems: battleLocations) { location in
                MapAnnotation(coordinate: location.coordinate) {
                    MapBattleIcon(
                        location: location,
                        onTap: {
                            selectedBattleLocation = location
                            showBattlePopup = true
                        }
                    )
                }
            }
            .ignoresSafeArea()
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
                            // Handle battle start - could navigate to combat view
                            print("Starting battle at \(location.name)")
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
    
    var body: some View {
        Button(action: onTap) {
            ZStack {
                // Icon background
                Circle()
                    .fill(Color.mysticaAccentGold)
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

#Preview {
    MapView()
        .environmentObject(NavigationManager())
}
