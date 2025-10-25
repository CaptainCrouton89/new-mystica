# CLAUDE.md

TypeScript Express.js backend for New Mystica. For full architecture details, see parent [CLAUDE.md](/CLAUDE.md) and [docs/ai-docs/backend.md](/docs/ai-docs/backend.md).

## Commands

### Development
```bash
pnpm dev           # Hot reload with tsx + nodemon (auto-kills port 3000)
pnpm build         # Compile TypeScript → dist/
pnpm start         # Production mode
pnpm lint          # ESLint on src/**/*.ts
pnpm test          # Jest tests
pnpm supabase:types # Generate database types
```

## Critical Architecture

**Request Lifecycle:** Request → CORS/Auth middleware → Zod validation → Route → Controller → Service/Repository → Supabase/AI

**Layers:**
- **Routes** (`src/routes/*.ts`): Endpoint definitions, middleware application
- **Controllers** (`src/controllers/*.ts`): HTTP orchestration
- **Services** (`src/services/*.ts`): Business logic
- **Repositories** (`src/repositories/*.ts`): Database access (extend `BaseRepository<T>`)

**Type Safety:**
- All request bodies/query params use Zod schemas (`src/types/schemas.ts`)
- Database types auto-generated: `pnpm supabase:types`
- Express types in `src/types/express.d.ts` (req.user, req.validated)
- **NEVER use `any` type** — look up proper types
- Imports use `.js` extensions (ESM-ready, compiles to CommonJS) — DO NOT remove them

## Error Handling

Use custom error classes from `src/utils/errors.ts`:
```typescript
import { NotFoundError, ValidationError, UnauthorizedError } from '../utils/errors.js';

if (!item) throw new NotFoundError('Item', itemId);
if (item.user_id !== userId) throw new UnauthorizedError('You do not own this item');
```

## Equipment System

**8 Slots:** weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet

**Key Tables:** `UserEquipment` (equipped state), `MaterialStacks` (availability), `MaterialInstances` (applied), `ItemImageCache` (global)

**Material Application:** Check availability → decrement stack → create instance → insert into ItemMaterials → compute combo_hash → check image cache → generate if miss (20s BLOCKING in MVP)

## Test Infrastructure

```
tests/
├── fixtures/    # Static data (ANONYMOUS_USER, BASE_SWORD, SF_LIBRARY)
├── factories/   # Dynamic generators (ItemFactory, UserFactory)
├── helpers/     # seedData, assertions, mockSupabase
├── unit/        # Service/repository tests
└── integration/ # Full API tests (10s timeout)
```

## Railway Deployment

**Configuration:** `railway.json` specifies Dockerfile builder with auto-restart on failure (max 10 retries, 1 replica). See parent [CLAUDE.md](/CLAUDE.md) for full deployment details.

## Database

**Remote Supabase only:** kofvwxutsmxdszycvluc. PostGIS enabled for geospatial queries (`get_nearby_locations`). Migrations in `migrations/` applied to remote.

## Engine Requirements

- **Node.js:** >=24.0.0 (see `.node-version`)
- **pnpm:** >=9.0.0

## Key Dependencies

Express 4.18.2, TypeScript 5.3.3, Zod 4.1.12, Supabase 2.39.3, AWS SDK 3.913.0, Vercel AI SDK 5.0.76, Jest 30.2.0, tsx 4.6.2

## Implementation Status

**✅ Complete:** LocationService, AuthController, Auth/Validation middleware, Error handling

**⚠️ Partial:** CombatService, EquipmentService, InventoryService, LoadoutService

**❌ NotImplemented:** MaterialService, ItemService, ProfileService, StatsService, ImageGenerationService
