import SwiftUI

struct AddItemLoadingView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    @State private var rotationAngle: Double = 0

    var body: some View {
        MysticaBackground(.aurora) {
            VStack(spacing: 32) {
                Spacer()

                // Animated loading spinner
                ZStack {
                    Circle()
                        .stroke(Color.accent.opacity(0.3), lineWidth: 8)
                        .frame(width: 100, height: 100)

                    Circle()
                        .trim(from: 0, to: 0.7)
                        .stroke(
                            LinearGradient(
                                gradient: Gradient(colors: [Color.accentInteractive, Color.accent]),
                                startPoint: .leading,
                                endPoint: .trailing
                            ),
                            style: StrokeStyle(lineWidth: 8, lineCap: .round)
                        )
                        .frame(width: 100, height: 100)
                        .rotationEffect(Angle(degrees: rotationAngle))
                }

                Text("Processing...")
                    .font(FontManager.title)
                    .foregroundColor(.white)

                Text("Analyzing your item")
                    .font(FontManager.body)
                    .foregroundColor(.white.opacity(0.8))

                Spacer()
            }
        }
        .navigationBarBackButtonHidden(true)
        .onAppear {
            startLoadingAnimation()
            navigateAfterDelay()
        }
    }

    private func startLoadingAnimation() {
        withAnimation(.linear(duration: 1.0).repeatForever(autoreverses: false)) {
            rotationAngle = 360
        }
    }

    private func navigateAfterDelay() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) {
            navigationManager.navigateTo(.addItemResult)
        }
    }
}

#Preview {
    AddItemLoadingView()
        .environmentObject(NavigationManager())
}
