-- Location Pool Optimization Views and RPCs
--
-- This migration adds optimized database views and RPC functions for
-- efficient location-based pool matching and weighted selection queries.
--
-- Dependencies: 001_initial_schema.sql (locations, enemypools, lootpools tables)

-- ============================================================================
-- Enemy Pool Optimization
-- ============================================================================

/**
 * RPC function to get matching enemy pools with aggregated spawn weights
 *
 * @param p_location_id UUID - Location ID to match pools against
 * @param p_combat_level INT - Combat level for pool filtering
 * @returns TABLE of (enemy_type_id UUID, total_spawn_weight BIGINT)
 *
 * Combines universal pools + location-specific pools with proper weight aggregation.
 * Handles filter types: universal, location_type, state, country
 */
CREATE OR REPLACE FUNCTION get_matching_enemy_pools(
    p_location_id UUID,
    p_combat_level INT
)
RETURNS TABLE (
    enemy_type_id UUID,
    total_spawn_weight BIGINT
) AS $$
DECLARE
    location_rec RECORD;
BEGIN
    -- Get location details for filter matching
    SELECT lat, lng, location_type, state_code, country_code
    INTO location_rec
    FROM locations
    WHERE id = p_location_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Location not found: %', p_location_id;
    END IF;

    -- Return aggregated enemy pool members with summed spawn weights
    RETURN QUERY
    SELECT
        epm.enemy_type_id,
        SUM(epm.spawn_weight)::BIGINT as total_spawn_weight
    FROM enemypools ep
    JOIN enemypoolmembers epm ON ep.id = epm.enemy_pool_id
    WHERE ep.combat_level = p_combat_level
      AND (
          -- Universal pools always match
          ep.filter_type = 'universal'
          -- Location type matching
          OR (ep.filter_type = 'location_type' AND ep.filter_value = location_rec.location_type)
          -- State matching
          OR (ep.filter_type = 'state' AND ep.filter_value = location_rec.state_code)
          -- Country matching
          OR (ep.filter_type = 'country' AND ep.filter_value = location_rec.country_code)
          -- TODO: Add lat_range and lng_range matching
          -- OR (ep.filter_type = 'lat_range' AND location_rec.lat BETWEEN ...)
          -- OR (ep.filter_type = 'lng_range' AND location_rec.lng BETWEEN ...)
      )
    GROUP BY epm.enemy_type_id
    ORDER BY total_spawn_weight DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_matching_enemy_pools(UUID, INT) IS
'Get enemy pool members aggregated by type with total spawn weights for location and combat level';

-- ============================================================================
-- Loot Pool Optimization
-- ============================================================================

/**
 * RPC function to get matching loot pools with tier weight multipliers applied
 *
 * @param p_location_id UUID - Location ID to match pools against
 * @param p_combat_level INT - Combat level for pool filtering
 * @returns TABLE of loot pool entries with adjusted weights
 *
 * Applies tier weight multipliers to material drops based on MaterialStrengthTiers.
 * For items (non-materials), uses base drop_weight without tier adjustment.
 */
CREATE OR REPLACE FUNCTION get_matching_loot_pools(
    p_location_id UUID,
    p_combat_level INT
)
RETURNS TABLE (
    loot_pool_id UUID,
    lootable_type VARCHAR,
    lootable_id UUID,
    base_drop_weight INT,
    tier_multiplier NUMERIC,
    adjusted_weight NUMERIC
) AS $$
DECLARE
    location_rec RECORD;
BEGIN
    -- Get location details for filter matching
    SELECT lat, lng, location_type, state_code, country_code
    INTO location_rec
    FROM locations
    WHERE id = p_location_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Location not found: %', p_location_id;
    END IF;

    -- Return loot pool entries with tier weight adjustments
    RETURN QUERY
    SELECT
        lpe.loot_pool_id,
        lpe.lootable_type,
        lpe.lootable_id,
        lpe.drop_weight as base_drop_weight,
        COALESCE(lptw.weight_multiplier, 1.0) as tier_multiplier,
        (lpe.drop_weight * COALESCE(lptw.weight_multiplier, 1.0)) as adjusted_weight
    FROM lootpools lp
    JOIN lootpoolentries lpe ON lp.id = lpe.loot_pool_id
    LEFT JOIN lootpooltierweights lptw ON (
        lp.id = lptw.loot_pool_id
        AND lptw.tier_name = 'common' -- Default tier for now, TODO: calculate actual material tier
    )
    WHERE lp.combat_level = p_combat_level
      AND (
          -- Universal pools always match
          lp.filter_type = 'universal'
          -- Location type matching
          OR (lp.filter_type = 'location_type' AND lp.filter_value = location_rec.location_type)
          -- State matching
          OR (lp.filter_type = 'state' AND lp.filter_value = location_rec.state_code)
          -- Country matching
          OR (lp.filter_type = 'country' AND lp.filter_value = location_rec.country_code)
          -- TODO: Add lat_range and lng_range matching
      )
    ORDER BY adjusted_weight DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_matching_loot_pools(UUID, INT) IS
'Get loot pool entries with tier weight multipliers applied for location and combat level';

-- ============================================================================
-- Materialized View for Loot Pool Material Weights
-- ============================================================================

/**
 * Materialized view that pre-computes final drop weights per material per pool
 *
 * This view combines:
 * - LootPoolEntries (base drop weights)
 * - LootPoolTierWeights (tier multipliers)
 * - Materials (for tier calculation, when implemented)
 *
 * Refreshed when material stats or pool configurations change.
 */
CREATE MATERIALIZED VIEW v_loot_pool_material_weights AS
SELECT
    lpe.loot_pool_id,
    lpe.lootable_id as material_id,
    lpe.drop_weight as base_weight,
    'common' as material_tier, -- TODO: Calculate from material stats
    COALESCE(lptw.weight_multiplier, 1.0) as tier_multiplier,
    (lpe.drop_weight * COALESCE(lptw.weight_multiplier, 1.0)) as final_weight,
    lpe.created_at
FROM lootpoolentries lpe
LEFT JOIN lootpooltierweights lptw ON (
    lpe.loot_pool_id = lptw.loot_pool_id
    AND lptw.tier_name = 'common' -- Will be dynamic when tier calculation is implemented
)
WHERE lpe.lootable_type = 'material'
ORDER BY lpe.loot_pool_id, final_weight DESC;

-- Create index for efficient querying
CREATE INDEX idx_v_loot_pool_material_weights_pool_id
ON v_loot_pool_material_weights(loot_pool_id);

CREATE INDEX idx_v_loot_pool_material_weights_material_id
ON v_loot_pool_material_weights(material_id);

COMMENT ON MATERIALIZED VIEW v_loot_pool_material_weights IS
'Pre-computed final drop weights for materials across all loot pools with tier multipliers applied';

-- ============================================================================
-- Pool Filter Helper Functions
-- ============================================================================

/**
 * Function to parse and validate lat/lng range filters
 * Format: "min_lat,max_lat" or "min_lng,max_lng"
 *
 * @param filter_value VARCHAR - Comma-separated range "min,max"
 * @returns TABLE of (min_val NUMERIC, max_val NUMERIC)
 */
CREATE OR REPLACE FUNCTION parse_coordinate_range(filter_value VARCHAR)
RETURNS TABLE (min_val NUMERIC, max_val NUMERIC) AS $$
DECLARE
    parts TEXT[];
BEGIN
    IF filter_value IS NULL OR filter_value = '' THEN
        RETURN;
    END IF;

    parts := string_to_array(filter_value, ',');

    IF array_length(parts, 1) != 2 THEN
        RAISE EXCEPTION 'Invalid coordinate range format. Expected "min,max", got: %', filter_value;
    END IF;

    RETURN QUERY SELECT
        parts[1]::NUMERIC as min_val,
        parts[2]::NUMERIC as max_val;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION parse_coordinate_range(VARCHAR) IS
'Parse coordinate range filter value into min/max numeric bounds';

-- ============================================================================
-- Refresh Functions for Materialized Views
-- ============================================================================

/**
 * Function to refresh materialized view when pool data changes
 * Should be called after updates to LootPoolEntries or LootPoolTierWeights
 */
CREATE OR REPLACE FUNCTION refresh_loot_pool_material_weights()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW v_loot_pool_material_weights;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_loot_pool_material_weights() IS
'Refresh materialized view for loot pool material weights after pool configuration changes';

-- ============================================================================
-- Triggers for Automatic View Refresh
-- ============================================================================

/**
 * Trigger function to automatically refresh materialized view
 * when underlying data changes
 */
CREATE OR REPLACE FUNCTION trigger_refresh_loot_pool_weights()
RETURNS TRIGGER AS $$
BEGIN
    -- Use NOTIFY to trigger async refresh in application code
    -- Direct REFRESH here would be too expensive for frequent updates
    NOTIFY loot_pool_weights_changed;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers on relevant tables
CREATE TRIGGER trigger_loot_pool_entries_changed
    AFTER INSERT OR UPDATE OR DELETE ON lootpoolentries
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_loot_pool_weights();

CREATE TRIGGER trigger_loot_pool_tier_weights_changed
    AFTER INSERT OR UPDATE OR DELETE ON lootpooltierweights
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_loot_pool_weights();

-- ============================================================================
-- Performance Indexes
-- ============================================================================

-- Additional indexes for pool filter performance
CREATE INDEX IF NOT EXISTS idx_enemy_pools_filter_composite
ON enemypools(combat_level, filter_type, filter_value);

CREATE INDEX IF NOT EXISTS idx_loot_pools_filter_composite
ON lootpools(combat_level, filter_type, filter_value);

-- Indexes for location-based queries
CREATE INDEX IF NOT EXISTS idx_locations_type_state_country
ON locations(location_type, state_code, country_code);

-- ============================================================================
-- Usage Examples (for documentation)
-- ============================================================================

/*
-- Example 1: Get enemy spawn weights for a location
SELECT * FROM get_matching_enemy_pools(
    'location-uuid-here'::UUID,
    1 -- combat_level
);

-- Example 2: Get loot drop weights for a location
SELECT * FROM get_matching_loot_pools(
    'location-uuid-here'::UUID,
    1 -- combat_level
);

-- Example 3: Query pre-computed material weights
SELECT
    material_id,
    final_weight,
    tier_multiplier
FROM v_loot_pool_material_weights
WHERE loot_pool_id = 'pool-uuid-here'::UUID
ORDER BY final_weight DESC;

-- Example 4: Refresh materialized view after pool changes
SELECT refresh_loot_pool_material_weights();
*/