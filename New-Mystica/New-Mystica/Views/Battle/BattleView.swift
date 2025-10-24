import SwiftUI
import SpriteKit

/**
 * BattleView: Combat Interface Implementation Status
 *
 * CURRENT STATUS: "Correctly Incomplete" - Basic functionality working, advanced features documented as placeholders
 *
 * ✅ WORKING:
 *   - Auto-resume existing combat sessions from AppState
 *   - Basic attack/defend actions with backend integration
 *   - Real-time HP tracking and combat status updates
 *   - Combat rewards display and claiming
 *   - Turn history tracking (UI-only)
 *   - Clean session lifecycle management
 *
 * 🚧 INCOMPLETE (Documented Placeholders):
 *   - Timing system: TimingDialView shows "coming soon" message, uses hardcoded 0.8 scores
 *   - Dynamic HP calculation: Uses simplified defPower * 10 formula instead of backend max HP
 *   - Advanced combat mechanics: No critical hits, status effects, or complex interactions
 *   - UI Polish: Basic attack/defend buttons without timing-based interactions
 *
 * ❌ REMOVED (Was Non-Functional):
 *   - Interactive timing dial (was static, appeared functional but did nothing)
 *   - Dynamic timing score calculation (was always hardcoded)
 *   - Misleading "Click for timing bonus!" UI text
 *
 * ARCHITECTURAL NOTES:
 *   - Models now align with backend API contracts (no manual conversion)
 *   - Session state consistent between frontend and backend
 *   - All placeholders clearly documented with TODO comments
 *   - MVP0 simplifications explicitly noted for future enhancement
 */
struct BattleView: View {
    @Environment(\.navigationManager) private var navigationManager
    @Environment(\.audioManager) private var audioManager
    @Environment(AppState.self) private var appState
    @State private var viewModel = CombatViewModel()

    // MARK: - Combat Balance Placeholders
    // TODO: Replace with dynamic timing-based scoring when timing system implemented
    private static let DEFAULT_TIMING_SCORE = 0.8 // 80% success rate for MVP0 simplification

    // TODO: Replace with proper stat-based HP calculation from backend specs
    private static let HP_MULTIPLIER = 10 // Simplified formula: defPower * 10 for MVP0


    // Simple animation states for MVP0 visual feedback
    @State private var playerScale: CGFloat = 1.0
    @State private var enemyScale: CGFloat = 1.0

    // Location ID passed from map (optional for auto-resume scenarios)
    let locationId: String?

    init(locationId: String? = nil) {
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
                        await viewModel.initializeOrResumeCombat(locationId: locationId)
                    }
                }

                // Rewards overlay
                if case .loaded = viewModel.rewards {
                    rewardsOverlay(rewards: viewModel.rewards)
                }
            }
        }
        .task {
            // Use backend auto-resume flow - AppState should have already checked for active sessions
            // If AppState has a session, use it; otherwise try to create new combat or auto-resume
            if case .loaded(let session) = appState.activeCombatSession,
               let activeSession = session {
                // Resume existing session loaded by AppState
                viewModel.resumeCombat(session: activeSession)
            } else {
                // Try to resume existing session or create new one if locationId provided
                await viewModel.initializeOrResumeCombat(locationId: locationId)

                // Update AppState with whatever session we got from backend
                if case .loaded(let session) = viewModel.combatState {
                    appState.setCombatSession(session)
                }
            }
        }
    }

    // MARK: - Combat Content View
    private func combatContentView(session: CombatSession) -> some View {
        VStack(spacing: 0) {
            // Enemy Section
            enemySection(enemy: convertCombatEnemyToEnemy(session.enemy), hp: Double(viewModel.enemyHP))
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
                            // Clear the active session from AppState
                            appState.activeCombatSession = .loaded(nil)
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
                    NormalText("Gold: \(rewards.rewards?.gold ?? 0)")
                        .foregroundColor(Color.textSecondary)
                    Spacer()
                }

                HStack {
                    Image(systemName: "star.fill")
                        .foregroundColor(Color.accentSecondary)
                    NormalText("Experience: \(rewards.rewards?.experience ?? 0)")
                        .foregroundColor(Color.textSecondary)
                    Spacer()
                }

                if let items = rewards.rewards?.materials, !items.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Image(systemName: "gift.fill")
                                .foregroundColor(Color.accent)
                            NormalText("Items:")
                                .foregroundColor(Color.textSecondary)
                            Spacer()
                        }

                        ForEach(Array((rewards.rewards?.materials ?? []).enumerated()), id: \.element.materialId) { _, item in
                            HStack {
                                SmallText("• \(item.name) [Level \(1)]")
                                    .foregroundColor(Color.textSecondary)
                                Spacer()
                            }
                            .padding(.leading, 24)
                        }
                    }
                }

                if let materials = rewards.rewards?.materials, !materials.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Image(systemName: "cube.fill")
                                .foregroundColor(Color.accentSecondary)
                            NormalText("Materials:")
                                .foregroundColor(Color.textSecondary)
                            Spacer()
                        }

                        ForEach(Array(materials.enumerated()), id: \.element.materialId) { _, material in
                            HStack {
                                SmallText("• \(material.name) [\(material.styleName)]")
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
    // Helper function to convert CombatEnemy to Enemy for compatibility
    private func convertCombatEnemyToEnemy(_ combatEnemy: CombatEnemy) -> Enemy {
        return Enemy(
            id: combatEnemy.id,
            name: combatEnemy.name,
            level: combatEnemy.level,
            stats: combatEnemy.stats,
            specialAbilities: combatEnemy.personalityTraits,
            goldMin: 0,
            goldMax: 0,
            materialDropPool: []
        )
    }

    private func enemySection(enemy: Enemy, hp: Double) -> some View {
        VStack(spacing: 16) {
            // Enemy Health Bar
            HealthBarView(
                currentHealth: hp,
                maxHealth: enemy.stats.defPower * Double(Self.HP_MULTIPLIER), // TODO: Get actual max HP from backend
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
                maxHealth: session.playerHp ?? (session.playerStats.defPower * Double(Self.HP_MULTIPLIER)), // TODO: Get actual max HP from backend
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
                // Simple combat actions - MVP0 with fixed scoring (no timing mechanics)
                HStack(spacing: 20) {
                    // Basic Attack - uses fixed success rate
                    CombatActionButton(
                        title: "Attack",
                        icon: "hammer.fill",
                        color: Color.accent,
                        isDisabled: !viewModel.canAct
                    ) {
                        Task {
                            // MVP0: Fixed timing score - no user interaction required
                            await viewModel.attack(timingScore: Self.DEFAULT_TIMING_SCORE)
                        }
                    }

                    // Basic Defend - uses fixed success rate
                    CombatActionButton(
                        title: "Defend",
                        icon: "shield.fill",
                        color: Color.accentSecondary,
                        isDisabled: !viewModel.canAct
                    ) {
                        Task {
                            // MVP0: Fixed timing score - no user interaction required
                            await viewModel.defend(timingScore: Self.DEFAULT_TIMING_SCORE)
                        }
                    }
                }

                // Clear MVP0 notice - no misleading timing elements
                SmallText("⚡ MVP0: Basic combat - timing mechanics coming later", size: 11)
                    .foregroundColor(Color.textSecondary.opacity(0.8))
                    .multilineTextAlignment(.center)
                    .padding(.top, 8)

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

            // Note: Timing dial removed to avoid misleading users
            // It will be re-added when fully functional timing mechanics are implemented
        }
    }


    
    
    // MARK: - Helper Functions
    
    private func startIdleAnimations() {
        // Simple idle animations for MVP0 - basic visual feedback only
        withAnimation(
            .easeInOut(duration: 2.0)
            .repeatForever(autoreverses: true)
        ) {
            playerScale = 1.05
        }

        // Enemy idle animation (offset for visual variety)
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
