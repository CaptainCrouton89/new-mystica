//
//  BattleView.swift
//  New-Mystica
//
//  Refactored to integrate with CombatViewModel for turn-based combat
//

import SwiftUI
import SpriteKit

struct BattleView: View {
    @Environment(\.navigationManager) private var navigationManager
    @Environment(\.audioManager) private var audioManager
    @Environment(AppState.self) private var appState
    @State private var viewModel = CombatViewModel()


    // Animation states
    @State private var playerScale: CGFloat = 1.0
    @State private var enemyScale: CGFloat = 1.0

    // Location ID passed from map
    let locationId: String

    init(locationId: String) {
        self.locationId = locationId
    }
    
    var body: some View {
        BaseView(title: "Battle") {
            ZStack {
                // Main combat content
                LoadableView(viewModel.combatState) { session in
                    combatContentView(session: session)
                } retry: {
                    Task {
                        await viewModel.startCombat(locationId: locationId)
                    }
                }

                // Rewards overlay
                if case .loaded = viewModel.rewards {
                    rewardsOverlay(rewards: viewModel.rewards)
                }
            }
        }
        .task {
            // Start combat when view appears
            await viewModel.startCombat(locationId: locationId)
        }
    }

    // MARK: - Combat Content View
    private func combatContentView(session: CombatSession) -> some View {
        VStack(spacing: 0) {
            // Enemy Section
            enemySection(enemy: session.enemy, hp: Double(viewModel.enemyHP))
                .frame(maxHeight: .infinity)

            Spacer(minLength: 20)

            // Combat Info Center
            combatInfoSection(session: session)

            Spacer(minLength: 20)

            // Player Section
            playerSection(session: session)
                .frame(maxHeight: .infinity)

            Spacer(minLength: 20)

            // Combat Controls
            combatControlsSection(session: session)
                .frame(height: 160)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 20)
        .onAppear {
            startIdleAnimations()
        }
    }
    
    // MARK: - Rewards Overlay
    private func rewardsOverlay(rewards: Loadable<CombatRewards>) -> some View {
        ZStack {
            Color.black.opacity(0.8)
                .edgesIgnoringSafeArea(.all)

            LoadableView(rewards) { rewardData in
                VStack(spacing: 20) {
                    TitleText(viewModel.playerWon ? "Victory!" : "Defeat", size: 28)
                        .foregroundColor(viewModel.playerWon ? Color.accent : Color.red)

                    if viewModel.playerWon {
                        victoryRewardsView(rewardData)
                    } else {
                        defeatMessageView()
                    }

                    TextButton("Continue") {
                        Task {
                            await viewModel.claimRewards()
                            navigationManager.navigateBack()
                        }
                    }
                    .frame(maxWidth: 200)
                }
                .padding(32)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.backgroundCard)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.borderSubtle, lineWidth: 1)
                        )
                )
                .shadow(color: Color.black.opacity(0.3), radius: 20, x: 0, y: 10)
            } retry: {
                // Rewards should not need retry, but provide for consistency
            }
        }
    }

    private func victoryRewardsView(_ rewards: CombatRewards) -> some View {
        VStack(spacing: 16) {
            NormalText("Rewards Earned:", size: 18)
                .foregroundColor(Color.textPrimary)

            VStack(spacing: 8) {
                HStack {
                    Image(systemName: "dollarsign.circle.fill")
                        .foregroundColor(Color.accent)
                    NormalText("Gold: \(rewards.goldEarned)")
                        .foregroundColor(Color.textSecondary)
                    Spacer()
                }

                HStack {
                    Image(systemName: "star.fill")
                        .foregroundColor(Color.accentSecondary)
                    NormalText("Experience: \(rewards.experienceEarned)")
                        .foregroundColor(Color.textSecondary)
                    Spacer()
                }

                if !rewards.itemsDropped.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Image(systemName: "gift.fill")
                                .foregroundColor(Color.accent)
                            NormalText("Items:")
                                .foregroundColor(Color.textSecondary)
                            Spacer()
                        }

                        ForEach(Array(rewards.itemsDropped.enumerated()), id: \.element.id) { _, item in
                            HStack {
                                SmallText("• \(item.baseType) [Level \(item.level)]")
                                    .foregroundColor(Color.textSecondary)
                                Spacer()
                            }
                            .padding(.leading, 24)
                        }
                    }
                }

                if !rewards.materialsDropped.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Image(systemName: "cube.fill")
                                .foregroundColor(Color.accentSecondary)
                            NormalText("Materials:")
                                .foregroundColor(Color.textSecondary)
                            Spacer()
                        }

                        ForEach(rewards.materialsDropped, id: \.materialId) { material in
                            HStack {
                                SmallText("• \(material.name) x\(material.quantity ?? 1)")
                                    .foregroundColor(Color.textSecondary)
                                Spacer()
                            }
                            .padding(.leading, 24)
                        }
                    }
                }
            }
        }
    }

    private func defeatMessageView() -> some View {
        VStack(spacing: 12) {
            NormalText("Better luck next time!", size: 18)
                .foregroundColor(Color.textSecondary)
                .multilineTextAlignment(.center)

            SmallText("Train harder and come back stronger.")
                .foregroundColor(Color.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Enemy Section
    private func enemySection(enemy: Enemy, hp: Double) -> some View {
        VStack(spacing: 16) {
            // Enemy Health Bar
            HealthBarView(
                currentHealth: hp,
                maxHealth: Double(enemy.stats.defPower * 10), // Max HP calculation
                label: enemy.name ?? "Unknown Enemy",
                isPlayer: false
            )

            // Enemy Avatar
            EnemyAvatarView(
                enemy: enemy,
                scale: enemyScale
            )

            // Enemy Level
            SmallText("Level \(enemy.level)")
                .foregroundColor(Color.textSecondary)
        }
    }

    // MARK: - Combat Info Section
    private func combatInfoSection(session: CombatSession) -> some View {
        VStack(spacing: 12) {
            // Turn Counter
            ZStack {
                Circle()
                    .fill(Color.backgroundCard)
                    .frame(width: 60, height: 60)
                    .overlay(
                        Circle()
                            .stroke(Color.accentSecondary, lineWidth: 2)
                    )
                    .shadow(color: .black.opacity(0.3), radius: 4, x: 0, y: 2)

                VStack(spacing: 2) {
                    SmallText("Turn", size: 10)
                        .foregroundColor(Color.textSecondary)
                    NormalText("\(viewModel.turnNumber)", size: 16)
                        .foregroundColor(Color.accentSecondary)
                        .bold()
                }
            }

            // Recent Combat Log (last 3 actions)
            if !viewModel.recentActions.isEmpty {
                VStack(spacing: 4) {
                    SmallText("Recent Actions:", size: 12)
                        .foregroundColor(Color.textSecondary)

                    ForEach(Array(viewModel.recentActions.suffix(3).enumerated()), id: \.offset) { _, action in
                        HStack {
                            SmallText(actionDescription(action), size: 11)
                                .foregroundColor(Color.textSecondary)
                                .lineLimit(1)
                            Spacer()
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.backgroundSecondary)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.borderSubtle, lineWidth: 1)
                        )
                )
            }
        }
    }

    private func actionDescription(_ action: CombatAction) -> String {
        let actor = action.performerId == "player" ? "You" : "Enemy"
        let actionType = action.type.rawValue.capitalized

        if let damage = action.damageDealt, damage > 0 {
            return "\(actor) \(actionType) for \(Int(damage)) damage"
        } else {
            return "\(actor) used \(actionType)"
        }
    }

    // MARK: - Player Section
    private func playerSection(session: CombatSession) -> some View {
        VStack(spacing: 16) {
            // Player Avatar
            PlayerAvatarView(scale: playerScale)

            // Player Health Bar
            HealthBarView(
                currentHealth: Double(viewModel.currentHP),
                maxHealth: session.playerHp ?? Double(session.playerStats.defPower * 10),
                label: "You",
                isPlayer: true
            )

            // Player Stats Summary
            HStack(spacing: 20) {
                VStack(spacing: 2) {
                    SmallText("ATK", size: 10)
                        .foregroundColor(Color.textSecondary)
                    NormalText("\(Int(session.playerStats.atkPower))", size: 14)
                        .foregroundColor(Color.accent)
                        .bold()
                }

                VStack(spacing: 2) {
                    SmallText("DEF", size: 10)
                        .foregroundColor(Color.textSecondary)
                    NormalText("\(Int(session.playerStats.defPower))", size: 14)
                        .foregroundColor(Color.accentSecondary)
                        .bold()
                }

                VStack(spacing: 2) {
                    SmallText("ACC", size: 10)
                        .foregroundColor(Color.textSecondary)
                    NormalText("\(Int(session.playerStats.atkAccuracy))", size: 14)
                        .foregroundColor(Color.textPrimary)
                        .bold()
                }
            }
        }
    }

    // MARK: - Combat Controls Section
    private func combatControlsSection(session: CombatSession) -> some View {
        VStack(spacing: 16) {
            // Action status
            if viewModel.isLoading {
                NormalText("Processing action...", size: 14)
                    .foregroundColor(Color.textSecondary)
            } else if viewModel.combatEnded {
                NormalText(viewModel.playerWon ? "Victory!" : "Defeat!", size: 16)
                    .foregroundColor(viewModel.playerWon ? Color.accent : Color.red)
                    .bold()
            } else {
                NormalText("Choose your action!", size: 14)
                    .foregroundColor(Color.accentSecondary)
            }

            if !viewModel.combatEnded {
                // Combat actions
                HStack(spacing: 20) {
                    // Attack Button
                    CombatActionButton(
                        title: "Attack",
                        icon: "hammer.fill",
                        color: Color.accent,
                        isDisabled: !viewModel.canAct
                    ) {
                        Task {
                            await viewModel.attack(timingScore: 0.8) // Use default timing for now
                        }
                    }

                    // Defend Button
                    CombatActionButton(
                        title: "Defend",
                        icon: "shield.fill",
                        color: Color.accentSecondary,
                        isDisabled: !viewModel.canAct
                    ) {
                        Task {
                            await viewModel.defend(timingScore: 0.8) // Use default timing for now
                        }
                    }
                }
            } else {
                // Combat ended - show retreat option or wait for rewards
                if case .idle = viewModel.rewards {
                    TextButton("End Combat") {
                        Task {
                            await viewModel.endCombat(won: viewModel.playerWon)
                        }
                    }
                    .frame(maxWidth: 200)
                }
            }

            // Timing dial (only show during active combat)
            if viewModel.isInCombat && !viewModel.combatEnded {
                TimingDialView(
                    dialRotation: .constant(0),
                    isDialSpinning: .constant(false),
                    onTap: {}
                )
            }
        }
    }


    
    
    // MARK: - Helper Functions
    
    private func startIdleAnimations() {
        // Player idle animation
        withAnimation(
            .easeInOut(duration: 2.0)
            .repeatForever(autoreverses: true)
        ) {
            playerScale = 1.05
        }

        // Enemy idle animation (offset by 1 second) - using Task instead of DispatchQueue
        Task {
            try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
            await MainActor.run {
                withAnimation(
                    .easeInOut(duration: 2.0)
                    .repeatForever(autoreverses: true)
                ) {
                    enemyScale = 1.05
                }
            }
        }
    }
    
}

#Preview {
    BattleView(locationId: "test-location-id")
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
        .environment(AppState.shared)
}
