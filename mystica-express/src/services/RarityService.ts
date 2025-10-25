import { rarityRepository } from '../repositories/RarityRepository.js';
import type { Database } from '../types/database.types.js';

type RarityDefinition = Database['public']['Tables']['raritydefinitions']['Row'];

export class RarityService {
  async getAllRarities(): Promise<RarityDefinition[]> {
    return rarityRepository.getAllRarities();
  }
}

export const rarityService = new RarityService();