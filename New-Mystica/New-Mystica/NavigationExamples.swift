//
//  NavigationExamples.swift
//  New-Mystica
//
//  Created by AI Assistant on 10/19/25.
//

import SwiftUI

// MARK: - Example: How to Create New Views with Automatic Navigation

// Method 1: Using NavigableView Protocol (Recommended for complex views)
struct SettingsView: View, NavigableView {
    @EnvironmentObject private var navigationManager: NavigationManager
    
    var navigationTitle: String { "Settings" }
    
    var body: some View {
        BaseView(title: navigationTitle) {
            VStack(spacing: 20) {
                Spacer()
                
                TitleText("Settings")
                
                NormalText("Configure your game preferences")
                
                // Example settings options
                VStack(spacing: 16) {
                    SettingsRow(title: "Sound Effects", isOn: true)
                    SettingsRow(title: "Music", isOn: true)
                    SettingsRow(title: "Notifications", isOn: false)
                }
                .padding(.horizontal, 32)
                
                Spacer()
            }
        }
    }
}

// Method 2: Using SimpleNavigableView (Perfect for simple views)
struct ProfileView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    
    var body: some View {
        SimpleNavigableView(title: "Profile") {
            VStack(spacing: 20) {
                Spacer()
                
                TitleText("Profile")
                
                NormalText("Manage your account")
                
                Spacer()
            }
        }
    }
}

// Method 3: Using the withNavigation modifier (Quick and easy)
struct InventoryView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    
    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            
            TitleText("Inventory")
            
            NormalText("Manage your items")
            
            Spacer()
        }
        .withNavigation(title: "Inventory")
    }
}

// Method 4: Custom back action (for special navigation needs)
struct GameView: View, NavigableView {
    @EnvironmentObject private var navigationManager: NavigationManager
    
    var navigationTitle: String { "Game" }
    var customBackAction: (() -> Void)? {
        {
            // Custom logic before going back
            print("Saving game state...")
            navigationManager.navigateBack()
        }
    }
    
    var body: some View {
        BaseView(title: navigationTitle) {
            VStack(spacing: 20) {
                Spacer()
                
                TitleText("Game")
                
                NormalText("Your adventure continues...")
                
                Spacer()
            }
        }
    }
}

// Method 5: No back button (for views that shouldn't have one)
struct SplashView: View, NavigableView {
    @EnvironmentObject private var navigationManager: NavigationManager
    
    var navigationTitle: String { "Loading" }
    var showBackButton: Bool { false }
    
    var body: some View {
        BaseView(title: navigationTitle, showBackButton: showBackButton) {
            VStack(spacing: 20) {
                Spacer()
                
                TitleText("Mystica")
                
                NormalText("Loading your adventure...")
                
                Spacer()
            }
        }
    }
}

// MARK: - Helper Components
struct SettingsRow: View {
    let title: String
    @State var isOn: Bool
    
    var body: some View {
        HStack {
            NormalText(title)
            
            Spacer()
            
            Toggle("", isOn: $isOn)
                .toggleStyle(SwitchToggleStyle(tint: Color.accentSecondary))
        }
        .padding(.vertical, 8)
    }
}

// MARK: - Usage Examples in ContentView
// Note: This is just an example of how to add new views to the navigation system
// In your actual ContentView, you would add cases like this:
/*
extension ContentView {
    func exampleDestinationView(for destination: NavigationDestination) -> some View {
        switch destination {
        case .mainMenu:
            MainMenuView()
        case .map:
            MapView()
        case .collection:
            CollectionView()
        case .settings:
            SettingsView() // Uses NavigableView protocol
        case .profile:
            ProfileView() // Uses SimpleNavigableView
        }
    }
}
*/

// MARK: - Quick Reference Guide
/*
 
 QUICK REFERENCE: Creating New Views with Automatic Navigation
 
 1. SIMPLE VIEWS (use SimpleNavigableView):
    ```swift
    struct MyView: View {
        var body: some View {
            SimpleNavigableView(title: "My View") {
                // Your content here
                Text("Hello World")
            }
        }
    }
    ```
 
 2. COMPLEX VIEWS (use NavigableView protocol):
    ```swift
    struct MyView: View, NavigableView {
        var navigationTitle: String { "My View" }
        
        var body: some View {
            BaseView {
                // Your content here
                Text("Hello World")
            }
        }
    }
    ```
 
 3. QUICK MODIFIER (use withNavigation):
    ```swift
    struct MyView: View {
        var body: some View {
            Text("Hello World")
                .withNavigation(title: "My View")
        }
    }
    ```
 
 4. CUSTOM BACK ACTION:
    ```swift
    struct MyView: View, NavigableView {
        var navigationTitle: String { "My View" }
        var customBackAction: (() -> Void)? {
            {
                // Custom logic here
                navigationManager.navigateBack()
            }
        }
        
        var body: some View {
            BaseView {
                Text("Hello World")
            }
        }
    }
    ```
 
 5. NO BACK BUTTON:
    ```swift
    struct MyView: View, NavigableView {
        var navigationTitle: String { "My View" }
        var showBackButton: Bool { false }
        
        var body: some View {
            BaseView {
                Text("Hello World")
            }
        }
    }
    ```
 
 */
