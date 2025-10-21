-- ============================================================================
-- COMBAT HISTORY RPC FUNCTIONS
-- Migration: 005_combat_history_rpcs.sql
--
-- Creates PostgreSQL RPC functions for atomic combat history operations:
-- 1. update_combat_history() - UPSERT player combat history with streak logic
-- 2. increment_combat_attempts() - Safely increment attempt counter
-- 3. cleanup_expired_sessions() - Scheduled cleanup for Redis sync
-- ============================================================================

-- Function: update_combat_history
--
-- Atomically updates player combat history for a location with:
-- - UPSERT pattern (INSERT or UPDATE based on existing record)
-- - Streak calculation (increment on win, reset on loss)
-- - Win/loss counting
-- - Attempt tracking
-- - Timestamp updates
--
-- Parameters:
--   p_user_id    - User UUID
--   p_location_id - Location UUID
--   p_result     - 'victory' or 'defeat'
--
-- Returns: void
--
-- Usage:
--   SELECT update_combat_history('user-uuid', 'location-uuid', 'victory');
--
CREATE OR REPLACE FUNCTION update_combat_history(
    p_user_id UUID,
    p_location_id UUID,
    p_result TEXT
) RETURNS VOID AS $$
DECLARE
    v_current_streak INT;
    v_longest_streak INT;
    v_new_victories INT;
    v_new_defeats INT;
    v_record_exists BOOLEAN;
BEGIN
    -- Validate input parameters
    IF p_user_id IS NULL OR p_location_id IS NULL OR p_result IS NULL THEN
        RAISE EXCEPTION 'All parameters (user_id, location_id, result) are required';
    END IF;

    IF p_result NOT IN ('victory', 'defeat') THEN
        RAISE EXCEPTION 'Result must be either ''victory'' or ''defeat'', got: %', p_result;
    END IF;

    -- Check if record exists
    SELECT TRUE INTO v_record_exists
    FROM playercombathistory
    WHERE user_id = p_user_id AND location_id = p_location_id;

    v_record_exists := COALESCE(v_record_exists, FALSE);

    IF NOT v_record_exists THEN
        -- INSERT new record
        IF p_result = 'victory' THEN
            v_current_streak := 1;
            v_longest_streak := 1;
            v_new_victories := 1;
            v_new_defeats := 0;
        ELSE
            v_current_streak := 0;
            v_longest_streak := 0;
            v_new_victories := 0;
            v_new_defeats := 1;
        END IF;

        INSERT INTO playercombathistory (
            user_id,
            location_id,
            total_attempts,
            victories,
            defeats,
            current_streak,
            longest_streak,
            last_attempt
        ) VALUES (
            p_user_id,
            p_location_id,
            1, -- first attempt
            v_new_victories,
            v_new_defeats,
            v_current_streak,
            v_longest_streak,
            NOW()
        );
    ELSE
        -- UPDATE existing record
        SELECT current_streak, longest_streak
        INTO v_current_streak, v_longest_streak
        FROM playercombathistory
        WHERE user_id = p_user_id AND location_id = p_location_id;

        IF p_result = 'victory' THEN
            -- Increment streak and victories
            v_current_streak := v_current_streak + 1;
            v_longest_streak := GREATEST(v_longest_streak, v_current_streak);
            v_new_victories := 1;
            v_new_defeats := 0;
        ELSE
            -- Reset streak and increment defeats
            v_current_streak := 0;
            v_new_victories := 0;
            v_new_defeats := 1;
        END IF;

        UPDATE playercombathistory
        SET
            total_attempts = total_attempts + 1,
            victories = victories + v_new_victories,
            defeats = defeats + v_new_defeats,
            current_streak = v_current_streak,
            longest_streak = v_longest_streak,
            last_attempt = NOW()
        WHERE user_id = p_user_id AND location_id = p_location_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION update_combat_history(UUID, UUID, TEXT) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION update_combat_history IS 'Atomically updates player combat history with streak calculation and win/loss tracking. Used by CombatRepository.';

-- ============================================================================

-- Function: increment_combat_attempts
--
-- Safely increments combat attempt counter without affecting other stats.
-- Used when combat starts (before completion/result known).
--
-- Parameters:
--   p_user_id    - User UUID
--   p_location_id - Location UUID
--
-- Returns: void
--
-- Usage:
--   SELECT increment_combat_attempts('user-uuid', 'location-uuid');
--
CREATE OR REPLACE FUNCTION increment_combat_attempts(
    p_user_id UUID,
    p_location_id UUID
) RETURNS VOID AS $$
BEGIN
    -- Validate input parameters
    IF p_user_id IS NULL OR p_location_id IS NULL THEN
        RAISE EXCEPTION 'Both user_id and location_id are required';
    END IF;

    -- UPSERT: Insert if not exists, update if exists
    INSERT INTO playercombathistory (
        user_id,
        location_id,
        total_attempts,
        victories,
        defeats,
        current_streak,
        longest_streak,
        last_attempt
    ) VALUES (
        p_user_id,
        p_location_id,
        1, -- first attempt
        0, -- no victories yet
        0, -- no defeats yet
        0, -- no streak yet
        0, -- no longest streak yet
        NOW()
    )
    ON CONFLICT (user_id, location_id)
    DO UPDATE SET
        total_attempts = playercombathistory.total_attempts + 1,
        last_attempt = NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION increment_combat_attempts(UUID, UUID) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION increment_combat_attempts IS 'Increments combat attempt counter when combat starts. Used by CombatRepository for attempt tracking.';

-- ============================================================================

-- Function: cleanup_expired_sessions
--
-- Scheduled cleanup function to remove old combat sessions from PostgreSQL
-- that should have been cleaned up from Redis. Acts as a backup cleanup
-- mechanism for sessions that weren't properly archived.
--
-- Sessions older than 24 hours with no outcome are considered abandoned.
--
-- Parameters: none
--
-- Returns: number of sessions cleaned up
--
-- Usage (for scheduled jobs):
--   SELECT cleanup_expired_sessions();
--
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS INTEGER AS $$
DECLARE
    v_cleanup_count INTEGER;
BEGIN
    -- Mark abandoned sessions (no outcome after 24 hours) as 'abandoned'
    UPDATE combatsessions
    SET
        outcome = 'abandoned',
        updated_at = NOW()
    WHERE
        outcome IS NULL
        AND created_at < NOW() - INTERVAL '24 hours';

    GET DIAGNOSTICS v_cleanup_count = ROW_COUNT;

    -- Log cleanup operation if any sessions were updated
    IF v_cleanup_count > 0 THEN
        INSERT INTO analyticsevents (event_name, properties, timestamp)
        VALUES (
            'combat_session_cleanup',
            json_build_object(
                'cleaned_sessions', v_cleanup_count,
                'cleanup_reason', 'expired_timeout'
            ),
            NOW()
        );
    END IF;

    RETURN v_cleanup_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION cleanup_expired_sessions() TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION cleanup_expired_sessions IS 'Cleanup function for abandoned combat sessions. Marks sessions older than 24h with no outcome as abandoned.';

-- ============================================================================

-- Function: get_combat_leaderboard
--
-- Get top players by combat performance across all locations
-- Used for leaderboard features and analytics
--
-- Parameters:
--   p_limit - Number of top players to return (default: 10)
--   p_min_attempts - Minimum attempts required to qualify (default: 5)
--
-- Returns: TABLE with player stats
--
-- Usage:
--   SELECT * FROM get_combat_leaderboard(20, 10);
--
CREATE OR REPLACE FUNCTION get_combat_leaderboard(
    p_limit INTEGER DEFAULT 10,
    p_min_attempts INTEGER DEFAULT 5
) RETURNS TABLE (
    user_id UUID,
    total_attempts BIGINT,
    total_victories BIGINT,
    total_defeats BIGINT,
    win_rate NUMERIC,
    max_streak BIGINT,
    active_locations BIGINT,
    avg_streak NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pch.user_id,
        SUM(pch.total_attempts) as total_attempts,
        SUM(pch.victories) as total_victories,
        SUM(pch.defeats) as total_defeats,
        ROUND(
            CASE
                WHEN SUM(pch.total_attempts) > 0
                THEN SUM(pch.victories)::NUMERIC / SUM(pch.total_attempts)::NUMERIC
                ELSE 0
            END, 4
        ) as win_rate,
        MAX(pch.longest_streak) as max_streak,
        COUNT(DISTINCT pch.location_id) as active_locations,
        ROUND(AVG(pch.current_streak), 2) as avg_streak
    FROM playercombathistory pch
    GROUP BY pch.user_id
    HAVING SUM(pch.total_attempts) >= p_min_attempts
    ORDER BY win_rate DESC, total_victories DESC, max_streak DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION get_combat_leaderboard(INTEGER, INTEGER) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION get_combat_leaderboard IS 'Returns top players by combat performance for leaderboard features. Requires minimum attempts to qualify.';

-- ============================================================================

-- Function: get_location_combat_stats
--
-- Get aggregated combat statistics for a specific location
-- Used for location difficulty analysis and balancing
--
-- Parameters:
--   p_location_id - Location UUID
--
-- Returns: TABLE with location combat stats
--
-- Usage:
--   SELECT * FROM get_location_combat_stats('location-uuid');
--
CREATE OR REPLACE FUNCTION get_location_combat_stats(
    p_location_id UUID
) RETURNS TABLE (
    location_id UUID,
    total_players BIGINT,
    total_attempts BIGINT,
    total_victories BIGINT,
    total_defeats BIGINT,
    avg_win_rate NUMERIC,
    avg_attempts_per_player NUMERIC,
    max_streak BIGINT,
    avg_streak NUMERIC,
    most_recent_attempt TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p_location_id as location_id,
        COUNT(DISTINCT pch.user_id) as total_players,
        SUM(pch.total_attempts) as total_attempts,
        SUM(pch.victories) as total_victories,
        SUM(pch.defeats) as total_defeats,
        ROUND(
            CASE
                WHEN SUM(pch.total_attempts) > 0
                THEN SUM(pch.victories)::NUMERIC / SUM(pch.total_attempts)::NUMERIC
                ELSE 0
            END, 4
        ) as avg_win_rate,
        ROUND(AVG(pch.total_attempts), 2) as avg_attempts_per_player,
        MAX(pch.longest_streak) as max_streak,
        ROUND(AVG(pch.current_streak), 2) as avg_streak,
        MAX(pch.last_attempt) as most_recent_attempt
    FROM playercombathistory pch
    WHERE pch.location_id = p_location_id
    GROUP BY p_location_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION get_location_combat_stats(UUID) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION get_location_combat_stats IS 'Returns aggregated combat statistics for a specific location for difficulty analysis and balancing.';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Improve performance of combat history queries
CREATE INDEX IF NOT EXISTS idx_playercombathistory_user_last_attempt
ON playercombathistory(user_id, last_attempt DESC);

CREATE INDEX IF NOT EXISTS idx_playercombathistory_location_stats
ON playercombathistory(location_id, total_attempts DESC, victories DESC);

CREATE INDEX IF NOT EXISTS idx_playercombathistory_leaderboard
ON playercombathistory(total_attempts, victories DESC, longest_streak DESC)
WHERE total_attempts >= 5;

-- Improve performance of combat session queries
CREATE INDEX IF NOT EXISTS idx_combatsessions_outcome_created_at
ON combatsessions(outcome, created_at DESC)
WHERE outcome IS NULL;

CREATE INDEX IF NOT EXISTS idx_combatsessions_user_location_created
ON combatsessions(user_id, location_id, created_at DESC);

-- Improve performance of combat log events queries
CREATE INDEX IF NOT EXISTS idx_combatlogevents_combat_actor_seq
ON combatlogevents(combat_id, actor, seq);

CREATE INDEX IF NOT EXISTS idx_combatlogevents_event_type_ts
ON combatlogevents(event_type, ts DESC);

-- ============================================================================
-- CONSTRAINTS AND VALIDATION
-- ============================================================================

-- Ensure combat results are valid in playercombathistory context
ALTER TABLE playercombathistory
ADD CONSTRAINT chk_combat_totals
CHECK (total_attempts >= victories + defeats);

ALTER TABLE playercombathistory
ADD CONSTRAINT chk_streak_bounds
CHECK (current_streak >= 0 AND longest_streak >= 0 AND longest_streak >= current_streak);

-- Ensure combat log events have valid sequence numbers
ALTER TABLE combatlogevents
ADD CONSTRAINT chk_combat_log_seq
CHECK (seq >= 0);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log successful migration
INSERT INTO analyticsevents (event_name, properties, timestamp)
VALUES (
    'migration_completed',
    json_build_object(
        'migration', '005_combat_history_rpcs',
        'functions_created', ARRAY[
            'update_combat_history',
            'increment_combat_attempts',
            'cleanup_expired_sessions',
            'get_combat_leaderboard',
            'get_location_combat_stats'
        ],
        'indexes_created', 5,
        'constraints_added', 3
    ),
    NOW()
);