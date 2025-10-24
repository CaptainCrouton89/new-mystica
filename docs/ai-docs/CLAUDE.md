# AI Documentation Guide

Specialized domain documentation for Claude Code when working on different subsystems.

## File Overview

| File | Purpose | When to Read |
|------|---------|--------------|
| **backend.md** | Express routes, controllers, services, middleware, TypeScript code patterns, testing | Before working on `mystica-express/src/` |
| **frontend.md** | SwiftUI views, navigation, UI components, iOS/macOS features | Before working on `New-Mystica/` |
| **ai-pipeline.md** | Image generation, R2 storage, material application, AI service integration | Before working on `scripts/` or image generation |
| **database.md** | Schema diagram, critical architectural rules (equipment, materials, stacking), table reference, environment setup | Before any database schema, query, or game system changes involving inventory, combat, or materials |

## Usage Pattern

1. **Identify subsystem** from the task at hand
2. **Read relevant doc** before starting work
3. **Follow documented patterns** for consistency with existing code
4. **Reference specific sections** if questions arise during implementation

## Critical Gotchas by Subsystem

- **Database:** UserEquipment is single source of truth for equipped state, not PlayerItem. MaterialStacks uses composite PK (user_id, material_id, style_id).
- **AI Pipeline:** Sync blocking generation (20s) with Replicate/OpenAI. R2 bucket authenticated globally via Wrangler.
- **Backend:** Dual codebase—never edit legacy `app.js` or `routes/*.js`. All new work in `src/` TypeScript with Zod validation.
- **Frontend:** SwiftUI previews require `.modelContainer()` and `.environmentObject()` or they crash.

## Key Principles

- Each doc contains patterns, conventions, and gotchas specific to that subsystem
- Docs assume familiarity with parent `/CLAUDE.md` project instructions
- Updated alongside code changes to keep patterns current
- All docs use kebab-case filenames and 2-space markdown indentation

## Cross-References

- Parent project guidance: See `/CLAUDE.md`
- Documentation system guide: See `docs/CLAUDE.md`
- General quality standards: Parent `CLAUDE.md` Code Quality Standards section
