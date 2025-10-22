# ViewModel Layer Implementation Analysis

**Investigation Date:** 2025-01-27
**Scope:** New-Mystica SwiftUI codebase
**Reference:** [Frontend State Management Spec](../ai-docs/frontend-state-management.md:110-563)

## Executive Summary

**CRITICAL FINDINGS:** The ViewModel layer is completely missing from the codebase. Instead, the app uses legacy `@ObservableObject` Services and direct `@State` properties in Views, violating the spec's MVVM + Repository architecture.

## Required ViewModels (Per Spec)

According to the spec, these ViewModels should exist using `@Observable` (iOS 17+):

1. **InventoryViewModel** - items, stacks, pagination, filters
2. **EquipmentViewModel** - equipment slots, loadouts, equip/unequip actions
3. **MaterialsViewModel** - material stacks, materials catalog
4. **CraftingViewModel** - crafting state, material application
5. **CombatViewModel** - combat sessions, dial mechanics, rewards
6. **MapViewModel** - location tracking, nearby locations, GPS
7. **ProfileViewModel** - profile, progression (NOT currency - that's in AppState)

## Current Implementation Analysis

### Missing Components

**No ViewModel files found:**
- ❌ No files ending in `ViewModel.swift`
- ❌ No `@Observable` classes found
- ❌ No `Loadable<T>` pattern implementation
- ❌ No Repository pattern implementation
- ❌ No AppState singleton

### Existing Legacy Services

The codebase currently uses **legacy `@ObservableObject` Services** instead of ViewModels:

#### 1. EquipmentService.swift:34-147
```swift
@MainActor
class EquipmentService: ObservableObject {
    @Published var equipment: Equipment?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    // Direct API calls (should be in Repository)
    func loadEquipment() async throws { ... }
}
```
**Issues:**
- Uses legacy `@ObservableObject` + `@Published` (should be `@Observable`)
- Custom loading pattern (should use `Loadable<T>`)
- Direct API calls (should delegate to Repository)
- Used via `@StateObject` in EquipmentView.swift:221

#### 2. AuthService.swift:34-239
```swift
@MainActor
class AuthService: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User? = nil

    // Device registration, session management
}
```
**Issues:**
- Global singleton (should be in AppState)
- Legacy patterns throughout

#### 3. NavigationManager.swift:49-172
```swift
@MainActor
class NavigationManager: ObservableObject {
    @Published var navigationPath = NavigationPath()
    @Published var currentDestination: NavigationDestination = .mainMenu
    @Published var currentBattleEnemy: String = "Shadow Wolf"
}
```
**Issues:**
- Mixes navigation with battle state
- Legacy patterns

#### 4. Other Legacy Services
- **BackgroundImageManager.swift:12** - `@ObservableObject` for image loading
- **AudioManager.swift:13** - `@ObservableObject` for audio settings
- **FloatingTextView.swift:94** - `@ObservableObject` for UI animations

### Currency State Violations

**CRITICAL:** Currency state is duplicated across the codebase instead of centralized in AppState:

#### CollectionView.swift:15
```swift
@State private var goldAmount: Int = 1234 // TODO: Replace with actual user gold balance
```
**Issues:**
- Hardcoded currency value
- Should be `@Environment(AppState.self)` access to `appState.currencyBalances`

#### API Models Reference Currency
- **APIResponses.swift:52** - `goldSpent: Int` field
- **APIResponses.swift:71** - `goldSpent: Int` field
- **VictoryView.swift:31** - Mock gold rewards

### View State Management Violations

Views directly manage state that should be in ViewModels:

#### BattleView.swift:13-36
```swift
@State private var playerHealth: Double = 25.0
@State private var enemyHealth: Double = 25.0
@State private var isDialSpinning: Bool = true
@State private var dialRotation: Double = 0.0
// ... 20+ @State properties
```
**Should be:** `@State private var viewModel = CombatViewModel(repository: repository)`

#### MapView.swift:15-22
```swift
@State private var region = MKCoordinateRegion(...)
@State private var battleLocations: [BattleLocation] = []
@State private var locationManager = CLLocationManager()
```
**Should be:** `@State private var viewModel = MapViewModel(repository: repository)`

### Architecture Pattern Violations

#### No Repository Pattern
- ❌ No Repository protocols or implementations
- ❌ Services make direct API calls instead of delegating
- ❌ No abstraction layer for testing

#### No Dependency Injection
- ❌ ViewModels should accept Repositories via constructor
- ❌ Current Services use static singletons
- ❌ No clean boundary for mocking in tests

#### Wrong State Management
- ❌ Using `@StateObject` for Services (should be `@State` for ViewModels)
- ❌ Using `@ObservableObject` + `@Published` (should be `@Observable`)
- ❌ Custom loading patterns (should use `Loadable<T>`)

## Required Implementation

### 1. Foundation Types

**Create:** `Loadable.swift`
```swift
enum Loadable<T> {
    case idle, loading, loaded(T), error(AppError)
    // + computed properties per spec
}
```

**Create:** `AppState.swift`
```swift
@Observable final class AppState {
    var session: Session?
    var currencyBalances: Loadable<[CurrencyBalance]> = .idle
    // Global singleton injected via .environment()
}
```

### 2. Repository Protocols

Create protocols for each domain:
- `InventoryRepository`
- `EquipmentRepository`
- `MaterialsRepository`
- `CraftingRepository`
- `CombatRepository`
- `LocationRepository`
- `ProfileRepository`

### 3. ViewModels Implementation

Convert existing Services to ViewModels:
- Replace `@ObservableObject` → `@Observable`
- Replace `@Published` → plain properties
- Replace custom loading → `Loadable<T>`
- Add Repository dependency injection
- Remove direct API calls

### 4. View Updates

Update all Views:
- Replace `@StateObject` Services → `@State` ViewModels
- Remove duplicated `@State` properties
- Add `@Environment(AppState.self)` for global state
- Update View creation patterns

## Migration Priority

1. **High Priority:** Create `Loadable<T>` and `AppState`
2. **High Priority:** Implement Repository protocols
3. **Medium Priority:** Convert EquipmentService → EquipmentViewModel
4. **Medium Priority:** Convert AuthService state → AppState
5. **Low Priority:** Create missing ViewModels (Inventory, Materials, etc.)

## Testing Impact

Current architecture makes testing difficult:
- Services use static singletons
- Direct API calls can't be mocked
- No clear boundaries between layers

Proper MVVM + Repository enables:
- ViewModel unit tests with mocked Repositories
- Repository tests with mocked APIClient
- Clear separation of concerns

## Compliance Status

**Spec Compliance: 0%**
- ❌ No ViewModels exist
- ❌ Wrong state management patterns
- ❌ No Repository pattern
- ❌ No Loadable<T> pattern
- ❌ Currency state duplicated
- ❌ Wrong dependency injection

**Recommendation:** Complete architectural refactor required to align with spec.