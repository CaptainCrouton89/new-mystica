# Error Handling Audit in Mystica Express Backend

## Error Handling Strategy: Fail Fast and Explicit

### Core Principles
1. **Never Use Silent Fallbacks**
2. **Throw Specific Errors**
3. **Provide Comprehensive Context**

### Error Handling Patterns

#### Strict Input Validation
```typescript
// Anti-pattern
function processItem(item?: Item) {
  const description = item?.description;
  // Silently continues with undefined
}

// Recommended Approach
function processItem(item: Item): void {
  if (!item) {
    throw new MissingDataError('Item must be provided', { context: 'processItem' });
  }

  if (!item.description) {
    throw new InvalidItemError('Item description is required', {
      item,
      missingFields: ['description']
    });
  }

  // Proceed only with fully validated item
}
```

#### Error Context and Tracing
```typescript
class DomainSpecificError extends Error {
  constructor(
    message: string,
    public context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'DomainSpecificError';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      timestamp: new Date().toISOString()
    };
  }
}

class ItemValidationError extends DomainSpecificError {
  constructor(message: string, itemData: Partial<Item>) {
    super(message, {
      type: 'ItemValidation',
      itemData: JSON.stringify(itemData)
    });
  }
}
```

### Action Items
1. Replace all `??` and `||` with explicit validation
2. Create domain-specific error classes
3. Implement comprehensive input guards
4. Remove all silent default value assignments
5. Add detailed error logging and tracing

### Error Logging Strategy
```typescript
function logError(error: Error): void {
  if (error instanceof DomainSpecificError) {
    // Log with full context
    console.error(JSON.stringify(error.toJSON(), null, 2));
  } else {
    // Standardized error logging
    console.error({
      message: error.message,
      name: error.name,
      stack: error.stack
    });
  }

  // Optionally send to centralized error tracking
  errorTracker.report(error);
}
```

### Recommended Error Handling Workflow
1. Validate ALL inputs immediately
2. Throw specific errors with context
3. Log errors with comprehensive details
4. Never continue with partial/invalid data

### Forbidden Patterns
- `const value = input || defaultValue`
- `const result = maybeValue ?? defaultValue`
- `return undefined` in error scenarios
- Silent type casting with `as any`

### Enforced Type Safety
```typescript
// Strict type checking
function getItemName(item: Readonly<Item>): string {
  if (!item.name) {
    throw new ItemValidationError('Item name is required', item);
  }
  return item.name;
}
```

## Implementation Guidelines
- Always throw errors, never return default values
- Provide maximum context in error messages
- Create granular, specific error classes
- Log errors with full context
- Fail fast and explicitly