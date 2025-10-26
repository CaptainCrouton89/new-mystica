# CLAUDE.md

Utility functions and classes for the Express backend.

## Files Overview

### errors.ts
Custom error classes extending Error. Used throughout services and controllers.

**Classes:**
- `NotFoundError(entityName, id)` - 404
- `ValidationError(message)` - 400
- `UnauthorizedError(message)` - 401
- `ConflictError(message)` - 409
- `NotImplementedError(feature)` - 501

Error handler middleware in app.ts catches and formats responses. See parent CLAUDE.md for usage patterns.

### logger.ts
Structured logging with Winston. Logs to console in dev, file + console in production.

**Methods:** `info()`, `warn()`, `error()`, `debug()` (dev only)

Log level controlled by `LOG_LEVEL` env var (default: debug).

### image-url.ts
Generate R2 storage URLs for materials and item types using snake_case normalization.

**Functions:**
- `getMaterialImageUrl(materialName)` - Returns `{R2_PUBLIC_URL}/materials/{snake_case}.png`
- `getItemTypeImageUrl(itemTypeName)` - Returns `{R2_PUBLIC_URL}/items/{snake_case}.png`

Both normalize whitespace to underscores and convert to lowercase. Requires `R2_PUBLIC_URL` env var.

## Patterns

- **Error Handling:** Throw early with descriptive errors
- **Type Safety:** Fully typed, no `any` usage
- **Module Resolution:** All imports use `.js` extensions
