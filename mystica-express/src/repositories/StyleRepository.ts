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

// Type alias from database schema
type StyleDefinition = Database['public']['Tables']['styledefinitions']['Row'];

/**
 * StyleRepository handles style-related database operations
 *
 * Provides read-only access to StyleDefinitions table for style system
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
        .order('style_name', { ascending: true });

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
  async findById(styleId: string): Promise<StyleDefinition | null> {
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
   * Find style definition by style_name
   */
  async findByName(styleName: string): Promise<StyleDefinition | null> {
    try {
      const { data, error } = await this.client
        .from('styledefinitions')
        .select('*')
        .eq('style_name', styleName)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw mapSupabaseError(error);
      }

      if (!data) {
        throw new DatabaseError(`Style definition not found for name: ${styleName}`);
      }
      return data;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch style definition by name', {
        styleName,
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