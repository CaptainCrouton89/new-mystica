# CLAUDE.md

Middleware layer for Express request processing pipeline.

## Patterns & Conventions

### Middleware Responsibility Order
```
CORS (app.ts:25)
  ↓
Body Parsing (app.ts:33-34)
  ↓
auth.ts - Validates JWT, attaches req.user
  ↓
validate.ts - Zod schema validation, attaches req.validated
  ↓
Route Handler
  ↓
Error Handler (app.ts)
```

### Auth Middleware (auth.ts)

**Purpose:** Validate JWT tokens and populate `req.user`

**Implementation:**
- Extracts JWT from `Authorization: Bearer {token}` header
- Decodes token to get user ID and metadata
- Attaches user data to `req.user` (extends Express Request type)
- Allows unauthenticated requests with optional auth flag

**Key Pattern:**
```typescript
// In route: make auth optional
router.get('/items', authenticate(false), itemController.getItems);

// In route: require auth
router.post('/items', authenticate, itemController.createItem);
```

**Error Handling:** Throws `UnauthorizedError` if token invalid or expired

### Validation Middleware (validate.ts)

**Purpose:** Validate request body/query/params against Zod schemas

**Implementation:**
- Takes schema object with optional `body`, `query`, `params` properties
- Validates incoming data against schemas
- Attaches validated data to `req.validated` for controller access
- Returns 400 Bad Request with detailed error messages on validation failure

**Key Pattern:**
```typescript
// In route:
router.post('/items',
  authenticate,
  validate({ body: CreateItemSchema }),
  itemController.createItem
);

// In controller:
const { name, rarity } = req.validated.body;
```

### Error Handling

Use custom error classes from `src/utils/errors.ts`:
- `NotFoundError(entity, id)` → 404
- `ValidationError(message)` → 400
- `UnauthorizedError(message)` → 401
- `ForbiddenError(message)` → 403
- `ConflictError(message)` → 409
- `InternalServerError(message)` → 500

**Pattern:** Throw errors in services/controllers, error handler converts to JSON responses

## Testing Middleware

### Auth Middleware Tests
```typescript
it('should attach user to request', async () => {
  const token = createTestToken(USER_ID);
  const res = await request(app)
    .get('/api/v1/items')
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
});

it('should throw UnauthorizedError for invalid token', async () => {
  const res = await request(app)
    .get('/api/v1/items')
    .set('Authorization', 'Bearer invalid');

  expect(res.status).toBe(401);
});
```

### Validation Middleware Tests
```typescript
it('should validate body schema', async () => {
  const res = await request(app)
    .post('/api/v1/items')
    .send({ name: '', rarity: 'invalid' }); // Missing required/invalid

  expect(res.status).toBe(400);
  expect(res.body.error).toBeDefined();
});
```

## Adding New Middleware

1. Create file `src/middleware/newMiddleware.ts`
2. Export as named export following pattern:
   ```typescript
   export function newMiddleware(options?: Options) {
     return (req: Request, res: Response, next: NextFunction) => {
       // Logic
       next();
     };
   }
   ```
3. Apply in `src/app.ts` at appropriate position in pipeline
4. Add tests in `tests/unit/middleware/`
5. Document pattern and usage in this file
