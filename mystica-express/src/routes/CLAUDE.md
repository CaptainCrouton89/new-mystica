# CLAUDE.md

Express route definitions for New Mystica API. See parent [CLAUDE.md](../CLAUDE.md) for architecture overview.

## Route Patterns

Compose middleware directly in route definition (no try/catch wrapper):
```typescript
router.get(
  '/endpoint',
  authenticate,
  validate({ query: QuerySchema }),
  controllerMethod
);
```

**Middleware order:** `authenticate` → `validate()` → handler

## Conventions

- **File naming:** kebab-case (`auth.ts`, `locations.ts`)
- **Validation:** `validate({ query/body/params: Schema })` with Zod schemas from `../types/schemas.ts`
- **Error handling:** Controllers throw custom errors; global error handler in `app.ts` catches
- **Controller calls:** Direct method calls (no `new` keyword) — e.g., `AuthController.register`
- **Imports:** Use `.js` extensions (ESM-ready)

## Registration

Routes registered in `app.ts`:
```typescript
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/locations', locationsRoutes);
```

See: Controllers `../controllers/` | Services `../services/` | Types `../types/schemas.ts`
