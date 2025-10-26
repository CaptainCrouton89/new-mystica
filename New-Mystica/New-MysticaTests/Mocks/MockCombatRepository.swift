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
    var shouldFailGetUserActiveSession = false
    var shouldFailAbandonCombat = false
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
    var getUserActiveSessionCallCount = 0
    var abandonCombatCallCount = 0
    var lastInitiatedCombatParams: (locationId: String, selectedLevel: Int)?
    var lastAttackParams: (sessionId: String, tapPositionDegrees: Float)?
    var lastDefenseParams: (sessionId: String, tapPositionDegrees: Float)?
    var lastCompleteCombatParams: (sessionId: String, won: Bool)?
    var lastFetchedSessionId: String?
    var lastRetreatSessionId: String?
    var lastAbandonSessionId: String?
    var mockActiveSession: CombatSession?

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

    func performAttack(sessionId: String, tapPositionDegrees: Float) async throws -> CombatAction {
        performAttackCallCount += 1
        lastAttackParams = (sessionId: sessionId, tapPositionDegrees: tapPositionDegrees)

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
            result: enemyHp <= 0 ? "Enemy defeated!" : "Attack successful",
            playerHpRemaining: playerHp,
            enemyHpRemaining: enemyHp,
            combatStatus: enemyHp <= 0 ? .victory : .ongoing
        )

        return mockCombatAction
    }

    func performDefense(sessionId: String, tapPositionDegrees: Float) async throws -> CombatAction {
        performDefenseCallCount += 1
        lastDefenseParams = (sessionId: sessionId, tapPositionDegrees: tapPositionDegrees)

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
            damageDealt: nil,
            result: playerHp <= 0 ? "Player defeated!" : "Defense successful",
            damageBlocked: damageReduction,
            playerHpRemaining: playerHp,
            enemyHpRemaining: enemyHp,
            combatStatus: playerHp <= 0 ? .defeat : .ongoing
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
            result: won ? "victory" : "defeat",
            goldEarned: goldEarned,
            experienceEarned: experienceEarned
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
            result: "defeat",
            goldEarned: Int.random(in: 5...15),
            experienceEarned: Int.random(in: 10...25)
        )

        return (rewards: partialRewards, message: "You retreated from combat safely.")
    }

    func getUserActiveSession() async throws -> CombatSession? {
        getUserActiveSessionCallCount += 1

        if shouldFailGetUserActiveSession {
            throw AppError.serverError(500, "Failed to get active session")
        }

        return mockActiveSession
    }

    func abandonCombat(sessionId: String) async throws {
        abandonCombatCallCount += 1
        lastAbandonSessionId = sessionId

        if shouldFailAbandonCombat {
            throw AppError.serverError(400, "Cannot abandon combat")
        }

        // Clear the mock active session
        mockActiveSession = nil
    }

    // MARK: - Test Helpers

    func reset() {
        shouldFailInitiateCombat = false
        shouldFailPerformAttack = false
        shouldFailPerformDefense = false
        shouldFailCompleteCombat = false
        shouldFailFetchCombatSession = false
        shouldFailRetreatCombat = false
        shouldFailGetUserActiveSession = false
        shouldFailAbandonCombat = false
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
        getUserActiveSessionCallCount = 0
        abandonCombatCallCount = 0
        lastInitiatedCombatParams = nil
        lastAttackParams = nil
        lastDefenseParams = nil
        lastCompleteCombatParams = nil
        lastFetchedSessionId = nil
        lastRetreatSessionId = nil
        lastAbandonSessionId = nil
        mockActiveSession = nil
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
        result: String? = "Hit for 15 damage",
        hitZone: String? = "body",
        damageBlocked: Double? = nil,
        playerHpRemaining: Double? = 85.0,
        enemyHpRemaining: Double? = 65.0,
        combatStatus: CombatStatus = .ongoing,
        turnNumber: Int? = 1,
        rewards: CombatRewards? = nil
    ) -> CombatAction {
        // Explicit null handling with clear intent
        let jsonString = """
        {
            "type": "\(type.rawValue)",
            "performer_id": "\(performerId)",
            "damage_dealt": \(damageDealt.flatMap { String($0) }.jsonRepresentation),
            "result": \(result.jsonRepresentation),
            "hit_zone": \(hitZone.jsonRepresentation),
            "damage_blocked": \(damageBlocked.flatMap { String($0) }.jsonRepresentation),
            "player_hp_remaining": \(playerHpRemaining.flatMap { String($0) }.jsonRepresentation),
            "enemy_hp_remaining": \(enemyHpRemaining.flatMap { String($0) }.jsonRepresentation),
            "combat_status": "\(combatStatus.rawValue)",
            "turn_number": \(turnNumber.flatMap { String($0) }.jsonRepresentation),
            "rewards": null
        }
        """
        return try! JSONDecoder().decode(CombatAction.self, from: jsonString.data(using: .utf8)!)
    }

    // Extension to provide consistent JSON representation for optionals
    private extension Optional {
        func jsonRepresentation<T: CustomStringConvertible>(
            stringConverter: (T) -> String = { String(describing: $0) },
            stringFormatter: ((String) -> String)? = nil
        ) -> String {
            guard let value = self as? T else {
                return "null"
            }

            let stringValue = stringConverter(value)
            return stringFormatter?(stringValue) ?? stringValue
        }

        // Specific method for string optionals with quotes
        func jsonStringRepresentation() -> String {
            return jsonRepresentation(
                stringConverter: { $0 },
                stringFormatter: { "\"\($0)\"" }
            )
        }

        // Specific method for numeric optionals
        func jsonNumericRepresentation() -> String {
            return jsonRepresentation()
        }
    }

    // Convenience methods for JSON serialization
    private extension Optional where Wrapped == String {
        var jsonRepresentation: String {
            return jsonStringRepresentation()
        }
    }

    private extension Optional where Wrapped: Numeric {
        var jsonRepresentation: String {
            return jsonNumericRepresentation()
        }
    }
}

extension CombatRewards {
    static func testData(
        result: String = "victory",
        goldEarned: Int = 75,
        experienceEarned: Int? = 150,
        itemsDropped: [ItemDrop]? = nil,
        materialsDropped: [MaterialDrop]? = nil
    ) -> CombatRewards {
        let json = """
        {
            "result": "\(result)",
            "currencies": { "gold": \(goldEarned) },
            "items": \(itemsDropped != nil ? "[]" : "null"),
            "materials": \(materialsDropped != nil ? "[]" : "null"),
            "experience": \(experienceEarned != nil ? "\(experienceEarned!)" : "null"),
            "combat_history": {
                "location_id": "test_location",
                "total_attempts": 1,
                "victories": 1,
                "defeats": 0,
                "current_streak": 1,
                "longest_streak": 1
            }
        }
        """
        return try! JSONDecoder().decode(CombatRewards.self, from: json.data(using: .utf8)!)
    }
}

extension MaterialDrop {
    static func testData(
        materialId: String = "material_123",
        name: String = "Goblin Hide",
        styleId: String = "style_1",
        styleName: String = "Dark Style",
        imageUrl: String? = "https://example.com/goblin_hide.png"
    ) -> MaterialDrop {
        let json = """
        {
            "material_id": "\(materialId)",
            "name": "\(name)",
            "style_id": "\(styleId)",
            "display_name": "\(styleName)",
            "image_url": \(imageUrl != nil ? "\"\(imageUrl!)\"" : "null")
        }
        """
        return try! JSONDecoder().decode(MaterialDrop.self, from: json.data(using: .utf8)!)
    }
}