# SwiftUI Modals & Sheets LLM Reference

## Critical Signatures

### Sheet Modifier (Boolean)
```swift
func sheet<Content>(
    isPresented: Binding<Bool>,
    onDismiss: (() -> Void)? = nil,
    @ViewBuilder content: @escaping () -> Content
) -> some View where Content : View
```

### Sheet Modifier (Item-based)
```swift
func sheet<Item, Content>(
    item: Binding<Item?>,
    onDismiss: (() -> Void)? = nil,
    @ViewBuilder content: @escaping (Item) -> Content
) -> some View where Item : Identifiable, Content : View
```

### Full Screen Cover
```swift
func fullScreenCover<Content>(
    isPresented: Binding<Bool>,
    onDismiss: (() -> Void)? = nil,
    @ViewBuilder content: @escaping () -> Content
) -> some View where Content : View
```

### Confirmation Dialog (Basic)
```swift
func confirmationDialog(
    _ title: String,
    isPresented: Binding<Bool>,
    titleVisibility: Visibility = .automatic,
    actions: () -> ActionsContent
)

func confirmationDialog(
    _ title: String,
    isPresented: Binding<Bool>,
    titleVisibility: Visibility = .automatic,
    actions: () -> ActionsContent,
    message: () -> MessageContent
)
```

### Presentation Detents (iOS 16+)
```swift
func presentationDetents(_ detents: Set<PresentationDetent>) -> some View
func presentationDetents(_ detents: Set<PresentationDetent>, selection: Binding<PresentationDetent>) -> some View

// Detent types:
PresentationDetent.medium        // ~50% screen height
PresentationDetent.large         // Full height (default)
PresentationDetent.fraction(0.3) // 30% of screen height
PresentationDetent.height(200)   // Exact height in points
```

## State Management Patterns

### Environment Dismiss (iOS 15+)
```swift
@Environment(\.dismiss) private var dismiss

// Usage:
Button("Close") { dismiss() }
```

**CRITICAL**: `@Environment(\.dismiss)` replaces deprecated `@Environment(\.presentationMode)`. For iOS 14 compatibility:
```swift
@Environment(\.presentationMode) var presentationMode
// Then: presentationMode.wrappedValue.dismiss()
```

### Multiple Sheet Coordination
**CONSTRAINT**: Only ONE sheet can be active at a time per view hierarchy.

```swift
enum SheetType: Identifiable {
    case add, edit(Item)
    var id: String { /* implementation */ }
}

@State private var presentedSheet: SheetType?

// Usage:
.sheet(item: $presentedSheet) { sheet in
    switch sheet {
    case .add: AddView()
    case .edit(let item): EditView(item: item)
    }
}
```

**GOTCHA**: Sharing the same `Binding<Bool>` between multiple sheets causes undefined behavior.

## Environment Variables

### Dismiss Action (iOS 15+)
```swift
@Environment(\.dismiss) private var dismiss: DismissAction
```
- Replaces `presentationMode.wrappedValue.dismiss()`
- Works with sheets, full screen covers, and navigation pops
- Calling on non-presented view has NO effect
- Uses `callAsFunction()` - can call directly: `dismiss()`

### Legacy Presentation Mode (iOS 14 and earlier)
```swift
@Environment(\.presentationMode) var presentationMode: Binding<PresentationMode>
// Dismiss: presentationMode.wrappedValue.dismiss()
```

## Version Compatibility

### iOS 15+
- `@Environment(\.dismiss)` introduced
- `presentationMode` deprecated but still functional

### iOS 16+
- `presentationDetents()` modifier
- Bottom sheet support without UIKit bridging
- `.medium`, `.large`, `.fraction()`, `.height()` detents

### iOS 17+
- `.dialogIcon` and `.dialogSuppressionToggle` for confirmation dialogs
- Cross-platform availability (iOS/macOS)
- Bug fix: Simultaneous alert/sheet presentation now works

### iOS 18
- Enhanced small sheet handling
- Improved detent behavior in landscape

## Common Gotchas

### Multiple Sheets
```swift
// ❌ WRONG - Only last sheet will work
.sheet(isPresented: $showFirst) { FirstView() }
.sheet(isPresented: $showSecond) { SecondView() }

// ✅ CORRECT - Use enum-based approach
.sheet(item: $activeSheet) { sheet in /* switch */ }
```

### Binding Constraints
- Item-based sheets require `Identifiable` conformance
- Setting `item` to `nil` automatically dismisses sheet
- Setting `isPresented` to `false` automatically dismisses sheet

### SwiftData Issues (iOS 17+)
**BUG**: Using `@Query` with `sheet(item:)` causes:
- Sheet stays open ~13 seconds after model insertion
- Double invocation when setting item
- Workaround: Use separate state management

### Presentation Detents Gotchas
- **Landscape**: `.medium` automatically becomes `.large`
- **Order irrelevant**: Smallest detent used for initial presentation
- **Drag indicator**: Automatically added with multiple detents
- **Custom detents**: `.fraction(x)` where x ∈ [0.0, 1.0]

### Dismissal Timing
- `onDismiss` closure may have delay with button dismissal (vs swipe)
- Background interaction disabled during dismissal animation
- Programmatic dismissal is immediate

## Practical Examples

### Basic Sheet with Detents
```swift
.sheet(isPresented: $showSheet) {
    ContentView()
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
}
```

### Confirmation Dialog with Message
```swift
.confirmationDialog(
    "Delete Item",
    isPresented: $showingDeleteDialog,
    titleVisibility: .visible
) {
    Button("Delete", role: .destructive) { /* action */ }
    Button("Cancel", role: .cancel) { }
} message: {
    Text("This action cannot be undone")
}
```

### Multi-Modal Coordinator Pattern
```swift
class SheetCoordinator: ObservableObject {
    @Published var activeSheet: SheetType?

    func present(_ sheet: SheetType) {
        activeSheet = sheet
    }

    func dismiss() {
        activeSheet = nil
    }
}
```

## Version: iOS 17.4+ / SwiftUI 5.0+