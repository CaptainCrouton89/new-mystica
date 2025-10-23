# SwiftUI Drawer/Sheet UI Components LLM Reference

## Critical Native API Signatures (iOS 16+)

### PresentationDetents
```swift
func presentationDetents(
    _ detents: Set<PresentationDetent>,
    selection: Binding<PresentationDetent>? = nil
) -> some View

// Built-in detents
static let medium: PresentationDetent    // iOS 16+
static let large: PresentationDetent     // iOS 16+

// Custom detents
static func fraction(_ fraction: CGFloat) -> PresentationDetent  // iOS 16+
static func height(_ height: CGFloat) -> PresentationDetent     // iOS 16+
static func custom<D>(_ detent: D.Type) -> PresentationDetent   // iOS 16+
  where D: CustomPresentationDetent
```

### Additional Presentation Modifiers
```swift
func presentationDragIndicator(_ visibility: Visibility) -> some View
// .visible (default), .hidden, .automatic

func presentationBackground<S>(_ style: S) -> some View where S: ShapeStyle
// Custom background styling

func presentationBackgroundInteraction(
    _ interaction: PresentationBackgroundInteraction
) -> some View  // iOS 16.4+
// .enabled, .disabled, .enabled(upThrough: PresentationDetent)

func interactiveDismissDisabled(_ isDisabled: Bool = true) -> some View
// Prevents swipe-to-dismiss
```

## Custom Detent Implementation

```swift
struct CustomDetent: CustomPresentationDetent {
    static func height(in context: Context) -> CGFloat? {
        // context.maxDetentValue - maximum available height
        // Return nil for unsupported configurations
        return context.maxDetentValue * 0.3
    }
}

// Usage
.presentationDetents([.custom(CustomDetent.self)])
```

## Non-Obvious Behaviors & Gotchas

### Critical State Management
- **Selection binding persists across dismissals** - Sheet reopens at last selected detent
- **Selection must be optional Binding** - Required for tracking current detent
- **iOS 16.4 bug**: Changing selections can break detents entirely
  - **Workaround**: Add `.id()` modifier to force sheet recreation

### Environment Constraints
- **Compact height mode** (landscape iPhone): Automatically becomes `.large` regardless of detents
- **Custom detents return nil** for unsupported contexts - sheet falls back to `.large`
- **Multiple detents**: Users can drag between all specified sizes

### Performance Notes
- **UIKit mapping**: `.fraction()` and `.height()` create UIKit `.custom` detents
- **Built-in mapping**: `.medium`/`.large` map directly to UIKit equivalents
- **GeometryReader required** for responsive custom detents

## Side Drawer Implementation Patterns

### Basic Overlay Architecture
```swift
struct ContentView: View {
    @State private var showDrawer = false

    var body: some View {
        NavigationStack {
            ZStack {
                mainContent

                // Dimming overlay
                if showDrawer {
                    Color.black.opacity(0.3)
                        .ignoresSafeArea()
                        .onTapGesture { showDrawer = false }
                }

                // Drawer
                HStack {
                    if showDrawer {
                        drawerContent
                    }
                    Spacer()
                }
            }
        }
        .gesture(edgeSwipeGesture)
    }
}
```

### Edge Swipe Gesture Pattern
```swift
var edgeSwipeGesture: some Gesture {
    DragGesture()
        .onEnded { value in
            // Edge detection - start within 20pts of left edge
            if value.startLocation.x < 20 && value.translation.width > 50 {
                withAnimation(.easeOut(duration: 0.3)) {
                    showDrawer = true
                }
            }
            // Close gesture
            else if showDrawer && value.translation.width < -50 {
                withAnimation(.easeOut(duration: 0.3)) {
                    showDrawer = false
                }
            }
        }
}
```

## State Management Best Practices

### ObservableObject Pattern
```swift
@MainActor
class DrawerViewModel: ObservableObject {
    @Published var isOpen = false
    @Published var selectedDetent: PresentationDetent = .medium

    func toggle() {
        withAnimation(.easeInOut(duration: 0.3)) {
            isOpen.toggle()
        }
    }
}
```

### Environment Key Pattern
```swift
struct DrawerStateKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var isDrawerOpen: Bool {
        get { self[DrawerStateKey.self] }
        set { self[DrawerStateKey.self] = newValue }
    }
}
```

## Quick Implementation Reference

### Bottom Sheet (Minimal)
```swift
.sheet(isPresented: $showSheet) {
    SheetContent()
        .presentationDetents([.height(200), .medium])
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.enabled(upThrough: .medium))
}
```

### Side Drawer (Minimal)
```swift
ZStack(alignment: .leading) {
    MainContent()

    if showDrawer {
        SideDrawerContent()
            .frame(width: 280)
            .transition(.move(edge: .leading))
    }
}
.animation(.easeInOut, value: showDrawer)
```

## Third-Party Library Considerations

Most iOS 17+ projects should prefer native APIs over third-party libraries due to:
- **Native performance**: Direct UIKit integration
- **Future compatibility**: Apple's API evolution
- **Reduced dependencies**: Smaller app bundle size

Consider third-party only when requiring:
- Complex multi-directional drawers
- Advanced gesture combinations
- Non-standard presentation styles

## Version: iOS 17.0+ (presentationDetents: iOS 16.0+)