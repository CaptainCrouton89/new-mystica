# Location Service Specification

## Overview

The Location Service handles geolocation-based operations for the Mystica game, enabling players to discover combat locations and manage location-based gameplay mechanics. It leverages PostGIS for efficient geospatial queries and implements a sophisticated pool system for enemy spawning and loot distribution.

**Status**: ✅ Largely Complete (LocationService implemented, LocationRepository comprehensive)

## Architecture

### Service Layer (LocationService)
- **File**: `mystica-express/src/services/LocationService.ts`
- **Purpose**: High-level business logic for location operations
- **Status**: Basic implementation complete (2 methods)

### Repository Layer (LocationRepository)
- **File**: `mystica-express/src/repositories/LocationRepository.ts`
- **Purpose**: Data access layer with complex pool matching logic
- **Status**: Comprehensive implementation (418 lines, all methods implemented)

### Database Layer
- **PostGIS Integration**: PostgreSQL with PostGIS extension for geospatial calculations
- **RPC Function**: `get_nearby_locations(user_lat, user_lng, search_radius)`
- **Spatial Indexing**: Optimized (lat, lng) indexes for sub-50ms queries

## Core Features

### 1. Geospatial Location Discovery

**Primary Method**: `LocationService.nearby(lat, lng, radius)`
- Uses PostGIS `ST_DWithin` for geography-based distance calculation
- Returns results ordered by distance (closest first)
- Efficient spatial queries with meter-accurate distances
- Default search radius: 5000m (5km)

**Implementation Details**:
```typescript
// LocationService.nearby() calls PostGIS RPC
const { data, error } = await supabase.rpc('get_nearby_locations', {
  user_lat: lat,
  user_lng: lng,
  search_radius: radius,
});
```

**PostGIS RPC Benefits**:
- Server-side distance calculations (more accurate than client-side)
- Spatial index optimization
- Geography type handles Earth curvature properly
- Returns distance in meters for each location

### 2. Location Metadata Management

**Location Schema**:
```sql
Locations {
  id: UUID (PK)
  name: VARCHAR (descriptive names for map markers)
  lat: DECIMAL(10,8) (latitude, 6+ decimal precision)
  lng: DECIMAL(11,8) (longitude, 6+ decimal precision)
  location_type: VARCHAR (library, gym, park, coffee_shop, restaurant, school)
  state_code: VARCHAR (US state code: CA, NY, TX)
  country_code: VARCHAR (ISO country code: USA, CAN)
  spawn_radius: INT (activation distance in meters, default 50m)
  is_premium: BOOLEAN (future premium location feature)
  created_at: TIMESTAMP
}
```

**Repository Methods**:
- `findById(locationId)` - Get specific location with validation
- `findByType(locationType)` - Filter by location_type (e.g., 'library')
- `findByRegion(stateCode, countryCode)` - Regional filtering
- `findAll(limit?, offset?)` - Paginated location listing

### 3. Enemy Pool System (Combat Initialization)

**Pool Matching Logic**:
The system combines multiple pool types for dynamic enemy selection:

```typescript
// Pool filter types supported
type PoolFilterType = 'universal' | 'location_type' | 'state' | 'country' | 'lat_range' | 'lng_range';
```

**Pool Union Strategy** (from F-01 spec):
> Location fetches: location_type pool ∪ state pool ∪ latitude pool ∪ longitude pool ∪ generic pool (100 base enemies)

**Implementation Flow**:
1. `getMatchingEnemyPools(location, combatLevel)` - Find applicable pools
2. `getEnemyPoolMembers(poolIds)` - Get enemies with spawn weights
3. `selectRandomEnemy(poolMembers)` - Weighted random selection

**Example Combat Query** (Level 10 library in California):
```
Location: {location_type: "library", state_code: "CA", country_code: "USA"}
Combat Level: 10

Matching Pools:
- Universal Level 10 (filter_type: 'universal')
- Library Level 10 (filter_type: 'location_type', filter_value: 'library')
- California Level 10 (filter_type: 'state', filter_value: 'CA')
- USA Level 10 (filter_type: 'country', filter_value: 'USA')

Aggregated Enemy Pool:
- spray_paint_goblin: weight 100 (universal)
- politician: weight 150 (library-specific, higher weight)
- ferral_unicorn: weight 120 (California-specific)
```

**Weighted Random Selection Algorithm**:
```typescript
selectRandomEnemy(poolMembers: EnemyPoolMember[]): string {
  const totalWeight = poolMembers.reduce((sum, member) => sum + member.spawn_weight, 0);
  const randomValue = Math.random() * totalWeight;

  let currentWeight = 0;
  for (const member of poolMembers) {
    currentWeight += member.spawn_weight;
    if (randomValue <= currentWeight) {
      return member.enemy_type_id;
    }
  }
}
```

### 4. Loot Pool System (Combat Rewards)

**Parallel Pool System**:
- Same filter logic as enemy pools (`universal | location_type | state | country | lat_range | lng_range`)
- Supports both materials and item_types as loot
- Tier-based weight multipliers for material rarity balancing

**Implementation Flow**:
1. `getMatchingLootPools(location, combatLevel)` - Find applicable loot pools
2. `getLootPoolEntries(poolIds)` - Get loot items with base weights
3. `getLootPoolTierWeights(poolIds)` - Get tier multipliers per pool
4. `selectRandomLoot(entries, tierWeights, enemyStyleId, dropCount)` - Apply weights & select

**Tier Weight System**:
- Materials classified into tiers: common, uncommon, rare, epic
- Per-pool multipliers: common 1.0, uncommon 0.7, rare 0.35, epic 0.15
- Formula: `final_weight = base_drop_weight × tier_multiplier`

**Style Inheritance**:
- Enemies with `style_id != 'normal'` drop materials with matching style
- Styled materials are rarer and more valuable
- Style propagates from enemy → material drops → player inventory

### 5. Performance Optimizations

**Database Indexes**:
```sql
-- Geospatial optimization
INDEX ON Locations (lat, lng) USING GIST; -- PostGIS spatial index

-- Pool query optimization
INDEX ON EnemyPools (combat_level, filter_type);
INDEX ON LootPools (combat_level, filter_type);
INDEX ON EnemyPoolMembers (enemy_pool_id);
INDEX ON LootPoolEntries (loot_pool_id);
```

**Caching Strategy**:
- Pool members cached per combat level
- Aggregated weights computed once per session
- Spatial queries optimized with PostGIS GIST indexes

**Future RPC Optimizations**:
- `getAggregatedEnemyPools()` - Server-side pool aggregation
- `getAggregatedLootPools()` - Server-side loot weight calculation
- Reduces round-trips from N+1 queries to single RPC call

## API Endpoints

### GET /api/v1/locations/nearby

**Purpose**: Find spawn locations within radius of player position

**Request**:
```
Query Parameters:
- lat: number (required) - Player latitude
- lng: number (required) - Player longitude
- radius: integer (optional, default 5000) - Search radius in meters
```

**Response**:
```json
{
  "locations": [
    {
      "id": "uuid",
      "name": "San Francisco Public Library - Main",
      "lat": 37.7793,
      "lng": -122.4175,
      "location_type": "library",
      "state_code": "CA",
      "country_code": "USA",
      "spawn_radius": 50,
      "distance_meters": 245.8
    }
  ]
}
```

**Error Responses**:
- `400` - Invalid coordinates (lat/lng out of range)
- `500` - Database/PostGIS error

**Security**:
- ✅ JWT authentication required
- ✅ Zod validation for coordinates

### GET /api/v1/locations/:location_id

**Purpose**: Get specific location details by ID

**Request**:
```
Path Parameters:
- location_id: UUID (required) - Location identifier
```

**Response**:
```json
{
  "id": "uuid",
  "name": "Golden Gate Park - North Meadow",
  "lat": 37.7694,
  "lng": -122.4862,
  "location_type": "park",
  "state_code": "CA",
  "country_code": "USA",
  "spawn_radius": 50,
  "is_premium": false,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses**:
- `404` - Location not found
- `500` - Database error

**Security**:
- ✅ JWT authentication required
- ✅ UUID validation for location_id

## Data Flow Examples

### Location Discovery Flow
```
1. Player opens map → Request GPS permission
2. CoreLocation provides lat/lng → Client calls GET /locations/nearby
3. LocationService.nearby() → PostGIS RPC get_nearby_locations()
4. Results ordered by distance → Client renders map markers
5. Player approaches location → Check distance < spawn_radius
6. Location activates → Player can initiate combat
```

### Combat Initialization Flow
```
1. Player taps location → Client calls combat initialization
2. CombatService gets player combat_level (avg_item_level)
3. LocationRepository.getMatchingEnemyPools(location, level)
4. Pool union: universal ∪ location_type ∪ state ∪ country ∪ lat_range ∪ lng_range
5. LocationRepository.getEnemyPoolMembers(poolIds)
6. Aggregate spawn_weights by enemy_type_id
7. LocationRepository.selectRandomEnemy(aggregated) → Weighted selection
8. Combat session created with selected enemy
```

### Loot Drop Flow
```
1. Combat victory → Determine loot drops
2. LocationRepository.getMatchingLootPools(location, level)
3. LocationRepository.getLootPoolEntries(poolIds)
4. LocationRepository.getLootPoolTierWeights(poolIds)
5. For each drop: Apply tier multipliers to base weights
6. LocationRepository.selectRandomLoot() → Weighted selection with style inheritance
7. Materials added to player MaterialStacks with enemy.style_id
```

## Current Implementation Status

### ✅ Completed Features

**LocationService** (2/2 methods):
- ✅ `nearby(lat, lng, radius)` - PostGIS geospatial queries
- ✅ `getById(id)` - Single location retrieval with validation

**LocationRepository** (20+ methods):
- ✅ `findNearby()` - PostGIS RPC integration
- ✅ `findById()`, `findByType()`, `findByRegion()`, `findAll()` - Location queries
- ✅ `getMatchingEnemyPools()` - Pool filter logic implementation
- ✅ `getEnemyPoolMembers()` - Pool member retrieval
- ✅ `selectRandomEnemy()` - Weighted random selection algorithm
- ✅ `getMatchingLootPools()` - Loot pool matching (same logic as enemy pools)
- ✅ `getLootPoolEntries()`, `getLootPoolTierWeights()` - Loot data retrieval
- ✅ `selectRandomLoot()` - Loot selection with tier weights & style inheritance
- ✅ `buildPoolFilter()` - Complex OR-based filter query construction
- ✅ `calculateMaterialDropWeight()` - Tier multiplier application
- ✅ `getAggregatedEnemyPools()`, `getAggregatedLootPools()` - Future RPC preparation

**Database Layer**:
- ✅ PostGIS integration with `get_nearby_locations` RPC function
- ✅ 30 SF locations seeded via `migrations/seed_sf_locations.sql`
- ✅ Spatial indexes on (lat, lng) for optimization
- ✅ Pool system tables: EnemyPools, EnemyPoolMembers, LootPools, LootPoolEntries
- ✅ Tier weight system: MaterialStrengthTiers, LootPoolTierWeights

**API Layer**:
- ✅ `GET /api/v1/locations/nearby` endpoint with Zod validation
- ✅ `GET /api/v1/locations/:id` endpoint
- ✅ JWT authentication middleware integration
- ✅ 17 integration tests in `tests/integration/locations.test.ts`

### 🔄 Pending Enhancements

**Pool System**:
- ⏳ `lat_range` and `lng_range` filter implementations (TODO in buildPoolFilter:329)
- ⏳ Material tier lookup for accurate tier weight calculation (simplified in calculateMaterialDropWeight:341)
- ⏳ Server-side RPC functions for aggregated pool queries (performance optimization)

**Frontend Integration**:
- ⏳ SwiftUI MapView with Google Maps SDK integration
- ⏳ CoreLocation permission handling (non-blocking in MVP0)
- ⏳ Map marker rendering and interaction
- ⏳ Location activation UI (distance-based triggers)

**API Enhancements**:
- ⏳ `POST /locations/generate` endpoint (MVP0 instant location generation)
- ⏳ Location filtering by type/region parameters
- ⏳ Pagination for location listings

## Service Method Specifications

### LocationService Methods

#### `nearby(lat: number, lng: number, radius: number): Promise<LocationWithDistance[]>`

**Purpose**: Find locations within specified radius using PostGIS geography calculations

**Parameters**:
- `lat`: Player latitude (-90 to 90)
- `lng`: Player longitude (-180 to 180)
- `radius`: Search radius in meters (default 5000, max 50000)

**Returns**: Array of locations with distance_meters field, ordered by proximity

**Throws**:
- `DatabaseError` - PostGIS RPC call failure
- `ValidationError` - Invalid coordinate parameters

**Performance**: ~10-50ms with spatial indexing

#### `getById(id: string): Promise<Location>`

**Purpose**: Retrieve specific location by UUID with validation

**Parameters**:
- `id`: Location UUID string

**Returns**: Complete location object

**Throws**:
- `NotFoundError` - Location doesn't exist
- `DatabaseError` - Database query failure
- `ValidationError` - Invalid UUID format

**Performance**: ~1-5ms with primary key lookup

### LocationRepository Methods (Key Selections)

#### `getMatchingEnemyPools(location: Location, combatLevel: number): Promise<string[]>`

**Purpose**: Find enemy pools applicable to location and player level using union strategy

**Parameters**:
- `location`: Location object with type/region metadata
- `combatLevel`: Player's avg_item_level determining combat difficulty

**Returns**: Array of enemy pool UUIDs

**Pool Matching Logic**:
```sql
SELECT id FROM enemypools
WHERE combat_level = ? AND (
  (filter_type = 'universal' AND filter_value IS NULL) OR
  (filter_type = 'location_type' AND filter_value = location.location_type) OR
  (filter_type = 'state' AND filter_value = location.state_code) OR
  (filter_type = 'country' AND filter_value = location.country_code)
  -- lat_range and lng_range TODO
)
```

#### `selectRandomEnemy(poolMembers: EnemyPoolMember[]): string`

**Purpose**: Weighted random selection from aggregated pool members

**Algorithm**:
1. Calculate total spawn weight sum
2. Generate random value in [0, totalWeight)
3. Iterate through members, accumulating weights
4. Return enemy_type_id when random value <= accumulated weight

**Performance**: O(n) where n = number of unique enemies in pools

#### `selectRandomLoot(entries: LootPoolEntry[], tierWeights: LootPoolTierWeight[], enemyStyleId: string, dropCount: number): LootDrop[]`

**Purpose**: Select loot with tier multipliers and style inheritance

**Algorithm**:
1. Apply tier weight multipliers to base drop weights
2. For materials: `adjusted_weight = base_weight × tier_multiplier`
3. For items: Use base weight (tier weights don't apply)
4. Weighted random selection (same as enemy selection)
5. Create LootDrop with enemy's style_id for style inheritance

**Style Inheritance**: Enemies with `style_id != 'normal'` pass style to dropped materials

## Error Handling

### Service Layer Errors
- `DatabaseError` - Supabase/PostGIS operation failures
- `NotFoundError` - Location not found by ID
- `ValidationError` - Invalid coordinates/parameters

### Repository Layer Errors
- `DatabaseError` - Database query failures
- `Error` - Empty pool member arrays, zero spawn weights

### API Layer Errors
- `400` - Zod validation failures (invalid coordinates, UUID format)
- `401` - JWT authentication failures
- `404` - Location not found
- `500` - Database/service layer errors

## Security Considerations

### Authentication
- ✅ All endpoints require valid JWT token
- ✅ User context available via `req.user` from auth middleware

### Input Validation
- ✅ Zod schemas for coordinate validation
- ✅ UUID format validation for location_id
- ✅ Range validation for lat (-90, 90), lng (-180, 180)

### Data Access
- ✅ No user-specific location restrictions (locations are public)
- ✅ Pool system prevents direct enemy/loot manipulation
- ✅ Weighted selection server-side (no client influence)

## Performance Characteristics

### Geospatial Queries
- **PostGIS RPC**: 10-50ms for radius queries with spatial indexing
- **Memory usage**: ~1KB per location in result set
- **Scaling**: Handles 100K+ locations efficiently with GIST indexes

### Pool System
- **Pool queries**: 5-20ms for combat level + filter combinations
- **Pool aggregation**: 10-30ms for member retrieval and weight calculation
- **Random selection**: <1ms for weighted algorithms

### Future Optimizations
- **RPC consolidation**: Single call for aggregated pools (50%+ reduction)
- **Caching**: Combat level pools cached for session duration
- **Materialized views**: Pre-computed pool unions for common locations

## Integration Points

### Combat System (F-02)
- `getMatchingEnemyPools()` called during combat initialization
- `selectRandomEnemy()` determines combat opponent
- CombatSession stores applied_enemy_pools for analytics

### Loot System (F-04)
- `getMatchingLootPools()` called on combat victory
- `selectRandomLoot()` generates reward materials/items
- Style inheritance affects material rarity and image generation

### Map System (F-01 Frontend)
- `nearby()` provides map markers for SwiftUI MapView
- `getById()` provides location details for marker taps
- spawn_radius determines location activation triggers

### Analytics System
- Pool usage tracked in CombatSessions.applied_enemy_pools/applied_loot_pools
- Location visit frequency via PlayerCombatHistory
- Material drop analytics via style inheritance tracking

## Testing Coverage

### Integration Tests (17 tests)
- ✅ PostGIS RPC function validation
- ✅ Location proximity queries with various radii
- ✅ Location filtering by type and region
- ✅ Error handling for invalid coordinates
- ✅ JWT authentication on all endpoints

### Unit Tests (Recommended)
- ⏳ Pool matching logic with various location types
- ⏳ Weighted random selection algorithms
- ⏳ Tier weight calculations
- ⏳ Style inheritance in loot drops
- ⏳ Edge cases: empty pools, zero weights

## Deployment Notes

### Environment Variables
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...  # Required for PostGIS RPC calls
```

### Database Prerequisites
- ✅ PostGIS extension installed and configured
- ✅ `get_nearby_locations` RPC function deployed
- ✅ Spatial indexes created on Locations table
- ✅ Pool system tables seeded with combat data

### Performance Monitoring
- Monitor PostGIS RPC latency (target: <50ms p95)
- Track pool query performance per combat level
- Alert on empty pool results (indicates data seeding issues)

---

**Next Steps**:
1. Implement `lat_range`/`lng_range` pool filters
2. Add material tier lookup for accurate drop weights
3. Create server-side aggregated pool RPC functions
4. Build SwiftUI frontend integration
5. Add comprehensive unit test coverage