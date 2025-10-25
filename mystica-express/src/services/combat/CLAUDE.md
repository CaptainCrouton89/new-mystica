# Combat Services CLAUDE.md

This directory contains the modular combat system for New Mystica. Each file handles a specific aspect of combat lifecycle, from initialization to rewards.

## File Organization

**Core Combat Flow:**
- `types.ts` - Shared TypeScript interfaces and enums
- `constants.ts` - Combat configuration (damage scaling, base values)
- `session.ts` - Session initialization and turn management
- `turn-execution.ts` - Attack/defense mechanics, accuracy calculations
- `calculations.ts` - Damage, stat normalization, and zone-based accuracy

**Supporting Modules:**
- `session-recovery.ts` - Resume abandoned combat sessions
- `loot.ts` - Enemy loot pool selection and generation
- `rewards.ts` - Gold, XP, materials, and item rewards
- `combat-log.ts` - Turn history and event logging

## Import Patterns

All files use relative imports with `.js` extensions:

```typescript
import { CombatSession, AttackResult } from './types.js';
import { BASE_DAMAGE_MULTIPLIER } from './constants.js';
```

Never remove `.js` extensions—they're required for Jest module resolution.

## Key Patterns

**1. Session State Management**
- Sessions stored in `CombatSessions` table with atomic RPC transactions
- `session.ts` handles initialization; `session-recovery.ts` resumes interrupted sessions
- Zone accuracy applied during turn execution in `turn-execution.ts`

**2. Combat Calculations**
- Damage formula: `base_damage × level_multiplier × stat_scaling × zone_multiplier`
- Stat normalization via `normalizeStats()` in `calculations.ts`
- Zone-based accuracy in `calculateZoneAccuracy()` (perfect/great/good/poor/miss)

**3. Reward Pipeline**
- `loot.ts` - Selects from enemy loot pool (100% drop rate MVP0)
- `rewards.ts` - Applies gold, XP, materials, items
- All stored in `CombatSessions` reward field as JSON

**4. Error Handling**
- All errors thrown are custom types (ValidationError, NotFoundError, ExternalAPIError)
- No silent fallbacks; early validation in session initialization
- Middleware catches and formats responses

## Type Safety

All combat types defined in `types.ts`:
- `CombatSession`, `TurnLog`, `AttackResult`, `RewardResult`
- Enums: `rarity`, `weapon_pattern`, `hit_band`, `actor`
- Never use `any` type; if needed type lookup in database.types.ts

## Testing

Unit tests mock repositories; integration tests use seeded combat data from `CombatSessionBuilder`.

## Module Dependencies

- Repositories: `EnemyRepository`, `ItemRepository`, `LocationRepository`
- External: OpenAI for enemy chatter (timeout 2s)
- Analytics: `AnalyticsRepository` for combat event logging
