//
//  CombatViewModel.swift
//  New-Mystica
//
//  Manages combat session state and turn-based battle flow
//

import Foundation
import Observation

@Observable
final class CombatViewModel {

    // MARK: - Combat Balance Placeholders
    // TODO: Replace with dynamic timing-based scoring when timing system implemented
    private static let DEFAULT_TIMING_SCORE = 0.8 // 80% success rate for MVP0 simplification

    // TODO: Replace with proper stat-based HP calculation from backend specs
    private static let HP_MULTIPLIER = 10 // Simplified formula: defPower * 10 for MVP0
    let repository: CombatRepository
    weak var navigationManager: NavigationManager?
    weak var appState: AppState?

    // MARK: - State
    var combatState: Loadable<CombatSession> = .idle
    var rewards: Loadable<CombatRewards> = .idle
    var isProcessingAction: Bool = false

    // MARK: - UI-Only State (not from server)
    var turnHistory: [CombatAction] = [] // Local UI history for display
    var selectedAction: CombatActionType?
    // NOTE: timingScore removed - timing system not yet implemented

    var currentDialogue: DialogueData?
    var isGeneratingDialogue: Bool = false
    private var dialogueTimer: Timer?
    private var dialogueExpirationDate: Date?

    // MARK: - Combat Statistics Tracking (for defeat screen)
    private var totalDamageDealt: Double = 0
    private var highestMultiplier: Double = 1.0

    init(repository: CombatRepository = DefaultCombatRepository(), navigationManager: NavigationManager? = nil, appState: AppState? = nil) {
        self.repository = repository
        self.navigationManager = navigationManager
        self.appState = appState
    }

    // MARK: - Public Methods

    /// Check for active session or create new one if locationId provided
    /// - Parameter locationId: Optional location ID for creating new combat
    /// - Parameter selectedLevel: Combat difficulty level (default: 1 for MVP0)
    func initializeOrResumeCombat(locationId: String? = nil, selectedLevel: Int = 1) async {
        combatState = .loading
        rewards = .idle
        turnHistory = []
        currentDialogue = nil
        totalDamageDealt = 0
        highestMultiplier = 1.0

        do {
            // First check for existing active session
            let activeSession = try await repository.getUserActiveSession()

            if let session = activeSession {
                // Resume existing session
                combatState = .loaded(session)
            } else if let locationId = locationId {
                // No active session but locationId provided - create new combat
                let newSession = try await repository.initiateCombat(
                    locationId: locationId,
                    selectedLevel: selectedLevel
                )
                combatState = .loaded(newSession)

                // Fetch commentary for combat start
                await fetchCommentary(eventType: .combatStart)
            } else {
                // No active session and no locationId - cannot proceed
                combatState = .idle
            }
        } catch let error as AppError {
            combatState = .error(error)
        } catch {
            combatState = .error(.unknown(error))
        }
    }

    /// Resume combat with an existing session from AppState
    /// Used when AppState has already loaded the active session via auto-resume
    func resumeCombat(session: CombatSession) {
        // Load session state directly - no API call needed since AppState already fetched it
        combatState = .loaded(session)
        rewards = .idle
        turnHistory = [] // Could load action history from server in future
        totalDamageDealt = 0
        highestMultiplier = 1.0
    }

    func attack(tapPositionDegrees: Float) async {
        guard case .loaded(let session) = combatState else { return }
        guard !isLoading else { return }

        // Store session before setting to loading
        let currentSession = session
        isProcessingAction = true

        do {
            let action = try await repository.performAttack(
                sessionId: currentSession.sessionId,
                tapPositionDegrees: tapPositionDegrees
            )

            // Add to turn history for UI display
            turnHistory.append(action)

            // Track combat stats for defeat screen
            if let damage = action.damageDealt {
                totalDamageDealt += damage
            }
            // Track highest multiplier from attack actions (check for crit bonus)
            if action.type == .attack, let damage = action.damageDealt, damage > 0 {
                // Estimate multiplier from damage (simplified - could be enhanced with backend data)
                let estimatedMultiplier = damage / (currentSession.playerStats.atkPower * 0.5) // Rough estimate
                if estimatedMultiplier > highestMultiplier {
                    highestMultiplier = estimatedMultiplier
                }
            }

            // Update combat state from action response (eliminates session refetch)
            updateCombatStateFromAction(action, previousSession: currentSession)

            // Fetch enemy commentary ONLY if combat is still ongoing
            if action.combatStatus == .ongoing || action.combatStatus == .active {
                Task {
                    do {
                        try await fetchCommentary()
                    } catch {
                        // Log the error but don't interrupt combat flow
                        print("Failed to fetch enemy commentary: \(error)")
                    }
                }
            }

            // Handle combat completion with direct navigation
            if action.combatStatus == .victory {
                appState?.setCombatSession(nil) // Clear active session
                appState?.setCombatRewards(action.rewards) // Store rewards for VictoryView
                navigationManager?.navigateTo(.victory)
            } else if action.combatStatus == .defeat {
                // Store combat metadata BEFORE clearing session
                if let rewards = action.rewards {
                    let metadata = CombatMetadata(
                        totalDamageDealt: totalDamageDealt,
                        turnsSurvived: action.turnNumber ?? 0,
                        highestMultiplier: highestMultiplier,
                        combatHistory: rewards.combatHistory,
                        enemy: currentSession.enemy
                    )
                    appState?.setLastCombatMetadata(metadata)
                }
                appState?.setCombatSession(nil) // Clear active session
                appState?.clearCombatRewards() // Clear any previous rewards
                navigationManager?.navigateTo(.defeat)
            }
            // If ongoing, state already updated - stay on battle view

            isProcessingAction = false
        } catch let error as AppError {
            combatState = .error(error)
            isProcessingAction = false
        } catch {
            combatState = .error(.unknown(error))
            isProcessingAction = false
        }
    }

    func defend(tapPositionDegrees: Float) async {
        guard case .loaded(let session) = combatState else { return }
        guard !isLoading else { return }

        // Store session before setting to loading
        let currentSession = session
        isProcessingAction = true

        do {
            let action = try await repository.performDefense(
                sessionId: currentSession.sessionId,
                tapPositionDegrees: tapPositionDegrees
            )

            // Add to turn history for UI display
            turnHistory.append(action)

            // Update combat state from action response (eliminates session refetch)
            updateCombatStateFromAction(action, previousSession: currentSession)

            // Fetch enemy commentary ONLY if combat is still ongoing
            if action.combatStatus == .ongoing || action.combatStatus == .active {
                Task {
                    do {
                        try await fetchCommentary()
                    } catch {
                        // Log the error but don't interrupt combat flow
                        print("Failed to fetch enemy commentary: \(error)")
                    }
                }
            }

            // Handle combat completion with direct navigation
            if action.combatStatus == .victory {
                appState?.setCombatSession(nil) // Clear active session
                appState?.setCombatRewards(action.rewards) // Store rewards for VictoryView
                navigationManager?.navigateTo(.victory)
            } else if action.combatStatus == .defeat {
                // Store combat metadata BEFORE clearing session
                if let rewards = action.rewards {
                    let metadata = CombatMetadata(
                        totalDamageDealt: totalDamageDealt,
                        turnsSurvived: action.turnNumber ?? 0,
                        highestMultiplier: highestMultiplier,
                        combatHistory: rewards.combatHistory,
                        enemy: currentSession.enemy
                    )
                    appState?.setLastCombatMetadata(metadata)
                }
                appState?.setCombatSession(nil) // Clear active session
                appState?.clearCombatRewards() // Clear any previous rewards
                navigationManager?.navigateTo(.defeat)
            }
            // If ongoing, state already updated - stay on battle view

            isProcessingAction = false
        } catch let error as AppError {
            combatState = .error(error)
            isProcessingAction = false
        } catch {
            combatState = .error(.unknown(error))
            isProcessingAction = false
        }
    }

    func endCombat(won: Bool) async {
        guard case .loaded(let session) = combatState else { return }
        await fetchRewards(sessionId: session.sessionId, won: won)
    }

    private func fetchRewards(sessionId: String, won: Bool) async {
        rewards = .loading

        do {
            let combatRewards = try await repository.completeCombat(
                sessionId: sessionId,
                won: won
            )
            rewards = .loaded(combatRewards)
        } catch let error as AppError {
            rewards = .error(error)
        } catch {
            rewards = .error(.unknown(error))
        }
    }

    func retreat() async {
        guard case .loaded(let session) = combatState else { return }
        await endCombat(won: false)
    }

    func abandonCombat() async {
        guard case .loaded(let session) = combatState else { return }

        do {
            try await repository.abandonCombat(sessionId: session.sessionId)
            resetCombat()
            // Clear the session from AppState so it won't be resumed
            appState?.setCombatSession(nil)
        } catch let error as AppError {
            combatState = .error(error)
        } catch {
            combatState = .error(.unknown(error))
        }
    }

    func claimRewards() async {
        // Mark rewards as claimed and reset combat state
        rewards = .idle
        combatState = .idle
        resetCombatState()
    }

    func resetCombat() {
        combatState = .idle
        rewards = .idle
        resetCombatState()
    }

    // MARK: - Private Methods

    private func resetCombatState() {
        turnHistory = []
        selectedAction = nil
        currentDialogue = nil
        isGeneratingDialogue = false
        dialogueTimer?.invalidate()
        dialogueTimer = nil
        dialogueExpirationDate = nil
        totalDamageDealt = 0
        highestMultiplier = 1.0
        // NOTE: timingScore removed - timing system not yet implemented
    }

    private func scheduleDialogueDismissal() {
        dialogueTimer?.invalidate()
        dialogueExpirationDate = Date().addingTimeInterval(4.5)

        dialogueTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: false) { [weak self] _ in
            DispatchQueue.main.async {
                self?.currentDialogue = nil
            }
        }
    }

    /// Determine the event type based on the last combat action
    private func determineEventType(from action: CombatAction) -> CombatEventType {
        // Infer event type from action context and combat state
        if case .loaded(let session) = combatState {
            // Check for special conditions
            if session.playerHp <= Double(session.playerStats.hp) * 0.3 {
                return .lowPlayerHP
            }
            if session.enemyHp <= Double(session.enemy.hp) * 0.15 {
                return .nearVictory
            }
        }

        // Determine based on action type
        // During attack phase: player attacks
        // During defense phase: enemy attacks while player defends
        return action.type == .attack ? .playerAttacks : .enemyAttacks
    }

    /// Build event details from the most recent combat action
    private func buildEventDetails() -> CombatEventDetails? {
        guard let session = getCurrentSession() else {
            return nil
        }

        // Extract zone and action data from the most recent turn
        let lastAction = turnHistory.last
        let playerZone = lastAction?.playerDamage?.zone
        let enemyZone = lastAction?.enemyDamage?.zone
        let playerAction = lastAction?.type.rawValue // "attack" or "defend"
        let damage = lastAction?.damageDealt.map { Int($0) }
        let isCritical = lastAction?.playerDamage?.critOccurred

        return CombatEventDetails(
            turnNumber: session.turnNumber ?? 1,
            playerHpPct: playerHPPercentage,
            enemyHpPct: enemyHPPercentage,
            damage: damage,
            isCritical: isCritical,
            playerZone: playerZone,
            enemyZone: enemyZone,
            playerAction: playerAction
        )
    }

    /// Fetch enemy commentary for the current combat event
    private func fetchCommentary(eventType: CombatEventType? = nil) async {
        guard case .loaded(let session) = combatState else {
            return
        }
        guard !isGeneratingDialogue else {
            return
        }

        // Determine event type dynamically if not provided
        let finalEventType: CombatEventType = eventType ?? (turnHistory.last.map(determineEventType) ?? .combatStart)

        guard let eventDetails = buildEventDetails() else {
            return
        }

        isGeneratingDialogue = true
        do {
            let dialogueResponse = try await repository.fetchEnemyChatter(
                sessionId: session.sessionId,
                eventType: finalEventType.rawValue,
                eventDetails: eventDetails
            )

            await MainActor.run {
                self.currentDialogue = DialogueData(
                    text: dialogueResponse.dialogue,
                    tone: dialogueResponse.dialogueTone
                )
                self.isGeneratingDialogue = false
                self.scheduleDialogueDismissal()
            }
        } catch {
            isGeneratingDialogue = false
            print("Error fetching enemy commentary: \(error)")
        }
    }

    private func handleCombatEnd(status: CombatStatus, sessionId: String) async {
        let won = (status == .victory)
        await endCombat(won: won)
    }

    // MARK: - Computed Properties

    var isInCombat: Bool {
        if case .loaded(let session) = combatState {
            return session.status == .active
        }
        return false
    }

    var canAct: Bool {
        return isInCombat && !isLoading
    }

    var combatEnded: Bool {
        if case .loaded(let session) = combatState {
            return session.status == .victory ||
                   session.status == .defeat ||
                   session.status == .abandoned
        }
        return false
    }

    var playerWon: Bool {
        if case .loaded(let session) = combatState {
            return session.status == .victory
        }
        return false
    }

    var currentEnemy: Enemy? {
        if case .loaded(let session) = combatState {
            let combatEnemy = session.enemy
            return Enemy(
                id: combatEnemy.id,
                name: combatEnemy.name,
                level: combatEnemy.level,
                stats: combatEnemy.stats,
                specialAbilities: combatEnemy.personalityTraits,
                goldMin: 0, // Not provided in combat enemy
                goldMax: 0, // Not provided in combat enemy
                materialDropPool: [] // Not provided in combat enemy
            )
        }
        return nil
    }

    var playerHPPercentage: Double {
        guard let session = getCurrentSession() else { return 0.0 }
        guard let maxHP = getPlayerMaxHP(session: session) else {
            assertionFailure("Player max HP should always be available")
            return 0.0
        }
        let percentage = session.playerHp / maxHP
        // Clamp percentage to [0.0, 1.0] to prevent validation errors from rounding/precision issues
        return max(0.0, min(1.0, percentage))
    }

    var enemyHPPercentage: Double {
        guard let session = getCurrentSession() else { return 0.0 }
        guard let maxHP = getEnemyMaxHP(session: session) else {
            assertionFailure("Enemy max HP should always be available")
            return 0.0
        }
        let percentage = session.enemyHp / maxHP
        // Clamp percentage to [0.0, 1.0] to prevent validation errors from rounding/precision issues
        return max(0.0, min(1.0, percentage))
    }

    private func getCurrentSession() -> CombatSession? {
        if case .loaded(let session) = combatState {
            return session
        }
        return nil
    }

    var turnNumber: Int {
        return getCurrentSession()?.turnNumber ?? 0
    }

    var recentActions: [CombatAction] {
        return Array(turnHistory.suffix(5)) // Show last 5 actions
    }

    // MARK: - Computed Properties for HP

    var currentHP: Int {
        guard let session = getCurrentSession() else {
            return 0
        }
        return Int(session.playerHp)
    }

    var enemyHP: Int {
        guard let session = getCurrentSession() else {
            return 0
        }
        return Int(session.enemyHp)
    }

    var isLoading: Bool {
        return combatState.isLoading || rewards.isLoading || isProcessingAction
    }

    // MARK: - Helper Methods

    /// Update combat session state from action response data (eliminates session refetch)
    private func updateCombatStateFromAction(_ action: CombatAction, previousSession: CombatSession) {
        // Create new session with updated values from action response
        let updatedSession = CombatSession(
            sessionId: previousSession.sessionId,
            playerId: previousSession.playerId,
            enemyId: previousSession.enemyId,
            status: action.combatStatus,
            location: previousSession.location,
            enemy: previousSession.enemy,
            playerStats: previousSession.playerStats,
            weaponConfig: previousSession.weaponConfig,
            turnNumber: action.turnNumber ?? previousSession.turnNumber,
            currentTurnOwner: previousSession.currentTurnOwner,
            playerHp: action.playerHpRemaining ?? previousSession.playerHp,
            enemyHp: action.enemyHpRemaining ?? previousSession.enemyHp,
            expiresAt: previousSession.expiresAt
        )

        combatState = .loaded(updatedSession)
    }

    private func getPlayerMaxHP(session: CombatSession) -> Double? {
        // TODO: Request backend to provide player max HP in player_stats
        // For now, calculate from defPower (approximation)
        return session.playerStats.defPower * Double(Self.HP_MULTIPLIER)
    }

    private func getEnemyMaxHP(session: CombatSession) -> Double? {
        // Use backend-provided max HP value to ensure consistency
        // The enemy.hp field contains the realized HP (base_hp × tier.difficulty_multiplier)
        return session.enemy.hp
    }

    // MARK: - Location Properties

    /// Background image URL from the combat location
    var backgroundImageURL: String? {
        guard let session = getCurrentSession() else { return nil }
        return session.location?.backgroundImageUrl
    }
}