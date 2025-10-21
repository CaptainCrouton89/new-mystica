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
                .environmentObject(navigationManager)
                .environmentObject(audioManager)
                .onAppear {
                    // Debug: List all available fonts
                    print("🔍 Available font families:")
                    for family in UIFont.familyNames.sorted() {
                        print("  📁 \(family)")
                        for font in UIFont.fontNames(forFamilyName: family) {
                            print("    📝 \(font)")
                        }
                    }
                }
        }
        .modelContainer(sharedModelContainer)
    }
}
