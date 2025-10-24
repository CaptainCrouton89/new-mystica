# Models CLAUDE.md

This directory contains SwiftData models for the New-Mystica iOS/macOS app. All models use SwiftData's `@Model` macro with type-safe property declarations and relationships.

## Key Patterns

- **@Model macro** required on all data model classes
- **@Attribute** for relationships (`.unique`, `.externalStorage`)
- **@Transient** for computed properties not persisted
- **Value types** (enums, structs) for non-persisted data
- **Codable conformance** optional (not required for SwiftData models)
- **Relationships** use explicit `@Attribute(originalName:)` when needed

## Model Types

- **Entity models** (Item, Weapon, Combat, etc.) - Full SwiftData models
- **Value types** (ItemType, CombatState, etc.) - Enums/structs in Protocols/ subdirectory
- **Extensions** - Model-specific computed properties and helpers

## Related Documentation

See [docs/ai-docs/frontend.md](../../../docs/ai-docs/frontend.md) for SwiftUI integration patterns and preview setup requirements.
