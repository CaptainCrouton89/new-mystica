# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Monorepo with Express/TypeScript backend (in migration), SwiftUI frontend, AI pipeline, and YAML documentation:

- **mystica-express/** - Express.js + TypeScript backend (**DUAL CODEBASE - see Migration Status**)
- **New-Mystica/** - iOS/macOS SwiftUI app (SwiftData, Google Maps SDK)
- **scripts/** - TypeScript AI image generation (Replicate, OpenAI, R2 storage)
- **docs/** - YAML-based requirements system with validation scripts

## Commands

### Backend (mystica-express/)
```bash
# Development
pnpm dev           # Hot reload with tsx + nodemon (runs src/server.ts if exists, else bin/www)
pnpm build         # Compile TS → dist/ (outputs to dist/server.js)
pnpm start         # Production mode (node dist/server.js)
pnpm lint          # ESLint on src/**/*.ts

# Testing
pnpm test                # Run all tests (Jest)
pnpm test:watch          # Watch mode for test development
pnpm test:coverage       # Generate coverage report (coverage/)
pnpm test:unit           # Run unit tests only (tests/unit/)
pnpm test:integration    # Run integration tests only (tests/integration/)

# Database
pnpm supabase:types           # Generate src/types/database.types.ts from linked remote DB
```

### Frontend (New-Mystica/)
- Open `New-Mystica.xcodeproj` in Xcode → ⌘R to build/run

### AI Image Generation (scripts/)
```bash
cd scripts && pnpm install

# Full pipeline (checks R2, generates missing deps, uploads, creates final image)
pnpm generate-image --type "Magic Wand" --materials "wood,crystal" --provider gemini \
  -r "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/..."

# Batch generate from seed data with R2 upload
pnpm generate-raw-image --batch materials --upload --remove-background

# Single asset generation
pnpm generate-raw-image "Coffee" --type material --upload

# Description only (no image)
npx tsx generate-item-description.ts "Item Type" "material1,material2"
```

### Documentation (docs/)
```bash
./docs/check-project.sh -v              # Validate YAML + traceability links
./docs/feature-specs/list-features.sh   # Feature stats and tree view
./docs/user-stories/list-stories.sh --feature F-04  # Filter by feature
./docs/list-apis.sh --format curl       # Generate curl examples
```

## Critical Constraints

### Migration Status - DUAL CODEBASE ACTIVE
**IMPORTANT:** Backend is mid-migration from CommonJS (app.js) to TypeScript (src/app.ts). Both exist:

- **Legacy:** `app.js` + `routes/*.js` + `bin/www` (CommonJS, Jade views, minimal routes)
- **New:** `src/app.ts` + `src/routes/*.ts` + TypeScript service layer (34 files)
- **Entry point:** `pnpm start` runs `dist/server.js` (compiled from src/)
- **Service layer status:** MOST services throw `NotImplementedError` - **EXCEPTIONS:** LocationService (full implementation), AuthController (complete)
- **Auth middleware placeholder:** Uses `null as unknown as SupabaseClient` (src/middleware/auth.ts:44, 104)
- **Error classes duplicated:** errorHandler.ts:19-66 has inline class definitions marked "TODO: Move to utils/errors.ts"
- **Database migrations:** Applied to remote Supabase - see Database Migration Status section
- **NEVER edit legacy routes** - all new work goes in `src/` TypeScript files

### Backend Architecture Patterns
- **Zod validation enforced:** All request schemas in `src/types/schemas.ts`, used with validate middleware
- **Express type extensions:** `src/types/express.d.ts` adds `req.user`, `req.validated`, `req.context` properties
- **Service → Controller → Route pattern:** Services handle business logic, controllers orchestrate, routes define endpoints
- **API versioning:** All routes prefixed `/api/v1` in src/app.ts:58
- **Environment validation on startup:** src/config/env.ts uses Zod schema, throws detailed errors if missing vars
- **JWT auth via Supabase:** Auth middleware validates tokens with `supabase.auth.getUser(token)`, attaches req.user
- **R2 client auto-tests connection:** src/config/r2.ts and supabase.ts test connections in development on module load
- **8 equipment slots hardcoded:** weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet (schemas.ts:11-13)

### TypeScript Module Resolution Quirk
- **tsconfig.json uses `module: "commonjs"`** but code imports with `.js` extensions (ESM pattern)
- **Jest moduleNameMapper** rewrites `.js` imports: `'^(\\.{1,2}/.*)\\.js$': '$1'` (jest.config.js:24)
- **This is intentional** - allows ESM-ready code to compile to CommonJS for Node.js compatibility
- **DO NOT remove .js extensions** from imports or Jest tests will break

### Development Server Behavior
- **pnpm dev kills port 3000 processes** before starting (package.json:6)
- Required because nodemon doesn't always clean up on crash/restart
- Uses `lsof -ti:3000 | xargs kill -9 2>/dev/null || true`
- **Implication:** Any process on port 3000 will be terminated when starting dev server

### Testing Configuration (Jest)
- **Preset:** ts-jest with custom tsconfig overrides (jest.config.js:8-13)
- **Test environment:** Node.js (NOT jsdom - no browser/DOM APIs available)
- **Module resolution:** Strips `.js` extensions via `moduleNameMapper: {'^(\\.{1,2}/.*)\\.js$': '$1'}`
- **Setup file:** `tests/setup.ts` runs before all tests (mocks Supabase client globally)
- **Coverage exclusions:** Type definitions (`*.d.ts`), `src/types/**`, `src/server.ts`
- **Timeout:** 10s default (jest.config.js:27) for integration tests with Supabase calls
- **Test patterns:** `**/__tests__/**/*.ts` and `**/?(*.)+(spec|test).ts`
- **Coverage output:** HTML + LCOV reports in `coverage/` directory

### AI Image Generation Critical Rules
- **BLOCKING generation:** MVP0/1 uses 20s SYNC generation (data-plan.yaml:9), async with crafting times in later MVPs
- **R2 dependency chain:** generate-image.ts checks R2 first, generates missing materials/items in parallel via generateRawImage, uploads before final composite
- **Material limits:** 1-3 materials required (hard limit per F-04 spec), combo_hash includes style_ids for cache lookup
- **Style system:** `is_styled=true` if ANY material has `style_id != 'normal'` (F-04 spec:98)
- **Global image cache:** ItemImageCache table tracks `craft_count` across all users, reuses combo images
- **Reference image set:** generate-raw-image.ts uses 10 hardcoded R2 URLs (lines 42-51) for style consistency
- **Deterministic keys:** r2-service.ts normalizes names to snake_case: `name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')`
- **Directory structure:** `items/{name}.png`, `materials/{name}.png`, `monsters/{name}.png`, optional `/no-background` subdirs
- **Provider models:** `gemini` = google/nano-banana, `seedream-4` = bytedance/seedream-4
- **Seed data sources:** docs/seed-data-{items,materials,monsters,equipment-slots}.json

### Swift Navigation System Critical Rules
- **NavigationManager is singleton @MainActor:** NEVER create multiple instances, always use `@EnvironmentObject`
- **History management:** Max 10 items, tracks NavigationPath + currentDestination + viewHistory separately
- **Destination enum is source of truth:** Add cases to NavigationDestination:12-21 THEN ContentView switch:28-67
- **Path sync requirement:** navigateTo() appends to navigationPath AND updates currentDestination, navigateBack() pops both
- **History bug pattern:** Adding to history happens BEFORE navigation in navigateTo:65, not after
- **Environment injection:** New_MysticaApp.swift:31-32 creates singleton, ContentView:13 consumes it
- **Preview requirement:** ALL previews need `.modelContainer(for: Item.self, inMemory: true).environmentObject(NavigationManager())`
- **SimpleNavigableView helper:** Auto-adds back button, but requires NavigationManager in environment

### SwiftUI Design System Enforcement
- **Color palette locked:** mysticaDarkBrown, mysticaLightBrown, mysticaLightBlue, mysticaGreen, mysticaOrange, mysticaRed (UI/Colors/Colors.swift)
- **Font requirement:** Impact font used in all buttons (ButtonComponents.swift:72), system fonts for body text
- **Component library:** TitleText, NormalText, IconButton, TextButton, PopupView - NEVER use raw Text/Button
- **Icon system:** SF Symbols via `Image(systemName:)`, custom mystica-icon-* for game assets
- **SwiftData ModelContainer:** Item model registered in ContentView:23, persistent storage automatic

### SwiftUI External Dependencies
- **Google Maps SDK for iOS** - Required for map integration (F-01 Geolocation feature)
- **Installation:** Add via Swift Package Manager or CocoaPods (version not pinned)
- **Info.plist requirement:** Must include `NSLocationWhenInUseUsageDescription` key for GPS permission
- **Build issue:** If "GoogleMaps module not found", check Package Dependencies in Xcode project settings
- **CoreLocation framework** - Native iOS framework for GPS tracking, no installation needed

### Documentation System Critical Rules
- **Feature ID format:** `F-01` (zero-padded 2 digits), stories `US-101` (3 digits), files kebab-case
- **Traceability enforcement:** check-project.sh validates feature_id links, PRD feature IDs must have matching specs
- **Status enum:** Only `incomplete`, `in-progress`, `complete` allowed
- **YAML conventions:** 2-space indent, quote special chars, NO blank fields (use `""` for TBD)
- **Workflow order MATTERS:** PRD → Flows → Stories → Specs → Design → APIs → Data → Traceability (data-plan.yaml tracks this)
- **Template path required:** Every YAML must have `template: ~/.claude/file-templates/init-project/...` pointing to template
- **Seed data-driven:** docs/seed-data-*.json is SOURCE OF TRUTH for items/materials/monsters, NOT hardcoded in code
- **Documentation split:** Project CLAUDE.md (this file) = technical details; docs/CLAUDE.md = YAML system & validation scripts
- **Cross-reference workflow:** When adding features → check docs/feature-specs/ for IDs; when adding APIs → update docs/api-contracts.yaml

### Database Schema Critical Rules (from migrations/001_initial_schema.sql)
- **Equipment architecture:** UserEquipment table = single source of truth for equipped state, NOT PlayerItem schema
- **Material stacking:** MaterialStacks has composite PK (user_id, material_id, style_id) - styles stack separately
- **Material instances:** MaterialInstances created when applied from stack, UNIQUE constraint in ItemMaterials prevents reuse
- **Image cache global:** ItemImageCache is NOT user-scoped, `craft_count` increments on each combo use
- **Style inheritance:** Enemies with style_id drop materials with matching style_id (system-design.yaml:82)
- **Level-aware pools:** EnemyPools and LootPools have filter-based matching on location attributes (location_type, state, country)
- **5 enums:** rarity, combat_result, actor, weapon_pattern, hit_band (lines 77-81)
- **PostgreSQL extensions:** PostGIS for geospatial queries (system-design.yaml:76)
- **Gold balance DEPRECATED:** Users.gold_balance marked DEPRECATED (line 94), use UserCurrencyBalances table

### Database Migration Status
- **001_initial_schema.sql** (38K, comprehensive) - Applied to remote Supabase (kofvwxutsmxdszycvluc)
- **Location seed data:** 30 pre-generated SF locations for MVP testing (seed_sf_locations.sql) - Applied
- **PostGIS function:** `get_nearby_locations(lat, lng, radius)` RPC for optimized proximity queries - Applied
- **All development uses remote database** - No local Supabase stack

## Environment Variables

Required in `.env.local` (backend root or scripts/):

```bash
# Supabase (CRITICAL - validated on startup)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=...                # For client auth
SUPABASE_SERVICE_ROLE_KEY=...        # Backend service role (bypasses RLS)

# Cloudflare R2 (CRITICAL for image generation)
CLOUDFLARE_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=mystica-assets        # Default, can override

# AI Services (CRITICAL for generation pipeline)
REPLICATE_API_TOKEN=...              # google/nano-banana, bytedance/seedream-4
OPENAI_API_KEY=...                   # GPT-4.1-mini for descriptions

# Server (optional overrides)
PORT=3000                            # Default 3000
NODE_ENV=development                 # development | production | test
LOG_LEVEL=debug                      # debug | info | warn | error

# Optional AI providers (documented, not required)
ELEVENLABS_API_KEY=...
GOOGLE_API_KEY=...
HF_TOKEN=...
SERP_API_KEY=...
```

**Validation:** Backend throws detailed Zod validation errors on startup if required vars missing (env.ts:46-62)

## Architecture Patterns

### AI Image Generation Flow (scripts/)
1. **generate-item-description.ts** - GPT-4.1-mini creates name + 2-sentence description, enforces fusion (cactus blender = cactus-shaped body, NOT cacti inside)
2. **generate-image.ts** - Full pipeline:
   - Checks R2 for item + material images via r2-service
   - Generates missing assets in parallel via generateRawImage
   - Uploads to R2 (`items/`, `materials/` directories)
   - Uses R2 URLs as reference images for Replicate
   - Generates final composite with prompt + references
3. **generate-raw-image.ts** - Standalone asset generation with AI descriptions, uses 10-reference hardcoded set, outputs to output/raw/{items,materials}/
4. **r2-service.ts** - AWS S3 SDK wrapper, throws on missing credentials/assets, normalizes names to snake_case

### Material Application Flow (from F-04 spec + system-design.yaml:98-99)
1. Check MaterialStacks for (user_id, material_id, style_id) availability
2. Decrement stack quantity (throw if insufficient)
3. Create MaterialInstance from stack material
4. Insert into ItemMaterials with slot_index (0-2), validate UNIQUE constraints
5. Compute combo_hash = deterministic hash(item_type_id + sorted material_ids + style_ids)
6. Check ItemImageCache for existing combo
7. If cache miss: **SYNC generation** (20s blocking), upload to R2, insert cache row with craft_count=1
8. If cache hit: increment craft_count
9. Set item.is_styled=true if ANY material.style_id != 'normal'
10. Return image URL from cache

### Express Request Lifecycle (src/)
```
Incoming Request
  → CORS middleware (app.ts:25)
  → Body parsing (app.ts:33-34)
  → JWT auth middleware (middleware/auth.ts) [adds req.user]
  → Zod validation middleware (middleware/validate.ts) [adds req.validated]
  → Route handler (routes/*.ts)
  → Controller (controllers/*.ts)
  → Service layer (services/*.ts)
  → Supabase query or AI service call
  ← Service response
  ← Controller JSON response
  ← Error handler (errorHandler.ts) if exception thrown
```

### SwiftUI View Creation Pattern
1. Create view file in `New-Mystica/New-Mystica/`
2. Add case to NavigationDestination enum (NavigationManager.swift:12-21)
3. Add case to ContentView.destinationView() switch (ContentView.swift:28-67)
4. Use `@EnvironmentObject var navigationManager: NavigationManager`
5. Call `navigationManager.navigateTo(.destination)` for navigation
6. Add preview with `.modelContainer(for: Item.self, inMemory: true).environmentObject(NavigationManager())`

### Documentation Workflow (docs/)
1. **Check existing state:** `./docs/check-project.sh -v`
2. **List IDs:** `./docs/feature-specs/list-features.sh` or `./docs/user-stories/list-stories.sh`
3. **Edit upstream docs first:** PRD → Flows → Stories → Specs
4. **Maintain feature_id links:** Stories/specs must reference valid F-## from PRD
5. **Validate after changes:** `./docs/check-project.sh` (zero errors required)
6. **Generate artifacts:** `./docs/list-apis.sh --format curl` for API examples

## Key Technologies

- **Backend:** Express.js 4.18.2, TypeScript 5.3.3, Zod 3.22.4, tsx 4.6.2, nodemon 3.0.2
- **Testing:** Jest 30.2.0, ts-jest 29.4.5, supertest 7.1.4 (Node environment, 10s timeout)
- **Database:** Supabase PostgreSQL (remote, with PostGIS), @supabase/supabase-js 2.39.3
- **Frontend:** SwiftUI (iOS 17+, macOS 14+), SwiftData, Google Maps SDK, CoreLocation
- **AI Services:** Replicate (google/nano-banana, bytedance/seedream-4), OpenAI GPT-4.1-mini, Vercel AI SDK
- **Storage:** Cloudflare R2 (S3-compatible), AWS SDK 3.913.0
- **Infrastructure:** Railway (Nixpacks builder)
- **Package Manager:** pnpm (NOT npm/yarn)

## Cloudflare R2 Integration

**Bucket:** `mystica-assets` (public access at `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/`)

**Wrangler CLI (authenticated, no env vars needed):**
```bash
wrangler r2 object list mystica-assets
wrangler r2 object put mystica-assets/items/magic_wand.png --file=./output.png
wrangler r2 object get mystica-assets/materials/coffee.png --file=./download.png
```

**Directory structure:**
```
mystica-assets/
├── items/{snake_case_name}.png
├── items/no-background/{snake_case_name}.png
├── materials/{snake_case_name}.png
├── materials/no-background/{snake_case_name}.png
├── monsters/{snake_case_name}.png
└── image-refs/{original_filename}.png  (10 hardcoded references for style)
```

## File Organization

### Backend (mystica-express/)
- `src/app.ts` - Main Express app (TypeScript, replaces legacy app.js)
- `src/routes/` - API route definitions (profile, inventory, equipment, materials, items)
- `src/controllers/` - Request handlers
- `src/services/` - Business logic (ALL throw NotImplementedError currently)
- `src/middleware/` - Auth, CORS, error handling, validation
- `src/config/` - env.ts, supabase.ts, r2.ts (validated on startup)
- `src/types/` - schemas.ts (Zod), express.d.ts (type extensions), api.types.ts
- `src/utils/` - errors.ts, logger.ts, hash.ts
- `migrations/` - 001_initial_schema.sql (NOT YET APPLIED)
- `dist/` - Compiled JS output (gitignored)
- **LEGACY:** `app.js`, `routes/*.js`, `bin/www`, `views/*.jade` (deprecated, do not edit)

### Frontend (New-Mystica/)
- `UI/Components/` - TextComponents, ButtonComponents, PopupComponents
- `UI/Colors/Colors.swift` - mystica* color palette
- `UI/Previews/UIComponentsPreview.swift` - Component gallery
- Root views: ContentView (router), MainMenuView, MapView, CollectionView, BattleView, VictoryView, DefeatView
- `NavigationManager.swift` - Global singleton navigation
- `New_MysticaApp.swift` - App entry point

### Scripts (scripts/)
- `generate-image.ts` - Full pipeline (checks R2, generates deps, final composite)
- `generate-raw-image.ts` - Standalone asset generation
- `generate-item-description.ts` - AI description only
- `r2-service.ts` - R2 client wrapper
- `output/` - Local generated images (gitignored)

### Documentation (docs/)
- Top-level: `product-requirements.yaml`, `system-design.yaml`, `api-contracts.yaml`, `data-plan.yaml`, `design-spec.yaml`
- Subdirs: `user-flows/*.yaml`, `user-stories/*.yaml`, `feature-specs/*.yaml`
- Scripts: `check-project.sh`, `list-apis.sh`, subdirs have `list-*.sh`
- Seed data: `seed-data-{items,materials,monsters,equipment-slots}.json`
- External: `external/*.md` (third-party API docs)

## Common Pitfalls

### Backend Development
- **Don't edit legacy app.js/routes/** - All new code in `src/` TypeScript files
- **Services are skeletons** - All throw NotImplementedError, need implementation
- **Auth middleware broken** - Uses `null as unknown as SupabaseClient`, fix before testing auth
- **Zod validation required** - ALL request bodies must have schema in schemas.ts
- **Type extensions needed** - Import types from express.d.ts, don't redeclare req.user
- **Don't remove .js imports** - Code uses ESM-style `.js` extensions even though compiling to CommonJS (Jest rewrites them)
- **Remote database only** - All development uses remote Supabase, no local database stack

### AI Image Generation
- **R2 dependency order matters** - Check existence before generating, generate deps before final image
- **Material limit enforced** - 1-3 materials only, violating throws error
- **Blocking generation in MVP** - 20s sync wait, design UI accordingly (loading states)
- **Combo hash must include styles** - Style variants create separate cache entries
- **Reference images hardcoded** - Don't parameterize the 10 image-refs URLs
- **Snake_case normalization** - Spaces become underscores, special chars stripped

### SwiftUI Development
- **Navigation history bug** - Adding to history BEFORE navigation (line 65), not after - may cause issues
- **Multiple NavigationManagers** - Creating more than one breaks navigation state
- **Missing preview dependencies** - Previews crash without .modelContainer + .environmentObject
- **Color palette violations** - Using system colors breaks design consistency
- **Font violations** - Using non-Impact fonts in buttons breaks design

### Documentation
- **Orphaned feature IDs** - Creating story with feature_id that doesn't exist in PRD
- **Wrong status values** - Using "pending" or "done" instead of "incomplete"/"complete"
- **Blank YAML fields** - Leaving fields empty instead of using `""`
- **Out-of-order workflow** - Writing specs before stories, or APIs before system design
- **Missing traceability** - Forgetting to link user stories to flows

## Special Notes

- **CommonJS → TypeScript migration incomplete** - Backend has dual codebase, prioritize TypeScript work
- **Database schema comprehensive and applied** - 001_initial_schema.sql is 38K, covers full game, applied to remote
- **MVP0 simplifications** - 100% drop rates, sync blocking generation, no weapon patterns except single_arc
- **Material count varies by version** - MVP0 uses "family-appropriate subset", later versions full set
- **SwiftUI previews critical** - Without proper setup, preview crashes block development
- **Wrangler authenticated globally** - CLI operations work without env vars
- **Costs low but not zero** - Replicate ~$0.002-0.01/image, OpenAI ~$0.0001-0.0005/description
- **Remote database only** - All development uses remote Supabase (kofvwxutsmxdszycvluc), `pnpm supabase:types` pulls from remote
