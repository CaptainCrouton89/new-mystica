//
//  SplashScreenView.swift
//  New-Mystica
//
//  Created by AI Assistant on 1/27/25.
//

import SwiftUI

struct SplashScreenView: View {
    @State private var isActive = false
    @State private var opacity = 0.0
    @State private var scale = 0.8
    @State private var loadingText: String = ""
    @State private var errorMessage: String?
    @EnvironmentObject private var navigationManager: NavigationManager
    @EnvironmentObject private var audioManager: AudioManager
    @EnvironmentObject private var authService: AuthService
    @EnvironmentObject var equipmentService: EquipmentService
    
    var body: some View {
        if isActive {
            ContentView()
                .environmentObject(navigationManager)
                .environmentObject(audioManager)
        } else {
            ZStack {
                // Background color that matches the splash screen aesthetic
                Color.backgroundPrimary
                    .ignoresSafeArea()
                
                // Full screen splash screen image
                Image("mystica_splash_screen")
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: UIScreen.main.bounds.width, height: UIScreen.main.bounds.height)
                    .clipped()
                    .ignoresSafeArea()
                    .opacity(opacity)
                    .scaleEffect(scale)
                    .animation(.easeInOut(duration: 1.0), value: opacity)
                    .animation(.easeInOut(duration: 1.0), value: scale)
                
                // Optional loading indicator overlay
                VStack(spacing: 20) {
                    Spacer()

                    if let error = errorMessage {
                        VStack(spacing: 16) {
                            Text(error)
                                .foregroundColor(.red)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 32)

                            Button("Retry") {
                                errorMessage = nil
                                loadingText = ""
                                Task {
                                    // Re-run the entire loading sequence
                                    do {
                                        print("🔄 [SPLASH] Retry button pressed, restarting initialization...")
                                        let hasToken = KeychainService.get(key: "mystica_access_token") != nil

                                        loadingText = "Authenticating..."
                                        if !hasToken {
                                            try await authService.registerDevice()
                                        } else {
                                            try await authService.bootstrapSession()
                                        }

                                        loadingText = "Loading player data..."
                                        try await equipmentService.loadEquipment()

                                        withAnimation(.easeInOut(duration: 0.5)) {
                                            isActive = true
                                        }
                                    } catch {
                                        print("❌ [SPLASH] Retry failed:", error.localizedDescription)
                                        errorMessage = "Unable to load player data. Please check your connection."
                                    }
                                }
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    } else {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(1.2)
                            .opacity(opacity)

                        if !loadingText.isEmpty {
                            Text(loadingText)
                                .foregroundColor(.white)
                                .font(.system(size: 16))
                        }
                    }

                    Spacer()
                }
                .padding(.bottom, 80)
            }
            .onAppear {
                // Animate the splash screen appearance
                withAnimation(.easeInOut(duration: 1.0)) {
                    opacity = 1.0
                    scale = 1.0
                }
            }
            .task {
                do {
                    print("🚀 [SPLASH] Starting app initialization...")
                    let hasToken = KeychainService.get(key: "mystica_access_token") != nil

                    // Auth phase
                    loadingText = "Authenticating..."
                    print("🔐 [SPLASH] Has existing token:", hasToken)
                    if !hasToken {
                        print("📱 [SPLASH] No token found, registering new device...")
                        try await authService.registerDevice()
                    } else {
                        print("🔄 [SPLASH] Token found, bootstrapping session...")
                        try await authService.bootstrapSession()
                    }

                    // Data loading phase
                    loadingText = "Loading player data..."
                    print("⚔️ [SPLASH] Loading equipment data...")
                    try await equipmentService.loadEquipment()

                    // Navigation (FIXED - no .map navigation)
                    // Let ContentView start at MainMenuView naturally
                    print("✅ [SPLASH] Initialization complete, transitioning to main menu")
                    withAnimation(.easeInOut(duration: 0.5)) {
                        isActive = true
                    }
                } catch {
                    print("❌ [SPLASH] Initialization failed:", error.localizedDescription)
                    errorMessage = "Unable to load player data. Please check your connection."
                }
            }
        }
    }
}

#Preview {
    SplashScreenView()
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
        .environmentObject(AuthService.shared)
        .environmentObject(EquipmentService.shared)
}
