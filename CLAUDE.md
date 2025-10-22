# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Required Reading

**You MUST read the relevant specialized documentation before working on tasks.** The table below specifies when to read each reference doc:

| Documentation | When to Read |
|--------------|--------------|
| [docs/ai-docs/backend.md](docs/ai-docs/backend.md) | Working on Express routes, controllers, services, middleware, tests, or any TypeScript backend code |
| [docs/ai-docs/frontend.md](docs/ai-docs/frontend.md) | Working on SwiftUI views, navigation, UI components, or iOS/macOS app features |
| [docs/ai-docs/ai-pipeline.md](docs/ai-docs/ai-pipeline.md) | Working on image generation, R2 storage, material application, or AI service integration |
| [docs/ai-docs/database.md](docs/ai-docs/database.md) | Working with database schema, migrations, Supabase queries, or environment configuration |
| [docs/CLAUDE.md](docs/CLAUDE.md) | Working with YAML documentation system, feature specs, user stories, or validation scripts |

## Project Structure

Monorepo with Express/TypeScript backend (in migration), SwiftUI frontend, AI pipeline, and YAML documentation:

- **mystica-express/** - Express.js + TypeScript backend (**DUAL CODEBASE - see [backend.md](docs/ai-docs/backend.md)**)
- **New-Mystica/** - iOS/macOS SwiftUI app (SwiftData, Google Maps SDK)
- **scripts/** - TypeScript AI image generation (Replicate, OpenAI, R2 storage)
- **docs/** - YAML-based requirements system with validation scripts

## Quick Commands

### Backend (mystica-express/)
```bash
pnpm dev           # Hot reload with tsx + nodemon
pnpm build         # Compile TS → dist/
pnpm start         # Production mode
pnpm test          # Run all tests (Jest)
pnpm supabase:types # Generate types from remote DB
```

### Frontend (New-Mystica/)
```bash
./build.sh                          # Build for iOS Simulator
xcodebuild test -scheme New-Mystica -configuration Debug -destination "platform=iOS Simulator,name=iPhone 17 Pro" # Run unit tests
```

### AI Image Generation (scripts/)
```bash
cd scripts && pnpm install
pnpm generate-image --type "Magic Wand" --materials "wood,crystal" --provider gemini
pnpm generate-raw-image --batch materials --upload --remove-background
```

### Documentation (docs/)
```bash
./docs/check-project.sh -v              # Validate YAML + traceability
./docs/feature-specs/list-features.sh   # Feature stats
./docs/user-stories/list-stories.sh --feature F-04
./docs/list-apis.sh --format curl
```

## Key Technologies

- **Backend:** Express.js 4.18.2, TypeScript 5.3.3, Zod 3.22.4, Jest 30.2.0
- **Database:** Supabase PostgreSQL (remote, with PostGIS), @supabase/supabase-js 2.39.3
- **Frontend:** SwiftUI (iOS 17+, macOS 14+), SwiftData, Google Maps SDK, CoreLocation
- **AI Services:** Replicate (google/nano-banana, bytedance/seedream-4), OpenAI GPT-4.1-mini
- **Storage:** Cloudflare R2 (S3-compatible), AWS SDK 3.913.0
- **Package Manager:** pnpm (NOT npm/yarn)

## Critical Project-Wide Constraints

- **Code Quality:** NEVER use `any` type. Look up proper types. Always throw errors early—no fallbacks.
- **Backend Migration:** NEVER edit legacy `app.js` or `routes/*.js` files. All new work in `src/` TypeScript.
- **Remote Database Only:** All development uses remote Supabase (kofvwxutsmxdszycvluc). No local database stack.
- **Module Resolution:** Code uses `.js` extensions in imports even though compiling to CommonJS. DO NOT remove them.
- **Documentation System:** Feature IDs `F-01` (zero-padded), stories `US-101`, files kebab-case. Status: `incomplete|in-progress|complete`

## Special Notes

- **Pre-production Status:** Breaking code during refactoring is acceptable. We prioritize correctness over backwards compatibility.
- **MVP0 Simplifications:** 100% drop rates, sync blocking generation (20s), no weapon patterns except single_arc
- **SwiftUI Previews:** Require `.modelContainer(for: Item.self, inMemory: true).environmentObject(NavigationManager())` or they crash
- **Wrangler Authenticated:** CLI R2 operations work globally without env vars
- **Costs Low but Not Zero:** Replicate ~$0.002-0.01/image, OpenAI ~$0.0001-0.0005/description
