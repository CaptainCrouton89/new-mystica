# SwiftUI Frontend Reference

## Navigation System Critical Rules

- **NavigationManager is singleton @MainActor:** NEVER create multiple instances, always use `@EnvironmentObject`
- **History management:** Max 10 items, tracks NavigationPath + currentDestination + viewHistory separately
- **Destination enum is source of truth:** Add cases to NavigationDestination:12-21 THEN ContentView switch:28-67
- **Path sync requirement:** navigateTo() appends to navigationPath AND updates currentDestination, navigateBack() pops both
- **History bug pattern:** Adding to history happens BEFORE navigation in navigateTo:65, not after
- **Environment injection:** New_MysticaApp.swift:31-32 creates singleton, ContentView:13 consumes it
- **Preview requirement:** ALL previews need `.modelContainer(for: Item.self, inMemory: true).environmentObject(NavigationManager())` - SwiftData container is for **preview environment only**, not for runtime persistence
- **SimpleNavigableView helper:** Auto-adds back button, but requires NavigationManager in environment

## Design System Enforcement

- **Color palette locked:** mysticaDarkBrown, mysticaLightBrown, mysticaLightBlue, mysticaGreen, mysticaOrange, mysticaRed (UI/Colors/Colors.swift)
- **Font requirement:** Impact font used in all buttons (ButtonComponents.swift:72), system fonts for body text
- **Component library:** TitleText, NormalText, IconButton, TextButton, PopupView - NEVER use raw Text/Button
- **Icon system:** SF Symbols via `Image(systemName:)`, custom mystica-icon-* for game assets
- **SwiftData (Previews Only):** SwiftData is NOT used for runtime persistence. New Mystica is online-only with no local caching. SwiftData `.modelContainer()` is used ONLY in SwiftUI previews to provide a test environment for components. See `frontend-state-management.md` for details on online-only architecture.

## External Dependencies

- **Google Maps SDK for iOS** - Required for map integration (F-01 Geolocation feature)
- **Installation:** Add via Swift Package Manager or CocoaPods (version not pinned)
- **Info.plist requirement:** Must include `NSLocationWhenInUseUsageDescription` key for GPS permission
- **Build issue:** If "GoogleMaps module not found", check Package Dependencies in Xcode project settings
- **CoreLocation framework** - Native iOS framework for GPS tracking, no installation needed

## View Creation Pattern

1. Create view file in `New-Mystica/New-Mystica/`
2. Add case to NavigationDestination enum (NavigationManager.swift:12-21)
3. Add case to ContentView.destinationView() switch (ContentView.swift:28-67)
4. Use `@EnvironmentObject var navigationManager: NavigationManager`
5. Call `navigationManager.navigateTo(.destination)` for navigation
6. Add preview with `.modelContainer(for: Item.self, inMemory: true).environmentObject(NavigationManager())`

## File Organization

- `UI/Components/` - TextComponents, ButtonComponents, PopupComponents
- `UI/Colors/Colors.swift` - mystica* color palette
- `UI/Previews/UIComponentsPreview.swift` - Component gallery
- Root views: ContentView (router), MainMenuView, MapView, CollectionView, BattleView, VictoryView, DefeatView
- `NavigationManager.swift` - Global singleton navigation
- `New_MysticaApp.swift` - App entry point

## Common Pitfalls

- **Navigation history bug** - Adding to history BEFORE navigation (line 65), not after - may cause issues
- **Multiple NavigationManagers** - Creating more than one breaks navigation state
- **Missing preview dependencies** - Previews crash without .modelContainer + .environmentObject
- **Color palette violations** - Using system colors breaks design consistency
- **Font violations** - Using non-Impact fonts in buttons breaks design
