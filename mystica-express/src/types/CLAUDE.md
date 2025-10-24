# CLAUDE.md

Type definitions and schemas for the backend.

## Files Overview

- **database.types.ts** - Auto-generated from Supabase (run `pnpm supabase:types`)
- **express.d.ts** - Express type extensions (`req.user`, `req.validated`, `req.context`)
- **schemas.ts** - Zod validation schemas for all request bodies/query params
- **repository.types.ts** - Base repository interface and generic type definitions
- **errors.ts** - Custom error classes (NotFoundError, ValidationError, etc.)
- **index.ts** - Barrel exports for easy imports

## Key Patterns

### 1. Zod Schemas (schemas.ts)

All request bodies and query parameters MUST have Zod schemas:

```typescript
export const CreateItemSchema = z.object({
  item_type_id: UUIDSchema,
  rarity: RaritySchema,
  name: z.string().min(1).max(100)
});

// Use with validate middleware:
router.post('/items',
  authenticate,
  validate({ body: CreateItemSchema }),
  itemController.createItem
);
```

**Always define reusable base schemas:**
- `UUIDSchema` - UUID string validation
- `RaritySchema` - Rarity enum
- `EquipmentSlotSchema` - Equipment slot enum
- Extend these in route-specific schemas

### 2. Express Type Extensions (express.d.ts)

Never redeclare `req` properties. Use typed extensions:

```typescript
// Added by auth middleware:
req.user: { id: string; email?: string }

// Added by validate middleware:
req.validated: { body?: T; query?: T; params?: T }

// Available for context:
req.context: { traceId: string }
```

### 3. Database Types (database.types.ts)

Auto-generated from Supabase schema:

```typescript
import { Database } from '../types/database.types.js';

type Item = Database['public']['Tables']['PlayerItems']['Row'];
type InsertItem = Database['public']['Tables']['PlayerItems']['Insert'];
type UpdateItem = Database['public']['Tables']['PlayerItems']['Update'];
```

Always use these instead of creating custom interfaces.

### 4. Repository Types (repository.types.ts)

Base repository interface for consistent CRUD patterns:

```typescript
export interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  findMany(filters?: any, options?: QueryOptions): Promise<T[]>;
  create(data: any): Promise<T>;
  update(id: string, data: any): Promise<T>;
  delete(id: string): Promise<void>;
}
```

All repositories extend `BaseRepository<T>` which implements this interface.

### 5. Error Classes (errors.ts)

Use for consistent error handling:

```typescript
import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ConflictError,
  BadRequestError
} from '../utils/errors.js';

// Throw from services:
throw new NotFoundError('Item', itemId);
throw new ValidationError('Materials limit exceeded');
throw new UnauthorizedError('Access denied');
```

Error handler middleware converts to HTTP responses.

## Development Guidelines

- **NEVER use `any` type** - Look up actual type from database.types or define explicit type
- **NEVER import from parent types** - Use barrel export from `./index.ts`
- **ALWAYS validate externally-provided data with Zod** - Routes handle body/query validation
- **ALWAYS use proper database types** - Avoid `unknown` or generic objects
- **Module resolution** - Use `.js` extensions in imports even though code is TypeScript
