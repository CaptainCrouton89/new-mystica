/**
 * Analytics repository for event tracking, pet chatter, and enemy chatter logging
 *
 * Handles three main analytics tables:
 * - AnalyticsEvents: General user action tracking with JSONB properties
 * - CombatChatterLog: Pet personality chatter during combat (F-11)
 * - EnemyChatterLog: Enemy AI trash-talk during combat (F-12)
 *
 * Key considerations:
 * - Large table growth requires partitioning strategy for production
 * - Time-series queries use DATE_TRUNC for hour/day/week aggregation
 * - JSONB properties support flexible query patterns
 * - Nullable user_id for system-level events
 * - Performance tracking via generation_time_ms
 */

import { PlayerCombatHistory } from '../types/api.types.js';
import { Database, Json } from '../types/database.types.js';
import { DatabaseError, ValidationError } from '../utils/errors.js';
import { BaseRepository } from './BaseRepository.js';

// Type aliases for cleaner code
type AnalyticsEvent = Database['public']['Tables']['analyticsevents']['Row'];
type CombatChatterLog = Database['public']['Tables']['combatchatterlog']['Row'];
type EnemyChatterLog = Database['public']['Tables']['enemychatterlog']['Row'];

type AnalyticsEventInsert = Database['public']['Tables']['analyticsevents']['Insert'];
type CombatChatterInsert = Database['public']['Tables']['combatchatterlog']['Insert'];
type EnemyChatterInsert = Database['public']['Tables']['enemychatterlog']['Insert'];

export class AnalyticsRepository extends BaseRepository<AnalyticsEvent> {
  constructor() {
    super("analyticsevents");
  }

  // =====================================
  // GENERAL ANALYTICS EVENTS
  // =====================================

  /**
   * Log a general analytics event
   *
   * @param userId - User ID (null for system events)
   * @param eventName - Event identifier (e.g., 'user_login', 'item_crafted')
   * @param properties - Arbitrary event data stored as JSONB
   * @throws ValidationError if eventName is empty
   * @throws DatabaseError on insert failure
   */
  async logEvent(
    userId: string | null,
    eventName: string,
    properties: Record<string, unknown> | null = null
  ): Promise<void> {
    if (!eventName.trim()) {
      throw new ValidationError("Event name cannot be empty");
    }

    const eventData: AnalyticsEventInsert = {
      user_id: userId,
      event_name: eventName,
      properties: properties as unknown as Json,
    };

    await this.create(eventData);
  }

  /**
   * Get analytics events for a specific user
   *
   * @param userId - User ID
   * @param eventName - Optional event name filter
   * @returns Array of analytics events ordered by timestamp desc
   * @throws DatabaseError on query failure
   */
  async getEventsByUser(
    userId: string,
    eventName?: string
  ): Promise<AnalyticsEvent[]> {
    let query = this.client
      .from("analyticsevents")
      .select("*")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false });

    if (eventName) {
      query = query.eq("event_name", eventName);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(`Failed to get events by user: ${error.message}`);
    }

    if (!data) {
      throw new DatabaseError("No data returned from user events query");
    }

    return data;
  }

  /**
   * Get analytics events within a time range
   *
   * @param startTime - ISO timestamp string (inclusive)
   * @param endTime - ISO timestamp string (inclusive)
   * @param eventName - Optional event name filter
   * @returns Array of analytics events ordered by timestamp desc
   * @throws DatabaseError on query failure
   */
  async getEventsByTimeRange(
    startTime: string,
    endTime: string,
    eventName?: string
  ): Promise<AnalyticsEvent[]> {
    let query = this.client
      .from("analyticsevents")
      .select("*")
      .gte("timestamp", startTime)
      .lte("timestamp", endTime)
      .order("timestamp", { ascending: false });

    if (eventName) {
      query = query.eq("event_name", eventName);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(
        `Failed to get events by time range: ${error.message}`
      );
    }

    if (!data) {
      throw new DatabaseError("No data returned from time range query");
    }

    return data;
  }

  /**
   * Get event counts grouped by time period
   *
   * Uses DATE_TRUNC for PostgreSQL time-series aggregation
   *
   * @param eventName - Event name to count
   * @param groupBy - Time period grouping
   * @returns Object mapping time periods to counts
   * @throws DatabaseError on query failure
   */
  async getEventCounts(
    eventName: string,
    groupBy: "hour" | "day" | "week"
  ): Promise<Record<string, number>> {
    const { data, error } = await this.client.rpc("get_event_counts", {
      p_event_name: eventName,
      p_group_by: groupBy,
    });

    if (error) {
      throw new DatabaseError(`Failed to get event counts: ${error.message}`);
    }

    if (!data) {
      throw new DatabaseError("No event count data returned");
    }

    // Transform array of {period, count} to object
    const result: Record<string, number> = {};
    data.forEach((row: { period: string; count: number }) => {
      result[row.period] = row.count;
    });

    return result;
  }

  // =====================================
  // PET CHATTER LOGGING (F-11)
  // =====================================

  /**
   * Log pet chatter during combat
   *
   * @param sessionId - Combat session ID
   * @param petItemId - Pet item ID
   * @param eventType - Chatter event type (e.g., 'combat_start', 'hit_taken')
   * @param dialogue - Generated dialogue text
   * @param generationTimeMs - AI generation latency in milliseconds
   * @param wasAI - true if AI-generated, false if canned phrase
   * @throws DatabaseError on insert failure
   */
  async logPetChatter(
    sessionId: string,
    petItemId: string,
    eventType: string,
    dialogue: string,
    generationTimeMs: number,
    wasAI: boolean
  ): Promise<void> {
    const chatterData: CombatChatterInsert = {
      session_id: sessionId,
      pet_item_id: petItemId,
      event_type: eventType,
      generated_dialogue: dialogue,
      generation_time_ms: generationTimeMs,
      was_ai_generated: wasAI,
    };

    const { error } = await this.client
      .from("combatchatterlog")
      .insert(chatterData);

    if (error) {
      throw new DatabaseError(`Failed to log pet chatter: ${error.message}`);
    }
  }

  /**
   * Get pet chatter logs for a combat session
   *
   * @param sessionId - Combat session ID
   * @returns Array of chatter logs ordered by timestamp
   * @throws DatabaseError on query failure
   */
  async getPetChatterBySession(sessionId: string): Promise<CombatChatterLog[]> {
    const { data, error } = await this.client
      .from("combatchatterlog")
      .select("*")
      .eq("session_id", sessionId)
      .order("timestamp", { ascending: true });

    if (error) {
      throw new DatabaseError(
        `Failed to get pet chatter by session: ${error.message}`
      );
    }

    if (!data) {
      throw new DatabaseError("No data returned from query");
    }
    return data;
  }

  /**
   * Get pet chatter logs by personality type
   *
   * @param personalityType - Pet personality type
   * @returns Array of chatter logs ordered by timestamp desc
   * @throws DatabaseError on query failure
   */
  async getPetChatterByPersonality(
    personalityType: string
  ): Promise<CombatChatterLog[]> {
    const { data, error } = await this.client
      .from("combatchatterlog")
      .select("*")
      .eq("personality_type", personalityType)
      .order("timestamp", { ascending: false });

    if (error) {
      throw new DatabaseError(
        `Failed to get pet chatter by personality: ${error.message}`
      );
    }

    if (!data) {
      throw new DatabaseError("No data returned from query");
    }
    return data;
  }

  /**
   * Get average generation time for pet chatter by personality
   *
   * @param personalityType - Pet personality type
   * @returns Average generation time in milliseconds
   * @throws DatabaseError on query failure
   */
  async getAvgGenerationTime(personalityType: string): Promise<number> {
    const { data, error } = await this.client
      .from("combatchatterlog")
      .select("generation_time_ms")
      .eq("personality_type", personalityType)
      .not("generation_time_ms", "is", null);

    if (error) {
      throw new DatabaseError(
        `Failed to get avg generation time: ${error.message}`
      );
    }

    if (!data || data.length === 0) {
      throw new DatabaseError(
        "No generation time data found for given personality type"
      );
    }

    const total = data.reduce(
      (sum, row) => sum + (row.generation_time_ms || 0),
      0
    );
    return total / data.length;
  }

  // =====================================
  // ENEMY CHATTER LOGGING (F-12)
  // =====================================

  /**
   * Log enemy chatter during combat
   *
   * @param sessionId - Combat session ID
   * @param enemyTypeId - Enemy type ID
   * @param eventType - Chatter event type (e.g., 'combat_start', 'player_attacks', 'enemy_attacks')
   * @param dialogue - Generated dialogue text
   * @param playerContext - Player metadata for AI context (JSONB)
   * @param generationTimeMs - AI generation latency in milliseconds
   * @param wasAI - true if AI-generated, false if canned phrase
   * @throws DatabaseError on insert failure
   */
  async logEnemyChatter(
    sessionId: string,
    enemyTypeId: string,
    eventType: string,
    dialogue: string,
    playerContext: PlayerCombatHistory,
    generationTimeMs: number,
    wasAI: boolean
  ): Promise<void> {
    const chatterData: EnemyChatterInsert = {
      session_id: sessionId,
      enemy_type_id: enemyTypeId,
      event_type: eventType,
      generated_dialogue: dialogue,
      player_metadata: playerContext as unknown as Json,
      generation_time_ms: generationTimeMs,
      was_ai_generated: wasAI,
    };

    const { error } = await this.client
      .from("enemychatterlog")
      .insert(chatterData);

    if (error) {
      throw new DatabaseError(`Failed to log enemy chatter: ${error.message}`);
    }
  }

  /**
   * Get enemy chatter logs for a combat session
   *
   * @param sessionId - Combat session ID
   * @returns Array of chatter logs ordered by timestamp
   * @throws DatabaseError on query failure
   */
  async getEnemyChatterBySession(
    sessionId: string
  ): Promise<EnemyChatterLog[]> {
    const { data, error } = await this.client
      .from("enemychatterlog")
      .select("*")
      .eq("session_id", sessionId)
      .order("timestamp", { ascending: true });

    if (error) {
      throw new DatabaseError(
        `Failed to get enemy chatter by session: ${error.message}`
      );
    }

    if (!data) {
      throw new DatabaseError("No data returned from query");
    }
    return data;
  }

  /**
   * Get enemy chatter logs by enemy type
   *
   * @param enemyTypeId - Enemy type ID
   * @returns Array of chatter logs ordered by timestamp desc
   * @throws DatabaseError on query failure
   */
  async getEnemyChatterByType(enemyTypeId: string): Promise<EnemyChatterLog[]> {
    const { data, error } = await this.client
      .from("enemychatterlog")
      .select("*")
      .eq("enemy_type_id", enemyTypeId)
      .order("timestamp", { ascending: false });

    if (error) {
      throw new DatabaseError(
        `Failed to get enemy chatter by type: ${error.message}`
      );
    }

    if (!data) {
      throw new DatabaseError("No data returned from query");
    }
    return data;
  }

  /**
   * Get average generation time for enemy chatter by type
   *
   * @param enemyTypeId - Enemy type ID
   * @returns Average generation time in milliseconds
   * @throws DatabaseError on query failure
   */
  async getAvgEnemyChatterGenerationTime(enemyTypeId: string): Promise<number> {
    const { data, error } = await this.client
      .from("enemychatterlog")
      .select("generation_time_ms")
      .eq("enemy_type_id", enemyTypeId)
      .not("generation_time_ms", "is", null);

    if (error) {
      throw new DatabaseError(
        `Failed to get avg enemy generation time: ${error.message}`
      );
    }

    if (!data || data.length === 0) {
      return 0;
    }

    const total = data.reduce(
      (sum, row) => sum + (row.generation_time_ms || 0),
      0
    );
    return total / data.length;
  }

  // =====================================
  // ANALYTICS QUERIES WITH JSONB
  // =====================================

  /**
   * Query analytics events by JSONB property
   *
   * @param propertyPath - JSONB property path (e.g., 'item_type', 'location.city')
   * @param value - Property value to match
   * @param eventName - Optional event name filter
   * @returns Array of matching analytics events
   * @throws DatabaseError on query failure
   */
  async getEventsByProperty(
    propertyPath: string,
    value: unknown,
    eventName?: string
  ): Promise<AnalyticsEvent[]> {
    let query = this.client
      .from("analyticsevents")
      .select("*")
      .eq(`properties->${propertyPath}`, JSON.stringify(value))
      .order("timestamp", { ascending: false });

    if (eventName) {
      query = query.eq("event_name", eventName);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(
        `Failed to query events by property: ${error.message}`
      );
    }

    if (!data) {
      throw new DatabaseError("No data returned from query");
    }
    return data;
  }

  /**
   * Get unique values for a JSONB property across events
   *
   * @param propertyPath - JSONB property path
   * @param eventName - Optional event name filter
   * @returns Array of unique property values
   * @throws DatabaseError on query failure
   */
  async getUniquePropertyValues(
    propertyPath: string,
    eventName?: string
  ): Promise<unknown[]> {
    const { data, error } = await this.client.rpc(
      "get_unique_property_values",
      {
        p_property_path: propertyPath,
        p_event_name: eventName,
      }
    );

    if (error) {
      throw new DatabaseError(
        `Failed to get unique property values: ${error.message}`
      );
    }

    if (!data) {
      throw new DatabaseError("No data returned from query");
    }
    return data;
  }

  // =====================================
  // BULK OPERATIONS
  // =====================================

  /**
   * Batch insert analytics events
   *
   * @param events - Array of event data to insert
   * @returns Array of created events
   * @throws DatabaseError on bulk insert failure
   */
  async logEventsBatch(
    events: AnalyticsEventInsert[]
  ): Promise<AnalyticsEvent[]> {
    if (events.length === 0) {
      return [];
    }

    const { data, error } = await this.client
      .from("analyticsevents")
      .insert(events)
      .select();

    if (error) {
      throw new DatabaseError(
        `Failed to batch insert events: ${error.message}`
      );
    }

    if (!data) {
      throw new DatabaseError("No data returned from query");
    }
    return data;
  }

  /**
   * Delete old analytics events beyond retention period
   *
   * @param retentionDays - Number of days to retain
   * @returns Number of events deleted
   * @throws DatabaseError on delete failure
   */
  async cleanupOldEvents(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { error, count } = await this.client
      .from("analyticsevents")
      .delete({ count: "exact" })
      .lt("timestamp", cutoffDate.toISOString());

    if (error) {
      throw new DatabaseError(`Failed to cleanup old events: ${error.message}`);
    }

    return count || 0;
  }
}