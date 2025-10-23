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
    let repository: CombatRepository

    // MARK: - State
    var combatState: Loadable<CombatSession> = .idle
    var rewards: Loadable<CombatRewards> = .idle

    // MARK: - UI-Only State (not from server)
    var turnHistory: [CombatAction] = [] // Local UI history for display
    var selectedAction: CombatActionType?
    var timingScore: Double = 0.0

    init(repository: CombatRepository = DefaultCombatRepository()) {
        self.repository = repository
    }

    // MARK: - Public Methods

    func startCombat(locationId: String) async {
        combatState = .loading
        rewards = .idle
        turnHistory = []

        do {
            let session = try await repository.initiateCombat(locationId: locationId, selectedLevel: 1)
            combatState = .loaded(session)
        } catch let error as AppError {
            combatState = .error(error)
        } catch {
            combatState = .error(.unknown(error))
        }
    }

    func resumeCombat(session: CombatSession) async {
        // Resume existing combat session (no API call needed, just load state)
        combatState = .loaded(session)
        rewards = .idle
        turnHistory = [] // Could load action history from server in future
    }

    func attack(timingScore: Double) async {
        guard case .loaded(let session) = combatState else { return }
        guard !isLoading else { return }

        combatState = .loading
        self.timingScore = timingScore

        do {
            let action = try await repository.performAttack(
                sessionId: session.sessionId,
                timingScore: timingScore
            )

            // Add to turn history for UI display
            turnHistory.append(action)

            // Refetch combat state to get updated HP values
            let updatedSession = try await repository.fetchCombatSession(sessionId: session.sessionId)
            combatState = .loaded(updatedSession)

            // Check if combat ended and trigger rewards
            if updatedSession.status != .active && updatedSession.status != .ongoing {
                await fetchRewards(sessionId: session.sessionId, won: playerWon)
            }

        } catch let error as AppError {
            combatState = .error(error)
        } catch {
            combatState = .error(.unknown(error))
        }
    }

    func defend(timingScore: Double) async {
        guard case .loaded(let session) = combatState else { return }
        guard !isLoading else { return }

        combatState = .loading
        self.timingScore = timingScore

        do {
            let action = try await repository.performDefense(
                sessionId: session.sessionId,
                timingScore: timingScore
            )

            // Add to turn history for UI display
            turnHistory.append(action)

            // Refetch combat state to get updated HP values
            let updatedSession = try await repository.fetchCombatSession(sessionId: session.sessionId)
            combatState = .loaded(updatedSession)

            // Check if combat ended and trigger rewards
            if updatedSession.status != .active && updatedSession.status != .ongoing {
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
        timingScore = 0.0
    }

    private func handleCombatEnd(status: CombatStatus, sessionId: String) async {
        let won = (status == .playerWon || status == .victory)
        await endCombat(won: won)
    }

    // MARK: - Computed Properties

    var isInCombat: Bool {
        if case .loaded(let session) = combatState {
            return session.status == .active || session.status == .ongoing
        }
        return false
    }

    var canAct: Bool {
        return isInCombat && !isLoading
    }

    var combatEnded: Bool {
        if case .loaded(let session) = combatState {
            return session.status == .playerWon ||
                   session.status == .enemyWon ||
                   session.status == .victory ||
                   session.status == .defeat ||
                   session.status == .retreated
        }
        return false
    }

    var playerWon: Bool {
        if case .loaded(let session) = combatState {
            return session.status == .playerWon || session.status == .victory
        }
        return false
    }

    var currentEnemy: Enemy? {
        if case .loaded(let session) = combatState {
            return session.enemy
        }
        return nil
    }

    var playerHPPercentage: Double {
        guard let session = getCurrentSession(),
              let currentHP = session.playerHp,
              let maxHP = getPlayerMaxHP(session: session) else { return 0.0 }
        return currentHP / maxHP
    }

    var enemyHPPercentage: Double {
        guard let session = getCurrentSession(),
              let currentHP = session.enemyHp,
              let maxHP = getEnemyMaxHP(session: session) else { return 0.0 }
        return currentHP / maxHP
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
        guard let session = getCurrentSession(),
              let hp = session.playerHp else {
            return 0
        }
        return Int(hp)
    }

    var enemyHP: Int {
        guard let session = getCurrentSession(),
              let hp = session.enemyHp else {
            return 0
        }
        return Int(hp)
    }

    var isLoading: Bool {
        return combatState.isLoading || rewards.isLoading
    }

    // MARK: - Helper Methods

    private func getPlayerMaxHP(session: CombatSession) -> Double? {
        // Use initial HP calculation as max HP (this could be stored in session later)
        return Double(session.playerStats.defPower * 10)
    }

    private func getEnemyMaxHP(session: CombatSession) -> Double? {
        // Use initial HP calculation as max HP (this could be stored in session later)
        return Double(session.enemy.stats.defPower * 10)
    }
}