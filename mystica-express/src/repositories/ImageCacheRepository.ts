/**
 * ImageCacheRepository - Global item image cache management
 *
 * Manages the ItemImageCache table for storing generated item+material combo images.
 * This is a global cache shared across all users to optimize image generation costs.
 *
 * Key Features:
 * - UNIQUE constraint handling for (item_type_id, combo_hash)
 * - Atomic craft count increment to avoid race conditions
 * - First craft detection for service layer logic
 * - Analytics queries for popular combos and provider tracking
 */

import { Database, Tables } from '../types/database.types.js';
import { CreateImageCacheData } from '../types/repository.types.js';
import { DatabaseError, NotFoundError, ValidationError, mapSupabaseError } from '../utils/errors.js';
import { BaseRepository } from './BaseRepository.js';

type ItemImageCacheRow = Database['public']['Tables']['itemimagecache']['Row'];
type ItemImageCacheInsert = Database['public']['Tables']['itemimagecache']['Insert'];

export class ImageCacheRepository extends BaseRepository<ItemImageCacheRow> {
  constructor() {
    super("itemimagecache");
  }

  // ============================================================================
  // Cache Lookup Methods
  // ============================================================================

  /**
   * Find cache entry by item type and combo hash
   *
   * @param itemTypeId - Item type UUID
   * @param comboHash - Deterministic hash of material combination
   * @returns Cache entry or null if not found
   * @throws DatabaseError on query failure
   */
  async findByComboHash(
    itemTypeId: string,
    comboHash: string
  ): Promise<Tables<"itemimagecache"> | null> {
    const { data, error } = await this.client
      .from("itemimagecache")
      .select("*")
      .eq("item_type_id", itemTypeId)
      .eq("combo_hash", comboHash)
      .single();

    if (error) {
      // PGRST116 = no rows returned
      if (error.code === "PGRST116") {
        return null;
      }
      throw mapSupabaseError(error);
    }

    return data ? this.mapToItemImageCacheEntry(data) : null;
  }

  /**
   * Find cache entry by ID
   *
   * @param cacheId - Cache entry UUID
   * @returns Cache entry or null if not found
   * @throws DatabaseError on query failure
   */
  async findById(cacheId: string): Promise<Tables<'itemimagecache'> | null> {
    const data = await super.findById(cacheId);
    return data ? this.mapToItemImageCacheEntry(data) : null;
  }

  // ============================================================================
  // Cache Creation Methods
  // ============================================================================

  /**
   * Create new cache entry with graceful UNIQUE constraint handling
   *
   * If the (item_type_id, combo_hash) already exists, returns the existing entry
   * instead of throwing a constraint violation error.
   *
   * @param data - Cache entry creation data
   * @returns Created or existing cache entry
   * @throws DatabaseError on non-constraint database errors
   * @throws ValidationError on invalid URL format
   */
  async createCacheEntry(
    data: CreateImageCacheData
  ): Promise<Tables<'itemimagecache'>> {
    // Validate R2 URL format
    this.validateImageUrl(data.image_url);

    const insertData: ItemImageCacheInsert = {
      item_type_id: data.item_type_id,
      combo_hash: data.combo_hash,
      image_url: data.image_url,
      provider: data.provider,
      craft_count: 1, // First craft
    };

    const { data: created, error } = await this.client
      .from("itemimagecache")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // Handle UNIQUE constraint violation (23505)
      if (
        error.code === "23505" &&
        error.message.includes("unique_item_type_combo")
      ) {
        // Constraint violation - fetch existing entry
        const existing = await this.findByComboHash(
          data.item_type_id,
          data.combo_hash
        );
        if (existing) {
          return existing;
        }
        // Explicitly throw if no existing entry found
        throw new DatabaseError(
          "UNIQUE constraint violation but entry not found",
          error
        );
      }
      throw mapSupabaseError(error);
    }

    if (!created) {
      throw new DatabaseError(
        "Failed to create cache entry - no data returned"
      );
    }

    return this.mapToItemImageCacheEntry(created);
  }

  // ============================================================================
  // Craft Count Management
  // ============================================================================

  /**
   * Atomically increment craft count and return new value
   *
   * Uses RPC function for true atomic increment operation.
   *
   * @param cacheId - Cache entry UUID
   * @returns New craft count after increment
   * @throws NotFoundError if cache entry doesn't exist
   * @throws DatabaseError on update failure
   */
  async incrementCraftCount(cacheId: string): Promise<number> {
    // Use RPC function for atomic increment
    const { data, error } = await this.client.rpc("increment_craft_count", {
      cache_id: cacheId,
    });

    if (error) {
      if (
        error.message?.includes("not found") ||
        error.message?.includes("No rows")
      ) {
        throw new NotFoundError("itemimagecache", cacheId);
      }
      throw mapSupabaseError(error);
    }

    if (typeof data !== "number") {
      throw new DatabaseError("Invalid craft count increment result");
    }

    return data;
  }

  /**
   * Get current craft count for a combo without incrementing
   *
   * @param itemTypeId - Item type UUID
   * @param comboHash - Combo hash
   * @returns Current craft count or 0 if not found
   * @throws DatabaseError on query failure
   */
  async getCraftCount(itemTypeId: string, comboHash: string): Promise<number> {
    const { data, error } = await this.client
      .from("itemimagecache")
      .select("craft_count")
      .eq("item_type_id", itemTypeId)
      .eq("combo_hash", comboHash)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return 0; // Not found = never crafted
      }
      throw mapSupabaseError(error);
    }

    return data.craft_count ?? 0;
  }

  // ============================================================================
  // Analytics Queries
  // ============================================================================

  /**
   * Get most popular combo images by craft count
   *
   * @param limit - Maximum number of entries to return
   * @returns Array of cache entries ordered by craft count descending
   * @throws DatabaseError on query failure
   */
  async getMostPopularCombos(limit: number): Promise<Tables<'itemimagecache'>[]> {
    const { data, error } = await this.client
      .from("itemimagecache")
      .select("*")
      .order("craft_count", { ascending: false })
      .limit(limit);

    if (error) {
      throw mapSupabaseError(error);
    }

    if (!data) {
      return [];
    }

    return data.map((row) => this.mapToItemImageCacheEntry(row));
  }

  /**
   * Get cache entries by AI provider
   *
   * @param provider - AI provider name ('gemini', 'seedream', etc.)
   * @returns Array of cache entries for the provider
   * @throws DatabaseError on query failure
   */
  async getCombosByProvider(provider: string): Promise<Tables<'itemimagecache'>[]> {
    const { data, error } = await this.client
      .from("itemimagecache")
      .select("*")
      .eq("provider", provider)
      .order("created_at", { ascending: false });

    if (error) {
      throw mapSupabaseError(error);
    }

    if (!data) {
      return [];
    }

    return data.map((row) => this.mapToItemImageCacheEntry(row));
  }

  /**
   * Get cache entries for a specific item type
   *
   * @param itemTypeId - Item type UUID
   * @returns Array of cache entries for the item type
   * @throws DatabaseError on query failure
   */
  async getCombosByItemType(
    itemTypeId: string
  ): Promise<Tables<'itemimagecache'>[]> {
    const { data, error } = await this.client
      .from("itemimagecache")
      .select("*")
      .eq("item_type_id", itemTypeId)
      .order("craft_count", { ascending: false });

    if (error) {
      throw mapSupabaseError(error);
    }

    if (!data) {
      return [];
    }

    return data.map((row) => this.mapToItemImageCacheEntry(row));
  }

  /**
   * Get total count of unique combo images in cache
   *
   * @returns Total number of unique combos cached
   * @throws DatabaseError on query failure
   */
  async getTotalUniqueComboCount(): Promise<number> {
    return await this.count();
  }

  /**
   * Get cache statistics aggregated by provider
   *
   * @returns Array of provider stats with combo count and total crafts
   * @throws DatabaseError on query failure
   */
  async getProviderStats(): Promise<
    Array<{
      provider: string | null;
      combo_count: number;
      total_crafts: number;
    }>
  > {
    // Simple implementation - in production this would be optimized with a proper aggregation query
    const { data, error } = await this.client
      .from("itemimagecache")
      .select("provider, craft_count");

    if (error) {
      throw mapSupabaseError(error);
    }

    // Group by provider and calculate stats in JavaScript
    const stats = new Map<
      string | null,
      { combo_count: number; total_crafts: number }
    >();

    (data || []).forEach((row) => {
      const provider = row.provider;
      const existing = stats.get(provider) || {
        combo_count: 0,
        total_crafts: 0,
      };
      stats.set(provider, {
        combo_count: existing.combo_count + 1,
        total_crafts: existing.total_crafts + row.craft_count,
      });
    });

    return Array.from(stats.entries()).map(([provider, stats]) => ({
      provider,
      ...stats,
    }));
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Map database row to repository type
   *
   * @param row - Database row data
   * @returns Mapped cache entry
   */
  private mapToItemImageCacheEntry(
    row: ItemImageCacheRow
  ): Tables<'itemimagecache'> {
    return {
      id: row.id,
      item_type_id: row.item_type_id,
      combo_hash: row.combo_hash,
      image_url: row.image_url,
      craft_count: row.craft_count,
      provider: row.provider,
      created_at: row.created_at,
    };
  }

  /**
   * Validate R2 image URL format
   *
   * @param url - Image URL to validate
   * @throws ValidationError if URL format is invalid
   */
  private validateImageUrl(url: string): void {
    try {
      const parsed = new URL(url);

      // Check for R2 domain pattern
      if (
        !parsed.hostname.includes("r2.dev") &&
        !parsed.hostname.includes("r2.cloudflarestorage.com")
      ) {
        throw new ValidationError("Image URL must be a valid R2 URL");
      }

      // Check for image file extension
      const path = parsed.pathname.toLowerCase();
      if (
        !path.endsWith(".png") &&
        !path.endsWith(".jpg") &&
        !path.endsWith(".jpeg") &&
        !path.endsWith(".webp")
      ) {
        throw new ValidationError(
          "Image URL must point to a valid image file (.png, .jpg, .jpeg, .webp)"
        );
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError("Invalid image URL format");
    }
  }
}