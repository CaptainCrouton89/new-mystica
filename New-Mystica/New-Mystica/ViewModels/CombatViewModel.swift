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

    // MARK: - State
    var combatState: Loadable<CombatSession> = .idle
    var rewards: Loadable<CombatRewards> = .idle

    // MARK: - UI-Only State (not from server)
    var turnHistory: [CombatAction] = [] // Local UI history for display
    var selectedAction: CombatActionType?
    // NOTE: timingScore removed - timing system not yet implemented

    init(repository: CombatRepository = DefaultCombatRepository()) {
        self.repository = repository
    }

    // MARK: - Public Methods

    /// Check for active session or create new one if locationId provided
    /// - Parameter locationId: Optional location ID for creating new combat
    /// - Parameter selectedLevel: Combat difficulty level (default: 1 for MVP0)
    func initializeOrResumeCombat(locationId: String? = nil, selectedLevel: Int = 1) async {
        combatState = .loading
        rewards = .idle
        turnHistory = []

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
    }

    func attack(tapPositionDegrees: Float) async {
        guard case .loaded(let session) = combatState else { return }
        guard !isLoading else { return }

        combatState = .loading

        do {
            let action = try await repository.performAttack(
                sessionId: session.sessionId,
                tapPositionDegrees: tapPositionDegrees
            )

            // Add to turn history for UI display
            turnHistory.append(action)

            // Refetch combat state to get updated HP values
            let updatedSession = try await repository.fetchCombatSession(sessionId: session.sessionId)
            combatState = .loaded(updatedSession)

            // Check if combat ended and trigger rewards
            if updatedSession.status != .active {
                await fetchRewards(sessionId: session.sessionId, won: playerWon)
            }

        } catch let error as AppError {
            combatState = .error(error)
        } catch {
            combatState = .error(.unknown(error))
        }
    }

    func defend(tapPositionDegrees: Float) async {
        guard case .loaded(let session) = combatState else { return }
        guard !isLoading else { return }

        combatState = .loading

        do {
            let action = try await repository.performDefense(
                sessionId: session.sessionId,
                tapPositionDegrees: tapPositionDegrees
            )

            // Add to turn history for UI display
            turnHistory.append(action)

            // Refetch combat state to get updated HP values
            let updatedSession = try await repository.fetchCombatSession(sessionId: session.sessionId)
            combatState = .loaded(updatedSession)

            // Check if combat ended and trigger rewards
            if updatedSession.status != .active {
                await fetchRewards(sessionId: session.sessionId, won: playerWon)
            }

        } catch let error as AppError {
            combatState = .error(error)
        } catch {
            combatState = .error(.unknown(error))
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
        // NOTE: timingScore removed - timing system not yet implemented
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
        return session.playerHp / maxHP
    }

    var enemyHPPercentage: Double {
        guard let session = getCurrentSession() else { return 0.0 }
        guard let maxHP = getEnemyMaxHP(session: session) else {
            assertionFailure("Enemy max HP should always be available")
            return 0.0
        }
        return session.enemyHp / maxHP
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
        return combatState.isLoading || rewards.isLoading
    }

    // MARK: - Helper Methods

    private func getPlayerMaxHP(session: CombatSession) -> Double? {
        // TODO: Store actual max HP in session from backend instead of recalculating
        return session.playerStats.defPower * Double(Self.HP_MULTIPLIER)
    }

    private func getEnemyMaxHP(session: CombatSession) -> Double? {
        // TODO: Store actual max HP in session from backend instead of recalculating
        return session.enemy.stats.defPower * Double(Self.HP_MULTIPLIER)
    }
}