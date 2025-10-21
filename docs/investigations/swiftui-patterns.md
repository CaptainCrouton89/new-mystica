# SwiftUI View Patterns and Conventions for Equipment Display UI

## Executive Summary

The New-Mystica iOS app follows consistent patterns for view creation, navigation, data loading, and UI components. This investigation documents the established patterns for creating equipment display UI that follows the app's architectural conventions.

## 1. View Creation Patterns

### NavigableView Protocol Pattern

**File:** `New-Mystica/New-Mystica/NavigableView.swift:11-21`

```swift
protocol NavigableView: View {
    var navigationTitle: String { get }
    var showBackButton: Bool { get }
    var customBackAction: (() -> Void)? { get }
}

// Default implementation
extension NavigableView {
    var showBackButton: Bool { true }
    var customBackAction: (() -> Void)? { nil }
}
```

**Usage Example:** `New-Mystica/New-Mystica/CollectionView.swift:10-17`

```swift
struct CollectionView: View, NavigableView {
    @EnvironmentObject private var navigationManager: NavigationManager
    @EnvironmentObject private var audioManager: AudioManager

    var navigationTitle: String { "Collection" }

    var body: some View {
        BaseView(title: navigationTitle) {
            // View content
        }
    }
}
```

### BaseView Wrapper Pattern

**File:** `New-Mystica/New-Mystica/NavigableView.swift:24-86`

```swift
struct BaseView<Content: View>: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    let content: Content
    let navigationTitle: String
    let showBackButton: Bool
    let customBackAction: (() -> Void)?

    var body: some View {
        ZStack {
            Color.backgroundPrimary.ignoresSafeArea()

            VStack(spacing: 0) {
                if showBackButton {
                    headerView  // Automatic back button + title
                }
                content.frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationBarHidden(true)
    }
}
```

### SimpleNavigableView Pattern (Recommended for New Views)

**File:** `New-Mystica/New-Mystica/NavigableView.swift:89-114`

```swift
struct SimpleNavigableView<Content: View>: View, NavigableView {
    // Auto-handles back button and navigation

    init(
        title: String,
        showBackButton: Bool = true,
        customBackAction: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) { /* ... */ }

    var body: some View {
        BaseView(title: navigationTitle, showBackButton: showBackButton, customBackAction: customBackAction) {
            content()
        }
    }
}
```

**Usage Example:** `New-Mystica/New-Mystica/ContentView.swift:39-49`

```swift
SimpleNavigableView(title: "Profile") {
    VStack(spacing: 20) {
        Spacer()
        TitleText("Profile")
        NormalText("Coming Soon")
        Spacer()
    }
}
```

## 2. Navigation Integration

### NavigationDestination Enum

**File:** `New-Mystica/New-Mystica/NavigationManager.swift:12-42`

```swift
enum NavigationDestination: Hashable {
    case mainMenu, map, collection, settings, profile, battle, victory, defeat

    var title: String {
        switch self {
        case .collection: return "Collection"
        // Add equipment case here
        }
    }
}
```

### Adding New Views to Navigation

**Required Steps:**

1. **Add to NavigationDestination enum** (`NavigationManager.swift:12-42`)
2. **Add to ContentView switch** (`ContentView.swift:28-57`)
3. **Use NavigationManager for navigation** (`NavigationManager.swift:57-77`)

**Example for Equipment View:**

```swift
// 1. Add to enum
enum NavigationDestination: Hashable {
    case equipment  // Add this

    var title: String {
        case .equipment: return "Equipment"  // Add this
    }
}

// 2. Add to ContentView switch
@ViewBuilder
private func destinationView(for destination: NavigationDestination) -> some View {
    switch destination {
        case .equipment:
            EquipmentView()  // Add this
    }
}

// 3. Navigate using NavigationManager
navigationManager.navigateTo(.equipment)
```

### NavigationManager Singleton Pattern

**File:** `New-Mystica/New-Mystica/NavigationManager.swift:45-49`

```swift
@MainActor
class NavigationManager: ObservableObject {
    @Published var navigationPath = NavigationPath()
    @Published var currentDestination: NavigationDestination = .mainMenu
    @Published var viewHistory: [NavigationDestination] = [.mainMenu]

    func navigateTo(_ destination: NavigationDestination) { /* ... */ }
    func navigateBack() { /* ... */ }
}
```

## 3. Data Loading Patterns

### Service Integration with @Published Properties

**File:** `New-Mystica/New-Mystica/Services/EquipmentService.swift:34-42`

```swift
@MainActor
class EquipmentService: ObservableObject {
    static let shared = EquipmentService()

    @Published var equipment: Equipment?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    func loadEquipment() async throws {
        isLoading = true
        errorMessage = nil

        do {
            let response: Equipment = try await makeRequest(
                method: "GET",
                path: "/equipment",
                requiresAuth: true
            )
            self.equipment = response
            self.isLoading = false
        } catch {
            self.errorMessage = "Unable to load equipment data"
            self.isLoading = false
            throw error
        }
    }
}
```

### View Integration with Services

**Pattern for Equipment View:**

```swift
struct EquipmentView: View, NavigableView {
    @EnvironmentObject private var navigationManager: NavigationManager
    @StateObject private var equipmentService = EquipmentService.shared

    var navigationTitle: String { "Equipment" }

    var body: some View {
        BaseView(title: navigationTitle) {
            Group {
                if equipmentService.isLoading {
                    LoadingView()
                } else if let errorMessage = equipmentService.errorMessage {
                    ErrorView(message: errorMessage) {
                        Task { try await equipmentService.loadEquipment() }
                    }
                } else if let equipment = equipmentService.equipment {
                    EquipmentContentView(equipment: equipment)
                } else {
                    EmptyEquipmentView()
                }
            }
        }
        .task {
            try await equipmentService.loadEquipment()
        }
    }
}
```

### Async Data Loading with .task Modifier

**Pattern from MapView:** `New-Mystica/New-Mystica/MapView.swift:135-139`

```swift
.onAppear {
    setupLocationManager()
    generateRandomBattleLocations()
}

// For async operations, use .task:
.task {
    try await equipmentService.loadEquipment()
}
```

## 4. Error Handling UI Patterns

### Error States in Services

**File:** `New-Mystica/New-Mystica/Services/EquipmentService.swift:13-31`

```swift
enum EquipmentError: LocalizedError {
    case invalidResponse
    case serverError(Int)
    case networkError(Error)
    case noAuthToken

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "Invalid server response"
        case .serverError(let code): return "Server error: \(code)"
        case .networkError(let error): return "Network error: \(error.localizedDescription)"
        case .noAuthToken: return "No authentication token found"
        }
    }
}
```

### Error Display Pattern

**Recommended Error View Structure:**

```swift
struct ErrorView: View {
    let message: String
    let retryAction: (() -> Void)?

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundColor(Color.alert)

            TitleText("Error", size: 24)
            NormalText(message, size: 16)
                .multilineTextAlignment(.center)

            if let retryAction = retryAction {
                TextButton("Retry") {
                    retryAction()
                }
            }
        }
        .padding(.horizontal, 32)
    }
}
```

## 5. Empty State Patterns

### Loading State Pattern

```swift
struct LoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: Color.accent))
                .scaleEffect(1.5)

            NormalText("Loading...", size: 16)
                .foregroundColor(Color.textSecondary)
        }
    }
}
```

### Empty Equipment State

```swift
struct EmptyEquipmentView: View {
    var body: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: "tshirt")
                .font(.system(size: 64))
                .foregroundColor(Color.textSecondary)

            TitleText("No Equipment", size: 24)
            NormalText("You haven't equipped any items yet.", size: 16)
                .multilineTextAlignment(.center)

            TextButton("Browse Items") {
                // Navigate to collection or shop
            }

            Spacer()
        }
        .padding(.horizontal, 32)
    }
}
```

## 6. UI Component Library

### Text Components

**File:** `New-Mystica/New-Mystica/UI/Components/TextComponents.swift:1-62`

```swift
// Primary text components - ALWAYS use these, never raw Text()
TitleText("Equipment", size: 30)        // Main titles
NormalText("Description text", size: 17) // Body text
SmallText("Caption text", size: 13)     // Small labels

// Uses FontManager.primary font with proper styling
```

### Button Components

**File:** `New-Mystica/New-Mystica/UI/Components/ButtonComponents.swift:1-140`

```swift
// Primary buttons - include audio feedback
TextButton("Equip Item") { /* action */ }
IconButton(icon: "plus.circle") { /* action */ }
BackButton { navigationManager.navigateBack() }

// All buttons include press animations and audio via AudioManager
```

### Popup Components

**File:** `New-Mystica/New-Mystica/UI/Components/PopupComponents.swift:1-427`

```swift
// Item detail popup (reusable)
ItemDetailPopup(item: item, isPresented: $showPopup)

// Generic popups
GenericPopup(title: "Title", imageName: "icon", description: "Description", isPresented: $showPopup)

// Action popups with buttons
ActionPopup(title: "Equip Item?", imageName: "tshirt", description: "This will replace your current armor.", buttonText: "Equip", isPresented: $showPopup) {
    // Equip action
}
```

### Color System

**File:** `New-Mystica/New-Mystica/UI/Colors/Colors.swift:1-61`

```swift
// Primary color palette - neon cyberpunk theme
Color.backgroundPrimary    // Dark gray (#1A1A1A)
Color.backgroundSecondary  // Medium gray (#2F2F2F)
Color.accent              // Neon pink (#FF1493)
Color.accentSecondary     // Neon blue (#00BFFF)
Color.textPrimary         // White (#FFFFFF)
Color.textSecondary       // Light gray (#B0B0B0)

// Usage in components
.foregroundColor(Color.textPrimary)
.background(Color.backgroundCard)
```

## 7. Preview Requirements

### Essential Preview Setup

**File:** `New-Mystica/New-Mystica/ContentView.swift:60-64`

```swift
#Preview {
    EquipmentView()
        .modelContainer(for: Item.self, inMemory: true)  // Required for SwiftData
        .environmentObject(NavigationManager())          // Required for navigation
        .environmentObject(AudioManager())               // Required for audio
}
```

### Environment Objects Required

1. **NavigationManager** - Navigation state management
2. **AudioManager** - Button sound effects
3. **ModelContainer** - SwiftData persistence (for Item models)

## 8. Equipment View Implementation Example

### Complete Equipment View Structure

```swift
import SwiftUI

struct EquipmentView: View, NavigableView {
    @EnvironmentObject private var navigationManager: NavigationManager
    @EnvironmentObject private var audioManager: AudioManager
    @StateObject private var equipmentService = EquipmentService.shared

    @State private var selectedSlot: EquipmentSlot?
    @State private var showSlotPopup = false

    var navigationTitle: String { "Equipment" }

    var body: some View {
        BaseView(title: navigationTitle) {
            Group {
                if equipmentService.isLoading {
                    LoadingView()
                } else if let errorMessage = equipmentService.errorMessage {
                    ErrorView(message: errorMessage) {
                        Task { try await equipmentService.loadEquipment() }
                    }
                } else if let equipment = equipmentService.equipment {
                    EquipmentContentView(equipment: equipment) { slot in
                        selectedSlot = slot
                        showSlotPopup = true
                    }
                } else {
                    EmptyEquipmentView()
                }
            }
        }
        .task {
            try await equipmentService.loadEquipment()
        }
        .overlay(
            Group {
                if showSlotPopup, let slot = selectedSlot {
                    EquipmentSlotPopup(slot: slot, isPresented: $showSlotPopup)
                }
            }
        )
    }
}

struct EquipmentContentView: View {
    let equipment: Equipment
    let onSlotTap: (EquipmentSlot) -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Character avatar with equipment slots
                EquipmentAvatarView(equipment: equipment, onSlotTap: onSlotTap)

                // Equipment stats summary
                EquipmentStatsView(equipment: equipment)

                // Quick actions
                EquipmentActionsView()
            }
            .padding(.horizontal, 16)
        }
    }
}

#Preview {
    EquipmentView()
        .modelContainer(for: Item.self, inMemory: true)
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager())
}
```

## Key Architectural Patterns Summary

1. **NavigableView Protocol** - Consistent navigation integration
2. **BaseView/SimpleNavigableView** - Automatic back button and styling
3. **@StateObject Services** - Centralized data management with @Published properties
4. **Loading/Error/Content States** - Consistent data loading patterns
5. **Component Library Usage** - TitleText, TextButton, Color.* for consistent styling
6. **Popup Overlays** - Modal details and actions
7. **Environment Objects** - NavigationManager, AudioManager, ModelContainer required
8. **Audio Integration** - All interactive elements include sound feedback

## Next Steps for Equipment Implementation

1. Add `equipment` case to `NavigationDestination` enum
2. Add `EquipmentView()` to `ContentView` switch statement
3. Create equipment slot layout with character avatar
4. Implement equipment slot interaction popups
5. Add navigation from collection or main menu to equipment view
6. Follow established loading/error/empty state patterns
7. Use existing UI components for consistent styling

This documentation provides the complete foundation for implementing equipment display UI that follows the app's established patterns and conventions.