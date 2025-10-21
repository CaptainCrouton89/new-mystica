/**
 * Base repository class with common CRUD operations
 *
 * All domain-specific repositories should extend this class to inherit
 * common database operations and error handling patterns.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../config/supabase.js';
import { DatabaseError, NotFoundError, mapSupabaseError } from '../utils/errors.js';
import { QueryFilter, PaginationParams, SortParams } from '../types/repository.types.js';
import { Database } from '../types/database.types.js';

/**
 * Base repository with generic CRUD operations
 *
 * @template T - The entity type this repository manages
 */
export abstract class BaseRepository<T> {
  protected client: SupabaseClient;
  protected tableName: string;

  constructor(tableName: string, client: any = supabase) {
    this.tableName = tableName;
    this.client = client;
  }

  /**
   * Find entity by ID
   *
   * @param id - Entity ID
   * @returns Entity data or null if not found
   * @throws DatabaseError on query failure
   */
  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      // PGRST116 = no rows returned
      if (error.code === 'PGRST116') {
        return null;
      }
      throw mapSupabaseError(error);
    }

    return data as T;
  }

  /**
   * Find entities matching filter criteria
   *
   * @param filters - Key-value pairs for filtering
   * @param options - Pagination and sorting options
   * @returns Array of matching entities
   * @throws DatabaseError on query failure
   */
  async findMany(
    filters: QueryFilter = {},
    options?: { pagination?: PaginationParams; sort?: SortParams }
  ): Promise<T[]> {
    let query = this.client.from(this.tableName).select('*');

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    // Apply sorting
    if (options?.sort) {
      query = query.order(options.sort.orderBy, { ascending: options.sort.ascending ?? true });
    }

    // Apply pagination
    if (options?.pagination) {
      const { limit, offset } = options.pagination;
      if (limit) query = query.limit(limit);
      if (offset) query = query.range(offset, offset + (limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []) as T[];
  }

  /**
   * Find first entity matching filter criteria
   *
   * @param filters - Key-value pairs for filtering
   * @returns First matching entity or null
   * @throws DatabaseError on query failure
   */
  async findOne(filters: QueryFilter): Promise<T | null> {
    let query = this.client.from(this.tableName).select('*');

    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw mapSupabaseError(error);
    }

    return data as T;
  }

  /**
   * Create new entity
   *
   * @param data - Entity data to insert
   * @returns Created entity with generated fields
   * @throws DatabaseError on insert failure
   */
  async create(data: Partial<T>): Promise<T> {
    const { data: created, error } = await this.client
      .from(this.tableName)
      .insert(data as any)
      .select()
      .single();

    if (error) {
      throw mapSupabaseError(error);
    }

    return created as T;
  }

  /**
   * Update entity by ID
   *
   * @param id - Entity ID
   * @param data - Fields to update
   * @returns Updated entity
   * @throws NotFoundError if entity doesn't exist
   * @throws DatabaseError on update failure
   */
  async update(id: string, data: Partial<T>): Promise<T> {
    const { data: updated, error } = await this.client
      .from(this.tableName)
      .update(data as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError(this.tableName, id);
      }
      throw mapSupabaseError(error);
    }

    return updated as T;
  }

  /**
   * Delete entity by ID
   *
   * @param id - Entity ID
   * @returns true if deleted, false if not found
   * @throws DatabaseError on delete failure
   */
  async delete(id: string): Promise<boolean> {
    const { error, count } = await this.client
      .from(this.tableName)
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      throw mapSupabaseError(error);
    }

    return (count || 0) > 0;
  }

  /**
   * Count entities matching filter criteria
   *
   * @param filters - Key-value pairs for filtering
   * @returns Count of matching entities
   * @throws DatabaseError on query failure
   */
  async count(filters: QueryFilter = {}): Promise<number> {
    let query = this.client.from(this.tableName).select('*', { count: 'exact', head: true });

    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { count, error } = await query;

    if (error) {
      throw mapSupabaseError(error);
    }

    return count || 0;
  }

  /**
   * Check if entity exists by ID
   *
   * @param id - Entity ID
   * @returns true if exists, false otherwise
   * @throws DatabaseError on query failure
   */
  async exists(id: string): Promise<boolean> {
    const { count, error } = await this.client
      .from(this.tableName)
      .select('id', { count: 'exact', head: true })
      .eq('id', id);

    if (error) {
      throw mapSupabaseError(error);
    }

    return (count || 0) > 0;
  }

  /**
   * Execute raw SQL query via RPC
   *
   * @param functionName - PostgreSQL function name
   * @param params - Function parameters
   * @returns Query result
   * @throws DatabaseError on RPC failure
   */
  protected async rpc<R = any>(functionName: string, params?: Record<string, any>): Promise<R> {
    const { data, error } = await this.client.rpc(functionName, params);

    if (error) {
      throw mapSupabaseError(error);
    }

    return data as R;
  }

  /**
   * Validate entity ownership
   *
   * Helper method for repositories that need to verify user_id matches
   *
   * @param id - Entity ID
   * @param userId - Expected owner user ID
   * @returns Entity data
   * @throws NotFoundError if not found or wrong owner
   * @throws DatabaseError on query failure
   */
  protected async validateOwnership(id: string, userId: string): Promise<T> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError(this.tableName, id);
      }
      throw mapSupabaseError(error);
    }

    return data as T;
  }

  /**
   * Batch insert multiple entities
   *
   * @param items - Array of entities to insert
   * @returns Array of created entities
   * @throws DatabaseError on insert failure
   */
  protected async createMany(items: Partial<T>[]): Promise<T[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .insert(items as any[])
      .select();

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []) as T[];
  }

  /**
   * Batch update multiple entities
   *
   * Note: Supabase doesn't support batch updates with different values per row,
   * so this performs updates sequentially. Use with caution for large batches.
   *
   * @param updates - Array of { id, data } objects
   * @returns Array of updated entities
   * @throws DatabaseError on any update failure
   */
  protected async updateMany(updates: Array<{ id: string; data: Partial<T> }>): Promise<T[]> {
    const results: T[] = [];

    for (const { id, data } of updates) {
      const updated = await this.update(id, data);
      results.push(updated);
    }

    return results;
  }

  /**
   * Batch delete multiple entities
   *
   * @param ids - Array of entity IDs to delete
   * @returns Number of entities deleted
   * @throws DatabaseError on delete failure
   */
  protected async deleteMany(ids: string[]): Promise<number> {
    const { error, count } = await this.client
      .from(this.tableName)
      .delete({ count: 'exact' })
      .in('id', ids);

    if (error) {
      throw mapSupabaseError(error);
    }

    return count || 0;
  }
}
