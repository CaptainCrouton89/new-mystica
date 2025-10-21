## F-01 Backend Implementation Plan — Geolocation-based Nearby Locations API

References: `docs/feature-specs/F-01-geolocation-map.yaml`, `docs/api-contracts.yaml`, `migrations/001_initial_schema.sql`, `mystica-express/src/app.ts`, `CLAUDE.md`

---

### Section 1: Architecture Decisions

- **Distance calculation: PostGIS ST_Distance with geography type (Option A)**
  - **Rationale**: PostGIS 3.3.7 is ALREADY ENABLED in remote DB (verified). Native geospatial functions provide accurate great-circle distance and efficient radius filtering with ST_DWithin.
  - **Trade-offs**: None for MVP0. PostgreSQL function handles all distance logic. Scales well with proper indexing.
  - **Implementation**: Create RPC function `get_nearby_locations()` using ST_MakePoint + geography casting for accurate distance in meters.

- **30 hardcoded SF locations: SQL seed data file (Option A)**
  - **Rationale**: Persistent across restarts, versionable, follows database-first approach. Can be applied once via migration or manual SQL execution.
  - **Trade-offs**: Requires SQL execution step (not automated in app). Simple to verify with SELECT COUNT(*).
  - **Future**: Expand to more cities or dynamic generation system.

- **Query strategy**
  - Use PostGIS RPC function for clean separation of concerns
  - ST_DWithin for efficient radius filtering (uses spatial logic)
  - ST_Distance for accurate distance calculation in meters
  - Sorted by distance in SQL (not application layer)

---

### Section 2: File Structure

- Create
  - `mystica-express/src/routes/locations.ts` — Express routes: `GET /nearby`, `GET /:id`
  - `mystica-express/src/controllers/LocationController.ts` — Orchestrates request → service
  - `mystica-express/src/services/LocationService.ts` — Data access + business logic
  - `mystica-express/migrations/seed_sf_locations.sql` — 30 SF INSERT statements
  - `mystica-express/migrations/create_nearby_locations_function.sql` — PostGIS RPC function
- Modify
  - `mystica-express/src/app.ts` — Mount `locations` router at `/api/v1/locations`
  - `mystica-express/src/types/schemas.ts` — Zod schemas for query/body params

Dependencies
- Routes depend on Controller; Controller depends on Service; Service depends on Supabase client and PostGIS RPC function; Validation schemas used by routes middleware.

Recommended order
1) Seed data SQL → 2) PostGIS RPC function → 3) Zod schemas → 4) Service → 5) Controller → 6) Routes + `app.ts` wiring

---

### Section 3: Task Breakdown

- **T1: Create SF Locations Seed Data** (simple)
  - File: `migrations/seed_sf_locations.sql`
  - 30 INSERT statements with real SF coordinates (37.7-37.8 lat, -122.5 to -122.4 lng)
  - Diverse location_types: library, gym, park, coffee_shop, restaurant
  - Use meaningful names (e.g., "Golden Gate Park - Main Entrance")
  - All have state_code='CA', country_code='US'
  - Acceptance: Can execute SQL and verify 30 rows inserted

- **T2: Create PostGIS RPC Function** (moderate)
  - File: `migrations/create_nearby_locations_function.sql`
  - Function signature: `get_nearby_locations(user_lat DECIMAL, user_lng DECIMAL, search_radius INT)`
  - Returns TABLE with columns: id, name, lat, lng, location_type, state_code, country_code, distance_meters
  - Uses ST_MakePoint + ::geography casting for accurate distance
  - Uses ST_DWithin for radius filtering
  - Sorted by distance_meters ASC
  - Acceptance: Function exists and returns correct results when tested with SF coordinates

- **T3: Add Zod Validation Schemas** (simple)
  - File: `src/types/schemas.ts`
  - `NearbyLocationsQuerySchema`: lat (-90 to 90), lng (-180 to 180), radius (1 to 50000, default 5000)
  - `LocationParamsSchema`: id (UUID format)
  - Acceptance: Invalid values rejected with proper Zod errors

- **T4: Create LocationService** (simple)
  - File: `src/services/LocationService.ts`
  - Methods:
    - `nearby(lat, lng, radius)` — Calls Supabase RPC function `get_nearby_locations`
    - `getById(id)` — Fetches single location by UUID
  - Uses Supabase client from `src/config/supabase.ts`
  - Throws DatabaseError on query failure, NotFoundError on missing ID
  - Acceptance: Service calls work correctly and return expected data shapes

- **T5: Create LocationController** (simple)
  - File: `src/controllers/LocationController.ts`
  - Methods:
    - `getNearby` — Handles GET /locations/nearby, returns `{ locations: [...] }`
    - `getById` — Handles GET /locations/:id, returns single location object
  - Uses req.validated from validation middleware
  - Proper error handling with try/catch → next(error)
  - Acceptance: Controller methods call service and return correct JSON structure

- **T6: Create Location Routes** (simple)
  - File: `src/routes/locations.ts`
  - Routes:
    - `GET /nearby` with auth + validation middleware
    - `GET /:id` with auth + validation middleware
  - Exports Express Router
  - Acceptance: Routes defined correctly with all middleware

- **T7: Wire Routes to App** (simple)
  - File: `src/app.ts`
  - Add: `import locationRoutes from './routes/locations';`
  - Add: `app.use('/api/v1/locations', locationRoutes);`
  - Acceptance: Server starts without errors, routes are mounted

---

### Section 4: Validation Plan

- **Unit**
  - Haversine accuracy at known pairs (0m same point; ~111,195m per degree latitude).
  - Zod schema parsing for valid/invalid ranges.
- **Integration**
  - Seed then query; assert sort order and radius filtering; verify shape per `docs/api-contracts.yaml`.
  - Auth path exercise: If auth middleware is active, simulate or bypass with test token (see Risks).
- **Manual QA**
  - Start backend; run `POST /api/v1/locations/generate`.
  - Call: `GET /api/v1/locations/nearby?lat=37.7749&lng=-122.4194&radius=5000`.
  - Expect: up to 30 locations; top entry within a few hundred meters if a seed near downtown SF.
- **Performance**
  - With 30 rows, response < 50ms locally. Budget < 500ms end-to-end.

---

### Section 5: Risks & Mitigations

- **Migrations not applied** (`migrations/001_initial_schema.sql`)
  - Mitigation: Ensure `Locations` table exists in Supabase before running endpoints. Add preflight check with clear error if missing.
- **Auth middleware placeholder/broken** (`src/middleware/auth.ts` per `CLAUDE.md`)
  - Mitigation: For MVP0, allow `/locations/*` to work in development without strict auth, or add a feature flag to bypass. Align with `api-contracts.yaml` by enabling BearerAuth once middleware is fixed.
- **Supabase connection issues**
  - Mitigation: Reuse `src/config/supabase.ts`; surface connection errors via centralized error handler.
- **Distance accuracy/edge cases**
  - Invalid lat/lng or extreme radius → handled by Zod.
  - Antimeridian not relevant for SF data set.
- **Empty DB**
  - If `/nearby` hit before seeding, return `[]` and log: "No locations found; run POST /locations/generate".

---

### Section 6: Post-MVP Considerations

- **Enable PostGIS**
  - Migration to add `postgis` extension and Geography column; indexes (GiST) and queries with `ST_DWithin` for efficient radius filtering and sort by distance in SQL.
- **Cooldowns and activation radius**
  - Add server-side activation logic (≤50m) and per-user cool-down state.
- **Scalability**
  - Bounding-box prefilter immediately; then full geospatial queries; add pagination/limit.
- **Schema hardening**
  - Unique constraint on `(name, lat, lng)` or natural key; add `NOT NULL` for important fields; consider `location_type` enum.
- **Security**
  - Restore BearerAuth once middleware fixed; apply rate-limits to `POST /generate`.
- **DX and Observability**
  - Add seed script to CI/dev; structured logs around geo queries.

---

### Appendix: Response Shape Examples

- `GET /locations/nearby` response example:
```json
{
  "locations": [
    {
      "id": "20d8e6b1-...",
      "lat": 37.7793,
      "lng": -122.4192,
      "location_type": "park",
      "distance_meters": 184.2
    }
  ]
}
```

- Minimal route/controller wiring (illustrative):
```ts
// routes/locations.ts
router.get('/nearby', auth, validate(locationsNearbyQuery), LocationController.nearby);
router.post('/generate', authOptional, LocationController.generate);
router.get('/:id', auth, validate(locationIdParam), LocationController.getById);
```

Citations
- Feature spec: `docs/feature-specs/F-01-geolocation-map.yaml`
- API contract: `docs/api-contracts.yaml`
- Schema indexes: `migrations/001_initial_schema.sql`
- App mount point: `mystica-express/src/app.ts`
- Auth status and constraints: `CLAUDE.md`
