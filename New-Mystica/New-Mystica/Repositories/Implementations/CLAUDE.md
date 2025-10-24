# Repositories/Implementations CLAUDE.md

## Purpose

This directory contains concrete implementations of repository protocols defined in `Repositories/`. Each file implements data access logic for a specific domain entity.

## File Structure

Each implementation file follows the naming pattern `Default[Entity]Repository.swift` and provides:
- Database query/mutation methods
- Data transformation and mapping
- Error handling specific to that entity
- Dependency injection of Supabase client

## Key Patterns

**Protocol Conformance:**
All repositories conform to their corresponding protocol in the parent `Repositories/` directory (e.g., `DefaultCombatRepository` implements `CombatRepository`).

**Async/Await:**
All database operations use Swift's async/await concurrency model. Methods are marked `async throws`.

**Supabase Integration:**
Database operations delegate to the injected Supabase client instance, typically stored as a property during initialization.

**Error Propagation:**
Errors from Supabase are thrown directly—no fallback patterns. This aligns with the project's "throw early and often" philosophy.

## When Adding New Repository

1. Create protocol in `Repositories/[Entity]Repository.swift`
2. Create implementation file `Implementations/Default[Entity]Repository.swift`
3. Conform to protocol with all required methods
4. Register in dependency injection container if applicable

## Related Documentation

See [docs/ai-docs/frontend.md](../../../../docs/ai-docs/frontend.md) for SwiftUI data layer patterns and dependencies.
