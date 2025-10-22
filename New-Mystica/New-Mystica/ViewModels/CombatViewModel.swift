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
    var rewards: Loadable<CombatRewards>?
    var turnResult: AttackResult?

    // MARK: - Combat Tracking
    var currentHP: Int = 0
    var enemyHP: Int = 0
    var turnHistory: [CombatAction] = []

    // MARK: - UI State
    var selectedAction: CombatActionType?
    var timingScore: Double = 0.0
    var actionInProgress: Bool = false

    init(repository: CombatRepository = DefaultCombatRepository()) {
        self.repository = repository
    }

    // MARK: - Public Methods

    func startCombat(locationId: String) async {
        combatState = .loading
        rewards = nil
        turnHistory = []
        turnResult = nil

        do {
            let session = try await repository.initiateCombat(locationId: locationId, selectedLevel: 1)
            combatState = .loaded(session)

            // Initialize HP values
            currentHP = Int(session.playerHp ?? Double(session.playerStats.defPower * 10))
            enemyHP = Int(session.enemyHp ?? Double(session.enemy.stats.defPower * 10))

        } catch let error as AppError {
            combatState = .error(error)
        } catch {
            combatState = .error(.unknown(error))
        }
    }

    func attack(timingScore: Double) async {
        guard case .loaded(let session) = combatState else { return }
        guard !actionInProgress else { return }

        actionInProgress = true
        defer { actionInProgress = false }

        self.timingScore = timingScore

        do {
            let action = try await repository.performAttack(
                sessionId: session.sessionId,
                timingScore: timingScore
            )

            // Add to turn history
            turnHistory.append(action)

            // In MVP0, we'd need to manually check HP and determine combat end
            // For now, assuming combat continues until manual end

        } catch let error as AppError {
            combatState = .error(error)
        } catch {
            combatState = .error(.unknown(error))
        }
    }

    func defend(timingScore: Double) async {
        guard case .loaded(let session) = combatState else { return }
        guard !actionInProgress else { return }

        actionInProgress = true
        defer { actionInProgress = false }

        self.timingScore = timingScore

        do {
            let action = try await repository.performDefense(
                sessionId: session.sessionId,
                timingScore: timingScore
            )

            // Add to turn history
            turnHistory.append(action)

            // In MVP0, we'd need to manually check HP and determine combat end
            // For now, assuming combat continues until manual end

        } catch let error as AppError {
            combatState = .error(error)
        } catch {
            combatState = .error(.unknown(error))
        }
    }

    func endCombat(won: Bool) async {
        guard case .loaded(let session) = combatState else { return }

        do {
            let combatRewards = try await repository.completeCombat(
                sessionId: session.sessionId,
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

    func claimRewards() async {
        // Mark rewards as claimed and reset combat state
        rewards = nil
        combatState = .idle
        resetCombatState()
    }

    func resetCombat() {
        combatState = .idle
        rewards = nil
        resetCombatState()
    }

    // MARK: - Private Methods

    private func resetCombatState() {
        turnResult = nil
        currentHP = 0
        enemyHP = 0
        turnHistory = []
        selectedAction = nil
        timingScore = 0.0
        actionInProgress = false
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
        return isInCombat && !actionInProgress
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
              let maxHP = session.playerHp else { return 0.0 }
        return Double(currentHP) / maxHP
    }

    var enemyHPPercentage: Double {
        guard let session = getCurrentSession(),
              let maxHP = session.enemyHp else { return 0.0 }
        return Double(enemyHP) / maxHP
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
}