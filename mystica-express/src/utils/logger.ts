import winston from 'winston';
import { env } from '../config/env.js';

/**
 * Custom log format for development
 * Pretty-prints logs with colors and timestamps
 */
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }

    // Add metadata if present
    const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
    if (metaString) {
      log += `\n${metaString}`;
    }

    return log;
  })
);

/**
 * JSON format for production
 * Structured logging for better parsing and monitoring
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info: any) => {
    // Ensure consistent structure
    return JSON.stringify({
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      service: 'new-mystica-express',
      environment: env.NODE_ENV,
      ...(info.stack && { stack: info.stack }),
      ...(info.userId && { userId: info.userId }),
      ...(info.requestId && { requestId: info.requestId }),
      ...(info.meta && { meta: info.meta }),
    });
  })
);

/**
 * Configure transports based on environment
 */
const transports: winston.transport[] = [
  // Console transport (always present)
  new winston.transports.Console({
    format: env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
  }),
];

// Add file transport in production
if (env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: productionFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: productionFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
    })
  );
}

/**
 * Winston logger instance for New Mystica backend
 *
 * Features:
 * - Environment-specific formatting (pretty dev, JSON prod)
 * - Structured logging with consistent metadata
 * - Error stack traces
 * - File rotation in production
 * - User and request tracking support
 *
 * @example
 * ```typescript
 * import { logger } from '@/utils/logger';
 *
 * logger.info('User authenticated', { userId: '123', requestId: 'req-456' });
 * logger.error('Database connection failed', { error: err.message });
 * logger.debug('Processing item application', { itemId: '789', materials: ['wood', 'crystal'] });
 * ```
 */
export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
  // Handle uncaught exceptions and unhandled rejections
  exceptionHandlers: [
    new winston.transports.Console({
      format: env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
    }),
  ],
});

/**
 * Create child logger with context
 * Useful for adding consistent metadata across related operations
 */
export const createContextLogger = (context: Record<string, any>) => {
  return logger.child(context);
};

/**
 * HTTP request logger middleware helper
 * Creates a logger with request-specific context
 */
export const createRequestLogger = (req: any) => {
  return createContextLogger({
    requestId: req.id || req.headers['x-request-id'] || 'unknown',
    method: req.method,
    path: req.path,
    userId: req.user?.id || 'anonymous',
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
  });
};

/**
 * Log database query performance
 */
export const logQuery = (
  operation: string,
  table: string,
  duration: number,
  meta?: Record<string, any>
) => {
  logger.debug('Database query executed', {
    operation,
    table,
    duration: `${duration}ms`,
    ...meta,
  });
};

/**
 * Log external API calls
 */
export const logExternalAPI = (
  service: string,
  endpoint: string,
  duration: number,
  status: number,
  meta?: Record<string, any>
) => {
  const level = status >= 400 ? 'warn' : 'info';
  logger.log(level, 'External API call', {
    service,
    endpoint,
    status,
    duration: `${duration}ms`,
    ...meta,
  });
};

/**
 * Log business logic operations
 */
export const logBusinessEvent = (
  event: string,
  userId: string,
  meta?: Record<string, any>
) => {
  logger.info('Business event', {
    event,
    userId,
    ...meta,
  });
};

// Log startup message
if (env.NODE_ENV === 'development') {
  logger.info('Logger initialized', {
    level: env.LOG_LEVEL,
    environment: env.NODE_ENV,
  });
}