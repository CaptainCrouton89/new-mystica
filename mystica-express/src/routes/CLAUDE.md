# CLAUDE.md

Express route definitions for New Mystica API. See parent [CLAUDE.md](../CLAUDE.md) for architecture overview.

## Route Patterns

**Structure:** Compose middleware with route handlers:
```typescript
router.get(
  '/endpoint',
  authenticate,
  validate({ query: QuerySchema }),
  controllerHandler
);
```

**Middleware:** `authenticate` → `validate()` (body/query/params) → handler

## Conventions

- **File naming:** kebab-case (`locations.ts`, `equipment.ts`)
- **Validation:** `validate({ query/body/params: Schema })` with Zod schemas from `../types/schemas.ts`
- **Error handling:** Controllers throw; middleware catches via `next(error)`
- **Types:** Database types auto-generated via `pnpm supabase:types`

## Registration

Routes registered in `app.ts`:
```typescript
app.use('/api/v1/locations', locationsRoutes);
app.use('/api/v1/equipment', equipmentRoutes);
```

See: Controllers `../controllers/` | Services `../services/` | Middleware `../middleware/`
