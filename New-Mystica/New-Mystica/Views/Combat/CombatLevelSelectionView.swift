import SwiftUI
import SwiftData
import UIKit

struct CombatLevelSelectionView: View {
    @Environment(\.navigationManager) private var navigationManager
    @Environment(\.audioManager) private var audioManager
    @State private var isLoading = false
    @State private var showingError = false
    @State private var errorMessage = ""

    let locationId: String
    let recommendedLevel: Int
    let onDismiss: () -> Void
    let onLevelSelected: (Int) -> Void

    private let levels = Array(1...10)
    private let gridColumns = Array(repeating: GridItem(.flexible(), spacing: 16), count: 3)

    var body: some View {
        ZStack {
            // Semi-transparent overlay with blur background
            Color.black.opacity(0.6)
                .edgesIgnoringSafeArea(.all)
                .onTapGesture {
                    audioManager.playMenuButtonClick()
                    onDismiss()
                }

            // Modal card
            VStack(spacing: 20) {
                // Header with title
                VStack(spacing: 8) {
                    NormalText("Select Combat Level")
                        .foregroundColor(Color.textPrimary)
                }

                // Level selection grid (scrollable)
                ScrollView {
                    LazyVGrid(columns: gridColumns, spacing: 16) {
                        ForEach(levels, id: \.self) { level in
                            levelButton(for: level)
                        }
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 16)
                }
                .frame(maxHeight: 400)
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
            .shadow(color: Color.black.opacity(0.3), radius: 20, x: 0, y: 10)
            .overlay(
                // Cancel button positioned on the top-right corner of the modal
                VStack {
                    HStack {
                        Spacer()
                        Button {
                            audioManager.playCancelClick()
                            onDismiss()
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 24))
                                .foregroundColor(Color.textSecondary)
                        }
                        .disabled(isLoading)
                        .padding(.top, 8)
                        .padding(.trailing, 8)
                    }
                    Spacer()
                },
                alignment: .topTrailing
            )
            .padding(.horizontal, 40)
        }
        .alert("Combat Error", isPresented: $showingError) {
            Button("OK") {
                showingError = false
            }
        } message: {
            Text(errorMessage)
        }
    }

    private func levelButton(for level: Int) -> some View {
        Button {
            selectLevel(level)
        } label: {
            ZStack(alignment: .top) {
                // Main button content
                Text("\(level)")
                    .font(.system(size: 22, weight: .bold, design: .default))
                    .foregroundColor(Color.textPrimary)
                    .frame(width: 80, height: 80)
                    .background(
                        RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                            .fill(
                                LinearGradient(
                                    gradient: Gradient(colors: [levelStartColor(for: level), levelEndColor(for: level)]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                            .stroke(
                                level == recommendedLevel ? Color.accent : Color.borderSubtle,
                                lineWidth: level == recommendedLevel ? 2 : 1
                            )
                            .shadow(
                                color: level == recommendedLevel ? Color.accent.opacity(0.4) : Color.clear,
                                radius: level == recommendedLevel ? 4 : 0
                            )
                    )

                // Recommended badge on top border
                if level == recommendedLevel {
                    Text("Recommended")
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(Color.accent)
                        )
                        .offset(y: -8)
                        .shadow(color: Color.accent.opacity(0.3), radius: 2)
                }
            }
        }
        .buttonStyle(LevelButtonStyle())
        .accessibilityLabel("Level \(level)")
        .accessibilityHint(level == recommendedLevel ? "Recommended level" : "")
        .disabled(isLoading)
    }

    private func levelStartColor(for level: Int) -> Color {
        // Map level 1-10 to colors from green → yellow → orange → red
        switch level {
        case 1: return Color(red: 0.2, green: 0.8, blue: 0.2).opacity(0.5)      // Green
        case 2: return Color(red: 0.3, green: 0.8, blue: 0.1).opacity(0.5)      // Green-Yellow
        case 3: return Color(red: 0.5, green: 0.8, blue: 0.0).opacity(0.5)      // Yellow-Green
        case 4: return Color(red: 0.7, green: 0.7, blue: 0.0).opacity(0.5)      // Yellow
        case 5: return Color(red: 0.8, green: 0.6, blue: 0.0).opacity(0.5)      // Yellow-Orange
        case 6: return Color(red: 0.85, green: 0.5, blue: 0.0).opacity(0.5)     // Orange
        case 7: return Color(red: 0.9, green: 0.4, blue: 0.0).opacity(0.5)      // Orange-Red
        case 8: return Color(red: 0.95, green: 0.3, blue: 0.0).opacity(0.5)     // Red-Orange
        case 9: return Color(red: 1.0, green: 0.2, blue: 0.1).opacity(0.5)      // Red
        case 10: return Color(red: 1.0, green: 0.0, blue: 0.0).opacity(0.5)     // Pure Red
        default: return Color(red: 0.2, green: 0.8, blue: 0.2).opacity(0.5)
        }
    }

    private func levelEndColor(for level: Int) -> Color {
        // Darker variant of the start color for gradient effect
        let startColor = levelStartColor(for: level)
        return startColor.opacity(0.4)
    }

    private func selectLevel(_ level: Int) {
        guard !isLoading else { return }

        // Haptic feedback
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.prepare()
        generator.impactOccurred()

        // Audio feedback
        audioManager.playMenuButtonClick()

        // Show loading state briefly
        withAnimation(.easeInOut(duration: 0.2)) {
            isLoading = true
        }

        // Brief delay for visual feedback, then start combat
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            onLevelSelected(level)
        }
    }
}

// Custom button style for level buttons
struct LevelButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .brightness(configuration.isPressed ? 0.1 : 0.0)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

// MARK: - Preview
struct CombatLevelSelectionView_Previews: PreviewProvider {
    static var previews: some View {
        CombatLevelSelectionView(
            locationId: "test-location-id",
            recommendedLevel: 5,
            onDismiss: {},
            onLevelSelected: { level in
                print("Selected level: \(level)")
            }
        )
        .modelContainer(for: Item.self, inMemory: true)
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
        .previewDisplayName("Combat Level Selection")
    }
}