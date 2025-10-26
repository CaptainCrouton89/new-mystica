# CLAUDE.md

Utility functions and classes for the Express backend.

## Files Overview

### errors.ts
Custom error classes extending Error. Used throughout services and controllers for consistent error handling.

**Classes:**
- `NotFoundError(entityName, id)` - 404 when resource doesn't exist
- `ValidationError(message)` - 400 for invalid input
- `UnauthorizedError(message)` - 401 for permission issues
- `ConflictError(message)` - 409 for duplicate/conflict states
- `NotImplementedError(feature)` - 501 for unimplemented features

**Usage:**
```typescript
import { NotFoundError, ValidationError } from '../utils/errors.js';

if (!item) throw new NotFoundError('Item', itemId);
if (materials.length > 3) throw new ValidationError('Max 3 materials');
```

**Pattern:** Always throw early and often. Error handler middleware in app.ts catches and formats responses.

### logger.ts
Structured logging with Winston. Logs to console in dev, file + console in production.

**Methods:**
- `logger.info(message, metadata?)` - Info level
- `logger.warn(message, metadata?)` - Warning level
- `logger.error(message, metadata?)` - Error level
- `logger.debug(message, metadata?)` - Debug level (dev only)

**Usage:**
```typescript
import { logger } from '../utils/logger.js';

logger.info('User created', { userId, email });
logger.error('Database error', { query: 'SELECT...', error: err.message });
```

**Configuration:** Log level controlled by `LOG_LEVEL` env var (default: debug)

### image-url.ts
Generate R2 storage URLs for materials and item types using snake_case normalization.

**Functions:**
- `getMaterialImageUrl(materialName)` - Returns `{R2_URL}/materials/{snake_case}.png`
- `getItemTypeImageUrl(itemTypeName)` - Returns `{R2_URL}/items/{snake_case}.png`

Both normalize whitespace to underscores and convert to lowercase.

## Patterns

- **Error Handling:** Never fallback - throw immediately with descriptive errors
- **Type Safety:** All utilities are fully typed, no `any` usage
- **Module Resolution:** All imports use `.js` extensions for CommonJS compatibility
