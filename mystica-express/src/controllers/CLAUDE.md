# CLAUDE.md

Controllers orchestrate service calls and handle HTTP concerns. All controllers inherit from `BaseController<T>` which provides common response/error patterns.

## Core Pattern

```typescript
export class ItemController extends BaseController<ItemService> {
  constructor(private itemService = new ItemService()) {
    super();
  }

  async getItem(req: Request, res: Response) {
    const userId = req.user!.id;
    const { itemId } = req.params;

    const item = await this.itemService.getItem(userId, itemId);
    this.sendSuccess(res, { item }, 200);
  }
}
```

## Key Responsibilities

- **Extract** data from `req.user`, `req.validated`, `req.params`, `req.query`
- **Orchestrate** calls to one or more services
- **Transform** service results if needed (e.g., format response fields)
- **Send** responses via `BaseController` helper methods
- **Catch** errors - let error handler middleware catch and format them

## Never Do

- Database queries directly (use services)
- Business logic (use services)
- Manual JSON serialization (use `this.sendSuccess()`)
- Manual error formatting (use `this.sendError()` or throw custom errors)

## Response Methods

```typescript
this.sendSuccess(res, data, statusCode);    // 200, 201, etc.
this.sendError(res, error, statusCode);     // 400, 404, 500, etc.
```

## Type Safety

- `req.user` - Always exists after auth middleware, never null in protected routes
- `req.validated` - Contains validated request body/query after validate middleware
- Always type explicit: `const userId = req.user!.id;`

## File Naming

- Kebab-case with `Controller` suffix: `item-controller.ts` (legacy) or `ItemController.ts` (new TS)
- Match service naming: `ItemService` → `ItemController`
