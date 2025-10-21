//
//  DefeatView.swift
//  New-Mystica
//
//  Created by AI Assistant on 10/19/25.
//

import SwiftUI

struct DefeatView: View, NavigableView {
    @EnvironmentObject private var navigationManager: NavigationManager
    @EnvironmentObject private var audioManager: AudioManager
    
    var navigationTitle: String { "Defeat" }
    var showBackButton: Bool { false } // Cannot go back to battle
    
    var body: some View {
        BaseView(title: navigationTitle, showBackButton: showBackButton) {
            VStack(spacing: 0) {
                Spacer()
                
                // Defeat Content
                defeatContent
                
                Spacer()
                
                // Home Button Footer
                homeButtonFooter
            }
        }
        .onAppear {
            audioManager.playDefeat()
        }
    }
    
    // MARK: - Defeat Content
    @ViewBuilder
    private var defeatContent: some View {
        VStack(spacing: 32) {
            // Defeat Icon
            ZStack {
                Circle()
                    .fill(Color.red.opacity(0.2))
                    .frame(width: 120, height: 120)
                    .overlay(
                        Circle()
                            .stroke(Color.red, lineWidth: 3)
                    )
                    .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)
                
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 48, weight: .medium))
                    .foregroundColor(Color.red)
            }
            
            // Defeat Text
            VStack(spacing: 16) {
                TitleText("Defeat", size: 32)
                    .foregroundColor(Color.red)
                
                VStack(spacing: 12) {
                    NormalText("You have been defeated in battle.", size: 18)
                        .foregroundColor(Color.textPrimary)
                        .multilineTextAlignment(.center)
                    
                    NormalText("Don't give up! Every defeat is a lesson learned.", size: 16)
                        .foregroundColor(Color.textSecondary)
                        .multilineTextAlignment(.center)
                    
                    NormalText("Return to the map to try again or explore other areas.", size: 14)
                        .foregroundColor(Color.textSecondary)
                        .multilineTextAlignment(.center)
                }
            }
            
        }
        .padding(.horizontal, 40)
    }
    
    
    // MARK: - Home Button Footer
    @ViewBuilder
    private var homeButtonFooter: some View {
        VStack(spacing: 0) {
            Divider()
                .background(Color.borderSubtle)
            
            TextButton("Home", height: 56) {
                audioManager.playMenuButtonClick()
                navigationManager.resetToMainMenu()
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
        }
        .background(Color.backgroundPrimary)
    }
}

#Preview {
    DefeatView()
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
}
