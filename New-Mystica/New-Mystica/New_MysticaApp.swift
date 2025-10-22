//
//  New_MysticaApp.swift
//  New-Mystica
//
//  Created by Silas Rhyneer on 10/19/25.
//

import SwiftUI
import SwiftData

@main
struct New_MysticaApp: App {
    // Modern dependency injection - all services managed as Environment values
    @State private var navigationManager = NavigationManager()
    @State private var audioManager = AudioManager.shared
    @State private var backgroundImageManager = BackgroundImageManager()
    @State private var appState = AppState.shared

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            Item.self,
        ])
        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            SplashScreenView()
                .environment(\.navigationManager, navigationManager)
                .environment(\.audioManager, audioManager)
                .environment(\.backgroundImageManager, backgroundImageManager)
                .environment(appState)
                .onAppear {
                    // Restore auth session on app launch
                    Task {
                        await appState.restoreAuthSession()
                    }
                }
        }
        .modelContainer(sharedModelContainer)
    }
}
