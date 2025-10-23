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
            InventoryView()
        case .equipment:
            EquipmentView()
        case .settings:
            SettingsView()
        case .profile:
            ProfileView()
        case .battle:
            if let locationId = navigationManager.currentBattleLocation {
                BattleView(locationId: locationId)
            } else {
                    Text("Error: No location selected for battle")
                    .foregroundColor(.red)
            }
        case .victory:
            VictoryView()
        case .defeat:
            DefeatView()
        case .crafting:
            CraftingView()
        case .upgradePreview:
            EmptyView()
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(for: Item.self, inMemory: true)
        .environmentObject(NavigationManager())
}
