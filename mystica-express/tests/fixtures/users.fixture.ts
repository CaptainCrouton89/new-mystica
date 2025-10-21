/**
 * User Test Fixtures
 *
 * Provides standardized user objects for testing authentication flows,
 * user profiles, and permission levels across different test scenarios.
 */

export interface User {
  id: string;
  email: string | null;
  device_id: string | null;
  account_type: 'email' | 'anonymous';
  created_at: string;
  last_login: string;
  vanity_level: number;
  avg_item_level: number | null;
}

/**
 * Anonymous user for testing device-based authentication
 */
export const ANONYMOUS_USER: User = {
  id: 'a7f99fed-262b-43e2-a88c-a8c5e4720577',
  email: null,
  device_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  account_type: 'anonymous',
  created_at: '2025-01-01T00:00:00Z',
  last_login: '2025-01-20T12:00:00Z',
  vanity_level: 0,
  avg_item_level: null
};

/**
 * Email-authenticated user for testing standard auth flows
 */
export const EMAIL_USER: User = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  device_id: null,
  account_type: 'email',
  created_at: '2024-12-01T00:00:00Z',
  last_login: '2025-01-20T10:30:00Z',
  vanity_level: 5,
  avg_item_level: 15
};

/**
 * Admin user with elevated vanity level for testing premium features
 */
export const ADMIN_USER: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'admin@mystica.app',
  device_id: null,
  account_type: 'email',
  created_at: '2024-10-01T00:00:00Z',
  last_login: '2025-01-20T15:45:00Z',
  vanity_level: 100,
  avg_item_level: 50
};

/**
 * Create custom user with property overrides
 *
 * @param overrides - Partial user properties to override defaults
 * @returns User object with merged properties
 */
export function createUser(overrides: Partial<User> = {}): User {
  return { ...ANONYMOUS_USER, ...overrides };
}