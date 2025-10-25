-- Migration: Populate enemyloot table with initial loot assignments
-- Purpose: Define material and item drops for all enemy types with tier-based progression
-- Created: 2025-10-24
-- NOTE: This migration is designed to be run ONCE. If you need to re-populate,
--       first run: DELETE FROM public.enemyloot;
-- Design Philosophy:
--   - Tier 1 (Common): Basic materials (common rarity)
--   - Tier 2 (Normal): Mix of common + uncommon materials
--   - Tier 3 (Hard): Uncommon + rare materials
--   - Tier 4 (Expert): Rare + epic materials
--   - Tier 5 (Master): Epic materials only
--   - Higher weights = more common drops
--   - Optional item drops (~5-10% chance) for variety
--   - guaranteed=true for themed styled enemy drops (future feature)

-- ============================================================================
-- Helper: Get enemy_type_id by name
-- Run this in a transaction with actual UUIDs from your database
-- ============================================================================

-- NOTE: This script uses SELECT to fetch UUIDs dynamically.
-- If enemy types don't exist yet, this will fail gracefully with FK constraint errors.

-- ============================================================================
-- Spray Paint Goblin (Tier 1 - Common)
-- Materials: Common urban materials with street vibe
-- ============================================================================

INSERT INTO public.enemyloot (enemy_type_id, lootable_type, lootable_id, drop_weight, guaranteed)
SELECT
  et.id,
  'material'::text,
  m.id,
  weights.weight,
  false
FROM public.enemytypes et
CROSS JOIN (
  SELECT 'gum'::text as mat, 100.0 as weight UNION ALL
  SELECT 'coffee'::text, 80.0 UNION ALL
  SELECT 'feather'::text, 60.0 UNION ALL
  SELECT 'cactus'::text, 50.0
) weights
JOIN public.materials m ON m.id::text = weights.mat
WHERE et.id::text = 'spray_paint_goblin';

-- Optional item drops for Spray Paint Goblin
INSERT INTO public.enemyloot (enemy_type_id, lootable_type, lootable_id, drop_weight, guaranteed)
SELECT
  et.id,
  'item_type'::text,
  it.id,
  10.0,
  false
FROM public.enemytypes et
CROSS JOIN public.itemtypes it
WHERE et.id::text = 'spray_paint_goblin' AND it.id::text IN ('umbrella', 'trash_can_lid');

-- ============================================================================
-- Goopy Floating Eye (Tier 1-2)
-- Materials: Gooey/wet materials
-- ============================================================================

INSERT INTO public.enemyloot (enemy_type_id, lootable_type, lootable_id, drop_weight, guaranteed)
SELECT
  et.id,
  'material'::text,
  m.id,
  weights.weight,
  false
FROM public.enemytypes et
CROSS JOIN (
  SELECT 'slime'::text as mat, 100.0 as weight UNION ALL
  SELECT 'bubble'::text, 70.0 UNION ALL
  SELECT 'cloud'::text, 50.0 UNION ALL
  SELECT 'matcha_powder'::text, 40.0
) weights
JOIN public.materials m ON m.id::text = weights.mat
WHERE et.id::text = 'goopy_floating_eye';

INSERT INTO public.enemyloot (enemy_type_id, lootable_type, lootable_id, drop_weight, guaranteed)
SELECT
  et.id,
  'item_type'::text,
  it.id,
  8.0,
  false
FROM public.enemytypes et
CROSS JOIN public.itemtypes it
WHERE et.id::text = 'goopy_floating_eye' AND it.id::text IN ('enormous_key', 'candle');

-- ============================================================================
-- Feral Unicorn (Tier 2-3)
-- Materials: Rainbow/magical materials
-- ============================================================================

INSERT INTO public.enemyloot (enemy_type_id, lootable_type, lootable_id, drop_weight, guaranteed)
SELECT
  et.id,
  'material'::text,
  m.id,
  weights.weight,
  false
FROM public.enemytypes et
CROSS JOIN (
  SELECT 'rainbow'::text as mat, 100.0 as weight UNION ALL
  SELECT 'sparkles'::text, 80.0 UNION ALL
  SELECT 'bubble'::text, 60.0 UNION ALL
  SELECT 'neon'::text, 50.0 UNION ALL
  SELECT 'ghost'::text, 30.0
) weights
JOIN public.materials m ON m.id::text = weights.mat
WHERE et.id::text = 'feral_unicorn';

INSERT INTO public.enemyloot (enemy_type_id, lootable_type, lootable_id, drop_weight, guaranteed)
SELECT
  et.id,
  'item_type'::text,
  it.id,
  10.0,
  false
FROM public.enemytypes et
CROSS JOIN public.itemtypes it
WHERE et.id::text = 'feral_unicorn' AND it.id::text IN ('halo', 'a_rose', 'cowboy_hat');

-- ============================================================================
-- Bipedal Deer (Tier 3)
-- Materials: Natural/mystical materials
-- ============================================================================

INSERT INTO public.enemyloot (enemy_type_id, lootable_type, lootable_id, drop_weight, guaranteed)
SELECT
  et.id,
  'material'::text,
  m.id,
  weights.weight,
  false
FROM public.enemytypes et
CROSS JOIN (
  SELECT 'feather'::text as mat, 100.0 as weight UNION ALL
  SELECT 'cloud'::text, 80.0 UNION ALL
  SELECT 'ghost'::text, 60.0 UNION ALL
  SELECT 'lightning'::text, 40.0 UNION ALL
  SELECT 'rainbow'::text, 50.0
) weights
JOIN public.materials m ON m.id::text = weights.mat
WHERE et.id::text = 'bipedal_deer';

INSERT INTO public.enemyloot (enemy_type_id, lootable_type, lootable_id, drop_weight, guaranteed)
SELECT
  et.id,
  'item_type'::text,
  it.id,
  12.0,
  false
FROM public.enemytypes et
CROSS JOIN public.itemtypes it
WHERE et.id::text = 'bipedal_deer' AND it.id::text IN ('sword', 'leather_jacket');

-- ============================================================================
-- Politician (Tier 4-5)
-- Materials: High-value rare/epic materials
-- ============================================================================

INSERT INTO public.enemyloot (enemy_type_id, lootable_type, lootable_id, drop_weight, guaranteed)
SELECT
  et.id,
  'material'::text,
  m.id,
  weights.weight,
  false
FROM public.enemytypes et
CROSS JOIN (
  SELECT 'diamond'::text as mat, 100.0 as weight UNION ALL
  SELECT 'lightning'::text, 80.0 UNION ALL
  SELECT 'neon'::text, 70.0 UNION ALL
  SELECT 'ghost'::text, 60.0 UNION ALL
  SELECT 'flame'::text, 50.0
) weights
JOIN public.materials m ON m.id::text = weights.mat
WHERE et.id::text = 'politician';

INSERT INTO public.enemyloot (enemy_type_id, lootable_type, lootable_id, drop_weight, guaranteed)
SELECT
  et.id,
  'item_type'::text,
  it.id,
  15.0,
  false
FROM public.enemytypes et
CROSS JOIN public.itemtypes it
WHERE et.id::text = 'politician' AND it.id::text IN ('gatling_gun', 'tux', 'enormous_key');

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Run this after migration to verify loot table population
SELECT
  et.name as enemy_name,
  et.tier_id,
  COUNT(CASE WHEN el.lootable_type = 'material' THEN 1 END) as material_count,
  COUNT(CASE WHEN el.lootable_type = 'item_type' THEN 1 END) as item_count,
  SUM(CASE WHEN el.lootable_type = 'material' THEN el.drop_weight ELSE 0 END) as total_material_weight
FROM public.enemytypes et
LEFT JOIN public.enemyloot el ON et.id = el.enemy_type_id
GROUP BY et.id, et.name, et.tier_id
ORDER BY et.tier_id, et.name;

-- ============================================================================
-- Notes
-- ============================================================================

-- 1. Material weights are relative probabilities during weighted random selection
-- 2. Higher weights = more common drops (100 is most common, 30 is rare)
-- 3. Item drops have lower weights (~5-15) representing ~5-15% drop chance
-- 4. guaranteed=false for all entries (guaranteed drops reserved for special styled enemies)
-- 5. Loot progression follows tier difficulty:
--    - Tier 1: Common materials only
--    - Tier 2-3: Common + Uncommon + Rare
--    - Tier 4-5: Rare + Epic
-- 6. This script is designed to run once; to re-run, first DELETE FROM enemyloot;
-- 7. If enemy_type or material IDs don't exist, FK constraints will fail gracefully
-- 8. Style inheritance (enemy.style_id → material.style_id) happens in CombatService,
--    not in this loot table definition
