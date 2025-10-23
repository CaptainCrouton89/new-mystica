//
//  MapView.swift
//  New-Mystica
//
//  Refactored to integrate with MapViewModel and proper location services
//

import SwiftUI
import MapKit
import CoreLocation
import SwiftData

struct MapView: View, NavigableView {
    @Environment(\.navigationManager) private var navigationManager
    @Environment(\.audioManager) private var audioManager
    @State private var viewModel = MapViewModel()
    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194), // San Francisco
        span: MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
    )
    @State private var showLocationPopup = false
    @State private var selectedLocation: Location?
    @State private var isFollowingUser = false
    
    var navigationTitle: String { "Map" }

    // MARK: - Location Handling Methods

    private func updateRegionToUserLocation() {
        guard let userLocation = viewModel.userLocation else { return }
        withAnimation(.easeInOut(duration: 1.0)) {
            region = MKCoordinateRegion(
                center: userLocation,
                span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
            )
        }
    }

    private func requestLocationPermissionIfNeeded() {
        if viewModel.authorizationStatus == .notDetermined {
            viewModel.requestLocationPermission()
        }
    }
    
    var body: some View {
        BaseView(title: navigationTitle) {
            ZStack {
                // Location Permission or Map Content
                if viewModel.locationPermissionDenied {
                    locationPermissionDeniedView
                } else {
                    mapContentView
                }
            }
        }
        .task {
            // Start location services when view appears
            requestLocationPermissionIfNeeded()
            viewModel.startLocationUpdates()
        }
        .onDisappear {
            // Stop location updates to save battery
            viewModel.stopLocationUpdates()
        }
        .onChange(of: viewModel.userLocation?.latitude) { _, _ in
            if viewModel.userLocation != nil && isFollowingUser {
                updateRegionToUserLocation()
            }
        }
        .overlay(
            // Location Detail Popup
            Group {
                if showLocationPopup, let location = selectedLocation {
                    locationDetailPopup(location: location)
                }
            }
        )
    }

    // MARK: - Map Content View

    @ViewBuilder
    private var mapContentView: some View {
        LoadableView(viewModel.nearbyLocations) { locations in
            Map(coordinateRegion: $region, annotationItems: locations) { location in
                MapAnnotation(coordinate: CLLocationCoordinate2D(latitude: location.lat, longitude: location.lng)) {
                    LocationMarkerView(
                        location: location,
                        userLocation: viewModel.userLocation,
                        onTap: {
                            audioManager.playMapIconClick()
                            selectedLocation = location
                            showLocationPopup = true
                        }
                    )
                }
            }
            .ignoresSafeArea()
            .overlay(
                // User location indicator overlay
                Group {
                    if let userLocation = viewModel.userLocation {
                        UserLocationOverlay(userLocation: userLocation, mapRegion: region)
                    }
                }
            )
            .overlay(
                // Location status and controls overlay
                VStack {
                    HStack {
                        Spacer()
                        VStack(spacing: 8) {
                            locationStatusView
                            locationControlsView
                        }
                    }
                    Spacer()
                },
                alignment: .top
            )
        } retry: {
            Task {
                await viewModel.refreshNearbyLocations()
            }
        }
    }

    // MARK: - Location Permission Denied View

    private var locationPermissionDeniedView: some View {
        VStack(spacing: 20) {
            Image(systemName: "location.slash")
                .font(.system(size: 48, weight: .medium))
                .foregroundColor(Color.accent)

            VStack(spacing: 8) {
                TitleText("Location Access Required", size: 24)

                NormalText("Mystica needs access to your location to show nearby battle locations and adventures.")
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
            }

            TextButton("Open Settings") {
                if let settingsUrl = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(settingsUrl)
                }
            }
            .frame(maxWidth: 200)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.backgroundPrimary)
        .padding(.horizontal, 32)
    }

    // MARK: - Location Controls View

    private var locationControlsView: some View {
        VStack(spacing: 8) {
            // Snap to location button
            Button(action: {
                audioManager.playMapIconClick()
                updateRegionToUserLocation()
                isFollowingUser = false
            }) {
                HStack(spacing: 6) {
                    Image(systemName: "location")
                        .font(.system(size: 12, weight: .medium))
                    SmallText("Snap")
                        .foregroundColor(Color.textPrimary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.backgroundCard)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.borderSubtle, lineWidth: 1)
                        )
                )
            }

            // Follow toggle button
            Button(action: {
                audioManager.playMapIconClick()
                isFollowingUser.toggle()
                if isFollowingUser {
                    updateRegionToUserLocation()
                }
            }) {
                HStack(spacing: 6) {
                    Image(systemName: isFollowingUser ? "location.fill" : "location")
                        .font(.system(size: 12, weight: .medium))
                    SmallText(isFollowingUser ? "Following" : "Follow")
                        .foregroundColor(Color.textPrimary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(isFollowingUser ? Color.accent.opacity(0.2) : Color.backgroundCard)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(isFollowingUser ? Color.accent : Color.borderSubtle, lineWidth: 1)
                        )
                )
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }

    // MARK: - Location Status View

    private var locationStatusView: some View {
        VStack(alignment: .trailing, spacing: 8) {
            // Location permission status
            HStack(spacing: 8) {
                Circle()
                    .fill(viewModel.hasLocationPermission ? Color.green : Color.red)
                    .frame(width: 8, height: 8)

                SmallText(viewModel.hasLocationPermission ? "GPS Active" : "GPS Disabled")
                    .foregroundColor(Color.textSecondary)
            }

            // Nearby locations count
            if viewModel.nearbyLocationCount > 0 {
                HStack(spacing: 8) {
                    Image(systemName: "location.circle")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color.accent)

                    SmallText("\(viewModel.nearbyLocationCount) locations nearby")
                        .foregroundColor(Color.textSecondary)
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
        .padding(.top, 16)
        .padding(.trailing, 16)
    }

    // MARK: - Location Detail Popup

    private func locationDetailPopup(location: Location) -> some View {
        ZStack {
            // Background overlay
            Color.black.opacity(0.6)
                .edgesIgnoringSafeArea(.all)
                .onTapGesture {
                    audioManager.playMenuButtonClick()
                    selectedLocation = nil
                }

            // Popup content
            VStack(spacing: 16) {
                // Location name and type
                VStack(spacing: 4) {
                    TitleText(location.name)
                        .foregroundColor(Color.textPrimary)

                    NormalText(location.locationType.capitalized)
                        .foregroundColor(Color.textSecondary)
                }

                // Location info
                VStack(spacing: 8) {
                    HStack {
                        NormalText("Enemy Level:")
                            .foregroundColor(Color.textSecondary)
                        Spacer()
                        NormalText("\(location.enemyLevel)")
                            .foregroundColor(Color.accent)
                            .bold()
                    }

                    if let distance = viewModel.distance(to: location) {
                        HStack {
                            NormalText("Distance:")
                                .foregroundColor(Color.textSecondary)
                            Spacer()
                            NormalText(String(format: "%.0f m", distance))
                                .foregroundColor(Color.accentSecondary)
                                .bold()
                        }
                    }

                    if !location.materialDropPool.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            NormalText("Potential Materials:")
                                .foregroundColor(Color.textSecondary)

                            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 4) {
                                ForEach(location.materialDropPool.prefix(4), id: \.self) { material in
                                    NormalText(material.capitalized)
                                        .font(.caption)
                                        .foregroundColor(Color.accent)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(
                                            RoundedRectangle(cornerRadius: 8)
                                                .fill(Color.backgroundSecondary)
                                        )
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)

                // Action buttons
                VStack(spacing: 12) {
                    if viewModel.isWithinRange(location: location) {
                        TextButton("Start Battle") {
                            audioManager.playMenuButtonClick()
                            selectedLocation = nil
                            // Navigate to combat with this location
                            navigationManager.navigateToBattle(with: location.name)
                        }
                    } else {
                        NormalText("Move closer to battle")
                            .foregroundColor(Color.textSecondary)
                            .italic()
                    }

                    TextButton("Close", height: 40) {
                        audioManager.playMenuButtonClick()
                        selectedLocation = nil
                    }
                }
            }
            .padding(24)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.backgroundCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.borderSubtle, lineWidth: 1)
                    )
            )
            .shadow(color: Color.black.opacity(0.3), radius: 20, x: 0, y: 10)
            .padding(.horizontal, 40)
        }
    }
}

// MARK: - Location Marker View Component
struct LocationMarkerView: View {
    let location: Location
    let userLocation: CLLocationCoordinate2D?
    let onTap: () -> Void

    private var isWithinRange: Bool {
        guard let userLocation = userLocation else { return false }

        let userCLLocation = CLLocation(latitude: userLocation.latitude, longitude: userLocation.longitude)
        let locationCL = CLLocation(latitude: location.lat, longitude: location.lng)
        let distance = userCLLocation.distance(from: locationCL)

        return distance <= 50.0 // Within 50 meters for interaction
    }

    private var markerColor: Color {
        if isWithinRange {
            return Color.accent // Bright neon pink for reachable locations
        } else {
            return Color.accentSecondary // Neon blue for distant locations
        }
    }

    var body: some View {
        Button(action: onTap) {
            ZStack {
                // Outer glow effect
                Circle()
                    .fill(markerColor.opacity(0.3))
                    .frame(width: 60, height: 60)
                    .blur(radius: 4)

                // Main marker background
                Circle()
                    .fill(markerColor)
                    .frame(width: 44, height: 44)
                    .shadow(color: .black.opacity(0.3), radius: 4, x: 0, y: 2)

                // Location icon based on type
                Image(systemName: getLocationIcon())
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(.white)

                // Level indicator
                VStack {
                    Spacer()
                    Text("\(location.enemyLevel)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                        .background(
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color.black.opacity(0.7))
                        )
                        .offset(y: 8)
                }
                .frame(width: 44, height: 44)
            }
        }
        .buttonStyle(PlainButtonStyle())
    }

    private func getLocationIcon() -> String {
        switch location.locationType.lowercased() {
        case "forest":
            return "tree.fill"
        case "urban":
            return "building.2.fill"
        case "desert":
            return "sun.max.fill"
        case "coastal":
            return "water.waves"
        case "mountain":
            return "mountain.2.fill"
        case "plains":
            return "leaf.fill"
        case "swamp":
            return "humidity.fill"
        case "arctic":
            return "snowflake"
        default:
            return "location.fill"
        }
    }
}

// MARK: - User Location Overlay Component
struct UserLocationOverlay: View {
    let userLocation: CLLocationCoordinate2D
    let mapRegion: MKCoordinateRegion

    var body: some View {
        ZStack {
            // Outer pulsing ring
            Circle()
                .stroke(Color.accent.opacity(0.6), lineWidth: 2)
                .frame(width: 40, height: 40)

            // Inner filled circle
            Circle()
                .fill(Color.accent)
                .frame(width: 16, height: 16)
                .overlay(
                    Circle()
                        .stroke(Color.white, lineWidth: 2)
                )
        }
    }
}

#Preview {
    MapView()
        .modelContainer(for: Item.self, inMemory: true)
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
}
