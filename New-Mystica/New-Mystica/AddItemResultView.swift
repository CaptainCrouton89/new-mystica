import SwiftUI

struct AddItemResultView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    @Environment(\.audioManager) private var audioManager

    var body: some View {
        MysticaBackground(.imageWithOrbs(BackgroundImageManager())) {
            VStack(spacing: 32) {
                Spacer()

                // Success icon
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [Color.accentInteractive, Color.accent]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 120, height: 120)

                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 60))
                        .foregroundColor(.white)
                }
                .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 5)

                Text("Success!")
                    .font(FontManager.title)
                    .foregroundColor(.white)

                VStack(spacing: 16) {
                    Text("This is some test text")
                        .font(FontManager.subtitle)
                        .foregroundColor(.white)

                    Text("Your item has been processed")
                        .font(FontManager.body)
                        .foregroundColor(.white.opacity(0.8))

                    Text("Additional information can go here")
                        .font(FontManager.body)
                        .foregroundColor(.white.opacity(0.8))
                }
                .padding(.horizontal, 32)
                .multilineTextAlignment(.center)

                Spacer()

                // Done button
                Button {
                    audioManager.playMenuButtonClick()
                    navigationManager.resetToMainMenu()
                } label: {
                    HStack {
                        Text("Done")
                            .font(FontManager.subtitle)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 18, weight: .semibold))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 48)
                    .padding(.vertical, 18)
                    .background(
                        RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                            .fill(
                                LinearGradient(
                                    gradient: Gradient(colors: [Color.accentInteractive, Color.accent]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                    )
                }
                .buttonStyle(PlainButtonStyle())
                .shadow(color: .black.opacity(0.2), radius: 8, x: 0, y: 4)
                .padding(.bottom, 60)
            }
        }
        .navigationBarBackButtonHidden(true)
    }
}

#Preview {
    AddItemResultView()
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
}
