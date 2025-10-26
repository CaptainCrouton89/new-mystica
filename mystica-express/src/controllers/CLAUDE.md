# CLAUDE.md

Controllers orchestrate HTTP concerns and delegate business logic to services.

## Pattern

Arrow function pattern with middleware error delegation:

```typescript
export class SomeController {
  someAction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { field } = req.body as unknown as SomeRequest;
      const userId = req.user!.id; // Auth middleware ensures user exists
      const result = await service.doSomething(userId, field);
      res.status(201).json(result);
    } catch (error) {
      next(error);  // Middleware handles error mapping
    }
  };
}
```

## Key Patterns

- **Extract:** userId from `req.user!.id`, params/query/body with type casting `as unknown as Type`
- **Delegate:** All business logic to services; never directly query database
- **Respond:** Use `res.json()` or `res.status(code).json()`
- **Errors:** Throw custom errors from `src/utils/errors.ts`; middleware catches
- **Transform:** Convert service results to API response shape (e.g., `Item` → `PlayerItem` for frontend compatibility)

## ItemController Specifics

- **Stats Computation:** Computed server-side via `StatsService` and included in all item responses. Clients rely on accurate stat data.
- **Response Transformation:** Methods like `upgradeItem` and `applyMaterial` transform database models to `PlayerItem` format before responding. This ensures frontend consistency.
- **Material Application:** Complex transformation logic maps materials with style_id and name fields for Swift compatibility.

## Type Safety

- Request bodies/query params: Cast as `as unknown as SchemaType` (from `src/types/schemas.ts`)
- Import types from `src/types/schemas.ts` and `src/types/api.types.js`
- No `any` types

## Never

- Database queries directly
- Business logic calculations
- Manual response serialization
- Mix error handling patterns
