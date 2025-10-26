# CLAUDE.md

Controllers orchestrate service calls and handle HTTP concerns. Extract validated request data, delegate to services, return responses.

## Error Handling Styles

**Static Methods** (AuthController - explicit error responses):
- Catch specific error types, map to HTTP codes
- Return: `{ error: { code: 'CONSTANT', message: string } }`

**Arrow Functions** (new controllers - middleware delegation):
- Throw custom errors from `src/utils/errors.ts`
- Propagate via `next(error)` to centralized handler

## Key Patterns

- Extract userId: `req.user!.id` (protected routes only)
- Cast validated body: `(req.validated?.body || req.body) as SchemaType`
- Delegate to services for business logic
- Respond with `res.json()` or `res.status(code).json()`

## Success Responses

```typescript
res.json({ success: true, data });
res.status(201).json({ success: true, location });
```

## Never

- Database queries directly
- Business logic in controller
- Mix error handling styles within same controller
- Manual response serialization
