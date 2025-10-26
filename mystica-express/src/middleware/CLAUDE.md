# CLAUDE.md

Middleware layer for Express request processing.

## Middleware Order (app.ts)

```
CORS → Body Parsing → Auth → Validation → Route Handler → Error Handler
```

## Auth Middleware (auth.ts)

**Three functions:**
- `authenticate` — Requires JWT (Supabase email OR custom anonymous token)
- `optionalAuthenticate` — JWT optional; proceeds without user if missing/invalid
- `authenticateInternal` — Service-to-service via `X-Internal-Service` header

**Token types:**
- **Anonymous:** Custom JWT (see `verifyAnonymousToken()`) with `sub`, `device_id`, `iat`, `exp`
- **Email:** Supabase JWT validated via `getClaims()` (fast local JWKS verification)
- **Dev bypass:** `X-Dev-Token` + `X-Dev-User-Id` in development

**Attached to req.user:**
```typescript
{ id, email, device_id, account_type: 'anonymous' | 'email' }
```

**Usage:**
```typescript
router.post('/items', authenticate, itemController.createItem);
router.get('/items', optionalAuthenticate, itemController.getItems);
router.post('/internal/compute', authenticateInternal, compute);
```

## Validation Middleware (validate.ts)

Schema object with `body`, `query`, `params` (all optional):
```typescript
validate({ body: CreateItemSchema })
```

Attaches to `req.validated.body`, etc. Returns 400 on failure.

## Error Handling

Throw custom errors from `src/utils/errors.ts`:
- `NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `InternalServerError`

Express error handler converts to JSON responses.

## Adding New Middleware

1. Create `src/middleware/newMiddleware.ts`
2. Export as function: `(req, res, next) => { ... next() }`
3. Apply in `src/app.ts` at correct pipeline position
4. Add tests in `tests/unit/middleware/`
