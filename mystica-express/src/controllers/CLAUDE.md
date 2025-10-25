# CLAUDE.md

Controllers orchestrate service calls and handle HTTP concerns. Controllers define endpoints, extract validated request data, delegate to services, and return responses.

## Core Pattern

**Arrow Function Methods** (modern pattern):
```typescript
export class ItemController {
  applyMaterial = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { item_id } = req.params;
      const body = (req.validated?.body || req.body) as ApplyMaterialRequest;

      const result = await materialService.applyMaterial({ userId, itemId: item_id, ... });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}
```

## Key Responsibilities

- **Extract** userId from `req.user!.id`, params/query/body data
- **Cast validated body** to typed schema: `const body = (req.validated?.body || req.body) as SchemaType`
- **Delegate** to service layer for business logic
- **Transform** service results if needed (e.g., upgradeItem converts to PlayerItem format)
- **Respond** via `res.json()` with structured response or `res.status(code).json()`
- **Propagate errors** via `next(error)` to error handler middleware

## Response Patterns

**Success (200):**
```typescript
res.json({ success: true, item, gold_spent, new_gold_balance });
res.json({ item, stats, image_url }); // implicit 200
```

**Client Error (400-404):**
```typescript
res.status(400).json({ success: false, error: 'Invalid slot_index' });
```

Prefer throwing custom errors to explicit error responses—error handler middleware formats them uniformly.

## Type Safety

- `req.user!.id` - Always exists after auth middleware, non-null assertion safe in protected routes
- `req.validated?.body` - Zod-validated body with optional fallback to raw body
- Cast validated data: `as ApplyMaterialRequest` (using type imports from schemas.ts)

## Never Do

- Database queries directly (use repositories/services)
- Business logic (material combinations, stat calculations → services)
- Manual error formatting (throw custom errors, let error handler catch)
- Manual response serialization (use `res.json()`)

## Validation Fallback Pattern

Some endpoints accept both validated and raw body:
```typescript
const body = (req.validated?.body || req.body) as ApplyMaterialRequest;
```

This supports both validated and unvalidated request paths.

## Item Transformation

`upgradeItem` transforms database Item to PlayerItem format for frontend compatibility—handles missing descriptions, applies defaults, and maps material arrays.
