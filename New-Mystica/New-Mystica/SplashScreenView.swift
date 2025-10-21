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
    @EnvironmentObject private var navigationManager: NavigationManager
    @EnvironmentObject private var audioManager: AudioManager
    @EnvironmentObject private var authService: AuthService
    
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
                VStack {
                    Spacer()
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.8)
                        .opacity(opacity)
                        .padding(.bottom, 50)
                }
            }
            .onAppear {
                // Animate the splash screen appearance
                withAnimation(.easeInOut(duration: 1.0)) {
                    opacity = 1.0
                    scale = 1.0
                }
            }
            .task {
                // Check if device has authentication token
                let hasToken = KeychainService.get(key: "mystica_access_token") != nil

                if !hasToken {
                    // Register device if no token exists
                    try? await authService.registerDevice()
                } else {
                    // Bootstrap session if token exists
                    _ = await authService.bootstrapSession()
                }

                // Navigate to map (user is now authenticated)
                navigationManager.navigateTo(.map)

                // Transition to main app
                withAnimation(.easeInOut(duration: 0.5)) {
                    isActive = true
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
}
