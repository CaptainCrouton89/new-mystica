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
            // locationId is optional - supports both new battles (from map) and auto-resume (from AppState)
            BattleView(locationId: navigationManager.currentBattleLocation, selectedLevel: navigationManager.selectedCombatLevel)
        case .victory:
            VictoryView()
        case .defeat:
            DefeatView()
        case .crafting(let preselectedItem, let preselectedMaterial):
            CraftingView(preselectedItem: preselectedItem, preselectedMaterial: preselectedMaterial)
                .onAppear {
                    FileLogger.shared.log("🎨 ContentView rendering CraftingView with item: \(preselectedItem?.baseType ?? "nil"), material: \(preselectedMaterial?.name ?? "nil")", level: .info, category: "Navigation")
                }
        case .upgradePreview:
            EmptyView()
        case .addItemCamera:
            AddItemCameraView()
        case .addItemPreview(let image):
            AddItemPreviewView(image: image)
        case .addItemLoading:
            AddItemLoadingView()
        case .addItemResult:
            AddItemResultView()
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(for: Item.self, inMemory: true)
        .environmentObject(NavigationManager())
}
