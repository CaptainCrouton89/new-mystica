# SwiftUI State Management Patterns Investigation

## Executive Summary

Analysis of the New-Mystica SwiftUI codebase reveals established patterns for state management, error handling, and async operations. The existing AuthService demonstrates @MainActor usage with @Published properties that update synchronously, while async operations use throwing methods instead of @Published error states.

## Existing Service Patterns

### AuthService (@MainActor ObservableObject)
- **File:** `Services/AuthService.swift:33-158`
- **Pattern:** Singleton service marked `@MainActor`
- **Published Properties:**
  - `@Published var isAuthenticated: Bool = false` (line 39)
  - `@Published var currentUser: User? = nil` (line 40)

### Error Handling Strategy
AuthService uses **throwing methods** rather than @Published error properties:
- Custom `AuthError` enum with `LocalizedError` conformance (lines 13-31)
- Methods throw errors directly: `func registerDevice() async throws` (line 45)
- No @Published error state - views handle errors in catch blocks

## Published Property Update Pattern

### Direct Assignment (No MainActor.run needed)
```swift
// AuthService.swift:76-77
self.currentUser = response.user
self.isAuthenticated = true
```
**Key Finding:** Since AuthService is marked `@MainActor`, all method execution is already on MainActor, so direct assignment to @Published properties works without additional dispatch.

## View Async Error Handling Pattern

### Task Block with Error Handling (SettingsView.swift:57-67)
```swift
Button("Logout", role: .destructive) {
    Task {
        do {
            try await authService.logout()
            navigationManager.navigateTo(.map)
        } catch {
            // Handle errors silently for MVP0
            // Still navigate to map even if logout fails
            navigationManager.navigateTo(.map)
        }
    }
}
```

### Silent Error Handling in .task (SplashScreenView.swift:58-68)
```swift
.task {
    let hasToken = KeychainService.get(key: "mystica_access_token") != nil

    if !hasToken {
        // Register device if no token exists
        try? await authService.registerDevice()  // Ignores errors with try?
    } else {
        // Bootstrap session if token exists
        _ = await authService.bootstrapSession()
    }

    navigationManager.navigateTo(.map)
}
```

## Current Loading State Pattern

### Simple ProgressView (SplashScreenView.swift:44-48)
```swift
ProgressView()
    .progressViewStyle(CircularProgressViewStyle(tint: .white))
    .scaleEffect(0.8)
    .opacity(opacity)
    .padding(.bottom, 50)
```
**Pattern:** Basic ProgressView without dynamic text, opacity controlled by splash animation.

## State Management Anti-Patterns Found

1. **No @Published error state:** Current services throw errors instead of storing them in @Published properties
2. **Silent error handling:** Many async calls use `try?` or catch-and-ignore patterns
3. **No loading message state:** No dynamic loading text updates found
4. **No retry patterns:** No retry button implementations found in codebase

## Recommendations for EquipmentService

Based on existing patterns, here's the recommended approach:

### Service Declaration
```swift
@MainActor
class EquipmentService: ObservableObject {
    static let shared = EquipmentService()

    @Published var isLoading: Bool = false
    @Published var loadingMessage: String = ""
    @Published var loadError: String? = nil
    @Published var equipment: [EquipmentItem] = []

    private init() {}
}
```

### Error Handling Strategy
**Hybrid Approach:** Use @Published error property for UI state, but also support throwing for programmatic handling:

```swift
func loadPlayerEquipment() async throws {
    // Clear previous error state
    loadError = nil
    isLoading = true
    loadingMessage = "Loading equipment..."

    do {
        // Update loading message
        loadingMessage = "Fetching data from server..."

        let response = try await makeRequest(/* ... */)

        loadingMessage = "Processing equipment data..."

        // Update equipment data
        equipment = response.equipment

        // Clear loading state
        isLoading = false
        loadingMessage = ""

    } catch {
        // Set @Published error for UI
        loadError = error.localizedDescription
        isLoading = false
        loadingMessage = ""

        // Re-throw for programmatic handling
        throw error
    }
}
```

### View Error Display Pattern
```swift
// In view body
if let error = equipmentService.loadError {
    VStack(spacing: 16) {
        NormalText(error)
            .foregroundColor(.alert)
            .multilineTextAlignment(.center)

        TextButton("Retry") {
            Task {
                try? await equipmentService.loadPlayerEquipment()
            }
        }
    }
    .padding()
}
```

### Loading State Display
```swift
if equipmentService.isLoading {
    VStack(spacing: 12) {
        ProgressView()
            .progressViewStyle(CircularProgressViewStyle(tint: .accent))

        NormalText(equipmentService.loadingMessage)
            .foregroundColor(.textSecondary)
    }
}
```

### Retry Button Implementation
```swift
// Reset error state before retry
TextButton("Retry") {
    Task {
        equipmentService.loadError = nil  // Clear error before retry
        try? await equipmentService.loadPlayerEquipment()
    }
}
```

## State Lifecycle Best Practices

1. **Error Clearing:** Clear `loadError` at start of retry, not on success
2. **Loading State:** Set `isLoading = true` before async work, `false` in both success and error cases
3. **Loading Messages:** Update throughout async operation to show progress
4. **MainActor Compliance:** All @Published property updates happen automatically on MainActor when service is marked `@MainActor`

## Key Architectural Decisions

- **@MainActor services:** Eliminates need for `await MainActor.run` in property updates
- **Singleton pattern:** All services use `static let shared` pattern
- **@Published for UI state:** Use @Published properties for loading/error states that views need to observe
- **Throwing methods:** Keep async methods throwing for programmatic error handling
- **Hybrid error handling:** Support both @Published error properties (for UI) and thrown errors (for logic)