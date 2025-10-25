import XCTest
@testable import New_Mystica

// Commentary-specific tests for CombatViewModel
extension CombatViewModelTests {

    // MARK: - Dialogue Fetch Tests

    func testFetchCommentary_Success() async {
        // Given
        let session = CombatSessionBuilder.balanced().build()
        let mockDialogueResponse = DialogueResponse(
            dialogue: "Test commentary text",
            dialogueTone: .neutral
        )

        mockRepository.mockDialogueResponse = mockDialogueResponse
        viewModel.combatState = .loaded(session)

        // Simulate a combat action to set up context
        let mockAction = CombatAction.testData(
            didPlayerHit: true,
            didEnemyHit: false,
            turnNumber: 1,
            playerHpRemaining: 75.0,
            enemyHpRemaining: 50.0
        )
        viewModel.turnHistory = [mockAction]

        // When
        do {
            try await viewModel.fetchCommentary()

            // Then
            XCTAssertEqual(viewModel.currentDialogue?.text, "Test commentary text")
            XCTAssertEqual(viewModel.currentDialogue?.tone, .neutral)
            XCTAssertFalse(viewModel.isGeneratingDialogue)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testFetchCommentary_Failure() async {
        // Given
        let session = CombatSessionBuilder.balanced().build()
        viewModel.combatState = .loaded(session)

        // Simulate a combat action to set up context
        let mockAction = CombatAction.testData(
            didPlayerHit: true,
            didEnemyHit: false,
            turnNumber: 1,
            playerHpRemaining: 75.0,
            enemyHpRemaining: 50.0
        )
        viewModel.turnHistory = [mockAction]

        // Force repository to fail
        mockRepository.shouldFailFetchChatter = true

        // When
        do {
            try await viewModel.fetchCommentary()
            XCTFail("Expected error to be thrown")
        } catch {
            // Then
            XCTAssertNil(viewModel.currentDialogue)
            XCTAssertFalse(viewModel.isGeneratingDialogue)
        }
    }

    func testEventTypeMapping() async {
        // Test various event types based on combat action results
        let testCases: [(didPlayerHit: Bool?, didEnemyHit: Bool?, isCritical: Bool?, expectedEventType: CombatEventType)] = [
            (didPlayerHit: true, didEnemyHit: false, isCritical: false, expectedEventType: .playerHit),
            (didPlayerHit: false, didEnemyHit: false, isCritical: false, expectedEventType: .playerMiss),
            (didPlayerHit: false, didEnemyHit: true, isCritical: false, expectedEventType: .enemyHit)
        ]

        for (index, testCase) in testCases.enumerated() {
            // Given
            let session = CombatSessionBuilder.balanced().build()
            viewModel.combatState = .loaded(session)

            let mockAction = CombatAction.testData(
                didPlayerHit: testCase.didPlayerHit,
                didEnemyHit: testCase.didEnemyHit,
                isCritical: testCase.isCritical
            )
            viewModel.turnHistory = [mockAction]

            // When
            let mappedEventType = viewModel.determineEventType(from: mockAction)

            // Then
            XCTAssertEqual(mappedEventType, testCase.expectedEventType, "Failed for test case \(index)")
        }
    }

    func testEventDetailsBuilding() async {
        // Given
        let session = CombatSessionBuilder.balanced()
            .withPlayerHp(75.0)
            .withEnemyHp(50.0)
            .withTurnNumber(5)
            .build()
        viewModel.combatState = .loaded(session)

        let mockAction = CombatAction.testData(
            turnNumber: 5,
            damage: 20.0,
            isCritical: true,
            playerHpRemaining: 75.0,
            enemyHpRemaining: 50.0
        )
        viewModel.turnHistory = [mockAction]

        // When
        guard let eventDetails = viewModel.buildEventDetails() else {
            XCTFail("Failed to build event details")
            return
        }

        // Then
        XCTAssertEqual(eventDetails.turnNumber, 5)
        XCTAssertEqual(eventDetails.playerHpPct, 0.75, accuracy: 0.01)
        XCTAssertEqual(eventDetails.enemyHpPct, 0.5, accuracy: 0.01)
        XCTAssertEqual(eventDetails.damage, 20.0)
        XCTAssertTrue(eventDetails.isCritical ?? false)
    }

    func testDialogueAutoDismiss() async {
        // Given
        let session = CombatSessionBuilder.balanced().build()
        let mockDialogueResponse = DialogueResponse(
            dialogue: "Test commentary",
            dialogueTone: .neutral
        )

        mockRepository.mockDialogueResponse = mockDialogueResponse
        viewModel.combatState = .loaded(session)

        // Simulate a combat action to set up context
        let mockAction = CombatAction.testData(
            didPlayerHit: true,
            didEnemyHit: false
        )
        viewModel.turnHistory = [mockAction]

        // Create an expectation for dialogue dismissal
        let expectation = XCTestExpectation(description: "Dialogue auto-dismissed")

        // Adjust the test to run on main queue to handle timer
        await MainActor.run {
            // When
            Task {
                do {
                    try await viewModel.fetchCommentary()

                    // Check initial state
                    XCTAssertNotNil(viewModel.currentDialogue)

                    // Schedule verification of dismissal
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3.5) {
                        XCTAssertNil(viewModel.currentDialogue)
                        expectation.fulfill()
                    }
                } catch {
                    XCTFail("Unexpected error: \(error)")
                    expectation.fulfill()
                }
            }
        }

        // Wait for the expectation with a reasonable timeout
        await fulfillment(of: [expectation], timeout: 5.0)
    }

    func testCombatStartCommentary() async {
        // Given
        let session = CombatSessionBuilder.balanced().build()
        let mockDialogueResponse = DialogueResponse(
            dialogue: "Let's begin!",
            dialogueTone: .neutral
        )

        mockRepository.mockDialogueResponse = mockDialogueResponse

        // When
        await viewModel.initializeOrResumeCombat(locationId: "test_location")

        // Then
        XCTAssertNotNil(viewModel.currentDialogue)
        XCTAssertEqual(viewModel.currentDialogue?.text, "Let's begin!")
        XCTAssertEqual(viewModel.currentDialogue?.tone, .neutral)
    }

    func testNilDialogueSafety() {
        // Given
        viewModel.currentDialogue = nil

        // When/Then: Simply ensure no crash occurs
        XCTAssertNil(viewModel.currentDialogue)
    }

    func testMultipleRapidDialogues() async {
        // Given
        let session = CombatSessionBuilder.balanced().build()
        let mockDialogueResponses = [
            DialogueResponse(dialogue: "First commentary", dialogueTone: .neutral),
            DialogueResponse(dialogue: "Second commentary", dialogueTone: .aggressive)
        ]

        mockRepository.mockDialogueResponses = mockDialogueResponses
        viewModel.combatState = .loaded(session)

        // Simulate rapid actions
        let action1 = CombatAction.testData(
            didPlayerHit: true,
            didEnemyHit: false,
            turnNumber: 1
        )
        let action2 = CombatAction.testData(
            didPlayerHit: false,
            didEnemyHit: true,
            turnNumber: 2
        )
        viewModel.turnHistory = [action1, action2]

        // When
        do {
            try await viewModel.fetchCommentary() // First commentary
            let firstDialogue = viewModel.currentDialogue

            try await viewModel.fetchCommentary() // Second commentary
            let secondDialogue = viewModel.currentDialogue

            // Then
            XCTAssertNotEqual(firstDialogue?.text, secondDialogue?.text)
            XCTAssertEqual(firstDialogue?.text, "First commentary")
            XCTAssertEqual(secondDialogue?.text, "Second commentary")
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
}