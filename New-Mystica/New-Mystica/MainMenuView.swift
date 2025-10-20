//
//  MainMenuView.swift
//  New-Mystica
//
//  Created by Silas Rhyneer on 10/19/25.
//

import SwiftUI

struct MainMenuView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    
    var body: some View {
            ZStack {
                // Background
                Color.mysticaDarkBrown
                    .ignoresSafeArea()
                
                VStack(spacing: 40) {
                    Spacer()
                    
                    // Title
                    VStack(spacing: 16) {
                        TitleText("Mystica")
                            .font(.custom("Impact", size: 48))
                        
                        NormalText("Your Adventure Awaits")
                            .font(.custom("Impact", size: 18))
                    }
                    
                    Spacer()
                    
                    // Menu Options
                    VStack(spacing: 24) {
                        Button {
                            navigationManager.navigateTo(.map)
                        } label: {
                            MenuOptionView(
                                title: "Map",
                                subtitle: "Explore the world",
                                icon: "map.fill",
                                gradientColors: [Color.mysticaLightBrown, Color.mysticaWarmBrown]
                            )
                        }
                        .buttonStyle(PlainButtonStyle())
                        
                        Button {
                            navigationManager.navigateTo(.collection)
                        } label: {
                            MenuOptionView(
                                title: "Collection",
                                subtitle: "View your items",
                                icon: "square.grid.3x3.fill",
                                gradientColors: [Color.mysticaAccentGold, Color.mysticaLightBrown]
                            )
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                    .padding(.horizontal, 32)
                    
                    Spacer()
                    
                    // Footer
                    SmallText("Tap to begin your journey")
                        .padding(.bottom, 32)
                }
            }
    }
}

struct MenuOptionView: View {
    let title: String
    let subtitle: String
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
                    .font(.custom("Impact", size: 22))
                    .foregroundColor(Color.mysticaLightGray)
                
                Text(subtitle)
                    .font(.custom("Impact", size: 16))
                    .foregroundColor(Color.mysticaSoftBrown)
            }
            
            Spacer()
            
            // Arrow
            Image(systemName: "chevron.right")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(Color.mysticaLightBrown)
        }
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.mysticaCharcoal)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.mysticaDarkGray, lineWidth: 1)
                )
        )
    }
}

#Preview {
    MainMenuView()
        .environmentObject(NavigationManager())
}
