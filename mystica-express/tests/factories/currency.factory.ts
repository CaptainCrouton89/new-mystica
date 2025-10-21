import type { Database } from '../../src/types/database.types.js';

type UserCurrencyBalance = Database['public']['Tables']['usercurrencybalances']['Row'];
type UserCurrencyBalanceInsert = Database['public']['Tables']['usercurrencybalances']['Insert'];

/**
 * Factory for generating UserCurrencyBalance test data
 */
export class CurrencyFactory {
  /**
   * Create default GOLD balance for user
   */
  static createGoldBalance(userId: string, amount: number = 500, overrides?: Partial<UserCurrencyBalance>): UserCurrencyBalance {
    return {
      user_id: userId,
      currency_code: 'GOLD',
      balance: amount,
      updated_at: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Create GEMS balance for user
   */
  static createGemsBalance(userId: string, amount: number = 0, overrides?: Partial<UserCurrencyBalance>): UserCurrencyBalance {
    return {
      user_id: userId,
      currency_code: 'GEMS',
      balance: amount,
      updated_at: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Create currency balance for database insertion
   */
  static createForInsert(userId: string, currencyCode: 'GOLD' | 'GEMS' = 'GOLD', amount: number = 500, overrides?: Partial<UserCurrencyBalanceInsert>): UserCurrencyBalanceInsert {
    return {
      user_id: userId,
      currency_code: currencyCode,
      balance: amount,
      updated_at: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Create both GOLD and GEMS balances for a user
   */
  static createAllCurrencies(userId: string, goldAmount: number = 500, gemsAmount: number = 0): UserCurrencyBalance[] {
    return [
      this.createGoldBalance(userId, goldAmount),
      this.createGemsBalance(userId, gemsAmount)
    ];
  }
}