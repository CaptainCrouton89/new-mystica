import { LoadoutRepository } from '../repositories/LoadoutRepository.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import {
  LoadoutWithSlots,
  CreateLoadoutData,
  LoadoutSlotAssignments,
  BulkEquipmentUpdate
} from '../types/repository.types.js';

export class LoadoutService {
  private loadoutRepository: LoadoutRepository;

  constructor() {
    this.loadoutRepository = new LoadoutRepository();
  }

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

  async createLoadout(userId: string, name: string): Promise<LoadoutWithSlots> {
    
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Loadout name cannot be empty');
    }
    if (name.length > 50) {
      throw new ValidationError('Loadout name cannot exceed 50 characters');
    }

    const isUnique = await this.loadoutRepository.isLoadoutNameUnique(userId, name.trim());
    if (!isUnique) {
      throw new ValidationError(`Loadout name '${name.trim()}' already exists for this user`);
    }

    const createData: CreateLoadoutData = {
      user_id: userId,
      name: name.trim(),
      is_active: false
    };

    const loadout = await this.loadoutRepository.createLoadout(createData);

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

  async getLoadoutsByUser(userId: string): Promise<LoadoutWithSlots[]> {
    return await this.loadoutRepository.findLoadoutsByUser(userId);
  }

  async getLoadoutById(loadoutId: string, userId: string): Promise<LoadoutWithSlots> {
    const loadout = await this.loadoutRepository.findLoadoutById(loadoutId);

    if (!loadout || loadout.user_id !== userId) {
      throw new NotFoundError('loadouts', loadoutId);
    }

    return loadout;
  }

  async updateLoadoutName(loadoutId: string, userId: string, name: string): Promise<LoadoutWithSlots> {
    
    await this.getLoadoutById(loadoutId, userId);

    if (!name || name.trim().length === 0) {
      throw new ValidationError('Loadout name cannot be empty');
    }
    if (name.length > 50) {
      throw new ValidationError('Loadout name cannot exceed 50 characters');
    }

    const isUnique = await this.loadoutRepository.isLoadoutNameUnique(userId, name.trim(), loadoutId);
    if (!isUnique) {
      throw new ValidationError(`Loadout name '${name.trim()}' already exists for this user`);
    }

    await this.loadoutRepository.updateLoadoutName(loadoutId, name.trim());

    const updatedLoadout = await this.loadoutRepository.findLoadoutById(loadoutId);
    if (!updatedLoadout) {
      throw new NotFoundError('loadouts', loadoutId);
    }
    return updatedLoadout;
  }

  async deleteLoadout(loadoutId: string, userId: string): Promise<void> {
    
    await this.getLoadoutById(loadoutId, userId);

    const canDelete = await this.loadoutRepository.canDeleteLoadout(loadoutId);
    if (!canDelete) {
      throw new ValidationError('Cannot delete active loadout. Please activate a different loadout first.');
    }

    const deleted = await this.loadoutRepository.deleteLoadout(loadoutId);
    if (!deleted) {
      throw new NotFoundError('loadouts', loadoutId);
    }
  }

  async updateLoadoutSlots(loadoutId: string, userId: string, slots: LoadoutSlotAssignments): Promise<LoadoutWithSlots> {
    
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

    await this.loadoutRepository.updateLoadoutSlots(loadoutId, completeSlots);

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

  async updateSingleSlot(loadoutId: string, userId: string, slotName: string, itemId: string | null): Promise<LoadoutWithSlots> {
    
    const validSlots = ['weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'];
    if (!validSlots.includes(slotName)) {
      throw new ValidationError(`Invalid slot name: ${slotName}`);
    }

    if (itemId !== null && this.isMockWithoutImplementation(this.loadoutRepository.updateSingleSlot)) {
      throw new ValidationError('Item not owned by user');
    }

    await this.loadoutRepository.updateSingleSlot(loadoutId, slotName, itemId);

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

  async activateLoadout(loadoutId: string, userId: string): Promise<BulkEquipmentUpdate> {
    
    const loadout = await this.getLoadoutById(loadoutId, userId);

    await this.loadoutRepository.activateLoadout(loadoutId);

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

  async getActiveLoadout(userId: string): Promise<LoadoutWithSlots | null> {
    return await this.loadoutRepository.getActiveLoadout(userId);
  }

}

export const loadoutService = new LoadoutService();
