-- Migration: Add universal weapon dial configurations for MVP0
-- Purpose: All weapons use same dial pattern (single_arc) with same timing mechanics
-- This ensures CombatService can retrieve weapon config for any equipped weapon
--
-- Background: CombatService.getWeaponConfig() throws NotFoundError if weapon
-- is equipped but has no entry in weapons table. For MVP0, all weapons share
-- identical dial mechanics regardless of ItemType.

-- MVP0 Universal Weapon Configuration:
-- - Pattern: single_arc (only pattern implemented)
-- - Spin speed: 180 deg/s (constant for all weapons)
-- - Zone distribution (360 degrees total):
--   * Injure: 30° (self-damage, -50% multiplier)
--   * Miss: 60° (0% damage)
--   * Graze: 90° (60% damage)
--   * Normal: 150° (100% damage)
--   * Crit: 30° (160% + 0-100% RNG bonus)

-- Step 1: Get all weapon ItemType IDs that need dial configs
-- Step 2: For each weapon ItemType, create one player item as reference
-- Step 3: Insert weapon dial config for that item

-- Create temporary table to hold weapon ItemType IDs
CREATE TEMP TABLE temp_weapon_types AS
SELECT id, name, rarity
FROM itemtypes
WHERE category = 'weapon';

-- For each weapon ItemType, we need to create a "template" item entry
-- These are NOT owned by any user (user_id = NULL would fail FK constraint)
-- Instead, we'll use a special "system" user or the first user in the database

-- Get first user ID for system items (or create if doesn't exist)
DO $$
DECLARE
  system_user_id UUID;
  weapon_type RECORD;
  new_item_id UUID;
BEGIN
  -- Get first user as system user for template items
  SELECT id INTO system_user_id FROM users LIMIT 1;

  IF system_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found in database. Cannot create weapon templates.';
  END IF;

  -- For each weapon ItemType, create template item if it doesn't have weapon config
  FOR weapon_type IN SELECT * FROM temp_weapon_types LOOP
    -- Check if any item of this type already has weapon config
    IF NOT EXISTS (
      SELECT 1
      FROM items i
      JOIN weapons w ON w.item_id = i.id
      WHERE i.item_type_id = weapon_type.id
    ) THEN
      -- Create a template item for this weapon type
      INSERT INTO items (
        item_type_id,
        user_id,
        level,
        current_stats
      ) VALUES (
        weapon_type.id,
        system_user_id,
        1, -- Base level
        '{"atkPower": 0, "atkAccuracy": 0, "defPower": 0, "defAccuracy": 0}'::jsonb
      )
      RETURNING id INTO new_item_id;

      -- Insert weapon dial configuration
      INSERT INTO weapons (
        item_id,
        pattern,
        spin_deg_per_s,
        deg_injure,
        deg_miss,
        deg_graze,
        deg_normal,
        deg_crit
      ) VALUES (
        new_item_id,
        'single_arc',
        180.0,  -- degrees per second (constant for MVP0)
        30.0,   -- injure zone (30°)
        60.0,   -- miss zone (60°)
        90.0,   -- graze zone (90°)
        150.0,  -- normal zone (150°)
        30.0    -- crit zone (30°)
      );

      RAISE NOTICE 'Created weapon dial config for: % (ItemType: %)', weapon_type.name, weapon_type.id;
    ELSE
      RAISE NOTICE 'Weapon dial config already exists for: %', weapon_type.name;
    END IF;
  END LOOP;
END $$;

-- Cleanup temp table
DROP TABLE temp_weapon_types;

-- Verify results
SELECT
  it.name as weapon_type,
  it.rarity,
  w.pattern,
  w.spin_deg_per_s,
  w.deg_injure,
  w.deg_miss,
  w.deg_graze,
  w.deg_normal,
  w.deg_crit,
  (w.deg_injure + w.deg_miss + w.deg_graze + w.deg_normal + w.deg_crit) as total_degrees
FROM weapons w
JOIN items i ON w.item_id = i.id
JOIN itemtypes it ON i.item_type_id = it.id
WHERE it.category = 'weapon'
ORDER BY it.name;
