# Database Schema Reference

## Critical Rules (from migrations/001_initial_schema.sql)

- **Equipment architecture:** UserEquipment table = single source of truth for equipped state, NOT PlayerItem schema
- **Material stacking:** MaterialStacks has composite PK (user_id, material_id, style_id) - styles stack separately
- **Material instances:** MaterialInstances created when applied from stack, UNIQUE constraint in ItemMaterials prevents reuse
- **Image cache global:** ItemImageCache is NOT user-scoped, `craft_count` increments on each combo use
- **Style inheritance:** Enemies with style_id drop materials with matching style_id (system-design.yaml:82)
- **Level-aware pools:** EnemyPools and LootPools have filter-based matching on location attributes (location_type, state, country)
- **5 enums:** rarity, combat_result, actor, weapon_pattern, hit_band (lines 77-81)
- **PostgreSQL extensions:** PostGIS for geospatial queries (system-design.yaml:76)
- **Gold balance DEPRECATED:** Users.gold_balance marked DEPRECATED (line 94), use UserCurrencyBalances table

## Migration Status

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
```

**Validation:** Backend throws detailed Zod validation errors on startup if required vars missing (env.ts:46-62)
