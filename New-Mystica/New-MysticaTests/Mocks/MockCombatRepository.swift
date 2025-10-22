//
//  MockCombatRepository.swift
//  New-MysticaTests
//
//  Mock implementation of CombatRepository for testing
//

import Foundation
@testable import New_Mystica

class MockCombatRepository: CombatRepository {

    // MARK: - Configuration Properties
    var shouldFailInitiateCombat = false
    var shouldFailPerformAttack = false
    var shouldFailPerformDefense = false
    var shouldFailCompleteCombat = false
    var shouldFailFetchCombatSession = false
    var shouldFailRetreatCombat = false
    var initiateCombatDelayMs: Int = 0
    var performAttackDelayMs: Int = 0
    var performDefenseDelayMs: Int = 0
    var completeCombatDelayMs: Int = 0
    var fetchCombatSessionDelayMs: Int = 0
    var retreatCombatDelayMs: Int = 0

    // MARK: - Mock Data
    var mockCombatSession: CombatSession = CombatSession.testData()
    var mockCombatAction: CombatAction = CombatAction.testData()
    var mockCombatRewards: CombatRewards = CombatRewards.testData()

    // MARK: - Call Tracking
    var initiateCombatCallCount = 0
    var performAttackCallCount = 0
    var performDefenseCallCount = 0
    var completeCombatCallCount = 0
    var fetchCombatSessionCallCount = 0
    var retreatCombatCallCount = 0
    var lastInitiatedCombatParams: (locationId: String, selectedLevel: Int)?
    var lastAttackParams: (sessionId: String, timingScore: Double)?
    var lastDefenseParams: (sessionId: String, timingScore: Double)?
    var lastCompleteCombatParams: (sessionId: String, won: Bool)?
    var lastFetchedSessionId: String?
    var lastRetreatSessionId: String?

    // MARK: - Combat State Simulation
    var playerHp: Double = 100.0
    var enemyHp: Double = 80.0
    var turnNumber: Int = 1

    // MARK: - CombatRepository Implementation

    func initiateCombat(locationId: String, selectedLevel: Int) async throws -> CombatSession {
        initiateCombatCallCount += 1
        lastInitiatedCombatParams = (locationId: locationId, selectedLevel: selectedLevel)

        if initiateCombatDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(initiateCombatDelayMs * 1_000_000))
        }

        if shouldFailInitiateCombat {
            throw AppError.serverError(400, "Cannot initiate combat at location")
        }

        // Reset combat state for new session
        playerHp = 100.0
        enemyHp = 80.0
        turnNumber = 1

        // Create combat session with parameters
        let enemy = Enemy.testData(level: selectedLevel)
        mockCombatSession = CombatSession.testData(
            enemyId: "enemy_\(locationId)_\(selectedLevel)",
            turnNumber: turnNumber,
            enemy: enemy,
            playerHp: playerHp,
            enemyHp: enemyHp
        )

        return mockCombatSession
    }

    func performAttack(sessionId: String, timingScore: Double) async throws -> CombatAction {
        performAttackCallCount += 1
        lastAttackParams = (sessionId: sessionId, timingScore: timingScore)

        if performAttackDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(performAttackDelayMs * 1_000_000))
        }

        if shouldFailPerformAttack {
            throw AppError.serverError(400, "Attack failed")
        }

        turnNumber += 1

        // Calculate damage based on timing score (0.0-1.0)
        let baseDamage = 15.0
        let timingMultiplier = 0.5 + (timingScore * 0.5) // 0.5x to 1.0x multiplier
        let damage = baseDamage * timingMultiplier

        enemyHp = max(0, enemyHp - damage)

        mockCombatAction = CombatAction.testData(
            type: .attack,
            performerId: "player",
            damageDealt: damage,
            result: enemyHp <= 0 ? "Enemy defeated!" : "Attack successful"
        )

        return mockCombatAction
    }

    func performDefense(sessionId: String, timingScore: Double) async throws -> CombatAction {
        performDefenseCallCount += 1
        lastDefenseParams = (sessionId: sessionId, timingScore: timingScore)

        if performDefenseDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(performDefenseDelayMs * 1_000_000))
        }

        if shouldFailPerformDefense {
            throw AppError.serverError(400, "Defense failed")
        }

        turnNumber += 1

        // Calculate damage reduction based on timing score
        let enemyBaseDamage = 12.0
        let defenseEffectiveness = timingScore // 0.0-1.0
        let damageReduction = enemyBaseDamage * defenseEffectiveness
        let damageTaken = max(0, enemyBaseDamage - damageReduction)

        playerHp = max(0, playerHp - damageTaken)

        mockCombatAction = CombatAction.testData(
            type: .defend,
            performerId: "player",
            damageDealt: damageReduction,
            result: playerHp <= 0 ? "Player defeated!" : "Defense successful"
        )

        return mockCombatAction
    }

    func completeCombat(sessionId: String, won: Bool) async throws -> CombatRewards {
        completeCombatCallCount += 1
        lastCompleteCombatParams = (sessionId: sessionId, won: won)

        if completeCombatDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(completeCombatDelayMs * 1_000_000))
        }

        if shouldFailCompleteCombat {
            throw AppError.serverError(400, "Cannot complete combat")
        }

        // Generate rewards based on victory
        let goldEarned = won ? Int.random(in: 50...150) : Int.random(in: 10...30)
        let experienceEarned = won ? Int.random(in: 100...200) : Int.random(in: 25...50)

        mockCombatRewards = CombatRewards.testData(
            goldEarned: goldEarned,
            experienceEarned: experienceEarned,
            itemsDropped: won ? [EnhancedPlayerItem.testData()] : [],
            materialsDropped: won ? [MaterialDrop.testData()] : []
        )

        return mockCombatRewards
    }

    func fetchCombatSession(sessionId: String) async throws -> CombatSession {
        fetchCombatSessionCallCount += 1
        lastFetchedSessionId = sessionId

        if fetchCombatSessionDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(fetchCombatSessionDelayMs * 1_000_000))
        }

        if shouldFailFetchCombatSession {
            throw AppError.notFound
        }

        // Update session with current state
        mockCombatSession = CombatSession.testData(
            sessionId: sessionId,
            turnNumber: turnNumber,
            playerHp: playerHp,
            enemyHp: enemyHp
        )

        return mockCombatSession
    }

    func retreatCombat(sessionId: String) async throws -> (rewards: CombatRewards?, message: String) {
        retreatCombatCallCount += 1
        lastRetreatSessionId = sessionId

        if retreatCombatDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(retreatCombatDelayMs * 1_000_000))
        }

        if shouldFailRetreatCombat {
            throw AppError.serverError(400, "Cannot retreat from combat")
        }

        // Partial rewards for retreating
        let partialRewards = CombatRewards.testData(
            goldEarned: Int.random(in: 5...15),
            experienceEarned: Int.random(in: 10...25),
            itemsDropped: [],
            materialsDropped: []
        )

        return (rewards: partialRewards, message: "You retreated from combat safely.")
    }

    // MARK: - Test Helpers

    func reset() {
        shouldFailInitiateCombat = false
        shouldFailPerformAttack = false
        shouldFailPerformDefense = false
        shouldFailCompleteCombat = false
        shouldFailFetchCombatSession = false
        shouldFailRetreatCombat = false
        initiateCombatDelayMs = 0
        performAttackDelayMs = 0
        performDefenseDelayMs = 0
        completeCombatDelayMs = 0
        fetchCombatSessionDelayMs = 0
        retreatCombatDelayMs = 0
        initiateCombatCallCount = 0
        performAttackCallCount = 0
        performDefenseCallCount = 0
        completeCombatCallCount = 0
        fetchCombatSessionCallCount = 0
        retreatCombatCallCount = 0
        lastInitiatedCombatParams = nil
        lastAttackParams = nil
        lastDefenseParams = nil
        lastCompleteCombatParams = nil
        lastFetchedSessionId = nil
        lastRetreatSessionId = nil
        playerHp = 100.0
        enemyHp = 80.0
        turnNumber = 1
        mockCombatSession = CombatSession.testData()
        mockCombatAction = CombatAction.testData()
        mockCombatRewards = CombatRewards.testData()
    }
}

// MARK: - Test Data Extensions

extension CombatSession {
    static func testData(
        sessionId: String = "session_123",
        playerId: String = "player_123",
        enemyId: String = "enemy_456",
        turnNumber: Int = 1,
        currentTurnOwner: String = "player",
        status: CombatStatus = .active,
        enemy: Enemy = Enemy.testData(),
        playerStats: ItemStats = ItemStats.testData(),
        playerHp: Double? = 100.0,
        enemyHp: Double? = 80.0,
        expiresAt: String? = nil
    ) -> CombatSession {
        return CombatSession(
            sessionId: sessionId,
            playerId: playerId,
            enemyId: enemyId,
            turnNumber: turnNumber,
            currentTurnOwner: currentTurnOwner,
            status: status,
            enemy: enemy,
            playerStats: playerStats,
            playerHp: playerHp,
            enemyHp: enemyHp,
            expiresAt: expiresAt
        )
    }
}

extension Enemy {
    static func testData(
        id: String? = "enemy_123",
        name: String? = "Forest Goblin",
        level: Int = 5,
        stats: ItemStats = ItemStats.testData(),
        specialAbilities: [String] = ["quick_strike"],
        goldMin: Int = 20,
        goldMax: Int = 50,
        materialDropPool: [String] = ["leather", "bone"]
    ) -> Enemy {
        return Enemy(
            id: id,
            name: name,
            level: level,
            stats: stats,
            specialAbilities: specialAbilities,
            goldMin: goldMin,
            goldMax: goldMax,
            materialDropPool: materialDropPool
        )
    }
}

extension CombatAction {
    static func testData(
        type: CombatActionType = .attack,
        performerId: String = "player",
        damageDealt: Double? = 15.0,
        result: String? = "Hit for 15 damage"
    ) -> CombatAction {
        return CombatAction(
            type: type,
            performerId: performerId,
            damageDealt: damageDealt,
            result: result
        )
    }
}

extension CombatRewards {
    static func testData(
        goldEarned: Int = 75,
        experienceEarned: Int = 150,
        itemsDropped: [EnhancedPlayerItem] = [],
        materialsDropped: [MaterialDrop] = []
    ) -> CombatRewards {
        return CombatRewards(
            goldEarned: goldEarned,
            experienceEarned: experienceEarned,
            itemsDropped: itemsDropped,
            materialsDropped: materialsDropped
        )
    }
}

extension MaterialDrop {
    static func testData(
        materialId: String = "material_123",
        name: String = "Goblin Hide",
        styleId: String = "style_1",
        quantity: Int? = 2
    ) -> MaterialDrop {
        return MaterialDrop(
            materialId: materialId,
            name: name,
            styleId: styleId,
            quantity: quantity
        )
    }
}