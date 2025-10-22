# Phase 1 Infrastructure Investigation

**Date:** January 2, 2025
**Scope:** Core infrastructure components for iOS frontend state management
**Status:** Complete

## Executive Summary

The iOS app has **extensive existing infrastructure** with established patterns for state management, networking, and error handling. Key components are implemented but **duplicated across architectural layers**, creating maintenance overhead and inconsistency.

**Current State:**
- ✅ **Loadable<T>** - Complete generic async state wrapper
- ✅ **AppError** - Comprehensive typed error enum with LocalizedError conformance
- ❌ **APIClient** - Missing unified HTTP client (duplicated across repositories)
- ✅ **Model Protocols** - Implicit Codable patterns, some using manual CodingKeys
- ⚠️ **Architecture** - Repository + Service + ViewModel layers with overlap

**Critical Issue:** HTTP client logic is **duplicated** in AuthRepository and EquipmentRepository with identical `buildRequest()`/`executeRequest()` implementations.

## Component Analysis

### 1. Loadable<T> Enum ✅ COMPLETE

**Location:** `New-Mystica/New-Mystica/Models/Loadable.swift:10-36`

**Implementation:**
```swift
enum Loadable<T> {
    case idle
    case loading
    case loaded(T)
    case error(AppError)

    var isLoading: Bool { /* computed property */ }
    var value: T? { /* computed property */ }
    var error: AppError? { /* computed property */ }
}
```

**Assessment:**
- ✅ All 4 expected cases (idle, loading, loaded, error)
- ✅ Proper computed properties for state access
- ✅ Integrates with AppError for error handling
- ❌ Missing Equatable conformance for SwiftUI optimization
- ❌ Missing Sendable conformance for async safety

### 2. AppError Typed Enum ✅ COMPLETE

**Location:** `New-Mystica/New-Mystica/Models/AppError.swift:10-61`

**Implementation:**
```swift
enum AppError: LocalizedError {
    case networkError(Error)
    case serverError(Int, String?)
    case invalidResponse
    case decodingError(String)
    case noDeviceId
    case noAuthToken
    case unauthorized
    case notFound
    case unknown(Error)

    var errorDescription: String? { /* comprehensive descriptions */ }
    var recoverySuggestion: String? { /* user-friendly suggestions */ }
}
```

**Assessment:**
- ✅ Comprehensive error case coverage
- ✅ LocalizedError conformance with detailed descriptions
- ✅ Recovery suggestions for user experience
- ✅ Already used throughout existing repositories
- ❌ Missing `.from()` static factory method (mentioned in requirements)

### 3. APIClient Singleton ❌ MISSING (CODE DUPLICATION)

**Current State:** No unified APIClient exists. HTTP logic is **duplicated** across:
- `AuthRepository.swift:72-116` - buildRequest() + executeRequest()
- `EquipmentRepository.swift:56-101` - identical implementations
- `AuthService.swift:155-238` - makeRequest() with extensive logging

**Duplication Evidence:**
```swift
// IDENTICAL in AuthRepository and EquipmentRepository
private func buildRequest(
    method: String,
    path: String,
    body: Encodable? = nil,
    requiresAuth: Bool = false
) throws -> URLRequest {
    let url = URL(string: "\(baseURL)\(path)")!
    var request = URLRequest(url: url)
    request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    if requiresAuth, let token = KeychainService.get(key: "mystica_access_token") {
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    // ... identical encoding logic
}
```

**Critical Gap:** Need unified `APIClient` with:
- GET/POST/PUT/DELETE method signatures
- Auth token injection
- Consistent error mapping to AppError
- Request/response logging

### 4. Core Model Protocols ⚠️ IMPLICIT PATTERNS

**Current Patterns:**
- **UserProfile** (`Models/UserProfile.swift:10-28`) - Clean Codable with snake_case CodingKeys
- **User** (`Models/User.swift:10-86`) - Complex manual decoding with DynamicCodingKeys
- **APIResponses** (`Models/APIResponses.swift:10-131`) - Multiple response types with consistent patterns

**Assessment:**
- ✅ Consistent snake_case field mapping across models
- ✅ Codable conformance throughout
- ⚠️ No formal APIModel protocol - patterns are implicit
- ⚠️ Inconsistent decoding strategies (manual vs. CodingKeys enum)

### 5. Existing Architecture Analysis

**Current Layers:**
1. **State Layer** - `AppState.swift` (@Observable singleton)
2. **ViewModel Layer** - `AuthViewModel.swift` (orchestration)
3. **Repository Layer** - `AuthRepository.swift`, `EquipmentRepository.swift` (protocol-based)
4. **Service Layer** - `AuthService.swift` (legacy @MainActor ObservableObject)

**Architecture Issues:**
- **Duplication:** AuthService vs AuthRepository implementing same functionality
- **Inconsistency:** @Observable (new) vs @MainActor ObservableObject (legacy)
- **Violation:** Repository pattern should be data-only, but handles auth tokens

**State Management:**
```swift
// AppState.swift:12-62 - Clean @Observable singleton
@Observable
final class AppState {
    var isAuthenticated: Bool = false
    var currentUser: User? = nil
    var accessToken: String? = nil
    // ... with proper state mutation methods
}
```

## Gap Analysis

### Critical Missing Components

1. **Unified APIClient**
   - **Impact:** Code duplication across 3 files
   - **Risk:** Inconsistent error handling and auth injection
   - **Priority:** HIGH

2. **Protocol Standardization**
   - **Impact:** Implicit patterns, no enforced consistency
   - **Risk:** Future models may deviate from established patterns
   - **Priority:** MEDIUM

3. **Conformance Additions to Loadable<T>**
   - **Impact:** SubOptimal SwiftUI performance, async safety concerns
   - **Risk:** View re-renders and threading issues
   - **Priority:** MEDIUM

### Architectural Inconsistencies

1. **Dual Authentication Systems**
   - AuthService (@MainActor ObservableObject) - legacy
   - AuthRepository + AuthViewModel (@Observable) - modern
   - **Recommendation:** Deprecate AuthService

2. **Repository Pattern Violation**
   - Repositories handling auth tokens directly
   - **Recommendation:** APIClient should handle auth injection

## Integration Assessment

### Existing Integration Points

1. **AppError ↔ Loadable<T>** - `Loadable.swift:14`
   - ✅ Proper integration, error cases flow correctly

2. **KeychainService ↔ Auth Components** - Used in 7 files
   - ✅ Well-integrated across all authentication flows
   - ✅ Consistent key naming (`mystica_access_token`, `mystica_device_id`)

3. **AppState ↔ ViewModels** - `AuthViewModel.swift:14-20`
   - ✅ Clean dependency injection pattern
   - ✅ Proper separation of concerns

### Dependencies Map

```
ViewModels (AuthViewModel)
    ↓
Repositories (AuthRepository, EquipmentRepository)
    ↓
[MISSING: APIClient]
    ↓
URLSession + KeychainService
```

## Phase 1 Implementation Recommendations

### Priority 1: Unify HTTP Client (HIGH)

**Action:** Create `APIClient` singleton to eliminate duplication
- Consolidate buildRequest/executeRequest logic
- Standardize auth token injection
- Centralize error mapping to AppError

**Files to Create:**
- `New-Mystica/New-Mystica/Networking/APIClient.swift`

**Files to Refactor:**
- `AuthRepository.swift` - remove duplicated HTTP methods
- `EquipmentRepository.swift` - remove duplicated HTTP methods
- `AuthService.swift` - deprecate or delegate to APIClient

### Priority 2: Enhance Core Types (MEDIUM)

**Loadable<T> Enhancements:**
```swift
enum Loadable<T>: Equatable, Sendable where T: Equatable & Sendable {
    // ... existing cases
}
```

**AppError Factory Method:**
```swift
extension AppError {
    static func from(_ error: Error) -> AppError {
        // Smart error mapping logic
    }
}
```

### Priority 3: Protocol Formalization (LOW)

**APIModel Protocol:**
```swift
protocol APIModel: Codable, Identifiable, Sendable {
    // Standard conformances for API models
}
```

## Next Steps

1. **Week 1:** Implement APIClient singleton and refactor repositories
2. **Week 1:** Add Equatable/Sendable conformances to Loadable<T>
3. **Week 2:** Deprecate AuthService in favor of Repository pattern
4. **Week 2:** Formalize APIModel protocol and apply to existing models

## Files Involved

### Existing Implementation Files
- `Models/Loadable.swift` - Complete async state wrapper
- `Models/AppError.swift` - Complete error handling
- `Models/UserProfile.swift` - Clean API model example
- `State/AppState.swift` - @Observable state singleton
- `ViewModels/AuthViewModel.swift` - Modern ViewModel pattern
- `Repositories/AuthRepository.swift` - Protocol-based repository (has duplication)
- `Repositories/EquipmentRepository.swift` - Protocol-based repository (has duplication)
- `Services/KeychainService.swift` - Complete secure storage
- `Services/AuthService.swift` - Legacy service (candidate for deprecation)

### Files to Create
- `Networking/APIClient.swift` - Unified HTTP client singleton

### Files to Enhance
- `Models/Loadable.swift` - Add Equatable/Sendable conformances
- `Models/AppError.swift` - Add `.from()` factory method

**Investigation Complete** ✅