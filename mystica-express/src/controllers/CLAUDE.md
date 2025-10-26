# CLAUDE.md

Controllers orchestrate service calls and handle HTTP concerns. All controllers use arrow function methods with middleware-delegated error handling, except `AuthController` which uses static methods with explicit error responses.

## Core Pattern (Arrow Functions)

```typescript
export class LocationController {
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = req.params as unknown as LocationParams;
      const body = (req.validated?.body || req.body) as SchemaType;

      const result = await locationService.getById(id);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);  // Middleware handles
    }
  };
}
```

## Key Responsibilities

- **Extract:** userId from `req.user!.id`, params/query/body from typed schemas
- **Delegate:** Call service layer for business logic only
- **Respond:** Use `res.json()` or `res.status(code).json()`
- **Handle errors:** Throw custom errors, let middleware catch via `next(error)`

## Type Safety

- `req.user!.id` — Always exists after auth middleware
- `req.validated?.body || req.body` — Cast to schema: `as SchemaType`
- `req.params / req.query` — Cast: `as unknown as LocationParams`
- Import types from `src/types/schemas.ts`

## Never Do

- Database queries directly (use services/repositories)
- Business logic (calculations, stat operations)
- Manual response serialization
- Mix error handling styles within same controller

## Response Format

- Success: `res.json({ success: true, ...data })`
- Created: `res.status(201).json({ success: true, ...data })`
- Errors: Throw custom error types from `src/utils/errors.ts`, middleware handles

## AuthController Exception

Uses **static methods** with explicit error handling (catches error types, returns `res.status(code)` instead of `next(error)`). Follow that pattern only for auth endpoints.
