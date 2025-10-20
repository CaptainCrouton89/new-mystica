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
    
    var navigationTitle: String { "Map" }
    
    var body: some View {
        BaseView(title: navigationTitle) {
            ZStack {
                // Map
                Map(coordinateRegion: $region)
                    .ignoresSafeArea()
            }
        }
    }
}

#Preview {
    MapView()
        .environmentObject(NavigationManager())
}
