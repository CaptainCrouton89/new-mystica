/**
 * Mock Supabase Client for Testing
 *
 * Provides mock implementations of Supabase auth methods
 */

export const mockSupabaseAuth = {
  getClaims: jest.fn(),
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  refreshSession: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  resend: jest.fn(),
  admin: {
    signOut: jest.fn(),
    getUserById: jest.fn(),
    updateUserById: jest.fn(),
  }
};

export const mockSupabaseClient = {
  auth: mockSupabaseAuth,
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
};

// Mock the createClient function
export const mockCreateClient = jest.fn(() => mockSupabaseClient);

// Reset all mocks between tests
export const resetSupabaseMocks = () => {
  Object.values(mockSupabaseAuth).forEach(mock => {
    if (typeof mock === 'function') {
      mock.mockReset();
    }
  });
  Object.values(mockSupabaseAuth.admin).forEach(mock => {
    if (typeof mock === 'function') {
      mock.mockReset();
    }
  });
  mockSupabaseClient.from.mockReset();
  mockCreateClient.mockReset().mockReturnValue(mockSupabaseClient);
};
