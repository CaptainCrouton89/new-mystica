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
    @State private var profileController = ProfileController()
    @State private var inventoryViewModel: InventoryViewModel?
    @State private var equipmentViewModel: EquipmentViewModel?
    @Environment(\.navigationManager) private var navigationManager
    @Environment(\.audioManager) private var audioManager
    @Environment(\.backgroundImageManager) private var backgroundImageManager
    @Environment(AppState.self) private var appState

    private func logUserInfo() -> String {
        guard let user = appState.currentUser else {
            return "No user context available"
        }

        let usernameDescription: String
        if let username = user.username {
            let trimmed = username.trimmingCharacters(in: .whitespaces)
            if !trimmed.isEmpty {
                usernameDescription = "Username: \(trimmed)"
            } else {
                usernameDescription = "Username: Unspecified"
            }
        } else {
            usernameDescription = "Username: Unspecified"
        }

        let userInfoParts = [
            "User ID: \(user.id.uuidString)",
            usernameDescription
        ]

        return userInfoParts.joined(separator: ", ")
    }

    private func logErrorDetails(_ error: Error, context: String) -> String {
        let errorDescription = String(describing: error)
        let errorReflection = String(reflecting: error)
        let userInfo = logUserInfo()

        return """
        \(context)
        User Context: \(userInfo)
        Error Description: \(errorDescription)
        Detailed Error: \(errorReflection)
        """
    }

    init() {
        // Initialize will be deferred until navigationManager is available from environment
    }

    var body: some View {
        if isActive {
            ContentView()
                .environmentObject(navigationManager)
                .environmentObject(audioManager)
                .environment(\.backgroundImageManager, backgroundImageManager)
                .environment(appState)
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

                                            // If bootstrap failed, try registering as new device
                                            if !appState.isAuthenticated {
                                                print("⚠️  [SPLASH] Bootstrap failed on retry, registering new device...")
                                                await authViewModel.registerDevice()
                                            }
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
                                        await profileController.loadProfileAndCurrencies()

                                        // Check for active combat session (auto-resume flow)
                                        print("🎮 [SPLASH] Checking for active combat session...")
                                        await appState.checkActiveCombatSession(repository: DefaultCombatRepository())

                                        await equipmentViewModel?.fetchEquipment()

                                        // Check if we need to auto-resume combat
                                        if case .loaded(let session) = appState.activeCombatSession,
                                           let activeSession = session {
                                            print("⚔️ [SPLASH] Active combat session found, navigating to battle...")
                                            navigationManager.navigateTo(.battle)
                                        } else {
                                            print("✅ [SPLASH] No active combat, transitioning to main menu")
                                        }

                                        withAnimation(.easeInOut(duration: 0.5)) {
                                            isActive = true
                                        }
                                    } catch {
                                        print("❌ [SPLASH] Retry failed: \(String(describing: error))\nError details: \(String(reflecting: error))")
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
                // Get device ID outside do block so it's in scope for catch
                let deviceId = DeviceIdentifier.getDeviceId()

                do {
                    // Initialize viewModels with navigationManager
                    let inventory = InventoryViewModel(navigationManager: navigationManager)
                    let equipment = EquipmentViewModel(inventoryViewModel: inventory)
                    inventoryViewModel = inventory
                    equipmentViewModel = equipment

                    print("🚀 [SPLASH] Starting app initialization... [deviceId: \(deviceId)]")
                    let hasToken = KeychainService.get(key: "mystica_access_token") != nil

                    // Auth phase
                    loadingText = "Authenticating..."
                    print("🔐 [SPLASH] Has existing token:", hasToken, "[deviceId: \(deviceId)]")
                    if !hasToken {
                        print("📱 [SPLASH] No token found, registering new device...")
                        await authViewModel.registerDevice()
                    } else {
                        print("🔄 [SPLASH] Token found, bootstrapping session...")
                        await authViewModel.bootstrapSession()

                        // If bootstrap failed, try registering as new device
                        if !appState.isAuthenticated {
                            print("⚠️  [SPLASH] Bootstrap failed, token was invalid. Registering new device...")
                            await authViewModel.registerDevice()
                        }
                    }

                    // Check if auth succeeded
                    guard appState.isAuthenticated else {
                        if case .error(let error) = appState.authSession {
                            let userIdDescription: String
                            if let userId = appState.currentUser?.id.uuidString {
                                userIdDescription = "User ID: \(userId)"
                            } else {
                                userIdDescription = "No user ID available"
                            }
                            print("❌ [SPLASH] Authentication failed [deviceId: \(deviceId), \(userIdDescription)]: \(String(describing: error))")
                            print("Error details: \(String(reflecting: error))")
                            errorMessage = error.localizedDescription
                        } else {
                            let userIdDescription: String
                            if let userId = appState.currentUser?.id.uuidString {
                                userIdDescription = "User ID: \(userId)"
                            } else {
                                userIdDescription = "No user ID available"
                            }
                            print("❌ [SPLASH] Authentication failed [deviceId: \(deviceId), \(userIdDescription)]")
                            errorMessage = "Authentication failed"
                        }
                        return
                    }

                    let userInfo = logUserInfo()
                    print("✅ [SPLASH] Authentication successful [deviceId: \(deviceId), \(userInfo)]")

                    // Data loading phase
                    loadingText = "Loading player data..."
                    print("⚔️ [SPLASH] Loading equipment data... [deviceId: \(deviceId), \(userInfo)]")

                    // Load profile and currencies (required for gold balance display)
                    print("💰 [SPLASH] Loading profile and currencies... [deviceId: \(deviceId), \(userInfo)]")
                    await profileController.loadProfileAndCurrencies()

                    // Check for active combat session (auto-resume flow)
                    print("🎮 [SPLASH] Checking for active combat session... [deviceId: \(deviceId), \(userInfo)]")
                    await appState.checkActiveCombatSession(repository: DefaultCombatRepository())

                    // Attempt to load equipment, but don't fail splash if it errors
                    do {
                        await equipment.fetchEquipment()
                    } catch {
                        // Log equipment loading error but continue
                        print("⚠️  [SPLASH] Equipment loading failed (continuing anyway):", error.localizedDescription)
                    }

                    // Check if we need to auto-resume combat
                    if case .loaded(let session) = appState.activeCombatSession,
                       let activeSession = session {
                        let userInfo = logUserInfo()
print("⚔️ [SPLASH] Active combat session found, navigating to battle... [deviceId: \(deviceId), \(userInfo), sessionId: \(activeSession.sessionId)]")
                        navigationManager.navigateTo(.battle)
                    } else {
                        let userInfo = logUserInfo()
print("✅ [SPLASH] No active combat, transitioning to main menu [deviceId: \(deviceId), \(userInfo)]")
                    }

                    // Transition to ContentView
                    withAnimation(.easeInOut(duration: 0.5)) {
                        isActive = true
                    }
                } catch {
                    let userIdDescription: String
                    if let userId = appState.currentUser?.id.uuidString {
                        userIdDescription = userId
                    } else {
                        userIdDescription = "UNKNOWN"
                    }
                    print("❌ [SPLASH] Initialization failed [deviceId: \(deviceId), userId: \(userIdDescription)]: \(String(describing: error))")
                    print("Error details: \(String(reflecting: error))")
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
