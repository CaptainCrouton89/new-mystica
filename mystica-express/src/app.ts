import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

// Import API routes
import apiRoutes from './routes/index';

/**
 * Express Application Setup
 *
 * Configures middleware stack and route handlers for the New Mystica backend.
 * This replaces the CommonJS app.js with a TypeScript implementation.
 */

const app = express();

// ============================================================================
// Global Middleware Stack
// ============================================================================

// Request logging
app.use(morgan('combined'));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://mystica.app', 'https://www.mystica.app']
    : ['http://localhost:3000', 'http://localhost:8100'], // Allow SwiftUI preview
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check (root endpoint)
app.get('/', (req, res) => {
  res.json({
    name: 'New Mystica API',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      health: '/api/v1/health',
      auth: '/api/v1/auth',
      profile: '/api/v1/profile',
      inventory: '/api/v1/inventory',
      equipment: '/api/v1/equipment',
      materials: '/api/v1/materials',
      items: '/api/v1/items',
      locations: '/api/v1/locations',
      combat: '/api/v1/combat',
      enemies: '/api/v1/enemies'
    }
  });
});

// ============================================================================
// API Routes
// ============================================================================

// All API routes prefixed with /api/v1
app.use('/api/v1', apiRoutes);

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString()
    }
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(error.statusCode || error.status || 500).json({
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      ...(isDevelopment && { stack: error.stack }),
      timestamp: new Date().toISOString()
    }
  });
});

export default app;