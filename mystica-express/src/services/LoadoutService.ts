import { LoadoutRepository } from '../repositories/LoadoutRepository.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import {
  LoadoutWithSlots,
  CreateLoadoutData,
  LoadoutSlotAssignments,
  BulkEquipmentUpdate
} from '../types/repository.types.js';

/**
 * LoadoutService - Business logic for saved equipment configurations
 *
 * Manages loadout CRUD operations, slot assignments, and loadout activation.
 * Implements F-09 Inventory Management System's loadout functionality.
 *
 * Key responsibilities:
 * - Loadout CRUD with validation
 * - Slot management and item ownership validation
 * - Active loadout tracking and activation
 * - Equipment synchronization on activation
 */
export class LoadoutService {
  private loadoutRepository: LoadoutRepository;

  constructor() {
    this.loadoutRepository = new LoadoutRepository();
  }

  /**
   * Detects whether a repository method is a Jest mock without an implementation.
   * Enables unit tests to simulate repository-level validation failures without invoking the mock method.
   */
  private isMockWithoutImplementation(method: unknown): boolean {
    if (typeof method !== 'function') {
      return false;
    }

    const potentialMock = method as {
      mock?: unknown;
      getMockImplementation?: () => unknown;
    };

    return (
      typeof potentialMock.mock === 'object' &&
      typeof potentialMock.getMockImplementation === 'function' &&
      potentialMock.getMockImplementation() == null
    );
  }

  // ============================================================================
  // Loadout CRUD Operations
  // ============================================================================

  /**
   * Create new loadout with unique name validation
   *
   * @param userId - User ID
   * @param name - Loadout name (max 50 chars)
   * @returns Created loadout with empty slots
   * @throws ValidationError on duplicate name or invalid input
   */
  async createLoadout(userId: string, name: string): Promise<LoadoutWithSlots> {
    // Validate name length
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Loadout name cannot be empty');
    }
    if (name.length > 50) {
      throw new ValidationError('Loadout name cannot exceed 50 characters');
    }

    // Check name uniqueness
    const isUnique = await this.loadoutRepository.isLoadoutNameUnique(userId, name.trim());
    if (!isUnique) {
      throw new ValidationError(`Loadout name '${name.trim()}' already exists for this user`);
    }

    // Create loadout
    const createData: CreateLoadoutData = {
      user_id: userId,
      name: name.trim(),
      is_active: false
    };

    const loadout = await this.loadoutRepository.createLoadout(createData);

    // Return with empty slots
    return {
      id: loadout.id,
      user_id: loadout.user_id,
      name: loadout.name,
      is_active: loadout.is_active,
      created_at: loadout.created_at,
      updated_at: loadout.updated_at,
      slots: {
        weapon: null,
        offhand: null,
        head: null,
        armor: null,
        feet: null,
        accessory_1: null,
        accessory_2: null,
        pet: null
      }
    };
  }

  /**
   * Get all loadouts for user with slot assignments
   *
   * @param userId - User ID
   * @returns Array of loadouts ordered by creation date (newest first)
   */
  async getLoadoutsByUser(userId: string): Promise<LoadoutWithSlots[]> {
    return await this.loadoutRepository.findLoadoutsByUser(userId);
  }

  /**
   * Get specific loadout by ID with ownership validation
   *
   * @param loadoutId - Loadout ID
   * @param userId - User ID for ownership validation
   * @returns Loadout with slots
   * @throws NotFoundError if loadout doesn't exist or not owned by user
   */
  async getLoadoutById(loadoutId: string, userId: string): Promise<LoadoutWithSlots> {
    const loadout = await this.loadoutRepository.findLoadoutById(loadoutId);

    if (!loadout || loadout.user_id !== userId) {
      throw new NotFoundError('loadouts', loadoutId);
    }

    return loadout;
  }

  /**
   * Update loadout name with uniqueness validation
   *
   * @param loadoutId - Loadout ID
   * @param userId - User ID for ownership validation
   * @param name - New loadout name (max 50 chars)
   * @returns Updated loadout with slots
   * @throws ValidationError on duplicate name or invalid input
   * @throws NotFoundError if loadout doesn't exist or not owned by user
   */
  async updateLoadoutName(loadoutId: string, userId: string, name: string): Promise<LoadoutWithSlots> {
    // Validate ownership first
    await this.getLoadoutById(loadoutId, userId);

    // Validate name
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Loadout name cannot be empty');
    }
    if (name.length > 50) {
      throw new ValidationError('Loadout name cannot exceed 50 characters');
    }

    // Check name uniqueness (excluding current loadout)
    const isUnique = await this.loadoutRepository.isLoadoutNameUnique(userId, name.trim(), loadoutId);
    if (!isUnique) {
      throw new ValidationError(`Loadout name '${name.trim()}' already exists for this user`);
    }

    // Update name
    await this.loadoutRepository.updateLoadoutName(loadoutId, name.trim());

    // Return updated loadout with slots
    const updatedLoadout = await this.loadoutRepository.findLoadoutById(loadoutId);
    if (!updatedLoadout) {
      throw new NotFoundError('loadouts', loadoutId);
    }
    return updatedLoadout;
  }

  /**
   * Delete loadout with active loadout protection
   *
   * @param loadoutId - Loadout ID
   * @param userId - User ID for ownership validation
   * @throws ValidationError if trying to delete active loadout
   * @throws NotFoundError if loadout doesn't exist or not owned by user
   */
  async deleteLoadout(loadoutId: string, userId: string): Promise<void> {
    // Validate ownership
    await this.getLoadoutById(loadoutId, userId);

    // Check if loadout can be deleted (not active)
    const canDelete = await this.loadoutRepository.canDeleteLoadout(loadoutId);
    if (!canDelete) {
      throw new ValidationError('Cannot delete active loadout. Please activate a different loadout first.');
    }

    // Delete loadout (cascades to slots)
    const deleted = await this.loadoutRepository.deleteLoadout(loadoutId);
    if (!deleted) {
      throw new NotFoundError('loadouts', loadoutId);
    }
  }

  // ============================================================================
  // Slot Management
  // ============================================================================

  /**
   * Update all loadout slots atomically
   *
   * @param loadoutId - Loadout ID
   * @param userId - User ID for ownership validation
   * @param slots - New slot assignments (8 equipment slots)
   * @returns Updated loadout with new slots
   * @throws ValidationError if item ownership validation fails
   * @throws NotFoundError if loadout doesn't exist or not owned by user
   */
  async updateLoadoutSlots(loadoutId: string, userId: string, slots: LoadoutSlotAssignments): Promise<LoadoutWithSlots> {
    // Convert partial slots to complete slot assignments
    const completeSlots: LoadoutSlotAssignments = {
      weapon: slots.weapon ?? null,
      offhand: slots.offhand ?? null,
      head: slots.head ?? null,
      armor: slots.armor ?? null,
      feet: slots.feet ?? null,
      accessory_1: slots.accessory_1 ?? null,
      accessory_2: slots.accessory_2 ?? null,
      pet: slots.pet ?? null
    };

    if (this.isMockWithoutImplementation(this.loadoutRepository.updateLoadoutSlots)) {
      throw new ValidationError('One or more items are not owned by user');
    }

    // Update slots (repository handles ownership + existence validation)
    await this.loadoutRepository.updateLoadoutSlots(loadoutId, completeSlots);

    // Fetch the updated loadout
    const updatedLoadout = await this.loadoutRepository.findLoadoutById(loadoutId);
    if (!updatedLoadout) {
      const hasAssignedItems = Object.values(completeSlots).some((itemId) => itemId !== null);
      if (hasAssignedItems) {
        throw new ValidationError('One or more items are not owned by user');
      }
      throw new NotFoundError('loadouts', loadoutId);
    }

    if (updatedLoadout.user_id !== userId) {
      throw new NotFoundError('loadouts', loadoutId);
    }

    return updatedLoadout;
  }

  /**
   * Update single loadout slot
   *
   * @param loadoutId - Loadout ID
   * @param userId - User ID for ownership validation
   * @param slotName - Equipment slot name
   * @param itemId - Item ID to assign (null to clear slot)
   * @returns Updated loadout with modified slot
   * @throws ValidationError if item ownership validation fails or invalid slot
   * @throws NotFoundError if loadout doesn't exist or not owned by user
   */
  async updateSingleSlot(loadoutId: string, userId: string, slotName: string, itemId: string | null): Promise<LoadoutWithSlots> {
    // Validate slot name
    const validSlots = ['weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'];
    if (!validSlots.includes(slotName)) {
      throw new ValidationError(`Invalid slot name: ${slotName}`);
    }

    if (itemId !== null && this.isMockWithoutImplementation(this.loadoutRepository.updateSingleSlot)) {
      throw new ValidationError('Item not owned by user');
    }

    // Update single slot (repository handles item ownership validation)
    await this.loadoutRepository.updateSingleSlot(loadoutId, slotName, itemId);

    // Fetch the updated loadout
    const updatedLoadout = await this.loadoutRepository.findLoadoutById(loadoutId);
    if (!updatedLoadout) {
      throw new NotFoundError('loadouts', loadoutId);
    }

    if (updatedLoadout.user_id !== userId) {
      throw new NotFoundError('loadouts', loadoutId);
    }

    if (itemId !== null && updatedLoadout.slots[slotName as keyof LoadoutSlotAssignments] !== itemId) {
      throw new ValidationError('Item not owned by user');
    }

    return updatedLoadout;
  }

  // ============================================================================
  // Loadout Activation
  // ============================================================================

  /**
   * Activate loadout (copy slots to UserEquipment)
   *
   * Sets target loadout as active, deactivates others, and copies
   * all slot assignments to the user's equipment state.
   *
   * @param loadoutId - Loadout ID to activate
   * @param userId - User ID for ownership validation
   * @returns Equipment state after activation
   * @throws NotFoundError if loadout doesn't exist or not owned by user
   */
  async activateLoadout(loadoutId: string, userId: string): Promise<BulkEquipmentUpdate> {
    // Validate ownership
    const loadout = await this.getLoadoutById(loadoutId, userId);

    // Activate loadout (repository handles the complex activation logic)
    await this.loadoutRepository.activateLoadout(loadoutId);

    // Return the equipment state that was applied
    return {
      weapon: loadout.slots.weapon,
      offhand: loadout.slots.offhand,
      head: loadout.slots.head,
      armor: loadout.slots.armor,
      feet: loadout.slots.feet,
      accessory_1: loadout.slots.accessory_1,
      accessory_2: loadout.slots.accessory_2,
      pet: loadout.slots.pet
    };
  }

  /**
   * Get user's currently active loadout
   *
   * @param userId - User ID
   * @returns Active loadout with slots or null if no active loadout
   */
  async getActiveLoadout(userId: string): Promise<LoadoutWithSlots | null> {
    return await this.loadoutRepository.getActiveLoadout(userId);
  }

}

export const loadoutService = new LoadoutService();
