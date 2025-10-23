# SwiftUI Navigation LLM Reference

## Critical API Signatures (iOS 16+)

### NavigationStack
```swift
NavigationStack<Data, Root>(path: Binding<NavigationPath>) where Data : MutableCollection, Data : RandomAccessCollection, Data.Element : Hashable

// Type-erased version
NavigationStack(path: Binding<NavigationPath>) { /* content */ }

// Array-based (for single type)
NavigationStack(path: Binding<[SomeHashableType]>) { /* content */ }
```

### NavigationPath Operations
```swift
// CRITICAL: NavigationPath is type-erased container for Hashable values
var path = NavigationPath()
path.append(someHashableValue)        // Push view
path.removeLast()                     // Pop one view
path.removeLast(count)                // Pop multiple views
path.removeLast(path.count)           // Pop to root
path.count                            // Current depth

// GOTCHA: Cannot remove from empty path - crashes
// GOTCHA: iOS 17.0 bug - removeLast() flashes white with arrays
```

### NavigationLink Value-Based (iOS 16+)
```swift
NavigationLink(value: someHashableValue) { Label }

// Must pair with navigationDestination
.navigationDestination(for: SomeType.self) { value in
    DestinationView(value: value)
}

// CONSTRAINT: value must conform to Hashable
// CONSTRAINT: Must have matching navigationDestination for type
```

## Navigation State Management

### Environment Pattern for Global Navigation
```swift
// Custom environment key
struct NavigationPathKey: EnvironmentKey {
    static let defaultValue: Binding<NavigationPath> = .constant(NavigationPath())
}

extension EnvironmentValues {
    var navigationPath: Binding<NavigationPath> {
        get { self[NavigationPathKey.self] }
        set { self[NavigationPathKey.self] = newValue }
    }
}

// Usage in deeply nested views
@Environment(\.navigationPath) private var navPath
```

### ObservableObject Router Pattern
```swift
@MainActor
class Router: ObservableObject {
    @Published var pathHome = NavigationPath()
    @Published var pathSearch = NavigationPath()
    @Published var pathProfile = NavigationPath()

    // CRITICAL: Must be @MainActor for UI updates
    func popToRoot(for tab: Tab) {
        switch tab {
        case .home: pathHome.removeLast(pathHome.count)
        case .search: pathSearch.removeLast(pathSearch.count)
        case .profile: pathProfile.removeLast(pathProfile.count)
        }
    }
}
```

## Custom Transitions and Animations

### Hero Animations (iOS 16+)
```swift
@Namespace private var heroNamespace

NavigationLink(value: item) {
    ItemView()
        .matchedTransitionSource(id: item.id, in: heroNamespace)
}
.navigationDestination(for: Item.self) { item in
    DetailView()
        .navigationTransition(.zoom(sourceID: item.id, in: heroNamespace))
}

// CONSTRAINT: sourceID must match exactly between views
// CONSTRAINT: Namespace must be shared between source and destination
```

### Third-Party Navigation Transitions
```swift
// Using swiftui-navigation-transitions library
NavigationStack {
    // content
}
.navigationTransition(.slide)
.navigationTransition(.fade(.in).animation(.easeInOut(duration: 0.3)))

// Combining transitions
.navigationTransition(.slide.combined(with: .fade(.in)))
```

### Custom ViewModifier Transitions
```swift
extension AnyTransition {
    static var pivot: AnyTransition {
        .modifier(
            active: CornerRotateModifier(amount: -90, anchor: .topLeading),
            identity: CornerRotateModifier(amount: 0, anchor: .topLeading)
        )
    }
}

// GOTCHA: Custom transitions on NavigationStack require third-party solutions
// GOTCHA: Built-in NavigationStack transitions are limited
```

## Preventing Duplicate Navigation States

### State Deduplication Patterns
```swift
// Check before appending to prevent duplicates
func navigateTo<T: Hashable>(_ destination: T) {
    // CRITICAL: Always check if already on this path
    if let lastItem = navPath.wrappedValue.codable?.last,
       let typedItem = lastItem as? T,
       typedItem == destination {
        return // Prevent duplicate navigation
    }
    navPath.wrappedValue.append(destination)
}

// Route-based deduplication
enum Route: Hashable, Codable {
    case detail(id: UUID)
    case settings

    var id: String {
        switch self {
        case .detail(let id): return "detail-\(id)"
        case .settings: return "settings"
        }
    }
}
```

## Deep Linking Patterns

### URL-Based Deep Linking
```swift
// Route enum for Codable state restoration
enum AppRoute: Hashable, Codable {
    case home
    case detail(id: UUID)
    case settings(tab: String)
}

struct ContentView: View {
    @State private var navigationPath = NavigationPath()

    var body: some View {
        NavigationStack(path: $navigationPath) {
            HomeView()
        }
        .onOpenURL { url in
            handleDeepLink(url)
        }
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            if let url = activity.webpageURL {
                handleDeepLink(url)
            }
        }
    }

    private func handleDeepLink(_ url: URL) {
        // CRITICAL: Always validate routes before navigating
        guard let route = parseURL(url) else { return }

        // Clear current path and build new one
        navigationPath.removeLast(navigationPath.count)
        navigationPath.append(route)
    }
}
```

### State Restoration with SceneStorage
```swift
struct ContentView: View {
    @State private var navigationPath = NavigationPath()
    @SceneStorage("navigation.path") private var navigationData: Data?

    var body: some View {
        NavigationStack(path: $navigationPath) {
            HomeView()
        }
        .onAppear {
            restoreNavigationState()
        }
        .onChange(of: navigationPath) {
            saveNavigationState()
        }
    }

    private func saveNavigationState() {
        // CRITICAL: Only works with Codable routes
        navigationData = try? JSONEncoder().encode(navigationPath.codable)
    }

    private func restoreNavigationState() {
        guard let data = navigationData,
              let codablePath = try? JSONDecoder().decode(NavigationPath.CodableRepresentation.self, from: data) else {
            return
        }

        // GOTCHA: Must validate routes exist before restoring
        navigationPath = NavigationPath(codablePath)
    }
}
```

## Version-Specific Gotchas

### iOS 16 vs iOS 17 Differences
```swift
// iOS 17.0 BUG: Array-based paths flash white on removeLast()
// WORKAROUND: Use NavigationPath instead of [Type]
@State private var path = NavigationPath() // ✅ Works in iOS 17
@State private var path: [Route] = []      // ❌ Flashes in iOS 17.0

// iOS 16+ ONLY: matchedTransitionSource requires iOS 16+
if #available(iOS 16.0, *) {
    view.matchedTransitionSource(id: id, in: namespace)
}
```

### Deprecated Patterns (iOS 16+)
```swift
// ❌ DEPRECATED: Don't use NavigationView
NavigationView { }

// ❌ DEPRECATED: Don't use isActive/tag navigation
NavigationLink(destination: DetailView(), isActive: $isActive) { }
NavigationLink(destination: DetailView(), tag: 1, selection: $selection) { }

// ✅ PREFERRED: Use NavigationStack with value-based links
NavigationLink(value: item) { Label }
```

## Non-Obvious Behaviors

1. **NavigationPath Type Erasure**: NavigationPath can hold mixed types but loses compile-time type safety
2. **Codable Requirement**: State restoration only works if all route types are Codable
3. **Threading Requirement**: Navigation mutations must happen on main thread (@MainActor)
4. **Memory Management**: NavigationPath holds strong references to appended values
5. **Binding Propagation**: Changes to NavigationPath don't automatically trigger SwiftUI updates unless properly bound
6. **Deep Link Validation**: Always validate routes exist before navigation to prevent crashes
7. **Tab View Integration**: Each tab needs separate NavigationPath instances for independent navigation stacks

## Migration Checklist

- [ ] Replace `NavigationView` with `NavigationStack`
- [ ] Convert `isActive`/`tag` NavigationLinks to value-based
- [ ] Add `navigationDestination(for:)` modifiers for each route type
- [ ] Implement Hashable on route types
- [ ] Add Codable for state restoration
- [ ] Test deep linking with URL schemes
- [ ] Verify iOS 17 compatibility (avoid array-based paths if possible)

## Version: iOS 16.0+ / iOS 17.0+
Last Updated: December 2024