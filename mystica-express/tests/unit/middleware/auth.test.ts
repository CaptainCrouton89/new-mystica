/**
 * Unit Tests: Auth Middleware
 *
 * Tests JWT validation logic and error handling
 */

import { Request, Response, NextFunction } from 'express';

// Mock JWT utils BEFORE importing middleware
const mockVerifyAnonymousToken = jest.fn();
jest.mock('../../../src/utils/jwt.js', () => ({
  verifyAnonymousToken: mockVerifyAnonymousToken
}));

// Mock Supabase BEFORE importing middleware
const mockGetClaims = jest.fn();
jest.mock('@supabase/supabase-js', () => {
  return {
    createClient: jest.fn(() => ({
      auth: {
        getClaims: mockGetClaims,
      }
    }))
  };
});

import { authenticate, optionalAuthenticate } from '../../../src/middleware/auth';

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    // Reset mocks
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();

    // Reset mock implementations
    mockGetClaims.mockReset();
    mockVerifyAnonymousToken.mockReset();
  });

  describe('authenticate middleware', () => {
    it('should reject requests without Authorization header', async () => {
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'missing_token',
          message: expect.stringContaining('Missing or invalid authorization header')
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid Authorization format', async () => {
      mockRequest.headers = { authorization: 'InvalidFormat token123' };

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'missing_token',
          message: expect.stringContaining('Expected format: Bearer')
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject requests with empty token', async () => {
      mockRequest.headers = { authorization: 'Bearer ' };

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'empty_token',
          message: 'JWT token is empty'
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid JWT token', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      mockVerifyAnonymousToken.mockReturnValue(null); // Not anonymous
      mockGetClaims.mockResolvedValue({
        data: null,
        error: { message: 'Invalid token signature' }
      });

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'invalid_token',
          message: 'Invalid or expired JWT token',
          details: 'Invalid token signature'
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject expired Supabase tokens', async () => {
      const expiredTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      mockRequest.headers = { authorization: 'Bearer expired-token' };
      mockVerifyAnonymousToken.mockReturnValue(null); // Not anonymous
      mockGetClaims.mockResolvedValue({
        data: {
          claims: {
            sub: 'user-123',
            email: 'test@example.com',
            exp: expiredTime
          }
        },
        error: null
      });

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'token_expired',
          message: 'Token has expired. Please refresh your session.'
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should accept valid anonymous token and attach user to request', async () => {
      mockRequest.headers = { authorization: 'Bearer anon-token' };
      mockVerifyAnonymousToken.mockReturnValue({
        sub: 'anon-123',
        device_id: 'device-456',
        account_type: 'anonymous',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      });

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as any).user).toEqual({
        id: 'anon-123',
        email: null,
        device_id: 'device-456',
        account_type: 'anonymous'
      });
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockGetClaims).not.toHaveBeenCalled();
    });

    it('should accept valid Supabase JWT token and attach user to request', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      mockRequest.headers = { authorization: 'Bearer supabase-token' };
      mockVerifyAnonymousToken.mockReturnValue(null); // Not anonymous
      mockGetClaims.mockResolvedValue({
        data: {
          claims: {
            sub: 'user-123',
            email: 'test@example.com',
            exp: futureTime,
            role: 'authenticated'
          }
        },
        error: null
      });

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as any).user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        device_id: null,
        account_type: 'email'
      });
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle getClaims errors gracefully', async () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      mockVerifyAnonymousToken.mockReturnValue(null); // Not anonymous
      mockGetClaims.mockRejectedValue(new Error('Network error'));

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'auth_error',
          message: 'Failed to authenticate request',
          details: 'Network error'
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should handle anonymous token verification errors gracefully', async () => {
      mockRequest.headers = { authorization: 'Bearer malformed-token' };
      mockVerifyAnonymousToken.mockImplementation(() => {
        throw new Error('JWT malformed');
      });

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'auth_error',
          message: 'Failed to authenticate request',
          details: 'JWT malformed'
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuthenticate middleware', () => {
    it('should allow requests without Authorization header', async () => {
      await optionalAuthenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as any).user).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow requests with invalid token format', async () => {
      mockRequest.headers = { authorization: 'InvalidFormat token' };

      await optionalAuthenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as any).user).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow requests with expired Supabase token', async () => {
      const expiredTime = Math.floor(Date.now() / 1000) - 3600;
      mockRequest.headers = { authorization: 'Bearer expired-token' };
      mockVerifyAnonymousToken.mockReturnValue(null); // Not anonymous
      mockGetClaims.mockResolvedValue({
        data: {
          claims: {
            sub: 'user-123',
            email: 'test@example.com',
            exp: expiredTime
          }
        },
        error: null
      });

      await optionalAuthenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as any).user).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should attach user for valid anonymous token', async () => {
      mockRequest.headers = { authorization: 'Bearer anon-token' };
      mockVerifyAnonymousToken.mockReturnValue({
        sub: 'anon-123',
        device_id: 'device-456',
        account_type: 'anonymous',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      });

      await optionalAuthenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as any).user).toEqual({
        id: 'anon-123',
        email: null,
        device_id: 'device-456',
        account_type: 'anonymous'
      });
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should attach user for valid Supabase token', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      mockRequest.headers = { authorization: 'Bearer supabase-token' };
      mockVerifyAnonymousToken.mockReturnValue(null); // Not anonymous
      mockGetClaims.mockResolvedValue({
        data: {
          claims: {
            sub: 'user-123',
            email: 'test@example.com',
            exp: futureTime
          }
        },
        error: null
      });

      await optionalAuthenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as any).user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        device_id: null,
        account_type: 'email'
      });
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle Supabase errors gracefully without failing request', async () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      mockVerifyAnonymousToken.mockReturnValue(null); // Not anonymous
      mockGetClaims.mockRejectedValue(new Error('Network error'));

      await optionalAuthenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as any).user).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle anonymous token errors gracefully without failing request', async () => {
      mockRequest.headers = { authorization: 'Bearer malformed-token' };
      mockVerifyAnonymousToken.mockImplementation(() => {
        throw new Error('JWT malformed');
      });

      await optionalAuthenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as any).user).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});
