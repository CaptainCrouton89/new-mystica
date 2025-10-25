# Combat Enemy Commentary - Implementation Plan

**Date:** 2025-10-24
**Status:** Ready for Implementation
**Type:** Frontend Integration + Backend Enhancement
**Complexity:** Medium

## Executive Summary

Integrate AI-generated enemy commentary into combat by making the frontend call the existing `/combat/enemy-chatter` endpoint in parallel with attack/defense actions. Commentary generates in the background (500-2000ms) and displays when ready, without blocking combat flow.

**Key Decision:** Use existing backend endpoint with frontend-driven parallel execution rather than modifying combat action responses. This approach is simpler, non-blocking, and requires no backend changes.

## Problem Statement

The backend has a fully implemented `EnemyChatterService` that generates contextual, personality-driven enemy dialogue using OpenAI GPT-4.1-mini, but:
- ❌ Commentary is never displayed to players
- ❌ `/combat/enemy-chatter` endpoint exists but isn't called during combat
- ❌ No UI component exists to show dialogue
- ❌ No integration between combat actions and commentary generation

**Desired State:**
- ✅ Enemy commentary displays during combat (speech bubbles)
- ✅ Commentary generation is non-blocking (doesn't slow combat)
- ✅ Dialogue appears 500-2000ms after action (parallel execution)
- ✅ Commentary errors are caught and logged, but don't crash the app

## Investigation Summary

### Backend Analysis

**EnemyChatterService** (`mystica-express/src/services/EnemyChatterService.ts`):
- ✅ Fully implemented AI dialogue generation
- ✅ 8 combat event types: `combat_start`, `player_hit`, `player_miss`, `enemy_hit`, `low_player_hp`, `near_victory`, `victory`, `defeat`
- ✅ Context-aware prompting with enemy personality, combat stats, player history
- ✅ 2-second timeout - throws `ExternalAPIError` on failure
- ✅ Logging to `enemychatterlog` table

**Existing Endpoint:** `POST /combat/enemy-chatter`
```typescript
Request:
{
  session_id: string,
  event_type: CombatEventType,
  event_details: {
    turn_number: number,
    player_hp_pct: number,
    enemy_hp_pct: number,
    damage?: number,
    is_critical?: boolean
  }
}

Response:
{
  success: true,
  dialogue_response: {
    dialogue: "Is that the best you can do?",
    dialogue_tone: "mocking",
    enemy_type: "Spray Paint Goblin",
    generation_time_ms: 1250,
    was_ai_generated: true
  },
  cached: false
}
```

**Combat Flow** (`CombatService.executeAttack/executeDefense`):
- Frontend calls `attack()` → returns `AttackResult` immediately
- `AttackResult` includes: `hit_zone`, `damage_dealt`, `player_hp_remaining`, `enemy_hp_remaining`, `combat_status`, `rewards`
- ❌ Does NOT include dialogue
- ❌ Does NOT call `EnemyChatterService`

### Frontend Analysis

**CombatViewModel** (`New-Mystica/ViewModels/CombatViewModel.swift`):
```swift
func attack(tapPositionDegrees: Float) async {
    let action = try await repository.performAttack(sessionId, tapPositionDegrees)
    turnHistory.append(action)
    updateCombatStateFromAction(action)
    // ❌ No commentary fetch
}
```

**BattleView** (`New-Mystica/Views/Battle/BattleView.swift`):
- ✅ Enemy section with health bar, avatar, level badge
- ✅ Floating damage text system (`FloatingTextView`)
- ✅ Visual feedback (glows, shakes, shield effects)
- ❌ No dialogue bubble component
- ❌ No dialogue state management

## Recommended Approach: Frontend-Driven Parallel Execution

### Architecture Decision

**Pattern:** Frontend calls commentary endpoint in parallel with UI updates

**Flow:**
```
Player taps attack
    ↓
Frontend calls attack() API ──→ Returns AttackResult (50-100ms)
    ↓                              ↓
    ├──→ Update HP, damage       ├──→ Play animations
    ├──→ Fire commentary request ←─┘
    ↓         (parallel)
Commentary generates (500-2000ms)
    ↓
Speech bubble appears when ready
```

**Why This Approach:**
- ✅ **Zero backend changes** - uses existing `/combat/enemy-chatter` endpoint
- ✅ **Truly non-blocking** - commentary doesn't delay combat actions
- ✅ **Parallel execution** - commentary generates while animations play
- ✅ **Fail-fast error handling** - errors caught and logged, no silent failures
- ✅ **Simple implementation** - isolated to frontend ViewModel changes
- ✅ **Testable** - can mock commentary responses easily

**Alternatives Rejected:**

1. **Modify combat action responses to include dialogue:**
   - ❌ Blocks combat actions for 500-2000ms (AI generation time)
   - ❌ Requires backend refactoring of `CombatService`
   - ❌ Tight coupling between combat mechanics and commentary

2. **Backend fire-and-forget with polling:**
   - ❌ Requires new caching infrastructure
   - ❌ More complex state management
   - ❌ No clear benefit over direct endpoint call

3. **WebSocket/SSE streaming:**
   - ❌ Over-engineered for MVP
   - ❌ Adds infrastructure complexity

## Implementation Plan

### Phase 1: Backend Preparation (Optional - Future Enhancement)

**Current State:** Backend is ready to use as-is with existing endpoint.

**Optional Future Enhancement:** Add commentary generation to combat actions
```typescript
// In CombatService.executeAttack()
async executeAttack(sessionId: string, tapPositionDegrees: number): Promise<AttackResult> {
  // ... existing damage calculation ...

  // Optional: Fire commentary in background (don't await)
  this.generateCommentaryAsync(sessionId, eventType, eventDetails);

  return attackResult; // Return immediately
}
```

**Decision:** Skip for MVP - frontend-driven approach is simpler and non-blocking.

### Phase 2: Frontend Integration

#### 2.1 Update CombatViewModel

**File:** `New-Mystica/ViewModels/CombatViewModel.swift`

**Changes:**
```swift
@Observable
final class CombatViewModel {
    // ... existing state ...

    // NEW: Commentary state
    var currentDialogue: DialogueData? = nil
    var isGeneratingDialogue: Bool = false

    func attack(tapPositionDegrees: Float) async {
        guard case .loaded(let session) = combatState else { return }
        guard !isLoading else { return }

        let currentSession = session
        isProcessingAction = true

        do {
            let action = try await repository.performAttack(
                sessionId: currentSession.sessionId,
                tapPositionDegrees: tapPositionDegrees
            )

            // Add to turn history
            turnHistory.append(action)

            // Update combat state
            updateCombatStateFromAction(action, previousSession: currentSession)

            // NEW: Fetch commentary in parallel (non-blocking)
            Task {
                await fetchCommentary(for: action, session: currentSession)
            }

            // Handle combat end states
            if action.combatStatus == .victory {
                // ... existing victory logic ...
            } else if action.combatStatus == .defeat {
                // ... existing defeat logic ...
            }

            isProcessingAction = false
        } catch {
            // ... existing error handling ...
        }
    }

    func defend(tapPositionDegrees: Float) async {
        // Similar pattern to attack()
        // ... existing logic ...

        // NEW: Fetch commentary in parallel
        Task {
            await fetchCommentary(for: action, session: currentSession)
        }
    }

    // NEW: Fetch commentary from backend
    private func fetchCommentary(for action: CombatAction, session: CombatSession) async {
        guard let eventType = determineEventType(from: action) else {
            return // Skip commentary for certain actions
        }

        isGeneratingDialogue = true

        do {
            let eventDetails = buildEventDetails(from: action, session: session)

            let dialogue = try await repository.fetchEnemyChatter(
                sessionId: session.sessionId,
                eventType: eventType,
                eventDetails: eventDetails
            )

            // Update UI on main thread
            await MainActor.run {
                withAnimation(.easeIn(duration: 0.3)) {
                    self.currentDialogue = DialogueData(
                        text: dialogue.dialogue,
                        tone: dialogue.dialogueTone
                    )
                }

                // Auto-dismiss after 2.5 seconds
                Task {
                    try? await Task.sleep(nanoseconds: 2_500_000_000) // 2.5s
                    withAnimation(.easeOut(duration: 0.5)) {
                        self.currentDialogue = nil
                    }
                }
            }

            isGeneratingDialogue = false
        } catch {
            // Commentary is optional - log error but don't crash
            isGeneratingDialogue = false
            logger.error("Commentary fetch failed: \(error)")
            // Error is logged, dialogue simply won't appear
        }
    }

    // NEW: Map action to event type
    private func determineEventType(from action: CombatAction) -> CombatEventType? {
        switch action.type {
        case .attack:
            if action.damageDealt == 0 || action.hitZone == "miss" {
                return .player_miss
            } else if action.combatStatus == .victory {
                return .victory
            } else {
                return .player_hit
            }
        case .defend:
            if action.combatStatus == .defeat {
                return .defeat
            } else {
                return .enemy_hit
            }
        default:
            return nil
        }
    }

    // NEW: Build event details from action
    private func buildEventDetails(from action: CombatAction, session: CombatSession) -> CombatEventDetails {
        let maxPlayerHP = session.playerStats.hp
        let maxEnemyHP = session.enemy.stats.defPower * 10 // Simplified HP calc

        return CombatEventDetails(
            turn_number: action.turnNumber ?? 1,
            player_hp_pct: (action.playerHpRemaining ?? 0) / maxPlayerHP,
            enemy_hp_pct: (action.enemyHpRemaining ?? 0) / maxEnemyHP,
            damage: action.damageDealt,
            is_critical: action.hitZone == "crit"
        )
    }
}
```

#### 2.2 Add Repository Method

**File:** `New-Mystica/Repositories/Implementations/DefaultCombatRepository.swift`

**Changes:**
```swift
func fetchEnemyChatter(
    sessionId: String,
    eventType: CombatEventType,
    eventDetails: CombatEventDetails
) async throws -> EnemyDialogueResponse {
    struct ChatterRequest: Encodable {
        let sessionId: String
        let eventType: String
        let eventDetails: EventDetails

        struct EventDetails: Encodable {
            let turnNumber: Int
            let playerHpPct: Double
            let enemyHpPct: Double
            let damage: Double?
            let isCritical: Bool?

            enum CodingKeys: String, CodingKey {
                case turnNumber = "turn_number"
                case playerHpPct = "player_hp_pct"
                case enemyHpPct = "enemy_hp_pct"
                case damage
                case isCritical = "is_critical"
            }
        }

        enum CodingKeys: String, CodingKey {
            case sessionId = "session_id"
            case eventType = "event_type"
            case eventDetails = "event_details"
        }
    }

    struct ChatterResponse: Decodable {
        let success: Bool
        let dialogueResponse: EnemyDialogueResponse
        let cached: Bool

        enum CodingKeys: String, CodingKey {
            case success
            case dialogueResponse = "dialogue_response"
            case cached
        }
    }

    let request = ChatterRequest(
        sessionId: sessionId,
        eventType: eventType.rawValue,
        eventDetails: ChatterRequest.EventDetails(
            turnNumber: eventDetails.turnNumber,
            playerHpPct: eventDetails.playerHpPct,
            enemyHpPct: eventDetails.enemyHpPct,
            damage: eventDetails.damage,
            isCritical: eventDetails.isCritical
        )
    )

    let response: ChatterResponse = try await apiClient.post(
        endpoint: "/combat/enemy-chatter",
        body: request
    )

    return response.dialogueResponse
}
```

#### 2.3 Add Models

**File:** `New-Mystica/Models/Combat.swift`

**Changes:**
```swift
// NEW: Dialogue data model
struct DialogueData: Codable, Equatable {
    let text: String
    let tone: String
}

// NEW: Enemy dialogue response from backend
struct EnemyDialogueResponse: Decodable {
    let dialogue: String
    let dialogueTone: String
    let enemyType: String
    let generationTimeMs: Int
    let wasAiGenerated: Bool

    enum CodingKeys: String, CodingKey {
        case dialogue
        case dialogueTone = "dialogue_tone"
        case enemyType = "enemy_type"
        case generationTimeMs = "generation_time_ms"
        case wasAiGenerated = "was_ai_generated"
    }
}

// NEW: Combat event types
enum CombatEventType: String, Codable {
    case combat_start = "combat_start"
    case player_hit = "player_hit"
    case player_miss = "player_miss"
    case enemy_hit = "enemy_hit"
    case low_player_hp = "low_player_hp"
    case near_victory = "near_victory"
    case victory = "victory"
    case defeat = "defeat"
}

// NEW: Event details for commentary
struct CombatEventDetails {
    let turnNumber: Int
    let playerHpPct: Double
    let enemyHpPct: Double
    let damage: Double?
    let isCritical: Bool?
}
```

#### 2.4 Create Dialogue Bubble Component

**File:** `New-Mystica/Views/Battle/Components/EnemyDialogueBubble.swift` (NEW)

**Implementation:**
```swift
import SwiftUI

struct EnemyDialogueBubble: View {
    let text: String
    let tone: String

    var body: some View {
        VStack(spacing: 0) {
            // Speech bubble
            Text(text)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.white)
                .multilineTextAlignment(.center)
                .lineLimit(3)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.black.opacity(0.8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(toneColor.opacity(0.5), lineWidth: 1)
                        )
                )

            // Tail (triangle pointing down)
            Triangle()
                .fill(Color.black.opacity(0.8))
                .frame(width: 16, height: 8)
                .offset(y: -1)
        }
        .shadow(color: .black.opacity(0.3), radius: 4, x: 0, y: 2)
    }

    private var toneColor: Color {
        switch tone.lowercased() {
        case "confident":
            return .blue
        case "angry":
            return .red
        case "mocking":
            return .yellow
        case "desperate":
            return .orange
        case "victorious":
            return .green
        default:
            return .white
        }
    }
}

// Triangle shape for speech bubble tail
struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.closeSubpath()
        return path
    }
}

#Preview {
    VStack(spacing: 20) {
        EnemyDialogueBubble(text: "Is that the best you can do?", tone: "mocking")
        EnemyDialogueBubble(text: "You got lucky that time!", tone: "angry")
        EnemyDialogueBubble(text: "This can't be happening!", tone: "desperate")
    }
    .padding()
    .background(Color.gray.opacity(0.2))
}
```

#### 2.5 Integrate Bubble into BattleView

**File:** `New-Mystica/Views/Battle/BattleView.swift`

**Changes:**
```swift
// In enemy section (around line 100-150)
VStack(spacing: 12) {
    // Enemy health bar
    HealthBar(
        current: viewModel.enemyHP,
        maximum: viewModel.currentEnemy?.stats.defPower ?? 100
    )

    // NEW: Dialogue bubble (appears above enemy)
    if let dialogue = viewModel.currentDialogue {
        EnemyDialogueBubble(text: dialogue.text, tone: dialogue.tone)
            .transition(.asymmetric(
                insertion: .opacity.combined(with: .scale(scale: 0.8)),
                removal: .opacity
            ))
            .padding(.bottom, 8)
    }

    // Enemy avatar
    EnemyAvatarView(/* ... */)

    // ... rest of enemy section ...
}
```

### Phase 3: Combat Start Commentary

**File:** `New-Mystica/ViewModels/CombatViewModel.swift`

**Changes:**
```swift
func initializeOrResumeCombat(locationId: String? = nil, selectedLevel: Int = 1) async {
    combatState = .loading
    // ... existing session creation logic ...

    if let session = activeSession {
        combatState = .loaded(session)

        // NEW: Fetch combat_start commentary
        Task {
            await fetchCombatStartCommentary(session: session)
        }
    }
}

private func fetchCombatStartCommentary(session: CombatSession) async {
    do {
        let eventDetails = CombatEventDetails(
            turnNumber: 0,
            playerHpPct: 1.0,
            enemyHpPct: 1.0,
            damage: nil,
            isCritical: nil
        )

        let dialogue = try await repository.fetchEnemyChatter(
            sessionId: session.sessionId,
            eventType: .combat_start,
            eventDetails: eventDetails
        )

        await MainActor.run {
            withAnimation {
                self.currentDialogue = DialogueData(
                    text: dialogue.dialogue,
                    tone: dialogue.dialogueTone
                )
            }
        }
    } catch {
        logger.error("Combat start commentary failed: \(error)")
        // Error is logged, combat continues without start commentary
    }
}
```

## Testing Strategy

### Unit Tests

**File:** `New-Mystica/Tests/ViewModels/CombatViewModelTests.swift`

```swift
func testAttackFetchesCommentary() async {
    let mockRepo = MockCombatRepository()
    mockRepo.attackResult = AttackResult(/* ... */)
    mockRepo.chatterResponse = EnemyDialogueResponse(
        dialogue: "You got lucky!",
        dialogueTone: "angry",
        enemyType: "Goblin",
        generationTimeMs: 1000,
        wasAiGenerated: true
    )

    let viewModel = CombatViewModel(repository: mockRepo)

    await viewModel.attack(tapPositionDegrees: 45)

    // Wait for commentary task to complete
    try? await Task.sleep(nanoseconds: 100_000_000) // 100ms

    XCTAssertEqual(viewModel.currentDialogue?.text, "You got lucky!")
    XCTAssertEqual(viewModel.currentDialogue?.tone, "angry")
}

func testAttackContinuesWhenCommentaryFails() async {
    let mockRepo = MockCombatRepository()
    mockRepo.attackResult = AttackResult(/* ... */)
    mockRepo.shouldFailChatter = true

    let viewModel = CombatViewModel(repository: mockRepo)

    await viewModel.attack(tapPositionDegrees: 45)

    // Combat should still complete successfully
    XCTAssertNil(viewModel.currentDialogue)
    XCTAssertEqual(viewModel.turnHistory.count, 1)
}

func testDialogueAutoDismisses() async {
    let viewModel = CombatViewModel()
    viewModel.currentDialogue = DialogueData(text: "Test", tone: "confident")

    // Wait 3 seconds (2.5s + 0.5s buffer)
    try? await Task.sleep(nanoseconds: 3_000_000_000)

    XCTAssertNil(viewModel.currentDialogue)
}
```

### Integration Tests

**Manual Testing Scenarios:**

1. **Test Commentary Timing (Non-Blocking)**
   - Start combat
   - Perform attack
   - Verify attack completes immediately (damage updates, animations play)
   - Verify speech bubble appears 0.5-2s later
   - Verify bubble auto-dismisses after 2.5s

2. **Test Commentary Failure Handling**
   - Disable network or mock timeout
   - Perform attack
   - Verify combat continues normally
   - Verify no error shown to user
   - Verify no speech bubble appears

3. **Test All Event Types**
   - Combat start → verify enemy taunt
   - Critical hit → verify appropriate commentary
   - Near defeat (enemy low HP) → verify desperate tone
   - Victory → verify final taunt
   - Defeat → verify enemy gloat

4. **Test Visual Polish**
   - Verify bubble doesn't overlap health bars
   - Verify bubble animation is smooth (fade-in/out)
   - Verify text is readable (size, contrast)
   - Verify tail points to enemy avatar

## Performance Considerations

### Latency Analysis

**Current Combat Action:**
- Attack API call: ~50-100ms
- UI updates: immediate

**With Commentary (Parallel):**
- Attack API call: ~50-100ms (unchanged)
- UI updates: immediate (unchanged)
- Commentary fetch: 500-2000ms (runs in background)
- Speech bubble appears: when commentary ready

**Impact:** Zero impact on combat responsiveness. Commentary is purely additive.

### Error Budget

**AI Generation Timeout:** 2 seconds (backend enforced)
- If exceeded, backend throws `ExternalAPIError`
- Frontend catches error and logs with `logger.error()`
- Combat continues without commentary (error logged, not suppressed)

**Network Timeout:** 5 seconds (iOS default URLSession timeout)
- If exceeded, request fails with network error
- Frontend catches error and logs with `logger.error()`
- No retry (commentary is optional, error is logged not hidden)

### Cost Monitoring

**OpenAI API Costs:**
- ~$0.0001-0.0005 per commentary generation
- Average combat: 10-20 actions × $0.0003 = $0.003-0.006/combat
- Acceptable for MVP

**Monitoring:**
- All commentary attempts logged to `enemychatterlog` table
- Track success rate, generation time, cost

## Rollout Plan

### Phase 1: MVP (This Plan)
- ✅ Commentary on attack/defense actions
- ✅ Combat start taunt
- ✅ Victory/defeat commentary
- ✅ Speech bubble UI
- ✅ Non-blocking parallel execution

### Phase 2: Enhancements (Future)
- HP threshold triggers (`low_player_hp`, `near_victory`)
- Tone-based visual styling (color-coded bubbles)
- Commentary history panel
- Settings toggle for frequency
- Pre-generation at combat start (optimization)

### Phase 3: Polish (Future)
- Voice acting / text-to-speech
- More enemy personalities (expand beyond 5 types)
- Player response emotes
- Dialogue customization settings

## Success Metrics

**Functional:**
- ✅ Commentary displays on all combat actions
- ✅ Combat actions complete in <100ms (unchanged from current)
- ✅ Commentary appears within 2 seconds of action
- ✅ No errors/crashes when commentary fails
- ✅ Speech bubble is readable and doesn't block UI

**User Experience:**
- ✅ Commentary enhances immersion (qualitative)
- ✅ Dialogue reflects enemy personality
- ✅ Commentary doesn't feel spammy (gather user feedback)

**Technical:**
- ✅ Commentary success rate >80%
- ✅ Average generation time <1.5s
- ✅ Zero impact on combat action latency
- ✅ Graceful degradation on failures

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI generation latency | Commentary feels slow | 2s timeout, show immediately when ready |
| Commentary feels spammy | Annoying to players | Start with all events, add filtering later |
| OpenAI API costs | Budget overrun | Monitor via logs, ~$0.003/combat acceptable |
| Speech bubble occlusion | Covers important UI | Position above enemy, below health bar |
| Network failures | Missing commentary | Silent fail, combat continues normally |

## File Changes Summary

### New Files
- `New-Mystica/Views/Battle/Components/EnemyDialogueBubble.swift` - Speech bubble UI

### Modified Files
- `New-Mystica/ViewModels/CombatViewModel.swift` - Add commentary fetch logic
- `New-Mystica/Repositories/Implementations/DefaultCombatRepository.swift` - Add fetchEnemyChatter()
- `New-Mystica/Models/Combat.swift` - Add DialogueData, CombatEventType, EnemyDialogueResponse
- `New-Mystica/Views/Battle/BattleView.swift` - Display dialogue bubble
- `New-Mystica/Repositories/Protocols/CombatRepository.swift` - Add fetchEnemyChatter signature

### No Backend Changes Required
- ✅ `/combat/enemy-chatter` endpoint already exists and works
- ✅ `EnemyChatterService` fully implemented
- ✅ All backend infrastructure ready

## Related Documentation

- **Requirements:** `docs/plans/combat-enemy-commentary/requirements.md`
- **Investigation:** `docs/plans/combat-enemy-commentary/investigations/combat-system-investigation.md`
- **Backend Docs:** `docs/ai-docs/backend.md`
- **Frontend Docs:** `docs/ai-docs/frontend.md`
- **Service Layer:** `mystica-express/src/services/CLAUDE.md`

## Open Questions

- **Q:** Should we show commentary on every action or filter by importance?
  **A:** Start with all actions, gather user feedback, add client-side filtering if needed

- **Q:** Should we pre-generate commentary at combat start for all possible events?
  **A:** No - adds complexity, not needed for MVP. Consider if latency becomes issue.

- **Q:** Should we add a toggle in settings to disable commentary?
  **A:** Yes, but post-MVP. Start with always-on to gather usage data.

## Next Steps

1. Implement `EnemyDialogueBubble` component
2. Add commentary fetch logic to `CombatViewModel`
3. Add repository method for `/combat/enemy-chatter` endpoint
4. Update models with new types
5. Integrate bubble into `BattleView`
6. Write unit tests
7. Manual testing across all event types
8. Gather user feedback on frequency/timing
