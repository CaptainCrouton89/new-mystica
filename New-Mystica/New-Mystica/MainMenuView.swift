//
//  MainMenuView.swift
//  New-Mystica
//
//  Created by Silas Rhyneer on 10/19/25.
//

import SwiftUI

struct MainMenuView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    @EnvironmentObject private var audioManager: AudioManager
    
    var body: some View {
        // Change background style: .aurora, .floatingOrbs, or .starfield
        MysticaBackground(.starfield) {
            VStack(spacing: 40) {
                Spacer()
                
                // Title
                VStack(spacing: 16) {
                    Image("mystica_logo")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxWidth: 400, maxHeight: 200)
                        .popup(delay: 0.0)
                }
                
                Spacer()
                
                // Menu Options
                VStack(spacing: 24) {
                    Button {
                        audioManager.playMenuButtonClick()
                        navigationManager.navigateTo(.map)
                    } label: {
                        MenuOptionView(
                            title: "Map",
                            icon: "map.fill",
                            gradientColors: [Color.accent, Color.accentInteractive]
                        )
                    }
                    .buttonStyle(PlainButtonStyle())
                    .fadeIn(delay: 0.0)
                    
                    Button {
                        audioManager.playMenuButtonClick()
                        navigationManager.navigateTo(.collection)
                    } label: {
                        MenuOptionView(
                            title: "Collection",
                            icon: "square.grid.3x3.fill",
                            gradientColors: [Color.accentSecondary, Color.accent]
                        )
                    }
                    .buttonStyle(PlainButtonStyle())
                    .fadeIn(delay: 0.2)
                }
                .padding(.horizontal, 32)
                
                Spacer()
            }
        }
    }
}

struct MenuOptionView: View {
    let title: String
    let icon: String
    let gradientColors: [Color]
    
    
    var body: some View {
        HStack(spacing: 20) {
            // Icon
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: gradientColors),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 60, height: 60)
                
                Image(systemName: icon)
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundColor(.white)
            }
            
            // Text Content
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(FontManager.subtitle)
                    .foregroundColor(Color.textPrimary)
            }
            
            Spacer()
            
            // Arrow
            Image(systemName: "chevron.right")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(Color.accent)
        }
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }
}

#Preview {
    MainMenuView()
        .environmentObject(NavigationManager())
}
