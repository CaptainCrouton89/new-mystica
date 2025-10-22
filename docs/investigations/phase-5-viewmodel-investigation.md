# Phase 5 ViewModel Investigation

**Date:** 2025-01-27
**Purpose:** Analyze current state of ViewModels and state management patterns in iOS app
**Status:** Complete

## Executive Summary

The iOS app is in **mid-transition** from legacy @Published services to modern @Observable ViewModels with Loadable<T> pattern. **Critical finding:** Mixed architecture with both old and new patterns coexisting, creating inconsistency and maintenance complexity.

**Architecture Maturity:** 🟡 **Partial** - Core patterns established but incomplete migration

## ViewModel Inventory Matrix

| ViewModel | File | Exists? | @Observable? | Uses Loadable<T>? | Repository Injection? | Async/Await? |
|-----------|------|---------|--------------|-------------------|----------------------|-------------|
| **AppState** | State/AppState.swift | ✅ | ✅ | ❌ | ❌ | ❌ |
| **AuthViewModel** | ViewModels/AuthViewModel.swift | ✅ | ✅ | ❌ | ✅ | ✅ |
| **EquipmentViewModel** | ViewModels/EquipmentViewModel.swift | ✅ | ✅ | ✅ | ✅ | ✅ |
| **InventoryViewModel** | - | ❌ | - | - | - | - |
| **CombatViewModel** | - | ❌ | - | - | - | - |
| **MapViewModel** | - | ❌ | - | - | - | - |
| **ProfileViewModel** | - | ❌ | - | - | - | - |
| **MaterialsViewModel** | - | ❌ | - | - | - | - |
| **CraftingViewModel** | - | ❌ | - | - | - | - |

## AppState Analysis

**File:** `New-Mystica/New-Mystica/State/AppState.swift`

### Current Implementation
```swift
@Observable
final class AppState {
    static let shared = AppState()

    // Session State
    var isAuthenticated: Bool = false
    var currentUser: User? = nil
    var accessToken: String? = nil

    // Profile State
    var profile: UserProfile? = nil

    // Currency State
    var currencyBalance: Int = 0

    // Loading States - MANUAL PATTERN
    var isAuthenticating: Bool = false
    var authError: AppError? = nil
}
```

### ✅ **Strengths:**
- Uses modern @Observable pattern
- Singleton pattern for global state
- Clean separation of auth, profile, currency concerns
- Proper AppError enum usage

### ❌ **Gaps:**
- **No Loadable<T> pattern** - manual isAuthenticating/authError properties
- Missing profile loading state (profile: Loadable<UserProfile>)
- Missing currency loading state management
- No async methods - relies on ViewModels for operations

## Individual ViewModel Analysis

### 1. AuthViewModel ✅ **Modern Pattern**

**File:** `New-Mystica/New-Mystica/ViewModels/AuthViewModel.swift`

```swift
@Observable
final class AuthViewModel {
    let appState: AppState
    let repository: AuthRepository

    init(appState: AppState, repository: AuthRepository = AuthRepositoryImpl()) {
        self.appState = appState
        self.repository = repository
    }

    func registerDevice() async { ... }
    func bootstrapSession() async { ... }
    func logout() async { ... }
}
```

**✅ Modern Patterns:**
- @Observable framework
- Constructor injection with default repository
- async/await for operations
- Proper error handling with AppError enum
- Delegates state management to AppState

**❌ Issues:**
- AppState still uses manual loading flags instead of Loadable<T>
- No direct auth state in ViewModel (relies on AppState)

### 2. EquipmentViewModel ✅ **Reference Implementation**

**File:** `New-Mystica/New-Mystica/ViewModels/EquipmentViewModel.swift`

```swift
@Observable
final class EquipmentViewModel {
    let repository: EquipmentRepository
    var equipment: Loadable<[Equipment]> = .idle

    init(repository: EquipmentRepository = EquipmentRepositoryImpl()) {
        self.repository = repository
    }

    func fetchEquipment() async {
        equipment = .loading
        do {
            let items = try await repository.fetchEquipment()
            equipment = .loaded(items)
        } catch let error as AppError {
            equipment = .error(error)
        }
    }
}
```

**✅ **GOLD STANDARD** for new ViewModels:**
- Perfect Loadable<T> implementation
- Constructor injection with default
- Clean async/await pattern
- Proper error handling and type safety
- Repository pattern adherence

## Legacy Services Analysis

### ⚠️ **Critical Issue: Dual Architecture**

**Problem:** Views inconsistently use old @Published services vs. new @Observable ViewModels

**Legacy Services Found:**
- `EquipmentService.swift` - @Published properties, ObservableObject
- `AuthService.swift` - @Published properties, ObservableObject
- `BackgroundImageManager.swift` - @Published properties, ObservableObject

**Example Inconsistency:**
```swift
// EquipmentView.swift - STILL USES OLD SERVICE
@StateObject private var equipmentService = EquipmentService.shared

// SplashScreenView.swift - USES NEW VIEWMODEL
@State private var equipmentViewModel = EquipmentViewModel()
```

## Current State Management Patterns

### 1. Loading States

**✅ Modern (Loadable<T>):**
```swift
var equipment: Loadable<[Equipment]> = .idle
equipment = .loading
equipment = .loaded(items)
equipment = .error(appError)
```

**❌ Legacy (Manual Properties):**
```swift
@Published var equipment: Equipment?
@Published var isLoading: Bool = false
@Published var errorMessage: String?
```

### 2. Error Handling

**✅ Modern (AppError enum):**
```swift
enum AppError: LocalizedError {
    case networkError(Error)
    case serverError(Int, String?)
    case unauthorized
    // ... with errorDescription and recoverySuggestion
}
```

**❌ Legacy (String errors):**
```swift
@Published var errorMessage: String?
self.errorMessage = "Unable to load equipment data"
```

### 3. Observer Pattern

**✅ Modern (@Observable):**
```swift
@Observable
final class EquipmentViewModel {
    var equipment: Loadable<[Equipment]> = .idle
}
```

**❌ Legacy (@Published/@StateObject):**
```swift
class EquipmentService: ObservableObject {
    @Published var equipment: Equipment?
}
```

## Repository Injection Patterns

### ✅ **Current Best Practice:**
```swift
// Constructor injection with default implementation
init(repository: EquipmentRepository = EquipmentRepositoryImpl()) {
    self.repository = repository
}
```

### Benefits:
- Testable (can inject mock repositories)
- Follows dependency inversion principle
- Default implementation for convenience
- Type-safe interface contracts

### No Service Locator or DI Container:
- Simple constructor injection pattern
- Each ViewModel manages its own dependencies
- No global dependency container needed for MVP

## View Integration Analysis

### ✅ **Modern Integration (Reference):**
```swift
// App.swift - Dependency setup
private let authViewModel: AuthViewModel
init() {
    self.authViewModel = AuthViewModel(appState: AppState.shared)
}

// SplashScreenView.swift - @State usage
@State private var authViewModel = AuthViewModel(appState: AppState.shared)
@Environment(AppState.self) private var appState

// Clean .task usage for async operations
.task {
    await authViewModel.registerDevice()
    await equipmentViewModel.fetchEquipment()
}
```

### ❌ **Legacy Integration (Needs Migration):**
```swift
// EquipmentView.swift - Still uses @StateObject service
@StateObject private var equipmentService = EquipmentService.shared

// SettingsView.swift - Uses @EnvironmentObject with old service
@EnvironmentObject var authService: AuthService
```

### View State Handling:

**✅ Modern Error Handling:**
```swift
switch equipmentViewModel.equipment {
case .idle: EmptyView()
case .loading: ProgressView()
case .loaded(let items): ContentView(items)
case .error(let error): ErrorView(error.localizedDescription)
}
```

**❌ Legacy Error Handling:**
```swift
if equipmentService.isLoading {
    ProgressView()
} else if let errorMessage = equipmentService.errorMessage {
    Text(errorMessage)
}
```

## Migration Gaps Analysis

### Phase 5 Implementation Requirements:

| **Missing ViewModel** | **Priority** | **Key Features** | **Dependencies** |
|----------------------|-------------|------------------|------------------|
| **InventoryViewModel** | High | Player items, filtering, sorting | InventoryRepository |
| **CombatViewModel** | High | Battle state, turn management | CombatRepository |
| **MapViewModel** | Medium | Location state, travel | LocationRepository |
| **ProfileViewModel** | Medium | User profile management | ProfileRepository |
| **MaterialsViewModel** | Medium | Material collection, display | MaterialsRepository |
| **CraftingViewModel** | Low | Weapon crafting, recipes | CraftingRepository |

### Legacy Service Migration:

| **Legacy Service** | **New ViewModel** | **Migration Effort** | **Blocking Views** |
|-------------------|------------------|---------------------|-------------------|
| EquipmentService | ✅ EquipmentViewModel | ⚠️ **Partial** | EquipmentView |
| AuthService | ✅ AuthViewModel | ⚠️ **Partial** | SettingsView |
| BackgroundImageManager | BackgroundViewModel | 🔴 **Needed** | All Views |

## Code Snippets - Current Implementations

### AppState Structure:
```swift
@Observable
final class AppState {
    // MARK: - Session State
    var isAuthenticated: Bool = false
    var currentUser: User? = nil
    var accessToken: String? = nil

    // MARK: - Profile State
    var profile: UserProfile? = nil

    // MARK: - Currency State
    var currencyBalance: Int = 0

    // MANUAL LOADING STATES (should be Loadable<T>)
    var isAuthenticating: Bool = false
    var authError: AppError? = nil

    func setAuthenticated(_ user: User, token: String) {
        self.currentUser = user
        self.accessToken = token
        self.isAuthenticated = true
        self.authError = nil
    }
}
```

### Repository Pattern:
```swift
protocol EquipmentRepository {
    func fetchEquipment() async throws -> [Equipment]
    func equipItem(slotName: String, itemId: String) async throws
    func unequipItem(slotName: String) async throws
}

final class EquipmentRepositoryImpl: EquipmentRepository {
    private let baseURL = "http://localhost:3000/api/v1"

    func fetchEquipment() async throws -> [Equipment] {
        let request = try buildRequest(
            method: "GET",
            path: "/player/equipment",
            requiresAuth: true
        )
        return try await executeRequest(request)
    }
}
```

### Loadable Pattern:
```swift
enum Loadable<T> {
    case idle
    case loading
    case loaded(T)
    case error(AppError)

    var isLoading: Bool {
        if case .loading = self { return true }
        return false
    }

    var value: T? {
        if case .loaded(let value) = self { return value }
        return nil
    }
}
```

## Recommendations for Phase 5

### 1. **Priority 1: Complete Legacy Migration**
```swift
// IMMEDIATE: Migrate EquipmentView to use EquipmentViewModel
// CURRENT: @StateObject private var equipmentService = EquipmentService.shared
// TARGET:  @State private var equipmentViewModel = EquipmentViewModel()

// IMMEDIATE: Migrate SettingsView to use AuthViewModel
// CURRENT: @EnvironmentObject var authService: AuthService
// TARGET:  @State private var authViewModel = AuthViewModel(appState: AppState.shared)
```

### 2. **Priority 2: Implement Missing ViewModels**
Follow EquipmentViewModel as gold standard:
- @Observable class
- Loadable<T> properties
- Constructor injection with defaults
- async/await methods
- AppError enum usage

### 3. **Priority 3: Modernize AppState**
```swift
// CURRENT: Manual loading states
var isAuthenticating: Bool = false
var authError: AppError? = nil

// TARGET: Loadable pattern consistency
var authState: Loadable<User> = .idle
var profileState: Loadable<UserProfile> = .idle
var currencyState: Loadable<Int> = .idle
```

### 4. **Priority 4: Standardize View Integration**
- Remove all @StateObject service usage
- Use @State for ViewModels
- Use @Environment for AppState
- Implement consistent .task patterns
- Standardize error handling with Loadable<T>

## Architecture Decision Record

**Decision:** Adopt @Observable + Loadable<T> + Repository pattern as standard
**Rationale:** Type safety, modern Swift concurrency, testability, consistency
**Status:** ✅ Approved and partially implemented
**Migration:** ⚠️ Incomplete - requires completion for Phase 5

---

**Next Steps:**
1. Complete legacy service migration (EquipmentView, SettingsView)
2. Implement missing ViewModels following EquipmentViewModel pattern
3. Modernize AppState to use Loadable<T> consistently
4. Establish ViewModel integration testing patterns