# Inventory Service Method Specification

**Document**: Service Method Specification for InventoryController and InventoryService
**Feature**: F-09 Inventory Management System
**Status**: Implementation Ready
**Last Updated**: 2025-01-27

## Overview

This document specifies the service methods for inventory management, covering both stacked items (base items without materials) and unique items (with materials applied). The inventory system supports a 100-item capacity by default, expandable to 1000 via $0.99 IAP.

## Database Schema Reference

### Core Tables
- **Items**: Player-owned item instances with level, materials, styling
- **ItemTypes**: Base item templates with categories and base stats
- **UserEquipment**: Current equipment state (single source of truth)
- **ItemMaterials**: Junction table for materials applied to items
- **MaterialInstances**: Individual material instances
- **Materials**: Material definitions with stat modifiers

### Key Relationships
```
Users → Items → ItemTypes (base item data)
Items → ItemMaterials → MaterialInstances → Materials (applied materials)
Users → UserEquipment → Items (equipped items)
```

## Service Architecture

### InventoryService
**Location**: `mystica-express/src/services/InventoryService.ts`
**Dependencies**:
- `ItemRepository` - Item data access with nested material queries
- `MaterialRepository` - Material stack data (already injected in constructor)
- `StatsService` - Imported as singleton `statsService` for calculations

### InventoryController
**Location**: `mystica-express/src/controllers/InventoryController.ts`
**Endpoint**: `GET /api/v1/inventory`

## Core Method Specifications

### 1. getPlayerInventory(userId: string)

**Purpose**: Retrieve complete player inventory with stacking logic

**Return Type**:
```typescript
{
  items: PlayerItem[],  // Unique items with materials applied
  stacks: ItemStack[]   // Stackable base items grouped by type+level
}
```

**Implementation Logic**:

1. **Query All User Items**
   ```sql
   SELECT items.*, itemtypes.*,
          itemmaterials.slot_index,
          materialinstances.style_id,
          materials.name as material_name
   FROM items
   JOIN itemtypes ON items.item_type_id = itemtypes.id
   LEFT JOIN itemmaterials ON items.id = itemmaterials.item_id
   LEFT JOIN materialinstances ON itemmaterials.material_instance_id = materialinstances.id
   LEFT JOIN materials ON materialinstances.material_id = materials.id
   WHERE items.user_id = $1
   ORDER BY items.created_at DESC
   ```

2. **Classify Items by Material State**
   - **Unique Items**: Items with ANY materials applied (`itemmaterials` rows exist)
   - **Stackable Items**: Items with NO materials applied (`itemmaterials` rows = empty)

3. **Process Unique Items**
   ```typescript
   // For each item with materials (transform via InventoryService private method)
   const uniqueItems = itemsWithMaterials.map(item => {
     try {
       return {
         id: item.id,
         name: item.itemtypes.name,
         item_type_id: item.item_type_id,
         category: item.itemtypes.category,
         level: item.level,
         rarity: item.itemtypes.rarity,
         applied_materials: item.materials || [],
         is_styled: item.is_styled,
         current_stats: calculateItemStatsWithMaterials(item), // Via StatsService
         is_equipped: item.equipped_slot !== null,
         equipped_slot: item.equipped_slot,
         generated_image_url: item.generated_image_url || getDefaultImage(item)
       };
     } catch (error) {
       throw new DatabaseError(`Failed to process unique item ${item.id}`, error);
     }
   });
   ```

4. **Process Stackable Items**
   ```typescript
   // Group by item_type_id + level (handled in InventoryService)
   const stacksMap = new Map<string, ItemStack>();

   baseItems.forEach(item => {
     try {
       const stackKey = `${item.item_type_id}_${item.level}`;

       if (!stacksMap.has(stackKey)) {
         stacksMap.set(stackKey, {
           item_type_id: item.item_type_id,
           level: item.level,
           quantity: 0,
           base_stats: calculateBaseStatsForLevel(item.itemtypes, item.level), // Via StatsService
           icon_url: item.itemtypes.appearance_data?.icon_url || getDefaultIcon(item.itemtypes.category)
         });
       }

       stacksMap.get(stackKey)!.quantity++;
     } catch (error) {
       throw new DatabaseError(`Failed to process stackable item ${item.id}`, error);
     }
   });

   const stacks = Array.from(stacksMap.values());
   ```

5. **Calculate Current Stats** (via StatsService)

   **Service Location**: `src/services/StatsService.ts`
   **Method**: `computeItemStats(baseStats: Stats, level: number, materials: AppliedMaterial[])`

   ```typescript
   import { statsService } from '../services/StatsService.js';

   // For unique items with materials applied
   function calculateItemStatsWithMaterials(item: ItemWithMaterials): Stats {
     try {
       const baseStats = item.item_type.base_stats_normalized;
       const appliedMaterials = item.materials?.map(m => ({
         material_id: m.material.id,
         is_shiny: m.material.style_id !== 'normal',
         stat_modifiers: m.material.stat_modifiers
       })) || [];

       return statsService.computeItemStats(baseStats, item.level, appliedMaterials);
     } catch (error) {
       throw new DatabaseError(`Failed to calculate stats for item ${item.id}`, error);
     }
   }

   // For stackable items (no materials)
   function calculateBaseStatsForLevel(itemType: ItemType, level: number): Stats {
     try {
       const mockItem = {
         base_stats: itemType.base_stats_normalized,
         item_type: { base_stats_normalized: itemType.base_stats_normalized }
       };
       return statsService.computeItemStatsForLevel(mockItem, level);
     } catch (error) {
       throw new DatabaseError(`Failed to calculate base stats for item type ${itemType.id}`, error);
     }
   }
   ```

**Error Handling**:
- Throws `DatabaseError` on query failure or stat calculation failure
- Throws `ValidationError` if userId is invalid format
- Returns empty arrays if user has no items (not an error)
- Handles missing base stats gracefully with fallback to zero values
- Logs stat calculation failures for debugging

**Performance**:
- Single query with JOINs to prevent N+1
- Uses existing indexes: `(user_id, item_type_id)`, `(user_id, level DESC)`
- Expected response time: 50-200ms for 100 items

### 2. Repository Methods (ItemRepository)

The InventoryService leverages existing ItemRepository methods:

#### findByUser(userId: string): Promise<ItemRow[]>
- Fetches all items owned by user
- Used as foundation for inventory queries

#### findEquippedByUser(userId: string): Promise<ItemWithDetails[]>
- Fetches currently equipped items via UserEquipment JOIN
- Used to mark equipped status in inventory

#### findManyWithDetails(itemIds: string[], userId?: string): Promise<ItemWithDetails[]>
- Batch fetch items with complete material data
- Prevents N+1 queries for complex inventory operations

## API Endpoint Specification

### GET /api/v1/inventory

**Controller Method**: InventoryController.getInventory()

**Request**:
```typescript
Headers: {
  Authorization: "Bearer <jwt_token>"
}
```

**Response**:
```typescript
{
  items: PlayerItem[],  // Array of unique items with materials
  stacks: ItemStack[]   // Array of stackable base items
}
```

**PlayerItem Interface**:
```typescript
interface PlayerItem {
  id: string;
  name: string;
  item_type_id: string;
  category: 'weapon' | 'offhand' | 'head' | 'armor' | 'feet' | 'accessory' | 'pet';
  level: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  applied_materials: AppliedMaterial[];
  is_styled: boolean;
  current_stats: Stats;
  is_equipped: boolean;
  equipped_slot: string | null;
  generated_image_url: string;
}
```

**ItemStack Interface**:
```typescript
interface ItemStack {
  item_type_id: string;
  level: number;
  quantity: number;
  base_stats: Stats;
  icon_url: string;
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid/missing JWT token
- `500 Internal Server Error`: Database query failure

## Implementation Guidelines

### 1. Data Processing Flow
```
Raw Database Query
  → Separate Unique vs Stackable Items
  → Calculate Stats for Unique Items
  → Group Stackable Items by Type+Level
  → Add Equipment Status from UserEquipment
  → Return Structured Response
```

### 2. Caching Strategy
- **Client-side**: Cache inventory response for 30 seconds
- **Invalidation**: Clear cache on item changes (equip/upgrade/craft)
- **Server-side**: No caching due to real-time equipment changes

### 3. Performance Optimizations
- Use single query with JOINs instead of N+1 pattern
- Leverage existing repository methods
- Pre-calculate base stats in application layer
- Use database indexes for user queries

### 4. Error Handling Patterns
```typescript
// In InventoryController.getInventory()
try {
  const inventory = await inventoryService.getPlayerInventory(userId);
  return res.json({ data: inventory });
} catch (error) {
  if (error instanceof DatabaseError) {
    return res.status(500).json({
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch inventory',
        timestamp: new Date().toISOString()
      }
    });
  }
  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
  throw error; // Re-throw unexpected errors for global handler
}
```

## Business Rules

### Inventory Capacity
- **Default**: 100 items maximum per user
- **Expansion**: $0.99 IAP increases to 1000 items
- **Enforcement**: Block new item acquisition when at capacity
- **UI**: Show "Expand Storage" prompt when full

### Stacking Rules
- **Stackable**: Items with same `item_type_id` + `level` + NO materials
- **Non-Stackable**: Items with ANY materials applied
- **Visual**: Stacked items show quantity badge in UI
- **Splitting**: When materials applied to stacked item, one item becomes unique

### Equipment Integration
- **Equipped Items**: Marked with `is_equipped: true` and `equipped_slot`
- **Source of Truth**: UserEquipment table determines equipped status
- **Multiple Views**: Same item appears in both inventory and equipment screens

## Testing Considerations

### Unit Tests
- Mock ItemRepository methods
- Test stacking logic with identical items
- Test stat calculation with various material combinations
- Test empty inventory scenarios

### Integration Tests
- Test with real database connections
- Verify JOIN query performance
- Test equipment status integration
- Test capacity limits

### Performance Tests
- Test with 100+ items per user
- Measure query execution time
- Test concurrent user requests

## Migration Notes

### Database Schema Dependencies
- Requires existing tables: Items, ItemTypes, ItemMaterials, MaterialInstances, Materials
- Leverages UserEquipment for equipped status
- Uses existing indexes for performance

### Backward Compatibility
- New endpoint, no breaking changes
- Existing item management APIs remain unchanged
- Can be deployed independently

## Future Enhancements

### Post-MVP Features
- **Filtering**: Filter by equipment slot, rarity, level range
- **Sorting**: Sort by level, rarity, acquisition date, name
- **Search**: Text search by item name
- **Pagination**: Support for large inventories (50+ items per page)

### Advanced Features
- **Inventory Sets**: Save/load equipment configurations
- **Auto-Organize**: Automatic sorting and organization
- **Item Comparison**: Side-by-side stat comparison
- **Bulk Operations**: Multi-select and batch actions

## Dependencies

### Required Services
- `ItemRepository` - Item data access and ownership validation
- `MaterialRepository` - Material stack data access
- `StatsService` - Item stat calculations with material modifiers
- `EquipmentService` - Equipment status queries (if separate from UserEquipment)

### External Dependencies
- Supabase client for database access
- Authentication middleware for user validation
- Error handling utilities

### Database Requirements
- PostgreSQL with existing game schema
- Proper indexes on Items table
- Foreign key relationships established

---

This specification provides the foundation for implementing a robust inventory management system that handles both unique and stackable items while maintaining performance and adhering to established architectural patterns.

## See Also

### Related Service Specifications
- **[StatsService](./stats-service-spec.md)** - Required for item stat calculations with material modifiers
- **[EquipmentService](./equipment-service-spec.md)** - Equipment status integration for inventory display
- **[MaterialService](./material-service-spec.md)** - Material stack display and inventory management

### Cross-Referenced Features
- **F-09**: Inventory Management System (primary feature)
- **F-03**: Base Items & Equipment (equipment status display)
- **F-04**: Materials System (unique vs stackable item logic)
- **F-06**: Item Upgrade System (level-based stacking)