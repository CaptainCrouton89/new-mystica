# Phase 3 Repository Layer Investigation

**Investigation Date:** 2025-01-09
**Investigator:** Claude Code
**Scope:** Current state analysis of repository protocols and data access layer in iOS app

## Executive Summary

The iOS app has **partially implemented repository pattern** with modern Swift concurrency. Current state shows:

- ✅ 2/7 repository protocols defined and implemented (AuthRepository, EquipmentRepository)
- ✅ Clean async/throws pattern adoption throughout
- ✅ Proper dependency injection in ViewModels using protocol defaults
- ⚠️ **Dual pattern conflict**: Services layer co-exists with Repositories layer with overlapping functionality
- ❌ 5 missing repository protocols (Inventory, Combat, Location, Profile, Materials)
- ✅ Comprehensive DTO/response types already defined
- ✅ Loadable pattern implemented for state management

**Maturity Level:** 30% complete - Good foundation but needs expansion and consolidation.

## Repository Protocol Matrix

| Repository | Protocol Exists? | Implementation Count | Methods Defined | Async/Throws? | Status |
|------------|------------------|---------------------|-----------------|---------------|--------|
| AuthRepository | ✅ | 1 (AuthRepositoryImpl) | 2 methods | ✅ | Complete |
| EquipmentRepository | ✅ | 1 (EquipmentRepositoryImpl) | 3 methods | ✅ | Complete |
| InventoryRepository | ❌ | 0 | - | - | Missing |
| CombatRepository | ❌ | 0 | - | - | Missing |
| LocationRepository | ❌ | 0 | - | - | Missing |
| ProfileRepository | ❌ | 0 | - | - | Missing |
| MaterialsRepository | ❌ | 0 | - | - | Missing |

## Detailed Analysis

### 1. Existing Repository Protocols

#### AuthRepository
**File:** `New-Mystica/New-Mystica/Repositories/AuthRepository.swift`

```swift
protocol AuthRepository {
    func registerDevice(deviceId: String) async throws -> (user: User, token: String)
    func logout() async throws
}
```

**Implementation:** AuthRepositoryImpl with:
- Clean async/throws API
- Proper error handling with AppError types
- JWT token management via KeychainService
- Internal DTOs for request/response (DeviceRegistrationRequest, DeviceRegistrationResponse)

#### EquipmentRepository
**File:** `New-Mystica/New-Mystica/Repositories/EquipmentRepository.swift`

```swift
protocol EquipmentRepository {
    func fetchEquipment() async throws -> [Equipment]
    func equipItem(slotName: String, itemId: String) async throws
    func unequipItem(slotName: String) async throws
}
```

**Implementation:** EquipmentRepositoryImpl with:
- Returns `[Equipment]` array directly (no wrapper)
- Uses slot-based equipment system
- Void returns for mutations (equipItem, unequipItem)

### 2. Repository Implementation Patterns

**Base URL:** `http://localhost:3000/api/v1` (consistent across repositories)

**Common Implementation Pattern:**
```swift
final class {Domain}RepositoryImpl: {Domain}Repository {
    private let baseURL = "http://localhost:3000/api/v1"

    // Public protocol methods using async throws

    // MARK: - Private Helpers
    private func buildRequest(...) throws -> URLRequest
    private func executeRequest<T: Decodable>(...) async throws -> T
}
```

**Shared Infrastructure:**
- URLRequest building with optional auth headers
- Generic JSON decoding with ISO8601 dates
- Consistent error mapping to AppError types
- KeychainService integration for token management

### 3. Dependency Injection Pattern

**Current Implementation:**
```swift
// ViewModels use protocol with default implementation
init(repository: AuthRepository = AuthRepositoryImpl())
init(repository: EquipmentRepository = EquipmentRepositoryImpl())
```

**Pattern Assessment:**
- ✅ Protocol-based dependency injection
- ✅ Default implementations for ease of use
- ✅ Testable (can inject mock repositories)
- ⚠️ No centralized dependency container
- ⚠️ Repositories create their own HTTP infrastructure (duplication)

### 4. Conflicting Services Layer

**Discovery:** Duplicate Services layer exists with similar functionality:

#### AuthService.swift
**File:** `New-Mystica/New-Mystica/Services/AuthService.swift`
- `@MainActor` ObservableObject singleton pattern
- `@Published` properties for UI binding
- **Same functionality** as AuthRepository but different API design
- 239 lines vs 118 lines in Repository equivalent

#### EquipmentService.swift
**File:** `New-Mystica/New-Mystica/Services/EquipmentService.swift`
- `@MainActor` ObservableObject singleton pattern
- `@Published` properties (equipment, isLoading, errorMessage)
- **Different API path:** `/equipment` vs Repository's `/player/equipment`
- Same HTTP infrastructure duplication

**Conflict Analysis:**
- Services use `@Published` + ObservableObject pattern
- Repositories use async/throws + Loadable pattern via ViewModels
- Both implement same domain logic with different architectural approaches
- Code duplication across HTTP infrastructure

### 5. Data Transfer Objects (DTOs)

**File:** `New-Mystica/New-Mystica/Models/APIResponses.swift`

**Existing Response Types:**
```swift
// Equipment domain
struct EquipResult: Codable
struct InventoryResponse: Codable
struct StorageCapacity: Codable

// Materials domain
struct ApplyMaterialResult: Codable
struct ReplaceMaterialResult: Codable
struct MaterialStack: Codable

// Generic wrappers
struct ApiResponse<T: Codable>: Codable
struct ErrorDetail: Codable
```

**Assessment:**
- ✅ Comprehensive DTO coverage for all major operations
- ✅ Proper snake_case to camelCase mapping via CodingKeys
- ✅ Generic ApiResponse wrapper available for standardization
- ✅ Rich response types with detailed operation results

### 6. Async/Await Adoption Status

**Current State:** ✅ **Full async/await adoption**
- All repository protocols use `async throws`
- No completion closures found
- ViewModels properly handle async operations
- Loadable pattern integrates well with async/throws

**Example Pattern:**
```swift
func fetchEquipment() async {
    equipment = .loading
    do {
        let items = try await repository.fetchEquipment()
        equipment = .loaded(items)
    } catch let error as AppError {
        equipment = .error(error)
    } catch {
        equipment = .error(.unknown(error))
    }
}
```

### 7. Current Data Access Patterns

**ViewModels → Repositories:**
- AuthViewModel → AuthRepository (✅ implemented)
- EquipmentViewModel → EquipmentRepository (✅ implemented)

**State Management:**
- AppState.swift provides centralized session state
- ViewModels use Loadable<T> for async state management
- @Observable pattern for reactive UI updates

**Missing Patterns:**
- No inventory data access (needs InventoryRepository)
- No combat data access (needs CombatRepository)
- No location/map data access (needs LocationRepository)
- No profile management (needs ProfileRepository)
- No materials management (needs MaterialsRepository)

## Gaps and Missing Repositories

### 1. InventoryRepository (High Priority)
**Needed for:** US-301, US-302, US-303 (Inventory management)

**Expected Interface:**
```swift
protocol InventoryRepository {
    func fetchInventory(page: Int?, limit: Int?) async throws -> InventoryResponse
    func fetchMaterials() async throws -> [MaterialStack]
    func getStorageCapacity() async throws -> StorageCapacity
}
```

### 2. MaterialsRepository (High Priority)
**Needed for:** US-401, US-402, US-403 (Materials application)

**Expected Interface:**
```swift
protocol MaterialsRepository {
    func applyMaterial(itemId: String, materialId: String, quantity: Int) async throws -> ApplyMaterialResult
    func replaceMaterial(itemId: String, slotIndex: Int, newMaterialId: String) async throws -> ReplaceMaterialResult
    func getAvailableMaterials() async throws -> [Material]
}
```

### 3. CombatRepository (Medium Priority)
**Needed for:** US-501, US-502 (Combat system)

**Expected Interface:**
```swift
protocol CombatRepository {
    func initiateCombat(locationId: String) async throws -> CombatSession
    func performAttack(sessionId: String, weaponId: String) async throws -> CombatResult
    func endCombat(sessionId: String) async throws -> CombatRewards
}
```

### 4. LocationRepository (Medium Priority)
**Needed for:** US-201, US-202 (Location/Map system)

**Expected Interface:**
```swift
protocol LocationRepository {
    func fetchNearbyLocations(latitude: Double, longitude: Double, radius: Double) async throws -> [Location]
    func getLocationDetails(locationId: String) async throws -> LocationDetail
    func checkInToLocation(locationId: String) async throws -> CheckInResult
}
```

### 5. ProfileRepository (Low Priority)
**Needed for:** User profile management

**Expected Interface:**
```swift
protocol ProfileRepository {
    func fetchProfile() async throws -> UserProfile
    func updateProfile(_ profile: UserProfile) async throws -> UserProfile
    func updateCurrency(amount: Int) async throws -> UserProfile
}
```

## Recommendations for Phase 3/4

### 1. Architectural Decision Required
**Choose one pattern and deprecate the other:**

**Option A: Repository Pattern (Recommended)**
- Keep current Repository + ViewModel + Loadable pattern
- Deprecate Services layer
- Consolidate HTTP infrastructure into shared base class

**Option B: Services Pattern**
- Keep Services with @Published properties
- Remove Repository layer
- Accept tighter coupling between data and UI layers

### 2. Implementation Priority
1. **Resolve Services vs Repository conflict** (Phase 3)
2. **Implement InventoryRepository** - needed for core inventory features (Phase 3)
3. **Implement MaterialsRepository** - needed for crafting system (Phase 3)
4. **Implement CombatRepository** - needed for combat features (Phase 4)
5. **Implement LocationRepository** - needed for map features (Phase 4)
6. **Implement ProfileRepository** - nice to have (Phase 4)

### 3. Infrastructure Improvements
1. **Create shared HTTPClient** to reduce duplication
2. **Add pagination support** to repository protocols
3. **Implement dependency injection container** for better testability
4. **Create repository factory** for centralized instantiation

### 4. Code Consolidation Strategy
```swift
// Phase 3 approach: Extract shared HTTP client
protocol HTTPClient {
    func execute<T: Decodable>(_ request: URLRequest) async throws -> T
}

// All repositories can then depend on HTTPClient instead of duplicating logic
final class InventoryRepositoryImpl: InventoryRepository {
    private let httpClient: HTTPClient

    init(httpClient: HTTPClient = DefaultHTTPClient()) {
        self.httpClient = httpClient
    }
}
```

## Next Steps

1. **Decision needed:** Resolve Services vs Repository pattern conflict
2. **Implement missing repositories** in priority order
3. **Create shared HTTP infrastructure** to reduce duplication
4. **Add comprehensive unit tests** for all repository implementations
5. **Update ViewModels** to use new repository protocols

---

**Files Referenced:**
- `New-Mystica/New-Mystica/Repositories/AuthRepository.swift`
- `New-Mystica/New-Mystica/Repositories/EquipmentRepository.swift`
- `New-Mystica/New-Mystica/ViewModels/AuthViewModel.swift`
- `New-Mystica/New-Mystica/ViewModels/EquipmentViewModel.swift`
- `New-Mystica/New-Mystica/Services/AuthService.swift`
- `New-Mystica/New-Mystica/Services/EquipmentService.swift`
- `New-Mystica/New-Mystica/Models/APIResponses.swift`
- `New-Mystica/New-Mystica/State/AppState.swift`