# Models Directory CLAUDE.md

Core data models for the New-Mystica SwiftUI app using SwiftData and API integration.

## Structure

- **Core Models** (17 files): Domain entities for players, items, combat, inventory, and UI state
- **Protocols/** - `APIModel`: Base protocol for API-serializable types
- **Enums**: Error types, item statuses, UI states, and domain enums

## Key Patterns

**Codable + Sendable**: All models conform to both for thread-safety and JSON serialization.

**APIModel Protocol** (`Protocols/APIModel.swift`): Base conformance for API response decoding; applied to `User`, `Profile`, `Location`, `Loadable<T>`, etc.

**SwiftData Integration**: Models use `@Model` macro where needed for persistence; ensure previews include:
```swift
.modelContainer(for: Item.self, inMemory: true)
.environmentObject(NavigationManager())
```

**Error Handling**: Centralized in `AppError.swift` with domain-specific cases (api, validation, persistence).

## File Organization

- **User/Auth**: `User.swift`, `UserProfile.swift`, `Profile.swift`
- **Items**: `PlayerItem.swift`, `Equipment.swift`, `Material.swift`, `Inventory.swift`
- **Combat**: `Combat.swift`, `Stats.swift`
- **API/Network**: `APIResponses.swift`, `Loadable.swift`
- **Location**: `Location.swift`, `Pagination.swift`
- **UI State**: `DisplayBorders.swift`, `Enums.swift`

## Conventions

- Use zero-indexed enum cases for database compatibility
- Rename decoded fields via `@SerialName` when API schema differs
- Apply computed properties for derived data (e.g., `computedStats`)
- Keep models lean; move business logic to services/managers
