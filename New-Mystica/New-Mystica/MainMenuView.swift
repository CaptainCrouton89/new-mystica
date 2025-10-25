import SwiftUI

struct MainMenuView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    @Environment(\.audioManager) private var audioManager
    @Environment(\.backgroundImageManager) private var backgroundImageManager

    var body: some View {
        // Change background style: .aurora, .floatingOrbs, .starfield, or .image(backgroundImageManager)
        MysticaBackground(.image(backgroundImageManager)) {
            VStack(spacing: 40) {
                Spacer()
                
                VStack(spacing: 16) {
                    Image("mystica_logo")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxWidth: 400, maxHeight: 200)
                        .popup(delay: 0.0)
                }
                
                Spacer()
                
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
                        navigationManager.navigateTo(.settings)
                    } label: {
                        MenuOptionView(
                            title: "Settings",
                            icon: "gearshape.fill",
                            gradientColors: [Color.accentInteractive, Color.accent]
                        )
                    }
                    .buttonStyle(PlainButtonStyle())
                    .fadeIn(delay: 0.6)
                    
                    Button {
                        audioManager.playMenuButtonClick()
                        navigationManager.navigateTo(.testAnimations)
                    } label: {
                        MenuOptionView(
                            title: "Test Animations",
                            icon: "play.rectangle.fill",
                            gradientColors: [Color.purple, Color.pink]
                        )
                    }
                    .buttonStyle(PlainButtonStyle())
                    .fadeIn(delay: 0.8)
                    
                    Button {
                        audioManager.playMenuButtonClick()
                        navigationManager.navigateTo(.transparencyTests)
                    } label: {
                        MenuOptionView(
                            title: "Transparency Tests",
                            icon: "eye.fill",
                            gradientColors: [Color.orange, Color.red]
                        )
                    }
                    .buttonStyle(PlainButtonStyle())
                    .fadeIn(delay: 1.0)
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
        .environmentObject(AudioManager.shared)
        .environmentObject(BackgroundImageManager())
}
