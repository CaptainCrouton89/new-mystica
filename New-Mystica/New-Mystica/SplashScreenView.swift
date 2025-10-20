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
                
                // Transition to main app after delay
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                    withAnimation(.easeInOut(duration: 0.5)) {
                        isActive = true
                    }
                }
            }
        }
    }
}

#Preview {
    SplashScreenView()
}
