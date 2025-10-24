# ViewModels CLAUDE.md

Architecture and conventions for SwiftUI ViewModels in New-Mystica.

## Pattern Overview

All ViewModels use `@Observable` (iOS 17+ observation framework) and follow these core principles:
- **Repository-driven**: Inject repositories for data operations (never direct API calls)
- **Loadable state**: Use `Loadable<T>` enum for all async operations
- **Early error throwing**: No fallbacks; propagate errors to AppState or UI
- **No `any` type**: Explicitly typed properties and computed properties

## Key Patterns

### 1. Core Structure
```swift
@Observable
final class MyViewModel {
    let repository: MyRepository
    weak var navigationManager: NavigationManager?
    weak var appState: AppState?

    var state: Loadable<Model> = .idle
    var isLoading: Bool = false

    init(repository: MyRepository = DefaultMyRepository(),
         navigationManager: NavigationManager? = nil,
         appState: AppState? = nil) {
        self.repository = repository
        self.navigationManager = navigationManager
        self.appState = appState
    }
}
```

### 2. State Management with Loadable
All async data uses `Loadable<T>` (cases: `.idle`, `.loading`, `.loaded(T)`, `.error(AppError)`):
- Set to `.loading` before API call
- Set to `.loaded(value)` on success
- Set to `.error(error)` on failure
- Do NOT use `.idle` after initial setup unless explicitly resetting

### 3. Error Handling
Catch both typed and untyped errors:
```swift
do {
    let result = try await repository.fetchData()
    state = .loaded(result)
} catch let error as AppError {
    state = .error(error)
} catch {
    state = .error(.unknown(error))
}
```

### 4. Local State Synchronization
When modifying items, update the local array to avoid refetching:
```swift
if case .loaded(var items) = myState {
    if let index = items.firstIndex(where: { $0.id == id }) {
        items[index] = updatedItem
        myState = .loaded(items)
    }
}
```

### 5. Pagination Pattern
- Store `currentPage`, `totalPages`, `totalItems`, `canLoadMore`
- `loadInventory()` resets to page 1 and replaces items
- `loadMoreItems()` appends items for infinite scroll

### 6. Computed Properties
Use computed properties extensively for UI logic:
```swift
var isInCombat: Bool {
    if case .loaded(let session) = combatState {
        return session.status == .active
    }
    return false
}
```

### 7. Navigation & AppState Integration
- Use `navigationManager?.navigateTo()` for screen transitions
- Use `appState?.setState()` for global state updates
- Keep appState reference weak to avoid cycles
- NavigationManager methods must run on `@MainActor`

### 8. Loading Flags
Use specific boolean flags for UI feedback:
- `isLoading`: General data loading
- `isProcessingAction`: Action in progress
- `isEquipping`, `isSelling`: Action-specific
- Guard against concurrent operations with `guard !isLoading else { return }`

### 9. UI State Separation
Keep UI state separate from model state:
- Modal visibility: `showingModal`, `showingConfirmation`
- Selection state: `selectedItem`, `selectedMaterial`
- Form state: `textField`, `selectedOption`
- Toast/alert state: `showingSuccessToast`, `showingErrorAlert`

## Specific ViewModel Responsibilities

### CombatViewModel
- Manages turn-based combat session and rewards state
- Updates session state from action responses (no refetch)
- Handles navigation on victory/defeat
- Integrates with AppState for session persistence
- Uses `turnHistory` for UI display of recent actions

### InventoryViewModel
- Paginated item loading with infinite scroll
- Material application and removal
- Item equipping, selling, and upgrading workflows
- Maintains separate state for modals (detail, sell, upgrade confirmation)
- Updates AppState currency balance after transactions
- Uses success toasts with auto-dismiss

### AuthViewModel
- Simple registration and bootstrap flow
- Manages keychain token persistence
- Clears state on logout
- Sets AppState authentication status

## Common Methods

### Data Loading
```swift
func loadData() async {
    state = .loading
    do {
        let data = try await repository.fetch()
        state = .loaded(data)
    } catch let error as AppError {
        state = .error(error)
    } catch {
        state = .error(.unknown(error))
    }
}
```

### Computed Helpers
```swift
private func getCurrentSession() -> Model? {
    if case .loaded(let model) = state {
        return model
    }
    return nil
}
```

### Toast/Alert Management
```swift
private func showSuccessToast(message: String) {
    let toastId = UUID()
    currentToastId = toastId
    successMessage = message
    showingSuccessToast = true

    Task { @MainActor in
        try await Task.sleep(for: .seconds(3))
        if currentToastId == toastId {
            showingSuccessToast = false
        }
    }
}
```

## Testing Patterns

Inject mocks in initializers:
```swift
let mockRepo = MockRepository()
let viewModel = MyViewModel(repository: mockRepo)
```

Use `.modelContainer(inMemory: true)` in SwiftUI Previews with `@Observable` ViewModels.

## Dependencies

- **Repositories**: Injected; use protocol-based interfaces
- **NavigationManager**: Weak reference; call methods on @MainActor
- **AppState**: Weak reference; use `AppState.shared` or injected instance
- **FileLogger**: Available globally; use for debug/error logging
