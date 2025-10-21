-- Migration: Level Rewards System
-- Description: Creates LevelRewards and UserLevelRewards tables for level milestone rewards
-- Author: Backend Developer Agent
-- Date: 2025-01-27

-- =======================
-- DROP EXISTING OBJECTS
-- =======================

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS UserLevelRewards CASCADE;
DROP TABLE IF EXISTS LevelRewards CASCADE;

-- =======================
-- CREATE ENUMS
-- =======================

-- Reward type enum for level rewards
DO $$ BEGIN
    CREATE TYPE reward_type AS ENUM ('gold', 'feature_unlock', 'cosmetic');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =======================
-- CREATE TABLES
-- =======================

-- LevelRewards: Defines available rewards for each level milestone
CREATE TABLE LevelRewards (
    level INTEGER NOT NULL PRIMARY KEY CHECK (level >= 1),
    reward_type reward_type NOT NULL,
    reward_value INTEGER NOT NULL CHECK (reward_value >= 0),
    reward_description TEXT NOT NULL,
    is_claimable BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT level_rewards_description_not_empty CHECK (LENGTH(TRIM(reward_description)) > 0)
);

-- UserLevelRewards: Tracks which rewards users have claimed
CREATE TABLE UserLevelRewards (
    user_id UUID NOT NULL,
    level INTEGER NOT NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reward_amount INTEGER NOT NULL CHECK (reward_amount >= 0),

    -- Primary key
    PRIMARY KEY (user_id, level),

    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (level) REFERENCES LevelRewards(level) ON DELETE RESTRICT
);

-- =======================
-- CREATE INDEXES
-- =======================

-- LevelRewards indexes
CREATE INDEX idx_level_rewards_type ON LevelRewards(reward_type);
CREATE INDEX idx_level_rewards_claimable ON LevelRewards(is_claimable) WHERE is_claimable = true;

-- UserLevelRewards indexes
CREATE INDEX idx_user_level_rewards_user_id ON UserLevelRewards(user_id);
CREATE INDEX idx_user_level_rewards_claimed_at ON UserLevelRewards(claimed_at DESC);
CREATE INDEX idx_user_level_rewards_level ON UserLevelRewards(level);

-- =======================
-- ROW LEVEL SECURITY
-- =======================

-- Enable RLS on tables
ALTER TABLE LevelRewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE UserLevelRewards ENABLE ROW LEVEL SECURITY;

-- LevelRewards policies (read-only for authenticated users)
CREATE POLICY "LevelRewards are readable by authenticated users" ON LevelRewards
    FOR SELECT
    TO authenticated
    USING (true);

-- UserLevelRewards policies (users can only see their own claimed rewards)
CREATE POLICY "Users can view their own level rewards" ON UserLevelRewards
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own level reward claims" ON UserLevelRewards
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Service role policies (full access for backend operations)
CREATE POLICY "Service role has full access to LevelRewards" ON LevelRewards
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to UserLevelRewards" ON UserLevelRewards
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =======================
-- SEED DATA
-- =======================

-- Insert level rewards (levels 1-50)
INSERT INTO LevelRewards (level, reward_type, reward_value, reward_description, is_claimable) VALUES
    -- Early levels (1-10): Small gold rewards to encourage progression
    (2, 'gold', 100, 'Welcome bonus for reaching level 2!', true),
    (3, 'gold', 150, 'Bronze milestone reward', true),
    (5, 'gold', 250, 'First major milestone reached!', true),
    (7, 'gold', 300, 'Lucky level seven bonus', true),
    (10, 'gold', 500, 'Double digits achievement!', true),

    -- Mid levels (11-25): Feature unlocks and larger gold rewards
    (12, 'gold', 600, 'Persistence pays off', true),
    (15, 'feature_unlock', 0, 'Advanced equipment slots unlocked', false),
    (18, 'gold', 800, 'Steady progress reward', true),
    (20, 'gold', 1000, 'Veteran player milestone', true),
    (22, 'gold', 1100, 'Master of fundamentals', true),
    (25, 'gold', 1250, 'Quarter-century achievement', true),

    -- High levels (26-40): Premium rewards and major unlocks
    (28, 'gold', 1400, 'Elite tier entry bonus', true),
    (30, 'feature_unlock', 0, 'Prestige preparation unlocked', false),
    (32, 'gold', 1600, 'Expert level reached', true),
    (35, 'gold', 1750, 'Mastery milestone', true),
    (38, 'gold', 1900, 'Excellence in progression', true),
    (40, 'gold', 2000, 'Champion tier unlocked!', true),

    -- Near-max levels (41-50): Prestige preparation and major rewards
    (42, 'gold', 2100, 'Approaching greatness', true),
    (45, 'feature_unlock', 0, 'Legendary equipment tier unlocked', false),
    (47, 'gold', 2350, 'Nearly at the summit', true),
    (50, 'cosmetic', 5000, 'Prestige Crown - Level 50 Master', true);

-- =======================
-- FUNCTIONS AND TRIGGERS
-- =======================

-- Function to validate level reward claims
CREATE OR REPLACE FUNCTION validate_level_reward_claim()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if user has reached the required level
    IF NOT EXISTS (
        SELECT 1 FROM PlayerProgression
        WHERE user_id = NEW.user_id AND level >= NEW.level
    ) THEN
        RAISE EXCEPTION 'User has not reached level %', NEW.level;
    END IF;

    -- Check if reward exists and is claimable
    IF NOT EXISTS (
        SELECT 1 FROM LevelRewards
        WHERE level = NEW.level AND is_claimable = true
    ) THEN
        RAISE EXCEPTION 'Level % reward is not claimable', NEW.level;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate reward claims
CREATE TRIGGER validate_level_reward_claim_trigger
    BEFORE INSERT ON UserLevelRewards
    FOR EACH ROW
    EXECUTE FUNCTION validate_level_reward_claim();

-- =======================
-- COMMENTS
-- =======================

-- Table comments
COMMENT ON TABLE LevelRewards IS 'Defines available rewards for level milestones';
COMMENT ON TABLE UserLevelRewards IS 'Tracks claimed level rewards by users';

-- Column comments
COMMENT ON COLUMN LevelRewards.level IS 'Level milestone (1-50+)';
COMMENT ON COLUMN LevelRewards.reward_type IS 'Type of reward: gold, feature_unlock, or cosmetic';
COMMENT ON COLUMN LevelRewards.reward_value IS 'Numeric value (gold amount or item ID)';
COMMENT ON COLUMN LevelRewards.reward_description IS 'User-friendly description';
COMMENT ON COLUMN LevelRewards.is_claimable IS 'Whether reward requires manual claiming (false for automatic unlocks)';

COMMENT ON COLUMN UserLevelRewards.user_id IS 'User who claimed the reward';
COMMENT ON COLUMN UserLevelRewards.level IS 'Level reward claimed';
COMMENT ON COLUMN UserLevelRewards.claimed_at IS 'When reward was claimed';
COMMENT ON COLUMN UserLevelRewards.reward_amount IS 'Actual amount awarded (may differ from definition due to events)';

-- Migration complete
NOTIFY pgsql, 'Migration 007_level_rewards completed successfully';