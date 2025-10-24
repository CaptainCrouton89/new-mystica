import SwiftUI
import SpriteKit
import UIKit

// MARK: - Visual Feedback Models
struct DamageInfo {
    let amount: Double
    let zone: String // "crit", "normal", "graze", "miss", "injure"
    let isBlocked: Bool
    let position: CGPoint
}

/**
 * BattleView: Combat Interface Implementation Status
 *
 * CURRENT STATUS: "Turn State Machine Complete" - Full timing-based combat system implemented
 *
 * ✅ WORKING:
 *   - Auto-resume existing combat sessions from AppState
 *   - Turn-based combat with timing dial mechanics
 *   - Attack and defense phases with real tap_position_degrees API integration
 *   - Phase transitions: attack → 1s pause → defense prompt → defense → repeat
 *   - Real-time HP tracking and combat status updates
 *   - Combat rewards display and claiming
 *   - Turn history tracking (UI-only)
 *   - Clean session lifecycle management
 *   - Visual feedback: enemy glow, defense prompts, dial visibility
 *   - Weapon-specific zone sizing and spin speeds
 *
 * 🚧 INCOMPLETE (T7/T8 - Visual/Audio Polish):
 *   - Damage numbers floating from sprites (FloatingTextView integration)
 *   - Zone flash animation on tap (0.1s white pulse)
 *   - Enemy sprite shake on hits (±5px horizontal, 0.2s)
 *   - Shield visual component for defense phase
 *   - Haptic feedback (heavy/light/none based on zone)
 *   - Audio cues (hit/miss/crit sounds via AudioManager)
 *   - Advanced animations and particle effects
 *
 * 🔧 TODO (Future):
 *   - Dynamic HP calculation: Uses simplified defPower * 10 formula instead of backend max HP
 *   - Screen flash effects on crit hits
 *   - Advanced combat mechanics: status effects, complex interactions
 *
 * ARCHITECTURAL NOTES:
 *   - Models align with backend API contracts (no manual conversion)
 *   - Session state consistent between frontend and backend
 *   - Combat state machine orchestrates turn flow automatically
 *   - Dial tap detection sends degrees directly to backend for zone calculation
 *   - Backend handles all damage calculations and zone detection
 */
// MARK: - Combat Phase State Machine
enum CombatPhase {
    case playerAttack      // Dial visible with attack accuracy zones
    case attackTransition  // 1s pause
    case defensePrompt     // "DEFEND NOW!" prompt slides in
    case playerDefense     // Tap dial with defense zones, enemy glows red
}

struct BattleView: View {
    @Environment(\.navigationManager) private var navigationManager
    @Environment(\.audioManager) private var audioManager
    @Environment(AppState.self) private var appState
    @State private var viewModel = CombatViewModel()

    // MARK: - Turn State Machine
    @State private var currentPhase: CombatPhase = .playerAttack
    @State private var showDefensePrompt = false
    @State private var enemyGlowing = false

    // MARK: - Dial State
    @State private var dialRotation: Double = 0
    @State private var isDialSpinning = false
    @State private var dialVisible = true

    // MARK: - Visual Feedback State
    @State private var zoneFlashIndex: Int? = nil
    @State private var enemyShaking = false
    @State private var playerShaking = false
    @State private var showShield = false
    @State private var shieldColor: Color = .green
    @State private var lastDamageInfo: DamageInfo? = nil

    // Floating text manager
    @StateObject private var floatingTextManager = FloatingTextView()

    // MARK: - Combat Balance Placeholders
    // TODO: Replace with dynamic timing-based scoring when timing system implemented
    private static let DEFAULT_TIMING_SCORE = 0.8 // 80% success rate for MVP0 simplification

    // TODO: Replace with proper stat-based HP calculation from backend specs
    private static let HP_MULTIPLIER = 10 // Simplified formula: defPower * 10 for MVP0


    // Animation states for MVP0 visual feedback
    @State private var playerScale: CGFloat = 1.0
    @State private var enemyScale: CGFloat = 1.0
    @State private var enemyOffset: CGPoint = .zero
    @State private var playerOffset: CGPoint = .zero

    // Location ID passed from map (optional for auto-resume scenarios)
    let locationId: String?

    init(locationId: String? = nil) {
        self.locationId = locationId
    }

    // MARK: - Zone Color Mapping
    private func colorForZone(_ zone: String) -> Color {
        switch zone.lowercased() {
        case "crit":
            return Color(red: 0.2, green: 0.8, blue: 0.3) // Dark green
        case "normal":
            return Color(red: 0.27, green: 1.0, blue: 0.27) // Bright green #44FF44
        case "graze":
            return Color(red: 1.0, green: 0.67, blue: 0.27) // Yellow #FFAA44
        case "miss":
            return Color.orange
        case "injure":
            return Color(red: 1.0, green: 0.27, blue: 0.27) // Red #FF4444
        default:
            return Color.gray
        }
    }

    private func textForZone(_ zone: String, damage: Double) -> String {
        switch zone.lowercased() {
        case "miss":
            return "MISS!"
        case "injure":
            return "-\(Int(damage))"
        default:
            return "\(Int(damage))"
        }
    }

    // MARK: - Haptic Feedback
    private func triggerHapticFeedback(for zone: String) {
        let generator: UIImpactFeedbackGenerator

        switch zone.lowercased() {
        case "crit":
            // Dark Green (Crit): Heavy impact (.heavy)
            generator = UIImpactFeedbackGenerator(style: .heavy)
        case "normal", "graze":
            // Bright Green (Normal), Yellow (Graze): Light impact (.light)
            generator = UIImpactFeedbackGenerator(style: .light)
        case "miss", "injure":
            // Orange (Miss), Red (Injure): No haptic
            return
        default:
            return
        }

        generator.prepare()
        generator.impactOccurred()
    }

    private func triggerDefenseHaptic(damageBlocked: Double, damageTaken: Double) {
        let totalDamage = damageBlocked + damageTaken
        guard totalDamage > 0 else { return }

        let blockEffectiveness = damageBlocked / totalDamage
        let generator: UIImpactFeedbackGenerator

        if blockEffectiveness > 0.8 {
            // Great defense - heavy haptic
            generator = UIImpactFeedbackGenerator(style: .heavy)
        } else if blockEffectiveness > 0.4 {
            // Okay defense - light haptic
            generator = UIImpactFeedbackGenerator(style: .light)
        } else {
            // Poor defense - no haptic or error pattern
            if #available(iOS 17.0, *) {
                let errorGenerator = UINotificationFeedbackGenerator()
                errorGenerator.notificationOccurred(.error)
            }
            return
        }

        generator.prepare()
        generator.impactOccurred()
    }

    // MARK: - Audio Feedback
    private func triggerAudioFeedback(for action: CombatAction) {
        switch action.type {
        case .attack:
            if let zone = action.hitZone {
                switch zone.lowercased() {
                case "crit", "normal", "graze":
                    // Successful hit - play deal damage sound
                    audioManager.playDealDamage()
                case "injure":
                    // Player hurt themselves - play take damage sound
                    audioManager.playTakeDamage()
                case "miss":
                    // Miss - no sound (or could add miss sound)
                    break
                default:
                    break
                }
            }
        case .defend:
            if let damageTaken = action.damageDealt, damageTaken > 0 {
                // Player took damage - play take damage sound
                audioManager.playTakeDamage()
            }
            // Could add blocked sound for successful defense
        default:
            break
        }
    }

    private func triggerCombatEndAudio(won: Bool) {
        if won {
            audioManager.playVictory()
        } else {
            audioManager.playDefeat()
        }
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
        .floatingText()
        .environmentObject(floatingTextManager)
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
                        .onAppear {
                            // Trigger victory/defeat audio when rewards overlay appears
                            triggerCombatEndAudio(won: viewModel.playerWon)
                        }

                    if viewModel.playerWon {
                        victoryRewardsView(rewardData)
                    } else {
                        defeatMessageView()
                    }

                    TextButton("Continue") {
                        Task {
                            // Play reward claim audio if victory
                            if viewModel.playerWon {
                                audioManager.playReward()
                            }
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

            // Enemy Avatar with glow effect and shake animation
            EnemyAvatarView(
                enemy: enemy,
                scale: enemyScale
            )
            .offset(x: enemyOffset.x, y: enemyOffset.y)
            .shadow(color: enemyGlowing ? .red : .clear, radius: enemyGlowing ? 20 : 0)
            .animation(.easeInOut(duration: 0.5), value: enemyGlowing)
            .animation(.easeInOut(duration: 0.2), value: enemyOffset)

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
            // Player Avatar with shield overlay
            ZStack {
                PlayerAvatarView(scale: playerScale)
                    .offset(x: playerOffset.x, y: playerOffset.y)
                    .animation(.easeInOut(duration: 0.2), value: playerOffset)

                // Shield visual during defense
                if showShield {
                    Image(systemName: "shield.fill")
                        .foregroundColor(shieldColor)
                        .font(.system(size: 40))
                        .scaleEffect(showShield ? 1.2 : 0.8)
                        .opacity(showShield ? 0.8 : 0)
                        .animation(.easeInOut(duration: 0.2), value: showShield)
                }
            }

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
            // Phase-specific status display
            phaseStatusView(session: session)

            if !viewModel.combatEnded {
                // Turn-based combat with timing dial
                combatPhaseView(session: session)
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
        }
    }

    // MARK: - Phase Status View
    private func phaseStatusView(session: CombatSession) -> some View {
        VStack(spacing: 8) {
            if viewModel.isLoading {
                NormalText("Processing action...", size: 14)
                    .foregroundColor(Color.textSecondary)
            } else if viewModel.combatEnded {
                NormalText(viewModel.playerWon ? "Victory!" : "Defeat!", size: 16)
                    .foregroundColor(viewModel.playerWon ? Color.accent : Color.red)
                    .bold()
            } else {
                switch currentPhase {
                case .playerAttack:
                    NormalText("Tap the dial to attack!", size: 14)
                        .foregroundColor(Color.accent)
                case .attackTransition:
                    NormalText("Processing attack...", size: 14)
                        .foregroundColor(Color.textSecondary)
                case .defensePrompt:
                    NormalText("Get ready to defend!", size: 14)
                        .foregroundColor(Color.textSecondary)
                case .playerDefense:
                    NormalText("Tap the dial to defend!", size: 14)
                        .foregroundColor(Color.accentSecondary)
                }
            }

            // Defense prompt overlay
            if showDefensePrompt {
                TitleText("DEFEND NOW!", size: 36)
                    .foregroundColor(Color.red)
                    .bold()
                    .transition(.asymmetric(
                        insertion: .move(edge: .top).combined(with: .opacity),
                        removal: .opacity
                    ))
                    .scaleEffect(showDefensePrompt ? 1.1 : 1.0)
                    .animation(.easeInOut(duration: 0.3).repeatCount(2, autoreverses: true), value: showDefensePrompt)
            }
        }
    }

    // MARK: - Combat Phase View
    private func combatPhaseView(session: CombatSession) -> some View {
        VStack(spacing: 16) {
            // Show timing dial based on phase
            if dialVisible && (currentPhase == .playerAttack || currentPhase == .playerDefense) {
                // Get zone sizing based on phase
                let adjustedBands = getAdjustedBands(for: currentPhase, session: session)

                TimingDialView(
                    dialRotation: $dialRotation,
                    isDialSpinning: $isDialSpinning,
                    adjustedBands: adjustedBands,
                    spinSpeed: Double(session.weaponConfig.spinDegPerS),
                    onTap: { degrees in
                        handleDialTap(degrees: degrees)
                    }
                )
            } else {
                // Spacer to maintain layout when dial is hidden
                Rectangle()
                    .fill(Color.clear)
                    .frame(height: 200)
            }

            // Phase instruction
            SmallText("⚡ Timing-based combat system active", size: 11)
                .foregroundColor(Color.textSecondary.opacity(0.8))
                .multilineTextAlignment(.center)
                .padding(.top, 8)
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

        // Start dial spinning on combat start
        if !viewModel.combatEnded {
            startCombatPhase(.playerAttack)
        }
    }

    // MARK: - Turn State Machine Methods

    /// Start a specific combat phase with appropriate setup
    private func startCombatPhase(_ phase: CombatPhase) {
        currentPhase = phase

        switch phase {
        case .playerAttack:
            dialVisible = true
            isDialSpinning = true
            enemyGlowing = false
            showDefensePrompt = false

        case .attackTransition:
            dialVisible = false
            isDialSpinning = false
            enemyGlowing = false
            showDefensePrompt = false

            // Transition to defense prompt after 1 second
            Task {
                try? await Task.sleep(nanoseconds: 1_000_000_000) // 1s
                await MainActor.run {
                    startCombatPhase(.defensePrompt)
                }
            }

        case .defensePrompt:
            dialVisible = false
            isDialSpinning = false
            enemyGlowing = true

            withAnimation(.easeInOut(duration: 0.3)) {
                showDefensePrompt = true
            }

            // Fade to defense dial after 0.5s
            Task {
                try? await Task.sleep(nanoseconds: 500_000_000) // 0.5s
                await MainActor.run {
                    withAnimation(.easeInOut(duration: 0.3)) {
                        showDefensePrompt = false
                    }
                    startCombatPhase(.playerDefense)
                }
            }

        case .playerDefense:
            dialVisible = true
            isDialSpinning = true
            enemyGlowing = true
            showDefensePrompt = false
        }
    }

    /// Handle dial tap based on current phase
    private func handleDialTap(degrees: Double) {
        guard !viewModel.isLoading else { return }

        switch currentPhase {
        case .playerAttack:
            // Stop dial and trigger zone flash immediately
            isDialSpinning = false
            triggerZoneFlash()

            Task {
                // Perform attack with tap position degrees
                await viewModel.attack(tapPositionDegrees: Float(degrees))

                // Get the last action for visual feedback
                if let lastAction = viewModel.recentActions.last,
                   lastAction.type == .attack {
                    await MainActor.run {
                        showAttackFeedback(action: lastAction)
                    }
                }

                // Check if combat ended
                if viewModel.combatEnded {
                    await MainActor.run {
                        dialVisible = false
                        isDialSpinning = false
                        // Trigger combat end audio
                        triggerCombatEndAudio(won: viewModel.playerWon)
                    }
                } else {
                    // Transition to defense phase
                    await MainActor.run {
                        startCombatPhase(.attackTransition)
                    }
                }
            }

        case .playerDefense:
            // Stop dial and process defense
            isDialSpinning = false
            triggerZoneFlash()

            Task {
                // Perform defense with tap position degrees
                await viewModel.defend(tapPositionDegrees: Float(degrees))

                // Get the last action for visual feedback
                if let lastAction = viewModel.recentActions.last,
                   lastAction.type == .defend {
                    await MainActor.run {
                        showDefenseFeedback(action: lastAction)
                    }
                }

                // Check if combat ended
                if viewModel.combatEnded {
                    await MainActor.run {
                        dialVisible = false
                        isDialSpinning = false
                        // Trigger combat end audio
                        triggerCombatEndAudio(won: viewModel.playerWon)
                    }
                } else {
                    // Return to attack phase for next turn
                    await MainActor.run {
                        startCombatPhase(.playerAttack)
                    }
                }
            }

        default:
            // Ignore taps during transitions
            break
        }
    }


    /// Get adjusted bands for current phase
    private func getAdjustedBands(for phase: CombatPhase, session: CombatSession) -> AdjustedBands {
        // Use weapon config adjusted bands from session
        let weaponBands = session.weaponConfig.adjustedBands

        switch phase {
        case .playerAttack:
            // Attack uses weapon's attack accuracy bands
            return weaponBands

        case .playerDefense:
            // Defense uses weapon's defense accuracy bands
            // For now, use same bands - backend will handle defense zone calculation
            return weaponBands

        default:
            // Default to weapon bands
            return weaponBands
        }
    }

    // MARK: - Visual Feedback Methods

    /// Trigger zone flash animation (0.1s white pulse)
    private func triggerZoneFlash() {
        // Flash the tapped zone - basic implementation
        withAnimation(.easeInOut(duration: 0.1)) {
            // Zone flash could be enhanced in TimingDialView for specific zone highlighting
        }
    }

    /// Show visual feedback for attack actions
    private func showAttackFeedback(action: CombatAction) {
        guard let damage = action.damageDealt,
              let zone = action.hitZone else { return }

        let color = colorForZone(zone)
        let text = textForZone(zone, damage: damage)

        // Show floating damage number
        floatingTextManager.showText(
            text,
            color: color,
            fontSize: zone.lowercased() == "crit" ? 24 : 20,
            fontWeight: zone.lowercased() == "crit" ? .black : .bold,
            duration: 0.5
        )

        // Enemy shake animation (only for successful hits)
        if !["miss", "injure"].contains(zone.lowercased()) {
            triggerEnemyShake()
        }

        // Trigger haptic and audio feedback
        triggerHapticFeedback(for: zone)
        triggerAudioFeedback(for: action)
    }

    /// Show visual feedback for defense actions
    private func showDefenseFeedback(action: CombatAction) {
        guard let damageTaken = action.damageDealt else { return }

        // Show shield visual
        showShieldEffect(effectiveness: getDefenseEffectiveness(action: action))

        // Show damage/blocked numbers
        if let blocked = action.damageBlocked, blocked > 0 {
            floatingTextManager.showText(
                "+\(Int(blocked)) blocked",
                color: .green,
                fontSize: 18,
                fontWeight: .bold,
                duration: 0.5
            )
        }

        if damageTaken > 0 {
            floatingTextManager.showText(
                "-\(Int(damageTaken))",
                color: .red,
                fontSize: 20,
                fontWeight: .bold,
                duration: 0.5
            )
        }

        // Trigger haptic and audio feedback
        if let blocked = action.damageBlocked {
            triggerDefenseHaptic(damageBlocked: blocked, damageTaken: damageTaken)
        }
        triggerAudioFeedback(for: action)
    }

    /// Trigger enemy shake animation
    private func triggerEnemyShake() {
        withAnimation(.easeInOut(duration: 0.2)) {
            enemyOffset = CGPoint(x: 5, y: 0)
        }

        Task {
            try? await Task.sleep(nanoseconds: 100_000_000) // 0.1s
            await MainActor.run {
                withAnimation(.easeInOut(duration: 0.1)) {
                    enemyOffset = CGPoint(x: -5, y: 0)
                }
            }
            try? await Task.sleep(nanoseconds: 100_000_000) // 0.1s
            await MainActor.run {
                withAnimation(.easeInOut(duration: 0.1)) {
                    enemyOffset = .zero
                }
            }
        }
    }

    /// Show shield effect for defense
    private func showShieldEffect(effectiveness: Double) {
        // Determine shield color based on effectiveness
        if effectiveness > 0.8 {
            shieldColor = Color(red: 0.2, green: 0.8, blue: 0.3) // Dark green
        } else if effectiveness > 0.6 {
            shieldColor = Color(red: 0.27, green: 1.0, blue: 0.27) // Bright green
        } else if effectiveness > 0.4 {
            shieldColor = Color(red: 1.0, green: 0.67, blue: 0.27) // Yellow
        } else if effectiveness > 0.2 {
            shieldColor = Color.orange
        } else {
            shieldColor = Color(red: 1.0, green: 0.27, blue: 0.27) // Red
        }

        // Scale in shield
        withAnimation(.easeInOut(duration: 0.2)) {
            showShield = true
        }

        // Scale out shield after delay
        Task {
            try? await Task.sleep(nanoseconds: 300_000_000) // 0.3s
            await MainActor.run {
                withAnimation(.easeInOut(duration: 0.3)) {
                    showShield = false
                }
            }
        }
    }

    /// Get defense effectiveness from action data
    private func getDefenseEffectiveness(action: CombatAction) -> Double {
        guard let blocked = action.damageBlocked,
              let taken = action.damageDealt else { return 0.0 }

        let totalDamage = blocked + taken
        return totalDamage > 0 ? blocked / totalDamage : 0.0
    }

}

#Preview {
    BattleView(locationId: "test-location-id")
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
        .environment(AppState.shared)
}
