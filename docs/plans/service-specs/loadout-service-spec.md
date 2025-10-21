# Loadout Service Specification (F-09)

## Overview

The Loadout service manages saved equipment configurations, allowing players to save, load, and switch between different equipment setups. This service implements the backend functionality for the F-09 Inventory Management System's loadout feature.

## Architecture

### Service Layer
- **LoadoutService**: Business logic and validation
- **LoadoutController**: HTTP request handling and response formatting
- **LoadoutRepository**: Database operations and queries

### Database Schema
- **loadouts**: Saved equipment configurations
- **loadoutslots**: Item assignments per loadout slot
- **userequipment**: Current equipment state (updated on activation)

## Core Functionality

### 1. Loadout CRUD Operations

#### Create Loadout
```typescript
createLoadout(userId: string, name: string): Promise<LoadoutWithSlots>
```
- Creates new loadout with unique name per user
- Initially has empty slots (8 slots: weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet)
- Sets `is_active = false` by default
- Validates name uniqueness and length (max 50 chars)

#### Get All Loadouts
```typescript
getLoadoutsByUser(userId: string): Promise<LoadoutWithSlots[]>
```
- Returns all loadouts for user with slot assignments
- Ordered by creation date (newest first)
- Includes slot assignments for all 8 equipment slots

#### Get Single Loadout
```typescript
getLoadoutById(loadoutId: string, userId: string): Promise<LoadoutWithSlots>
```
- Returns specific loadout with validation
- Validates user ownership
- Includes complete slot assignments

#### Update Loadout Name
```typescript
updateLoadoutName(loadoutId: string, userId: string, name: string): Promise<LoadoutWithSlots>
```
- Updates loadout name with uniqueness validation
- Validates user ownership
- Updates `updated_at` timestamp

#### Delete Loadout
```typescript
deleteLoadout(loadoutId: string, userId: string): Promise<void>
```
- Deletes loadout and cascades to LoadoutSlots
- Validates user ownership
- **Cannot delete active loadout** - throws ValidationError
- Must switch to different loadout first

### 2. Slot Management

#### Update All Slots
```typescript
updateLoadoutSlots(loadoutId: string, userId: string, slots: LoadoutSlotAssignments): Promise<LoadoutWithSlots>
```
- Atomically replaces all 8 slot assignments
- Validates item ownership for all assigned items
- Null values clear slots
- Updates `updated_at` timestamp

#### Update Single Slot
```typescript
updateSingleSlot(loadoutId: string, userId: string, slotName: string, itemId: string | null): Promise<LoadoutWithSlots>
```
- Updates individual slot assignment
- Validates item ownership if itemId provided
- Null itemId clears the slot
- Updates `updated_at` timestamp

### 3. Loadout Activation

#### Activate Loadout
```typescript
activateLoadout(loadoutId: string, userId: string): Promise<BulkEquipmentUpdate>
```
- Deactivates all user's loadouts (`is_active = false`)
- Sets target loadout as active (`is_active = true`)
- Copies LoadoutSlots → UserEquipment for all 8 slots
- Returns equipment state after activation
- Triggers stat recalculation (vanity_level, avg_item_level)

#### Get Active Loadout
```typescript
getActiveLoadout(userId: string): Promise<LoadoutWithSlots | null>
```
- Returns currently active loadout with slots
- Only one loadout can be active per user
- Returns null if no active loadout

## API Endpoints

### GET /loadouts
**Summary**: Get all loadouts for authenticated user
**Security**: Bearer token required
**Response**: `{loadouts: LoadoutWithSlots[]}`
**Errors**: 401 Unauthorized

### POST /loadouts
**Summary**: Create new loadout
**Request**: `{name: string}` (max 50 chars)
**Response**: `LoadoutWithSlots`
**Validation**:
- Name uniqueness per user
- Name length ≤ 50 characters
**Errors**: 400 (duplicate name, invalid input), 401 Unauthorized

### GET /loadouts/{loadout_id}
**Summary**: Get specific loadout with slot assignments
**Response**: `LoadoutWithSlots`
**Errors**: 404 (not found/not owned), 401 Unauthorized

### PUT /loadouts/{loadout_id}
**Summary**: Update loadout name
**Request**: `{name: string}` (max 50 chars)
**Response**: `LoadoutWithSlots`
**Validation**: Same as create
**Errors**: 400 (duplicate name, invalid), 404 (not found), 401 Unauthorized

### DELETE /loadouts/{loadout_id}
**Summary**: Delete loadout
**Response**: `{success: true}`
**Validation**: Cannot delete active loadout
**Errors**: 400 (active loadout), 404 (not found), 401 Unauthorized

### PUT /loadouts/{loadout_id}/activate
**Summary**: Activate loadout (copy LoadoutSlots → UserEquipment)
**Response**:
```json
{
  "success": true,
  "active_loadout_id": "uuid",
  "updated_equipment": {
    "weapon": "item_id | null",
    "offhand": "item_id | null",
    // ... all 8 slots
  }
}
```
**Side Effects**:
- Deactivates other loadouts
- Sets target as active
- Updates UserEquipment table
- Triggers stat recalculation
**Errors**: 404 (not found), 401 Unauthorized

### PUT /loadouts/{loadout_id}/slots
**Summary**: Update all slot assignments
**Request**:
```json
{
  "slots": {
    "weapon": "uuid | null",
    "offhand": "uuid | null",
    "head": "uuid | null",
    "armor": "uuid | null",
    "feet": "uuid | null",
    "accessory_1": "uuid | null",
    "accessory_2": "uuid | null",
    "pet": "uuid | null"
  }
}
```
**Response**: `LoadoutWithSlots`
**Validation**: All item IDs must be owned by user
**Errors**: 400 (invalid items/not owned), 404 (not found), 401 Unauthorized

## Data Types

### LoadoutWithSlots
```typescript
interface LoadoutWithSlots {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  slots: {
    weapon: string | null;
    offhand: string | null;
    head: string | null;
    armor: string | null;
    feet: string | null;
    accessory_1: string | null;
    accessory_2: string | null;
    pet: string | null;
  };
}
```

### LoadoutSlotAssignments
```typescript
type LoadoutSlotAssignments = {
  weapon: string | null;
  offhand: string | null;
  head: string | null;
  armor: string | null;
  feet: string | null;
  accessory_1: string | null;
  accessory_2: string | null;
  pet: string | null;
};
```

### BulkEquipmentUpdate
```typescript
type BulkEquipmentUpdate = LoadoutSlotAssignments;
```

## Business Rules

### Loadout Constraints
1. **Name Uniqueness**: Each user can only have one loadout with a given name
2. **Name Length**: Maximum 50 characters
3. **Active Loadout**: Only one loadout can be active per user at a time
4. **Active Deletion**: Cannot delete currently active loadout
5. **Loadout Limit**: No hard limit on number of loadouts (UI may impose practical limits)

### Slot Management
1. **8 Equipment Slots**: weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet
2. **Item Ownership**: All assigned items must be owned by the user
3. **Null Slots**: Null values represent empty/unequipped slots
4. **Atomic Updates**: Slot updates are atomic (all succeed or all fail)

### Activation Rules
1. **Exclusive Active**: Setting loadout active deactivates all others
2. **Equipment Copy**: Activation copies LoadoutSlots → UserEquipment
3. **Missing Items**: Skip slots with items that no longer exist (graceful degradation)
4. **Stat Recalculation**: Triggers update of vanity_level and avg_item_level

## Database Integration

### Tables Used
- **loadouts**: Primary loadout data
- **loadoutslots**: Slot assignments (FK to loadouts)
- **userequipment**: Target for activation (updated by activate_loadout)
- **items**: Validation of item ownership

### Key Constraints
- **Unique Name**: `UNIQUE (user_id, name)` on loadouts
- **Single Active**: `UNIQUE (user_id, is_active) WHERE is_active = true` (partial index)
- **Cascade Delete**: LoadoutSlots deleted when loadout deleted
- **FK Constraints**: All item_id references validated

### RPC Functions
- **activate_loadout(loadout_id UUID)**: Database function for atomic activation
  - Deactivates other loadouts
  - Sets target active
  - Copies slots to UserEquipment
  - Recalculates user stats

## Error Handling

### Validation Errors (400)
- Duplicate loadout name for user
- Invalid loadout name (empty, too long)
- Items not owned by user
- Cannot delete active loadout
- Invalid slot names

### Not Found Errors (404)
- Loadout doesn't exist
- Loadout not owned by user
- Referenced items don't exist

### Database Errors (500)
- Connection failures
- Constraint violations
- Transaction failures

## Performance Considerations

### Query Optimization
- **Index Usage**: (user_id, is_active) for active loadout queries
- **Batch Operations**: Bulk slot updates use single transaction
- **Join Optimization**: LoadoutSlots joined efficiently in loadout queries

### Caching Strategy
- **Client-Side**: Cache user's loadouts for offline browsing
- **Invalidation**: Clear cache on loadout modifications
- **Active Loadout**: Cache active loadout separately for quick access

### Database Load
- **Read-Heavy**: Loadout viewing more common than modification
- **Small Data**: Loadouts are small objects (minimal storage impact)
- **Infrequent Writes**: Activation and updates are user-initiated

## Testing Strategy

### Unit Tests
- Loadout CRUD operations
- Slot assignment validation
- Active loadout management
- Item ownership validation
- Error condition handling

### Integration Tests
- Database constraint enforcement
- RPC function execution
- UserEquipment synchronization
- Stat recalculation triggers

### Edge Cases
- Deleting items referenced in loadouts
- Concurrent loadout activation
- Missing item handling during activation
- Database connection failures during activation

## Implementation Status

### ⏳ Not Yet Implemented
**Status**: Specification complete, implementation not started

**Required Components**:
- LoadoutRepository with all core operations
- LoadoutService business logic layer
- LoadoutController HTTP handlers
- Database RPC functions (`activate_loadout`)
- Input validation schemas (Zod)
- Route registration in app.ts

**Database Schema**: Already exists in migrations (Loadouts, LoadoutSlots tables)

**Next Steps**:
1. Implement LoadoutRepository (CRUD operations, slot management)
2. Implement RPC function: `activate_loadout(loadout_id)`
3. Implement LoadoutService (business logic, validation)
4. Implement LoadoutController (HTTP endpoints)
5. Add route registration and Zod schemas

**Planned Enhancements**:
- Frontend UI integration
- Loadout preview functionality
- Stat comparison features
- Performance optimizations

## Related Features
- **F-03**: Base Items & Equipment (8-slot system)
- **F-04**: Materials System (loadouts preserve material assignments)
- **F-06**: Item Upgrade System (loadouts reference upgraded items)
- **F-02**: Combat System (active loadout determines combat stats)

## See Also

### Related Service Specifications
- **[EquipmentService](./equipment-service-spec.md)** - Loadout activation updates UserEquipment table
- **[ItemService](./item-service-spec.md)** - Item validation for loadout slot assignments

### Missing Repository Implementation
- **LoadoutRepository** ⚠️ NOT IMPLEMENTED - Complete repository layer needed for LoadoutService

### Cross-Referenced Features
- **F-09**: Inventory Management System (primary feature)
- **F-03**: Base Items & Equipment (8-slot equipment system)
- **F-04**: Materials System (loadout preserves material assignments)
- **F-02**: Combat System (active loadout determines combat stats)