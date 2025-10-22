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
    @StateObject private var navigationManager = NavigationManager()
    @StateObject private var audioManager = AudioManager.shared
    @StateObject private var backgroundImageManager = BackgroundImageManager()

    // New architecture
    private let appState = AppState.shared
    private let authViewModel: AuthViewModel
    private let equipmentViewModel: EquipmentViewModel

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

    init() {
        self.authViewModel = AuthViewModel(appState: AppState.shared)
        self.equipmentViewModel = EquipmentViewModel()
    }

    var body: some Scene {
        WindowGroup {
            SplashScreenView()
                .environmentObject(navigationManager)
                .environmentObject(audioManager)
                .environmentObject(backgroundImageManager)
                .environment(appState)
        }
        .modelContainer(sharedModelContainer)
    }
}
