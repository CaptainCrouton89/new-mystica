//
//  ContentView.swift
//  New-Mystica
//
//  Created by Silas Rhyneer on 10/19/25.
//

import SwiftUI
import SwiftData

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @EnvironmentObject private var navigationManager: NavigationManager
    @Query private var items: [Item]

    var body: some View {
        NavigationStack(path: $navigationManager.navigationPath) {
            MainMenuView()
                .navigationDestination(for: NavigationDestination.self) { destination in
                    destinationView(for: destination)
                }
        }
        .modelContainer(for: Item.self)
    }
    
    @ViewBuilder
    private func destinationView(for destination: NavigationDestination) -> some View {
        switch destination {
        case .mainMenu:
            MainMenuView()
        case .map:
            MapView()
        case .collection:
            CollectionView()
        case .settings:
            // Example of how easy it is to create new views with navigation
            SimpleNavigableView(title: "Settings") {
                VStack(spacing: 20) {
                    Spacer()
                    
                    TitleText("Settings")
                    
                    NormalText("Coming Soon")
                    
                    Spacer()
                }
            }
        case .profile:
            // Another example of automatic navigation
            SimpleNavigableView(title: "Profile") {
                VStack(spacing: 20) {
                    Spacer()
                    
                    TitleText("Profile")
                    
                    NormalText("Coming Soon")
                    
                    Spacer()
                }
            }
        case .battle:
            BattleView()
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(for: Item.self, inMemory: true)
        .environmentObject(NavigationManager())
}
