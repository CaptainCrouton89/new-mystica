# StyleService Specification

## Overview

The StyleService manages the retrieval and validation of visual style definitions for the materials and enemies style system. It provides read-only access to the StyleDefinitions table, which contains pre-defined art style variants used throughout the game for visual consistency and style inheritance in the drop system.

**Status**: ❌ NOT IMPLEMENTED - Needs creation

## Architecture

### Service Layer (StyleService)
- **File**: `mystica-express/src/services/StyleService.ts`
- **Purpose**: Business logic for style operations and style definition management
- **Pattern**: Read-only service for static/semi-static configuration data
- **Status**: Not implemented (needs creation)

### Alternative: Extend MaterialService
- **Option**: Add style methods to existing MaterialService
- **Benefit**: Co-location with material-related operations
- **Drawback**: Less clear separation of concerns

### Database Layer
- **Primary Table**: `StyleDefinitions` (5-10 style variants)
- **Data Type**: Semi-static seed data (styles added occasionally)
- **Access Pattern**: Read-heavy with high cache potential

## Core Features

### 1. Style Definition Retrieval

**Primary Method**: `StyleService.getAllStyles()`
- Fetches all style definitions from StyleDefinitions table
- Orders by spawn rate (descending) then style name (alphabetic)
- Returns complete style configuration for client applications
- Supports UI tooltips, rendering hints, and spawn probability display

**Implementation Details**:
```typescript
async getAllStyles(): Promise<StyleDefinition[]> {
  const { data, error } = await supabase
    .from('styledefinitions')
    .select('*')
    .order('spawn_rate', { ascending: false })
    .order('style_name', { ascending: true });

  if (error) {
    throw new DatabaseError('Failed to fetch style definitions', error);
  }

  return data || [];
}
```

### 2. Style System Architecture

**Style Inheritance Flow**:
```
Enemy (style_id) → Material Drop (inherits style_id) → Item Crafting (style affects image generation)
```

**Style Definition Structure**:
```typescript
interface StyleDefinition {
  id: string;              // UUID - Primary key
  style_name: string;      // Unique identifier: 'normal', 'pixel_art', 'watercolor', 'neon', 'sketch'
  display_name: string;    // User-friendly name: 'Normal', 'Pixel Art', 'Watercolor', 'Neon', 'Sketch'
  spawn_rate: number;      // Decimal 0-1: spawn probability (1.0 for normal, 0.01 for rare styles)
  description: string;     // Art style description for UI tooltips
  visual_modifier: string; // Rendering hints: 'pixelated', 'soft_edges', 'glowing', etc.
  created_at: string;      // ISO timestamp
}
```

**Expected Style Variants**:
- **Normal**: Default style (100% spawn rate)
- **Pixel Art**: Retro pixelated appearance (1% spawn rate)
- **Watercolor**: Soft flowing edges (5% spawn rate)
- **Neon**: Glowing effects (2% spawn rate)
- **Sketch**: Hand-drawn appearance (3% spawn rate)

### 3. Style Validation Support

**Supporting Method**: `StyleService.validateStyleExists(styleId)`
- Validates style_id references exist in StyleDefinitions
- Used by material application and replacement operations
- Prevents orphaned style references in database

**Implementation Pattern**:
```typescript
async validateStyleExists(styleId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('styledefinitions')
    .select('id')
    .eq('id', styleId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    throw new DatabaseError('Failed to validate style existence', error);
  }

  return !!data;
}
```

## Service Method Specifications

### Core Methods

#### `getAllStyles(): Promise<StyleDefinition[]>`

**Purpose**: Retrieve all style definitions with spawn rates and visual properties

**Parameters**: None

**Returns**: Array of StyleDefinition objects ordered by spawn rate (desc), then name (asc)

**Throws**:
- `DatabaseError` - Supabase query failure or connection issues

**Performance**:
- **Response Time**: 1-5ms (small table, simple query)
- **Caching Potential**: High (24+ hour cache recommended)
- **Memory Usage**: ~2KB (5-10 style records)

**Ordering Logic**:
1. Primary sort: `spawn_rate DESC` (common styles first)
2. Secondary sort: `style_name ASC` (alphabetical within spawn rates)

#### `validateStyleExists(styleId: string): Promise<boolean>`

**Purpose**: Validate that a style_id exists in StyleDefinitions table

**Parameters**:
- `styleId`: UUID string to validate

**Returns**: Boolean indicating if style exists

**Throws**:
- `DatabaseError` - Query failure (excluding not found)
- `ValidationError` - Invalid UUID format

**Usage Examples**:
```typescript
// Material application validation
if (!await styleService.validateStyleExists(requestedStyleId)) {
  throw new ValidationError('Style does not exist');
}

// Bulk validation for material replacement
const validStyles = await Promise.all(
  styleIds.map(id => styleService.validateStyleExists(id))
);
```

#### `getStyleByName(styleName: string): Promise<StyleDefinition | null>`

**Purpose**: Get specific style definition by unique style_name

**Parameters**:
- `styleName`: Style identifier ('normal', 'pixel_art', etc.)

**Returns**: StyleDefinition object or null if not found

**Throws**:
- `DatabaseError` - Query failure

**Performance**: 1-3ms with indexed lookup

### Alternative Implementation: Extend MaterialService

```typescript
// If extending MaterialService instead of creating StyleService
export class MaterialService {
  // ... existing material methods

  /**
   * Get all available style definitions
   */
  async getAllStyles(): Promise<StyleDefinition[]> {
    // Implementation identical to standalone service
  }

  /**
   * Validate style exists for material operations
   */
  async validateMaterialStyle(styleId: string): Promise<boolean> {
    // Style validation specific to material context
  }
}
```

## Database Dependencies

### Primary Table: `StyleDefinitions`

**Schema Structure**:
```sql
CREATE TABLE StyleDefinitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  style_name VARCHAR UNIQUE NOT NULL,        -- 'normal', 'pixel_art', etc.
  display_name VARCHAR NOT NULL,             -- 'Normal', 'Pixel Art', etc.
  spawn_rate DECIMAL(5,4) NOT NULL CHECK (spawn_rate >= 0 AND spawn_rate <= 1),
  description TEXT NOT NULL,                 -- Style description for tooltips
  visual_modifier VARCHAR NOT NULL,          -- Rendering hints
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Constraints**:
- `style_name` must be unique (prevents duplicate style identifiers)
- `spawn_rate` constrained to 0.0-1.0 range
- All fields required (no nullable columns except timestamps)

**Index Requirements**:
```sql
-- Primary key index (automatic)
PRIMARY KEY (id)

-- Unique constraint index (automatic)
UNIQUE (style_name)

-- Query optimization indexes
CREATE INDEX idx_styledefinitions_spawn_rate ON StyleDefinitions(spawn_rate DESC);
CREATE INDEX idx_styledefinitions_name ON StyleDefinitions(style_name);
```

**Data Characteristics**:
- **Row Count**: 5-10 styles (relatively stable)
- **Data Size**: ~500 bytes per row, ~5KB total
- **Change Frequency**: Semi-static (new styles added occasionally)
- **Access Pattern**: Read-heavy, occasional inserts

## Integration Points

### Frontend Integration
- **Material Application UI**: Display available styles when applying materials
- **Inventory Display**: Show style variants in material stacks
- **Item Gallery**: Display style information for crafted items
- **Style Tooltips**: Show style descriptions and visual modifiers

### Backend Integration
- **MaterialController**: Style validation in apply/replace operations
- **Drop System**: Style inheritance from enemies to materials
- **Image Generation**: Style information for combo hash calculation
- **Item Crafting**: Style affects final item appearance

### Validation Integration
```typescript
// In material application schemas
export const ApplyMaterialSchema = z.object({
  // ... other fields
  style_id: z.string().uuid().refine(
    async (styleId) => await styleService.validateStyleExists(styleId),
    { message: 'Style does not exist' }
  )
});
```

### Style Inheritance Examples
```typescript
// Enemy drop with style inheritance
const enemy = { style_id: 'pixel_art' };
const droppedMaterial = {
  material_id: 'wood',
  style_id: enemy.style_id, // Inherits pixel_art style
  spawn_rate: baseSpawnRate * styleMultiplier
};

// Item crafting with style consideration
const combo_hash = calculateHash(
  item_type_id,
  material_ids.sort(),
  style_ids.sort() // Style affects caching
);
```

## Error Handling

### Service Layer Errors
- `DatabaseError` - Supabase connection failures or query errors
- `ValidationError` - Invalid style_id format or constraints
- **No NotFoundError** - Missing styles return null/empty gracefully

### API Layer Errors (from controller)
- `500` - Database connection issues or service failures
- **No authentication required** - Public reference data

### Graceful Degradation
```typescript
// Fallback for missing style data
const fallbackStyle: StyleDefinition = {
  id: '00000000-0000-0000-0000-000000000000',
  style_name: 'normal',
  display_name: 'Normal',
  spawn_rate: 1.0,
  description: 'Standard appearance with no special visual effects',
  visual_modifier: 'none',
  created_at: new Date().toISOString()
};

// Use in service methods
return data || [fallbackStyle];
```

## Performance Characteristics

### Response Time
- **Database Query**: 1-5ms (small table, simple SELECT)
- **Validation Queries**: 1-3ms (indexed UUID lookup)
- **Total Response Time**: 5-15ms including serialization

### Caching Strategy
- **Recommended Cache Duration**: 24 hours (semi-static data)
- **Cache Key**: `styles:all` or `style:${styleId}`
- **Cache Invalidation**: Manual on rare style additions
- **Memory Usage**: ~5KB cached data

### Optimization Opportunities
```typescript
// Service-level caching with TTL
private styleCache = new Map<string, { data: StyleDefinition[], expiry: number }>();

async getAllStyles(): Promise<StyleDefinition[]> {
  const cacheKey = 'all_styles';
  const cached = this.styleCache.get(cacheKey);
  const now = Date.now();

  if (cached && now < cached.expiry) {
    return cached.data;
  }

  const styles = await this.fetchFromDatabase();
  this.styleCache.set(cacheKey, {
    data: styles,
    expiry: now + (24 * 60 * 60 * 1000) // 24 hours
  });

  return styles;
}
```

## Security Considerations

### Access Control
- **No Authentication Required**: Style data is public reference information
- **Read-Only Service**: No mutation operations in service layer
- **No User-Specific Data**: Same data returned for all requests

### Data Validation
- **UUID Validation**: Ensure style_id parameters are valid UUIDs
- **Constraint Validation**: Verify spawn_rate within 0.0-1.0 range
- **Input Sanitization**: Validate style_name format if accepting user input

## Testing Strategy

### Unit Tests Required
```typescript
describe('StyleService', () => {
  describe('getAllStyles', () => {
    it('should return all style definitions');
    it('should order by spawn_rate DESC, style_name ASC');
    it('should include all required fields');
    it('should handle database errors gracefully');
    it('should return empty array for empty database');
  });

  describe('validateStyleExists', () => {
    it('should return true for existing style IDs');
    it('should return false for non-existent style IDs');
    it('should handle invalid UUID format');
    it('should throw DatabaseError on query failure');
  });

  describe('getStyleByName', () => {
    it('should return style for valid style_name');
    it('should return null for non-existent style_name');
    it('should handle case sensitivity correctly');
  });
});
```

### Integration Tests Required
```typescript
describe('StyleService Integration', () => {
  it('should fetch real style data from database');
  it('should include normal style with 1.0 spawn rate');
  it('should include rare styles with low spawn rates');
  it('should maintain referential integrity with style_id references');
  it('should validate existing and non-existing styles correctly');
});
```

### Test Data Requirements
- Seed StyleDefinitions table with 5-10 test styles
- Include normal style with 1.0 spawn rate
- Include rare styles with varying spawn rates
- Test edge cases: empty table, malformed data

## Documentation References

- **Feature References**: F-04 Materials System, F-05 Drop System
- **Controller Spec**: `docs/controller-specs/StyleController.md`
- **Database Schema**: `docs/data-plan.yaml` (lines 418-427)
- **API Contracts**: `docs/api-contracts.yaml` (style_id references)
- **System Design**: Style inheritance architecture

## Future Enhancements

### Advanced Style Features
- **Dynamic Styles**: Runtime creation of custom styles
- **Style Combinations**: Mixing multiple style effects on single items
- **Seasonal Styles**: Time-limited special styles for events

### Performance Enhancements
- **Style Preloading**: Bundle common styles with application
- **Edge Caching**: CDN distribution of style definitions
- **Style Versioning**: Track style definition changes over time

### Integration Expansions
- **Style Analytics**: Track style popularity and usage patterns
- **Style Marketplace**: User-generated custom styles (post-MVP)
- **Style Progression**: Unlock rare styles through gameplay

---

**Implementation Priority**: Medium - Required for StyleController and material system completion

**Dependencies**:
- `StyleDefinitions` table with seed data
- Supabase client configuration
- Error handling utilities
- Material system integration

**Next Steps**:
1. Create StyleService class with core methods
2. Implement style validation for material operations
3. Add comprehensive caching strategy
4. Create unit and integration tests
5. Integrate with StyleController and MaterialService