//
//  NavigationManager.swift
//  New-Mystica
//
//  Created by AI Assistant on 10/19/25.
//

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
    @Published var navigationPath = NavigationPath()
    @Published var currentDestination: NavigationDestination = .mainMenu
    @Published var viewHistory: [NavigationDestination] = []
    @Published var currentBattleEnemy: String = "Shadow Wolf"
    @Published var currentBattleLocation: String?

    private let maxHistorySize = 10
    
    
    func navigateTo(_ destination: NavigationDestination) {
        FileLogger.shared.log("🧭 Attempting to navigate to \(destination.title)", level: .info, category: "Navigation")
        FileLogger.shared.log("🗂️ Current destination: \(currentDestination.title)", level: .debug, category: "Navigation")
        FileLogger.shared.log("🗂️ Current path count: \(navigationPath.count)", level: .debug, category: "Navigation")

        // Log crafting destination details
        if case let .crafting(item, material) = destination {
            FileLogger.shared.log("🧭 Crafting destination with item: \(item?.baseType ?? "nil"), material: \(material?.name ?? "nil")", level: .info, category: "Navigation")
        }

        if currentDestination != destination {
            if viewHistory.isEmpty || viewHistory.last != currentDestination {
                addToHistory(currentDestination)
            }
            currentDestination = destination

            navigationPath.append(destination)

            FileLogger.shared.log("✅ Successfully navigated to \(destination.title)", level: .info, category: "Navigation")
            FileLogger.shared.log("🗂️ New path count: \(navigationPath.count)", level: .debug, category: "Navigation")
            FileLogger.shared.log("🗂️ History: \(viewHistory.map { $0.title })", level: .debug, category: "Navigation")
        } else {
            FileLogger.shared.log("ℹ️ Already at \(destination.title), skipping navigation", level: .debug, category: "Navigation")
        }
    }
    
    func navigateToBattle(with enemyType: String, locationId: String) {
        currentBattleEnemy = enemyType
        currentBattleLocation = locationId
        navigateTo(.battle)
    }
    
    func navigateBack() {
        FileLogger.shared.log("🔙 Attempting to navigate back", level: .info, category: "Navigation")
        FileLogger.shared.log("🗂️ History count: \(viewHistory.count)", level: .debug, category: "Navigation")
        FileLogger.shared.log("🗂️ Current path count: \(navigationPath.count)", level: .debug, category: "Navigation")
        FileLogger.shared.log("🗂️ History: \(viewHistory.map { $0.title })", level: .debug, category: "Navigation")

        guard !viewHistory.isEmpty else {
            FileLogger.shared.log("⚠️ Cannot navigate back - no previous view in history", level: .warning, category: "Navigation")
            return
        }

        let previousDestination = viewHistory.removeLast()
        currentDestination = previousDestination

        if navigationPath.count > 0 {
            navigationPath.removeLast()
        }

        FileLogger.shared.log("✅ Successfully navigated back to \(previousDestination.title)", level: .info, category: "Navigation")
        FileLogger.shared.log("🗂️ New path count: \(navigationPath.count)", level: .debug, category: "Navigation")
        FileLogger.shared.log("🗂️ New history: \(viewHistory.map { $0.title })", level: .debug, category: "Navigation")
    }
    
    func navigateToDestination(_ destination: NavigationDestination) {
        if let index = viewHistory.firstIndex(of: destination) {
            viewHistory = Array(viewHistory.prefix(index + 1))
            currentDestination = destination

            let targetPathCount = index + 1
            let stepsToRemove = navigationPath.count - targetPathCount
            for _ in 0..<stepsToRemove {
                if navigationPath.count > 0 {
                    navigationPath.removeLast()
                }
            }
        } else {
            navigateTo(destination)
        }
    }
    
    func resetToMainMenu() {
        viewHistory = []
        currentDestination = .mainMenu
        navigationPath = NavigationPath()
        currentBattleLocation = nil
    }
    
    var canNavigateBack: Bool {
        return !viewHistory.isEmpty
    }

    var previousDestination: NavigationDestination? {
        return viewHistory.last
    }
    
    
    private func addToHistory(_ destination: NavigationDestination) {
        viewHistory.append(destination)
        
        if viewHistory.count > maxHistorySize {
            viewHistory.removeFirst()
        }
        
        FileLogger.shared.log("📝 Added \(destination.title) to history", level: .debug, category: "Navigation")
    }
}

