# Implementation Plan – Combat Enemy Commentary

# Overview
overview:
  related_items:
    feature_specs: []
    user_stories: []
    user_flows: []
  related_docs: |
    - "docs/plans/combat-enemy-commentary/requirements.md"
    - "docs/plans/combat-enemy-commentary/investigations/combat-system-investigation.md"
    - "docs/ai-docs/backend.md"
    - "docs/ai-docs/frontend.md"
    - "mystica-express/src/services/CLAUDE.md"

# Problem (for fixes/refactors)
problem: |
  The backend has a fully implemented `EnemyChatterService` that generates contextual, personality-driven enemy dialogue using OpenAI GPT-4.1-mini, but:
  - Commentary is never displayed to players
  - `/combat/enemy-chatter` endpoint exists but isn't called during combat
  - No UI component exists to show dialogue
  - No integration between combat actions and commentary generation

# Solution
solution: |
  Integrate AI-generated enemy commentary into combat by making the frontend call the existing `/combat/enemy-chatter` endpoint in parallel with attack/defense actions. Commentary generates in the background (500-2000ms) and displays in a speech bubble, without blocking combat flow. Frontend-driven parallel execution requires no backend changes.

# Current System
current_system:
  description: |
    Backend has fully implemented `EnemyChatterService.ts` with AI dialogue generation for 8 combat event types (combat_start, player_hit, player_miss, enemy_hit, low_player_hp, near_victory, victory, defeat). Existing `/combat/enemy-chatter` endpoint returns dialogue response with text, tone, generation time. Frontend has complete combat UI in `BattleView.swift` with visual feedback systems (floating damage, shakes, glows) and `CombatViewModel.swift` managing combat state. `FloatingTextView` pattern exists for reference. Missing: dialogue display component, frontend integration to call commentary endpoint.

# Changes Required
changes_required:
  - path: "New-Mystica/Views/Battle/Components/EnemyDialogueBubble.swift"
    changes: |
      - Create new speech bubble component
      - Speech bubble with rounded rectangle (12pt radius), semi-transparent background (80% opacity)
      - White text, 16pt font, max 3 lines, automatic sizing
      - Triangle tail pointing to enemy avatar
      - Fade-in animation (0.3s ease-in, opacity 0→1, scale 0.8→1.0)
      - Fade-out animation (0.5s ease-out, opacity 1→0, scale 1.0→0.95)
      - Optional tone-based color tint (confident=blue, angry=red, mocking=yellow, desperate=orange, victorious=green)

  - path: "New-Mystica/ViewModels/CombatViewModel.swift"
    changes: |
      - Add state properties: currentDialogue (DialogueData?), isGeneratingDialogue (Bool)
      - Add fetchCommentary() method that calls repository.fetchEnemyChatter() in parallel Task
      - Update attack() to call fetchCommentary() in background Task after action completes
      - Update defend() to call fetchCommentary() in background Task after action completes
      - Add determineEventType() helper to map CombatAction to CombatEventType
      - Add buildEventDetails() helper to create event context from action
      - Add auto-dismiss logic (2.5s visible + 0.5s fade-out)
      - Add fetchCombatStartCommentary() in initializeOrResumeCombat()
      - Add error handling that logs failures but doesn't crash (commentary is optional)

  - path: "New-Mystica/Repositories/Implementations/DefaultCombatRepository.swift"
    changes: |
      - Add fetchEnemyChatter() method
      - POST to /combat/enemy-chatter with sessionId, eventType, eventDetails
      - Define ChatterRequest and ChatterResponse structs with proper snake_case mapping
      - Return EnemyDialogueResponse from response.dialogueResponse

  - path: "New-Mystica/Repositories/Protocols/CombatRepository.swift"
    changes: |
      - Add fetchEnemyChatter(sessionId:eventType:eventDetails:) async throws -> EnemyDialogueResponse signature

  - path: "New-Mystica/Models/Combat.swift"
    changes: |
      - Add DialogueData struct (text: String, tone: String)
      - Add EnemyDialogueResponse struct (dialogue, dialogueTone, enemyType, generationTimeMs, wasAiGenerated) with snake_case CodingKeys
      - Add CombatEventType enum (combat_start, player_hit, player_miss, enemy_hit, low_player_hp, near_victory, victory, defeat)
      - Add CombatEventDetails struct (turnNumber, playerHpPct, enemyHpPct, damage?, isCritical?)

  - path: "New-Mystica/Views/Battle/BattleView.swift"
    changes: |
      - Add EnemyDialogueBubble above enemy avatar when viewModel.currentDialogue != nil
      - Position bubble below health bar, above enemy avatar, with transition animation

# Task Breakdown
task_breakdown:
  - id: "T1"
    description: |
      Create dialogue data models. Add DialogueData, EnemyDialogueResponse, CombatEventType, CombatEventDetails to Combat.swift. This provides type-safe foundation for commentary feature.
    agent: "junior-engineer"
    depends_on: []
    files:
      - "New-Mystica/Models/Combat.swift"
    exit_criteria: "Models compile, include proper CodingKeys for snake_case mapping"
    status: "completed"

  - id: "T2"
    description: |
      Add fetchEnemyChatter() to repository layer. Update CombatRepository protocol with new method signature, implement in DefaultCombatRepository with POST to /combat/enemy-chatter endpoint. This enables frontend to fetch commentary independently from combat actions.
    agent: "junior-engineer"
    depends_on: ["T1"]
    files:
      - "New-Mystica/Repositories/Protocols/CombatRepository.swift"
      - "New-Mystica/Repositories/Implementations/DefaultCombatRepository.swift"
    exit_criteria: "Repository method compiles, correctly maps request/response with snake_case, includes error handling"

  - id: "T3"
    description: |
      Create EnemyDialogueBubble component for speech display. Implement speech bubble with rounded rectangle, semi-transparent background, triangle tail, fade-in/out animations, tone-based color tints. This provides the visual component for showing enemy commentary.
    agent: "junior-engineer"
    depends_on: ["T1"]
    files:
      - "New-Mystica/Views/Battle/Components/EnemyDialogueBubble.swift"
    exit_criteria: "Component renders correctly in preview, animations smooth, triangle tail points down, tone colors apply correctly"

  - id: "T4"
    description: |
      Update CombatViewModel with commentary fetching logic. Add currentDialogue/isGeneratingDialogue state, implement fetchCommentary() that calls repository in parallel Task, add determineEventType() and buildEventDetails() helpers, integrate into attack()/defend() methods. Update initializeOrResumeCombat() for combat_start commentary. Implement parallel execution where API calls run in background and dialogue updates when ready.
    agent: "programmer"
    depends_on: ["T1", "T2"]
    files:
      - "New-Mystica/ViewModels/CombatViewModel.swift"
    exit_criteria: "ViewModel compiles, fetchCommentary() runs in background Task, errors logged but don't crash, event types map correctly, dialogue auto-dismisses after 2.5s"

  - id: "T5"
    description: |
      Integrate dialogue bubble into BattleView. Add EnemyDialogueBubble with conditional rendering based on viewModel.currentDialogue. Position correctly (above enemy avatar, below health bar) with proper transition animations.
    agent: "junior-engineer"
    depends_on: ["T3", "T4"]
    files:
      - "New-Mystica/Views/Battle/BattleView.swift"
    exit_criteria: "BattleView compiles, dialogue bubble appears when currentDialogue is set, bubble positioned correctly, no UI overlap issues"

  - id: "T6"
    description: |
      Write unit tests for commentary integration. Test CombatViewModel commentary fetching, event type mapping, error handling, auto-dismiss timing. Verify graceful degradation when commentary fails.
    agent: "programmer"
    depends_on: ["T5"]
    files:
      - "New-Mystica/Tests/ViewModels/CombatViewModelTests.swift"
    exit_criteria: "Tests pass, coverage includes: fetchCommentary success/failure, event type mapping, auto-dismiss timing, nil dialogue safety"

  - id: "T7"
    description: |
      Manual testing and validation across all combat scenarios. Test commentary timing (appears after action completes), verify parallel execution (no blocking), test AI timeout handling (no dialogue shown, no crash), verify all event types (combat_start, hits, victory, defeat), check visual polish (readable text, no overlap, smooth animations).
    agent: "senior-engineer"
    depends_on: ["T6"]
    files:
      - "New-Mystica/Views/Battle/BattleView.swift"
    exit_criteria: "All acceptance test scenarios pass: commentary appears correctly, timing feels natural, errors handled gracefully, no crashes or UI glitches"

# Data/Schema Changes (if any)
data_schema_changes:
  migrations: []
  api_changes:
    - endpoint: "/combat/enemy-chatter"
      changes: "Existing endpoint, no changes required. Frontend will call this endpoint in parallel with combat actions."

# Expected Result
expected_result:
  outcome: |
    Enemy commentary displays during combat. When player attacks or defends, commentary generates in parallel (500-2000ms) and appears in a speech bubble above the enemy. Enemy taunts reflect personality and combat context. Combat flow remains responsive (<100ms action latency), with commentary appearing when ready. Commentary failures are logged but don't crash app.
  example: |
    Player attacks Spray Paint Goblin at combat start:
    1. Combat loads → speech bubble shows: "Time to tag you up, friend!" (combat_start event)
    2. Player releases dial → attack completes immediately (~50-100ms)
    3. API call happens in parallel (non-blocking)
    4. Speech bubble appears when ready: "Whoa! That actually hurt!" (player_hit event, angry tone)
    5. Bubble auto-dismisses after 2.5s
    6. Combat continues with smooth flow

# Notes (optional)
notes:
  - "Frontend-driven parallel execution pattern: API calls run in background, dialogue appears when ready"
  - "Backend /combat/enemy-chatter endpoint already exists and works - no backend changes needed"
  - "EnemyChatterService fully implemented with 8 event types, personality-aware prompting, 2s timeout"
  - "Cost monitoring: ~$0.0001-0.0005/commentary, ~$0.003-0.006/combat (acceptable for MVP)"
  - "All commentary attempts logged to enemychatterlog table for analytics"
  - "Future enhancements: tone-based visual styling, dialogue history panel, settings toggle for frequency, voice acting"
  - "Sprite animations will be added in a separate feature (out of scope for this plan)"

# Next
next: "/manage-project/implement/execute combat-enemy-commentary"
