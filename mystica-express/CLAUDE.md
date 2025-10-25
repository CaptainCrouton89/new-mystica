# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypeScript Express.js backend for New Mystica, a location-based RPG game. Uses Supabase (PostgreSQL + PostGIS), Cloudflare R2 for image storage, and AI services for procedural content generation.

## Commands

### Development
```bash
pnpm dev           # Hot reload with tsx + nodemon (kills port 3000 processes first)
pnpm build         # Compile TypeScript → dist/
pnpm start         # Production mode (runs dist/server.js)
pnpm lint          # ESLint on src/**/*.ts
```

### Testing
```bash
pnpm test                 # Run all tests (Jest)
pnpm test:watch           # Watch mode for development
pnpm test:coverage        # Generate coverage report (coverage/)
pnpm test:unit            # Run unit tests only
pnpm test:integration     # Run integration tests only

# Run specific test file
pnpm test tests/unit/services/LocationService.test.ts
pnpm test tests/integration/locations.test.ts
```

### Database
```bash
pnpm supabase:types       # Generate src/types/database.types.ts from linked remote DB
```

**Note:** All development uses the remote Supabase instance (kofvwxutsmxdszycvluc). Database migrations in `migrations/` have been applied to the remote database.

## Critical Architecture Patterns

### Request Lifecycle
```
Incoming Request
  → CORS middleware (app.ts:25)
  → Body parsing (app.ts:33-34)
  → JWT auth middleware (middleware/auth.ts) [adds req.user]
  → Zod validation middleware (middleware/validate.ts) [adds req.validated]
  → Route handler (routes/*.ts)
  → Controller (controllers/*.ts)
  → Service layer (services/*.ts) or Repository pattern
  → Supabase query or AI service call
  ← JSON response or Error handler
```

### Layer Responsibilities
- **Routes** (`src/routes/*.ts`): Define endpoints, apply middleware, minimal logic
- **Controllers** (`src/controllers/*.ts`): Orchestrate service calls, handle HTTP concerns
- **Services** (`src/services/*.ts`): Business logic, validations, cross-entity operations
- **Repositories** (`src/repositories/*.ts`): Database access layer, extend BaseRepository
- **Middleware** (`src/middleware/*.ts`): Auth, CORS, validation, error handling

### Repository Pattern
All repositories extend `BaseRepository<T>` which provides:
- `findById(id)` - Find single entity by UUID
- `findMany(filters, options)` - Query with filters, pagination, sorting
- `create(data)` - Insert new record
- `update(id, data)` - Update existing record
- `delete(id)` - Soft or hard delete

**Example:**
```typescript
export class ItemRepository extends BaseRepository<Item> {
  constructor(client: SupabaseClient = supabase) {
    super('PlayerItems', client);
  }

  async findByUserId(userId: string): Promise<Item[]> {
    return this.findMany({ user_id: userId });
  }
}
```

### Type Safety Patterns

**1. Zod Validation (Required for ALL request bodies/query params)**
```typescript
// Define schema in src/types/schemas.ts
export const CreateItemSchema = z.object({
  item_type_id: UUIDSchema,
  rarity: RaritySchema
});

// Use in route with validate middleware
router.post('/items',
  authenticate,
  validate({ body: CreateItemSchema }),
  itemController.createItem
);
```

**2. Express Type Extensions**
```typescript
// src/types/express.d.ts defines req.user, req.validated, req.context
// Always use these types, never redeclare

// In controller:
const userId = req.user!.id; // Set by auth middleware
const { item_type_id } = req.body; // Validated by Zod
```

**3. Database Types**
```typescript
// src/types/database.types.ts - Auto-generated from Supabase
import { Database } from '../types/database.types.js';

type Item = Database['public']['Tables']['PlayerItems']['Row'];
type InsertItem = Database['public']['Tables']['PlayerItems']['Insert'];
```

### Module Resolution (TypeScript + Jest Quirk)

**IMPORTANT:** Code uses `.js` extensions in imports even though compiling to CommonJS:

```typescript
// Correct - use .js extension
import { ItemService } from '../services/ItemService.js';

// Wrong - will break Jest tests
import { ItemService } from '../services/ItemService';
```

**Why:**
- `tsconfig.json` uses `module: "commonjs"` but code follows ESM patterns
- Jest's `moduleNameMapper` rewrites `.js` → no extension for resolution
- This allows ESM-ready code to compile to CommonJS for Node.js compatibility
- **DO NOT remove .js extensions** from imports

### Environment Validation

All environment variables are validated on startup via Zod (src/config/env.ts). Missing or invalid vars throw detailed errors:

```bash
# Required vars:
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
REPLICATE_API_TOKEN, OPENAI_API_KEY

# Optional vars with defaults:
PORT (default: 3000)
NODE_ENV (default: development)
LOG_LEVEL (default: debug)
JWT_SECRET (default provided, change in production)
```

### Equipment System Architecture

**8 Equipment Slots (Hardcoded):**
- weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet

**Critical Tables:**
- `UserEquipment` - Single source of truth for equipped state (NOT PlayerItem)
- `MaterialStacks` - Composite PK (user_id, material_id, style_id), styles stack separately
- `MaterialInstances` - Created when applied, UNIQUE constraint in ItemMaterials prevents reuse
- `ItemImageCache` - Global (not user-scoped), `craft_count` tracks usage across all users

**Material Application Flow:**
1. Check MaterialStacks for availability
2. Decrement stack quantity
3. Create MaterialInstance
4. Insert into ItemMaterials (validates slot_index 0-2)
5. Compute combo_hash (item_type + material_ids + style_ids)
6. Check ItemImageCache for existing combo
7. If miss: generate image (BLOCKING 20s in MVP), upload to R2, insert cache row
8. Set item.is_styled=true if ANY material.style_id != 'normal'

## Test Infrastructure

### Test Organization
```
tests/
├── fixtures/           # Static test data (users, locations, items, materials)
├── factories/          # Dynamic test data generators
├── helpers/           # seedData loader, assertions, mockSupabase
├── unit/              # Service/repository unit tests
└── integration/       # Full API integration tests
```

### Using Test Infrastructure

**Fixtures (Static Data):**
```typescript
import { ANONYMOUS_USER, EMAIL_USER, SF_LIBRARY, BASE_SWORD } from '../fixtures/index.js';

it('should equip item', async () => {
  const result = await equipmentService.equipItem(ANONYMOUS_USER.id, BASE_SWORD.id);
  expect(result.slot).toBe('weapon');
});
```

**Factories (Dynamic Data):**
```typescript
import { ItemFactory, UserFactory, LocationFactory } from '../factories/index.js';

it('should create custom item', () => {
  const shield = ItemFactory.createBase('shield', 5);
  const user = UserFactory.createAnonymous('device-123');
  expect(shield.base_level).toBe(5);
});
```

**Seed Data Helpers:**
```typescript
import { loadSeededItems, getMaterialById, getRandomMaterials } from '../helpers/seedData.js';

it('should validate against real game data', async () => {
  const items = await loadSeededItems();
  const iron = getMaterialById('iron');
  expect(items.length).toBeGreaterThan(0);
  expect(iron.name).toBe('Iron');
});
```

**Assertions:**
```typescript
import { expectValidItem, expectValidNormalizedStats } from '../helpers/assertions.js';

it('should return valid item structure', () => {
  expectValidItem(result.item); // Validates all required fields
  expectValidNormalizedStats(result.stats); // Validates stat calculations
});
```

### Jest Configuration Notes
- **Environment:** Node.js (NOT jsdom - no browser APIs)
- **Setup:** `tests/setup.ts` mocks Supabase globally
- **Timeout:** 10s default for integration tests
- **Coverage:** Excludes `*.d.ts`, `src/types/**`, `src/server.ts`

## Database

### PostGIS Integration
- **Extension:** PostGIS 3.3.7 enabled on remote Supabase
- **RPC Function:** `get_nearby_locations(lat, lng, radius)` for proximity queries
- **Distance:** `ST_Distance()` with geography type for meter-accurate results

### Migrations Applied to Remote
- `001_initial_schema.sql` - Full game schema (38K file)
- `002_profile_init_function.sql` - Auto-initialize user profiles
- `003_atomic_transaction_rpcs.sql` - Combat transaction RPCs
- `004_equipment_rpcs.sql` - Equipment transaction RPCs
- `005_*.sql` - Material transactions, triggers, views
- `seed_sf_locations.sql` - 30 SF test locations

### Enums
```typescript
rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
combat_result: 'victory' | 'defeat'
actor: 'player' | 'enemy'
weapon_pattern: 'single_arc' | 'multiple_arcs' | 'sequential_taps' | 'charging' | 'dual_wielding'
hit_band: 'perfect' | 'great' | 'good' | 'poor' | 'miss'
```

## Implementation Status

### ✅ Fully Implemented
- **LocationService** - Geospatial queries, PostGIS integration
- **AuthController** - Email + device-based authentication
- **Auth Middleware** - JWT validation, req.user attachment
- **Validation Middleware** - Zod schema enforcement
- **Error Handling** - Custom error classes, unified error responses

### ⚠️ Partially Implemented
- **CombatService** - Basic flow, needs AI dialogue integration
- **EquipmentService** - Equipment operations, needs stat calculations
- **InventoryService** - Basic CRUD, needs complex validations
- **LoadoutService** - CRUD + validation logic complete (see TDD_WORKFLOW_EXAMPLE.md)

### ❌ Not Implemented (Throw NotImplementedError)
- **MaterialService** - Material application, style system
- **ItemService** - Item creation, stat calculations
- **ProfileService** - Profile management
- **StatsService** - Stat normalization algorithms
- **ImageGenerationService** - AI image generation pipeline

## Common Development Patterns

### Adding a New API Endpoint

1. **Define Zod schema** in `src/types/schemas.ts`:
```typescript
export const CreatePetSchema = z.object({
  name: z.string().min(1).max(50),
  pet_type_id: UUIDSchema
});
```

2. **Create route** in `src/routes/pets.ts`:
```typescript
router.post('/',
  authenticate,
  validate({ body: CreatePetSchema }),
  petController.createPet
);
```

3. **Implement controller** in `src/controllers/PetController.ts`:
```typescript
async createPet(req: Request, res: Response) {
  const userId = req.user!.id;
  const { name, pet_type_id } = req.body;

  const pet = await this.petService.createPet(userId, name, pet_type_id);
  res.status(201).json({ pet });
}
```

4. **Implement service** in `src/services/PetService.ts`:
```typescript
async createPet(userId: string, name: string, petTypeId: string) {
  return this.petRepository.create({ user_id: userId, name, pet_type_id: petTypeId });
}
```

5. **Write tests** in `tests/integration/pets.test.ts` and `tests/unit/services/PetService.test.ts`

### Error Handling Pattern

Use custom error classes from `src/utils/errors.ts`:
```typescript
import { NotFoundError, ValidationError, UnauthorizedError } from '../utils/errors.js';

// In service:
if (!item) {
  throw new NotFoundError('Item', itemId);
}

if (item.user_id !== userId) {
  throw new UnauthorizedError('You do not own this item');
}

if (materials.length > 3) {
  throw new ValidationError('Maximum 3 materials allowed');
}
```

### Working with Supabase

```typescript
import { supabase } from '../config/supabase.js';

// Query
const { data, error } = await supabase
  .from('PlayerItems')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });

if (error) throw mapSupabaseError(error);

// Insert
const { data, error } = await supabase
  .from('PlayerItems')
  .insert({ user_id: userId, item_type_id: typeId })
  .select()
  .single();

// RPC call
const { data, error } = await supabase
  .rpc('get_nearby_locations', { lat, lng, radius });
```

## Development Server Behavior

**Port 3000 Auto-Kill:** `pnpm dev` runs `lsof -ti:3000 | xargs kill -9` before starting. This is intentional - nodemon doesn't always clean up on crash. Any process on port 3000 will be terminated.

## Production Deployment (Railway)

Configured for deployment via Railway using Nixpacks.

**Build Configuration** (`nixpacks.toml`):
- **Setup phase:** Node.js 22.x + pnpm
- **Install:** `pnpm install`
- **Build:** `pnpm build` (TypeScript → dist/)
- **Start:** `pnpm start` (runs dist/server.js)

**Railway Configuration** (`railway.json`):
- **Builder:** Nixpacks
- **Build command:** `pnpm install && pnpm build`
- **Start command:** `pnpm start`
- **Restart policy:** ON_FAILURE with max 10 retries

**Note:** All required environment variables (SUPABASE_*, CLOUDFLARE_*, REPLICATE_API_TOKEN, OPENAI_API_KEY) must be configured in Railway project settings.

## API Versioning

All routes prefixed with `/api/v1` (configured in src/app.ts:63). Health check at `/` returns endpoint directory.

## Key Dependencies

- **Express:** 4.18.2 - Web framework
- **TypeScript:** 5.3.3 - Type safety
- **Zod:** 4.1.12 - Runtime validation
- **Supabase:** 2.39.3 - Database client
- **AWS SDK:** 3.913.0 - R2 storage (S3-compatible)
- **Vercel AI SDK:** 5.0.76 + @ai-sdk/openai 2.0.53 - Structured outputs, streaming AI responses
- **Jest:** 30.2.0 + ts-jest 29.4.5 - Testing
- **tsx:** 4.6.2 - TypeScript execution
- **nodemon:** 3.0.2 - Hot reload

## Engine Requirements

- **Node.js:** >=22.0.0 (see `.node-version`)
- **pnpm:** >=9.0.0

## Troubleshooting

### Tests Failing with Module Resolution Errors
- Ensure imports use `.js` extensions
- Check `jest.config.js` has `moduleNameMapper` for `.js` → no extension

### Supabase Connection Errors
- Verify `.env.local` has correct `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Run `pnpm supabase:types` to verify connection

### Authentication Middleware Errors
- Check JWT token format: `Authorization: Bearer {token}`
- Verify token from Supabase auth (not custom JWT)

### Port 3000 Already in Use
- `pnpm dev` kills port 3000 processes automatically
- If manual kill needed: `lsof -ti:3000 | xargs kill -9`

### TypeScript Build Errors
- Run `pnpm build` to check for type errors
- Ensure all imports have `.js` extensions
- Check `tsconfig.json` - never change `module: "commonjs"`
