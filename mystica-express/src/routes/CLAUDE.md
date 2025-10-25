# CLAUDE.md

Express route definitions for New Mystica API. See parent [CLAUDE.md](../CLAUDE.md) for architecture overview.

## Route Patterns

**Structure:** Each route file exports an Express Router with typed handlers.

```typescript
import { Router, type Request, type Response, type NextFunction } from 'express';
import { validateRequest } from '../middleware/validation.js';
import { authMiddleware } from '../middleware/auth.js';
import { YourSchema } from '../types/schemas.js';
import { YourController } from '../controllers/your.js';

const router = Router();

router.post(
  '/endpoint',
  authMiddleware,
  validateRequest('body', YourSchema),
  (req: Request, res: Response, next: NextFunction) => YourController.handler(req, res, next)
);

export default router;
```

## Key Conventions

- **File naming:** kebab-case (`auth.ts`, `equipment.ts`)
- **Middleware order:** CORS → auth → validation → handler
- **Error handling:** Throw errors in controllers; middleware catches via `next(error)`
- **Validation:** Use `validateRequest(location, schema)` middleware (supports `body`, `query`, `params`)
- **Type safety:** All handlers typed `(req: Request, res: Response, next: NextFunction) => void`

## Registration

Routes registered in `app.ts`:
```typescript
import authRoutes from './routes/auth.js';
import equipmentRoutes from './routes/equipment.js';

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/equipment', equipmentRoutes);
```

## Related Files

- **Controllers:** `src/controllers/` - HTTP logic (req/res orchestration)
- **Services:** `src/services/` - Business logic
- **Schemas:** `src/types/schemas.ts` - Zod validation definitions
- **Middleware:** `src/middleware/` - Auth, validation, error handling
