# CLAUDE.md

Controllers orchestrate HTTP concerns and delegate business logic to services. Two patterns coexist:

## Arrow Function Pattern (Middleware Delegation)

Used by most controllers (LocationController, etc.). Propagate errors via `next(error)`.

```typescript
export class LocationController {
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as LocationParams;
      const result = await locationService.getById(id);
      res.json(result);
    } catch (error) {
      next(error);  // Middleware handles error mapping
    }
  };
}
```

## Static Method Pattern (Explicit Error Handling)

Used by AuthController. Catches specific error types, maps to HTTP codes explicitly.

```typescript
static async register(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: { code: 'CODE', message: error.message } });
    }
  }
}
```

## Key Patterns

- **Extract:** userId from `req.user!.id`, params/query/body with type casting
- **Delegate:** All business logic to services
- **Respond:** Use `res.json()` or `res.status(code).json()`
- **Errors:** Throw custom errors from `src/utils/errors.ts`; middleware catches (arrow functions) or handle explicitly (static methods)

## Type Safety

- `req.user!.id` — Always exists after auth middleware
- `req.params / req.query` — Cast: `as unknown as LocationParams`
- Import types from `src/types/schemas.ts`

## Never

- Database queries directly
- Business logic calculations
- Manual response serialization
- Mix error handling styles within same controller
