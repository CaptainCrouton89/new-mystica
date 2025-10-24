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
    private let gridColumns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 5)

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
                // Header with title and close button
                ZStack {
                    HStack {
                        Spacer()
                        IconButton(icon: "xmark", size: 40) {
                            onDismiss()
                        }
                    }

                    VStack(spacing: 8) {
                        TitleText("Select Combat Level")
                            .foregroundColor(Color.textPrimary)

                        NormalText("Choose your challenge")
                            .foregroundColor(Color.textSecondary)
                    }
                }

                // Recommended level indicator
                HStack {
                    Spacer()
                    Text("Recommended for your gear: \(recommendedLevel)")
                        .font(.caption)
                        .foregroundColor(Color.accent)
                        .shadow(color: Color.accent.opacity(0.3), radius: 2)
                    Spacer()
                }

                // Level selection grid
                LazyVGrid(columns: gridColumns, spacing: 12) {
                    ForEach(levels, id: \.self) { level in
                        levelButton(for: level)
                    }
                }
                .padding(.horizontal, 8)

                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: Color.accent))
                        .scaleEffect(1.2)
                        .padding(.top, 16)
                }
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
            .shadow(color: Color.black.opacity(0.3), radius: 20, x: 0, y: 10)
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
            Text("\(level)")
                .font(.system(size: 18, weight: .bold, design: .default))
                .foregroundColor(Color.textPrimary)
                .frame(width: 60, height: 60)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.backgroundSecondary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(
                            level == recommendedLevel ? Color.accent : Color.borderSubtle,
                            lineWidth: level == recommendedLevel ? 2 : 1
                        )
                        .shadow(
                            color: level == recommendedLevel ? Color.accent.opacity(0.4) : Color.clear,
                            radius: level == recommendedLevel ? 4 : 0
                        )
                )
        }
        .buttonStyle(LevelButtonStyle())
        .accessibilityLabel("Level \(level)")
        .accessibilityHint(level == recommendedLevel ? "Recommended level" : "")
        .disabled(isLoading)
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