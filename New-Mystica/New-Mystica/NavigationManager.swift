import SwiftUI
import Combine

enum NavigationDestination: Hashable {
    case mainMenu
    case map
    case collection
    case equipment
    case settings
    case profile
    case battle
    case victory
    case defeat
    case crafting(
        preselectedItem: EnhancedPlayerItem? = nil,
        preselectedMaterial: MaterialInventoryStack? = nil
    )
    case upgradePreview

    static func == (lhs: NavigationDestination, rhs: NavigationDestination) -> Bool {
        switch (lhs, rhs) {
        case (.mainMenu, .mainMenu),
             (.map, .map),
             (.collection, .collection),
             (.equipment, .equipment),
             (.settings, .settings),
             (.profile, .profile),
             (.battle, .battle),
             (.victory, .victory),
             (.defeat, .defeat),
             (.crafting, .crafting),
             (.upgradePreview, .upgradePreview):
            return true
        default:
            return false
        }
    }

    func hash(into hasher: inout Hasher) {
        switch self {
        case .mainMenu:
            hasher.combine("mainMenu")
        case .map:
            hasher.combine("map")
        case .collection:
            hasher.combine("collection")
        case .equipment:
            hasher.combine("equipment")
        case .settings:
            hasher.combine("settings")
        case .profile:
            hasher.combine("profile")
        case .battle:
            hasher.combine("battle")
        case .victory:
            hasher.combine("victory")
        case .defeat:
            hasher.combine("defeat")
        case .crafting:
            hasher.combine("crafting")
        case .upgradePreview:
            hasher.combine("upgradePreview")
        }
    }

    var title: String {
        switch self {
        case .mainMenu:
            return "Main Menu"
        case .map:
            return "Map"
        case .collection:
            return "Collection"
        case .equipment:
            return "Equipment"
        case .settings:
            return "Settings"
        case .profile:
            return "Profile"
        case .battle:
            return "Battle"
        case .victory:
            return "Victory"
        case .defeat:
            return "Defeat"
        case .crafting:
            return "Crafting"
        case .upgradePreview:
            return "Upgrade Item"
        }
    }
}

@MainActor
class NavigationManager: ObservableObject {
    // Use array directly instead of NavigationPath since we have a single type
    // This allows us to inspect the path and SwiftUI handles back gestures automatically
    @Published var navigationPath: [NavigationDestination] = []
    @Published var currentBattleEnemy: String = "Shadow Wolf"
    @Published var currentBattleLocation: String?

    var currentDestination: NavigationDestination {
        navigationPath.last ?? .mainMenu
    }

    var canNavigateBack: Bool {
        !navigationPath.isEmpty
    }

    func navigateTo(_ destination: NavigationDestination) {
        FileLogger.shared.log("🧭 Attempting to navigate to \(destination.title)", level: .info, category: "Navigation")
        FileLogger.shared.log("🗂️ Current destination: \(currentDestination.title)", level: .debug, category: "Navigation")
        FileLogger.shared.log("🗂️ Current path count: \(navigationPath.count)", level: .debug, category: "Navigation")

        // Log crafting destination details
        if case let .crafting(item, material) = destination {
            FileLogger.shared.log("🧭 Crafting destination with item: \(item?.baseType ?? "nil"), material: \(material?.name ?? "nil")", level: .info, category: "Navigation")
        }

        navigationPath.append(destination)

        FileLogger.shared.log("✅ Successfully navigated to \(destination.title)", level: .info, category: "Navigation")
        FileLogger.shared.log("🗂️ New path count: \(navigationPath.count)", level: .debug, category: "Navigation")
    }
    
    func navigateToBattle(with enemyType: String, locationId: String) {
        currentBattleEnemy = enemyType
        currentBattleLocation = locationId
        navigateTo(.battle)
    }
    
    func navigateBack() {
        FileLogger.shared.log("🔙 Attempting to navigate back", level: .info, category: "Navigation")
        FileLogger.shared.log("🗂️ Current path count: \(navigationPath.count)", level: .debug, category: "Navigation")

        guard !navigationPath.isEmpty else {
            FileLogger.shared.log("⚠️ Cannot navigate back - path is empty", level: .warning, category: "Navigation")
            return
        }

        navigationPath.removeLast()

        FileLogger.shared.log("✅ Successfully navigated back to \(currentDestination.title)", level: .info, category: "Navigation")
        FileLogger.shared.log("🗂️ New path count: \(navigationPath.count)", level: .debug, category: "Navigation")
    }

    func resetToMainMenu() {
        navigationPath = []
        currentBattleLocation = nil

        FileLogger.shared.log("🔄 Reset to main menu", level: .info, category: "Navigation")
    }

    func resetToMap() {
        navigationPath = [.map]
        currentBattleLocation = nil

        FileLogger.shared.log("🔄 Reset to map", level: .info, category: "Navigation")
    }
}

