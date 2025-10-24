# Models Directory

SwiftData models for the New-Mystica app. All models use `@Model` macro for persistence.

## Core Models

- **Item**: Inventory items with rarity, combat stats (attack, defense, crit). Links to Material via `materialID`.
- **Material**: Crafting components with visual properties (image_url, color_hex, description).
- **Character**: Player character with stats (health, stamina, mana), equipped items, inventory.
- **Combat**: Battle state including turn order, current combatant, enemy, and action history.
- **CombatAction**: Individual combat actions (attack, defend, spell) with damage/targets. Links to Combat via `combatID`.

## Patterns & Conventions

- All models are `@Model` for SwiftData persistence
- Relationships use `@Relationship(deleteRule: .cascade)` for cleanup
- Optional fields for nullable database columns
- Enums for status/type fields (CombatActionType, ItemRarity)
- Use UUIDs for relationships between models

## SwiftUI Preview Setup

Models in previews require:
```swift
.modelContainer(for: Item.self, inMemory: true)
.environmentObject(NavigationManager())
```

## Backend Sync

- Models mirror Supabase schema (see `docs/ai-docs/database.md`)
- After schema changes, run `pnpm supabase:types` in backend to update types
- SwiftData types generated manually (no auto-generation from DB)
