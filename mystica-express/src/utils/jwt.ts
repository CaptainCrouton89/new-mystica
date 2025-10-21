import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AnonymousJWTPayload {
  sub: string; // user ID
  device_id: string;
  account_type: 'anonymous';
  iat: number;
  exp: number;
}

/**
 * Generate JWT token for anonymous users (device-based auth)
 * Uses custom signing for longer expiry (30 days) vs Supabase default (1 hour)
 */
export function generateAnonymousToken(userId: string, deviceId: string): {
  access_token: string;
  expires_in: number;
  expires_at: number;
} {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 30 * 24 * 60 * 60; // 30 days in seconds
  const expiresAt = now + expiresIn;

  const payload: AnonymousJWTPayload = {
    sub: userId,
    device_id: deviceId,
    account_type: 'anonymous',
    iat: now,
    exp: expiresAt
  };

  const token = jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256'
  });

  return {
    access_token: token,
    expires_in: expiresIn,
    expires_at: expiresAt
  };
}

/**
 * Verify and decode anonymous JWT token
 * Returns null if token is invalid or expired
 */
export function verifyAnonymousToken(token: string): AnonymousJWTPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256']
    }) as AnonymousJWTPayload;

    // Additional validation
    if (decoded.account_type !== 'anonymous' || !decoded.device_id) {
      return null;
    }

    return decoded;
  } catch (error) {
    // Token invalid, expired, or malformed
    return null;
  }
}