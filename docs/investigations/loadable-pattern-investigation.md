# Loadable<T> Pattern Implementation Investigation

## Executive Summary

**Status: NOT IMPLEMENTED** - The codebase currently uses inconsistent loading state patterns instead of the specified Loadable<T> enum. Each service implements separate `@Published` properties for `isLoading`, `errorMessage`, and data, rather than a unified state machine.

## Specification Requirements vs. Current Implementation

### Required: Loadable<T> Enum
**Spec Location:** `docs/ai-docs/frontend-state-management.md:55-83`

**Required Implementation:**
```swift
enum Loadable<T> {
    case idle          // Initial state, nothing loaded yet
    case loading       // Network request in flight
    case loaded(T)     // Success with data
    case error(AppError) // Failed with typed error

    var value: T? { /* computed property */ }
    var isLoading: Bool { /* computed property */ }
}
```

**Current Reality:** ❌ **NOT FOUND** - No Loadable enum exists in codebase.

### Required: AppError Enum
**Spec Location:** `docs/ai-docs/frontend-state-management.md:792-835`

**Required Implementation:**
```swift
enum AppError: Error, LocalizedError {
    case networkUnavailable
    case invalidResponse
    case httpError(statusCode: Int, message: String)
    case decodingFailed(DecodingError)
    case unauthorized
    case notFound
    case validationError(String)
}
```

**Current Reality:** ❌ **NOT FOUND** - No unified AppError enum exists.

## Current Implementation Patterns

### 1. Service-Specific Error Enums
Multiple services define their own error enums:

**EquipmentService.swift:13-31**
```swift
enum EquipmentError: LocalizedError {
    case invalidResponse
    case serverError(Int)
    case networkError(Error)
    case noAuthToken
}
```

**AuthService.swift:13-31**
```swift
enum AuthError: LocalizedError {
    case invalidResponse
    case serverError(Int)
    case networkError(Error)
    case noDeviceId
}
```

### 2. Separate State Properties Pattern
All services use the same inconsistent pattern:

**EquipmentService.swift:39-41**
```swift
@Published var equipment: Equipment?
@Published var isLoading: Bool = false
@Published var errorMessage: String?
```

**BackgroundImageManager.swift:13-15**
```swift
@Published private(set) var currentBackgroundURL: URL
@Published var loadedImage: UIImage?
@Published var isLoading: Bool = false
```

### 3. View Layer Conditionals
Views handle loading states with manual if/else chains:

**EquipmentView.swift:230-236**
```swift
if equipmentService.isLoading {
    // Loading State
    loadingView
} else if let errorMessage = equipmentService.errorMessage {
    // Error State
    errorView(errorMessage)
} else {
    // Success state
}
```

**SplashScreenView.swift:48-56**
```swift
if let error = errorMessage {
    VStack(spacing: 16) {
        Text(error)
            .foregroundColor(.red)
        Button("Try Again") {
            errorMessage = nil
        }
    }
}
```

## Problems with Current Implementation

### 1. State Machine Violations
❌ **Impossible states possible:** Services can have `isLoading=true` AND `errorMessage` set simultaneously
❌ **No explicit idle state:** Cannot distinguish "never loaded" from "loaded but empty"

### 2. Error Handling Inconsistency
❌ **Type erasure:** Rich typed errors (EquipmentError, AuthError) converted to String
❌ **Lost error context:** No way to handle specific errors (unauthorized vs network failure)
❌ **Duplicated error definitions:** Each service defines similar error cases

### 3. View Complexity
❌ **Manual state handling:** Views must remember to check multiple properties in correct order
❌ **Error-prone conditionals:** Easy to forget edge cases or check properties in wrong order
❌ **No exhaustive switching:** Compiler can't verify all states are handled

### 4. Maintenance Issues
❌ **Code duplication:** Each service implements identical loading/error patterns
❌ **Inconsistent patterns:** BackgroundImageManager has no error handling at all
❌ **No shared utilities:** Helper methods duplicated across services

## Migration Impact Analysis

### Services Requiring Migration
1. **EquipmentService.swift** - Full migration needed (3 @Published properties → 1 Loadable)
2. **AuthService.swift** - Partial migration needed (has error enum but uses separate properties)
3. **BackgroundImageManager.swift** - Full migration needed (missing error handling)

### View Modifications Required
1. **EquipmentView.swift:230-236** - Replace if/else with switch on Loadable cases
2. **SplashScreenView.swift:48-56** - Migrate local errorMessage to Loadable pattern

### Breaking Changes
- All existing `@Published` loading/error properties will be replaced
- Views must switch from property checks to pattern matching
- Service error enums can be consolidated into AppError

## Recommended Implementation Steps

1. **Create Core Types** (New files needed):
   - `Sources/Core/Loadable.swift` - Define Loadable<T> enum with helpers
   - `Sources/Core/AppError.swift` - Define unified AppError enum

2. **Migrate Services** (Replace patterns in existing files):
   - Replace `@Published var isLoading: Bool` + `@Published var errorMessage: String?` + `@Published var data: T?`
   - With `@Published var state: Loadable<T> = .idle`

3. **Update Views**:
   - Replace if/else chains with `switch state` pattern matching
   - Remove manual error message handling

4. **Consolidate Error Types**:
   - Map EquipmentError → AppError cases
   - Map AuthError → AppError cases
   - Add service-specific error mapping helpers

## Files Requiring Changes

### New Files (2)
- `New-Mystica/Sources/Core/Loadable.swift`
- `New-Mystica/Sources/Core/AppError.swift`

### Modified Files (5)
- `Services/EquipmentService.swift` - Replace 3 @Published properties with Loadable
- `Services/AuthService.swift` - Replace loading/error pattern
- `Services/BackgroundImageManager.swift` - Add error handling via Loadable
- `EquipmentView.swift` - Update loading/error view logic
- `SplashScreenView.swift` - Update error handling pattern

### Total Implementation Effort
- **New code:** ~100 lines (Loadable + AppError definitions)
- **Modified code:** ~150 lines across 5 files
- **Net code reduction:** ~50 lines (eliminating duplication)

## Conclusion

The current codebase completely lacks the specified Loadable<T> pattern and uses inconsistent, error-prone loading state management. Implementation would significantly improve type safety, maintainability, and consistency across the frontend layer.