//
//  DefeatView.swift
//  New-Mystica
//
//  Combat defeat screen with encouragement and basic stats
//

import SwiftUI
import SwiftData

struct DefeatView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    @Environment(AppState.self) var appState

    // Combat stats from AppState (populated by CombatViewModel on defeat)
    private var totalDamageDealt: Double {
        appState.lastCombatMetadata?.totalDamageDealt ?? 0
    }

    private var turnsSurvived: Int {
        appState.lastCombatMetadata?.turnsSurvived ?? 0
    }

    private var highestMultiplier: Double {
        appState.lastCombatMetadata?.highestMultiplier ?? 1.0
    }

    var body: some View {
        ZStack {
            // Background
            Color.backgroundPrimary
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 32) {
                    Spacer()
                        .frame(height: 30)

                    // Header Section
                    VStack(spacing: 16) {
                        // Warning Triangle Icon
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 64, weight: .bold))
                            .foregroundColor(.alert)
                            .popup(delay: 0.2)

                        // Defeat Title
                        TitleText("Defeat")
                            .foregroundColor(.alert)
                            .slideInFromBottom(delay: 0.4)
                    }

                    // Encouragement Message
                    VStack(spacing: 12) {
                        NormalText("Every defeat is a lesson learned.")
                            .slideInFromBottom(delay: 0.6)
                            .multilineTextAlignment(.center)

                        NormalText("Study your enemy's patterns and try again!")
                            .slideInFromBottom(delay: 0.8)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.horizontal, 24)

                    // Combat Stats Section
                    VStack(spacing: 20) {
                        TitleText("Your Performance", size: 22)
                            .slideInFromBottom(delay: 1.0)

                        VStack(spacing: 16) {
                            // Total Damage Dealt
                            StatCard(
                                icon: "sword.fill",
                                title: "Damage Dealt",
                                value: String(format: "%.0f", totalDamageDealt),
                                color: .accentSecondary
                            )
                            .slideInFromBottom(delay: 1.2)

                            // Turns Survived
                            StatCard(
                                icon: "shield.fill",
                                title: "Turns Survived",
                                value: "\(turnsSurvived)",
                                color: .success
                            )
                            .slideInFromBottom(delay: 1.4)

                            // Highest Multiplier
                            StatCard(
                                icon: "star.fill",
                                title: "Best Hit",
                                value: String(format: "%.1fx", highestMultiplier),
                                color: .warning
                            )
                            .slideInFromBottom(delay: 1.6)
                        }
                    }
                    .padding(.horizontal, 24)

                    Spacer()
                        .frame(height: 40)

                    // Action Buttons
                    VStack(spacing: 16) {
                        // Try Again Button (Primary)
                        TextButton("Try Again") {
                            navigationManager.navigateTo(.map)
                        }
                        .slideInFromBottom(delay: 1.8)

                        // Home Button (Secondary)
                        TextButton("Home") {
                            navigationManager.resetToMainMenu()
                        }
                        .slideInFromBottom(delay: 2.0)
                    }
                    .padding(.horizontal, 24)

                    Spacer()
                        .frame(height: 60)
                }
            }
        }
        .navigationBarHidden(true)
        .navigationBarBackButtonHidden(true)
    }
}

// MARK: - Stat Card Component
private struct StatCard: View {
    let icon: String
    let title: String
    let value: String
    let color: Color

    var body: some View {
        HStack(spacing: 16) {
            // Icon
            Image(systemName: icon)
                .font(.system(size: 24, weight: .medium))
                .foregroundColor(color)
                .frame(width: 40, height: 40)
                .background(
                    Circle()
                        .fill(color.opacity(0.2))
                )

            // Text Content
            VStack(alignment: .leading, spacing: 4) {
                SmallText(title)
                    .foregroundColor(.textSecondary)

                Text(value)
                    .font(FontManager.title)
                    .foregroundColor(.textPrimary)
                    .kerning(0.5)
            }

            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(
            RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                        .stroke(color.opacity(0.3), lineWidth: 1)
                )
        )
    }
}

// MARK: - Preview
#Preview {
    @Previewable @State var previewAppState = AppState()

    let _ = {
        let mockMetadata = CombatMetadata(
            totalDamageDealt: 127.5,
            turnsSurvived: 8,
            highestMultiplier: 2.3,
            combatHistory: CombatHistory(
                locationId: "preview-location",
                totalAttempts: 1,
                victories: 0,
                defeats: 1,
                currentStreak: 0,
                longestStreak: 0
            ),
            enemy: CombatEnemy(
                id: "preview-enemy",
                type: "goblin",
                name: "Goblin Scout",
                level: 3,
                atkPower: 15.0,
                atkAccuracy: 0.6,
                defPower: 10.0,
                defAccuracy: 0.5,
                hp: 50.0,
                styleId: "normal",
                dialogueTone: "aggressive",
                personalityTraits: ["cocky"]
            )
        )
        previewAppState.setLastCombatMetadata(mockMetadata)
    }()

    DefeatView()
        .modelContainer(for: Item.self, inMemory: true)
        .environmentObject(NavigationManager())
        .environment(previewAppState)
}