# New Mystica Test Infrastructure

This document provides an overview of the comprehensive test infrastructure created for the New Mystica frontend.

## Overview

A complete test framework has been implemented including mock repositories, test data builders, ViewModel unit tests, and SwiftUI preview helpers.

## Structure

```
New-MysticaTests/
├── Mocks/                     # Mock repository implementations
├── Builders/                  # Test data builders with fluent interface
├── ViewModels/                # ViewModel unit tests
├── Helpers/                   # SwiftUI preview helpers
└── README.md                  # This documentation
```

## Mock Repositories

All 7 repository interfaces have been mocked with comprehensive test scenarios:

### 1. MockAuthRepository
- **Methods:** `registerDevice()`, `logout()`
- **Features:** Configurable delays, success/failure scenarios, call tracking
- **Test Data:** User models with device registration flow

### 2. MockEquipmentRepository
- **Methods:** `fetchEquipment()`, `equipItem()`, `unequipItem()`
- **Features:** Equipment state management, slot validation, equipment tracking
- **Test Data:** Equipment models with different item types and stats

### 3. MockInventoryRepository
- **Methods:** `fetchInventory()`, `fetchMaterials()`, `applyMaterial()`, `removeMaterial()`, `replaceMaterial()`
- **Features:** Complex material application logic, inventory state updates, crafting simulation
- **Test Data:** Enhanced player items with material applications

### 4. MockCombatRepository
- **Methods:** `initiateCombat()`, `performAttack()`, `performDefense()`, `completeCombat()`, `fetchCombatSession()`, `retreatCombat()`
- **Features:** Turn-based combat simulation, HP tracking, reward generation
- **Test Data:** Combat sessions with different enemy types and difficulty levels

### 5. MockLocationRepository
- **Methods:** `fetchNearby()`, `getLocationDetails()`, `fetchZones()`, `getZoneDetails()`
- **Features:** Distance calculations, location filtering, zone management
- **Test Data:** Locations with different biomes and enemy levels

### 6. MockProfileRepository
- **Methods:** `fetchProfile()`, `fetchProgression()`, `claimReward()`, `updateProfile()`, `fetchCurrencyBalance()`, `initializeProfile()`
- **Features:** Player progression tracking, reward claiming, profile updates
- **Test Data:** User profiles with different experience levels and rewards

### 7. MockMaterialsRepository
- **Methods:** `fetchAllMaterials()`, `fetchMaterialInventory()`, `getMaterialDetails()`, `fetchMaterialsByRarity()`, `fetchMaterialsByStyle()`
- **Features:** Material catalog management, inventory stacking, filtering
- **Test Data:** Material templates with different rarities and properties

## Test Data Builders

Fluent interface builders for creating realistic test data:

### PlayerItemBuilder
```swift
let weapon = PlayerItemBuilder.weapon()
    .withLevel(10)
    .withPowerfulStats()
    .withMaterials()
    .build()
```

### LocationBuilder
```swift
let forest = LocationBuilder()
    .asForest()
    .asMidLevel()
    .asNearby()
    .build()
```

### CombatSessionBuilder
```swift
let bossFight = CombatSessionBuilder.bossFight()
    .withBossEnemy()
    .withPowerfulPlayer()
    .build()
```

### UserProfileBuilder
```swift
let veteran = UserProfileBuilder.veteranPlayer()
    .asRichPlayer()
    .withRandomUsername()
    .build()
```

## ViewModel Unit Tests

Comprehensive test coverage for 3 critical ViewModels:

### ProfileViewModelTests (47 test methods)
- **Loading Tests:** Profile and progression loading with success/failure scenarios
- **Reward Tests:** Reward claiming with concurrent operation prevention
- **State Management:** AppState integration and computed properties
- **Error Handling:** Recovery scenarios and partial loading states

### InventoryViewModelTests (25+ test methods)
- **Inventory Loading:** Item and material fetching with various data states
- **Material Operations:** Apply/remove material with local state updates
- **Item Filtering:** Styled vs unstyled item categorization
- **Error Recovery:** Failed operations and state consistency

### CombatViewModelTests (30+ test methods)
- **Combat Flow:** Complete combat sessions from start to rewards
- **Turn Management:** Attack/defense actions with timing mechanics
- **State Transitions:** Combat status changes and HP tracking
- **Complex Scenarios:** Multi-turn combat, retreats, and error handling

## SwiftUI Preview Helpers

### PreviewContainer
Centralized mock management for SwiftUI previews:

```swift
// Basic usage
ContentView()
    .previewEnvironment(scenario: .success)

// Custom ViewModel
ProfileView()
    .previewWith(PreviewContainer.profileViewModelWithData())
```

### Preview Scenarios
- **Success:** Fully loaded data with realistic content
- **Loading:** Simulated network delays and loading states
- **Error:** Various error conditions and recovery states
- **Empty:** New user or empty data scenarios
- **Combat:** Active combat sessions with ongoing battles
- **Rich Player:** Veteran player with lots of items and currency

### ViewModel Factories
Pre-configured ViewModels for different test scenarios:
- `createAuthViewModel()`
- `createEquipmentViewModel()`
- `createInventoryViewModel()`
- `createProfileViewModel()`

## Features

### Comprehensive Mock Features
- **Configurable Delays:** Simulate network latency and loading states
- **Success/Failure Modes:** Test both happy path and error scenarios
- **Call Tracking:** Verify method calls and parameter passing
- **State Simulation:** Realistic data transformations and side effects
- **Concurrent Operation Support:** Handle multiple simultaneous operations

### Test Data Features
- **Realistic Data:** Game-appropriate values and relationships
- **Flexible Builders:** Fluent interface for easy test setup
- **Edge Cases:** Boundary conditions and unusual scenarios
- **Consistency:** Proper relationships between related data models

### Preview Features
- **Scenario Management:** Easy switching between different app states
- **Mock Integration:** Seamless integration with mock repositories
- **Model Container:** In-memory SwiftData support for previews
- **Navigation Support:** Mock NavigationManager for preview environments

## Usage Examples

### Setting Up a Test
```swift
func testInventoryLoading() async {
    // Given
    let items = [
        PlayerItemBuilder.weapon().withLevel(5).build(),
        PlayerItemBuilder.armor().withLevel(3).build()
    ]
    mockRepository.mockInventory = items.map { $0.toEnhanced() }

    // When
    await viewModel.loadInventory()

    // Then
    XCTAssertEqual(mockRepository.fetchInventoryCallCount, 1)
    if case .loaded(let loadedItems) = viewModel.items {
        XCTAssertEqual(loadedItems.count, 2)
    } else {
        XCTFail("Expected items to be loaded")
    }
}
```

### Creating Preview Data
```swift
struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            // Success scenario
            ContentView()
                .previewEnvironment(scenario: .success)
                .previewDisplayName("Success State")

            // Loading scenario
            ContentView()
                .previewEnvironment(scenario: .loading)
                .previewDisplayName("Loading State")

            // Custom ViewModel
            ProfileView()
                .previewWith(PreviewContainer.profileViewModelWithData())
                .previewDisplayName("Profile with Data")
        }
    }
}
```

## Test Compilation Status

✅ **All test files pass syntax validation**
✅ **Mock repositories implement all protocol methods**
✅ **Test data builders provide comprehensive factory methods**
✅ **ViewModel tests cover success, failure, and edge cases**
✅ **Preview helpers support multiple scenarios**

**Note:** Full test execution is currently blocked by compilation issues in the main app target (unrelated to test infrastructure). The test infrastructure itself is syntactically correct and ready for use once main app compilation issues are resolved.

## Benefits

1. **Isolated Testing:** Tests run independently without network dependencies
2. **Predictable Data:** Consistent test data for reliable assertions
3. **Scenario Coverage:** Comprehensive testing of success, failure, and edge cases
4. **Developer Experience:** Easy-to-use builders and helpers reduce test setup time
5. **Preview Support:** Rich SwiftUI previews with realistic data
6. **Maintainable:** Well-structured code that's easy to extend and modify

## Future Enhancements

1. **Integration Tests:** Add tests that verify ViewModel/Repository integration
2. **UI Tests:** SwiftUI View testing with mock ViewModels
3. **Performance Tests:** Measure loading times and memory usage
4. **Additional Scenarios:** More edge cases and error conditions
5. **Test Utilities:** Additional helper functions for common test patterns

This test infrastructure provides a solid foundation for reliable, maintainable testing of the New Mystica frontend application.