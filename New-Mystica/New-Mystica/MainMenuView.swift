import SwiftUI

struct MainMenuView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    @Environment(\.audioManager) private var audioManager
    @Environment(\.backgroundImageManager) private var backgroundImageManager

    var body: some View {
        // Change background style: .aurora, .floatingOrbs, .starfield, .image(backgroundImageManager), or .imageWithOrbs(backgroundImageManager)
        MysticaBackground(.imageWithOrbs(backgroundImageManager)) {
            ZStack {
                VStack(spacing: 10) {
                    Spacer()
                    
                    VStack() {
                        Image("mystica_logo")
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(maxWidth: 800, maxHeight: 400)
                            .popup(delay: 0.0)
                    }
                    
                    Spacer()
                    
                    VStack(spacing: 16) {
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

                        Button {
                            audioManager.playMenuButtonClick()
                            navigationManager.navigateTo(.equipment)
                        } label: {
                            MenuOptionView(
                                title: "Equipment",
                                icon: "shield.fill",
                                gradientColors: [Color.accent, Color.accentSecondary]
                            )
                        }
                        .buttonStyle(PlainButtonStyle())
                        .fadeIn(delay: 0.4)

                        Button {
                            audioManager.playMenuButtonClick()
                            navigationManager.navigateTo(.addItemCamera)
                        } label: {
                            MenuOptionView(
                                title: "Add Item/Material",
                                icon: "camera.fill",
                                gradientColors: [Color.accentInteractive, Color.accentSecondary]
                            )
                        }
                        .buttonStyle(PlainButtonStyle())
                        .fadeIn(delay: 0.6)
                    }
                    .padding(.horizontal, 32)
                    
                    Spacer()
                }
                
                // Settings gear icon in top right corner
                VStack {
                    HStack {
                        Spacer()
                        Button {
                            audioManager.playMenuButtonClick()
                            navigationManager.navigateTo(.settings)
                        } label: {
                            Image("settings-gear")
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(width: 64, height: 64)
                                .shadow(color: .black.opacity(0.3), radius: 4, x: 2, y: 2)
                        }
                        .buttonStyle(PlainButtonStyle())
                        .padding(.top, 6)
                        .padding(.trailing, 20)
                    }
                    Spacer()
                }
            }
        }
        .onAppear {
            audioManager.playBackgroundMusic()
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
            RoundedRectangle(cornerRadius: .cornerRadiusExtraLarge)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: .cornerRadiusExtraLarge)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }
}

#Preview {
    MainMenuView()
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
        .environmentObject(BackgroundImageManager())
}
