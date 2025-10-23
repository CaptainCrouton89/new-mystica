//
//  NavigationExamples.swift
//  New-Mystica
//
//  Created by AI Assistant on 10/19/25.
//

import SwiftUI

// MARK: - Example: How to Create New Views with Automatic Navigation

// Method 1: Using NavigableView Protocol (Recommended for complex views)
struct ExampleSettingsView: View, NavigableView {
    @Environment(\.navigationManager) private var navigationManager

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

// Method 2: Using the withNavigation modifier (Quick and easy)
struct ExampleInventoryView: View {
    @Environment(\.navigationManager) private var navigationManager

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
    @Environment(\.navigationManager) private var navigationManager
    
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
    @Environment(\.navigationManager) private var navigationManager
    
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

