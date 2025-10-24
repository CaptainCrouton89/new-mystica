import SwiftUI
import MapKit
import CoreLocation
import SwiftData

struct MapView: View, NavigableView {
    @Environment(\.navigationManager) private var navigationManager
    @Environment(\.audioManager) private var audioManager
    @Environment(AppState.self) private var appState
    @State private var viewModel = MapViewModel()
    @State private var position: MapCameraPosition = .automatic
    @State private var showLocationPopup = false
    @State private var selectedLocation: Location?
    @State private var showLevelSelection = false
    @State private var selectedLocationForCombat: Location?

    var navigationTitle: String { "Map" }


    private func updatePositionToUserLocation() {
        guard let userLocation = viewModel.userLocation else { return }
        withAnimation(.easeInOut(duration: 1.0)) {
            position = .camera(MapCamera(
                centerCoordinate: userLocation,
                distance: 1000,
                heading: 0,
                pitch: 0
            ))
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
                requestLocationPermissionIfNeeded()
            viewModel.startLocationUpdates()
        }
        .onDisappear {
                viewModel.stopLocationUpdates()
        }
        .onChange(of: viewModel.userLocation?.latitude) { _, _ in
                if let userLoc = viewModel.userLocation {
                withAnimation {
                    position = .camera(MapCamera(
                        centerCoordinate: userLoc,
                        distance: 1200,
                        heading: 0,
                        pitch: 0
                    ))
                }
            }
        }
        .overlay(
            Group {
                if showLocationPopup, let location = selectedLocation {
                    locationDetailPopup(location: location)
                } else if showLevelSelection, let location = selectedLocationForCombat {
                    let recommendedLevel = max(1, min(10, appState.userProfile.value?.vanityLevel ?? 1))

                    CombatLevelSelectionView(
                        locationId: location.id,
                        recommendedLevel: recommendedLevel,
                        onDismiss: {
                            showLevelSelection = false
                            selectedLocationForCombat = nil
                        },
                        onLevelSelected: { level in
                            showLevelSelection = false
                            navigationManager.navigateToBattle(with: location.name, locationId: location.id, selectedLevel: level)
                            selectedLocationForCombat = nil
                        }
                    )
                }
            }
        )
    }


    @ViewBuilder
    private var mapContentView: some View {
        LoadableView(viewModel.nearbyLocations) { locations in
            ZStack {
                Map(position: $position, interactionModes: .all) {
                    UserAnnotation()

                    ForEach(locations, id: \.id) { location in
                        Annotation(location.name, coordinate: CLLocationCoordinate2D(latitude: location.lat, longitude: location.lng)) {
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
                }
                .ignoresSafeArea()

                VStack(alignment: .trailing, spacing: 12) {
                    Button(action: {
                        audioManager.playMapIconClick()
                        updatePositionToUserLocation()
                    }) {
                        Image(systemName: "location.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(width: 44, height: 44)
                            .background(Circle().fill(Color.accent))
                            .shadow(color: .black.opacity(0.2), radius: 4, x: 0, y: 2)
                    }

                    Spacer()
                }
                .padding(.top, 16)
                .padding(.trailing, 16)
            }
        } retry: {
            Task {
                await viewModel.refreshNearbyLocations()
            }
        }
    }


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



    private func locationDetailPopup(location: Location) -> some View {
        ZStack {
            Color.black.opacity(0.6)
                .edgesIgnoringSafeArea(.all)
                .onTapGesture {
                    audioManager.playMenuButtonClick()
                    selectedLocation = nil
                }

            VStack(spacing: 16) {
                VStack(spacing: 4) {
                    TitleText(location.name)
                        .foregroundColor(Color.textPrimary)

                    NormalText(location.locationType.capitalized)
                        .foregroundColor(Color.textSecondary)
                }

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

                    if let materialDropPool = location.materialDropPool, !materialDropPool.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            NormalText("Potential Materials:")
                                .foregroundColor(Color.textSecondary)

                            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 4) {
                                ForEach(materialDropPool.prefix(4), id: \.self) { material in
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

                VStack(spacing: 12) {
                    if viewModel.isWithinRange(location: location) {
                        TextButton("Start Battle") {
                            audioManager.playMenuButtonClick()
                            showLocationPopup = false
                            selectedLocation = nil
                            selectedLocationForCombat = location
                            showLevelSelection = true
                        }
                    } else {
                        NormalText("Move closer to battle")
                            .foregroundColor(Color.textSecondary)
                            .italic()
                    }

                    TextButton("Close", height: 40) {
                        audioManager.playMenuButtonClick()
                        selectedLocation = nil
                        showLocationPopup = false
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

struct LocationMarkerView: View {
    let location: Location
    let userLocation: CLLocationCoordinate2D?
    let onTap: () -> Void

    private var isWithinRange: Bool {
        guard let userLocation = userLocation else { return false }

        let userCLLocation = CLLocation(latitude: userLocation.latitude, longitude: userLocation.longitude)
        let locationCL = CLLocation(latitude: location.lat, longitude: location.lng)
        let distance = userCLLocation.distance(from: locationCL)

        return distance <= 50.0
    }

    private var markerColor: Color {
        if isWithinRange {
            return Color.accent
        } else {
            return Color.accentSecondary
        }
    }

    var body: some View {
        Button(action: onTap) {
            ZStack {
                Circle()
                    .fill(markerColor.opacity(0.3))
                    .frame(width: 60, height: 60)
                    .blur(radius: 4)

                Circle()
                    .fill(markerColor)
                    .frame(width: 44, height: 44)
                    .shadow(color: .black.opacity(0.3), radius: 4, x: 0, y: 2)

                Image(systemName: getLocationIcon())
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(.white)

                VStack {
                    Spacer()
                    Text(location.locationType.capitalized)
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                        .background(
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color.black.opacity(0.7))
                        )
                        .offset(y: 8)
                        .lineLimit(1)
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

#Preview {
    MapView()
        .modelContainer(for: Item.self, inMemory: true)
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
}
