# Battle View Documentation

## Overview

The Battle view manages turn-based combat UI with timing-based mechanics, attack/defense phases, and real-time feedback. Consolidated structure with state machine orchestration.

## File Structure

- **BattleView.swift** — Main container with phase state machine, feedback logic, and UI composition (445 lines)
- **BattleSubviews.swift** — Extracted UI components: combat content, rewards, enemy/player sections, controls
- **BattleModels.swift** — Data models: `DamageInfo` struct, `CombatPhase` enum
- **Components/** — Reusable timing and indicator UI elements

## Key Patterns

### State Machine
- Phase-driven: `CombatPhase.playerAttack` → `playerDefense` → repeat
- `currentPhase` state drives UI transitions and phase-specific status text
- `transitionToPhase()` handles phase logic atomically

### Timing Dial Visibility
- `dialVisible` flag controls rendering (persistent across transitions)
- Dial remains visible using `.opacity()`, not conditional rendering
- Clear spacer maintains layout when dial is hidden

### Action Feedback Loop
1. User taps dial → `handleDialTap(degrees:)` fires
2. Backend processes action → returns updated combat state
3. `showAttackFeedback()` or `showDefenseFeedback()` triggers animations
4. `FloatingTextView` displays damage/blocked numbers

### Session Management
- Auto-resume from `AppState.activeCombatSession` on load
- Fallback to create new session if location ID provided
- Backend owns all game logic; frontend is state presenter

## State Variables

| Variable | Purpose |
|----------|---------|
| `currentPhase` | Controls combat flow and instruction text |
| `dialVisible` | Render timing dial (toggled on phase transitions) |
| `isDialSpinning` | Dial animation controller |
| `showDefensePrompt` | "DEFEND NOW!" alert display |
| `enemyGlowing` / `showShield` | Visual feedback during phases |
| `floatingTextManager` | Floating damage/blocked numbers |

## Testing

Previews require:
```swift
.environmentObject(NavigationManager())
.environmentObject(AudioManager.shared)
.environment(AppState.shared)
```

## See Also

- [docs/ai-docs/frontend.md](../../../docs/ai-docs/frontend.md) — SwiftUI patterns and navigation
