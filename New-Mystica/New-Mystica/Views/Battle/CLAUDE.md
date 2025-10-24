# Battle View Documentation

## Overview

The Battle view hierarchy manages turn-based combat UI, including attack/defense timing mechanics, weapon selection, and result visualization.

## Key Components

- **BattleView.swift** — Main battle container, orchestrates state and transitions
- **BattleTimingDial.swift** — Circular timing mechanic for attack/defense windows
- **BattleResultsView.swift** — Post-turn result display and damage/outcome summary
- **BattleWeaponSelectionView.swift** — Weapon picker with dial synchronization
- **BattleDefensePromptView.swift** — Defense phase UI with timing feedback
- **Components/** — Reusable timing and indicator UI elements

## Important Patterns

### Timing Dial Visibility
- Dial remains visible during attack transitions and defense prompts (not hidden/recreated)
- State: `@State var showTimingDial: Bool = true`
- Use `.opacity()` for transitions, not conditional rendering

### State Management
- Battle state lives in a parent coordinator/container
- Individual views are stateless presenters; avoid deep nesting of `@State`
- Use `@ObservedRealmObject` for realm entities, `@EnvironmentObject` for navigation

### Animation Timing
- Attack window: typically 3 seconds
- Defense window: typically 2 seconds
- Use `.animation(.easeInOut(duration:))` for dial sweeps

## Testing

Previews require:
```swift
.modelContainer(for: Item.self, inMemory: true)
.environmentObject(NavigationManager())
```

## See Also

- [docs/ai-docs/frontend.md](../../../docs/ai-docs/frontend.md) — SwiftUI patterns and navigation
- BattleView.swift — Main orchestrator for state flow
