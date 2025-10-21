# Mystica Express Backend Architecture

## Overview

TypeScript-based Express API server for New Mystica location-based RPG. Implements clean layered architecture with Supabase PostgreSQL integration, JWT authentication, and AI image generation via R2.

## Tech Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript 5.x
- **Framework:** Express 4.18+
- **Database:** Supabase PostgreSQL
- **Validation:** Zod
- **Authentication:** Supabase Auth (JWT)
- **Image Storage:** Cloudflare R2
- **AI Services:** Replicate (Gemini/Seedream), OpenAI GPT-4.1-mini
- **Deployment:** Railway (Nixpacks)

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│              HTTP Request                        │
└─────────────────┬───────────────────────────────┘
                  │
         ┌────────▼─────────┐
         │   Middleware     │  Auth, CORS, Error Handling
         └────────┬─────────┘
                  │
         ┌────────▼─────────┐
         │     Routes       │  URL routing, validation
         └────────┬─────────┘
                  │
         ┌────────▼─────────┐
         │   Controllers    │  Request/response handling
         └────────┬─────────┘
                  │
         ┌────────▼─────────┐
         │    Services      │  Business logic
         └────────┬─────────┘
                  │
         ┌────────▼─────────┐
         │   DB Queries     │  SQL operations
         └────────┬─────────┘
                  │
         ┌────────▼─────────┐
         │   Supabase       │  PostgreSQL database
         └──────────────────┘
```

## Directory Structure

```
mystica-express/
├── src/
│   ├── config/
│   │   ├── supabase.ts          # Supabase client initialization
│   │   ├── env.ts                # Environment variable validation (Zod)
│   │   └── r2.ts                 # Cloudflare R2 client setup
│   │
│   ├── middleware/
│   │   ├── auth.ts               # JWT token validation
│   │   ├── errorHandler.ts      # Global error handling
│   │   ├── validate.ts           # Zod request validation
│   │   └── cors.ts               # CORS configuration
│   │
│   ├── routes/
│   │   ├── locations.ts          # GET /locations/nearby
│   │   ├── combat.ts             # Combat endpoints (start, attack, defend, complete)
│   │   ├── inventory.ts          # GET /inventory
│   │   ├── equipment.ts          # Equipment endpoints (get, equip, unequip)
│   │   ├── materials.ts          # Material endpoints (inventory, apply, replace)
│   │   ├── items.ts              # Item endpoints (get, upgrade)
│   │   └── profile.ts            # User profile endpoints
│   │
│   ├── controllers/
│   │   ├── LocationController.ts
│   │   ├── CombatController.ts
│   │   ├── InventoryController.ts
│   │   ├── EquipmentController.ts
│   │   ├── MaterialController.ts
│   │   ├── ItemController.ts
│   │   └── ProfileController.ts
│   │
│   ├── services/
│   │   ├── LocationService.ts    # Location-based logic, pool filtering
│   │   ├── CombatService.ts      # Combat calculations, stat formulas
│   │   ├── InventoryService.ts   # Inventory management, stacking
│   │   ├── EquipmentService.ts   # Equipment state, 8-slot system
│   │   ├── MaterialService.ts    # Material application, combo hash
│   │   ├── ItemService.ts        # Item upgrades, stat computation
│   │   ├── ImageGenerationService.ts  # AI image generation, R2 upload
│   │   └── StatsService.ts       # Stat calculations (base × level + materials)
│   │
│   ├── db/
│   │   ├── queries/
│   │   │   ├── items.ts          # Item CRUD operations
│   │   │   ├── materials.ts      # Material stacking, application
│   │   │   ├── equipment.ts      # UserEquipment table operations
│   │   │   ├── combat.ts         # Combat sessions, rewards
│   │   │   ├── locations.ts      # Location queries, geospatial
│   │   │   └── users.ts          # User profile, gold, vanity level
│   │   └── client.ts             # Supabase client instance
│   │
│   ├── types/
│   │   ├── database.types.ts     # Supabase generated types
│   │   ├── api.types.ts          # Request/response DTOs
│   │   └── schemas.ts            # Zod validation schemas
│   │
│   ├── utils/
│   │   ├── logger.ts             # Winston logging
│   │   ├── errors.ts             # Custom error classes
│   │   └── hash.ts               # Material combo hash function
│   │
│   ├── app.ts                     # Express app setup
│   └── server.ts                  # Server startup
│
├── .env.example                   # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## Middleware Stack

### Request Flow
1. **CORS** - Cross-origin resource sharing
2. **Morgan** - HTTP request logging
3. **express.json()** - JSON body parsing
4. **Auth Middleware** - JWT token validation (routes requiring auth)
5. **Validation Middleware** - Zod schema validation (per-route)
6. **Route Handler** - Business logic execution
7. **Error Handler** - Centralized error responses

### Authentication Middleware
```typescript
// src/middleware/auth.ts
- Extracts JWT from Authorization header
- Validates token via Supabase Auth
- Attaches user_id to req.user
- Returns 401 if invalid/missing
```

### Validation Middleware
```typescript
// src/middleware/validate.ts
- Uses Zod schemas for runtime validation
- Validates req.body, req.query, req.params
- Returns 400 with detailed errors if invalid
```

### Error Handler
```typescript
// src/middleware/errorHandler.ts
- Catches all errors from routes/controllers
- Formats consistent JSON error responses
- Logs errors to Winston
- Returns appropriate HTTP status codes
```

## Data Layer Pattern

### Query Module Structure
```typescript
// Example: src/db/queries/items.ts

export const getItemById = async (itemId: string, userId: string) => {
  const { data, error } = await supabase
    .from('items')
    .select(`
      *,
      item_type:item_types(*),
      materials:item_materials(
        material_instance:material_instances(
          material:materials(*),
          is_shiny
        )
      )
    `)
    .eq('id', itemId)
    .eq('user_id', userId)
    .single();

  if (error) throw new DatabaseError(error.message);
  return data;
};
```

### Service Pattern
```typescript
// Example: src/services/MaterialService.ts

export class MaterialService {
  async applyMaterial(
    userId: string,
    itemId: string,
    materialId: string,
    isShiny: boolean,
    slotIndex: number
  ): Promise<ApplyMaterialResult> {
    // 1. Validate ownership, slot availability
    // 2. Check MaterialStacks for sufficient quantity
    // 3. Create MaterialInstance
    // 4. Insert ItemMaterials row
    // 5. Compute material_combo_hash
    // 6. Check ItemImageCache
    // 7. If not cached: Generate image (20s sync)
    // 8. Update Items table
    // 9. Return result with is_first_craft, craft_count
  }
}
```

## MVP1 API Endpoints

### Phase 1 (Core)
```
POST   /profile/init              # Initialize new player
GET    /profile                   # Get player profile
GET    /inventory                 # Get items + material stacks
GET    /equipment                 # Get equipped items (8 slots)
POST   /equipment/equip           # Equip item to slot
POST   /equipment/unequip         # Unequip item from slot
GET    /materials/inventory       # Get material stacks
POST   /items/:id/materials/apply # Apply material (20s sync)
POST   /items/:id/upgrade         # Upgrade item with gold
GET    /items/:id                 # Get item details
```

### Phase 2 (Combat)
```
GET    /locations/nearby          # Get nearby locations
POST   /combat/start              # Start combat session (Redis)
POST   /combat/attack             # Execute attack
POST   /combat/defend             # Execute defense
POST   /combat/complete           # Complete combat, claim rewards
```

## Database Schema Highlights

### Core Tables (MVP1)
- **Users** - Profile, gold, vanity_level
- **Items** - Player-owned items (unique instances)
- **ItemTypes** - Item templates (seed data)
- **Materials** - Material templates (seed data)
- **MaterialStacks** - Stackable material inventory (user_id, material_id, is_shiny, quantity)
- **MaterialInstances** - Individual materials when applied
- **ItemMaterials** - Junction table (max 3 per item)
- **UserEquipment** - Current equipped items (8 slots)
- **ItemImageCache** - Global image cache (item_type_id, combo_hash, craft_count)

### Key Features
- **Material Stacking** - Reduces inventory rows (MaterialStacks table)
- **8-Slot Equipment** - weapon, shield, head, armor, feet, accessory_1, accessory_2, pet
- **Image Generation** - Sync 20s process, globally cached, deterministic URLs
- **Stat Calculation** - base_stats × level + material_modifiers
- **Triggers** - Auto-update vanity_level, avg_item_level, material_combo_hash

## Environment Variables

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Cloudflare R2
CLOUDFLARE_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=mystica-assets

# AI Services
REPLICATE_API_TOKEN=xxx
OPENAI_API_KEY=xxx

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
```

## Error Handling

### Custom Error Classes
```typescript
DatabaseError      # Supabase query errors
ValidationError    # Zod validation failures
AuthenticationError # JWT invalid/missing
AuthorizationError # User lacks permission
NotFoundError      # Resource not found
ConflictError      # Duplicate/constraint violation
ExternalAPIError   # Replicate/OpenAI failures
```

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "slot_index",
        "message": "Must be between 0 and 2"
      }
    ]
  }
}
```

## Stat Calculation Formula

```typescript
// Service layer computation
const computeItemStats = (
  baseStats: Stats,
  level: number,
  materials: AppliedMaterial[]
): Stats => {
  // 1. Scale base stats by level
  const scaledBase = {
    atkPower: baseStats.atkPower * level,
    atkAccuracy: baseStats.atkAccuracy * level,
    defPower: baseStats.defPower * level,
    defAccuracy: baseStats.defAccuracy * level
  };

  // 2. Apply material modifiers (with shiny 1.2x multiplier)
  const materialMods = materials.reduce((acc, mat) => {
    const multiplier = mat.is_shiny ? 1.2 : 1.0;
    return {
      atkPower: acc.atkPower + (mat.stat_modifiers.atkPower * multiplier),
      atkAccuracy: acc.atkAccuracy + (mat.stat_modifiers.atkAccuracy * multiplier),
      defPower: acc.defPower + (mat.stat_modifiers.defPower * multiplier),
      defAccuracy: acc.defAccuracy + (mat.stat_modifiers.defAccuracy * multiplier)
    };
  }, { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 });

  // 3. Combine
  return {
    atkPower: scaledBase.atkPower + materialMods.atkPower,
    atkAccuracy: scaledBase.atkAccuracy + materialMods.atkAccuracy,
    defPower: scaledBase.defPower + materialMods.defPower,
    defAccuracy: scaledBase.defAccuracy + materialMods.defAccuracy
  };
};
```

## Image Generation Workflow

```typescript
// MaterialService.applyMaterial flow:

// 1. Compute deterministic combo hash (order-insensitive)
const comboHash = computeComboHash(materialIds, shinyFlags); // sorted

// 2. Check global cache
const cached = await ItemImageCacheQueries.findByCombo(itemTypeId, comboHash);

if (cached) {
  // Cache hit - instant response
  await ItemImageCacheQueries.incrementCraftCount(cached.id);
  return {
    image_url: cached.image_url,
    is_first_craft: false,
    craft_count: cached.craft_count + 1
  };
} else {
  // Cache miss - generate (20s sync)
  const imageUrl = await ImageGenerationService.generate(
    itemTypeId,
    materials
  ); // Uploads to R2, returns URL

  await ItemImageCacheQueries.create({
    item_type_id: itemTypeId,
    combo_hash: comboHash,
    image_url: imageUrl,
    craft_count: 1
  });

  return {
    image_url: imageUrl,
    is_first_craft: true,
    craft_count: 1
  };
}
```

## Testing Strategy

### Unit Tests (Jest)
- Service layer business logic
- Stat calculation functions
- Hash computation
- Validation schemas

### Integration Tests
- API endpoint responses
- Database query operations
- Authentication flows
- Error handling

### E2E Tests (optional)
- Full user flows (register → equip → combat → materials)

## Deployment

### Railway Configuration
- **Build Command:** `pnpm install && pnpm build`
- **Start Command:** `node dist/server.js`
- **Environment:** Production
- **Auto-deploy:** main branch

### Database Migrations
- Supabase migration files in `supabase/migrations/`
- Run via `supabase db push`
- Schema defined in `docs/data-plan.yaml`

## Development Workflow

```bash
# Install dependencies
pnpm install

# Generate Supabase types
pnpm supabase:types

# Start dev server (hot reload)
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
```

## API Documentation

OpenAPI spec: `docs/api-contracts.yaml`

View interactive docs: `http://localhost:3000/api-docs` (Swagger UI - to be added)

## Performance Considerations

- **Image Generation:** 20s sync acceptable due to global cache (most requests instant)
- **Request Coalescing:** Prevent thundering herd for same combo_hash
- **Database Indexing:** Composite indexes on (user_id, item_type_id), (material_combo_hash)
- **Redis Caching:** Combat sessions (15min TTL)
- **Connection Pooling:** Supabase client handles this automatically

## Security

- **JWT Validation:** All protected routes verify Supabase Auth tokens
- **Row-Level Security:** Supabase RLS policies enforce user_id ownership
- **Input Validation:** Zod schemas validate all requests
- **SQL Injection:** Parameterized queries via Supabase client
- **Rate Limiting:** To be added (express-rate-limit)

## Monitoring & Logging

- **Winston:** Structured logging to console/file
- **Error Tracking:** To be added (Sentry integration)
- **Performance Monitoring:** To be added (Railway metrics)

---

**Architecture Status:** ✅ Approved
**Implementation Status:** 🚧 In Progress
**Last Updated:** 2025-10-21
