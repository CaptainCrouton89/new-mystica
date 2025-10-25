import {
  CurrencyOperationResult,
  CurrencyBalances,
  AffordabilityResult,
  TransactionSourceType,
  TransactionSinkType
} from '../types/api.types.js';
import {
  ValidationError,
  DatabaseError,
  InsufficientFundsError
} from '../utils/errors.js';
import { ProfileRepository } from '../repositories/ProfileRepository.js';

export class EconomyService {
  private profileRepository: ProfileRepository;

  private readonly validSourceTypes: TransactionSourceType[] = [
    'combat_victory',
    'daily_quest',
    'achievement',
    'iap',
    'admin',
    'profile_init'
  ];

  private readonly validSinkTypes: TransactionSinkType[] = [
    'item_upgrade',
    'material_replacement',
    'shop_purchase',
    'loadout_slot_unlock'
  ];

  constructor() {
    this.profileRepository = new ProfileRepository();
  }

  async addCurrency(
    userId: string,
    currency: 'GOLD' | 'GEMS',
    amount: number,
    sourceType: TransactionSourceType,
    sourceId?: string,
    metadata?: object
  ): Promise<CurrencyOperationResult> {
    
    if (amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    if (!this.isValidSourceType(sourceType)) {
      throw new ValidationError(`Invalid source type: ${sourceType}`);
    }

    try {
      
      const response = await this.profileRepository.addCurrencyWithLogging(
        userId,
        currency,
        amount,
        sourceType,
        sourceId || null,
        metadata || {}
      );

      if (!response.success) {
        throw new DatabaseError(`Currency addition failed: ${response.message}`);
      }

      return {
        success: true,
        previousBalance: response.data!.previous_balance,
        newBalance: response.data!.new_balance,
        transactionId: response.data!.transaction_id,
        currency,
        amount
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to add ${currency}: ${(error as Error).message}`);
    }
  }

  async deductCurrency(
    userId: string,
    currency: 'GOLD' | 'GEMS',
    amount: number,
    sourceType: TransactionSinkType,
    sourceId?: string,
    metadata?: object
  ): Promise<CurrencyOperationResult> {
    
    if (amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    if (!this.isValidSinkType(sourceType)) {
      throw new ValidationError(`Invalid sink type: ${sourceType}`);
    }

    try {
      
      const response = await this.profileRepository.deductCurrencyWithLogging(
        userId,
        currency,
        amount,
        sourceType,
        sourceId || null,
        metadata || {}
      );

      if (!response.success) {
        if (response.error_code === 'INSUFFICIENT_FUNDS') {
          throw new InsufficientFundsError(
            `Not enough ${currency}. Required: ${amount}, Available: ${this.extractCurrentBalance(response.message || '')}`
          );
        }
        throw new DatabaseError(`Currency deduction failed: ${response.message}`);
      }

      return {
        success: true,
        previousBalance: response.data!.previous_balance,
        newBalance: response.data!.new_balance,
        transactionId: response.data!.transaction_id,
        currency,
        amount: -amount 
      };
    } catch (error) {
      if (error instanceof InsufficientFundsError || error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to deduct ${currency}: ${(error as Error).message}`);
    }
  }

  async getCurrencyBalance(userId: string, currency: 'GOLD' | 'GEMS'): Promise<number> {
    try {
      const balance = await this.profileRepository.getCurrencyBalance(userId, currency);
      if (balance === null || balance === undefined) {
        throw new DatabaseError(`User balance not found for currency ${currency}`);
      }
      return balance;
    } catch (error) {
      throw new DatabaseError(`Failed to get ${currency} balance: ${(error as Error).message}`);
    }
  }

  async getAllBalances(userId: string): Promise<CurrencyBalances> {
    try {
      const balances = await this.profileRepository.getAllCurrencyBalances(userId);
      return {
        GOLD: balances.GOLD || 0,
        GEMS: balances.GEMS || 0
      };
    } catch (error) {
      throw new DatabaseError(`Failed to get currency balances: ${(error as Error).message}`);
    }
  }

  async validateSufficientFunds(
    userId: string,
    currency: 'GOLD' | 'GEMS',
    amount: number
  ): Promise<boolean> {
    const currentBalance = await this.getCurrencyBalance(userId, currency);
    return currentBalance >= amount;
  }

  async getAffordabilityCheck(
    userId: string,
    currency: 'GOLD' | 'GEMS',
    amount: number
  ): Promise<AffordabilityResult> {
    const currentBalance = await this.getCurrencyBalance(userId, currency);
    const canAfford = currentBalance >= amount;

    return {
      canAfford,
      currentBalance,
      requiredAmount: amount,
      shortfall: canAfford ? 0 : amount - currentBalance
    };
  }

  private isValidSourceType(sourceType: string): sourceType is TransactionSourceType {
    return this.validSourceTypes.includes(sourceType as TransactionSourceType);
  }

  private isValidSinkType(sinkType: string): sinkType is TransactionSinkType {
    return this.validSinkTypes.includes(sinkType as TransactionSinkType);
  }

  private extractCurrentBalance(message: string): number {
    const match = message.match(/have:\s*(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}

export const economyService = new EconomyService();