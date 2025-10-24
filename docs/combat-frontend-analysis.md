# Combat Frontend Implementation Analysis

## Overview
The SwiftUI frontend implements a turn-based combat system with timing mechanics, auto-resume functionality, and comprehensive state management.

## Core Architecture

### Files and Components
- `BattleView.swift` - Main combat screen UI (442 lines)
- `CombatViewModel.swift` - State management and API interactions (281 lines)
- `DefaultCombatRepository.swift` - Network layer implementation (275 lines)
- `Combat.swift` - Data models and enums (235 lines)
- **UI Components:**
  - `CombatActionButton.swift` - Attack/defend buttons
  - `HealthBarView.swift` - Animated health bars
  - `TimingDialView.swift` - Timing bonus mechanic (currently static)
  - `PlayerAvatarView.swift` & `EnemyAvatarView.swift` - Character avatars

## What the Combat Screen Actually Does

### User Interface
1. **Split Layout**: Enemy at top, player at bottom, combat info in center
2. **Health Bars**: Color-coded (green > orange > red) with animations
3. **Action Buttons**: Attack (hammer) and Defend (shield) with disabled states
4. **Turn Counter**: Circular display showing current turn number
5. **Recent Actions Log**: Last 3 actions with damage/result info
6. **Player Stats**: ATK/DEF/ACC values displayed
7. **Timing Dial**: Present but static (no spinning/interaction implemented)

### Combat Flow
1. **Initiation**: Auto-starts combat when view appears OR resumes existing session
2. **Turn-Based**: Player selects attack/defend → API call → enemy turn → repeat
3. **State Updates**: Refetches combat session after each action for updated HP
4. **Combat End**: Shows victory/defeat overlay with rewards
5. **Cleanup**: Clears active session from AppState, navigates back

## User Interactions

### Primary Actions
- **Attack Button**: Calls `/combat/attack` with timing score (hardcoded 0.8)
- **Defend Button**: Calls `/combat/defend` with timing score (hardcoded 0.8)
- **End Combat**: Triggers reward claiming and navigation back
- **Continue**: Claims rewards and returns to map

### Disabled States
- Buttons disabled during API calls (`viewModel.isLoading`)
- Buttons disabled when combat ended
- Actions disabled when `!viewModel.canAct`

## API Integration

### Endpoints Called
```swift
POST /combat/start         // Initialize new combat session
POST /combat/attack        // Player attack action
POST /combat/defend        // Player defense action
POST /combat/complete      // End combat and get rewards
GET  /combat/session/{id}  // Refetch updated combat state
POST /combat/abandon       // Abandon active session
GET  /combat/active-session // Check for existing session
```

### Data Flow
1. **Start**: `locationId` + `selectedLevel` → `CombatSession`
2. **Actions**: `sessionId` + `timingScore` → `CombatAction` + refetch session
3. **Complete**: `sessionId` + `won` → `CombatRewards`

## State Management

### CombatViewModel Properties
- `combatState: Loadable<CombatSession>` - Core combat data
- `rewards: Loadable<CombatRewards>` - Victory/defeat rewards
- `turnHistory: [CombatAction]` - UI-only action log
- `selectedAction` & `timingScore` - Currently unused
- **Computed**: `isInCombat`, `canAct`, `combatEnded`, `playerWon`

### AppState Integration
- `activeCombatSession: Loadable<CombatSession?>` - Global session tracking
- **Auto-Resume**: Checks AppState on view load, resumes if session exists
- **Session Cleanup**: Clears AppState when combat completes

## Current Implementation Gaps & Issues

### 🚨 Critical Issues
1. **Timing System Non-Functional**:
   - Timing dial renders but doesn't spin or respond to taps
   - All actions use hardcoded timing score (0.8)
   - No actual timing-based scoring implemented

2. **Session State Inconsistency**:
   - Frontend creates sessions vs backend auto-resume flow
   - HP calculations hardcoded (`defPower * 10`) vs server values
   - Status enum mismatches between API responses

### ⚠️ Implementation Problems
1. **Model Mapping Issues**:
   - `CombatStartResponse` manually converted to `CombatSession`
   - Missing fields filled with defaults/empty values
   - Type mismatches (string vs enum for status)

2. **Error Handling**:
   - Generic error states with no user-friendly messages
   - No retry mechanisms beyond initial load
   - Failed actions leave combat in unclear state

3. **UI/UX Issues**:
   - No loading states during actions (just button disable)
   - No visual feedback for timing success/failure
   - Static animations (idle breathing only)
   - No sound integration despite audio files present

### 🔧 Minor Issues
1. **Performance**: Refetches entire session after each action
2. **Accessibility**: No VoiceOver support for combat actions
3. **Testing**: Limited coverage of error scenarios and edge cases

## Architecture Strengths
- ✅ Clean separation: View → ViewModel → Repository → API
- ✅ Comprehensive state management with Loadable pattern
- ✅ Auto-resume functionality for session continuity
- ✅ Modular UI components for reusability
- ✅ Proper async/await usage throughout
- ✅ Observable pattern for reactive UI updates

## Key Patterns Used
- **Repository Pattern**: Protocol-based network abstraction
- **Loadable State**: Unified loading/error/success states
- **MVVM**: Clear separation of UI and business logic
- **Environment Objects**: AppState for global session tracking
- **Composition**: Extracted UI components for maintainability