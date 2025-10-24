# CLAUDE.md

SwiftUI reusable component library for New-Mystica app.

## Component Patterns

**Structure**:
- One component per file, named `ComponentName.swift`
- All components use `@ViewBuilder` for flexible content
- Prefer composition over inheritance (SwiftUI idiomatic)

**Preview Requirements**:
- Every component MUST include `#Preview` block
- Previews MUST include `.modelContainer(for: Item.self, inMemory: true)` for SwiftData
- Previews MUST include `.environmentObject(NavigationManager())` for navigation context
- Failure to include these causes crashes

**State Management**:
- Use `@State` for local component state only
- Use `@EnvironmentObject` for global state (NavigationManager, GameState)
- Use `@Binding` for parent-controlled properties
- Avoid `@ObservedRealmObject` directly—wrap in view model if needed

**Styling**:
- Use `.font(.system(...))` for typography consistency
- Color palette: Reference main app color scheme in parent views
- Padding/spacing: Use consistent multiples (8pt, 16pt, 24pt)

**Reusability**:
- Generic components accept `@ViewBuilder` closures for content
- Support both iOS and macOS (use `#if os(iOS)` guards sparingly)
- Keep components small—break complex UIs into sub-components

## Files in This Directory

- `GoldBalanceView.swift` - Displays player gold balance with icon
- `ItemCell.swift` - Inventory item cell with image, name, stats
- `InventoryView.swift` - Grid/list inventory with filtering
- `BattleRewardView.swift` - Post-battle loot display
- `NavigationButton.swift` - Custom button with state styling
- `StatDisplay.swift` - Stat rows (HP, ATK, DEF, etc.)
- `LoadingSpinner.swift` - Loading animation overlay
- `ErrorView.swift` - Error message display with retry
- `EmptyStateView.swift` - Empty collection placeholder

## Common Issues

**Preview crashes**: Missing `.modelContainer()` or `.environmentObject()`. Always include both.

**Navigation state**: Use `@EnvironmentObject(NavigationManager())` to access route state.

**Data persistence**: SwiftData queries use `@Query` macro with sort/filter parameters.

## See Also

- Parent frontend docs: [docs/ai-docs/frontend.md](../../../docs/ai-docs/frontend.md)
- Navigation patterns: [Views/Navigation/](../Navigation/)
