# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Required Reading

**You MUST read the relevant specialized documentation before working on tasks.** The table below specifies when to read each reference doc:

| Documentation | When to Read |
|--------------|--------------|
| [docs/ai-docs/backend.md](docs/ai-docs/backend.md) | Working on Express routes, controllers, services, middleware, or any TypeScript backend code |
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
pnpm supabase:types # Generate types from remote DB
```

### Frontend (New-Mystica/)
```bash
cd "/Users/silasrhyneer/Code/new-mystica/New-Mystica" && ./build.sh                          # Build for iOS Simulator. Run this when the user asks you to fix xcode build errors
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

## Deployment

The backend is deployed via **Railway** using Docker containerization:

- **Dockerfile** - Node.js 24 with pnpm 8.x (required for lockfile v6.0 compatibility), builds Express backend on port 3000
- **railway.toml** - Railway platform config with health check at `/api/v1/health`
- **nixpacks.toml** - Alternative Nixpacks build config (fallback)
- **.dockerignore** - Excludes non-essentials (node_modules, dist, docs, etc.)

Deployment is automatic on commit to the Railway platform. Local Docker testing:
```bash
docker build -t mystica:latest .
docker run -p 3000:3000 mystica:latest
```

## Key Technologies

- **Backend:** Express.js 4.18.2, TypeScript 5.3.3, Zod 3.22.4, Node.js 24
- **Database:** Supabase PostgreSQL (remote, with PostGIS), @supabase/supabase-js 2.39.3
- **Frontend:** SwiftUI (iOS 17+, macOS 14+), SwiftData, Google Maps SDK, CoreLocation
- **AI Services:** Replicate (google/nano-banana, bytedance/seedream-4), OpenAI GPT-4.1-mini
- **Storage:** Cloudflare R2 (S3-compatible), AWS SDK 3.913.0
- **Package Manager:** pnpm (NOT npm/yarn)

Supabase project id: kofvwxutsmxdszycvluc