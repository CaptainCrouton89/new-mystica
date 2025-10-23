//
//  NavigationManager.swift
//  New-Mystica
//
//  Created by AI Assistant on 10/19/25.
//

import SwiftUI
import Combine

// MARK: - Navigation Destination Enum
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

    // Custom Hashable implementation that ignores associated values for navigation purposes
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

// MARK: - Global Navigation Manager
@MainActor
class NavigationManager: ObservableObject {
    @Published var navigationPath = NavigationPath()
    @Published var currentDestination: NavigationDestination = .mainMenu
    @Published var viewHistory: [NavigationDestination] = [] // Fix: Start empty to sync with navigationPath
    @Published var currentBattleEnemy: String = "Shadow Wolf"

    // Store preselection state separately for crafting
    @Published var craftingPreselectedItem: EnhancedPlayerItem?
    @Published var craftingPreselectedMaterial: MaterialInventoryStack?
    
    private let maxHistorySize = 10
    
    // MARK: - Navigation Methods
    
    /// Navigate to a specific destination
    func navigateTo(_ destination: NavigationDestination) {
        print("NavigationManager: Attempting to navigate to \(destination.title)")
        print("NavigationManager: Current destination: \(currentDestination.title)")
        print("NavigationManager: Current path count: \(navigationPath.count)")

        // Handle crafting preselection state
        if case let .crafting(preselectedItem, preselectedMaterial) = destination {
            craftingPreselectedItem = preselectedItem
            craftingPreselectedMaterial = preselectedMaterial
        }

        // Add current destination to history if it's different and not already at top
        if currentDestination != destination {
            // Fix: Only add to history if current destination is not already at top (prevents history pollution)
            if viewHistory.isEmpty || viewHistory.last != currentDestination {
                addToHistory(currentDestination)
            }
            currentDestination = destination

            // Update NavigationPath for SwiftUI navigation
            navigationPath.append(destination)

            print("NavigationManager: Successfully navigated to \(destination.title)")
            print("NavigationManager: New path count: \(navigationPath.count)")
            print("NavigationManager: History: \(viewHistory.map { $0.title })")
        } else {
            print("NavigationManager: Already at \(destination.title), skipping navigation")
        }
    }
    
    /// Navigate to battle with specific enemy
    func navigateToBattle(with enemyType: String) {
        currentBattleEnemy = enemyType
        navigateTo(.battle)
    }
    
    /// Navigate back to the previous view
    func navigateBack() {
        print("NavigationManager: Attempting to navigate back")
        print("NavigationManager: History count: \(viewHistory.count)")
        print("NavigationManager: Current path count: \(navigationPath.count)")
        print("NavigationManager: History: \(viewHistory.map { $0.title })")

        // Fix: Handle empty history case correctly (was checking > 1, should check > 0)
        guard !viewHistory.isEmpty else {
            print("NavigationManager: Cannot navigate back - no previous view in history")
            return
        }

        // Get the previous destination and remove current from history
        let previousDestination = viewHistory.removeLast()
        currentDestination = previousDestination

        // Update NavigationPath - remove the current destination
        if navigationPath.count > 0 {
            navigationPath.removeLast()
        }

        print("NavigationManager: Successfully navigated back to \(previousDestination.title)")
        print("NavigationManager: New path count: \(navigationPath.count)")
        print("NavigationManager: New history: \(viewHistory.map { $0.title })")
    }
    
    /// Navigate back to a specific destination
    func navigateToDestination(_ destination: NavigationDestination) {
        // Find the destination in history
        if let index = viewHistory.firstIndex(of: destination) {
            // Remove everything after this destination
            viewHistory = Array(viewHistory.prefix(index + 1))
            currentDestination = destination

            // Fix: Calculate correct NavigationPath depth relative to viewHistory
            // navigationPath.count should equal viewHistory.count (since both start at 0)
            let targetPathCount = index + 1
            let stepsToRemove = navigationPath.count - targetPathCount
            for _ in 0..<stepsToRemove {
                if navigationPath.count > 0 {
                    navigationPath.removeLast()
                }
            }
        } else {
            // Destination not in history, navigate normally
            navigateTo(destination)
        }
    }
    
    /// Reset navigation to main menu
    func resetToMainMenu() {
        viewHistory = [] // Fix: Start empty to stay synchronized
        currentDestination = .mainMenu
        navigationPath = NavigationPath()
        craftingPreselectedItem = nil
        craftingPreselectedMaterial = nil
    }
    
    /// Check if we can navigate back
    var canNavigateBack: Bool {
        return !viewHistory.isEmpty // Fix: Check if we have any history, not > 1
    }

    /// Get the previous destination
    var previousDestination: NavigationDestination? {
        return viewHistory.last // Fix: Last item in history is the previous destination
    }
    
    // MARK: - Private Methods
    
    private func addToHistory(_ destination: NavigationDestination) {
        // Add the destination to history (this is the current destination we're leaving)
        viewHistory.append(destination)
        
        // Limit history size
        if viewHistory.count > maxHistorySize {
            viewHistory.removeFirst()
        }
        
        print("NavigationManager: Added \(destination.title) to history")
    }
}

