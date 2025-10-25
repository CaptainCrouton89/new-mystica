import SwiftUI
import SpriteKit
import UIKit

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
 *
 * FILE STRUCTURE:
 *   - BattleView.swift: Main view orchestration and state machine
 *   - BattleModels.swift: Data models (DamageInfo, CombatPhase)
 *   - BattleViewHelpers.swift: Pure utility functions
 *   - BattleFeedback.swift: Haptic and audio feedback
 *   - BattleSubviews.swift: UI component views
 */

struct BattleView: View {
    @State private var enemyDialogueVisible = false
    @Environment(\.navigationManager) var navigationManager
    @Environment(\.audioManager) var audioManager
    @Environment(AppState.self) var appState
    @State var viewModel = CombatViewModel()

    // MARK: - Turn State Machine
    @State var currentPhase: CombatPhase = .playerAttack
    @State var showDefensePrompt = false
    @State var enemyGlowing = false

    // MARK: - Dial State
    @State var dialRotation: Double = 0
    @State var isDialSpinning = false
    @State var dialVisible = true

    // MARK: - Visual Feedback State
    @State var zoneFlashIndex: Int? = nil
    @State var enemyShaking = false
    @State var playerShaking = false
    @State var showShield = false
    @State var shieldColor: Color = .green
    @State var lastDamageInfo: DamageInfo? = nil

    // Floating text manager
    @StateObject var floatingTextManager = FloatingTextView()

    // MARK: - Combat Balance Placeholders
    // TODO: Replace with dynamic timing-based scoring when timing system implemented
    private static let DEFAULT_TIMING_SCORE = 0.8 // 80% success rate for MVP0 simplification

    // TODO: Replace with proper stat-based HP calculation from backend specs
    private static let HP_MULTIPLIER = 10 // Simplified formula: defPower * 10 for MVP0


    // Animation states for MVP0 visual feedback
    @State var playerScale: CGFloat = 1.0
    @State var enemyScale: CGFloat = 1.0
    @State var enemyOffset: CGPoint = .zero
    @State var playerOffset: CGPoint = .zero
    
    // MARK: - Enemy Animation State
    @State var enemyAnimationLoader: MonsterAnimationLoader?
    @State var enemyCurrentFrame: Int = 0
    @State var enemyAnimationTimer: Timer?
    @State var isEnemyAnimating: Bool = false

    // Location ID passed from map (optional for auto-resume scenarios)
    let locationId: String?
    let selectedLevel: Int

    init(locationId: String? = nil, selectedLevel: Int = 1) {
        self.locationId = locationId
        self.selectedLevel = selectedLevel
    }

    var body: some View {
        BaseView(title: "Battle") {
            ZStack {
                // Main combat content with background loading
                if case .loaded(let session) = viewModel.combatState {
                    combatContentView(session: session)

                    // Enemy Dialogue Bubble Integration
                    if let dialogue = viewModel.currentDialogue {
                        EnemyDialogueBubble(
                            dialogue: dialogue,
                            isVisible: $enemyDialogueVisible
                        )
                        .transition(.asymmetric(
                            insertion: .scale(scale: 0.8).combined(with: .opacity),
                            removal: .scale(scale: 0.95).combined(with: .opacity)
                        ))
                        .zIndex(100)
                        .offset(y: -150) // Position above enemy, adjust as needed
                    }
                } else if case .error(let error) = viewModel.combatState {
                    // Error state
                    VStack(spacing: 20) {
                        NormalText("Failed to load combat session")
                            .foregroundColor(.red)
                        SmallText(error.localizedDescription)
                            .foregroundColor(.textSecondary)
                        TextButton("Retry") {
                            Task {
                                await viewModel.initializeOrResumeCombat(locationId: locationId, selectedLevel: selectedLevel)
                            }
                        }
                    }
                } else {
                    // Loading state - show placeholder UI
                    VStack(spacing: 20) {
                        Spacer()
                        ProgressView()
                            .scaleEffect(1.5)
                            .tint(.accent)
                        SmallText("Preparing battle...")
                            .foregroundColor(.textSecondary)
                        Spacer()
                    }
                }

                // Subtle loading indicator (non-blocking) - only show when processing action
                if viewModel.isProcessingAction {
                    VStack {
                        HStack {
                            Spacer()
                            ProgressView()
                                .padding()
                                .background(Color.black.opacity(0.7))
                                .cornerRadius(8)
                                .padding()
                        }
                        Spacer()
                    }
                }

                // Rewards overlay
                if case .loaded = viewModel.rewards {
                    rewardsOverlay(rewards: viewModel.rewards)
                }
            }
        } trailingView: {
            TurnIndicatorView(turnNumber: viewModel.turnNumber)
        }
        .floatingText()
        .environmentObject(floatingTextManager)
        .onChange(of: viewModel.currentDialogue) { oldValue, newValue in
            withAnimation {
                enemyDialogueVisible = newValue != nil
            }
        }
        .onChange(of: currentPhase) { oldPhase, newPhase in
            // Handle visual transitions when phase changes (no timers)
            withAnimation(.easeInOut(duration: 0.3)) {
                switch newPhase {
                case .playerAttack:
                    enemyGlowing = false
                    showDefensePrompt = false
                case .playerDefense:
                    enemyGlowing = true
                    showDefensePrompt = true
                }
            }

            // Hide defense prompt after brief display
            if newPhase == .playerDefense {
                Task {
                    try? await Task.sleep(nanoseconds: 500_000_000)
                    await MainActor.run {
                        withAnimation(.easeOut(duration: 0.2)) {
                            showDefensePrompt = false
                        }
                    }
                }
            }
        }
        .onDisappear {
            // Clean up animation timer when leaving the view
            stopEnemyAnimation()
        }
        .task {
            // Connect environment dependencies to viewModel
            viewModel.navigationManager = navigationManager
            viewModel.appState = appState

            // Use backend auto-resume flow - AppState should have already checked for active sessions
            // If AppState has a session, use it; otherwise try to create new combat or auto-resume
            if case .loaded(let session) = appState.activeCombatSession,
               let activeSession = session {
                // Resume existing session loaded by AppState
                viewModel.resumeCombat(session: activeSession)
                
                // Initialize enemy animation for existing session
                await initializeEnemyAnimation(for: activeSession.enemy)
            } else {
                // Try to resume existing session or create new one if locationId provided
                await viewModel.initializeOrResumeCombat(locationId: locationId, selectedLevel: selectedLevel)

                // Update AppState with whatever session we got from backend
                if case .loaded(let session) = viewModel.combatState {
                    appState.setCombatSession(session)
                    
                    // Initialize enemy animation for new session
                    await initializeEnemyAnimation(for: session.enemy)
                }
            }
        }
    }

    // MARK: - Helper Functions

    func startIdleAnimations() {
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
            transitionToPhase(.playerAttack)
        }
    }
    
    // MARK: - Enemy Animation Functions
    
    /// Initialize enemy animation loader and start idle animation
    func initializeEnemyAnimation(for enemy: CombatEnemy) async {
        // Use enemy ID as monster ID for animation loading
        let monsterId = enemy.id
        enemyAnimationLoader = MonsterAnimationLoader(monsterId: monsterId, animationType: "idle")
        
        // Load the animation
        await enemyAnimationLoader?.loadAnimation()
        
        // Start idle animation loop if loaded successfully
        if enemyAnimationLoader?.isReady == true {
            await MainActor.run {
                startEnemyIdleAnimation()
            }
        }
    }
    
    /// Start enemy idle animation loop
    func startEnemyIdleAnimation() {
        guard let loader = enemyAnimationLoader,
              let animationData = loader.animationData else { return }
        
        stopEnemyAnimation() // Stop any existing animation
        
        isEnemyAnimating = true
        enemyAnimationTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 12.0, repeats: true) { _ in
            DispatchQueue.main.async {
                self.enemyCurrentFrame = (self.enemyCurrentFrame + 1) % animationData.frames.count
            }
        }
    }
    
    /// Stop enemy animation
    func stopEnemyAnimation() {
        enemyAnimationTimer?.invalidate()
        enemyAnimationTimer = nil
        isEnemyAnimating = false
    }

    // MARK: - Phase Management

    /// Transition to a new combat phase (data-driven, no timers)
    func transitionToPhase(_ phase: CombatPhase) {
        currentPhase = phase
        dialVisible = true
        isDialSpinning = true
    }

    /// Handle dial tap based on current phase
    func handleDialTap(degrees: Double) {
        guard !viewModel.isLoading else { return }

        switch currentPhase {
        case .playerAttack:
            // Stop dial and trigger zone flash immediately
            isDialSpinning = false
            triggerZoneFlash()

            Task {
                // Perform attack with tap position degrees
                await viewModel.attack(tapPositionDegrees: Float(degrees))

                // CRITICAL: Run all state updates together on MainActor to avoid race conditions
                await MainActor.run {
                    // Get the last action for visual feedback
                    if let lastAction = viewModel.recentActions.last,
                       lastAction.type == .attack {
                        showAttackFeedback(action: lastAction)
                    }

                    // React to combat status from API response
                    if viewModel.combatEnded {
                        dialVisible = false
                        isDialSpinning = false
                        // Trigger combat end audio
                        triggerCombatEndAudio(won: viewModel.playerWon, audioManager: audioManager)
                    } else {
                        // Backend says combat ongoing - transition to defense
                        transitionToPhase(.playerDefense)
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

                // CRITICAL: Run all state updates together on MainActor to avoid race conditions
                await MainActor.run {
                    // Get the last action for visual feedback
                    if let lastAction = viewModel.recentActions.last,
                       lastAction.type == .defend {
                        showDefenseFeedback(action: lastAction)
                    }

                    // React to combat status from API response
                    if viewModel.combatEnded {
                        dialVisible = false
                        isDialSpinning = false
                        // Trigger combat end audio
                        triggerCombatEndAudio(won: viewModel.playerWon, audioManager: audioManager)
                    } else {
                        // Backend says combat ongoing - transition back to attack
                        transitionToPhase(.playerAttack)
                    }
                }
            }

        }
    }


    /// Get adjusted bands for current phase
    func getAdjustedBands(for phase: CombatPhase, session: CombatSession) -> AdjustedBands {
        // Use weapon config adjusted bands from session (same for both attack/defense)
        return session.weaponConfig.adjustedBands
    }

    // MARK: - Visual Feedback Methods

    /// Trigger zone flash animation (0.1s white pulse)
    func triggerZoneFlash() {
        // Flash the tapped zone - basic implementation
        withAnimation(.easeInOut(duration: 0.1)) {
            // Zone flash could be enhanced in TimingDialView for specific zone highlighting
        }
    }

    /// Show visual feedback for attack actions
    func showAttackFeedback(action: CombatAction) {
        // Use new zone information if available, fallback to legacy
        if let playerZone = action.playerDamage, let enemyZone = action.enemyDamage {
            // Show player's attack damage
            let playerColor = colorForZoneNumber(playerZone.zone)
            let playerText = textForZoneHit(playerZone)

            floatingTextManager.showText(
                playerText,
                color: playerColor,
                fontSize: playerZone.critOccurred ? 28 : 22,
                fontWeight: playerZone.critOccurred ? .black : .bold,
                duration: playerZone.critOccurred ? 0.8 : 0.5
            )

            // Enemy shake for good hits (zones 1-3)
            if playerZone.zone <= 3 {
                triggerEnemyShake()
            }

            // Show enemy's counterattack damage (smaller, below)
            if enemyZone.finalDamage > 0 {
                let enemyColor = Color.red
                floatingTextManager.showText(
                    "-\(Int(enemyZone.finalDamage))",
                    color: enemyColor,
                    fontSize: 18,
                    fontWeight: .regular,
                    duration: 0.4,
                    offsetY: 40 // Position below main damage text
                )

                // Player shake if hit hard
                if enemyZone.zone <= 2 {
                    triggerPlayerShake()
                }
            }

            // Trigger haptic and audio based on zone
            triggerHapticForZone(playerZone.zone)
            triggerAudioForZone(playerZone.zone, isCrit: playerZone.critOccurred)
        } else if let damage = action.damageDealt, let zone = action.hitZone {
            // Legacy fallback
            let color = colorForZone(zone)
            let text = textForZone(zone, damage: damage)

            floatingTextManager.showText(
                text,
                color: color,
                fontSize: zone.lowercased() == "crit" ? 24 : 20,
                fontWeight: zone.lowercased() == "crit" ? .black : .bold,
                duration: 0.5
            )

            if !["miss", "injure"].contains(zone.lowercased()) {
                triggerEnemyShake()
            }

            triggerHapticFeedback(for: zone)
            triggerAudioFeedback(for: action, audioManager: audioManager)
        }
    }

    /// Show visual feedback for defense actions
    func showDefenseFeedback(action: CombatAction) {
        // Use new zone information if available, fallback to legacy
        if let playerZone = action.playerDamage, let enemyZone = action.enemyDamage {
            // Show player's defense effectiveness (how well they reduced damage)
            let defenseColor = colorForZoneNumber(playerZone.zone)
            let defenseText = displayNameForZone(playerZone.zone)

            // Show damage reduction or mitigation
            floatingTextManager.showText(
                defenseText,
                color: defenseColor,
                fontSize: 20,
                fontWeight: .bold,
                duration: 0.5
            )

            // Show enemy's attack damage (that got through)
            if enemyZone.finalDamage > 0 {
                floatingTextManager.showText(
                    "-\(Int(enemyZone.finalDamage))",
                    color: .red,
                    fontSize: 22,
                    fontWeight: .bold,
                    duration: 0.5,
                    offsetY: 35
                )

                // Player shake if took significant damage
                if enemyZone.zone <= 2 || enemyZone.critOccurred {
                    triggerPlayerShake()
                }
            }

            // Shield effect based on player defense zone (better defense = better zone)
            let shieldEffectiveness = Double(6 - playerZone.zone) / 5.0 // Zone 1 = 1.0, Zone 5 = 0.2
            showShieldEffect(effectiveness: shieldEffectiveness)

            // Trigger haptic based on defense quality
            triggerHapticForZone(playerZone.zone)
        } else {
            // Legacy fallback
            guard let damageTaken = action.damageDealt else { return }

            let effectiveness = action.damageBlocked != nil && action.damageDealt != nil
                ? getDefenseEffectiveness(blocked: action.damageBlocked!, taken: action.damageDealt!)
                : 0.0
            showShieldEffect(effectiveness: effectiveness)

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

            if let blocked = action.damageBlocked {
                triggerDefenseHaptic(damageBlocked: blocked, damageTaken: damageTaken)
            }
            triggerAudioFeedback(for: action, audioManager: audioManager)
        }
    }

    /// Trigger enemy shake animation
    func triggerEnemyShake() {
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

    /// Trigger player shake animation
    func triggerPlayerShake() {
        withAnimation(.easeInOut(duration: 0.15)) {
            playerOffset = CGPoint(x: -4, y: 0)
        }

        Task {
            try? await Task.sleep(nanoseconds: 75_000_000) // 0.075s
            await MainActor.run {
                withAnimation(.easeInOut(duration: 0.1)) {
                    playerOffset = CGPoint(x: 4, y: 0)
                }
            }
            try? await Task.sleep(nanoseconds: 75_000_000) // 0.075s
            await MainActor.run {
                withAnimation(.easeInOut(duration: 0.1)) {
                    playerOffset = .zero
                }
            }
        }
    }

    /// Show shield effect for defense
    func showShieldEffect(effectiveness: Double) {
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
}

#Preview {
    BattleView(locationId: "test-location-id")
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
        .environment(AppState.shared)
}
