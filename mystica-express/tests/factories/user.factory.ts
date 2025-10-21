// Simple UUID generator for tests (avoids ESM import issues)
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
import type { Database } from '../../src/types/database.types.js';

type User = Database['public']['Tables']['users']['Row'];
type UserInsert = Database['public']['Tables']['users']['Insert'];

/**
 * Factory for generating User test data with flexible overrides
 */
export class UserFactory {
  /**
   * Create anonymous user with device_id
   */
  static createAnonymous(overrides?: Partial<User>): User {
    const deviceId = uuidv4();
    const baseUser: User = {
      id: generateUuid(),
      email: `device_${deviceId}@mystica.local`,
      gold_balance: 100,
      vanity_level: 1,
      avg_item_level: null,
      created_at: new Date().toISOString(),
      last_login: null,
      ...overrides
    };

    return baseUser;
  }

  /**
   * Create email user with email address
   */
  static createEmail(email?: string, overrides?: Partial<User>): User {
    const randomId = Math.random().toString(36).substring(7);
    const userEmail = email || `user_${randomId}@example.com`;

    const baseUser: User = {
      id: generateUuid(),
      email: userEmail,
      gold_balance: 150,
      vanity_level: 1,
      avg_item_level: 5.0,
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
      ...overrides
    };

    return baseUser;
  }

  /**
   * Create user with specific vanity level
   */
  static withVanityLevel(level: number, overrides?: Partial<User>): User {
    return this.createEmail(undefined, {
      vanity_level: level,
      gold_balance: level * 100, // Scale gold with vanity level
      avg_item_level: Math.min(level * 2, 20), // Cap at level 20
      ...overrides
    });
  }

  /**
   * Create user for database insertion (Insert type)
   */
  static createForInsert(overrides?: Partial<UserInsert>): UserInsert {
    const user = this.createEmail();
    return {
      id: user.id,
      email: user.email,
      gold_balance: user.gold_balance,
      vanity_level: user.vanity_level,
      avg_item_level: user.avg_item_level,
      ...overrides
    };
  }

  /**
   * Create multiple users at once
   */
  static createMany(count: number, factory: () => User = () => this.createEmail()): User[] {
    return Array.from({ length: count }, () => factory());
  }
}