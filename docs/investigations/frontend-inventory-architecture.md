# Frontend Inventory Architecture Investigation

## Overview

Investigation of the current SwiftUI frontend inventory architecture to understand implementation patterns for adding pagination support.

## Current Architecture Summary

**Architecture Pattern**: Repository + ViewModel + View with Loadable state management

**Key Components**:
- `InventoryRepository` protocol with `DefaultInventoryRepository` implementation
- `InventoryViewModel` using `@Observable` with `Loadable<[EnhancedPlayerItem]>` state
- `InventoryView` consuming data via `LoadableView` pattern
- `APIClient` handling HTTP requests with unified error handling

**No Pagination**: All `fetch*` methods across the entire codebase return complete arrays without any pagination support.

## Current Data Flow

```
InventoryView -> InventoryViewModel -> DefaultInventoryRepository -> APIClient -> GET /inventory
```

### 1. Service Layer

**File**: `/New-Mystica/New-Mystica/Repositories/Implementations/DefaultInventoryRepository.swift`

```swift
func fetchInventory() async throws -> [EnhancedPlayerItem] {
    struct InventoryResponse: Decodable {
        let items: [EnhancedPlayerItem]
    }

    let response: InventoryResponse = try await apiClient.get(endpoint: "/inventory")
    return response.items
}
```

**Key Findings**:
- Uses unified `APIClient.shared` for HTTP requests
- Simple response decoding with local `InventoryResponse` struct
- No query parameters - calls `/inventory` endpoint directly
- Returns complete array of items

### 2. Models

**File**: `/New-Mystica/New-Mystica/Models/Inventory.swift`

**Primary Model**: `EnhancedPlayerItem` with fields:
- `id: String`
- `baseType: String`
- `level: Int`
- `appliedMaterials: [ItemMaterialApplication]`
- `computedStats: ItemStats`
- `isStyled: Bool`
- Image generation fields (`generatedImageUrl`, `imageGenerationStatus`)

**Legacy Response Model**: `/New-Mystica/New-Mystica/Models/APIResponses.swift` contains older `InventoryResponse` structure (not currently used).

### 3. View Model

**File**: `/New-Mystica/New-Mystica/ViewModels/InventoryViewModel.swift`

```swift
@Observable
final class InventoryViewModel {
    var items: Loadable<[EnhancedPlayerItem]> = .idle

    func loadInventory() async {
        items = .loading
        do {
            let inventory = try await repository.fetchInventory()
            items = .loaded(inventory)
        } catch {
            items = .error(.unknown(error))
        }
    }
}
```

**Key Features**:
- Uses `@Observable` macro for SwiftUI integration
- `Loadable<T>` state management pattern for async operations
- Local state updates for material application operations
- Computed properties for filtered views (`styledItems`, `unstyledItems`)

### 4. Views

**File**: `/New-Mystica/New-Mystica/Views/Inventory/InventoryView.swift`

**UI Structure**:
- `BaseView` wrapper with title
- Gold balance header
- Filter segments (All/Styled/Unstyled)
- `LoadableView` pattern for state rendering
- `ScrollView` with `LazyVStack` for item list
- Custom `ItemRow` components

**Current Filtering**: Client-side filtering by styling status only.

### 5. Repository Pattern

**Protocol**: `/New-Mystica/New-Mystica/Repositories/Protocols/InventoryRepository.swift`

Methods:
- `fetchInventory() -> [EnhancedPlayerItem]`
- `fetchMaterials() -> [MaterialTemplate]`
- Material application methods (`applyMaterial`, `removeMaterial`, `replaceMaterial`)

**Implementation**: `DefaultInventoryRepository` with dependency injection pattern.

### 6. API Integration

**File**: `/New-Mystica/New-Mystica/Networking/APIClient.swift`

**HTTP Methods Available**:
- `get<T: Decodable>(endpoint: String) -> T`
- `post<T: Decodable>(endpoint: String, body: Encodable?) -> T`
- `put<T: Decodable>(endpoint: String, body: Encodable?) -> T`
- `delete<T: Decodable>(endpoint: String) -> T`

**Current GET Pattern**: Simple endpoint strings without query parameters.

## Pagination Implementation Strategy

### Required Changes

1. **APIClient Enhancement**: Add query parameter support to `get` method
2. **Pagination Models**: Create pagination request/response structures
3. **Repository Protocol**: Extend with paginated fetch methods
4. **ViewModel State**: Replace simple array with paginated collection
5. **View Updates**: Add loading states for pagination and infinite scroll

### Existing Patterns to Leverage

1. **Loadable State**: Extend for pagination states (loading more, end reached)
2. **Repository Pattern**: Add new paginated methods alongside existing ones
3. **Error Handling**: Use existing `AppError` patterns
4. **View Architecture**: Maintain `LoadableView` pattern for consistency

### No Existing Pagination Patterns

**Comprehensive Search Result**: No pagination, paging, limit, or offset patterns found anywhere in the SwiftUI codebase. This will be a completely new implementation.

## Recommendations

1. **Backward Compatibility**: Keep existing `fetchInventory()` method for non-paginated use cases
2. **Incremental Implementation**: Add new paginated methods without breaking existing functionality
3. **State Management**: Extend `Loadable` enum or create new `PaginatedLoadable` type
4. **API Design**: Use standard pagination parameters (`page`, `limit`, `cursor`)
5. **Performance**: Implement proper list virtualization for large datasets

## Related Files

### Core Architecture
- `/New-Mystica/New-Mystica/Models/Inventory.swift` - Data models
- `/New-Mystica/New-Mystica/Repositories/Protocols/InventoryRepository.swift` - Repository interface
- `/New-Mystica/New-Mystica/Repositories/Implementations/DefaultInventoryRepository.swift` - Implementation
- `/New-Mystica/New-Mystica/ViewModels/InventoryViewModel.swift` - State management
- `/New-Mystica/New-Mystica/Views/Inventory/InventoryView.swift` - UI rendering

### Infrastructure
- `/New-Mystica/New-Mystica/Networking/APIClient.swift` - HTTP client
- `/New-Mystica/New-Mystica/Models/Loadable.swift` - Async state pattern
- `/New-Mystica/New-Mystica/Models/AppError.swift` - Error handling

### Dependencies
- All repository implementations follow the same pattern
- `@Observable` macro used throughout for state management
- `LoadableView` pattern used consistently across app