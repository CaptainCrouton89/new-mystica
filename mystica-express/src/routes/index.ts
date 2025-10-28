import { Router } from 'express';

// Import route modules
import authRoutes from './auth';
import profileRoutes from './profile';
import inventoryRoutes from './inventory';
import equipmentRoutes from './equipment';
import materialsRoutes from './materials';
import itemsRoutes from './items';
import locationRoutes from './locations';
import combatRoutes from './combat';
import lootRoutes from './loot';
import enemyRoutes from './enemies';
import loadoutRoutes from './loadouts';
import petRoutes from './pets';
import economyRoutes from './economy';
import styleRoutes from './styles';
import rarityRoutes from './rarities';
import progressionRoutes from './progression';

/**
 * API Routes Index
 *
 * Centralizes all MVP1 route definitions for the New Mystica backend.
 * All routes are prefixed with /api/v1 in the main app configuration.
 *
 * MVP1 Endpoints:
 * - Auth: POST /auth/register, POST /auth/login, POST /auth/logout, POST /auth/refresh, GET /auth/me
 * - Profile: POST /profile/init, GET /profile
 * - Inventory: GET /inventory
 * - Equipment: GET /equipment, POST /equipment/equip, POST /equipment/unequip
 * - Materials: GET /materials/inventory, POST /items/:id/materials/apply, POST /items/:id/materials/replace
 * - Items: GET /items/:id, GET /items/:id/upgrade-cost, POST /items/:id/upgrade
 * - Locations: GET /locations/nearby, GET /locations/:id
 * - Combat: POST /combat/pet-chatter, POST /combat/enemy-chatter
 * - Enemies: GET /enemies/types, GET /enemies/personality-types, GET /enemies/players/combat-history/:location_id
 * - Pets: GET /pets/personalities, PUT /pets/:id/personality
 * - Economy: GET /economy/balances, GET /economy/balance/:currency, POST /economy/affordability, POST /economy/add, POST /economy/deduct
 * - Styles: GET /styles
 * - Rarities: GET /rarities
 * - Progression: GET /progression, POST /progression/level-up, POST /progression/award-xp
 */

const router = Router();

// Register route modules
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/equipment', equipmentRoutes);
router.use('/materials', materialsRoutes);
router.use('/items', itemsRoutes);
router.use('/locations', locationRoutes);
router.use('/combat', combatRoutes);
router.use('/loot', lootRoutes);
router.use('/enemies', enemyRoutes);
router.use('/loadouts', loadoutRoutes);
router.use('/pets', petRoutes);
router.use('/economy', economyRoutes);
router.use('/styles', styleRoutes);
router.use('/rarities', rarityRoutes);
router.use('/progression', progressionRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;