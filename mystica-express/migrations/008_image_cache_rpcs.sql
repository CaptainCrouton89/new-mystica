-- ============================================================================
-- IMAGE CACHE RPC FUNCTIONS
-- Migration: 008_image_cache_rpcs.sql
--
-- Creates PostgreSQL RPC function for atomic image cache operations:
-- 1. increment_craft_count() - Atomically increment craft count with returning
-- ============================================================================

-- Function: increment_craft_count
--
-- Atomically increments craft count for a cache entry and returns the new value.
-- Uses UPDATE with RETURNING to ensure atomicity and avoid race conditions.
--
-- Parameters:
--   cache_id - Image cache entry UUID
--
-- Returns: INTEGER - The new craft count after increment
--
-- Usage:
--   SELECT increment_craft_count('cache-uuid');
--
CREATE OR REPLACE FUNCTION increment_craft_count(
    cache_id UUID
) RETURNS INTEGER AS $$
DECLARE
    new_count INTEGER;
BEGIN
    -- Validate input parameter
    IF cache_id IS NULL THEN
        RAISE EXCEPTION 'cache_id parameter is required';
    END IF;

    -- Atomically increment and return new value
    UPDATE ItemImageCache
    SET craft_count = craft_count + 1
    WHERE id = cache_id
    RETURNING craft_count INTO new_count;

    -- Check if any row was affected
    IF new_count IS NULL THEN
        RAISE EXCEPTION 'Cache entry not found: %', cache_id;
    END IF;

    RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission to service role
GRANT EXECUTE ON FUNCTION increment_craft_count(UUID) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION increment_craft_count IS 'Atomically increments craft count for image cache entry. Used by ImageCacheRepository for race-condition-free incrementing.';

-- ============================================================================
-- Migration Metadata
-- ============================================================================

INSERT INTO _mystica_migrations (
    version,
    name,
    description,
    metadata,
    applied_at
) VALUES (
    '008',
    'image_cache_rpcs',
    'Add atomic RPC functions for image cache operations',
    jsonb_build_object(
        'functions_created', ARRAY['increment_craft_count'],
        'permissions_granted', 1
    ),
    NOW()
);