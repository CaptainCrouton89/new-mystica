/**
 * Style Repository
 *
 * Manages style definitions for materials and items.
 * Handles database operations for the StyleDefinitions table.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../config/supabase.js';
import { DatabaseError, mapSupabaseError } from '../utils/errors.js';
import type { Database } from '../types/database.types.js';

// Type aliases from database schema
type StyleDefinition = Database['public']['Tables']['styledefinitions']['Row'];
type StyleDefinitionInsert = Database['public']['Tables']['styledefinitions']['Insert'];
type StyleDefinitionUpdate = Database['public']['Tables']['styledefinitions']['Update'];

/**
 * StyleRepository handles style-related database operations
 *
 * @description Provides read-only access to StyleDefinitions table for style system
 * @category Repositories
 * @subcategory Style
 * @see Database['public']['Tables']['styledefinitions']
 *
 * @remarks
 * This repository follows Supabase best practices by using strongly typed database operations.
 * It handles querying style definitions with robust error management.
 */
export class StyleRepository {
  protected client: SupabaseClient;

  constructor(client: SupabaseClient = supabase) {
    this.client = client;
  }

  /**
   * Find all style definitions ordered by spawn rate (desc) then style name (asc)
   */
  async findAll(): Promise<StyleDefinition[]> {
    try {
      const { data, error } = await this.client
        .from('styledefinitions')
        .select('*')
        .order('spawn_rate', { ascending: false })
        .order('display_name', { ascending: true });

      if (error) {
        throw mapSupabaseError(error);
      }

      if (!data) {
        throw new DatabaseError('Failed to fetch style definitions: query returned no data');
      }

      return data;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch style definitions', { originalError: error });
    }
  }

  /**
   * Find style definition by ID
   */
  async findById(styleId: string): Promise<StyleDefinition> {
    try {
      const { data, error } = await this.client
        .from('styledefinitions')
        .select('*')
        .eq('id', styleId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw mapSupabaseError(error);
      }

      if (!data) {
        throw new DatabaseError(`Style definition not found for ID: ${styleId}`);
      }
      return data;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch style definition by ID', {
        styleId,
        originalError: error
      });
    }
  }

  /**
   * Find style definition by display_name
   */
  async findByName(displayName: string): Promise<StyleDefinition | null> {
    try {
      const { data, error } = await this.client
        .from('styledefinitions')
        .select('*')
        .eq('display_name', displayName)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw mapSupabaseError(error);
      }

      if (!data) {
        throw new DatabaseError(`Style definition not found for display name: ${displayName}`);
      }
      return data;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch style definition by display name', {
        displayName,
        originalError: error
      });
    }
  }

  /**
   * Check if style ID exists in the database
   */
  async exists(styleId: string): Promise<boolean> {
    try {
      const { data, error } = await this.client
        .from('styledefinitions')
        .select('id')
        .eq('id', styleId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw mapSupabaseError(error);
      }

      return !!data;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to check style existence', {
        styleId,
        originalError: error
      });
    }
  }
}

export const styleRepository = new StyleRepository();