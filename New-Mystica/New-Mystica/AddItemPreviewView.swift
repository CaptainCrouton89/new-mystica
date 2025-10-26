import SwiftUI

struct AddItemPreviewView: View {
    let image: UIImage
    @EnvironmentObject private var navigationManager: NavigationManager
    @Environment(\.audioManager) private var audioManager

    var body: some View {
        MysticaBackground(.floatingOrbs) {
            VStack(spacing: 32) {
                Spacer()

                // Image preview
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxWidth: 350, maxHeight: 450)
                    .cornerRadius(.cornerRadiusLarge)
                    .overlay(
                        RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                            .stroke(Color.borderSubtle, lineWidth: 2)
                    )
                    .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 5)

                Spacer()

                // Buttons
                HStack(spacing: 20) {
                    // Retake button
                    Button {
                        audioManager.playMenuButtonClick()
                        navigationManager.navigateBack()
                    } label: {
                        HStack {
                            Image(systemName: "camera.rotate")
                                .font(.system(size: 20, weight: .semibold))
                            Text("Retake")
                                .font(FontManager.body)
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, 32)
                        .padding(.vertical, 16)
                        .background(
                            RoundedRectangle(cornerRadius: .cornerRadiusMedium)
                                .fill(Color.accentSecondary)
                        )
                    }
                    .buttonStyle(PlainButtonStyle())

                    // Confirm button
                    Button {
                        audioManager.playMenuButtonClick()
                        navigationManager.navigateTo(.addItemLoading)
                    } label: {
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 20, weight: .semibold))
                            Text("Confirm")
                                .font(FontManager.body)
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, 32)
                        .padding(.vertical, 16)
                        .background(
                            RoundedRectangle(cornerRadius: .cornerRadiusMedium)
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
                }
                .padding(.bottom, 40)
            }
            .padding(.horizontal, 24)
        }
        .navigationBarBackButtonHidden(false)
    }
}

#Preview {
    // Create a simple test image for preview
    let testImage = UIImage(systemName: "photo") ?? UIImage()
    return AddItemPreviewView(image: testImage)
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
}
