//
//  CombatViewModelTests.swift
//  New-MysticaTests
//
//  Unit tests for CombatViewModel covering combat flow, turn management, and state transitions
//

import XCTest
@testable import New_Mystica

final class CombatViewModelTests: XCTestCase {

    private var mockRepository: MockCombatRepository!
    private var viewModel: CombatViewModel!

    override func setUp() {
        super.setUp()
        mockRepository = MockCombatRepository()
        viewModel = CombatViewModel(repository: mockRepository)
    }

    override func tearDown() {
        mockRepository = nil
        viewModel = nil
        super.tearDown()
    }

    // MARK: - Initialization Tests

    func testInitialization() {
        XCTAssertEqual(viewModel.combatState, .idle)
        XCTAssertEqual(viewModel.rewards, .idle)
        XCTAssertTrue(viewModel.turnHistory.isEmpty)
        XCTAssertNil(viewModel.selectedAction)
        XCTAssertEqual(viewModel.timingScore, 0.0)
    }

    // MARK: - Start Combat Tests

    func testStartCombat_Success() async {
        // Given
        let expectedSession = CombatSessionBuilder.balanced().build()
        mockRepository.mockCombatSession = expectedSession

        // When
        await viewModel.startCombat(locationId: "location123")

        // Then
        XCTAssertEqual(mockRepository.initiateCombatCallCount, 1)
        XCTAssertEqual(mockRepository.lastInitiatedCombatParams?.locationId, "location123")
        XCTAssertEqual(mockRepository.lastInitiatedCombatParams?.selectedLevel, 1)
        XCTAssertEqual(viewModel.rewards, .idle)
        XCTAssertTrue(viewModel.turnHistory.isEmpty)

        if case .loaded(let session) = viewModel.combatState {
            XCTAssertEqual(session.sessionId, expectedSession.sessionId)
        } else {
            XCTFail("Expected combat state to be loaded")
        }
    }

    func testStartCombat_Failure() async {
        // Given
        mockRepository.shouldFailInitiateCombat = true

        // When
        await viewModel.startCombat(locationId: "location123")

        // Then
        XCTAssertEqual(mockRepository.initiateCombatCallCount, 1)
        if case .error(let error) = viewModel.combatState {
            XCTAssertNotNil(error)
        } else {
            XCTFail("Expected combat state to be in error")
        }
    }

    func testStartCombat_LoadingState() async {
        // Given
        mockRepository.initiateCombatDelayMs = 200

        // When
        let task = Task {
            await viewModel.startCombat(locationId: "location123")
        }

        // Check loading state immediately
        try? await Task.sleep(nanoseconds: 10_000_000) // 10ms
        XCTAssertEqual(viewModel.combatState, .loading)

        // Wait for completion
        await task.value

        // Then
        if case .loaded = viewModel.combatState {
            XCTAssert(true)
        } else {
            XCTFail("Expected combat state to be loaded after delay")
        }
    }

    func testStartCombat_ResetsState() async {
        // Given - Set up some existing state
        viewModel.turnHistory = [CombatAction.testData()]
        viewModel.rewards = .loaded(CombatRewards.testData())

        // When
        await viewModel.startCombat(locationId: "location123")

        // Then
        XCTAssertTrue(viewModel.turnHistory.isEmpty)
        XCTAssertEqual(viewModel.rewards, .idle)
    }

    // MARK: - Attack Tests

    func testAttack_Success() async {
        // Given
        let session = CombatSessionBuilder.balanced().asOngoingCombat().build()
        viewModel.combatState = .loaded(session)
        let expectedAction = CombatAction.testData(type: .attack, damageDealt: 20.0)
        mockRepository.mockCombatAction = expectedAction

        // When
        await viewModel.attack(timingScore: 0.8)

        // Then
        XCTAssertEqual(mockRepository.performAttackCallCount, 1)
        XCTAssertEqual(mockRepository.lastAttackParams?.sessionId, session.sessionId)
        XCTAssertEqual(mockRepository.lastAttackParams?.timingScore, 0.8)
        XCTAssertEqual(viewModel.timingScore, 0.8)
        XCTAssertEqual(viewModel.turnHistory.count, 1)
        XCTAssertEqual(viewModel.turnHistory.first?.type, .attack)
        XCTAssertEqual(mockRepository.fetchCombatSessionCallCount, 1) // Refetch after action
    }

    func testAttack_Failure() async {
        // Given
        let session = CombatSessionBuilder.balanced().build()
        viewModel.combatState = .loaded(session)
        mockRepository.shouldFailPerformAttack = true

        // When
        await viewModel.attack(timingScore: 0.5)

        // Then
        XCTAssertEqual(mockRepository.performAttackCallCount, 1)
        if case .error = viewModel.combatState {
            XCTAssert(true)
        } else {
            XCTFail("Expected combat state to be in error after failed attack")
        }
    }

    func testAttack_WhenNotInCombat() async {
        // Given - No active combat session
        XCTAssertEqual(viewModel.combatState, .idle)

        // When
        await viewModel.attack(timingScore: 0.7)

        // Then
        XCTAssertEqual(mockRepository.performAttackCallCount, 0)
    }

    func testAttack_WhenLoading() async {
        // Given
        viewModel.combatState = .loading

        // When
        await viewModel.attack(timingScore: 0.7)

        // Then
        XCTAssertEqual(mockRepository.performAttackCallCount, 0)
    }

    func testAttack_LoadingStateDuringAction() async {
        // Given
        let session = CombatSessionBuilder.balanced().build()
        viewModel.combatState = .loaded(session)
        mockRepository.performAttackDelayMs = 200

        // When
        let task = Task {
            await viewModel.attack(timingScore: 0.9)
        }

        // Check loading state during attack
        try? await Task.sleep(nanoseconds: 10_000_000) // 10ms
        XCTAssertEqual(viewModel.combatState, .loading)

        // Wait for completion
        await task.value

        // Then
        if case .loaded = viewModel.combatState {
            XCTAssert(true)
        } else {
            XCTFail("Expected combat state to be loaded after attack")
        }
    }

    // MARK: - Defend Tests

    func testDefend_Success() async {
        // Given
        let session = CombatSessionBuilder.balanced().asOngoingCombat().build()
        viewModel.combatState = .loaded(session)
        let expectedAction = CombatAction.testData(type: .defend, damageDealt: 5.0)
        mockRepository.mockCombatAction = expectedAction

        // When
        await viewModel.defend(timingScore: 0.9)

        // Then
        XCTAssertEqual(mockRepository.performDefenseCallCount, 1)
        XCTAssertEqual(mockRepository.lastDefenseParams?.sessionId, session.sessionId)
        XCTAssertEqual(mockRepository.lastDefenseParams?.timingScore, 0.9)
        XCTAssertEqual(viewModel.timingScore, 0.9)
        XCTAssertEqual(viewModel.turnHistory.count, 1)
        XCTAssertEqual(viewModel.turnHistory.first?.type, .defend)
        XCTAssertEqual(mockRepository.fetchCombatSessionCallCount, 1) // Refetch after action
    }

    func testDefend_Failure() async {
        // Given
        let session = CombatSessionBuilder.balanced().build()
        viewModel.combatState = .loaded(session)
        mockRepository.shouldFailPerformDefense = true

        // When
        await viewModel.defend(timingScore: 0.6)

        // Then
        XCTAssertEqual(mockRepository.performDefenseCallCount, 1)
        if case .error = viewModel.combatState {
            XCTAssert(true)
        } else {
            XCTFail("Expected combat state to be in error after failed defense")
        }
    }

    func testDefend_WhenNotInCombat() async {
        // Given - No active combat session
        XCTAssertEqual(viewModel.combatState, .idle)

        // When
        await viewModel.defend(timingScore: 0.8)

        // Then
        XCTAssertEqual(mockRepository.performDefenseCallCount, 0)
    }

    // MARK: - Combat End Tests

    func testEndCombat_PlayerWins() async {
        // Given
        let session = CombatSessionBuilder.balanced().asPlayerVictory().build()
        viewModel.combatState = .loaded(session)
        let expectedRewards = CombatRewards.testData(goldEarned: 100, experienceEarned: 200)
        mockRepository.mockCombatRewards = expectedRewards

        // When
        await viewModel.endCombat(won: true)

        // Then
        XCTAssertEqual(mockRepository.completeCombatCallCount, 1)
        XCTAssertEqual(mockRepository.lastCompleteCombatParams?.sessionId, session.sessionId)
        XCTAssertEqual(mockRepository.lastCompleteCombatParams?.won, true)

        if case .loaded(let rewards) = viewModel.rewards {
            XCTAssertEqual(rewards.goldEarned, 100)
            XCTAssertEqual(rewards.experienceEarned, 200)
        } else {
            XCTFail("Expected rewards to be loaded")
        }
    }

    func testEndCombat_PlayerLoses() async {
        // Given
        let session = CombatSessionBuilder.balanced().asPlayerDefeat().build()
        viewModel.combatState = .loaded(session)
        let expectedRewards = CombatRewards.testData(goldEarned: 25, experienceEarned: 50)
        mockRepository.mockCombatRewards = expectedRewards

        // When
        await viewModel.endCombat(won: false)

        // Then
        XCTAssertEqual(mockRepository.completeCombatCallCount, 1)
        XCTAssertEqual(mockRepository.lastCompleteCombatParams?.won, false)

        if case .loaded(let rewards) = viewModel.rewards {
            XCTAssertEqual(rewards.goldEarned, 25)
            XCTAssertEqual(rewards.experienceEarned, 50)
        } else {
            XCTFail("Expected rewards to be loaded")
        }
    }

    func testEndCombat_Failure() async {
        // Given
        let session = CombatSessionBuilder.balanced().build()
        viewModel.combatState = .loaded(session)
        mockRepository.shouldFailCompleteCombat = true

        // When
        await viewModel.endCombat(won: true)

        // Then
        XCTAssertEqual(mockRepository.completeCombatCallCount, 1)
        if case .error = viewModel.rewards {
            XCTAssert(true)
        } else {
            XCTFail("Expected rewards to be in error state")
        }
    }

    // MARK: - Retreat Tests

    func testRetreat() async {
        // Given
        let session = CombatSessionBuilder.balanced().asOngoingCombat().build()
        viewModel.combatState = .loaded(session)

        // When
        await viewModel.retreat()

        // Then
        XCTAssertEqual(mockRepository.completeCombatCallCount, 1)
        XCTAssertEqual(mockRepository.lastCompleteCombatParams?.won, false)
    }

    // MARK: - Claim Rewards Tests

    func testClaimRewards() async {
        // Given
        let rewards = CombatRewards.testData()
        viewModel.rewards = .loaded(rewards)
        let session = CombatSessionBuilder.balanced().build()
        viewModel.combatState = .loaded(session)

        // When
        await viewModel.claimRewards()

        // Then
        XCTAssertEqual(viewModel.rewards, .idle)
        XCTAssertEqual(viewModel.combatState, .idle)
        XCTAssertTrue(viewModel.turnHistory.isEmpty)
        XCTAssertNil(viewModel.selectedAction)
        XCTAssertEqual(viewModel.timingScore, 0.0)
    }

    // MARK: - Reset Combat Tests

    func testResetCombat() {
        // Given - Set up some state
        viewModel.combatState = .loaded(CombatSessionBuilder.balanced().build())
        viewModel.rewards = .loaded(CombatRewards.testData())
        viewModel.turnHistory = [CombatAction.testData()]
        viewModel.selectedAction = .attack
        viewModel.timingScore = 0.8

        // When
        viewModel.resetCombat()

        // Then
        XCTAssertEqual(viewModel.combatState, .idle)
        XCTAssertEqual(viewModel.rewards, .idle)
        XCTAssertTrue(viewModel.turnHistory.isEmpty)
        XCTAssertNil(viewModel.selectedAction)
        XCTAssertEqual(viewModel.timingScore, 0.0)
    }

    // MARK: - Computed Properties Tests

    func testIsInCombat() {
        // Idle state
        XCTAssertFalse(viewModel.isInCombat)

        // Active combat
        let activeSession = CombatSessionBuilder.balanced().asNewCombat().build()
        viewModel.combatState = .loaded(activeSession)
        XCTAssertTrue(viewModel.isInCombat)

        // Ongoing combat
        let ongoingSession = CombatSessionBuilder.balanced().asOngoingCombat().build()
        viewModel.combatState = .loaded(ongoingSession)
        XCTAssertTrue(viewModel.isInCombat)

        // Ended combat
        let endedSession = CombatSessionBuilder.balanced().asPlayerVictory().build()
        viewModel.combatState = .loaded(endedSession)
        XCTAssertFalse(viewModel.isInCombat)

        // Error state
        viewModel.combatState = .error(.networkError(URLError(.timedOut)))
        XCTAssertFalse(viewModel.isInCombat)
    }

    func testCanAct() {
        // Not in combat
        XCTAssertFalse(viewModel.canAct)

        // In combat, not loading
        let activeSession = CombatSessionBuilder.balanced().asNewCombat().build()
        viewModel.combatState = .loaded(activeSession)
        XCTAssertTrue(viewModel.canAct)

        // In combat, but loading
        viewModel.combatState = .loading
        XCTAssertFalse(viewModel.canAct)

        // Rewards loading
        viewModel.combatState = .loaded(activeSession)
        viewModel.rewards = .loading
        XCTAssertFalse(viewModel.canAct)
    }

    func testCombatEnded() {
        // Active combat
        let activeSession = CombatSessionBuilder.balanced().asNewCombat().build()
        viewModel.combatState = .loaded(activeSession)
        XCTAssertFalse(viewModel.combatEnded)

        // Player won
        let victorySession = CombatSessionBuilder.balanced().asPlayerVictory().build()
        viewModel.combatState = .loaded(victorySession)
        XCTAssertTrue(viewModel.combatEnded)

        // Player lost
        let defeatSession = CombatSessionBuilder.balanced().asPlayerDefeat().build()
        viewModel.combatState = .loaded(defeatSession)
        XCTAssertTrue(viewModel.combatEnded)

        // Retreated
        let retreatedSession = CombatSessionBuilder.balanced().asRetreated().build()
        viewModel.combatState = .loaded(retreatedSession)
        XCTAssertTrue(viewModel.combatEnded)
    }

    func testPlayerWon() {
        // Active combat
        let activeSession = CombatSessionBuilder.balanced().asNewCombat().build()
        viewModel.combatState = .loaded(activeSession)
        XCTAssertFalse(viewModel.playerWon)

        // Player victory
        let victorySession = CombatSessionBuilder.balanced().asPlayerVictory().build()
        viewModel.combatState = .loaded(victorySession)
        XCTAssertTrue(viewModel.playerWon)

        // Player defeat
        let defeatSession = CombatSessionBuilder.balanced().asPlayerDefeat().build()
        viewModel.combatState = .loaded(defeatSession)
        XCTAssertFalse(viewModel.playerWon)
    }

    func testCurrentEnemy() {
        // No combat
        XCTAssertNil(viewModel.currentEnemy)

        // Active combat
        let enemy = EnemyBuilder.asOrc().build()
        let session = CombatSessionBuilder.balanced().withEnemy(enemy).build()
        viewModel.combatState = .loaded(session)

        XCTAssertNotNil(viewModel.currentEnemy)
        XCTAssertEqual(viewModel.currentEnemy?.name, enemy.name)
        XCTAssertEqual(viewModel.currentEnemy?.level, enemy.level)
    }

    func testHPValues() {
        // No combat
        XCTAssertEqual(viewModel.currentHP, 0)
        XCTAssertEqual(viewModel.enemyHP, 0)

        // Active combat with HP values
        let session = CombatSessionBuilder.balanced()
            .withPlayerHp(75.0)
            .withEnemyHp(45.0)
            .build()
        viewModel.combatState = .loaded(session)

        XCTAssertEqual(viewModel.currentHP, 75)
        XCTAssertEqual(viewModel.enemyHP, 45)
    }

    func testHPPercentages() {
        // Create a session with known stats for HP calculation
        let playerStats = ItemStats(atkPower: 10, atkAccuracy: 80, defPower: 10, defAccuracy: 75) // Max HP = 100
        let enemyStats = ItemStats(atkPower: 8, atkAccuracy: 70, defPower: 8, defAccuracy: 70) // Max HP = 80
        let enemy = EnemyBuilder().withStats(enemyStats).build()
        let session = CombatSessionBuilder.balanced()
            .withPlayerStats(playerStats)
            .withEnemy(enemy)
            .withPlayerHp(75.0) // 75% of max
            .withEnemyHp(40.0)  // 50% of max
            .build()
        viewModel.combatState = .loaded(session)

        XCTAssertEqual(viewModel.playerHPPercentage, 0.75, accuracy: 0.01)
        XCTAssertEqual(viewModel.enemyHPPercentage, 0.5, accuracy: 0.01)
    }

    func testTurnNumber() {
        // No combat
        XCTAssertEqual(viewModel.turnNumber, 0)

        // Active combat
        let session = CombatSessionBuilder.balanced()
            .withTurnNumber(8)
            .build()
        viewModel.combatState = .loaded(session)

        XCTAssertEqual(viewModel.turnNumber, 8)
    }

    func testRecentActions() {
        // Add many actions to history
        let actions = (1...10).map { i in
            CombatAction.testData(performerId: "player", result: "Action \(i)")
        }
        viewModel.turnHistory = actions

        // Should return last 5 actions
        let recentActions = viewModel.recentActions
        XCTAssertEqual(recentActions.count, 5)
        XCTAssertEqual(recentActions.last?.result, "Action 10")
        XCTAssertEqual(recentActions.first?.result, "Action 6")
    }

    func testIsLoading() {
        // Neither loading
        XCTAssertFalse(viewModel.isLoading)

        // Combat loading
        viewModel.combatState = .loading
        XCTAssertTrue(viewModel.isLoading)

        // Rewards loading
        viewModel.combatState = .idle
        viewModel.rewards = .loading
        XCTAssertTrue(viewModel.isLoading)

        // Both loading
        viewModel.combatState = .loading
        viewModel.rewards = .loading
        XCTAssertTrue(viewModel.isLoading)
    }

    // MARK: - Combat Flow Integration Tests

    func testFullCombatFlow_PlayerWins() async {
        // Start combat
        await viewModel.startCombat(locationId: "forest_location")
        XCTAssertTrue(viewModel.isInCombat)

        // Perform several attacks
        await viewModel.attack(timingScore: 0.8)
        await viewModel.attack(timingScore: 0.9)
        await viewModel.defend(timingScore: 0.7)

        XCTAssertEqual(viewModel.turnHistory.count, 3)
        XCTAssertEqual(mockRepository.performAttackCallCount, 2)
        XCTAssertEqual(mockRepository.performDefenseCallCount, 1)

        // End combat as winner
        await viewModel.endCombat(won: true)

        if case .loaded(let rewards) = viewModel.rewards {
            XCTAssertGreaterThan(rewards.goldEarned, 0)
            XCTAssertGreaterThan(rewards.experienceEarned, 0)
        } else {
            XCTFail("Expected rewards to be loaded")
        }

        // Claim rewards
        await viewModel.claimRewards()
        XCTAssertEqual(viewModel.combatState, .idle)
        XCTAssertEqual(viewModel.rewards, .idle)
    }

    func testCombatFlow_EarlyRetreat() async {
        // Start combat
        await viewModel.startCombat(locationId: "dangerous_location")

        // Perform one action then retreat
        await viewModel.attack(timingScore: 0.5)
        await viewModel.retreat()

        XCTAssertEqual(mockRepository.completeCombatCallCount, 1)
        XCTAssertEqual(mockRepository.lastCompleteCombatParams?.won, false)
    }

    func testCombatFlow_ResetDuringCombat() async {
        // Start combat and perform actions
        await viewModel.startCombat(locationId: "location")
        await viewModel.attack(timingScore: 0.7)

        XCTAssertTrue(viewModel.isInCombat)
        XCTAssertFalse(viewModel.turnHistory.isEmpty)

        // Reset combat
        viewModel.resetCombat()

        XCTAssertFalse(viewModel.isInCombat)
        XCTAssertTrue(viewModel.turnHistory.isEmpty)
        XCTAssertEqual(viewModel.combatState, .idle)
    }

    // MARK: - Error Handling Tests

    func testErrorHandling_CombatActionDuringError() async {
        // Set combat to error state
        viewModel.combatState = .error(.serverError(500, "Server error"))

        // Try to perform actions
        await viewModel.attack(timingScore: 0.8)
        await viewModel.defend(timingScore: 0.9)

        // No repository calls should be made
        XCTAssertEqual(mockRepository.performAttackCallCount, 0)
        XCTAssertEqual(mockRepository.performDefenseCallCount, 0)
    }

    func testErrorRecovery_RestartAfterError() async {
        // Initial combat fails
        mockRepository.shouldFailInitiateCombat = true
        await viewModel.startCombat(locationId: "location")

        if case .error = viewModel.combatState {
            XCTAssert(true)
        } else {
            XCTFail("Expected error state")
        }

        // Fix error and retry
        mockRepository.shouldFailInitiateCombat = false
        await viewModel.startCombat(locationId: "location")

        if case .loaded = viewModel.combatState {
            XCTAssert(true)
        } else {
            XCTFail("Expected combat to start successfully after error recovery")
        }
    }
}