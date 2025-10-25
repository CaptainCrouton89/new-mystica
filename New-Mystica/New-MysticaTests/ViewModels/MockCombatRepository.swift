import Foundation
@testable import New_Mystica

class MockCombatRepository: CombatRepository {
    // Mocked data and method call tracking
    var mockCombatSession: CombatSession?
    var mockCombatAction: CombatAction?
    var mockCombatRewards: CombatRewards?
    var mockDialogueResponse: DialogueResponse?
    var mockDialogueResponses: [DialogueResponse] = []

    // Call counters
    var initiateCombatCallCount = 0
    var lastInitiatedCombatParams: (locationId: String, selectedLevel: Int)?
    var performAttackCallCount = 0
    var lastAttackParams: (sessionId: String, tapPositionDegrees: Float)?
    var performDefenseCallCount = 0
    var lastDefenseParams: (sessionId: String, tapPositionDegrees: Float)?
    var fetchCombatSessionCallCount = 0
    var completeCombatCallCount = 0
    var lastCompleteCombatParams: (sessionId: String, won: Bool)?
    var abandonCombatCallCount = 0
    var fetchChatterCallCount = 0
    var lastChatterParams: (sessionId: String, eventType: String, eventDetails: CombatEventDetails)?

    // Error simulation flags
    var shouldFailInitiateCombat = false
    var shouldFailPerformAttack = false
    var shouldFailPerformDefense = false
    var shouldFailCompleteCombat = false
    var shouldFailFetchChatter = false

    // Delay simulation
    var initiateCombatDelayMs: UInt64 = 0
    var performAttackDelayMs: UInt64 = 0
    var performDefenseDelayMs: UInt64 = 0

    func initiateCombat(locationId: String, selectedLevel: Int) async throws -> CombatSession {
        initiateCombatCallCount += 1
        lastInitiatedCombatParams = (locationId, selectedLevel)

        if shouldFailInitiateCombat {
            throw AppError.networkError(URLError(.timedOut))
        }

        try? await Task.sleep(nanoseconds: initiateCombatDelayMs * 1_000_000)

        return mockCombatSession ?? CombatSessionBuilder.balanced().build()
    }

    func getUserActiveSession() async throws -> CombatSession? {
        // Implement if needed for tests
        return nil
    }

    func performAttack(sessionId: String, tapPositionDegrees: Float) async throws -> CombatAction {
        performAttackCallCount += 1
        lastAttackParams = (sessionId, tapPositionDegrees)

        if shouldFailPerformAttack {
            throw AppError.serverError(500, "Attack failed")
        }

        try? await Task.sleep(nanoseconds: performAttackDelayMs * 1_000_000)

        return mockCombatAction ?? CombatAction.testData(type: .attack)
    }

    func performDefense(sessionId: String, tapPositionDegrees: Float) async throws -> CombatAction {
        performDefenseCallCount += 1
        lastDefenseParams = (sessionId, tapPositionDegrees)

        if shouldFailPerformDefense {
            throw AppError.serverError(500, "Defense failed")
        }

        try? await Task.sleep(nanoseconds: performDefenseDelayMs * 1_000_000)

        return mockCombatAction ?? CombatAction.testData(type: .defend)
    }

    func fetchCombatSession(sessionId: String) async throws -> CombatSession {
        fetchCombatSessionCallCount += 1
        return mockCombatSession ?? CombatSessionBuilder.balanced().build()
    }

    func completeCombat(sessionId: String, won: Bool) async throws -> CombatRewards {
        completeCombatCallCount += 1
        lastCompleteCombatParams = (sessionId, won)

        if shouldFailCompleteCombat {
            throw AppError.networkError(URLError(.timedOut))
        }

        return mockCombatRewards ?? CombatRewards.testData()
    }

    func abandonCombat(sessionId: String) async throws {
        abandonCombatCallCount += 1
    }

    func fetchEnemyChatter(
        sessionId: String,
        eventType: String,
        eventDetails: CombatEventDetails
    ) async throws -> DialogueResponse {
        fetchChatterCallCount += 1
        lastChatterParams = (sessionId, eventType, eventDetails)

        if shouldFailFetchChatter {
            throw AppError.serverError(500, "Chatter fetch failed")
        }

        // If multiple responses are set, use them in order
        guard !mockDialogueResponses.isEmpty else {
            guard let singleResponse = mockDialogueResponse else {
                // Explicitly fail if no mock responses are configured
                throw AppError.testError("No mock DialogueResponse configured")
            }
            return singleResponse
        }

        return mockDialogueResponses.removeFirst()
    }
}