import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { supabase as supabaseAdmin } from '../config/supabase.js';
import { ProfileRepository } from '../repositories/ProfileRepository.js';
import { EquipmentRepository } from '../repositories/EquipmentRepository.js';
import { generateAnonymousToken } from '../utils/jwt.js';
import { v4 as uuidv4 } from 'uuid';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  BusinessLogicError,
  mapSupabaseError
} from '../utils/errors.js';
import { UserProfile } from '../types/api.types.js';

export interface DeviceRegistrationRequest {
  device_id: string;
}

export interface EmailRegistrationRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string | null;
  expires_in: number;
  expires_at?: number;
  token_type: 'bearer';
}

export interface DeviceAuthResponse {
  user: UserProfile;
  session: AuthSession;
  message: string;
}

export interface EmailAuthResponse {
  user: {
    id: string;
    email?: string | null;
    created_at?: string;
  } | null;
  session: {
    access_token: string;
    expires_in: number;
    token_type: string;
    refresh_token?: string | null;
  } | null;
  message?: string;
}

const supabaseAuth = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);
export class AuthService {
  private profileRepository: ProfileRepository;
  private equipmentRepository: EquipmentRepository;

  constructor() {
    this.profileRepository = new ProfileRepository();
    this.equipmentRepository = new EquipmentRepository();
  }

  async registerDevice(request: DeviceRegistrationRequest): Promise<DeviceAuthResponse> {
    try {
      const { device_id } = request;

      if (!device_id || typeof device_id !== 'string') {
        throw new ValidationError('Device ID is required and must be a string');
      }

      const { data: existingUser, error: lookupError } = await supabaseAdmin
        .from('users')
        .select('id, device_id, account_type, created_at, last_login, vanity_level, avg_item_level')
        .eq('device_id', device_id)
        .eq('account_type', 'anonymous')
        .single();

      if (lookupError && lookupError.code !== 'PGRST116') { 
        throw mapSupabaseError(lookupError);
      }

      let userId: string;
      let isNewUser = false;
      let userProfile: UserProfile;

      if (existingUser) {

        userId = existingUser.id;
        await this.profileRepository.updateLastLogin(userId);
        await this.equipmentRepository.initializeUserSlots(userId);

        const balances = await this.profileRepository.getAllCurrencyBalances(userId);
        userProfile = {
          id: existingUser.id,
          email: null, 
          device_id: existingUser.device_id,
          account_type: 'anonymous',
          username: null, 
          vanity_level: existingUser.vanity_level,
          avg_item_level: existingUser.avg_item_level || 0,
          gold: balances.GOLD,
          gems: balances.GEMS,
          total_stats: {
            atkPower: 0,
            atkAccuracy: 0,
            defPower: 0,
            defAccuracy: 0
          },
          level: 1,
          xp: 0,
          created_at: existingUser.created_at,
          last_login: existingUser.last_login || existingUser.created_at
        };
      } else {
        
        userId = uuidv4();
        isNewUser = true;

        const { error: insertError } = await supabaseAdmin
          .from('users')
          .insert({
            id: userId,
            device_id,
            account_type: 'anonymous',
            is_anonymous: true,
            email: null,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
            vanity_level: 0,
            avg_item_level: 0
          });

        if (insertError) {
          
          if (insertError.code === '23505' && insertError.message.includes('device_id')) {
            
            const { data: raceUser, error: raceError } = await supabaseAdmin
              .from('users')
              .select('id, device_id, account_type, created_at, last_login, vanity_level, avg_item_level')
              .eq('device_id', device_id)
              .eq('account_type', 'anonymous')
              .single();

            if (raceError || !raceUser) {
              throw new BusinessLogicError('Failed to resolve concurrent device registration');
            }

            userId = raceUser.id;
            isNewUser = false;

            await this.ensureCurrencyBalance(userId);
            await this.equipmentRepository.initializeUserSlots(userId);
            const balances = await this.profileRepository.getAllCurrencyBalances(userId);

            userProfile = {
              id: raceUser.id,
              email: null,
              device_id: raceUser.device_id,
              account_type: 'anonymous',
              username: null,
              vanity_level: raceUser.vanity_level,
              avg_item_level: raceUser.avg_item_level || 0,
              gold: balances.GOLD,
              gems: balances.GEMS,
              total_stats: {
                atkPower: 0,
                atkAccuracy: 0,
                defPower: 0,
                defAccuracy: 0
              },
              level: 1,
              xp: 0,
              created_at: raceUser.created_at,
              last_login: raceUser.last_login || raceUser.created_at
            };
          } else {
            throw mapSupabaseError(insertError);
          }
        } else {

          await this.initializeCurrencyBalance(userId);
          await this.equipmentRepository.initializeUserSlots(userId);

          userProfile = {
            id: userId,
            email: null,
            device_id: device_id,
            account_type: 'anonymous',
            username: null,
            vanity_level: 0,
            avg_item_level: 0,
            gold: 500,
            gems: 0,
            total_stats: {
              atkPower: 0,
              atkAccuracy: 0,
              defPower: 0,
              defAccuracy: 0
            },
            level: 1,
            xp: 0,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          };
        }
      }

      const tokenData = generateAnonymousToken(userId, device_id);

      const session: AuthSession = {
        access_token: tokenData.access_token,
        refresh_token: null, 
        expires_in: tokenData.expires_in,
        expires_at: tokenData.expires_at,
        token_type: 'bearer'
      };

      return {
        user: userProfile,
        session,
        message: isNewUser ? 'Device registered successfully' : 'Device login successful'
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof BusinessLogicError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  async register(request: EmailRegistrationRequest): Promise<EmailAuthResponse> {
    try {
      const { email, password } = request;

      if (!email || !password) {
        throw new ValidationError('Email and password are required');
      }

      if (password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters long');
      }

      const { data, error } = await supabaseAuth.auth.signUp({
        email,
        password
      });

      if (error) {
        
        if (error.message.includes('already registered')) {
          throw new ConflictError('Email already registered. Please login or reset your password.');
        }
        throw mapSupabaseError(error);
      }

      if (data.user) {
        await this.createEmailUserProfile(data.user.id, data.user.email!);
      }

      return {
        user: data.user,
        session: data.session,
        message: 'Registration successful. Please check your email for verification link.'
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  async login(request: LoginRequest): Promise<EmailAuthResponse> {
    try {
      const { email, password } = request;

      if (!email || !password) {
        throw new ValidationError('Email and password are required');
      }

      const { data, error } = await supabaseAuth.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        
        throw new ValidationError('Invalid email or password');
      }

      if (data.user) {
        await this.profileRepository.updateLastLogin(data.user.id);
      }

      return {
        user: data.user,
        session: data.session
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  async logout(accessToken: string): Promise<void> {
    try {
      if (!accessToken) {
        throw new ValidationError('Access token is required');
      }

      const { error } = await supabaseAuth.auth.admin.signOut(accessToken);

      if (error) {
        
        console.warn('Logout error (non-critical):', error);
      }
    } catch (error) {
      
      console.warn('Logout error (non-critical):', error);
    }
  }

  async refresh(request: RefreshTokenRequest): Promise<{ session: any }> {
    try {
      const { refresh_token } = request;

      if (!refresh_token) {
        throw new ValidationError('Refresh token is required');
      }

      const { data, error } = await supabaseAuth.auth.refreshSession({
        refresh_token
      });

      if (error) {
        throw new ValidationError('Invalid or expired refresh token');
      }

      return {
        session: data.session
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  async resetPassword(request: ResetPasswordRequest): Promise<{ message: string }> {
    try {
      const { email } = request;

      if (!email) {
        throw new ValidationError('Email is required');
      }

      const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
        redirectTo: `${env.SUPABASE_URL}/auth/v1/verify`
      });

      if (error) {
        console.warn('Password reset error (suppressed for security):', error);
        
      }

      return {
        message: 'If an account with that email exists, a password reset link has been sent.'
      };
    } catch (error) {
      
      return {
        message: 'If an account with that email exists, a password reset link has been sent.'
      };
    }
  }

  async resendVerification(request: ResendVerificationRequest): Promise<{ message: string }> {
    try {
      const { email } = request;

      if (!email) {
        throw new ValidationError('Email is required');
      }

      const { error } = await supabaseAuth.auth.resend({
        type: 'signup',
        email
      });

      if (error) {
        console.warn('Resend verification error (suppressed for security):', error);
        
      }

      return {
        message: 'If an account with that email exists, a verification link has been sent.'
      };
    } catch (error) {
      
      return {
        message: 'If an account with that email exists, a verification link has been sent.'
      };
    }
  }

  async getCurrentUser(userId: string): Promise<{ user: UserProfile }> {
    try {
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const userProfile = await this.profileRepository.findUserById(userId);

      if (!userProfile) {
        throw new NotFoundError('User profile not found');
      }

      const balances = await this.profileRepository.getAllCurrencyBalances(userId);

      const profile: UserProfile = {
        id: userProfile.id,
        email: userProfile.email,
        device_id: userProfile.device_id,
        account_type: userProfile.email ? 'email' : 'anonymous',
        username: null,
        vanity_level: userProfile.vanity_level,
        avg_item_level: userProfile.avg_item_level || 0,
        gold: balances.GOLD,
        gems: balances.GEMS,
        total_stats: {
          atkPower: 0,
          atkAccuracy: 0,
          defPower: 0,
          defAccuracy: 0
        },
        level: 1,
        xp: 0,
        created_at: userProfile.created_at,
        last_login: userProfile.last_login || userProfile.created_at
      };

      return { user: profile };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Delete a user account and all associated data
   *
   * POST /auth/delete-account
   * Headers: Authorization: Bearer <access_token>
   *
   * Response: { message: 'Account deleted successfully' }
   */
  async deleteAccount(userId: string): Promise<{ message: string }> {
    try {
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      // Verify user exists before deletion
      const userProfile = await this.profileRepository.findUserById(userId);
      if (!userProfile) {
        throw new NotFoundError('User not found');
      }

      // Delete user from database (cascading deletes handle all related data)
      const { error: deleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);

      if (deleteError) {
        throw mapSupabaseError(deleteError);
      }

      return { message: 'Account deleted successfully' };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  private async initializeCurrencyBalance(userId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('usercurrencybalances')
        .insert({
          user_id: userId,
          currency_code: 'GOLD',
          balance: 500,
          updated_at: new Date().toISOString()
        });

      if (error && error.code !== '23505') { 
        console.error('Failed to initialize user currency balance:', error);
        
      }
    } catch (error) {
      console.error('Currency initialization error:', error);
      
    }
  }

  private async ensureCurrencyBalance(userId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('usercurrencybalances')
        .upsert({
          user_id: userId,
          currency_code: 'GOLD',
          balance: 500,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,currency_code',
          ignoreDuplicates: true
        });

      if (error) {
        console.error('Failed to ensure currency balance:', error);
      }
    } catch (error) {
      console.error('Currency ensure error:', error);
      
    }
  }

  private async createEmailUserProfile(userId: string, email: string): Promise<void> {
    try {
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          email: email,
          account_type: 'email',
          is_anonymous: false,
          device_id: null,
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
          vanity_level: 0,
          avg_item_level: 0
        });

      if (profileError && profileError.code !== '23505') {
        console.error('Failed to create user profile:', profileError);
      } else if (!profileError || profileError.code === '23505') {

        await this.initializeCurrencyBalance(userId);
        await this.equipmentRepository.initializeUserSlots(userId);
      }
    } catch (error) {
      console.error('Email user profile creation error:', error);
      
    }
  }
}

export const authService = new AuthService();