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
    @Environment(\.navigationManager) private var navigationManager
    @Query private var items: [Item]
    @State private var navigationPath = NavigationPath()

    var body: some View {
        NavigationStack(path: $navigationPath) {
            MainMenuView()
                .navigationDestination(for: NavigationDestination.self) { destination in
                    destinationView(for: destination)
                }
        }
        .modelContainer(for: Item.self)
        .onChange(of: navigationManager.navigationPath) { oldValue, newValue in
            navigationPath = newValue
        }
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
        case .equipment:
            EquipmentView()
        case .settings:
            SettingsView()
        case .profile:
            ProfileView()
        case .battle:
            BattleView(locationId: "default-location")
        case .victory:
            VictoryView()
        case .defeat:
            DefeatView()
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(for: Item.self, inMemory: true)
        .environmentObject(NavigationManager())
}
