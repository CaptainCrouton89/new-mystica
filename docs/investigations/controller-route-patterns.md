# Controller and Route Implementation Patterns Investigation

## Overview

This investigation examines the existing controller and route implementation patterns in the Express TypeScript backend to understand how to implement new endpoints like `GET /items/:item_id/upgrade-cost` and `POST /items/:item_id/upgrade`.

## Controller Structure Patterns

### Class-Based Controllers
Controllers are implemented as ES6 classes with async arrow function methods:

```typescript
export class ItemController {
  getItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { item_id } = req.params;

      const item = await itemService.getItemDetails(userId, item_id);
      res.json(item);
    } catch (error) {
      next(error);
    }
  };
}
```

**Key Patterns:**
- Arrow functions for method binding
- `async/await` with Promise<void> return type
- User ID extracted from `req.user!.id` (non-null assertion after auth)
- Parameters extracted from `req.params` (validated by middleware)
- Request body accessed via `req.body` (typed and validated)
- Service layer delegation for business logic
- Direct `res.json()` for success responses
- `next(error)` for error propagation

### Service Layer Integration
Controllers act as thin orchestration layers:

```typescript
// ItemController.ts:18
const item = await itemService.getItemDetails(userId, item_id);

// ItemController.ts:35
const costInfo = await itemService.getUpgradeCost(userId, item_id);

// ItemController.ts:52
const result = await itemService.upgradeItem(userId, item_id);
```

All business logic is delegated to service classes.

## Route Definition Patterns

### Router Configuration
Routes are defined using Express Router with middleware stacking:

```typescript
const router = Router();
const controller = new ItemController();

// GET endpoint with parameter validation
router.get('/:item_id',
  authenticate,
  validate({ params: ItemIdParamsSchema }),
  controller.getItem
);

// POST endpoint with body validation
router.post('/equip',
  authenticate,
  validate({ body: EquipItemSchema }),
  controller.equipItem
);
```

**Middleware Order:**
1. `authenticate` - JWT validation, sets `req.user`
2. `validate()` - Zod schema validation
3. Controller method

### Route Parameter Patterns
- **Path parameters:** `/:item_id`, `/:location_id`, `/:loadout_id`
- **Validation:** Always use corresponding `ParamsSchema` (e.g., `ItemIdParamsSchema`)
- **Extraction:** `const { item_id } = req.params;`

## Authentication Middleware Patterns

### JWT Token Validation
The `authenticate` middleware:

```typescript
// auth.ts:43-111
export const authenticate = async (req: Request, res: Response, next: NextFunction)
```

**Flow:**
1. Extract `Bearer <token>` from Authorization header
2. Validate JWT using Supabase `getClaims()` (fast asymmetric key validation)
3. Check token expiration
4. Attach user to request: `req.user = { id: claims.sub, email: claims.email }`
5. Call `next()` to proceed

**Error Responses:**
- 401 for missing/invalid/expired tokens
- Consistent error format: `{ error: { code, message, details? } }`

### Optional Authentication
`optionalAuthenticate` allows unauthenticated requests to proceed with `req.user = undefined`.

## Request Validation Patterns

### Zod Schema Integration
The `validate()` middleware factory supports multiple validation targets:

```typescript
validate({
  params: ItemIdParamsSchema,
  body: EquipItemSchema,
  query: LocationQuerySchema
})
```

**Schema Definitions (schemas.ts):**
```typescript
export const ItemIdParamsSchema = z.object({
  item_id: UUIDSchema  // z.string().uuid()
});

export const EquipItemSchema = z.object({
  item_id: UUIDSchema
});
```

**Validation Flow:**
1. Parse and validate each specified target (params/body/query)
2. Replace `req.params`, `req.body`, `req.query` with validated data
3. Return 400 with detailed error list if validation fails
4. Call `next()` if all validations pass

**Error Format:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "params.item_id",
        "message": "Invalid UUID format",
        "code": "invalid_string"
      }
    ]
  }
}
```

## Response Format Patterns

### Success Responses
Controllers use direct `res.json()` with different patterns:

**Simple Data Response:**
```typescript
// ItemController.ts:20
res.json(item);

// ItemController.ts:37
res.json(costInfo);
```

**Structured Success Response:**
```typescript
// ItemController.ts:54-61
res.json({
  success: result.success,
  item: result.updated_item,
  gold_spent: result.gold_spent,
  new_level: result.new_level,
  stat_increase: result.stat_increase,
  message: `Item upgraded to level ${result.new_level}!`
});
```

**Success with Metadata:**
```typescript
// EquipmentController.ts:20-26
res.json({
  slots: equipment.slots,
  total_stats: equipment.total_stats,
  equipment_count: Object.keys(equipment.slots).filter(slot =>
    equipment.slots[slot as keyof typeof equipment.slots] !== null
  ).length
});
```

### Error Response Format
All errors follow consistent structure via error handler middleware:

```typescript
// errorHandler.ts:117-123
const errorResponse: ErrorResponse = {
  error: {
    code: errorCode,        // e.g., "missing_token", "invalid_credentials"
    message,               // Human-readable message
    ...(details !== undefined && { details })  // Optional error details
  }
};
```

**Status Codes:**
- 400: Validation errors, bad requests
- 401: Authentication failures
- 404: Resource not found
- 422: Business logic failures (weak password, email exists)
- 500: Internal server errors

## Parameter Extraction Patterns

### Route Parameters
```typescript
// Always destructure after validation
const { item_id } = req.params;
const { location_id } = req.params;
```

### Request Body Access
```typescript
// Type-safe after validation middleware
const { item_id } = req.body as EquipItemRequest;
const { slot } = req.body as UnequipItemRequest;
```

### User Context
```typescript
// Non-null assertion after authenticate middleware
const userId = req.user!.id;
```

## Error Handling Patterns

### Try-Catch in Controllers
All controller methods use consistent error handling:

```typescript
methodName = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Controller logic
  } catch (error) {
    next(error);  // Forward to error handler middleware
  }
};
```

### Service Layer Error Propagation
Services throw typed errors that the error handler catches:

```typescript
// From utils/errors.ts (referenced in errorHandler.ts:1-10)
- ValidationError
- AuthenticationError
- AuthorizationError
- NotFoundError
- ConflictError
- DatabaseError
- ExternalAPIError
```

## Implementation Guidelines for Upgrade Endpoints

Based on these patterns, the upgrade endpoints should follow:

### GET /items/:item_id/upgrade-cost
```typescript
// Route definition
router.get('/:item_id/upgrade-cost',
  authenticate,
  validate({ params: ItemIdParamsSchema }),
  controller.getUpgradeCost
);

// Controller method (already exists in ItemController.ts:30-41)
getUpgradeCost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { item_id } = req.params;

    const costInfo = await itemService.getUpgradeCost(userId, item_id);
    res.json(costInfo);
  } catch (error) {
    next(error);
  }
};
```

### POST /items/:item_id/upgrade
```typescript
// Route definition
router.post('/:item_id/upgrade',
  authenticate,
  validate({ params: ItemIdParamsSchema }),
  controller.upgradeItem
);

// Controller method (already exists in ItemController.ts:47-65)
upgradeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { item_id } = req.params;

    const result = await itemService.upgradeItem(userId, item_id);

    res.json({
      success: result.success,
      item: result.updated_item,
      gold_spent: result.gold_spent,
      new_level: result.new_level,
      stat_increase: result.stat_increase,
      message: `Item upgraded to level ${result.new_level}!`
    });
  } catch (error) {
    next(error);
  }
};
```

## Key Insights

1. **Controller and routes already exist** - ItemController.ts has both upgrade endpoints implemented
2. **Routes already defined** - items.ts routes file includes both GET and POST upgrade endpoints
3. **Validation schemas exist** - ItemIdParamsSchema is defined and used
4. **Consistent patterns followed** - Implementation follows all established patterns
5. **Service layer delegation** - Business logic properly delegated to itemService methods
6. **Error handling** - Proper try-catch with next(error) forwarding
7. **Authentication required** - Both endpoints use authenticate middleware
8. **Response formats** - GET returns direct JSON, POST returns structured success response

The upgrade endpoints are already fully implemented following all the established patterns. The investigation reveals a mature, consistent architecture with proper separation of concerns, comprehensive validation, and standardized error handling.