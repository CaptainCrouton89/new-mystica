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

Error handler middleware in app.ts catches and formats responses.

### logger.ts
Structured logging with Winston. Logs to console in dev, file + console in production.

**Methods:** `info()`, `warn()`, `error()`, `debug()` (dev only)

Log level controlled by `LOG_LEVEL` env var (default: debug).

### image-url.ts
Generate R2 storage URLs for materials and item types using snake_case naming convention.

**Functions:**
- `getMaterialImageUrl(materialName)` - Returns `{R2_PUBLIC_URL}/materials/{name}.png`
- `getItemTypeImageUrl(itemTypeName)` - Returns `{R2_PUBLIC_URL}/items/{name}.png`

### image-url.ts
R2 storage URL generation utilities.

**Functions:**
- `getMaterialImageUrl(name)` - Returns R2 URL at `materials/{snake_case}.png`
- `getItemTypeImageUrl(name)` - Returns R2 URL at `items/{snake_case}.png`

Both normalize input to lowercase snake_case. Requires `R2_PUBLIC_URL` env var.

## Patterns

- **Error Handling:** Throw early with descriptive errors
- **Type Safety:** Fully typed, no `any` usage
- **Module Resolution:** All imports use `.js` extensions
