# Components Directory

Reusable SwiftUI components for the New-Mystica app, organized by UI pattern and functionality.

## Directory Structure

- **ActionMenus/** - Context menus and action sheets for item/material interactions
- **Borders/** - Border and separator components
- **BottomDrawer/** - Bottom sheet/drawer UI components
- **InventoryItemDetailModal.swift** - Modal for detailed item inspection
- **MaterialDetailModal.swift** - Modal for material information display

## Component Patterns

All components follow SwiftUI conventions:
- Require `.modelContainer(for: Item.self, inMemory: true).environmentObject(NavigationManager())` in previews
- Use @Environment for theme/nav state when needed
- Prefer @Binding for state management over @State in modals
- Keep modals focused on single responsibility (detail view, not editing)

## Key Dependencies

- SwiftData for data models
- NavigationManager for routing
- SwiftUI (iOS 17+, macOS 14+)

## Notes

- Modal components should be stateless where possible
- Use environment objects to avoid excessive parameter passing
- Keep component files under 300 lines; extract subviews for complex UIs
