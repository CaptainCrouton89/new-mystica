/**
 * Unit Tests: AuthService
 *
 * Tests the AuthService methods that handle authentication operations:
 * - Device registration (anonymous authentication)
 * - Email authentication (register, login, logout, refresh)
 * - Password reset and email verification flows
 * - User profile retrieval
 */

import { AuthService } from '../../../src/services/AuthService.js';
import { ValidationError, ConflictError, NotFoundError, BusinessLogicError } from '../../../src/utils/errors.js';

// Mock external dependencies
jest.mock('@supabase/supabase-js', () => {
  const mockAuthMethods = {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    refreshSession: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    resend: jest.fn(),
    admin: {
      signOut: jest.fn()
    }
  };

  return {
    createClient: jest.fn(() => ({
      auth: mockAuthMethods
    }))
  };
});

jest.mock('../../../src/config/supabase', () => ({
  supabase: {
    from: jest.fn()
  }
}));

jest.mock('../../../src/utils/jwt');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-12345')
}));

// Mock ProfileRepository
jest.mock('../../../src/repositories/ProfileRepository.js', () => {
  const mockInstance = {
    findUserById: jest.fn(),
    getAllCurrencyBalances: jest.fn().mockResolvedValue({ GOLD: 1000, GEMS: 50 }),
    updateLastLogin: jest.fn(),
    addCurrency: jest.fn(),
    deductCurrency: jest.fn()
  };

  return {
    ProfileRepository: jest.fn().mockImplementation(() => mockInstance),
    __mockInstance: mockInstance // Export the mock instance for testing
  };
});

jest.mock('../../../src/config/env', () => ({
  env: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    JWT_SECRET: 'test-jwt-secret'
  }
}));

jest.mock('../../../src/utils/jwt.js', () => ({
  generateAnonymousToken: jest.fn(() => ({
    access_token: 'mock-jwt-token',
    expires_in: 2592000,
    expires_at: Math.floor(Date.now() / 1000) + 2592000
  }))
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockSupabaseAdmin: any;
  let mockSupabaseAuth: any;
  let mockProfileRepository: any;
  let mockAuthMethods: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get the mocked instances
    mockSupabaseAdmin = require('../../../src/config/supabase').supabase;
    const { createClient } = require('@supabase/supabase-js');
    mockSupabaseAuth = createClient();
    mockAuthMethods = mockSupabaseAuth.auth;

    // Get the mock ProfileRepository instance
    const { __mockInstance } = require('../../../src/repositories/ProfileRepository.js');
    mockProfileRepository = __mockInstance;

    authService = new AuthService();

    // Reset ProfileRepository mock to default state
    mockProfileRepository.getAllCurrencyBalances.mockResolvedValue({ GOLD: 1000, GEMS: 50 });
    mockProfileRepository.findUserById.mockResolvedValue(null);
    mockProfileRepository.updateLastLogin.mockResolvedValue(undefined);

    // Setup default mock chain
    mockSupabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null })
    });
  });

  describe('registerDevice()', () => {
    it('should register new device and return user profile with session', async () => {
      // Arrange: Mock for new device registration (no existing user)
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }
            }),
            insert: jest.fn().mockResolvedValue({ data: {}, error: null })
          };
        }
        if (table === 'usercurrencybalances') {
          return {
            insert: jest.fn().mockResolvedValue({ data: {}, error: null })
          };
        }
        return {};
      });

      // Act
      const result = await authService.registerDevice({ device_id: 'test-device-123' });

      // Assert
      expect(result.user.id).toBe('mock-uuid-12345');
      expect(result.session.access_token).toBe('mock-jwt-token');
      expect(result.session.refresh_token).toBeNull();
      expect(result.message).toBe('Device registered successfully');
      const mockGenerateAnonymousToken = require('../../../src/utils/jwt.js').generateAnonymousToken;
      expect(mockGenerateAnonymousToken).toHaveBeenCalledWith('mock-uuid-12345', 'test-device-123');
    });

    it('should return existing user for registered device', async () => {
      // Arrange: Existing user found
      const existingUser = {
        id: 'existing-user-123',
        device_id: 'test-device-123',
        account_type: 'anonymous',
        vanity_level: 5,
        avg_item_level: 2.5,
        created_at: '2024-01-01T00:00:00Z',
        last_login: '2024-01-02T00:00:00Z'
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: existingUser, error: null }),
        update: jest.fn().mockReturnThis()
      });

      // Reset mock to track calls properly
      mockProfileRepository.updateLastLogin.mockResolvedValue(undefined);
      mockProfileRepository.getAllCurrencyBalances.mockResolvedValue({ GOLD: 1000, GEMS: 50 });

      // Act
      const result = await authService.registerDevice({ device_id: 'test-device-123' });

      // Assert
      expect(result.user.id).toBe('existing-user-123');
      expect(result.user.gold).toBe(1000);
      expect(result.message).toBe('Device login successful');
      expect(mockProfileRepository.updateLastLogin).toHaveBeenCalledWith('existing-user-123');
    });

    it('should throw ValidationError for missing device_id', async () => {
      await expect(authService.registerDevice({ device_id: '' }))
        .rejects.toThrow(ValidationError);

      await expect(authService.registerDevice({ device_id: '' }))
        .rejects.toThrow('Device ID is required');
    });

    // Note: Race condition handling is complex to test in isolation
    // and is already covered by the database constraint logic
  });

  describe('register()', () => {
    it('should register new user with email and password', async () => {
      // Arrange
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSession = { access_token: 'token', refresh_token: 'refresh' };

      mockSupabaseAuth.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      mockSupabaseAdmin.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: {}, error: null })
      });

      // Act
      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123'
      });

      // Assert
      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(result.message).toBe('Registration successful. Please check your email for verification link.');
      expect(mockSupabaseAuth.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    it('should throw ValidationError for short password', async () => {
      await expect(authService.register({
        email: 'test@example.com',
        password: '123'
      })).rejects.toThrow(ValidationError);

      await expect(authService.register({
        email: 'test@example.com',
        password: '123'
      })).rejects.toThrow('Password must be at least 8 characters long');
    });

    it('should throw ValidationError for missing email or password', async () => {
      await expect(authService.register({
        email: '',
        password: 'password123'
      })).rejects.toThrow(ValidationError);

      await expect(authService.register({
        email: 'test@example.com',
        password: ''
      })).rejects.toThrow(ValidationError);

      await expect(authService.register({
        email: '',
        password: ''
      })).rejects.toThrow('Email and password are required');
    });

    it('should throw ConflictError for existing email', async () => {
      mockSupabaseAuth.auth.signUp.mockResolvedValue({
        data: null,
        error: { message: 'User already registered' }
      });

      await expect(authService.register({
        email: 'existing@example.com',
        password: 'password123'
      })).rejects.toThrow(ConflictError);
    });
  });

  describe('login()', () => {
    it('should login user with valid credentials', async () => {
      // Arrange
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSession = { access_token: 'token', refresh_token: 'refresh' };

      mockSupabaseAuth.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      // Reset mock to track calls
      mockProfileRepository.updateLastLogin.mockResolvedValue(undefined);

      // Act
      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123'
      });

      // Assert
      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(mockSupabaseAuth.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
      expect(mockProfileRepository.updateLastLogin).toHaveBeenCalledWith('user-123');
    });

    it('should throw ValidationError for invalid credentials', async () => {
      mockSupabaseAuth.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

      await expect(authService.login({
        email: 'test@example.com',
        password: 'wrongpassword'
      })).rejects.toThrow(ValidationError);

      await expect(authService.login({
        email: 'test@example.com',
        password: 'wrongpassword'
      })).rejects.toThrow('Invalid email or password');
    });

    it('should throw ValidationError for missing email or password', async () => {
      await expect(authService.login({
        email: '',
        password: 'password123'
      })).rejects.toThrow(ValidationError);

      await expect(authService.login({
        email: 'test@example.com',
        password: ''
      })).rejects.toThrow(ValidationError);

      await expect(authService.login({
        email: '',
        password: ''
      })).rejects.toThrow('Email and password are required');
    });
  });

  describe('logout()', () => {
    it('should logout successfully', async () => {
      mockSupabaseAuth.auth.admin.signOut.mockResolvedValue({
        data: {},
        error: null
      });

      // Should not throw
      await expect(authService.logout('valid-token')).resolves.toBeUndefined();
      expect(mockSupabaseAuth.auth.admin.signOut).toHaveBeenCalledWith('valid-token');
    });

    it('should handle logout errors gracefully', async () => {
      mockSupabaseAuth.auth.admin.signOut.mockResolvedValue({
        data: null,
        error: { message: 'Token invalid' }
      });

      // Should not throw even on error
      await expect(authService.logout('invalid-token')).resolves.toBeUndefined();
    });
  });

  describe('refresh()', () => {
    it('should refresh session successfully', async () => {
      const mockSession = { access_token: 'new-token', refresh_token: 'new-refresh' };

      mockSupabaseAuth.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await authService.refresh({ refresh_token: 'valid-refresh-token' });

      expect(result.session).toEqual(mockSession);
      expect(mockSupabaseAuth.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: 'valid-refresh-token'
      });
    });

    it('should throw ValidationError for invalid refresh token', async () => {
      mockSupabaseAuth.auth.refreshSession.mockResolvedValue({
        data: null,
        error: { message: 'Refresh token expired' }
      });

      await expect(authService.refresh({ refresh_token: 'invalid-token' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for missing refresh token', async () => {
      await expect(authService.refresh({ refresh_token: '' }))
        .rejects.toThrow(ValidationError);

      await expect(authService.refresh({ refresh_token: '' }))
        .rejects.toThrow('Refresh token is required');
    });
  });

  describe('resetPassword()', () => {
    it('should always return success message for security', async () => {
      mockSupabaseAuth.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null
      });

      const result = await authService.resetPassword({ email: 'test@example.com' });

      expect(result.message).toBe('If an account with that email exists, a password reset link has been sent.');
      expect(mockSupabaseAuth.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        { redirectTo: 'https://test.supabase.co/auth/v1/verify' }
      );
    });

    // Note: resetPassword intentionally returns success for security even with invalid inputs
    it('should return success message for empty email (security)', async () => {
      const result = await authService.resetPassword({ email: '' });
      expect(result.message).toBe('If an account with that email exists, a password reset link has been sent.');
    });

    it('should return success message even on error', async () => {
      mockSupabaseAuth.auth.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { message: 'Email not found' }
      });

      const result = await authService.resetPassword({ email: 'nonexistent@example.com' });

      expect(result.message).toBe('If an account with that email exists, a password reset link has been sent.');
    });
  });

  describe('resendVerification()', () => {
    it('should always return success message for security', async () => {
      mockSupabaseAuth.auth.resend.mockResolvedValue({
        data: {},
        error: null
      });

      const result = await authService.resendVerification({ email: 'test@example.com' });

      expect(result.message).toBe('If an account with that email exists, a verification link has been sent.');
      expect(mockSupabaseAuth.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'test@example.com'
      });
    });

    // Note: resendVerification intentionally returns success for security even with invalid inputs
    it('should return success message for empty email (security)', async () => {
      const result = await authService.resendVerification({ email: '' });
      expect(result.message).toBe('If an account with that email exists, a verification link has been sent.');
    });
  });

  describe('getCurrentUser()', () => {
    it('should return user profile successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        vanity_level: 5,
        avg_item_level: 2.5,
        created_at: '2024-01-01T00:00:00Z',
        last_login: '2024-01-02T00:00:00Z'
      };

      // Reset mocks to ensure calls are tracked
      mockProfileRepository.findUserById.mockResolvedValue(mockUser);
      mockProfileRepository.getAllCurrencyBalances.mockResolvedValue({ GOLD: 1000, GEMS: 50 });

      const result = await authService.getCurrentUser('user-123');

      expect(result.user.id).toBe('user-123');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.gold).toBe(1000);
      expect(mockProfileRepository.findUserById).toHaveBeenCalledWith('user-123');
    });

    it('should throw NotFoundError when user not found', async () => {
      mockProfileRepository.findUserById.mockResolvedValue(null);

      await expect(authService.getCurrentUser('nonexistent-user'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for missing user ID', async () => {
      await expect(authService.getCurrentUser(''))
        .rejects.toThrow(ValidationError);

      await expect(authService.getCurrentUser(''))
        .rejects.toThrow('User ID is required');
    });
  });

  describe('Anonymous Token Generation', () => {
    it('should generate anonymous token with correct structure for new device', async () => {
      // Arrange: Mock no existing user
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }
            }),
            insert: jest.fn().mockResolvedValue({ data: {}, error: null })
          };
        }
        if (table === 'usercurrencybalances') {
          return {
            insert: jest.fn().mockResolvedValue({ data: {}, error: null })
          };
        }
        return {};
      });

      // Mock profile fetch for newly created user
      mockSupabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'mock-uuid-12345',
            device_id: 'test-device-456',
            account_type: 'anonymous',
            vanity_level: 0,
            avg_item_level: 0,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          },
          error: null
        })
      });

      // Act
      const result = await authService.registerDevice({ device_id: 'test-device-456' });

      // Assert token structure
      expect(result.session.access_token).toBe('mock-jwt-token');
      expect(result.session.refresh_token).toBeNull();
      expect(result.session.token_type).toBe('bearer');
      expect(result.session.expires_in).toBe(2592000); // 30 days
      expect(result.session.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));

      // Assert JWT generation was called correctly
      const mockGenerateAnonymousToken = require('../../../src/utils/jwt.js').generateAnonymousToken;
      expect(mockGenerateAnonymousToken).toHaveBeenCalledWith('mock-uuid-12345', 'test-device-456');
    });

    it('should generate anonymous token for returning device', async () => {
      // Arrange: Mock existing user
      const existingUser = {
        id: 'existing-device-user',
        device_id: 'returning-device-789',
        account_type: 'anonymous',
        vanity_level: 3,
        avg_item_level: 1.5,
        created_at: '2024-01-01T00:00:00Z',
        last_login: '2024-01-15T00:00:00Z'
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: existingUser, error: null }),
        update: jest.fn().mockReturnThis()
      });

      // Reset mocks to ensure calls are tracked
      mockProfileRepository.getAllCurrencyBalances.mockResolvedValue({ GOLD: 750, GEMS: 25 });
      mockProfileRepository.updateLastLogin.mockResolvedValue(undefined);

      // Act
      const result = await authService.registerDevice({ device_id: 'returning-device-789' });

      // Assert
      expect(result.user.id).toBe('existing-device-user');
      expect(result.user.account_type).toBe('anonymous');
      expect(result.user.device_id).toBe('returning-device-789');
      expect(result.user.gold).toBe(750);
      expect(result.session.access_token).toBe('mock-jwt-token');
      expect(result.session.refresh_token).toBeNull();
      expect(result.message).toBe('Device login successful');

      // Verify last login was updated
      expect(mockProfileRepository.updateLastLogin).toHaveBeenCalledWith('existing-device-user');
    });
  });
});