import { Router } from 'express';

// Import route modules
import profileRoutes from './profile';
import inventoryRoutes from './inventory';
import equipmentRoutes from './equipment';
import materialsRoutes from './materials';
import itemsRoutes from './items';

/**
 * API Routes Index
 *
 * Centralizes all MVP1 route definitions for the New Mystica backend.
 * All routes are prefixed with /api/v1 in the main app configuration.
 *
 * MVP1 Endpoints:
 * - Profile: POST /profile/init, GET /profile
 * - Inventory: GET /inventory
 * - Equipment: GET /equipment, POST /equipment/equip, POST /equipment/unequip
 * - Materials: GET /materials/inventory, POST /items/:id/materials/apply, POST /items/:id/materials/replace
 * - Items: GET /items/:id, GET /items/:id/upgrade-cost, POST /items/:id/upgrade
 */

const router = Router();

// Register route modules
router.use('/profile', profileRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/equipment', equipmentRoutes);
router.use('/materials', materialsRoutes);
router.use('/items', itemsRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;