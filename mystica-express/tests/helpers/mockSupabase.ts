/**
 * Mock Supabase Client for Testing
 *
 * Provides a comprehensive mock implementation of the Supabase client
 * for unit testing repository operations.
 */

/**
 * Creates a mock Supabase client with jest mocks for all common operations
 *
 * @returns Mock client object with chained method support
 */
export function createMockSupabaseClient() {
  const mockClient = {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
  };

  // Default chainable mock implementations
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    containedBy: jest.fn().mockReturnThis(),
    rangeGt: jest.fn().mockReturnThis(),
    rangeGte: jest.fn().mockReturnThis(),
    rangeLt: jest.fn().mockReturnThis(),
    rangeLte: jest.fn().mockReturnThis(),
    rangeAdjacent: jest.fn().mockReturnThis(),
    overlaps: jest.fn().mockReturnThis(),
    textSearch: jest.fn().mockReturnThis(),
    match: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    csv: jest.fn(),
    geojson: jest.fn(),
    explain: jest.fn(),
    rollback: jest.fn(),
    returns: jest.fn().mockReturnThis(),
    // Terminal methods that return promises
    then: jest.fn(),
    catch: jest.fn(),
  };

  // Make from() return the query builder
  mockClient.from.mockReturnValue(mockQueryBuilder);

  return mockClient;
}

/**
 * Helper to setup specific mock chain for Supabase operations
 * Use this for tests that need specific mock responses
 *
 * @param mockClient The mock client from createMockSupabaseClient()
 * @param operations Array of operations in chain order
 * @param finalResponse The final response { data, error }
 *
 * @example
 * setupMockChain(mockClient, ['from', 'select', 'eq', 'single'], { data: mockItem, error: null });
 * setupMockChain(mockClient, ['from', 'update', 'eq', 'select', 'single'], { data: updatedItem, error: null });
 */
export function setupMockChain(mockClient: any, operations: string[], finalResponse: any) {
  let currentMock = mockClient;

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];

    if (i === operations.length - 1) {
      // Last operation - resolve with final response
      if (operation === 'single' || operation === 'maybeSingle') {
        currentMock[operation] = jest.fn().mockResolvedValue(finalResponse);
      } else {
        currentMock[operation] = jest.fn().mockResolvedValue(finalResponse);
      }
    } else {
      // Intermediate operation - return next mock in chain
      const nextMock = {};
      currentMock[operation] = jest.fn().mockReturnValue(nextMock);
      currentMock = nextMock;
    }
  }
}

/**
 * Creates mock data for common database entities
 */
export const mockData = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    vanity_level: 25,
    avg_item_level: 5.5,
    created_at: '2025-01-21T10:00:00Z',
  },

  item: {
    id: 'item-123',
    user_id: 'user-123',
    item_type_id: 'type-123',
    level: 5,
    is_styled: false,
    current_stats: { atkPower: 10, atkAccuracy: 8, defPower: 2, defAccuracy: 3 },
    material_combo_hash: 'abc123',
    generated_image_url: 'https://example.com/item.png',
    image_generation_status: 'complete' as const,
    created_at: '2025-01-21T10:00:00Z',
  },

  itemType: {
    id: 'type-123',
    name: 'Iron Sword',
    category: 'weapon',
    base_stats_normalized: { atkPower: 8, atkAccuracy: 6, defPower: 1, defAccuracy: 2 },
    rarity: 'common' as const,
    tier_id: 'tier-1',
    description: 'A sturdy iron sword',
    created_at: '2025-01-21T10:00:00Z',
  },

  userEquipment: {
    user_id: 'user-123',
    slot_name: 'weapon',
    item_id: 'item-123',
    equipped_at: '2025-01-21T10:00:00Z',
  },

  equipmentSlot: {
    slot_name: 'weapon',
    display_name: 'Weapon',
    sort_order: 1,
    description: 'Primary weapon slot',
  },

  material: {
    id: 'material-123',
    name: 'Steel',
    stat_modifiers: { atkPower: 2, atkAccuracy: 1, defPower: 0, defAccuracy: 0 },
    base_drop_weight: 100,
    description: 'Strong steel material',
    created_at: '2025-01-21T10:00:00Z',
  },

  materialStack: {
    user_id: 'user-123',
    material_id: 'material-123',
    style_id: 'style-normal',
    quantity: 10,
    updated_at: '2025-01-21T10:00:00Z',
  },
};

/**
 * Helper to create mock query responses
 */
export function createMockResponse<T>(data: T, error: any = null) {
  return Promise.resolve({ data, error });
}

/**
 * Helper to create mock error responses
 */
export function createMockError(code: string, message: string) {
  return Promise.resolve({
    data: null,
    error: { code, message },
  });
}

/**
 * Helper to create Supabase PGRST116 error (no rows found)
 */
export function createNotFoundError() {
  return createMockError('PGRST116', 'No rows found');
}