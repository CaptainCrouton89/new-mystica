# CLAUDE.md

Controllers orchestrate service calls and handle HTTP concerns. Controllers define endpoints, extract validated request data, delegate to services, and return responses.

## Core Patterns

**Static Methods** (AuthController, explicit error handling):
```typescript
export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await authService.register({ email, password });
      res.status(201).json({ ...result, message: 'User registered successfully' });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: { code: 'MISSING_CREDENTIALS', message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '...' } });
    }
  }
}
```

**Arrow Function Methods** (other controllers, middleware delegation):
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
- **Handle errors** by catching specific error types and mapping to HTTP codes (static methods) OR propagate via `next(error)` (arrow functions)

## Error Handling Patterns

**AuthController Pattern** (explicit error responses):
- Catch specific error types: `ValidationError`, `ConflictError`, `NotFoundError`, `BusinessLogicError`
- Map to appropriate HTTP status codes (400, 401, 422, 404, 500)
- Return structured error object: `{ error: { code: 'CONSTANT', message: string } }`
- Use `return` to exit after error response

**Other Controllers** (middleware delegation):
- Throw custom errors, let error handler middleware catch
- Use `next(error)` to propagate to centralized error handling

## Response Patterns

**Success (200/201):**
```typescript
res.json({ success: true, item, gold_spent, new_gold_balance });
res.status(201).json({ ...result, message: 'User registered successfully' });
```

**Errors (explicit - AuthController):**
```typescript
res.status(400).json({ error: { code: 'MISSING_CREDENTIALS', message: '...' } });
res.status(422).json({ error: { code: 'EMAIL_EXISTS', message: '...' } });
```

## Type Safety

- `req.user!.id` - Always exists after auth middleware, non-null assertion safe in protected routes
- `req.validated?.body` - Zod-validated body with optional fallback to raw body
- Cast validated data: `as ApplyMaterialRequest` (using type imports from schemas.ts)

## Never Do

- Database queries directly (use repositories/services)
- Business logic (material combinations, stat calculations → services)
- Mix error handling styles within same controller (choose static or arrow, stick to it)
- Manual response serialization (use `res.json()`)

## Validation Fallback Pattern

Some endpoints accept both validated and raw body:
```typescript
const body = (req.validated?.body || req.body) as ApplyMaterialRequest;
```

This supports both validated and unvalidated request paths.

## Item Transformation

`upgradeItem` transforms database Item to PlayerItem format for frontend compatibility—handles missing descriptions, applies defaults, and maps material arrays.
