//
//  BattleView.swift
//  New-Mystica
//
//  Refactored to integrate with CombatViewModel for turn-based combat
//

import SwiftUI

struct BattleView: View {
    @Environment(\.navigationManager) private var navigationManager
    @Environment(\.audioManager) private var audioManager
    @Environment(AppState.self) private var appState
    @State private var viewModel = CombatViewModel()

    // UI State
    @State private var isDialSpinning: Bool = false
    @State private var dialRotation: Double = 0.0
    @State private var currentTimingScore: Double = 0.0
    @State private var animationTimer: Timer?

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
        .onDisappear {
            // Clean up timer when view disappears
            animationTimer?.invalidate()
            animationTimer = nil
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
            healthBarView(
                currentHealth: hp,
                maxHealth: Double(enemy.stats.defPower * 10), // Max HP calculation
                label: enemy.name ?? "Unknown Enemy",
                isPlayer: false
            )

            // Enemy Avatar
            enemyAvatarView(
                enemy: enemy,
                scale: enemyScale
            )

            // Enemy Level
            SmallText("Level \(enemy.level)")
                .foregroundColor(Color.textSecondary)
        }
    }

    private func enemyAvatarView(enemy: Enemy, scale: CGFloat) -> some View {
        ZStack {
            // Avatar Background
            Circle()
                .fill(Color.backgroundCard)
                .frame(width: 120, height: 120)
                .overlay(
                    Circle()
                        .stroke(Color.accent, lineWidth: 3)
                )
                .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)

            // Enemy Icon (based on name or type)
            Image(systemName: getEnemyIcon(enemy))
                .font(.system(size: 48, weight: .medium))
                .foregroundColor(Color.accent)
        }
        .scaleEffect(scale)
    }

    private func getEnemyIcon(_ enemy: Enemy) -> String {
        guard let name = enemy.name?.lowercased() else { return "exclamationmark.triangle.fill" }

        switch name {
        case let n where n.contains("wolf"):
            return "pawprint.fill"
        case let n where n.contains("golem"):
            return "cube.fill"
        case let n where n.contains("dragon"):
            return "flame.fill"
        case let n where n.contains("warrior"):
            return "figure.warfare"
        case let n where n.contains("spirit"):
            return "leaf.fill"
        default:
            return "exclamationmark.triangle.fill"
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
            playerAvatarView(scale: playerScale)

            // Player Health Bar
            healthBarView(
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

    private func playerAvatarView(scale: CGFloat) -> some View {
        ZStack {
            // Avatar Background
            Circle()
                .fill(Color.backgroundCard)
                .frame(width: 120, height: 120)
                .overlay(
                    Circle()
                        .stroke(Color.accentSecondary, lineWidth: 3)
                )
                .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)

            // Player Icon
            Image(systemName: "person.fill")
                .font(.system(size: 48, weight: .medium))
                .foregroundColor(Color.accentSecondary)
        }
        .scaleEffect(scale)
    }
    
    // MARK: - Health Bar Component
    @ViewBuilder
    private func healthBarView(
        currentHealth: Double,
        maxHealth: Double,
        label: String,
        isPlayer: Bool
    ) -> some View {
        VStack(spacing: 8) {
            // Health Label
            NormalText(label, size: 16)
                .foregroundColor(Color.textPrimary)
            
            // Health Bar Container
            ZStack(alignment: .leading) {
                // Background
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.backgroundCard)
                    .frame(height: 20)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.borderSubtle, lineWidth: 1)
                    )
                
                // Health Fill
                RoundedRectangle(cornerRadius: 8)
                    .fill(healthBarColor(for: currentHealth, maxHealth: maxHealth))
                    .frame(width: max(0, healthBarWidth(for: currentHealth, maxHealth: maxHealth)), height: 20)
                    .animation(.easeInOut(duration: 0.3), value: currentHealth)
                
            }
            .frame(width: 200)
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
                    combatActionButton(
                        title: "Attack",
                        icon: "sword.fill",
                        color: Color.accent,
                        isDisabled: !viewModel.canAct
                    ) {
                        Task {
                            // Calculate timing score based on current dial position or random for now
                            let timingScore = isDialSpinning ? calculateTimingScore() : Double.random(in: 0.5...1.0)
                            stopDial()
                            await viewModel.attack(timingScore: timingScore)
                        }
                    }

                    // Defend Button
                    combatActionButton(
                        title: "Defend",
                        icon: "shield.fill",
                        color: Color.accentSecondary,
                        isDisabled: !viewModel.canAct
                    ) {
                        Task {
                            let timingScore = isDialSpinning ? calculateTimingScore() : Double.random(in: 0.5...1.0)
                            stopDial()
                            await viewModel.defend(timingScore: timingScore)
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
                timingDialView
            }
        }
    }

    private func combatActionButton(
        title: String,
        icon: String,
        color: Color,
        isDisabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(isDisabled ? Color.textSecondary : color)

                NormalText(title, size: 14)
                    .foregroundColor(isDisabled ? Color.textSecondary : Color.textPrimary)
            }
            .frame(width: 80, height: 80)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isDisabled ? Color.backgroundSecondary : Color.backgroundCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(isDisabled ? Color.borderSubtle : color, lineWidth: 2)
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(isDisabled)
        .scaleEffect(isDisabled ? 0.9 : 1.0)
    }

    private var timingDialView: some View {
        VStack(spacing: 8) {
            SmallText("Click for timing bonus!", size: 12)
                .foregroundColor(Color.textSecondary)

            ZStack {
                // Dial background circle
                Circle()
                    .fill(Color.backgroundCard)
                    .frame(width: 60, height: 60)
                    .overlay(
                        Circle()
                            .stroke(Color.accentSecondary, lineWidth: 2)
                    )
                    .shadow(color: .black.opacity(0.3), radius: 4, x: 0, y: 2)

                // Dial pointer
                Rectangle()
                    .fill(Color.accentSecondary)
                    .frame(width: 2, height: 20)
                    .offset(y: -10)
                    .rotationEffect(.degrees(dialRotation))

                // Center dot
                Circle()
                    .fill(Color.accentSecondary)
                    .frame(width: 6, height: 6)
            }
            .onTapGesture {
                stopDial()
            }
            .onAppear {
                startDialSpinning()
            }
        }
    }
    
    
    // MARK: - Helper Functions
    
    private func healthBarColor(for currentHealth: Double, maxHealth: Double) -> Color {
        let healthPercentage = currentHealth / maxHealth
        
        if healthPercentage > 0.6 {
            return Color.green
        } else if healthPercentage > 0.3 {
            return Color.orange
        } else {
            return Color.red
        }
    }
    
    private func healthBarWidth(for currentHealth: Double, maxHealth: Double) -> CGFloat {
        let healthPercentage = max(0, min(1, currentHealth / maxHealth))
        return 200 * healthPercentage
    }
    
    private func startIdleAnimations() {
        // Player idle animation
        withAnimation(
            .easeInOut(duration: 2.0)
            .repeatForever(autoreverses: true)
        ) {
            playerScale = 1.05
        }
        
        // Enemy idle animation (offset by 1 second)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            withAnimation(
                .easeInOut(duration: 2.0)
                .repeatForever(autoreverses: true)
            ) {
                enemyScale = 1.05
            }
        }
    }
    
    // MARK: - Combat Logic
    
    private func startDialSpinning() {
        // Stop any existing timer
        animationTimer?.invalidate()
        animationTimer = nil

        isDialSpinning = true

        // Start timer-based animation for smooth continuous rotation
        animationTimer = Timer.scheduledTimer(withTimeInterval: 0.016, repeats: true) { _ in
            if self.isDialSpinning {
                withAnimation(.linear(duration: 0.016)) {
                    self.dialRotation += 4.32 // 270 degrees per second (slower than before)
                }
            }
        }
    }

    private func stopDial() {
        isDialSpinning = false
        animationTimer?.invalidate()
        animationTimer = nil
    }

    private func calculateTimingScore() -> Double {
        // Calculate timing score based on dial position
        // Perfect timing at top (0 degrees) = 1.0
        // Worst timing at bottom (180 degrees) = 0.5
        let normalizedRotation = dialRotation.truncatingRemainder(dividingBy: 360)
        let adjustedRotation = normalizedRotation < 0 ? normalizedRotation + 360 : normalizedRotation

        // Convert to 0-1 range where 0 degrees = 1.0, 180 degrees = 0.5
        let radians = adjustedRotation * .pi / 180
        let score = 0.75 + 0.25 * cos(radians) // Range from 0.5 to 1.0
        return max(0.5, min(1.0, score))
    }
    
}

#Preview {
    BattleView(locationId: "test-location-id")
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
        .environment(AppState.shared)
}
