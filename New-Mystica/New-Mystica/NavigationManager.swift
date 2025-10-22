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
        }
    }
}

// MARK: - Global Navigation Manager
@MainActor
class NavigationManager: ObservableObject {
    @Published var navigationPath = NavigationPath()
    @Published var currentDestination: NavigationDestination = .mainMenu
    @Published var viewHistory: [NavigationDestination] = [.mainMenu]
    @Published var currentBattleEnemy: String = "Shadow Wolf"
    
    private let maxHistorySize = 10
    
    // MARK: - Navigation Methods
    
    /// Navigate to a specific destination
    func navigateTo(_ destination: NavigationDestination) {
        print("NavigationManager: Attempting to navigate to \(destination.title)")
        print("NavigationManager: Current destination: \(currentDestination.title)")
        print("NavigationManager: Current path count: \(navigationPath.count)")
        
        // Add current destination to history if it's different
        if currentDestination != destination {
            // Always add current destination to history before navigating away
            addToHistory(currentDestination)
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
        
        guard viewHistory.count > 1 else { 
            print("NavigationManager: Cannot navigate back - no previous view in history")
            return 
        }
        
        // Remove current destination from history
        viewHistory.removeLast()
        
        // Get the previous destination
        if let previousDestination = viewHistory.last {
            currentDestination = previousDestination
            
            // Update NavigationPath - remove the current destination
            if navigationPath.count > 0 {
                navigationPath.removeLast()
            }
            
            print("NavigationManager: Successfully navigated back to \(previousDestination.title)")
            print("NavigationManager: New path count: \(navigationPath.count)")
            print("NavigationManager: New history: \(viewHistory.map { $0.title })")
        } else {
            print("NavigationManager: No previous destination found")
        }
    }
    
    /// Navigate back to a specific destination
    func navigateToDestination(_ destination: NavigationDestination) {
        // Find the destination in history
        if let index = viewHistory.firstIndex(of: destination) {
            // Remove everything after this destination
            viewHistory = Array(viewHistory.prefix(index + 1))
            currentDestination = destination
            
            // Update NavigationPath
            let stepsToRemove = navigationPath.count - (index + 1)
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
        viewHistory = [.mainMenu]
        currentDestination = .mainMenu
        navigationPath = NavigationPath()
    }
    
    /// Check if we can navigate back
    var canNavigateBack: Bool {
        return viewHistory.count > 1
    }
    
    /// Get the previous destination
    var previousDestination: NavigationDestination? {
        guard viewHistory.count > 1 else { return nil }
        return viewHistory[viewHistory.count - 2]
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

