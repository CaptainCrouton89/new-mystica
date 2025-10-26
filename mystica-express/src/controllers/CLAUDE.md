# CLAUDE.md

Controllers orchestrate service calls and return responses. All delegate business logic to services.

## Arrow Function Pattern (LocationController)

```typescript
export class LocationController {
  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as LocationParams;
      const result = await locationService.getById(id);
      res.json(result);
    } catch (error) {
      next(error);  // Middleware handles
    }
  };
}
```

## Static Method Pattern (AuthController)

Catches specific error types, maps to HTTP codes explicitly:
```typescript
static async register(req: Request, res: Response) {
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

## Key Responsibilities

- Extract: `req.user!.id` (protected routes), `req.params as unknown as Type`
- Cast body: `(req.validated?.body || req.body) as SchemaType`
- Delegate all business logic to services
- Throw custom errors from `src/utils/errors.ts` for arrow functions
- Return explicit error responses for static methods

## Never

- Database queries directly
- Business logic
- Mix error handling styles within same controller
