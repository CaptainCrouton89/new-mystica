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
    @State private var authViewModel = AuthViewModel(appState: AppState.shared)
    @State private var equipmentViewModel = EquipmentViewModel()
    @Environment(\.navigationManager) private var navigationManager
    @Environment(\.audioManager) private var audioManager
    @Environment(AppState.self) private var appState
    
    var body: some View {
        if isActive {
            ContentView()
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
                                            await authViewModel.registerDevice()
                                        } else {
                                            await authViewModel.bootstrapSession()
                                        }

                                        // Check if auth succeeded
                                        guard appState.isAuthenticated else {
                                            if case .error(let error) = appState.authSession {
                                                errorMessage = error.localizedDescription
                                            } else {
                                                errorMessage = "Authentication failed"
                                            }
                                            return
                                        }

                                        loadingText = "Loading player data..."
                                        await equipmentViewModel.fetchEquipment()

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
                        await authViewModel.registerDevice()
                    } else {
                        print("🔄 [SPLASH] Token found, bootstrapping session...")
                        await authViewModel.bootstrapSession()
                    }

                    // Check if auth succeeded
                    guard appState.isAuthenticated else {
                        if case .error(let error) = appState.authSession {
                            errorMessage = error.localizedDescription
                        } else {
                            errorMessage = "Authentication failed"
                        }
                        return
                    }

                    // Data loading phase
                    loadingText = "Loading player data..."
                    print("⚔️ [SPLASH] Loading equipment data...")
                    await equipmentViewModel.fetchEquipment()

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
        .environment(AppState.shared)
}
