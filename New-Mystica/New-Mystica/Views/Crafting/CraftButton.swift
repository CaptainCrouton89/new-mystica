import SwiftUI

// MARK: - Craft Button Component
struct CraftButton: View {
    let isEnabled: Bool
    let isProcessing: Bool
    let onCraft: () -> Void

    @State private var isPressed = false
    @Environment(\.audioManager) private var audioManager

    // MARK: - Computed Properties

    var backgroundColor: Color {
        if isProcessing {
            return Color.accent.opacity(0.8)
        }
        if !isEnabled {
            return Color.backgroundSecondary
        }
        return isPressed ? Color.accentInteractive : Color.accent
    }

    var foregroundColor: Color {
        if !isEnabled {
            return Color.textSecondary
        }
        return Color.textPrimary
    }

    var buttonTitle: String {
        isProcessing ? "Crafting..." : "Craft"
    }

    var isInteractive: Bool {
        isEnabled && !isProcessing
    }

    // MARK: - Body

    var body: some View {
        Button(action: {
            if isInteractive {
                audioManager.playMenuButtonClick()
                onCraft()
            }
        }) {
            HStack(spacing: 12) {
                if isProcessing {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: Color.textPrimary))
                        .scaleEffect(0.8)
                }

                Text(buttonTitle)
                    .font(FontManager.body)
                    .foregroundColor(foregroundColor)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(backgroundColor)
            )
        }
        .buttonStyle(PlainButtonStyle())
        .scaleEffect(isPressed && isInteractive ? 0.98 : 1.0)
        .disabled(!isInteractive)
        .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
            if isInteractive {
                withAnimation(.easeOut(duration: 0.15)) {
                    isPressed = pressing
                }
            }
        }, perform: {})
    }
}

// MARK: - SwiftUI Preview
#Preview {
    VStack(spacing: 20) {
        // Enabled State
        CraftButton(
            isEnabled: true,
            isProcessing: false,
            onCraft: { print("Craft tapped - Enabled") }
        )

        // Disabled State
        CraftButton(
            isEnabled: false,
            isProcessing: false,
            onCraft: { print("Craft tapped - Disabled") }
        )

        // Loading/Processing State
        CraftButton(
            isEnabled: true,
            isProcessing: true,
            onCraft: { print("Craft tapped - Processing") }
        )
    }
    .padding()
    .background(Color.backgroundPrimary)
    .environment(\.audioManager, AudioManager.shared)
}