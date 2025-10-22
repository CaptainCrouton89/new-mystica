# Implementation Plan – Frontend State Management Architecture

## Overview
- **Document:** `docs/ai-docs/frontend-state-management.md` (Complete architectural specification)
- **Status:** Ready for implementation phase
- **Scope:** Establish MVVM + Repository pattern foundation for entire iOS app
- **Target:** SwiftUI iOS 17+ with online-only architecture
- **Complexity:** High (multi-layer, protocol-based, foundational to all future features)

---

## Problem & Context

**Current State:**
The iOS app (`New-Mystica/`) has scattered ViewModels and direct API calls. No consistent state management pattern, no typed error handling, no repository abstraction layer.

**Required State:**
All screens should follow unified MVVM + Repository + Loadable<T> pattern with proper dependency injection, consistent error handling, and protocol-based data access layer.

**Key Challenge:**
This is a foundational refactor affecting every screen. Must be implemented methodically to avoid breaking existing features while establishing clean architecture patterns.

---

## Solution Summary

**Approach:**
1. Build core infrastructure (error types, Loadable enum, APIClient) – foundational
2. Create data models with proper CodingKeys for snake_case API responses
3. Establish protocol-based repository layer (interfaces first)
4. Implement repository implementations (data access layer)
5. Build ViewModels using repositories and Loadable<T> pattern
6. Refactor Views to use new ViewModels
7. Integrate AppState for global auth/currency management

**Key Principles:**
- No SwiftData (online-only, no caching needed for MVP0)
- Protocol-first repositories (testability, decoupling)
- Loadable<T> enum for all network state (consistency)
- Constructor-based DI for MVP0 (simple, clean)
- Early error throwing (no fallbacks, pre-production OK to break)

---

## Current System

**Existing Code:**
- `New-Mystica/New_MysticaApp.swift` – App entry point (partial implementation)
- `New-Mystica/New-Mystica/` – Mixed ViewModels, Views, some Models
- `New-Mystica/New-Mystica/Models/` – Partial data models (AppError.swift, Loadable.swift, UserProfile.swift)
- `New-Mystica/New-Mystica/ViewModels/` – Started but incomplete
- `New-Mystica/New-Mystica/Repositories/` – Directory exists, empty

**Architectural Gaps:**
- No APIClient singleton with auth handling
- Repository protocols exist but missing implementations
- Views not using @Observable pattern consistently
- No CodingKeys for snake_case API response mapping
- No typed error handling system
- AppState not integrated into app launch
- Dependency injection setup incomplete

**Integration Points:**
- Backend: `docs/api-contracts.yaml` (contracts for endpoints)
- Database: Supabase REST API only (no SwiftData)
- Auth: JWT tokens stored in UserDefaults, injected to APIClient

---

## Task Breakdown

### Batch 1: Core Infrastructure (Foundation Layer)

| ID | Task | Component | Dependencies | Files | Exit Criteria |
|----|------|-----------|--------------|-------|---------------|
| T1 | Create/verify Loadable<T> enum | Core | — | `Models/Loadable.swift` | Enum compiles, all 4 cases defined with value/isLoading helpers |
| T2 | Create/refine AppError typed enum | Core | — | `Models/AppError.swift` | All error cases defined, .from() static factory works, LocalizedError conformance |
| T3 | Create APIClient singleton | Network | T1, T2 | `Networking/APIClient.swift` | GET/POST/PUT/DELETE methods, auth token injection, error handling |
| T4 | Define core data model protocols | Models | T2 | `Models/Protocols/APIModel.swift` | Codable, Identifiable protocols defined for consistency |

**Notes:**
- T1, T2, T3 can run in parallel (no dependencies)
- T4 depends on T2 for error handling
- These establish the foundation for all subsequent layers

---

### Batch 2: Data Models with API Mapping

| ID | Task | Component | Dependencies | Files | Exit Criteria |
|----|------|-----------|--------------|-------|---------------|
| T5 | Core stat structs (PlayerStats, Enemy, etc.) | Models | T1 | `Models/Stats.swift` | All stat structs with CodingKeys for snake_case |
| T6 | Inventory models (PlayerItem, ItemStack, Material, MaterialStack) | Models | T5 | `Models/Inventory.swift` | Full Codable support, CodingKeys for all snake_case fields |
| T7 | Equipment models (EquipmentState, Loadout, SlotName enum) | Models | T5 | `Models/Equipment.swift` | 8 slot enum values, EquipmentState struct, Loadout with CodingKeys |
| T8 | Combat models (CombatSession, Enemy, CombatRewards, CombatStatus) | Models | T5 | `Models/Combat.swift` | All combat structs, status enums, CodingKeys for API response |
| T9 | Location & world models (Location, nearby response) | Models | T5 | `Models/Location.swift` | CLLocationCoordinate2D conversion, proper coding keys |
| T10 | Profile & progression models (UserProfile, PlayerProgression) | Models | T5 | `Models/Profile.swift` | Profile struct, progression tracking, balance structs |

**Notes:**
- Tasks T5-T10 can run in parallel (all depend only on T5)
- Critical: Every model needs CodingKeys for snake_case → camelCase mapping
- Reference `api-contracts.yaml` line-by-line for field mappings
- All models must be Codable + Identifiable (where appropriate)

---

### Batch 3: Repository Layer (Protocols & Interfaces)

| ID | Task | Component | Dependencies | Files | Exit Criteria |
|----|------|-----------|--------------|-------|---------------|
| T11 | InventoryRepository protocol & DTO | Repositories | T6 | `Repositories/Protocols/InventoryRepository.swift` | fetchInventory(), applyMaterial(), removeMaterial(), replaceMaterial() with proper return types |
| T12 | EquipmentRepository protocol & DTO | Repositories | T7 | `Repositories/Protocols/EquipmentRepository.swift` | fetchEquipment(), equipItem(), unequipSlot() methods |
| T13 | CombatRepository protocol | Repositories | T8 | `Repositories/Protocols/CombatRepository.swift` | startCombat(), attack(), defend(), completeCombat() |
| T14 | LocationRepository protocol | Repositories | T9 | `Repositories/Protocols/LocationRepository.swift` | fetchNearby(), fetchLocation() |
| T15 | ProfileRepository protocol | Repositories | T10 | `Repositories/Protocols/ProfileRepository.swift` | fetchProfile(), fetchProgression(), claimReward() |
| T16 | AuthRepository protocol | Repositories | T2 | `Repositories/Protocols/AuthRepository.swift` | registerDevice(), logout(), refresh token methods |
| T17 | MaterialsRepository protocol | Repositories | T6 | `Repositories/Protocols/MaterialsRepository.swift` | fetchMaterials(), fetchMaterialInventory() |

**Notes:**
- T11-T17 can run in parallel (all depend on batch 2 models)
- Each protocol defines the contract, no implementation
- Return types should use `async throws` pattern
- Include DTO response types inline (e.g., InventoryResponse with pagination)

---

### Batch 4: Repository Implementations

| ID | Task | Component | Dependencies | Files | Exit Criteria |
|----|------|-----------|--------------|-------|---------------|
| T18 | DefaultInventoryRepository | Repositories | T11, T3 | `Repositories/Implementations/DefaultInventoryRepository.swift` | Calls APIClient.get/post/delete, transforms responses to domain models |
| T19 | DefaultEquipmentRepository | Repositories | T12, T3 | `Repositories/Implementations/DefaultEquipmentRepository.swift` | Implements equip/unequip, manages 8 slots |
| T20 | DefaultCombatRepository | Repositories | T13, T3 | `Repositories/Implementations/DefaultCombatRepository.swift` | Session mgmt, attack/defend cycles |
| T21 | DefaultLocationRepository | Repositories | T14, T3 | `Repositories/Implementations/DefaultLocationRepository.swift` | Nearby queries, location filtering |
| T22 | DefaultProfileRepository | Repositories | T15, T3 | `Repositories/Implementations/DefaultProfileRepository.swift` | Profile fetch, progression, rewards |
| T23 | DefaultAuthRepository | Repositories | T16, T3 | `Repositories/Implementations/DefaultAuthRepository.swift` | Device registration, token refresh |
| T24 | DefaultMaterialsRepository | Repositories | T17, T3 | `Repositories/Implementations/DefaultMaterialsRepository.swift` | Material catalog, inventory |

**Notes:**
- T18-T24 run in parallel (all depend on T3 APIClient + respective protocol)
- Each implementation transforms API responses to domain models
- Add proper error mapping (.from(error) pattern)
- Handle snake_case ↔ camelCase conversion (via CodingKeys in models)

---

### Batch 5: ViewModel Layer

| ID | Task | Component | Dependencies | Files | Exit Criteria |
|----|------|-----------|--------------|-------|---------------|
| T25 | AppState (global @Observable) | ViewModels | T6, T7 | `ViewModels/AppState.swift` | session, profile, currencyBalances as Loadable<T>, isAuthenticated computed |
| T26 | InventoryViewModel | ViewModels | T18, T1 | `ViewModels/InventoryViewModel.swift` | items/stacks as Loadable<T>, filters, pagination, loadInventory() |
| T27 | EquipmentViewModel | ViewModels | T19, T1 | `ViewModels/EquipmentViewModel.swift` | equipment/loadouts as Loadable<T>, equipItem(), unequipSlot() |
| T28 | MaterialsViewModel | ViewModels | T24, T1 | `ViewModels/MaterialsViewModel.swift` | materialStacks, allMaterials as Loadable<T>, lazy catalog load |
| T29 | CraftingViewModel | ViewModels | T18, T1 | `ViewModels/CraftingViewModel.swift` | item, appliedMaterials, previewStats, CraftingState enum |
| T30 | CombatViewModel | ViewModels | T20, T1 | `ViewModels/CombatViewModel.swift` | combatState, dialRotation, petDialogue, enemyDialogue, rewards |
| T31 | MapViewModel (location tracking) | ViewModels | T21, T1 | `ViewModels/MapViewModel.swift` | NSObject, CLLocationManagerDelegate, userLocation, nearbyLocations |
| T32 | ProfileViewModel | ViewModels | T22, T1 | `ViewModels/ProfileViewModel.swift` | profile, progression as Loadable<T>, loadProfile(), loadProgression() |

**Notes:**
- T25 first (AppState is a dependency for views)
- T26-T32 can run in parallel
- All use @Observable, Loadable<T> for network state
- All use async/await for network calls
- T31 (MapViewModel) is special – NSObject subclass, implements CLLocationManagerDelegate

---

### Batch 6: View Integration & Refactoring

| ID | Task | Component | Dependencies | Files | Exit Criteria |
|----|------|-----------|--------------|-------|---------------|
| T33 | Create LoadableView helper component | Utilities | T1 | `Utilities/Helpers/LoadableView.swift` | Generic switch over .idle/.loading/.loaded/.error cases |
| T34 | Update MysticaApp entry point (DI setup) | App | T25, T3 | `New_MysticaApp.swift` | APIClient token restoration, AppState injection, environment setup |
| T35 | Refactor InventoryView to use InventoryViewModel | Views | T26, T33 | `Views/Inventory/InventoryView.swift` | Remove direct API calls, use LoadableView helper |
| T36 | Refactor EquipmentView to use EquipmentViewModel | Views | T27, T33 | `Views/Equipment/EquipmentView.swift` | 8-slot grid, loadout management |
| T37 | Refactor CraftingSheet to use CraftingViewModel | Views | T29, T33 | `Views/Crafting/CraftingSheet.swift` | 20s blocking call progress, image preview |
| T38 | Refactor CombatView to use CombatViewModel | Views | T30, T33 | `Views/Combat/CombatView.swift` | Dial mechanics, attack/defend buttons, result screen |
| T39 | Refactor MapView to use MapViewModel | Views | T31, T33 | `Views/Map/MapView.swift` | Location permissions, marker rendering, >100m debounce |
| T40 | Refactor ProfileView to use ProfileViewModel | Views | T32, T33 | `Views/Profile/ProfileView.swift` | Profile display, progression tracking, rewards |

**Notes:**
- T33 (LoadableView utility) is dependency for all view refactors
- T34 (App entry point) integrates all layers – do after core is ready
- T35-T40 can run in parallel after T33, T34
- All views switch from @State direct API to @State ViewModel + dependency injection

---

### Batch 7: Validation & Integration Tests

| ID | Task | Component | Dependencies | Files | Exit Criteria |
|----|------|-----------|--------------|-------|---------------|
| T41 | Test Loadable<T> enum behavior | Tests | T1 | `Tests/LoadableTests.swift` | value, isLoading computed properties work correctly |
| T42 | Test AppError.from() factory | Tests | T2 | `Tests/AppErrorTests.swift` | URLError → .networkUnavailable, DecodingError → .decodingFailed |
| T43 | Mock repositories for ViewModel testing | Tests | T26-T32 | `Tests/Mocks/Mock*.swift` | Mock implementations of all protocols |
| T44 | Test InventoryViewModel state transitions | Tests | T26, T43 | `Tests/ViewModels/InventoryViewModelTests.swift` | idle → loading → loaded, error handling, pagination |
| T45 | Test EquipmentViewModel equip/unequip | Tests | T27, T43 | `Tests/ViewModels/EquipmentViewModelTests.swift` | Equip succeeds, failure reverts, sync after action |
| T46 | Test CombatViewModel turn flow | Tests | T30, T43 | `Tests/ViewModels/CombatViewModelTests.swift` | startCombat, attack, defend, victory/defeat |
| T47 | End-to-end integration test (sample flow) | Tests | T34, T35, T43 | `Tests/Integration/SampleFlowTests.swift` | Login → load inventory → equip item → verified state |

**Notes:**
- T41, T42 test core types (can do early)
- T43 creates mocks for all repositories
- T44-T46 test individual ViewModels with mocks
- T47 validates full integration

---

## Parallelization Strategy

### **Phase 1: Core Infrastructure** (2-3 days)
**Batch 1 → Batch 2 → Batch 3**
- Batch 1 (T1-T4): Build foundational types
- Batch 2 (T5-T10): Define all data models in parallel
- Batch 3 (T11-T17): Create repository protocols in parallel

**Dependency:** Each phase must complete before next (sequential)

---

### **Phase 2: Implementation** (3-4 days)
**Batch 4 → Batch 5**
- Batch 4 (T18-T24): Implement repositories in parallel (~8 tasks)
- Batch 5 (T25-T32): Build ViewModels in parallel (~8 tasks)

**Key:** After Batch 4 ready, all Batch 5 tasks can spawn simultaneously

---

### **Phase 3: Integration & Testing** (2-3 days)
**Batch 6 → Batch 7**
- Batch 6 (T33-T40): Refactor views in parallel (~8 tasks)
- Batch 7 (T41-T47): Add tests in parallel (~7 tasks)

**Key:** T34 (MysticaApp entry point) is prerequisite for T35-T40, so handle T34 first or as lightweight task alongside

---

## Integration Points & Data Flow

### Authentication Flow
```
UserDefaults (stored JWT)
    ↓
MysticaApp init → APIClient.setAuthToken()
    ↓
AppState.session created
    ↓
Repositories inject APIClient → include token in all requests
    ↓
401 response → clear token, redirect to login
```

### Network State Pattern (all ViewModels)
```
View.onAppear
    ↓
ViewModel.loadData() (e.g., loadInventory)
    ↓
state = .loading
    ↓
Repository.fetch() → APIClient.get()
    ↓
Decode response (CodingKeys handle snake_case)
    ↓
state = .loaded(data) or .error(AppError)
    ↓
View switches on state (via LoadableView helper)
```

### Global Currency State
```
AppState.currencyBalances = single source of truth
    ↓
All ViewModels read from appState (don't duplicate)
    ↓
On transaction (spend gold), refetch via AppState method
    ↓
All views automatically update (via @Observable)
```

### Image Generation (20s blocking)
```
CraftingViewModel.applyMaterial()
    ↓
state = .applying
    ↓
Show progress bar (0% → 100% animated over ~20s)
    ↓
APIClient.post("/items/{id}/materials/apply") – BLOCKS
    ↓
state = .success(imageURL, isFirstCraft, totalCrafts)
    ↓
Show generated image + stats preview
```

---

## Key Decisions & Rationale

| Decision | Rationale | Notes |
|----------|-----------|-------|
| **No SwiftData** | Online-only, no caching needed for MVP0 | Use UserDefaults for auth token only |
| **Protocol-based repos** | Enables mocking, clean abstraction, testable | DI via constructor injection |
| **Loadable<T> enum** | Explicit state machine, SwiftUI-friendly | Prevents invalid state combinations |
| **@Observable (iOS 17+)** | Modern, simpler than @StateObject + @Published | Consistent with project min SDK |
| **Constructor DI (MVP0)** | Simpler than EnvironmentKeys, less boilerplate | Easy to migrate to EnvironmentKeys post-MVP |
| **Early error throwing** | Pre-production status, no fallbacks | Catch bugs faster, break hard |
| **CodingKeys everywhere** | API uses snake_case, Swift uses camelCase | Prevents decoding failures |

---

## Risk Assessment

### High Priority Risks

**R1: Breaking Existing Code**
- **Risk:** Refactoring existing views/ViewModels breaks running features
- **Mitigation:** Do views last (Batch 6), test each refactor in isolation
- **Contingency:** Keep old code alongside new code briefly for A/B testing

**R2: CodingKeys Mapping Errors**
- **Risk:** One missed field → decoding fails silently
- **Mitigation:** Script validation: compare api-contracts.yaml fields to model CodingKeys
- **Contingency:** Add debug logging in APIClient to print raw JSON on decode failure

**R3: Repository Duplication**
- **Risk:** Different implementations do conflicting logic
- **Mitigation:** Protocol enforces contract, use code review checklist
- **Contingency:** Extract common patterns into base class post-MVP if needed

**R4: Auth Token Lifecycle**
- **Risk:** Token expires, not refreshed, user gets 401 unexpectedly
- **Mitigation:** Restore token on app launch, implement `POST /auth/refresh` handler
- **Contingency:** Catch 401 globally, redirect to login, clear UserDefaults token

**R5: GPS Location Spam**
- **Risk:** Frequent updates hammer API even with debounce
- **Mitigation:** >100m **OR** >30s check implemented in MapViewModel
- **Contingency:** Add in-memory cache of last fetch result, skip if identical

---

## Success Criteria

✅ **Phase 1 Complete:**
- All core types (Loadable, AppError, APIClient) compile and pass unit tests
- All data models defined with CodingKeys, sample JSON decoding works
- All repository protocols defined (no implementations yet)

✅ **Phase 2 Complete:**
- All repositories implement protocols, mock data flows
- All ViewModels use @Observable, Loadable<T> pattern
- AppState integrates auth session + currency balances
- No direct API calls in ViewModels (all via repositories)

✅ **Phase 3 Complete:**
- All views refactored to use new ViewModels
- LoadableView helper renders all 4 states correctly (idle/loading/loaded/error)
- MysticaApp entry point sets up APIClient + AppState injection
- Sample flow (login → inventory → equip) tested end-to-end
- All unit tests pass, mocks validate contracts

✅ **Overall:**
- Zero direct API calls outside of APIClient
- All network state expressed as Loadable<T>
- Consistent error handling (typed AppError)
- Views are thin (UI only), ViewModels are thin (business logic only)
- Repositories are testable (protocol-based, injectable)

---

## Expected Result

### Before (Current State)
```swift
// Views call APIs directly
@State var items = [PlayerItem]()
@State var isLoading = false
@State var errorMessage: String?

Task {
    isLoading = true
    do {
        let response = try await URLSession.shared.data(from: url)
        // decode, handle errors manually
        items = decoded
    } catch {
        errorMessage = error.localizedDescription
    }
}
```

### After (New Architecture)
```swift
// Views use ViewModels with Loadable<T>
@State var viewModel = InventoryViewModel(repository: inventoryRepository)

var body: some View {
    LoadableView(viewModel.items) { items in
        List(items) { item in ItemRow(item: item) }
    } retry: {
        Task { await viewModel.loadInventory() }
    }
    .task { await viewModel.loadInventory() }
}
```

**Observable improvements:**
- ✅ No direct API calls in views (clean separation)
- ✅ Consistent loading/error states (Loadable<T>)
- ✅ Testable ViewModels (inject mock repos)
- ✅ Protocol-based repositories (swappable implementations)
- ✅ Typed errors (AppError, not String messages)
- ✅ Global auth + currency state (AppState)

---

## Notes & References

- **API Contracts:** `docs/api-contracts.yaml` – source of truth for endpoints and response schemas
- **Backend Documentation:** `docs/ai-docs/backend.md` – server-side implementation patterns
- **Frontend Documentation:** `docs/ai-docs/frontend-state-management.md` – complete architecture guide (THIS IS WHAT WE'RE IMPLEMENTING)
- **Database Guide:** `docs/ai-docs/database.md` – Supabase schema (REST API only)
- **Current Code:** `New-Mystica/New-Mystica/` – existing partial implementation

---

## Timeline Estimate

| Phase | Duration | Batches | Focus |
|-------|----------|---------|-------|
| **Phase 1: Infrastructure** | 2-3 days | 1-3 | Core types, models, protocols |
| **Phase 2: Implementation** | 3-4 days | 4-5 | Repositories, ViewModels (8 tasks parallel) |
| **Phase 3: Integration** | 2-3 days | 6-7 | View refactoring, tests, validation |
| **Total** | **7-10 days** | — | Can be parallelized to 4-5 days with parallel agents |

**Parallelization Potential:**
- 3 independent Batches 2 tasks can run in parallel (~8 tasks/batch)
- With 4 agents working simultaneously: **4-5 days total**

---

## Next Steps

1. **User review & approval** – Confirm task breakdown, parallelization strategy, risk assessment
2. **Execution phase** – Run `/manage-project/implement/execute` to spawn agent batches
3. **Progress tracking** – Monitor agent-responses/, validate against exit criteria
4. **Integration testing** – Verify end-to-end flows once all batches complete
5. **Documentation** – Update CLAUDE.md with new file structure, patterns for future features

---

**Ready to proceed with execution?**
