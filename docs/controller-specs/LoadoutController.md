# LoadoutController Technical Specification

## Controller Overview

**Purpose:** HTTP handlers for saved equipment configurations in the Mystica RPG game.

**Responsibility:** Implements loadout CRUD operations, slot management, and activation functionality as part of the F-09 Inventory Management System.

**Feature Reference:** [F-09 Inventory Management - Loadouts](../feature-specs/F-09-inventory-management.yaml)

**Service Dependencies:**
- **LoadoutService** - Core business logic for loadout operations and validation
- **EquipmentService** - Equipment state management (via LoadoutService activation)

**Location:** `mystica-express/src/controllers/LoadoutController.ts`

---

## Middleware Chain

All endpoints use the following middleware stack (applied in `src/app.ts`):

1. **CORS** - Cross-origin request handling
2. **Body Parser** - JSON request body parsing
3. **JWT Auth** - Bearer token authentication (adds `req.user`)
4. **Zod Validation** - Request schema validation (adds `req.validated`)
5. **Error Handler** - Centralized error response formatting

---

## API Endpoints

### 1. GET /api/v1/loadouts

**Handler:** `getLoadouts`
**Purpose:** Get all loadouts for authenticated user

#### Request
```typescript
// Headers
Authorization: Bearer <jwt_token>

// No body or query parameters
```

#### Response - Success (200)
```typescript
{
  loadouts: LoadoutWithSlots[]
}

interface LoadoutWithSlots {
  id: string;           // UUID
  user_id: string;      // UUID
  name: string;         // max 50 chars
  is_active: boolean;
  created_at: string;   // ISO datetime
  updated_at: string;   // ISO datetime
  slots: {
    weapon: string | null;      // Item UUID
    offhand: string | null;     // Item UUID
    head: string | null;        // Item UUID
    armor: string | null;       // Item UUID
    feet: string | null;        // Item UUID
    accessory_1: string | null; // Item UUID
    accessory_2: string | null; // Item UUID
    pet: string | null;         // Item UUID
  }
}
```

#### Error Responses

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Invalid or missing JWT token"
  }
}
```

#### Service Calls
- `loadoutService.getLoadoutsByUser(userId)` - Fetches user's loadouts ordered by creation date

#### Business Logic
- Returns all saved loadouts for authenticated user
- Loadouts ordered by creation date (newest first)
- Includes complete slot assignments for each loadout

---

### 2. POST /api/v1/loadouts

**Handler:** `createLoadout`
**Purpose:** Create new loadout with specified name

#### Request
```typescript
// Headers
Authorization: Bearer <jwt_token>
Content-Type: application/json

// Body - Validated by CreateLoadoutSchema
{
  name: string  // Required, 1-50 characters
}
```

**Zod Schema Reference:** `CreateLoadoutSchema` (schemas.ts:122-124)

#### Response - Success (201)
```typescript
LoadoutWithSlots  // New loadout with empty slots
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Name already exists for user"
  }
}
```

**400 Bad Request:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Name too long (>50 chars)"
  }
}
```

**400 Bad Request:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Name empty or whitespace only"
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Invalid JWT token"
  }
}
```

#### Service Calls
- `loadoutService.createLoadout(userId, name)` - Creates loadout with validation

#### Business Logic
- Validates name uniqueness per user
- Creates loadout with `is_active: false`
- Returns loadout with empty slot assignments
- Trims whitespace from name input

---

### 3. GET /api/v1/loadouts/:loadout_id

**Handler:** `getLoadoutById`
**Purpose:** Get specific loadout with slot assignments

#### Request
```typescript
// Headers
Authorization: Bearer <jwt_token>

// URL Parameters - Validated by LoadoutIdParamsSchema
{
  loadout_id: string  // UUID format required
}
```

**Zod Schema Reference:** `LoadoutIdParamsSchema` (schemas.ts:52-54)

#### Response - Success (200)
```typescript
LoadoutWithSlots  // Complete loadout with slots
```

#### Error Responses
- **400 Bad Request** - Invalid UUID format for loadout_id
- **401 Unauthorized** - Invalid JWT token
- **404 Not Found** - Loadout doesn't exist or not owned by user

#### Service Calls
- `loadoutService.getLoadoutById(loadout_id, userId)` - Validates ownership and fetches loadout

#### Business Logic
- Validates loadout_id UUID format before service call
- Enforces loadout ownership (users can only access their own loadouts)
- Returns complete loadout with all slot assignments

---

### 4. PUT /api/v1/loadouts/:loadout_id

**Handler:** `updateLoadoutName`
**Purpose:** Update loadout name with uniqueness validation

#### Request
```typescript
// Headers
Authorization: Bearer <jwt_token>
Content-Type: application/json

// URL Parameters - Validated by LoadoutIdParamsSchema
{
  loadout_id: string  // UUID format required
}

// Body - Validated by UpdateLoadoutSchema
{
  name: string  // Required, 1-50 characters
}
```

**Zod Schema References:**
- `LoadoutIdParamsSchema` (schemas.ts:52-54)
- `UpdateLoadoutSchema` (schemas.ts:126-128)

#### Response - Success (200)
```typescript
LoadoutWithSlots  // Updated loadout with new name
```

#### Error Responses
- **400 Bad Request** - Validation errors:
  - Invalid UUID format for loadout_id
  - Name already exists for user (excluding current loadout)
  - Name too long or empty
- **401 Unauthorized** - Invalid JWT token
- **404 Not Found** - Loadout doesn't exist or not owned by user

#### Service Calls
- `loadoutService.updateLoadoutName(loadout_id, userId, name)` - Updates with validation

#### Business Logic
- Validates ownership first via `getLoadoutById`
- Checks name uniqueness (excluding current loadout from check)
- Updates name and returns refreshed loadout data
- Trims whitespace from name input

---

### 5. DELETE /api/v1/loadouts/:loadout_id

**Handler:** `deleteLoadout`
**Purpose:** Delete loadout (cannot delete active loadout)

#### Request
```typescript
// Headers
Authorization: Bearer <jwt_token>

// URL Parameters - Validated by LoadoutIdParamsSchema
{
  loadout_id: string  // UUID format required
}
```

**Zod Schema Reference:** `LoadoutIdParamsSchema` (schemas.ts:52-54)

#### Response - Success (200)
```typescript
{
  success: true
}
```

#### Error Responses
- **400 Bad Request** - Validation errors:
  - Invalid UUID format for loadout_id
  - Cannot delete active loadout
- **401 Unauthorized** - Invalid JWT token
- **404 Not Found** - Loadout doesn't exist or not owned by user

#### Service Calls
- `loadoutService.deleteLoadout(loadout_id, userId)` - Validates and deletes

#### Business Logic
- Validates ownership via `getLoadoutById`
- Prevents deletion of active loadouts (business rule enforcement)
- Cascades deletion to LoadoutSlots table
- Requires user to activate different loadout before deleting current active one

---

### 6. PUT /api/v1/loadouts/:loadout_id/activate

**Handler:** `activateLoadout`
**Purpose:** Activate loadout (copies LoadoutSlots to UserEquipment)

#### Request
```typescript
// Headers
Authorization: Bearer <jwt_token>

// URL Parameters - Validated by LoadoutIdParamsSchema
{
  loadout_id: string  // UUID format required
}

// No request body
```

**Zod Schema Reference:** `LoadoutIdParamsSchema` (schemas.ts:52-54)

#### Response - Success (200)
```typescript
{
  success: true,
  active_loadout_id: string,        // UUID of activated loadout
  updated_equipment: {              // New equipment state
    weapon: string | null,
    offhand: string | null,
    head: string | null,
    armor: string | null,
    feet: string | null,
    accessory_1: string | null,
    accessory_2: string | null,
    pet: string | null
  }
}
```

#### Error Responses
- **400 Bad Request** - Invalid UUID format for loadout_id
- **401 Unauthorized** - Invalid JWT token
- **404 Not Found** - Loadout doesn't exist or not owned by user

#### Service Calls
- `loadoutService.activateLoadout(loadout_id, userId)` - Handles complex activation logic

#### Business Logic
- Validates ownership via `getLoadoutById` in service
- Sets target loadout `is_active = true`
- Deactivates all other user loadouts (`is_active = false`)
- Copies all LoadoutSlots to UserEquipment table
- Triggers database recalculation of user stats (vanity_level, avg_item_level)
- Handles missing items gracefully (skips slots where item no longer exists)

---

### 7. PUT /api/v1/loadouts/:loadout_id/slots

**Handler:** `updateLoadoutSlots`
**Purpose:** Update all slot assignments for loadout

#### Request
```typescript
// Headers
Authorization: Bearer <jwt_token>
Content-Type: application/json

// URL Parameters - Validated by LoadoutIdParamsSchema
{
  loadout_id: string  // UUID format required
}

// Body - Validated by UpdateLoadoutSlotsSchema
{
  slots: {
    weapon?: string | null,      // Optional item UUID
    offhand?: string | null,     // Optional item UUID
    head?: string | null,        // Optional item UUID
    armor?: string | null,       // Optional item UUID
    feet?: string | null,        // Optional item UUID
    accessory_1?: string | null, // Optional item UUID
    accessory_2?: string | null, // Optional item UUID
    pet?: string | null          // Optional item UUID
  }
}
```

**Zod Schema References:**
- `LoadoutIdParamsSchema` (schemas.ts:52-54)
- `UpdateLoadoutSlotsSchema` (schemas.ts:130-139)

#### Response - Success (200)
```typescript
LoadoutWithSlots  // Updated loadout with new slot assignments
```

#### Error Responses
- **400 Bad Request** - Validation errors:
  - Invalid UUID format for loadout_id
  - Invalid item UUIDs
  - Items not owned by user
  - Item category doesn't match slot type (handled in repository)
- **401 Unauthorized** - Invalid JWT token
- **404 Not Found** - Loadout doesn't exist or not owned by user

#### Service Calls
- `loadoutService.updateLoadoutSlots(loadout_id, userId, slots)` - Updates slots with validation

#### Business Logic
- Validates ownership via `getLoadoutById` in service
- Converts partial slot assignments to complete slot structure (null for missing)
- Repository validates item ownership and slot compatibility
- Atomically replaces all LoadoutSlots entries for the loadout
- Returns updated loadout with new slot assignments

---

### 8. GET /api/v1/loadouts/active

**Handler:** `getActiveLoadout`
**Purpose:** Get user's currently active loadout

#### Request
```typescript
// Headers
Authorization: Bearer <jwt_token>

// No parameters or body
```

#### Response - Success (200)
```typescript
{
  active_loadout: LoadoutWithSlots | null
}
```

#### Error Responses
- **401 Unauthorized** - Invalid JWT token

#### Service Calls
- `loadoutService.getActiveLoadout(userId)` - Fetches active loadout

#### Business Logic
- Returns the user's currently active loadout
- Returns `null` if no loadout is currently active
- Only one loadout can be active per user (database constraint)

---

## Error Handling Patterns

### Validation Errors (400)
```typescript
{
  error: string,           // Human-readable message
  details?: ZodIssue[]     // Zod validation details (if applicable)
}
```

### Not Found Errors (404)
```typescript
{
  error: string,           // "Loadout not found" or "Not owned by user"
  resource_type: string,   // "loadouts"
  resource_id: string      // The UUID that wasn't found
}
```

### Server Errors (500)
```typescript
{
  error: string,           // Generic error message
  error_id: string         // UUID for error tracking
}
```

---

## Database Operations

### Tables Involved
- **Loadouts** - Main loadout records with metadata
- **LoadoutSlots** - Item assignments for each loadout slot
- **UserEquipment** - Current player equipment state (updated on activation)
- **Items** - Validates item ownership and existence

### Key Constraints
- **Unique loadout names per user** - Enforced in CreateLoadout/UpdateLoadout
- **Single active loadout per user** - Enforced via database partial unique index
- **Item ownership validation** - All item_ids must belong to the user
- **Slot compatibility** - Item categories must match equipment slot types
- **Cascade deletion** - Deleting loadout removes all associated LoadoutSlots

---

## Related Documentation

- **Feature Specification:** [F-09 Inventory Management](../feature-specs/F-09-inventory-management.yaml)
- **API Contracts:** [Loadout Endpoints](../api-contracts.yaml#L1218-L1435)
- **Data Schema:** [Loadouts Tables](../data-plan.yaml#L504-L524)
- **Service Implementation:** `src/services/LoadoutService.ts`
- **Repository Layer:** `src/repositories/LoadoutRepository.ts`
- **Route Definitions:** `src/routes/loadouts.ts`

---

## Implementation Notes

### Database Architecture
- Loadout queries are limited by user ownership (good natural partitioning)
- LoadoutSlots uses composite primary key for efficient slot lookups
- Active loadout queries use database index on (user_id, is_active)

### Authentication & Authorization
- All endpoints require JWT authentication
- Strict ownership validation prevents users accessing others' loadouts
- Item ownership validation prevents assigning items user doesn't own

### Business Rules Enforced
- Maximum 5 loadouts per user (future enhancement, not yet implemented)
- Cannot delete active loadout (must switch first)
- Loadout names must be unique per user
- Only one active loadout allowed per user

### Future Enhancements
- Loadout import/export functionality
- Loadout sharing between users
- Equipment set bonuses in loadouts
- Loadout templates and recommendations

## Cross-References

### Dependencies
**Controllers this controller depends on:**
- **AuthController** (requires authenticated users via auth middleware)

**Services used:**
- LoadoutService (core business logic for loadout operations and validation)
- EquipmentService (equipment state management via LoadoutService activation)

### Dependents
**Controllers that use this controller:**
- None (leaf controller - manages saved equipment configurations)

### Related Features
- **F-09 Inventory Management - Loadouts** - Primary feature spec
- **F-03 Base Items & Equipment System** - Equipment slot compatibility and item validation

### Data Models
- Loadouts table (docs/data-plan.yaml:504-514) - Main loadout records with metadata
- LoadoutSlots table (docs/data-plan.yaml:516-524) - Item assignments for each loadout slot
- UserEquipment table (docs/data-plan.yaml:452-466) - Current player equipment state (updated on activation)
- PlayerItems table (validates item ownership and existence)

### Integration Notes
- **Equipment Activation**: Loadout activation copies LoadoutSlots to UserEquipment table through EquipmentService
- **Slot Validation**: All 8 equipment slots (weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet) supported
- **Ownership Enforcement**: Strict validation prevents users accessing others' loadouts or assigning unowned items
- **Single Active Constraint**: Database enforces only one active loadout per user