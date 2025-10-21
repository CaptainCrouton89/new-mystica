# RarityService Specification

## Overview

The RarityService provides read-only access to rarity definitions and their stat multipliers/drop rates for client applications. It serves as a simple data access service for the RarityDefinitions table, supporting item display UI with rarity colors, names, and multiplier values for client-side calculations.

**Status**: ❌ NOT IMPLEMENTED - Needs creation

## Architecture

### Service Layer (RarityService)
- **File**: `mystica-express/src/services/RarityService.ts`
- **Purpose**: Simple data access service for rarity system configuration
- **Pattern**: Read-only service for static seed data
- **Status**: Not implemented (needs creation)

### Database Layer
- **Primary Table**: `raritydefinitions` (5 rows: common, uncommon, rare, epic, legendary)
- **Data Type**: Static seed data that rarely changes
- **Access Pattern**: Read-only queries with high cache potential

## Core Features

### 1. Rarity Definition Retrieval

**Primary Method**: `RarityService.getAllRarities()`
- Fetches all rarity definitions from database
- Orders by stat multiplier (ascending: common → legendary)
- Returns complete rarity configuration for client applications
- Highly cacheable since rarity data is static

**Implementation Details**:
```typescript
async getAllRarities(): Promise<RarityDefinition[]> {
  const { data, error } = await supabase
    .from('raritydefinitions')
    .select('*')
    .order('stat_multiplier', { ascending: true });

  if (error) {
    throw new DatabaseError('Failed to fetch rarity definitions', error);
  }

  return data || [];
}
```

### 2. Rarity System Configuration

**Rarity Definitions Structure**:
```typescript
interface RarityDefinition {
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  stat_multiplier: number;      // 1.000 to 2.000 (item stat scaling)
  base_drop_rate: number;       // 0.01000 to 0.60000 (loot probability)
  display_name: string;         // "Common", "Uncommon", etc.
  color_hex: string;            // "#FFFFFF", "#1EFF00", etc.
  created_at: string;           // ISO timestamp
}
```

**Expected Data Values** (from database seed):
- **Common**: 1.000x multiplier, 60% drop rate, white color
- **Uncommon**: 1.250x multiplier, 25% drop rate, green color
- **Rare**: 1.500x multiplier, 10% drop rate, blue color
- **Epic**: 1.750x multiplier, 3% drop rate, purple color
- **Legendary**: 2.000x multiplier, 1% drop rate, orange color

## Service Method Specifications

### Core Methods

#### `getAllRarities(): Promise<RarityDefinition[]>`

**Purpose**: Retrieve all rarity definitions ordered by stat multiplier

**Parameters**: None

**Returns**: Array of RarityDefinition objects

**Throws**:
- `DatabaseError` - Supabase query failure or connection issues

**Performance**:
- **Response Time**: 1-5ms (small table, primary key lookup)
- **Caching Potential**: High (24+ hour cache recommended)
- **Memory Usage**: ~500 bytes (5 small records)

**Ordering**: Results ordered by `stat_multiplier` ascending (common first)

**Error Handling**:
```typescript
if (error) {
  throw new DatabaseError('Failed to fetch rarity definitions', error);
}

// Handle empty results gracefully
return data || [];
```

### Alternative Implementation Patterns

#### Option 1: Standalone RarityService (Recommended)
```typescript
export class RarityService {
  async getAllRarities(): Promise<RarityDefinition[]> {
    // Direct Supabase query implementation
  }
}

export const rarityService = new RarityService();
```

#### Option 2: Extend ItemService
```typescript
export class ItemService {
  // ... existing item methods

  async getRarityDefinitions(): Promise<RarityDefinition[]> {
    // Add to existing item-related service
  }
}
```

**Recommendation**: Use standalone RarityService for cleaner separation of concerns

## Database Dependencies

### Primary Table: `raritydefinitions`

**Schema Structure**:
```sql
CREATE TABLE raritydefinitions (
  rarity VARCHAR PRIMARY KEY,           -- 'common', 'uncommon', etc.
  stat_multiplier DECIMAL(5,3) NOT NULL,  -- 1.000 to 2.000
  base_drop_rate DECIMAL(7,5) NOT NULL,   -- 0.01000 to 0.60000
  display_name VARCHAR NOT NULL,           -- User-friendly names
  color_hex VARCHAR(7) NOT NULL,          -- Hex color codes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Data Characteristics**:
- **Row Count**: 5 rarities (static count)
- **Data Size**: ~200 bytes per row, ~1KB total
- **Change Frequency**: Static seed data, rarely updated
- **Access Pattern**: Read-heavy, no mutations during normal operation

**Index Requirements**:
```sql
-- Primary key index (automatic)
PRIMARY KEY (rarity)

-- Optional: Ordering optimization
CREATE INDEX idx_raritydefinitions_multiplier ON raritydefinitions(stat_multiplier);
```

## Integration Points

### Frontend Integration
- **Item Display UI**: Rarity colors for item cards and tooltips
- **Stat Calculations**: Client-side stat multiplier application
- **Drop Rate Display**: Show expected drop probabilities
- **Inventory Sorting**: Sort items by rarity tier

### Backend Integration
- **Item System**: References rarity for stat calculations
- **Loot System**: Uses drop rates for probability calculations
- **Material System**: Rarity affects material value and appearance
- **Validation**: Ensures rarity references are valid

### API Usage Examples
```typescript
// Frontend: Load rarity data for UI
const rarities = await api.get('/rarities');
const rarityMap = Object.fromEntries(
  rarities.data.rarities.map(r => [r.rarity, r])
);

// Apply rarity color to item display
const itemColor = rarityMap[item.rarity]?.color_hex || '#FFFFFF';

// Calculate final item stats
const finalAttack = baseAttack * rarityMap[item.rarity]?.stat_multiplier || 1.0;
```

## Error Handling

### Service Layer Errors
- `DatabaseError` - Supabase connection failures or query errors
- **No NotFoundError** - Empty results return empty array (graceful degradation)

### API Layer Errors (from controller)
- `500` - Database connection issues or service failures
- **No authentication required** - Public reference data

### Graceful Degradation
```typescript
// Fallback for missing rarity data
const fallbackRarity: RarityDefinition = {
  rarity: 'common',
  stat_multiplier: 1.0,
  base_drop_rate: 1.0,
  display_name: 'Unknown',
  color_hex: '#FFFFFF',
  created_at: new Date().toISOString()
};
```

## Performance Characteristics

### Response Time
- **Database Query**: 1-5ms (small table, simple SELECT)
- **Total Response Time**: 5-15ms including serialization
- **Scaling**: O(1) - constant time regardless of system load

### Caching Strategy
- **Recommended Cache Duration**: 24 hours
- **Cache Key**: `rarities:all`
- **Cache Invalidation**: Manual invalidation on rare seed data updates
- **Memory Usage**: ~1KB cached data

### Optimization Opportunities
```typescript
// Service-level caching
private cache: RarityDefinition[] | null = null;
private cacheExpiry: number = 0;

async getAllRarities(): Promise<RarityDefinition[]> {
  const now = Date.now();

  if (this.cache && now < this.cacheExpiry) {
    return this.cache;
  }

  const rarities = await this.fetchFromDatabase();
  this.cache = rarities;
  this.cacheExpiry = now + (24 * 60 * 60 * 1000); // 24 hours

  return rarities;
}
```

## Security Considerations

### Access Control
- **No Authentication Required**: Rarity data is public reference information
- **Read-Only Access**: No mutation endpoints needed
- **No User-Specific Data**: Same data returned for all requests

### Data Exposure
- **Safe to Cache**: No sensitive information in rarity definitions
- **Public Data**: Color codes and multipliers are game mechanics, not secrets
- **No Rate Limiting Needed**: Lightweight endpoint with high cache hit rates

## Testing Strategy

### Unit Tests Required
```typescript
describe('RarityService', () => {
  describe('getAllRarities', () => {
    it('should return all 5 rarity definitions');
    it('should order results by stat_multiplier ascending');
    it('should include all required fields in response');
    it('should handle database errors gracefully');
    it('should return empty array for empty database');
  });
});
```

### Integration Tests Required
```typescript
describe('RarityService Integration', () => {
  it('should fetch real rarity data from database');
  it('should match expected rarity structure');
  it('should include common, uncommon, rare, epic, legendary');
  it('should have valid stat multipliers (1.0-2.0 range)');
  it('should have valid drop rates (0.0-1.0 range)');
  it('should have valid hex color codes');
});
```

### Test Data Requirements
- Use existing `raritydefinitions` seed data (5 rows)
- Test with empty database state
- Test with malformed data scenarios

## Documentation References

- **Feature Spec**: `docs/feature-specs/F-03-base-items-equipment.yaml` (rarity system)
- **Database Schema**: `docs/data-plan.yaml` (lines 407-416)
- **Controller Spec**: `docs/controller-specs/RarityController.md`
- **API Contracts**: `docs/api-contracts.yaml` (needs update for new endpoint)

## Future Enhancements

### Potential Extensions
- **Dynamic Rarities**: Runtime creation of new rarity tiers
- **Seasonal Rarities**: Time-limited special rarity types
- **Rarity Analytics**: Track rarity distribution in player inventories

### Advanced Features
- **Rarity Progression**: Upgrade items between rarity tiers
- **Rarity Bonuses**: Additional effects beyond stat multipliers
- **Custom Colors**: Player-customizable rarity color schemes

### Performance Enhancements
- **CDN Distribution**: Serve rarity data from edge locations
- **Client Bundling**: Include rarity data in application bundle
- **Real-time Updates**: WebSocket-based rarity definition updates

---

**Implementation Priority**: Medium - Required for RarityController completion

**Dependencies**:
- `raritydefinitions` table with seed data
- Supabase client configuration
- Error handling utilities

**Next Steps**:
1. Create RarityService class with getAllRarities method
2. Add proper error handling and type definitions
3. Implement caching strategy for performance
4. Create unit and integration tests
5. Integrate with RarityController