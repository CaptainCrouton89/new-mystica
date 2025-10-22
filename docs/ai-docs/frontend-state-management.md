# Frontend State Management Architecture

**Last Updated:** 2025-01-27
**Status:** Planning Phase
**Target:** SwiftUI (iOS 17+, macOS 14+)

## Overview

New Mystica uses **MVVM + Repository pattern** with no local persistence. The app is **online-required** and fetches all data from the REST API on demand. State lives in-memory using `@Observable` (iOS 17+) and the `Loadable<T>` pattern for clean network state management.

**Core Principles:**
- No persistence layer (no SwiftData, no Core Data) - online-only game
- No offline support (app requires network connection)
- Clean data flow: Views → ViewModels → Repositories → APIClient → Server
- Repository pattern abstracts network layer for testability
- `Loadable<T>` enum for consistent loading/error states

**Why No SwiftData?**
SwiftData is primarily useful for:
- **Offline caching** - Not needed (online-only)
- **Local-only data** - Tutorial flags, settings (use UserDefaults instead)
- **Complex queries** - Server handles this

For MVP0, SwiftData adds complexity without benefit. Consider it post-MVP if offline support is added.

---

## Architecture Layers

### 1. View Layer (SwiftUI Views)
- **Responsibility:** UI rendering, user interactions
- **State:** Local ephemeral state via `@State` or `@Bindable`
- **Data Access:** Consumes ViewModels via `@StateObject` or inject via environment

### 2. ViewModel Layer (@Observable)
- **Responsibility:** Screen-level business logic, state management
- **State:** Observable properties (iOS 17 Observation framework)
- **Data Access:** Calls Repository methods
- **Lifecycle:** Per-screen, lightweight, testable

### 3. Repository Layer (Protocol-based)
- **Responsibility:** Data fetching, domain logic, error handling
- **State:** Stateless (returns `Loadable<T>` results)
- **Data Access:** Calls APIClient, transforms responses to domain models
- **Benefits:** Easy to mock for testing, clean abstraction boundary

### 4. Network Layer (APIClient)
- **Responsibility:** HTTP communication with backend
- **State:** Stateless (pure request/response)
- **Authentication:** Injects JWT bearer token into requests
- **Error Handling:** Transforms HTTP errors to typed `AppError`

---

## Loadable Pattern (Core State Type)

All network-backed state uses this enum for consistent handling:

```swift
enum Loadable<T> {
    case idle          // Initial state, nothing loaded yet
    case loading       // Network request in flight
    case loaded(T)     // Success with data
    case error(AppError) // Failed with typed error

    var value: T? {
        if case .loaded(let v) = self { return v }
        return nil
    }

    var isLoading: Bool {
        if case .loading = self { return true }
        return false
    }
}
```

**Benefits:**
- Explicit state machine (can't have `isLoading=true` with `error` set)
- SwiftUI-friendly (exhaustive switch in views)
- Type-safe error handling
- Easy to extend (add `.refreshing(T)` for pull-to-refresh later)

---

## Core State Objects

### AppState (Global Singleton)
**Lifecycle:** Created once at app launch, injected via `.environment()`

```swift
@Observable final class AppState {
    // Authentication
    var session: Session?
    var isAuthenticated: Bool { session != nil }

    // Global data (loaded once, shared across screens)
    var profile: Loadable<UserProfile> = .idle
    var currencyBalances: Loadable<[CurrencyBalance]> = .idle  // Single source of truth for currency
}

**Important:** Currency balances live exclusively in `AppState`. Views and ViewModels should read from `appState.currencyBalances`, never duplicate this state.
```

**Used by:** All authenticated screens (via environment)
**Updated when:** Login, logout, profile changes

---

### InventoryViewModel
**Lifecycle:** Created per-screen as `@State` property

```swift
@Observable final class InventoryViewModel {
    // Data (comprehensive response from API)
    var items: Loadable<[PlayerItem]> = .idle
    var stacks: Loadable<[ItemStack]> = .idle
    var pagination: PaginationInfo?

    // Filters (local UI state)
    var selectedSlotFilter: SlotType = .all
    var sortOrder: SortOrder = .level

    // Pagination
    var currentPage: Int = 1

    // Dependencies
    private let repository: InventoryRepository

    init(repository: InventoryRepository) {
        self.repository = repository
    }

    func loadInventory() async {
        items = .loading
        do {
            let response = try await repository.fetchInventory(
                slot: selectedSlotFilter,
                sort: sortOrder,
                page: currentPage
            )
            items = .loaded(response.items)
            stacks = .loaded(response.stacks)
            pagination = response.pagination
            currentPage = response.pagination.currentPage
        } catch {
            items = .error(.from(error))
        }
    }
}
```

**Fetch Trigger:** `onAppear`, pull-to-refresh
**API Endpoint:** `GET /inventory`

---

### EquipmentViewModel
**Lifecycle:** Created per-screen as `@State` property

```swift
@Observable final class EquipmentViewModel {
    // Equipment state (8 slots)
    var equipment: Loadable<EquipmentState> = .idle
    var loadouts: Loadable<[Loadout]> = .idle

    // Dependencies
    private let repository: EquipmentRepository

    init(repository: EquipmentRepository) {
        self.repository = repository
    }

    func loadEquipment() async {
        equipment = .loading
        do {
            let result = try await repository.fetchEquipment()
            equipment = .loaded(result)
        } catch {
            equipment = .error(.from(error))
        }
    }

    func equipItem(_ itemId: UUID) async {
        // After equipItem() call completes, refetch full equipment state
        guard case .loaded(var current) = equipment else { return }

        equipment = .loading
        do {
            // POST to equip endpoint
            _ = try await repository.equipItem(itemId)

            // Refetch full equipment state to ensure consistency
            let updated = try await repository.fetchEquipment()
            equipment = .loaded(updated)
        } catch {
            // Revert on failure
            equipment = .loaded(current)
            // Show error toast
        }
    }

    func unequipSlot(_ slot: SlotName) async {
        guard case .loaded(var current) = equipment else { return }

        equipment = .loading
        do {
            // DELETE to unequip endpoint
            _ = try await repository.unequipSlot(slot)

            // Refetch full equipment state
            let updated = try await repository.fetchEquipment()
            equipment = .loaded(updated)
        } catch {
            equipment = .loaded(current)
        }
    }
}

struct EquipmentState {
    var slots: [SlotName: PlayerItem?]
    var totalStats: PlayerStats
    var activeLoadout: Loadout?
}
```

**Fetch Trigger:** `onAppear`
**API Endpoints:** `GET /equipment`, `GET /loadouts`, `POST /equipment/equip`, `POST /equipment/unequip`

**Loadouts Usage:**
```swift
func loadLoadouts() async {
    loadouts = .loading
    do {
        let result = try await repository.fetchLoadouts()
        loadouts = .loaded(result)
    } catch {
        loadouts = .error(.from(error))
    }
}

func activateLoadout(_ loadoutId: UUID) async {
    do {
        let updated = try await repository.activateLoadout(loadoutId)
        equipment = .loaded(updated)
    } catch {
        // Handle error
    }
}
```

---

### MaterialsViewModel
**Lifecycle:** Created per-screen as `@State` property

```swift
@Observable final class MaterialsViewModel {
    // Player's material inventory (stacked by material_id + style_id)
    var materialStacks: Loadable<[MaterialStack]> = .idle

    // Reference library (all available materials) - loaded once, cached in memory
    var allMaterials: Loadable<[Material]> = .idle

    private let repository: MaterialsRepository

    init(repository: MaterialsRepository) {
        self.repository = repository
    }

    func loadInventory() async {
        materialStacks = .loading
        do {
            let result = try await repository.fetchMaterialInventory()
            materialStacks = .loaded(result)
        } catch {
            materialStacks = .error(.from(error))
        }
    }

    func loadMaterialsCatalog() async {
        // Only load once (no caching, but keep in memory)
        guard case .idle = allMaterials else { return }

        allMaterials = .loading
        do {
            let result = try await repository.fetchAllMaterials()
            allMaterials = .loaded(result)
        } catch {
            allMaterials = .error(.from(error))
        }
    }
}
```

**Fetch Trigger:** `onAppear`
**API Endpoints:** `GET /materials/inventory`, `GET /materials`

---

### CraftingViewModel
**Lifecycle:** Created when crafting sheet is presented

```swift
@Observable final class CraftingViewModel {
    // Target item being crafted
    var item: PlayerItem

    // Applied materials (max 3 slots)
    var appliedMaterials: [Int: MaterialInstance] = [:]  // slot_index: material

    // Preview stats (computed from appliedMaterials)
    var previewStats: PlayerStats {
        // Compute from item.base_stats + appliedMaterials modifiers
        calculatePreviewStats()
    }

    // Image generation (20s blocking operation)
    var craftingState: CraftingState = .idle

    private let repository: CraftingRepository

    init(item: PlayerItem, repository: CraftingRepository) {
        self.item = item
        self.repository = repository
    }

    func applyMaterial(materialId: String, styleId: String, slotIndex: Int) async {
        craftingState = .applying
        do {
            // API call blocks for ~20s if image needs generation
            let result = try await repository.applyMaterial(
                itemId: item.id,
                materialId: materialId,
                styleId: styleId,
                slotIndex: slotIndex
            )
            item = result.item
            craftingState = .success(
                imageURL: result.imageURL,
                isFirstCraft: result.isFirstCraft,
                totalCrafts: result.totalCrafts
            )
        } catch {
            craftingState = .error(.from(error))
        }
    }
}

enum CraftingState {
    case idle
    case applying               // API call in progress (show progress bar)
    case success(imageURL: String?, isFirstCraft: Bool, totalCrafts: Int)
    case error(AppError)
}
```

**Fetch Trigger:** Item selection from inventory
**API Endpoint:** `POST /items/{item_id}/materials/apply`
**Special Handling:** Shows indeterminate progress bar during 20s blocking API call

---

### CombatViewModel
**Lifecycle:** Created when combat starts, destroyed on combat end

```swift
@Observable final class CombatViewModel {
    // Combat session state
    var combatState: Loadable<CombatSession> = .idle

    // Dial mechanics (F-02)
    var dialRotation: Double = 0.0
    var isDialSpinning: Bool = false

    // Chatter
    var petDialogue: String?
    var enemyDialogue: String?

    // Result (after completion)
    var rewards: CombatRewards?

    private let repository: CombatRepository

    init(repository: CombatRepository) {
        self.repository = repository
    }

    func startCombat(locationId: UUID, level: Int) async {
        combatState = .loading
        do {
            let session = try await repository.startCombat(locationId: locationId, level: level)
            combatState = .loaded(session)
        } catch {
            combatState = .error(.from(error))
        }
    }

    func attack(accuracy: Double) async {
        guard case .loaded(let session) = combatState else { return }

        combatState = .loading
        do {
            let updated = try await repository.attack(sessionId: session.id, accuracy: accuracy)
            combatState = .loaded(updated)

            // Check for combat end
            if updated.status == .victory || updated.status == .defeat {
                await completeCombat(result: updated.status)
            }
        } catch {
            combatState = .error(.from(error))
        }
    }

    private func completeCombat(result: CombatResult) async {
        guard case .loaded(let session) = combatState else { return }

        do {
            let rewards = try await repository.completeCombat(sessionId: session.id, result: result)
            self.rewards = rewards
        } catch {
            combatState = .error(.from(error))
        }
    }
}

struct CombatSession {
    var id: UUID
    var enemy: Enemy
    var playerHP: Double
    var enemyHP: Double
    var turnCount: Int
    var status: CombatStatus
    var combatLog: [CombatEvent]
}

enum CombatStatus {
    case ongoing, victory, defeat
}
```

**Fetch Trigger:** User taps location marker
**API Endpoints:** `POST /combat/start`, `POST /combat/attack`, `POST /combat/defend`, `POST /combat/complete`
**Special Handling:** No polling needed (state updates with each action)

---

### MapViewModel
**Lifecycle:** Singleton (lives throughout app session), conforms to `CLLocationManagerDelegate`

```swift
@Observable final class MapViewModel: NSObject, CLLocationManagerDelegate {
    // Location tracking
    var userLocation: CLLocationCoordinate2D?
    var nearbyLocations: Loadable<[Location]> = .idle
    var locationPermissionStatus: CLAuthorizationStatus = .notDetermined

    // Location manager
    private let locationManager = CLLocationManager()
    private var lastFetchLocation: CLLocationCoordinate2D?
    private var lastFetchTime: Date?
    private let repository: LocationRepository

    init(repository: LocationRepository) {
        self.repository = repository
        super.init()
        locationManager.delegate = self
    }

    func requestLocationPermission() {
        locationManager.requestWhenInUseAuthorization()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let current = locations.last?.coordinate else { return }
        userLocation = current

        // Fetch if moved >100m OR >30 seconds elapsed since last fetch
        if shouldFetchLocations(current) {
            Task { await fetchNearbyLocations(current) }
        }
    }

    private func shouldFetchLocations(_ newLocation: CLLocationCoordinate2D) -> Bool {
        guard let last = lastFetchLocation else { return true }

        // Distance check: >100 meters
        let distance = newLocation.distance(from: last)
        let distanceCheck = distance > 100

        // Time check: >30 seconds since last fetch
        let timeCheck = lastFetchTime.map { Date().timeIntervalSince($0) > 30 } ?? true

        return distanceCheck || timeCheck
    }

    private func fetchNearbyLocations(_ coordinate: CLLocationCoordinate2D) async {
        nearbyLocations = .loading
        do {
            let result = try await repository.fetchNearby(
                lat: coordinate.latitude,
                lng: coordinate.longitude,
                radius: 5000
            )
            nearbyLocations = .loaded(result)
            lastFetchLocation = coordinate
            lastFetchTime = Date()  // Record fetch timestamp
        } catch {
            nearbyLocations = .error(.from(error))
        }
    }
}
```

**Fetch Trigger:** GPS movement >100m **OR** >30 seconds elapsed since last fetch (whichever comes first)
**API Endpoint:** `GET /locations/nearby?lat={lat}&lng={lng}&radius={radius}`

---

### ProfileViewModel
**Lifecycle:** Created per-screen as `@State` property

```swift
@Observable final class ProfileViewModel {
    // User profile
    var profile: Loadable<UserProfile> = .idle

    // Progression (F-08)
    var progression: Loadable<PlayerProgression> = .idle

    // Note: Currency balances are accessed from AppState, not duplicated here
    // @Environment(AppState.self) var appState in the view to access appState.currencyBalances

    private let repository: ProfileRepository

    init(repository: ProfileRepository) {
        self.repository = repository
    }

    func loadProfile() async {
        profile = .loading
        do {
            let result = try await repository.fetchProfile()
            profile = .loaded(result)
        } catch {
            profile = .error(.from(error))
        }
    }

    func loadProgression() async {
        progression = .loading
        do {
            let result = try await repository.fetchProgression()
            progression = .loaded(result)
        } catch {
            progression = .error(.from(error))
        }
    }
}
```

**Fetch Trigger:** `onAppear`, tab switch
**API Endpoints:** `GET /profile`, `GET /progression`, `GET /currencies/balance`

---

## Data Models (Codable Structs)

These mirror the API response schemas from `api-contracts.yaml`:

### ⚠️ Critical: CodingKeys for Snake_case

**All API models MUST define `CodingKeys`** to map snake_case API fields to camelCase Swift properties. Without this, decoding fails.

Example:
```swift
struct CombatSession: Codable {
    var id: UUID
    var sessionId: String
    var playerHP: Double
    var imageURL: String?

    enum CodingKeys: String, CodingKey {
        case id
        case sessionId = "session_id"      // Maps API field to property
        case playerHP = "player_hp"
        case imageURL = "image_url"
    }
}
```

Apply this pattern to **all** models with:
- `session_id` → `sessionId`
- `image_url` → `imageURL`
- `player_hp` → `playerHP`
- `total_stats` → `totalStats`
- `current_page` → `currentPage`
- etc.

### Model Definitions

```swift
// Core entities
struct UserProfile: Codable, Identifiable { ... }
struct PlayerItem: Codable, Identifiable { ... }
struct Material: Codable, Identifiable { ... }
struct MaterialStack: Codable { ... }
struct Location: Codable, Identifiable { ... }
struct Enemy: Codable { ... }
struct CombatSession: Codable { ... }
struct CombatRewards: Codable { ... }
struct Loadout: Codable, Identifiable { ... }

// Stats
struct PlayerStats: Codable {
    var atkPower: Double
    var atkAccuracy: Double
    var defPower: Double
    var defAccuracy: Double

    enum CodingKeys: String, CodingKey {
        case atkPower = "atk_power"
        case atkAccuracy = "atk_accuracy"
        case defPower = "def_power"
        case defAccuracy = "def_accuracy"
    }
}

// Enums
enum SlotName: String, Codable {
    case weapon, offhand, head, armor, feet
    case accessory_1, accessory_2, pet
}

enum CombatResult: String, Codable {
    case victory, defeat
}

enum Actor: String, Codable {
    case player, enemy, system
}
```

---

## Repository Layer

Repositories sit between ViewModels and the network layer. They provide a clean abstraction for data access.

### Protocol-Based Design

```swift
protocol InventoryRepository {
    func fetchInventory(slot: SlotType, sort: SortOrder, page: Int) async throws -> InventoryResponse
}

protocol EquipmentRepository {
    func fetchEquipment() async throws -> EquipmentState
    func equipItem(_ itemId: UUID) async throws -> EquipmentState
    func unequipSlot(_ slot: SlotName) async throws -> EquipmentState
}

protocol LoadoutsRepository {
    func fetchLoadouts() async throws -> [Loadout]
    func createLoadout(name: String) async throws -> Loadout
    func updateLoadoutName(id: UUID, name: String) async throws -> Loadout
    func deleteLoadout(id: UUID) async throws -> Void
    func activateLoadout(id: UUID) async throws -> EquipmentState
    func updateLoadoutSlots(id: UUID, slots: [SlotName: UUID?]) async throws -> Loadout
}

protocol CombatRepository {
    func startCombat(locationId: UUID, level: Int) async throws -> CombatSession
    func attack(sessionId: UUID, accuracy: Double) async throws -> CombatSession
    func completeCombat(sessionId: UUID, result: CombatResult) async throws -> CombatRewards
}
```

### Data Transfer Object for Inventory Response

```swift
struct InventoryResponse: Codable {
    var items: [PlayerItem]
    var stacks: [ItemStack]
    var pagination: PaginationInfo
}

struct PaginationInfo: Codable {
    var currentPage: Int
    var totalPages: Int
    var pageSize: Int

    enum CodingKeys: String, CodingKey {
        case currentPage = "current_page"
        case totalPages = "total_pages"
        case pageSize = "page_size"
    }
}
```

### Example Implementation

```swift
final class DefaultInventoryRepository: InventoryRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func fetchInventory(slot: SlotType, sort: SortOrder, page: Int) async throws -> InventoryResponse {
        let response: InventoryResponse = try await apiClient.get(
            "/inventory",
            query: [
                "slot_type": slot.rawValue,
                "sort_by": sort.rawValue,
                "page": "\(page)"
            ]
        )
        return response
    }
}
```

**Benefits:**
- Easy to mock for unit testing ViewModels
- Clear abstraction boundary between business logic and network
- Single place to transform API responses to domain models
- Can add validation, error mapping, retry logic here

---

## Networking Layer

### APIClient
**Lifecycle:** Singleton shared across Repositories

```swift
final class APIClient {
    static let shared = APIClient()

    private let baseURL = "https://api.mystica.app/v1"
    private var authToken: String?

    // Generic request methods
    func get<T: Decodable>(_ endpoint: String, query: [String: String] = [:]) async throws -> T {
        var components = URLComponents(string: baseURL + endpoint)!
        components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }

        var request = URLRequest(url: components.url!)
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AppError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw AppError.httpError(statusCode: httpResponse.statusCode, message: parseErrorMessage(from: data))
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    func post<T: Decodable>(_ endpoint: String, body: Encodable) async throws -> T {
        // Similar implementation with POST method
    }

    func put<T: Decodable>(_ endpoint: String, body: Encodable) async throws -> T {
        // Similar implementation with PUT method
    }

    func delete<T: Decodable>(_ endpoint: String) async throws -> T {
        // Similar implementation with DELETE method
    }

    // Authentication
    func setAuthToken(_ token: String) {
        self.authToken = token
    }

    func clearAuthToken() {
        self.authToken = nil
    }
}
```

### AppError (Typed Error Handling)

```swift
enum AppError: Error, LocalizedError {
    case networkUnavailable
    case invalidResponse
    case httpError(statusCode: Int, message: String)
    case decodingFailed(DecodingError)
    case unauthorized
    case notFound
    case validationError(String)

    var errorDescription: String? {
        switch self {
        case .networkUnavailable:
            return "No internet connection"
        case .invalidResponse:
            return "Invalid server response"
        case .httpError(let code, let message):
            return "Error \(code): \(message)"
        case .decodingFailed:
            return "Failed to parse server response"
        case .unauthorized:
            return "Please log in again"
        case .notFound:
            return "Resource not found"
        case .validationError(let msg):
            return msg
        }
    }

    static func from(_ error: Error) -> AppError {
        if let appError = error as? AppError {
            return appError
        }
        if let urlError = error as? URLError {
            return .networkUnavailable
        }
        if let decodingError = error as? DecodingError {
            return .decodingFailed(decodingError)
        }
        return .invalidResponse
    }
}

---

## Data Flow Examples

### Example 1: Loading Inventory
```
User opens Inventory screen
    ↓
InventoryView.onAppear
    ↓
InventoryViewModel.loadInventory()
    ↓
APIClient.get("/inventory")
    ↓
Server returns JSON
    ↓
Decode to [PlayerItem]
    ↓
ViewModel.items = decoded items
    ↓
SwiftUI re-renders List automatically
```

### Example 2: Equipping Item
```
User taps "Equip" button
    ↓
EquipmentViewModel.equipItem(item)
    ↓
APIClient.post("/equipment/equip", body: ["item_id": item.id])
    ↓
Server updates UserEquipment table
    ↓
Response includes updated equipment state + total stats
    ↓
ViewModel.slots[item.slot] = item
ViewModel.totalStats = response.totalStats
    ↓
SwiftUI re-renders equipment grid
```

### Example 3: Applying Material (20s image generation)
```
User applies material to item
    ↓
CraftingViewModel.applyMaterial(materialId, slotIndex)
    ↓
Start progress animation (0% → 100% over ~20s)
    ↓
APIClient.post("/items/{id}/materials/apply", ...)
    (blocks for 20 seconds while image generates)
    ↓
Server returns crafted item with generated_image_url
    ↓
ViewModel.item = response.item
ViewModel.generatedImageURL = response.image_url
ViewModel.isFirstCraft = response.is_first_craft
    ↓
SwiftUI shows success animation + new image
```

### Example 4: Combat Turn
```
User taps attack at specific dial rotation
    ↓
CombatViewModel.attack(accuracy: 0.87)
    ↓
APIClient.post("/combat/attack", body: {session_id, attack_accuracy})
    ↓
Server calculates damage based on timing
    ↓
Response: {damage_dealt, player_hp, enemy_hp, combat_status}
    ↓
ViewModel.playerHP = response.player_hp
ViewModel.enemyHP = response.enemy_hp
ViewModel.combatLog.append(attackEvent)
    ↓
If combat_status == "victory":
    Show rewards screen
Else:
    Trigger enemy's turn
```

### Example 5: GPS Location Update
```
CLLocationManager detects movement
    ↓
MapViewModel.locationManager(_:didUpdateLocations:)
    ↓
Check if moved >100m from last fetch
    ↓
If yes:
    APIClient.get("/locations/nearby?lat=\(lat)&lng=\(lng)")
    ↓
    Server returns locations within 5km radius
    ↓
    ViewModel.nearbyLocations = response.locations
    ↓
    SwiftUI updates map markers
```

---

## File Organization

```
New-Mystica/
├── App/
│   └── MysticaApp.swift              // App entry point, dependency injection
├── Core/
│   ├── Loadable.swift                // Loadable<T> enum
│   └── AppError.swift                // Typed error enum
├── Networking/
│   └── APIClient.swift               // HTTP client singleton
├── Repositories/
│   ├── Protocols/
│   │   ├── InventoryRepository.swift
│   │   ├── EquipmentRepository.swift
│   │   ├── MaterialsRepository.swift
│   │   ├── CombatRepository.swift
│   │   ├── LocationRepository.swift
│   │   └── ProfileRepository.swift
│   └── Implementations/
│       ├── DefaultInventoryRepository.swift
│       ├── DefaultEquipmentRepository.swift
│       ├── DefaultMaterialsRepository.swift
│       ├── DefaultCombatRepository.swift
│       ├── DefaultLocationRepository.swift
│       └── DefaultProfileRepository.swift
├── Models/
│   ├── UserProfile.swift
│   ├── PlayerItem.swift
│   ├── Material.swift
│   ├── Location.swift
│   ├── Combat.swift
│   ├── Equipment.swift
│   └── Stats.swift
├── ViewModels/
│   ├── AppState.swift                // Global app state
│   ├── InventoryViewModel.swift
│   ├── EquipmentViewModel.swift
│   ├── MaterialsViewModel.swift
│   ├── CraftingViewModel.swift
│   ├── CombatViewModel.swift
│   ├── MapViewModel.swift
│   └── ProfileViewModel.swift
├── Views/
│   ├── ContentView.swift             // Root navigation
│   ├── Inventory/
│   │   ├── InventoryView.swift
│   │   ├── ItemRow.swift
│   │   └── ItemDetailView.swift
│   ├── Equipment/
│   │   ├── EquipmentView.swift
│   │   ├── EquipmentSlotView.swift
│   │   └── LoadoutPickerView.swift
│   ├── Crafting/
│   │   ├── CraftingSheet.swift
│   │   ├── MaterialSelectionView.swift
│   │   └── ImageGenerationProgressView.swift
│   ├── Combat/
│   │   ├── CombatView.swift
│   │   ├── CombatDialView.swift
│   │   └── CombatResultView.swift
│   ├── Map/
│   │   ├── MapView.swift
│   │   └── LocationMarkerView.swift
│   └── Profile/
│       ├── ProfileView.swift
│       ├── ProgressionView.swift
│       └── CurrencyBalanceView.swift
└── Utilities/
    ├── Extensions/
    │   ├── View+Extensions.swift
    │   └── CLLocationCoordinate2D+Extensions.swift
    └── Helpers/
        └── LoadableView.swift        // Reusable view for rendering Loadable<T>
```

---

## Dependency Injection Pattern

### Simple Constructor-Based Approach (MVP0 Recommended)

For MVP0, use simple constructor injection. Repositories are stateless and lightweight, so passing them directly is cleaner than environment setup.

```swift
@main
struct MysticaApp: App {
    @State private var appState = AppState()
    private let apiClient = APIClient.shared

    init() {
        // Load auth token from UserDefaults
        if let token = UserDefaults.standard.string(forKey: "authToken") {
            apiClient.setAuthToken(token)
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appState)
                .environment(\.apiClient, apiClient)
        }
    }
}
```

**Why This Approach:**
- No EnvironmentKey boilerplate needed
- Repositories are injected directly into ViewModels
- Simpler for MVP0, easier to test
- Can migrate to EnvironmentKeys later if needed

### Constructor Injection in Views

```swift
struct InventoryView: View {
    @Environment(AppState.self) var appState

    @State private var viewModel: InventoryViewModel
    private let inventoryRepository: InventoryRepository

    init(inventoryRepository: InventoryRepository) {
        self.inventoryRepository = inventoryRepository
        _viewModel = State(initialValue: InventoryViewModel(repository: inventoryRepository))
    }

    var body: some View {
        // ViewModel has repository injected at init
        switch viewModel.items {
        case .idle:
            Color.clear
                .onAppear {
                    Task { await viewModel.loadInventory() }
                }
        case .loading:
            ProgressView("Loading inventory...")
        case .loaded(let items):
            List(items) { item in
                ItemRow(item: item)
            }
        case .error(let error):
            ErrorView(error: error) {
                Task { await viewModel.loadInventory() }
            }
        }
    }
}
```

### Environment-Based Approach (Post-MVP, if needed)

If you prefer environment injection, define EnvironmentKeys:

```swift
private struct InventoryRepositoryKey: EnvironmentKey {
    static let defaultValue: InventoryRepository = DefaultInventoryRepository(apiClient: APIClient.shared)
}

extension EnvironmentValues {
    var inventoryRepository: InventoryRepository {
        get { self[InventoryRepositoryKey.self] }
        set { self[InventoryRepositoryKey.self] = newValue }
    }
}

// Usage:
@Environment(\.inventoryRepository) var repository
```

This adds boilerplate but enables easier testing with mock repositories. Choose based on MVP scope.


### Reusable LoadableView Helper

```swift
struct LoadableView<T, Content: View>: View {
    let loadable: Loadable<T>
    let content: (T) -> Content
    let retry: (() -> Void)?

    init(
        _ loadable: Loadable<T>,
        @ViewBuilder content: @escaping (T) -> Content,
        retry: (() -> Void)? = nil
    ) {
        self.loadable = loadable
        self.content = content
        self.retry = retry
    }

    var body: some View {
        switch loadable {
        case .idle:
            Color.clear
        case .loading:
            ProgressView()
        case .loaded(let value):
            content(value)
        case .error(let error):
            VStack(spacing: 16) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.largeTitle)
                Text(error.errorDescription ?? "Unknown error")
                    .multilineTextAlignment(.center)
                if let retry = retry {
                    Button("Retry", action: retry)
                }
            }
        }
    }
}

// Usage:
LoadableView(viewModel.items) { items in
    List(items) { item in
        ItemRow(item: item)
    }
} retry: {
    Task { await viewModel.loadInventory() }
}
```

---

## View Usage Examples

### Simple View with Loadable

```swift
struct ProfileView: View {
    @Environment(ProfileRepository.self) var repository
    @State private var viewModel: ProfileViewModel

    var body: some View {
        LoadableView(viewModel.profile) { profile in
            VStack {
                Text(profile.username)
                Text("Level \(profile.vanity_level)")
                Text("\(profile.gold) gold")
            }
        } retry: {
            Task { await viewModel.loadProfile() }
        }
        .task {
            await viewModel.loadProfile()
        }
    }
}
```

---

## Summary

| Layer | Technology | Purpose | State Management |
|-------|-----------|---------|------------------|
| **View** | SwiftUI | UI rendering, user interactions | `@State` for local, `@Environment` for injected |
| **ViewModel** | `@Observable` | Screen-level business logic | `Loadable<T>` for network data |
| **Repository** | Protocols + Implementations | Data fetching, domain logic | Stateless (returns results) |
| **Network** | APIClient | HTTP requests to backend | Stateless (pure request/response) |
| **Models** | Codable structs | Data transfer objects | Immutable data |

**Key Decisions:**
- ✅ **No SwiftData** (online-only game, no need for caching)
- ✅ **Repository pattern** (clean abstraction, easy testing)
- ✅ **Loadable<T> enum** (consistent loading/error states)
- ✅ **@Observable** (iOS 17+ modern observation)
- ✅ **Protocol-based repositories** (dependency injection, testability)

---

## Special Considerations

### 1. Image Generation (20s Blocking)
- **Challenge:** API call blocks for 20 seconds during material application
- **Solution:** Show determinate progress bar with animated percentage (0% → 100%)
- **UX:** Display preview image immediately (base item), then swap to generated image when ready
- **Fallback:** If generation fails, show base item image + error toast

### 2. Location Updates (GPS-driven)
- **Challenge:** Frequent GPS updates can spam API
- **Solution:** Only fetch locations if moved >100m from last fetch, or >30s elapsed
- **Permission Handling:** Request "When In Use" permission, upgrade to "Always" for notifications (post-MVP)

### 3. Combat Sessions (No Polling)
- **Challenge:** Original design assumed Redis polling, but we're not using Redis
- **Solution:** Combat state updates with each action (attack/defend). No background polling needed.
- **Session Timeout:** Server returns 404 if session expired (handle gracefully)

### 4. Authentication Persistence
- **Challenge:** JWT tokens expire after 30 days (anonymous) or 1 hour (email)
- **Solution:** Store token in UserDefaults, refresh on app launch if expired
- **Auto-refresh:** Call `POST /auth/refresh` if access_token expires during session

### 5. Error Handling
- **Network errors:** Show retry button, queue actions for retry
- **401 Unauthorized:** Clear token, redirect to login
- **400 Bad Request:** Show validation error to user
- **500 Server Error:** Show generic error, log to analytics

---

## Migration Notes

**If existing code needs refactoring:**

1. **Week 1:** Extract all API calls into `APIClient.swift`
2. **Week 2:** Create ViewModels, move business logic out of Views
3. **Week 3:** Refactor Views to use `@StateObject` + `.task { await }`
4. **Week 4:** Add loading states, error handling, retry logic

**Breaking changes acceptable:** Pre-production status means we can refactor aggressively.

---

## Future Considerations (Post-MVP)

### When You WOULD Need Caching:
- **Offline mode:** Show last-known state while disconnected
- **Push notifications:** Background refresh to sync new data
- **Performance:** Avoid loading spinners on every screen
- **Multiplayer features:** Real-time state synchronization

### When You WOULD Need More Complex State:
- **Redux/TCA:** If state management becomes unmanageable (>20 ViewModels)
- **Combine subscriptions:** If you need reactive multi-source data streams
- **GraphQL:** If REST API becomes too chatty (too many roundtrips)

**For MVP0, MVVM + Repository + Loadable<T> is sufficient.**
