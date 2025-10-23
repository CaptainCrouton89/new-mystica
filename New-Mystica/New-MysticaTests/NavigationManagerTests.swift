//
//  NavigationManagerTests.swift
//  New-MysticaTests
//
//  Tests for NavigationManager state synchronization and navigation flows
//

import XCTest
@testable import New_Mystica

@MainActor
final class NavigationManagerTests: XCTestCase {

    var navigationManager: NavigationManager!

    override func setUp() {
        super.setUp()
        navigationManager = NavigationManager()
    }

    override func tearDown() {
        navigationManager = nil
        super.tearDown()
    }

    // MARK: - Initial State Tests

    func testInitialState() {
        XCTAssertEqual(navigationManager.currentDestination, .mainMenu)
        XCTAssertEqual(navigationManager.navigationPath.count, 0)
        XCTAssertEqual(navigationManager.viewHistory.count, 0) // Fixed: Should start empty
        XCTAssertTrue(navigationManager.viewHistory.isEmpty)
        XCTAssertFalse(navigationManager.canNavigateBack) // Fixed: No history means can't go back
        XCTAssertNil(navigationManager.previousDestination)
    }

    // MARK: - Basic Navigation Tests

    func testNavigateToDestination() {
        navigationManager.navigateTo(.map)

        XCTAssertEqual(navigationManager.currentDestination, .map)
        XCTAssertEqual(navigationManager.navigationPath.count, 1)
        XCTAssertEqual(navigationManager.viewHistory.count, 1)
        XCTAssertEqual(navigationManager.viewHistory.first, .mainMenu) // Previous destination
        XCTAssertTrue(navigationManager.canNavigateBack)
        XCTAssertEqual(navigationManager.previousDestination, .mainMenu)
    }

    func testNavigateToSameDestination() {
        navigationManager.navigateTo(.map)
        let initialPathCount = navigationManager.navigationPath.count
        let initialHistoryCount = navigationManager.viewHistory.count

        // Navigate to same destination
        navigationManager.navigateTo(.map)

        // Should not change path or history
        XCTAssertEqual(navigationManager.navigationPath.count, initialPathCount)
        XCTAssertEqual(navigationManager.viewHistory.count, initialHistoryCount)
    }

    // MARK: - Complex Navigation Flow Tests (A→B→C→back→B)

    func testComplexNavigationFlow() {
        // A (mainMenu) → B (map) → C (collection) → back → B (map)

        // Navigate A → B
        navigationManager.navigateTo(.map)
        XCTAssertEqual(navigationManager.currentDestination, .map)
        XCTAssertEqual(navigationManager.navigationPath.count, 1)
        XCTAssertEqual(navigationManager.viewHistory, [.mainMenu])

        // Navigate B → C
        navigationManager.navigateTo(.collection)
        XCTAssertEqual(navigationManager.currentDestination, .collection)
        XCTAssertEqual(navigationManager.navigationPath.count, 2)
        XCTAssertEqual(navigationManager.viewHistory, [.mainMenu, .map])

        // Navigate back C → B
        navigationManager.navigateBack()
        XCTAssertEqual(navigationManager.currentDestination, .map)
        XCTAssertEqual(navigationManager.navigationPath.count, 1)
        XCTAssertEqual(navigationManager.viewHistory, [.mainMenu])

        // Verify state consistency
        XCTAssertEqual(navigationManager.navigationPath.count, navigationManager.viewHistory.count)
    }

    func testExtendedNavigationFlow() {
        // Test A→B→C→D→back→back→B flow

        navigationManager.navigateTo(.map)          // mainMenu → map
        navigationManager.navigateTo(.collection)   // map → collection
        navigationManager.navigateTo(.equipment)    // collection → equipment

        XCTAssertEqual(navigationManager.currentDestination, .equipment)
        XCTAssertEqual(navigationManager.navigationPath.count, 3)
        XCTAssertEqual(navigationManager.viewHistory, [.mainMenu, .map, .collection])

        // Back to collection
        navigationManager.navigateBack()
        XCTAssertEqual(navigationManager.currentDestination, .collection)
        XCTAssertEqual(navigationManager.navigationPath.count, 2)
        XCTAssertEqual(navigationManager.viewHistory, [.mainMenu, .map])

        // Back to map
        navigationManager.navigateBack()
        XCTAssertEqual(navigationManager.currentDestination, .map)
        XCTAssertEqual(navigationManager.navigationPath.count, 1)
        XCTAssertEqual(navigationManager.viewHistory, [.mainMenu])
    }

    // MARK: - Associated Values Tests (Crafting Navigation)

    func testCraftingNavigationWithAssociatedValues() {
        let mockItem = EnhancedPlayerItem(
            id: "test-item",
            item: Item(
                id: "test-item",
                name: "Test Sword",
                description: "A test sword",
                category: .weapon,
                rarity: .common,
                level: 1,
                image: nil,
                weapon: WeaponData(
                    damage: Damage(min: 10, max: 15),
                    attackSpeed: 1.0,
                    range: 1.0,
                    pattern: .single_arc
                )
            ),
            level: 1,
            experience: 0,
            experienceToNext: 100,
            stats: ItemStats(attack: 10, defense: 5, health: 0),
            isEquipped: false
        )

        // Test crafting navigation with preselected item
        navigationManager.navigateTo(.crafting(preselectedItem: mockItem, preselectedMaterial: nil))

        XCTAssertEqual(navigationManager.currentDestination, .crafting())
        XCTAssertEqual(navigationManager.craftingPreselectedItem?.id, "test-item")
        XCTAssertNil(navigationManager.craftingPreselectedMaterial)

        // Test that different preselected items are treated as same destination
        let anotherItem = EnhancedPlayerItem(
            id: "another-item",
            item: Item(
                id: "another-item",
                name: "Another Sword",
                description: "Another test sword",
                category: .weapon,
                rarity: .common,
                level: 1,
                image: nil,
                weapon: WeaponData(
                    damage: Damage(min: 5, max: 10),
                    attackSpeed: 1.2,
                    range: 1.0,
                    pattern: .single_arc
                )
            ),
            level: 1,
            experience: 0,
            experienceToNext: 100,
            stats: ItemStats(attack: 5, defense: 3, health: 0),
            isEquipped: false
        )

        let initialPathCount = navigationManager.navigationPath.count
        let initialHistoryCount = navigationManager.viewHistory.count

        navigationManager.navigateTo(.crafting(preselectedItem: anotherItem, preselectedMaterial: nil))

        // Should update preselected item but not create new navigation entry
        XCTAssertEqual(navigationManager.craftingPreselectedItem?.id, "another-item")
        XCTAssertEqual(navigationManager.navigationPath.count, initialPathCount)
        XCTAssertEqual(navigationManager.viewHistory.count, initialHistoryCount)
    }

    // MARK: - History Pollution Prevention Tests

    func testHistoryPollutionPrevention() {
        // Navigate to map
        navigationManager.navigateTo(.map)
        XCTAssertEqual(navigationManager.viewHistory, [.mainMenu])

        // Navigate to collection
        navigationManager.navigateTo(.collection)
        XCTAssertEqual(navigationManager.viewHistory, [.mainMenu, .map])

        // Navigate back to map
        navigationManager.navigateBack()
        XCTAssertEqual(navigationManager.viewHistory, [.mainMenu])
        XCTAssertEqual(navigationManager.currentDestination, .map)

        // Navigate to collection again - should not duplicate .map in history
        navigationManager.navigateTo(.collection)
        XCTAssertEqual(navigationManager.viewHistory, [.mainMenu, .map])

        // Verify no duplicate entries
        let mapCount = navigationManager.viewHistory.filter { $0 == .map }.count
        XCTAssertEqual(mapCount, 1, "Map should only appear once in history")
    }

    // MARK: - Navigate to Destination Tests

    func testNavigateToDestinationInHistory() {
        // Build up some history: mainMenu → map → collection → equipment
        navigationManager.navigateTo(.map)
        navigationManager.navigateTo(.collection)
        navigationManager.navigateTo(.equipment)

        // Navigate back to map (which is in history)
        navigationManager.navigateToDestination(.map)

        XCTAssertEqual(navigationManager.currentDestination, .map)
        XCTAssertEqual(navigationManager.viewHistory, [.mainMenu, .map])
        XCTAssertEqual(navigationManager.navigationPath.count, 2) // Fixed: Correct path calculation
    }

    func testNavigateToDestinationNotInHistory() {
        // Build up some history: mainMenu → map → collection
        navigationManager.navigateTo(.map)
        navigationManager.navigateTo(.collection)

        // Navigate to equipment (not in history)
        navigationManager.navigateToDestination(.equipment)

        XCTAssertEqual(navigationManager.currentDestination, .equipment)
        XCTAssertEqual(navigationManager.viewHistory, [.mainMenu, .map, .collection])
        XCTAssertEqual(navigationManager.navigationPath.count, 3)
    }

    // MARK: - Reset Tests

    func testResetToMainMenu() {
        // Build up some navigation state
        navigationManager.navigateTo(.map)
        navigationManager.navigateTo(.collection)
        navigationManager.craftingPreselectedItem = EnhancedPlayerItem(
            id: "test",
            item: Item(id: "test", name: "Test", description: "", category: .weapon, rarity: .common, level: 1, image: nil, weapon: nil),
            level: 1,
            experience: 0,
            experienceToNext: 100,
            stats: ItemStats(attack: 0, defense: 0, health: 0),
            isEquipped: false
        )

        // Reset
        navigationManager.resetToMainMenu()

        XCTAssertEqual(navigationManager.currentDestination, .mainMenu)
        XCTAssertEqual(navigationManager.navigationPath.count, 0)
        XCTAssertEqual(navigationManager.viewHistory.count, 0)
        XCTAssertNil(navigationManager.craftingPreselectedItem)
        XCTAssertNil(navigationManager.craftingPreselectedMaterial)
        XCTAssertFalse(navigationManager.canNavigateBack)
    }

    // MARK: - State Synchronization Tests

    func testViewHistoryNavigationPathSynchronization() {
        // Test that viewHistory.count always equals navigationPath.count

        XCTAssertEqual(navigationManager.viewHistory.count, navigationManager.navigationPath.count)

        navigationManager.navigateTo(.map)
        XCTAssertEqual(navigationManager.viewHistory.count, navigationManager.navigationPath.count)

        navigationManager.navigateTo(.collection)
        XCTAssertEqual(navigationManager.viewHistory.count, navigationManager.navigationPath.count)

        navigationManager.navigateTo(.equipment)
        XCTAssertEqual(navigationManager.viewHistory.count, navigationManager.navigationPath.count)

        navigationManager.navigateBack()
        XCTAssertEqual(navigationManager.viewHistory.count, navigationManager.navigationPath.count)

        navigationManager.navigateBack()
        XCTAssertEqual(navigationManager.viewHistory.count, navigationManager.navigationPath.count)
    }

    // MARK: - Edge Cases

    func testNavigateBackFromMainMenu() {
        // Should not crash or change state when trying to navigate back from initial state
        XCTAssertFalse(navigationManager.canNavigateBack)

        navigationManager.navigateBack()

        XCTAssertEqual(navigationManager.currentDestination, .mainMenu)
        XCTAssertEqual(navigationManager.navigationPath.count, 0)
        XCTAssertEqual(navigationManager.viewHistory.count, 0)
    }

    func testNavigateBackOnlyOnceInHistory() {
        // Navigate to one destination and back
        navigationManager.navigateTo(.map)
        XCTAssertTrue(navigationManager.canNavigateBack)

        navigationManager.navigateBack()
        XCTAssertFalse(navigationManager.canNavigateBack) // Should not be able to go back further

        navigationManager.navigateBack() // Should not crash
        XCTAssertEqual(navigationManager.currentDestination, .mainMenu)
    }
}