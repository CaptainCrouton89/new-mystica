# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Monorepo with Express backend, SwiftUI frontend, and TypeScript AI scripts:

- **mystica-express/** - Express.js 4.16 backend (Jade, Supabase, Railway)
- **New-Mystica/** - iOS/macOS SwiftUI app (SwiftData persistence)
- **scripts/** - TypeScript AI image generation pipeline (Replicate, OpenAI)
- **docs/** - YAML-based project documentation system

## Commands

### Backend (mystica-express/)
```bash
pnpm install                  # Install dependencies
pnpm start                    # Start dev server (port 3000)
supabase start                # Start local Supabase stack (ports 54321-54327)
supabase status               # View service URLs and credentials
```

### Frontend (New-Mystica/)
- Open `New-Mystica.xcodeproj` in Xcode
- Press ⌘R to build and run

### AI Image Generation (scripts/)
```bash
# From project root
cd scripts && pnpm install

# Generate item image with AI description
pnpm generate-image --type "Magic Wand" --materials "wood,crystal" --provider gemini \
  -r "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/image-refs/..."

# Generate raw seed images (batch mode for all seed data)
pnpm generate-raw-image --batch all

# Generate item description only
npx tsx generate-item-description.ts "Item Type" "material1,material2"
```

### Documentation Management (docs/)
```bash
./docs/check-project.sh -v              # Validate all YAML files
./docs/feature-specs/list-features.sh   # Show features with stats
./docs/user-stories/list-stories.sh     # Filter by feature/status
./docs/list-apis.sh --format curl       # Generate API examples
```

## Critical Constraints

### AI Image Generation Pipeline
- **R2 bucket:** `mystica-assets` at `pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev`
- **Auto-generation:** generate-image.ts checks R2 for item/material images, generates missing ones in parallel via generateRawImage, uploads to R2 automatically
- **R2 directory structure:** `items/{snake_case}.png`, `materials/{snake_case}.png`
- **Reference images:** Uses R2-stored item + materials as references (no hardcoded fallbacks)
- **R2 Service (r2-service.ts):** AWS S3 SDK client for check/upload/list operations, throws errors on missing credentials
- **Required env vars:** CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
- **Material limits:** 1-3 materials required for generate-image.ts
- **Seed data sources:** `docs/seed-data-{items,materials,monsters}.json`

### Swift UI Architecture
- **NavigationManager is global singleton** - injected via `@EnvironmentObject`, manages NavigationPath + history
- **NavigationDestination enum drives routing** - all views registered in ContentView:21 switch
- **Custom components enforce design system** - TitleText, NormalText, IconButton, TextButton with mystica* colors
- **Color palette is hardcoded** - `UI/Colors/Colors.swift` defines mysticaDarkBrown, mysticaLightBrown, etc.
- **Impact font required** - Used in all buttons (TextButton:72)

### Backend Configuration
- **No build step** - Express serves directly (`pnpm build` echoes "No build step required")
- **Port override via ENV** - `PORT` environment variable (bin/www:15)
- **Supabase local ports** - API:54321, DB:54322, Studio:54323, Inbucket:54324
- **Railway deployment** - Uses Nixpacks builder, `pnpm install` + `pnpm start`

### Documentation System
- **YAML-based specs with strict conventions** - Features `F-01`, Stories `US-101`, files kebab-case
- **Cross-document linking required** - Stories/specs must set `feature_id` matching PRD
- **Status values enforced:** `incomplete | in-progress | complete`
- **Management scripts expect 2-space YAML indent** - Quote special chars, no blank fields
- **Workflow order matters:** PRD → Flows → Stories → Specs → Design → APIs → Data → Traceability

## Environment Variables

Required in `.env.local` (root or scripts/):

```bash
# AI Services
REPLICATE_API_TOKEN=...      # Required for all image generation
OPENAI_API_KEY=...           # Required for generate-item-description.ts

# Cloudflare R2 (Required for r2-service.ts)
CLOUDFLARE_ACCOUNT_ID=...    # Cloudflare account ID
R2_ACCESS_KEY_ID=...         # R2 API token with read/write access
R2_SECRET_ACCESS_KEY=...     # R2 API token secret

# Supabase (Backend)
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Optional (documented but not actively used)
ELEVENLABS_API_KEY=...
GOOGLE_API_KEY=...
HF_TOKEN=...
SERP_API_KEY=...
```

## Architecture Patterns

### AI Image Generation Flow
1. **generate-item-description.ts** - GPT-4.1-mini generates name + 2-sentence description from itemType + materials, enforces material fusion (e.g., cactus blender = cactus-shaped blender body, not cacti inside)
2. **generate-image.ts** - Full pipeline with R2 integration:
   - Checks R2 for item + material images using r2-service
   - Generates missing assets in parallel via generateRawImage
   - Uploads newly generated images to R2 (`items/` or `materials/` directories)
   - Uses R2-stored images as reference URLs for final item generation
   - Replicate (Gemini/Seedream) generates final image from prompt + references
3. **generate-raw-image.ts** - Generates standalone item/material images with AI descriptions, uses hardcoded 10-reference set for style consistency, outputs to `output/raw/{items,materials}/`
4. **r2-service.ts** - AWS S3 SDK wrapper for R2 operations (check exists, upload, get URLs), throws errors on missing credentials or assets

### Swift Navigation System
- **ContentView wraps NavigationStack** with `$navigationManager.navigationPath` binding
- **NavigationManager tracks history** (max 10) and provides navigateTo/navigateBack methods
- **SimpleNavigableView wrapper** auto-adds back button for quick view creation
- **Environment injection pattern:** NavigationManager injected at app root (New_MysticaApp.swift:31-32)

### Express Backend Structure
- **Minimal routes:** Only `/` (index) and `/users` defined (app.js:22-23)
- **Centralized error handling:** 404 → error middleware → Jade template (app.js:26-39)
- **Supabase integration ready** but no active database code yet

### Documentation System
- **Six management scripts** validate/query YAML: check-project.sh, list-features.sh, list-stories.sh, list-flows.sh, list-apis.sh, generate-docs.sh
- **ID-based cross-referencing** prevents orphaned specs (every F-## needs matching feature spec)
- **Traceability validation** ensures flows → PRD features, stories → feature_id, APIs → feature IDs

## Key Technologies

- **Backend:** Express.js 4.16.1, Node.js CommonJS, Jade 1.11.0, pnpm
- **Frontend:** SwiftUI, SwiftData (persistent ModelContainer), Xcode project structure
- **Scripts:** TypeScript 5.7.2, tsx 4.19.2, CommonJS mode
- **AI Services:** Replicate (google/nano-banana, bytedance/seedream-4), OpenAI GPT-4.1-mini, Vercel AI SDK
- **Infrastructure:** Cloudflare R2 (mystica-assets bucket), Railway (Nixpacks), Supabase local dev

## Cloudflare R2 Integration

**Public bucket URL:** `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/`

**Wrangler CLI operations:**
```bash
wrangler r2 object list mystica-assets                                    # List objects
wrangler r2 object put mystica-assets/image-refs/IMG_0821.png --file=...  # Upload
wrangler r2 object get mystica-assets/image-refs/IMG_0821.png --file=...  # Download
```

**Reference images** (5 R2 URLs) hardcoded in generate-raw-image.ts:14-20 for consistent style transfer

## File Organization Patterns

### Swift Project
- `UI/Components/` - Reusable components (TextComponents, ButtonComponents, PopupComponents)
- `UI/Colors/Colors.swift` - Color palette extensions
- `UI/Previews/UIComponentsPreview.swift` - Live component gallery
- Root views: MainMenuView, MapView, CollectionView, ContentView (router)

### Backend
- `routes/*.js` - Express route handlers
- `views/*.jade` - Jade templates
- `public/` - Static assets
- `bin/www` - Server bootstrap

### Scripts
- `generate-*.ts` - AI generation tools
- `output/` - Generated images (gitignored)
- `package.json` - Uses CommonJS (type: "commonjs")

### Documentation
- `docs/*.yaml` - Top-level specs (PRD, system-design, api-contracts, data-plan, design-spec)
- `docs/{user-flows,user-stories,feature-specs}/*.yaml` - Categorized specs
- `docs/external/*.md` - Third-party API documentation
- `docs/seed-data-*.json` - Game data (items, materials, monsters)

## Common Patterns

### Adding Swift Views
1. Create view file in `New-Mystica/New-Mystica/`
2. Add case to `NavigationDestination` enum (NavigationManager.swift:12)
3. Add case to ContentView router switch (ContentView.swift:28)
4. Use `@EnvironmentObject var navigationManager: NavigationManager` for navigation

### Adding Backend Routes
1. Create route file in `mystica-express/routes/`
2. Register in app.js: `app.use('/path', require('./routes/filename'))`

### Generating Item Images
1. Check seed data: `docs/seed-data-{items,materials}.json`
2. Run with 1-3 materials: `pnpm generate-image --type "..." --materials "..." --provider gemini -r "..."`
3. Output: `scripts/output/gemini-{timestamp}.png`

### Managing Documentation
1. Run `./docs/check-project.sh` before editing
2. Use list scripts to check existing IDs (`list-features.sh`, `list-stories.sh`)
3. Maintain feature_id links (stories → F-##, specs → F-##)
4. Validate after changes: `./docs/check-project.sh -v`

## Special Notes

- **SwiftUI previews require SwiftData** - Always include `.modelContainer(for: Item.self, inMemory: true)` and `.environmentObject(NavigationManager())`
- **Wrangler CLI already authenticated** - No API keys needed for R2 operations via CLI
- **AI generation costs** - Replicate per-second billing (~$0.002-0.01/image), OpenAI ~$0.0001-0.0005/description
- **.env.local location** - Scripts look for `.env.local` in project root (scripts/generate-image.ts:8)
- **Documentation workflow is sequential** - Each phase depends on upstream docs (see CLAUDE.md in docs/)
