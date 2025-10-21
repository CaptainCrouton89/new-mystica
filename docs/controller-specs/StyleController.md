# StyleController API Specification

## Controller Overview

### Purpose and Responsibility
The StyleController manages the retrieval and validation of visual style definitions for the materials and enemies style system. This controller provides read-only access to the StyleDefinitions table, which contains pre-defined art style variants used throughout the game for visual consistency.

### Feature References
- **F-04**: Materials System - Uses style_id for visual material variants
- **F-05**: Drop System - Enemies inherit style_id that determines dropped material styles
- **System Design**: Style inheritance architecture (enemies → materials → items)

### Service Dependencies
- **StyleService** (needs creation) - Business logic for style operations
- **Alternative**: Extend MaterialService with style-related methods

---

## API Endpoints

### GET /styles
**Purpose**: Retrieve all available style definitions with their visual properties and spawn rates

#### Route Configuration
- **Path**: `/api/v1/styles`
- **Method**: `GET`
- **Handler**: `StyleController.getStyles`
- **Authentication**: None required (public reference data)
- **Middleware Chain**: None (no auth, validation, or special middleware needed)

#### Input Schema
```typescript
// No parameters required
// Headers: None
// Query: None
// Body: None
```

#### Response Schema
```typescript
interface StyleResponse {
  styles: Array<{
    id: string;           // UUID - Primary key
    style_name: string;   // Unique identifier: 'normal', 'pixel_art', 'watercolor', 'neon', 'sketch'
    display_name: string; // User-friendly name: 'Normal', 'Pixel Art', 'Watercolor', 'Neon', 'Sketch'
    spawn_rate: number;   // Decimal 0-1: spawn probability (1.0 for normal, 0.01 for rare styles)
    description: string;  // Art style description for UI tooltips
    visual_modifier: string; // Rendering hints: 'pixelated', 'soft_edges', 'glowing', etc.
    created_at: string;   // ISO timestamp
  }>;
  total_count: number;    // Total number of available styles
}
```

#### Success Response (200)
```json
{
  "styles": [
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "style_name": "normal",
      "display_name": "Normal",
      "spawn_rate": 1.0,
      "description": "Standard appearance with no special visual effects",
      "visual_modifier": "none",
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "style_name": "pixel_art",
      "display_name": "Pixel Art",
      "spawn_rate": 0.01,
      "description": "Retro pixelated appearance with blocky edges",
      "visual_modifier": "pixelated",
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "style_name": "watercolor",
      "display_name": "Watercolor",
      "spawn_rate": 0.05,
      "description": "Soft watercolor painting style with flowing edges",
      "visual_modifier": "soft_edges",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total_count": 3
}
```

#### Error Responses

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to retrieve style definitions"
  }
}
```

#### Service Method Calls
```typescript
const styles = await styleService.getAllStyles();
// OR if extending MaterialService:
const styles = await materialService.getAllStyles();
```

#### Business Logic Flow
1. Controller receives GET request to `/styles`
2. Call StyleService.getAllStyles() to fetch from StyleDefinitions table
3. Return formatted response with all style definitions
4. No authentication, validation, or complex business logic required
5. Cache response for 24 hours (styles are seed data, rarely change)

#### Related Documentation
- **Data Plan**: StyleDefinitions schema (lines 418-427)
- **System Design**: Style inheritance architecture
- **F-04 Materials System**: Style integration with materials
- **API Contracts**: style_id references throughout material endpoints

---

## Implementation Requirements

### Controller Structure
```typescript
export class StyleController {
  /**
   * GET /styles
   * Get all available style definitions (no auth required)
   */
  getStyles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const styles = await styleService.getAllStyles();

      res.json({
        styles,
        total_count: styles.length
      });
    } catch (error) {
      next(error);
    }
  };
}
```

### Route Registration
```typescript
// src/routes/styles.ts
import { Router } from 'express';
import { StyleController } from '../controllers/StyleController';

const router = Router();
const controller = new StyleController();

/**
 * Style Routes
 *
 * GET  /styles  - Get all style definitions (no auth)
 */

// Get all style definitions (no authentication required)
router.get('/', controller.getStyles);

export default router;
```

### Service Interface
```typescript
// StyleService methods needed:
interface StyleService {
  getAllStyles(): Promise<StyleDefinition[]>;
}

// Or if extending MaterialService:
interface MaterialService {
  // ... existing methods
  getAllStyles(): Promise<StyleDefinition[]>;
}
```

### Type Definitions
```typescript
// src/types/api.types.ts (add to existing types)
export interface StyleDefinition {
  id: string;
  style_name: string;
  display_name: string;
  spawn_rate: number;
  description: string;
  visual_modifier: string;
  created_at: string;
}

export interface StyleResponse {
  styles: StyleDefinition[];
  total_count: number;
}
```

### Database Query
```sql
-- StyleService.getAllStyles() implementation
SELECT
  id,
  style_name,
  display_name,
  spawn_rate,
  description,
  visual_modifier,
  created_at
FROM StyleDefinitions
ORDER BY spawn_rate DESC, style_name ASC;
```

---

## Integration Points

### Frontend Usage
- **Material Application UI**: Display available styles when applying materials
- **Inventory Display**: Show style variants in material stacks
- **Item Gallery**: Display style information for crafted items

### Backend Dependencies
- **MaterialController**: Uses style_id in apply/replace operations
- **DropSystem**: References StyleDefinitions for enemy style inheritance
- **ImageGeneration**: Uses style information for combo hash calculation

### Validation References
- **ApplyMaterialSchema**: Validates style_id exists in StyleDefinitions
- **ReplaceMaterialSchema**: Validates new_style_id exists in StyleDefinitions

---

## Testing Requirements

### Unit Tests
```typescript
describe('StyleController', () => {
  describe('GET /styles', () => {
    it('should return all style definitions with correct structure');
    it('should include total_count in response');
    it('should handle service errors gracefully');
    it('should not require authentication');
    it('should return styles ordered by spawn_rate DESC');
  });
});
```

### Integration Tests
```typescript
describe('GET /api/v1/styles', () => {
  it('should return 200 with valid style data');
  it('should include default normal style');
  it('should include rare styles with low spawn_rates');
  it('should match StyleDefinitions table structure');
});
```


---

## Future Enhancements

### Potential Extensions
- **POST /styles/preview**: Generate style preview images
- **GET /styles/:style_id**: Get individual style details
- **GET /styles/popular**: Get styles by usage statistics

### Style System Evolution
- **Dynamic Styles**: User-created custom styles (post-MVP)
- **Seasonal Styles**: Time-limited special styles
- **Style Combinations**: Mixing multiple style effects

---

## Status

- **Controller**: Not yet created
- **Service**: Needs creation (StyleService) or extension (MaterialService)
- ✅ **Routes**: Implemented (`src/routes/styles.ts`) and registered in main routing
- **Tests**: Not yet written
- **Integration**: Pending controller creation

**Next Steps**:
1. Create StyleService or extend MaterialService with style methods
2. Implement StyleController following existing controller patterns
3. ~~Add routes to main app routing~~ ✅ **COMPLETED**
4. Write unit and integration tests
5. Update API documentation

## Cross-References

### Dependencies
**Controllers this controller depends on:**
- None (public endpoint - no authentication required)

**Services used:**
- StyleService (needs creation for style definition data retrieval) OR
- MaterialService extension (may handle style queries)

### Dependents
**Controllers that use this controller:**
- **MaterialController** (uses style_id in apply/replace operations)
- **ItemController** (indirectly - style information affects image generation and combo hash)

### Related Features
- **F-04 Materials System** - Style variants for materials and items
- **F-05 Material Drop System** - Enemy style inheritance affects drop styles

### Data Models
- StyleDefinitions table (style variants with spawn rates and visual modifiers)
- MaterialStacks table (style_id column for material style variants)

### Integration Notes
- **Public Endpoint**: No authentication required - provides static style configuration
- **Material Integration**: Style definitions used for material application and replacement validation
- **Image Generation**: Style information contributes to combo hash calculation for caching
- **Drop System**: StyleDefinitions referenced for enemy style inheritance in material drops