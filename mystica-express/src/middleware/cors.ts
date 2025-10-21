import cors from 'cors';
import { CorsOptions } from 'cors';

/**
 * CORS Configuration for New Mystica Express API
 *
 * Configures Cross-Origin Resource Sharing (CORS) to allow requests from
 * authorized frontend origins while maintaining security best practices.
 */

/**
 * Get allowed origins from environment variables
 * Falls back to localhost for development if not specified
 */
const getAllowedOrigins = (): string[] => {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS;

  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim());
  }

  // Default development origins
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ];
};

/**
 * CORS configuration options
 */
const corsOptions: CorsOptions = {
  // Allow credentials (cookies, authorization headers, etc.)
  credentials: true,

  // Dynamic origin validation
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if the origin is in the whitelist
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development, be more permissive
    if (process.env.NODE_ENV === 'development') {
      // Allow localhost with any port for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }

    // Reject origin
    const error = new Error(`Origin ${origin} not allowed by CORS policy`);
    callback(error, false);
  },

  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],

  // Allowed headers
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-API-Version'
  ],

  // Headers that clients are allowed to read
  exposedHeaders: [
    'X-API-Version',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],

  // Preflight cache duration (24 hours)
  maxAge: 86400,

  // Handle preflight requests for complex CORS scenarios
  preflightContinue: false,

  // Pass the CORS preflight response to the next handler
  optionsSuccessStatus: 204
};

/**
 * Production CORS configuration with stricter security
 */
const productionCorsOptions: CorsOptions = {
  ...corsOptions,
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();

    // In production, be strict about origins
    if (!origin || !allowedOrigins.includes(origin)) {
      const error = new Error(`Origin ${origin || 'unknown'} not allowed by CORS policy`);
      return callback(error, false);
    }

    callback(null, true);
  }
};

/**
 * CORS middleware configured for the application environment
 */
export const corsMiddleware = cors(
  process.env.NODE_ENV === 'production' ? productionCorsOptions : corsOptions
);

/**
 * Strict CORS middleware for sensitive endpoints
 * Use this for authentication, payment, or other security-critical routes
 */
export const strictCorsMiddleware = cors({
  ...productionCorsOptions,
  // More restrictive settings for sensitive endpoints
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // No OPTIONS or PATCH
  allowedHeaders: [
    'Content-Type',
    'Authorization'
  ],
  exposedHeaders: [], // No exposed headers for sensitive endpoints
  maxAge: 0 // No caching of preflight requests
});

/**
 * Development-only CORS middleware that allows all origins
 * WARNING: Only use this for development and testing
 */
export const devCorsMiddleware = cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: '*',
  exposedHeaders: '*'
});

/**
 * Custom CORS middleware factory for specific route configurations
 *
 * @param options Custom CORS options
 * @returns Configured CORS middleware
 *
 * @example
 * ```typescript
 * // Custom CORS for API versioning
 * const apiV1Cors = createCustomCors({
 *   origin: ['https://app.mystica.com'],
 *   methods: ['GET', 'POST'],
 *   allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Version']
 * });
 *
 * router.use('/api/v1', apiV1Cors);
 * ```
 */
export const createCustomCors = (customOptions: Partial<CorsOptions>) => {
  return cors({
    ...corsOptions,
    ...customOptions
  });
};