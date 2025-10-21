/**
 * Test Factories Index
 *
 * Re-exports all factory classes for easy importing in test files.
 *
 * Usage:
 * ```typescript
 * import { UserFactory, ItemFactory, LocationFactory } from '../factories/index.js';
 *
 * const user = UserFactory.createEmail('test@example.com');
 * const item = ItemFactory.createBase('sword', 5);
 * const location = LocationFactory.createSF('landmark');
 * ```
 */

export * from './user.factory.js';
export * from './item.factory.js';
export * from './location.factory.js';
export * from './combat.factory.js';
export * from './material.factory.js';

// Re-export commonly used types from factories
export type { PlayerItem } from './item.factory.js';
export type { Enemy } from './combat.factory.js';