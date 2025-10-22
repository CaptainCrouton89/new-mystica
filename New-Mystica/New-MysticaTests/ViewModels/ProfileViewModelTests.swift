//
//  ProfileViewModelTests.swift
//  New-MysticaTests
//
//  Unit tests for ProfileViewModel
//

import XCTest
@testable import New_Mystica

final class ProfileViewModelTests: XCTestCase {
    var viewModel: ProfileViewModel!
    var mockRepository: MockProfileRepository!
    var appState: AppState!

    override func setUp() {
        super.setUp()
        mockRepository = MockProfileRepository()
        appState = AppState()
        viewModel = ProfileViewModel(
            repository: mockRepository,
            appState: appState
        )
    }

    override func tearDown() {
        viewModel = nil
        mockRepository = nil
        appState = nil
        super.tearDown()
    }

    // MARK: - Profile Loading Tests

    func testLoadProfileSuccess() async {
        // Arrange
        let expectedProfile = EnhancedUserProfile.testData(username: "TestUser", gold: 500)
        mockRepository.mockProfile = expectedProfile

        // Act
        await viewModel.loadProfile()

        // Assert
        XCTAssertEqual(mockRepository.fetchProfileCallCount, 1)

        if case .loaded(let profile) = appState.userProfile {
            XCTAssertEqual(profile.username, "TestUser")
            XCTAssertEqual(profile.gold, 500)
        } else {
            XCTFail("Expected loaded profile state")
        }
    }

    func testLoadProfileFailure() async {
        // Arrange
        mockRepository.shouldFailFetchProfile = true

        // Act
        await viewModel.loadProfile()

        // Assert
        XCTAssertEqual(mockRepository.fetchProfileCallCount, 1)

        if case .error(let error) = appState.userProfile {
            XCTAssertNotNil(error)
        } else {
            XCTFail("Expected error state")
        }
    }

    func testLoadProfileWithDelay() async {
        // Arrange
        mockRepository.fetchProfileDelayMs = 100

        // Act
        let startTime = Date()
        await viewModel.loadProfile()
        let endTime = Date()

        // Assert
        let elapsedTime = endTime.timeIntervalSince(startTime)
        XCTAssertGreaterThanOrEqual(elapsedTime, 0.1, "Should respect delay")

        if case .loaded = appState.userProfile {
            // Success
        } else {
            XCTFail("Expected loaded state after delay")
        }
    }

    // MARK: - Progression Loading Tests

    func testLoadProgressionSuccess() async {
        // Arrange
        let expectedProgression = PlayerProgression.testData(level: 10, experience: 850)
        mockRepository.mockProgression = expectedProgression

        // Act
        await viewModel.loadProgression()

        // Assert
        XCTAssertEqual(mockRepository.fetchProgressionCallCount, 1)

        if case .loaded(let progression) = viewModel.progression {
            XCTAssertEqual(progression.level, 10)
            XCTAssertEqual(progression.experience, 850)
        } else {
            XCTFail("Expected loaded progression state")
        }
    }

    func testLoadProgressionFailure() async {
        // Arrange
        mockRepository.shouldFailFetchProgression = true

        // Act
        await viewModel.loadProgression()

        // Assert
        XCTAssertEqual(mockRepository.fetchProgressionCallCount, 1)

        if case .error(let error) = viewModel.progression {
            XCTAssertNotNil(error)
        } else {
            XCTFail("Expected error state")
        }
    }

    // MARK: - Reward Claiming Tests

    func testClaimRewardSuccess() async {
        // Arrange
        let rewardId = "level_5"
        let initialProgression = PlayerProgression.testData(
            level: 5,
            unclaimedRewards: [LevelReward.testData(level: 5, rewardGold: 100)]
        )
        mockRepository.mockProgression = initialProgression

        // Load initial progression
        await viewModel.loadProgression()

        // Act
        await viewModel.claimReward(rewardId: rewardId)

        // Assert
        XCTAssertEqual(mockRepository.claimRewardCallCount, 1)
        XCTAssertEqual(mockRepository.lastClaimedRewardId, rewardId)
        XCTAssertEqual(mockRepository.fetchProgressionCallCount, 2) // Initial + refresh
        XCTAssertEqual(mockRepository.fetchProfileCallCount, 1) // Refresh after claim
    }

    func testClaimRewardFailure() async {
        // Arrange
        mockRepository.shouldFailClaimReward = true

        // Act
        await viewModel.claimReward(rewardId: "level_5")

        // Assert
        XCTAssertEqual(mockRepository.claimRewardCallCount, 1)

        if case .error(let error) = viewModel.progression {
            XCTAssertNotNil(error)
        } else {
            XCTFail("Expected error state after failed claim")
        }
    }

    func testClaimRewardPreventsDuplicateCalls() async {
        // Arrange
        mockRepository.claimRewardDelayMs = 100

        // Act - Start two concurrent claim calls
        async let claim1 = viewModel.claimReward(rewardId: "level_1")
        async let claim2 = viewModel.claimReward(rewardId: "level_2")

        await claim1
        await claim2

        // Assert - Only one call should have been made
        XCTAssertEqual(mockRepository.claimRewardCallCount, 1)
    }

    // MARK: - Load All Tests

    func testLoadAllSuccess() async {
        // Arrange
        let expectedProfile = EnhancedUserProfile.testData(username: "TestUser")
        let expectedProgression = PlayerProgression.testData(level: 8)
        mockRepository.mockProfile = expectedProfile
        mockRepository.mockProgression = expectedProgression

        // Act
        await viewModel.loadAll()

        // Assert
        XCTAssertEqual(mockRepository.fetchProfileCallCount, 1)
        XCTAssertEqual(mockRepository.fetchProgressionCallCount, 1)

        // Verify both states are loaded
        if case .loaded(let profile) = appState.userProfile {
            XCTAssertEqual(profile.username, "TestUser")
        } else {
            XCTFail("Expected loaded profile state")
        }

        if case .loaded(let progression) = viewModel.progression {
            XCTAssertEqual(progression.level, 8)
        } else {
            XCTFail("Expected loaded progression state")
        }
    }

    // MARK: - Computed Properties Tests

    func testComputedPropertiesWithLoadedProgression() async {
        // Arrange
        let progression = PlayerProgression.testData(
            level: 15,
            experience: 1350,
            prestigePoints: 50,
            xpToNextLevel: 150,
            unclaimedRewards: [
                LevelReward.testData(level: 14, rewardGold: 75),
                LevelReward.testData(level: 15, rewardGold: 100)
            ]
        )
        mockRepository.mockProgression = progression
        await viewModel.loadProgression()

        // Assert
        XCTAssertEqual(viewModel.currentLevel, 15)
        XCTAssertEqual(viewModel.currentExperience, 1350)
        XCTAssertEqual(viewModel.experienceToNextLevel, 150)
        XCTAssertEqual(viewModel.prestigePoints, 50)
        XCTAssertEqual(viewModel.unclaimedRewards.count, 2)
        XCTAssertTrue(viewModel.hasUnclaimedRewards)

        // Test progress calculation
        let expectedProgress = Double(1350) / Double(1350 + 150)
        XCTAssertEqual(viewModel.progressToNextLevel, expectedProgress, accuracy: 0.001)
    }

    func testComputedPropertiesWithoutProgression() {
        // Assert default values when no progression is loaded
        XCTAssertEqual(viewModel.currentLevel, 1)
        XCTAssertEqual(viewModel.currentExperience, 0)
        XCTAssertEqual(viewModel.experienceToNextLevel, 100)
        XCTAssertEqual(viewModel.prestigePoints, 0)
        XCTAssertEqual(viewModel.unclaimedRewards.count, 0)
        XCTAssertFalse(viewModel.hasUnclaimedRewards)
        XCTAssertEqual(viewModel.progressToNextLevel, 0.0)
    }

    func testProfileComputedPropertiesWithLoadedProfile() async {
        // Arrange
        let profile = EnhancedUserProfile.testData(
            username: "PlayerOne",
            vanityLevel: 12,
            totalStats: ItemStats.testData(atkPower: 100.0, defPower: 80.0)
        )
        mockRepository.mockProfile = profile
        await viewModel.loadProfile()

        // Assert
        XCTAssertEqual(viewModel.username, "PlayerOne")
        XCTAssertEqual(viewModel.vanityLevel, 12)
        XCTAssertNotNil(viewModel.totalStats)
        XCTAssertEqual(viewModel.totalStats?.atkPower, 100.0)
        XCTAssertEqual(viewModel.totalStats?.defPower, 80.0)
    }

    func testProfileComputedPropertiesWithoutProfile() {
        // Assert default values when no profile is loaded
        XCTAssertNil(viewModel.username)
        XCTAssertEqual(viewModel.vanityLevel, 1)
        XCTAssertEqual(viewModel.accountType, .anonymous)
        XCTAssertNil(viewModel.totalStats)
    }

    // MARK: - State Check Tests

    func testStateChecks() async {
        // Initial state
        XCTAssertFalse(viewModel.isProfileLoaded)
        XCTAssertFalse(viewModel.isProgressionLoaded)
        XCTAssertFalse(viewModel.isFullyLoaded)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertFalse(viewModel.hasError)

        // Load profile
        await viewModel.loadProfile()
        XCTAssertTrue(viewModel.isProfileLoaded)
        XCTAssertFalse(viewModel.isProgressionLoaded)
        XCTAssertFalse(viewModel.isFullyLoaded)

        // Load progression
        await viewModel.loadProgression()
        XCTAssertTrue(viewModel.isProfileLoaded)
        XCTAssertTrue(viewModel.isProgressionLoaded)
        XCTAssertTrue(viewModel.isFullyLoaded)
    }

    func testErrorStates() async {
        // Test profile error
        mockRepository.shouldFailFetchProfile = true
        await viewModel.loadProfile()
        XCTAssertTrue(viewModel.hasError)

        // Reset and test progression error
        mockRepository.reset()
        mockRepository.shouldFailFetchProgression = true
        await viewModel.loadProgression()
        XCTAssertTrue(viewModel.hasError)
    }

    // MARK: - UI State Tests

    func testRewardClaimUIState() {
        XCTAssertFalse(viewModel.showingRewardClaim)

        viewModel.showRewardClaim()
        XCTAssertTrue(viewModel.showingRewardClaim)

        viewModel.hideRewardClaim()
        XCTAssertFalse(viewModel.showingRewardClaim)
    }

    func testRewardClaimInProgressState() async {
        // Arrange
        mockRepository.claimRewardDelayMs = 50

        // Act - Start reward claim
        let claimTask = Task {
            await viewModel.claimReward(rewardId: "level_1")
        }

        // Check that in-progress state is set (wait a bit for async to start)
        try? await Task.sleep(nanoseconds: 10_000_000) // 10ms
        XCTAssertTrue(viewModel.rewardClaimInProgress)

        // Wait for completion
        await claimTask.value
        XCTAssertFalse(viewModel.rewardClaimInProgress)
    }
}